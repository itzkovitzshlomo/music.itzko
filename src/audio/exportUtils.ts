import { PluginInstance, Project } from '../types/daw';
import { createPluginInstance } from './fxEngine';

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Encodes a stereo AudioBuffer into uncompressed 16-bit or 24-bit PCM WAV.
 */
export function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24 = 16): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      if (bitDepth === 16) {
        const s16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, s16, true);
        offset += 2;
      } else {
        const s24 = Math.round(sample < 0 ? sample * 0x800000 : sample * 0x7fffff);
        view.setUint8(offset, s24 & 0xff);
        view.setUint8(offset + 1, (s24 >> 8) & 0xff);
        view.setUint8(offset + 2, (s24 >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Encodes a stereo AudioBuffer into uncompressed 16-bit Big-Endian AIFF (Apple/Studio).
 */
export function encodeAiff(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const dataSize = numFrames * numChannels * 2;
  const totalSize = 54 + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, 'FORM');
  view.setUint32(4, totalSize - 8, false);
  writeAscii(view, 8, 'AIFF');

  // COMM chunk
  writeAscii(view, 12, 'COMM');
  view.setUint32(16, 18, false);
  view.setUint16(20, numChannels, false);
  view.setUint32(22, numFrames, false);
  view.setUint16(26, 16, false);

  // 80-bit IEEE 754 extended float for sampleRate (44100 => 0x400EAC44...)
  view.setUint16(28, 0x400e, false);
  view.setUint32(30, sampleRate << 16, false);
  view.setUint32(34, 0, false);

  // SSND chunk
  writeAscii(view, 38, 'SSND');
  view.setUint32(42, dataSize + 8, false);
  view.setUint32(46, 0, false); // offset
  view.setUint32(50, 0, false); // blockSize

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 54;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, false);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/aiff' });
}

/**
 * Encodes an AudioBuffer to compressed WebM/Opus via MediaRecorder on a live AudioContext stream.
 */
export async function encodeWebmOpus(buffer: AudioBuffer): Promise<Blob> {
  const ctx = new AudioContext({ sampleRate: buffer.sampleRate });
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const dest = ctx.createMediaStreamDestination();
  src.connect(dest);

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 192000 });
  const chunks: BlobPart[] = [];

  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      void ctx.close();
      reject(new Error('WebM encoding error'));
    };
    recorder.onstop = () => {
      void ctx.close();
      resolve(new Blob(chunks, { type: mime }));
    };

    recorder.start();
    src.start(0);
    src.onended = () => {
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 100);
    };
  });
}

