import { InstrumentType, Track } from '../types/daw';
import { getSampleBuffer } from './sampleLibrary';

export interface ActiveVoice {
  stop: (releaseTime?: number) => void;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Map MIDI pitches 36..51 (and 48..72 for 25-key LPK25 default C3-C5!) to drum sample IDs
export function getDrumSampleForPitch(pitch: number): string {
  const map: Record<number, string> = {
    // Standard GM Drum Map (C1 - D#2)
    36: 'kick_punch',
    37: 'rim_click',
    38: 'snare_acoustic',
    39: 'clap_analog',
    40: 'snare_tight',
    41: 'tom_low',
    42: 'hat_closed',
    43: 'tom_mid',
    44: 'hat_closed',
    45: 'tom_mid',
    46: 'hat_open',
    47: 'shaker_perc',
    48: 'kick_808',
    49: 'crash_cymbal',
    // Akai LPK25 default octave C3 (48) to C5 (72) convenient mapping
    50: 'snare_tight',
    51: 'clap_analog',
    52: 'snare_acoustic',
    53: 'tom_low',
    54: 'hat_closed',
    55: 'tom_mid',
    56: 'hat_open',
    57: 'rim_click',
    58: 'shaker_perc',
    59: 'crash_cymbal',
    60: 'kick_808',
    61: 'rim_click',
    62: 'snare_tight',
    63: 'clap_analog',
    64: 'snare_acoustic',
    65: 'tom_low',
    66: 'hat_closed',
    67: 'tom_mid',
    68: 'hat_open',
    69: 'shaker_perc',
    70: 'kick_punch',
    71: 'crash_cymbal',
    72: 'kick_808',
  };
  return map[pitch] || 'kick_punch';
}

export const DRUM_PAD_NAMES: Array<{ pitch: number; label: string; sampleId: string }> = [
  { pitch: 36, label: 'Kick', sampleId: 'kick_punch' },
  { pitch: 48, label: '808 Sub', sampleId: 'kick_808' },
  { pitch: 38, label: 'Snare', sampleId: 'snare_acoustic' },
  { pitch: 40, label: 'Trap Snr', sampleId: 'snare_tight' },
  { pitch: 39, label: 'Clap', sampleId: 'clap_analog' },
  { pitch: 42, label: 'CH Hat', sampleId: 'hat_closed' },
  { pitch: 46, label: 'OH Hat', sampleId: 'hat_open' },
  { pitch: 37, label: 'Rimshot', sampleId: 'rim_click' },
  { pitch: 47, label: 'Shaker', sampleId: 'shaker_perc' },
  { pitch: 49, label: 'Crash', sampleId: 'crash_cymbal' },
];

/**
 * Triggers a polyphonic synthesizer or drum voice directly on Web Audio nodes
 * with zero React overhead for <10ms MIDI hardware responsiveness.
 */
export function triggerInstrumentVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  instrument: InstrumentType,
  synthSettings: Track['synthSettings'],
  pitch: number,
  velocity: number,
  when: number,
  durationSec?: number
): ActiveVoice {
  const velGain = Math.max(0.05, Math.min(1, velocity / 127));

  if (instrument === 'drum_kit') {
    const sampleId = getDrumSampleForPitch(pitch);
    const buffer = getSampleBuffer(sampleId);
    if (!buffer) {
      return { stop: () => {} };
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(velGain * 0.95, when);
    src.connect(g);
    g.connect(destination);
    src.start(when);
    return {
      stop: () => {
        // Drum one-shots ring naturally unless choked
      },
    };
  }

  const freq = midiToFreq(pitch);
  const { attack, decay, sustain, release, cutoff, resonance, detune } = synthSettings;
  const amp = ctx.createGain();
  amp.connect(destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(Math.max(0.5, resonance), when);
  filter.connect(amp);

  const oscs: OscillatorNode[] = [];
  const subGains: AudioNode[] = [];

  if (instrument === 'grand_piano' || instrument === 'electric_piano') {
    const isEp = instrument === 'electric_piano';
    const carrier = ctx.createOscillator();
    carrier.type = isEp ? 'sine' : 'triangle';
    carrier.frequency.setValueAtTime(freq, when);

    const harmonic = ctx.createOscillator();
    harmonic.type = isEp ? 'sine' : 'sawtooth';
    harmonic.frequency.setValueAtTime(freq * (isEp ? 2 : 2), when);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(isEp ? freq * 1.4 * velGain : freq * 0.65 * velGain, when);
    modGain.gain.exponentialRampToValueAtTime(0.001, when + (isEp ? 0.35 : 0.18));

    // Hammer brightness burst
    const harmAmp = ctx.createGain();
    harmAmp.gain.setValueAtTime(isEp ? 0.18 * velGain : 0.28 * velGain, when);
    harmAmp.gain.exponentialRampToValueAtTime(0.01, when + (isEp ? 0.5 : 0.35));

    if (isEp) {
      // FM Rhodes bell tone
      harmonic.connect(modGain);
      modGain.connect(carrier.frequency);
    } else {
      harmonic.connect(harmAmp);
      harmAmp.connect(filter);
    }

    carrier.connect(filter);

    const brightness = Math.min(18000, cutoff * (0.4 + velGain * 1.2));
    filter.frequency.setValueAtTime(brightness, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(250, cutoff * 0.25), when + 0.9);

    oscs.push(carrier, harmonic);
    subGains.push(modGain, harmAmp);
  } else if (instrument === 'acid_sub_bass') {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq, when);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq, when);

    const sawGain = ctx.createGain();
    sawGain.gain.setValueAtTime(0.45, when);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.75, when);

    sub.connect(subGain);
    subGain.connect(filter);
    saw.connect(sawGain);
    sawGain.connect(filter);

    const envCutoff = Math.min(14000, cutoff * (1.2 + velGain * 1.8));
    filter.frequency.setValueAtTime(envCutoff, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(90, cutoff * 0.35), when + Math.max(0.06, decay));

    oscs.push(sub, saw);
    subGains.push(sawGain, subGain);
  } else if (instrument === 'karplus_pluck') {
    // Rich plucked string / acoustic guitar / oud timbre using rapid filtered harmonic decay
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, when);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.0015, when);

    const pluckFilter = ctx.createBiquadFilter();
    pluckFilter.type = 'lowpass';
    pluckFilter.Q.setValueAtTime(2.2, when);
    pluckFilter.frequency.setValueAtTime(Math.min(16000, freq * 10 * (0.5 + velGain)), when);
    pluckFilter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.2), when + 0.45);

    osc1.connect(pluckFilter);
    osc2.connect(pluckFilter);
    pluckFilter.connect(filter);
    filter.frequency.setValueAtTime(cutoff, when);

    oscs.push(osc1, osc2);
  } else if (instrument === 'lush_pad') {
    const detunes = [-detune * 1.4, -detune * 0.5, detune * 0.5, detune * 1.4];
    detunes.forEach((d, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, when);
      osc.detune.setValueAtTime(d, when);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, when);
      osc.connect(g);
      g.connect(filter);
      oscs.push(osc);
      subGains.push(g);
    });
    filter.frequency.setValueAtTime(Math.max(200, cutoff * 0.4), when);
    filter.frequency.linearRampToValueAtTime(Math.min(12000, cutoff), when + Math.max(0.15, attack + 0.25));
  } else {
    // analog_poly & audio_sampler default synth
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, when);
    osc1.detune.setValueAtTime(-detune, when);

    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq, when);
    osc2.detune.setValueAtTime(detune, when);

    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.45, when);

    osc1.connect(filter);
    osc2.connect(g2);
    g2.connect(filter);

    filter.frequency.setValueAtTime(Math.min(16000, cutoff * (0.6 + velGain)), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * 0.45), when + Math.max(0.08, decay));

    oscs.push(osc1, osc2);
    subGains.push(g2);
  }

  // Amplitude ADSR envelope
  const peak = velGain * 0.42;
  const sustainLevel = Math.max(0.001, peak * sustain);
  const atk = Math.max(0.003, attack);
  const dec = Math.max(0.02, decay);
  const rel = Math.max(0.03, release);

  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.linearRampToValueAtTime(peak, when + atk);
  amp.gain.exponentialRampToValueAtTime(sustainLevel, when + atk + dec);

  oscs.forEach((o) => o.start(when));

  let stopped = false;
  const stopAt = (releaseAt: number) => {
    if (stopped) return;
    stopped = true;
    const t = Math.max(when + atk + 0.01, releaseAt);
    try {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value || sustainLevel), t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + rel);
      oscs.forEach((o) => o.stop(t + rel + 0.02));
    } catch {
      // Ignore already-stopped nodes
    }
  };

  if (typeof durationSec === 'number') {
    stopAt(when + Math.max(0.04, durationSec));
  }

  return {
    stop: (releaseTime?: number) => {
      stopAt(releaseTime ?? ctx.currentTime);
    },
  };
}