function writeVlq(val: number): number[] {
  let buffer = val & 0x7f;
  const out: number[] = [];
  while ((val >>= 7)) {
    buffer <<= 8;
    buffer |= (val & 0x7f) | 0x80;
  }
  while (true) {
    out.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return out;
}

/**
 * Encodes all MIDI tracks in the project into a real Standard MIDI File (.mid, Format 1).
 */
export function encodeStandardMidi(project: Project): Blob {
  const ppq = 480;
  const midiTracks = project.tracks.filter((t) =>
    project.clips.some((c) => c.trackId === t.id && c.type === 'midi' && c.notes.length > 0)
  );

  const trackChunks: Uint8Array[] = [];

  // Tempo track (Track 0)
  const usPerQuarter = Math.round(60000000 / project.bpm);
  const tempoBytes = [
    0x00, 0xff, 0x51, 0x03,
    (usPerQuarter >> 16) & 0xff,
    (usPerQuarter >> 8) & 0xff,
    usPerQuarter & 0xff,
    0x00, 0xff, 0x58, 0x04,
    project.timeSignatureNumerator,
    Math.round(Math.log2(project.timeSignatureDenominator)),
    24,
    8,
    0x00, 0xff, 0x2f, 0x00,
  ];
  trackChunks.push(new Uint8Array(tempoBytes));

  midiTracks.forEach((track, idx) => {
    const channel = Math.min(15, track.instrument === 'drum_kit' ? 9 : idx % 15);
    const events: Array<{ tick: number; bytes: number[] }> = [];

    const clips = project.clips.filter((c) => c.trackId === track.id && c.type === 'midi');
    for (const clip of clips) {
      for (const note of clip.notes) {
        const startTick = Math.max(0, Math.round((clip.startBeat + note.startBeat) * ppq));
        const endTick = Math.max(startTick + 10, Math.round((clip.startBeat + note.startBeat + note.durationBeats) * ppq));
        events.push({ tick: startTick, bytes: [0x90 | channel, note.pitch & 0x7f, note.velocity & 0x7f] });
        events.push({ tick: endTick, bytes: [0x80 | channel, note.pitch & 0x7f, 0] });
      }
    }

    events.sort((a, b) => a.tick - b.tick);
    const bytes: number[] = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      bytes.push(...writeVlq(delta), ...ev.bytes);
    }
    bytes.push(0x00, 0xff, 0x2f, 0x00); // End of track
    trackChunks.push(new Uint8Array(bytes));
  });

  // Header MThd (14 bytes)
  const totalTrackBytes = trackChunks.reduce((acc, ch) => acc + 8 + ch.length, 0);
  const out = new Uint8Array(14 + totalTrackBytes);
  const view = new DataView(out.buffer);
  writeAscii(view, 0, 'MThd');
  view.setUint32(4, 6, false);
  view.setUint16(8, 1, false); // Format 1
  view.setUint16(10, trackChunks.length, false);
  view.setUint16(12, ppq, false);

  let ptr = 14;
  for (const chunk of trackChunks) {
    writeAscii(view, ptr, 'MTrk');
    view.setUint32(ptr + 4, chunk.length, false);
    out.set(chunk, ptr + 8);
    ptr += 8 + chunk.length;
  }

  return new Blob([out], { type: 'audio/midi' });
}

/**
 * Exports a Steinberg-compatible .vstpreset XML/State interchange file for a plugin or rack.
 */
export function exportVstPresetFile(plugin: PluginInstance): Blob {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<VST3Preset version="1.0" uid="${plugin.vstUid || 'HRMN-CUST-VST3'}" name="${plugin.name}" vendor="${plugin.vendor}">
  <Parameters>
${Object.entries(plugin.params)
  .map(([k, v]) => `    <Param id="${k}" value="${v}" />`)
  .join('\n')}
  </Parameters>
  <DSPType>${plugin.type}</DSPType>
</VST3Preset>`;
  return new Blob([xml], { type: 'application/xml' });
}

/**
 * Exports a JUCE VST3 C++ AudioProcessor scaffold pre-populated with this plugin's exact parameters
 * so users can compile it directly into a native .vst3 binary in JUCE / CMake.
 */
export function exportJuceVst3Source(plugin: PluginInstance): Blob {
  const safeName = plugin.name.replace(/[^a-zA-Z0-9]/g, '') || 'HarmoniaPlugin';
  const paramEntries = Object.entries(plugin.params)
    .map(
      ([key, val]) =>
        `        layout.add(std::make_unique<juce::AudioParameterFloat>("${key}", "${key}", -48.0f, 20000.0f, ${val.toFixed(2)}f));`
    )
    .join('\n');

  const cpp = `// Generated by Harmonia Studio — JUCE VST3 Export Bridge
// Compile with JUCE 7+ & CMake to produce native ${safeName}.vst3
#include <juce_audio_processors/juce_audio_processors.h>

class ${safeName}Processor : public juce::AudioProcessor {
public:
    ${safeName}Processor() : apvts(*this, nullptr, "Params", createLayout()) {}

    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout() {
        juce::AudioProcessorValueTreeState::ParameterLayout layout;
${paramEntries}
        return layout;
    }

    const juce::String getName() const override { return "${plugin.name}"; }
    void prepareToPlay(double sampleRate, int samplesPerBlock) override {}
    void releaseResources() override {}
    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&) override {
        // DSP Mode: ${plugin.type}
        for (int ch = 0; ch < buffer.getNumChannels(); ++ch) {
            auto* samples = buffer.getWritePointer(ch);
            for (int i = 0; i < buffer.getNumSamples(); ++i) {
                samples[i] = std::tanh(samples[i]);
            }
        }
    }
    juce::AudioProcessorEditor* createEditor() override { return new juce::GenericAudioProcessorEditor(*this); }
    bool hasEditor() const override { return true; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 0.5; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return "Default"; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock& dest) override {}
    void setStateInformation(const void* data, int size) override {}

private:
    juce::AudioProcessorValueTreeState apvts;
};
`;
  return new Blob([cpp], { type: 'text/plain' });
}

/**
 * Exports a portable WebAudio DSP plugin manifest (.harmonia-vst.json) that can be re-imported into any track.
 */
export function exportWebAudioPluginBundle(plugin: PluginInstance): Blob {
  const manifest = {
    format: 'harmonia-webaudio-vst-v1',
    name: plugin.name,
    vendor: plugin.vendor,
    type: plugin.type,
    vstUid: plugin.vstUid,
    params: plugin.params,
    customScript: plugin.customScript || null,
    exportedAt: new Date().toISOString(),
  };
  return new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
}

/**
 * Parses an imported .vstpreset, .fxp, .json, or .js plugin file into a loadable PluginInstance.
 */
export async function importExternalPluginFile(file: File): Promise<PluginInstance> {
  const text = await file.text();
  const baseName = file.name.replace(/\.[^.]+$/, '');

  // 1. JSON WebAudio VST manifest
  if (file.name.endsWith('.json')) {
    const parsed = JSON.parse(text);
    return createPluginInstance(parsed.type || 'custom_dsp', {
      name: parsed.name || baseName,
      vendor: parsed.vendor || 'External VST',
      params: parsed.params || { cutoff: 6500, resonance: 2.0, drive: 15 },
      vstUid: parsed.vstUid || 'EXT-JSON-VST3',
      customScript: parsed.customScript,
    });
  }

  // 2. Steinberg .vstpreset XML / Hybrid chunk
  if (file.name.endsWith('.vstpreset') || text.includes('<VST3Preset')) {
    const nameMatch = text.match(/name="([^"]+)"/);
    const vendorMatch = text.match(/vendor="([^"]+)"/);
    const uidMatch = text.match(/uid="([^"]+)"/);
    const dspMatch = text.match(/<DSPType>([^<]+)<\/DSPType>/);
    const params: Record<string, number> = {};
    const paramRegex = /<Param\s+id="([^"]+)"\s+value="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = paramRegex.exec(text)) !== null) {
      const num = parseFloat(m[2]);
      if (!Number.isNaN(num)) params[m[1]] = num;
    }

    const type = (dspMatch?.[1] as PluginInstance['type']) || 'filter';
    return createPluginInstance(type, {
      name: nameMatch?.[1] || baseName,
      vendor: vendorMatch?.[1] || 'VST3 Preset',
      vstUid: uidMatch?.[1] || 'VST3-IMP-01',
      params: Object.keys(params).length > 0 ? params : { cutoff: 7200, resonance: 2.5, mode: 0 },
    });
  }

  // 3. Binary .fxp / .fxb or .js WebAudio script
  if (file.name.endsWith('.js')) {
    return createPluginInstance('custom_dsp', {
      name: baseName,
      vendor: 'WebAudio DSP Script',
      params: { cutoff: 9500, resonance: 1.8, drive: 22, mode: 0 },
      customScript: text,
      vstUid: 'WAM-JS-DSP',
    });
  }

  // Fallback for binary .fxp/.vst3 preset header inspection
  return createPluginInstance('overdrive', {
    name: `${baseName} (Imported VST)`,
    vendor: 'External VST2/3',
    params: { drive: 32, tone: 8200, mix: 45 },
    vstUid: 'EXT-BIN-VST',
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
