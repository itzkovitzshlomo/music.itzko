import { PluginInstance, PluginParam, PluginType } from '../types/daw';

export interface PluginCatalogEntry {
  type: PluginType;
  name: string;
  hebrewName: string;
  vendor: string;
  vstUid: string;
  description: string;
  paramDefs: PluginParam[];
  defaultParams: Record<string, number>;
}

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    type: 'eq4',
    name: 'Studio Parametric EQ4',
    hebrewName: 'אקולייזר פרמטרי 4 ערוצים',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-EQ04-VST3',
    description: 'אקולייזר מדויק עם מדפי נמוכים/גבוהים ושני תדרי אמצע.',
    paramDefs: [
      { id: 'lowGain', label: 'Low (80Hz)', value: 0, min: -12, max: 12, step: 0.5, unit: 'dB' },
      { id: 'lowMidGain', label: 'Low-Mid (400Hz)', value: 0, min: -12, max: 12, step: 0.5, unit: 'dB' },
      { id: 'highMidGain', label: 'High-Mid (2.5kHz)', value: 0, min: -12, max: 12, step: 0.5, unit: 'dB' },
      { id: 'highGain', label: 'High (10kHz)', value: 0, min: -12, max: 12, step: 0.5, unit: 'dB' },
    ],
    defaultParams: { lowGain: 0, lowMidGain: 0, highMidGain: 0, highGain: 0 },
  },
  {
    type: 'compressor',
    name: 'VCA Bus Compressor',
    hebrewName: 'קומפרסור VCA אולפני',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-CMP1-VST3',
    description: 'דחיסה דינמית לשמירה על פאנץ׳ ואיזון עוצמה.',
    paramDefs: [
      { id: 'threshold', label: 'Threshold', value: -18, min: -48, max: 0, step: 1, unit: 'dB' },
      { id: 'ratio', label: 'Ratio', value: 4, min: 1, max: 16, step: 0.5, unit: ':1' },
      { id: 'attack', label: 'Attack', value: 12, min: 1, max: 100, step: 1, unit: 'ms' },
      { id: 'release', label: 'Release', value: 160, min: 30, max: 800, step: 10, unit: 'ms' },
      { id: 'makeup', label: 'Makeup', value: 2, min: -6, max: 12, step: 0.5, unit: 'dB' },
    ],
    defaultParams: { threshold: -18, ratio: 4, attack: 12, release: 160, makeup: 2 },
  },
  {
    type: 'reverb',
    name: 'Algorithmic Hall Reverb',
    hebrewName: 'ריוורב אולמות סטריאו',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-REV2-VST3',
    description: 'חלל אקוסטי עשיר מבוסס Convolution Impulse Response.',
    paramDefs: [
      { id: 'mix', label: 'Wet Mix', value: 24, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'decay', label: 'Decay', value: 2.0, min: 0.4, max: 5.5, step: 0.1, unit: 's' },
      { id: 'damp', label: 'Damping', value: 6500, min: 1200, max: 16000, step: 100, unit: 'Hz' },
    ],
    defaultParams: { mix: 24, decay: 2.0, damp: 6500 },
  },
  {
    type: 'delay',
    name: 'Stereo Tape Delay',
    hebrewName: 'דיליי סרט אנלוגי',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-DLY3-VST3',
    description: 'הד סטריאו עם פידבק ומסנן חום של סרט מגנטי.',
    paramDefs: [
      { id: 'timeMs', label: 'Delay Time', value: 320, min: 40, max: 1200, step: 5, unit: 'ms' },
      { id: 'feedback', label: 'Feedback', value: 36, min: 0, max: 85, step: 1, unit: '%' },
      { id: 'tone', label: 'LP Filter', value: 4200, min: 800, max: 14000, step: 100, unit: 'Hz' },
      { id: 'mix', label: 'Wet Mix', value: 22, min: 0, max: 100, step: 1, unit: '%' },
    ],
    defaultParams: { timeMs: 320, feedback: 36, tone: 4200, mix: 22 },
  },
  {
    type: 'overdrive',
    name: 'Warm Tube Saturator',
    hebrewName: 'סטורציית שפופרות חמה',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-SAT1-VST3',
    description: 'מוסיף הרמוניות חמות ועומק אנלוגי לבס, תופים וסינת׳.',
    paramDefs: [
      { id: 'drive', label: 'Drive', value: 28, min: 0, max: 100, step: 1, unit: '%' },
      { id: 'tone', label: 'Tone', value: 7500, min: 1000, max: 16000, step: 100, unit: 'Hz' },
      { id: 'mix', label: 'Mix', value: 50, min: 0, max: 100, step: 1, unit: '%' },
    ],
    defaultParams: { drive: 28, tone: 7500, mix: 50 },
  },
  {
    type: 'chorus',
    name: 'Dimension Stereo Chorus',
    hebrewName: 'קורוס סטריאו רחב',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-CHR1-VST3',
    description: 'הרחבת סטריאו ועומק תנועה לפאדים, גיטרות וקלידים.',
    paramDefs: [
      { id: 'rate', label: 'LFO Rate', value: 1.1, min: 0.1, max: 6.0, step: 0.1, unit: 'Hz' },
      { id: 'depth', label: 'Depth', value: 4.5, min: 0.5, max: 12, step: 0.5, unit: 'ms' },
      { id: 'mix', label: 'Mix', value: 35, min: 0, max: 100, step: 1, unit: '%' },
    ],
    defaultParams: { rate: 1.1, depth: 4.5, mix: 35 },
  },
  {
    type: 'filter',
    name: 'Resonant State Filter',
    hebrewName: 'פילטר רזוננטי מתקדם',
    vendor: 'Harmonia DSP',
    vstUid: 'HRMN-FLT1-VST3',
    description: 'מסנן תדרים חלק ליצירת בנייה, סוויפים ועיצוב צליל.',
    paramDefs: [
      { id: 'cutoff', label: 'Cutoff', value: 8500, min: 80, max: 18000, step: 50, unit: 'Hz' },
      { id: 'resonance', label: 'Resonance', value: 2.2, min: 0.5, max: 16, step: 0.2, unit: 'Q' },
      { id: 'mode', label: 'Mode (0=LP, 1=HP)', value: 0, min: 0, max: 1, step: 1, unit: '' },
    ],
    defaultParams: { cutoff: 8500, resonance: 2.2, mode: 0 },
  },
];

export function createPluginInstance(type: PluginType, custom?: Partial<PluginInstance>): PluginInstance {
  const entry = PLUGIN_CATALOG.find((p) => p.type === type);
  return {
    id: `plg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    name: custom?.name || entry?.name || 'Custom DSP Plugin',
    vendor: custom?.vendor || entry?.vendor || 'User VST',
    enabled: custom?.enabled ?? true,
    params: { ...(entry?.defaultParams || { drive: 20, mix: 50 }), ...(custom?.params || {}) },
    customScript: custom?.customScript,
    vstUid: custom?.vstUid || entry?.vstUid || 'USER-CUST-VST3',
  };
}

export function getPluginParamDefs(plugin: PluginInstance): PluginParam[] {
  const entry = PLUGIN_CATALOG.find((p) => p.type === plugin.type);
  if (entry) return entry.paramDefs;
  return Object.entries(plugin.params).map(([key, value]) => ({
    id: key,
    label: key,
    value,
    min: 0,
    max: 100,
    step: 1,
    unit: '',
  }));
}

// Generates deterministic stereo impulse response for algorithmic reverb
function createImpulseResponse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(rate * 0.25, Math.floor(rate * Math.min(6, decaySec)));
  const ir = ctx.createBuffer(2, length, rate);
  let seed = 98765;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed / 4294967296) * 2 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, 2.6);
      data[i] = rand() * env * 0.55;
    }
  }
  return ir;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = Math.max(0, amount * 1.4);
  const nSamples = 1024;
  const buffer = new ArrayBuffer(nSamples * 4);
  const curve = new Float32Array(buffer);
  for (let i = 0; i < nSamples; i++) {
    const x = (i * 2) / nSamples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

export interface FxChainResult {
  input: AudioNode;
  output: AudioNode;
  cleanup: () => void;
}

/**
 * Builds a real Web Audio insert processing chain from an array of PluginInstances.
 */
export function buildFxChain(ctx: BaseAudioContext, plugins: PluginInstance[]): FxChainResult {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const activeNodes: AudioNode[] = [input, output];
  const oscsToStop: OscillatorNode[] = [];

  let tail: AudioNode = input;

  for (const plugin of plugins) {
    if (!plugin.enabled) continue;

    if (plugin.type === 'eq4') {
      const low = ctx.createBiquadFilter();
      low.type = 'lowshelf';
      low.frequency.value = 80;
      low.gain.value = plugin.params.lowGain ?? 0;

      const lowMid = ctx.createBiquadFilter();
      lowMid.type = 'peaking';
      lowMid.frequency.value = 400;
      lowMid.Q.value = 1.1;
      lowMid.gain.value = plugin.params.lowMidGain ?? 0;

      const highMid = ctx.createBiquadFilter();
      highMid.type = 'peaking';
      highMid.frequency.value = 2500;
      highMid.Q.value = 1.1;
      highMid.gain.value = plugin.params.highMidGain ?? 0;

      const high = ctx.createBiquadFilter();
      high.type = 'highshelf';
      high.frequency.value = 10000;
      high.gain.value = plugin.params.highGain ?? 0;

      tail.connect(low);
      low.connect(lowMid);
      lowMid.connect(highMid);
      highMid.connect(high);
      tail = high;
      activeNodes.push(low, lowMid, highMid, high);
    } else if (plugin.type === 'compressor') {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = plugin.params.threshold ?? -18;
      comp.ratio.value = Math.max(1, plugin.params.ratio ?? 4);
      comp.attack.value = Math.max(0.001, (plugin.params.attack ?? 12) / 1000);
      comp.release.value = Math.max(0.01, (plugin.params.release ?? 160) / 1000);

      const makeup = ctx.createGain();
      const db = plugin.params.makeup ?? 0;
      makeup.gain.value = Math.pow(10, db / 20);

      tail.connect(comp);
      comp.connect(makeup);
      tail = makeup;
      activeNodes.push(comp, makeup);
    } else if (plugin.type === 'reverb') {
      const wetRatio = Math.max(0, Math.min(1, (plugin.params.mix ?? 24) / 100));
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merge = ctx.createGain();
      dry.gain.value = 1 - wetRatio * 0.45;
      wet.gain.value = wetRatio;

      const conv = ctx.createConvolver();
      conv.buffer = createImpulseResponse(ctx, plugin.params.decay ?? 2.0);

      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = plugin.params.damp ?? 6500;

      tail.connect(dry);
      dry.connect(merge);
      tail.connect(conv);
      conv.connect(damp);
      damp.connect(wet);
      wet.connect(merge);
      tail = merge;
      activeNodes.push(dry, wet, merge, conv, damp);
    } else if (plugin.type === 'delay') {
      const wetRatio = Math.max(0, Math.min(1, (plugin.params.mix ?? 22) / 100));
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merge = ctx.createGain();
      dry.gain.value = 1;
      wet.gain.value = wetRatio;

      const delay = ctx.createDelay(2.0);
      delay.delayTime.value = Math.max(0.02, Math.min(1.8, (plugin.params.timeMs ?? 320) / 1000));

      const fb = ctx.createGain();
      fb.gain.value = Math.max(0, Math.min(0.88, (plugin.params.feedback ?? 36) / 100));

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = plugin.params.tone ?? 4200;

      tail.connect(dry);
      dry.connect(merge);

      tail.connect(delay);
      delay.connect(tone);
      tone.connect(fb);
      fb.connect(delay);
      tone.connect(wet);
      wet.connect(merge);

      tail = merge;
      activeNodes.push(dry, wet, merge, delay, fb, tone);
    } else if (plugin.type === 'overdrive') {
      const wetRatio = Math.max(0, Math.min(1, (plugin.params.mix ?? 50) / 100));
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merge = ctx.createGain();
      dry.gain.value = 1 - wetRatio;
      wet.gain.value = wetRatio;

      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(plugin.params.drive ?? 28);
      shaper.oversample = '2x';

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = plugin.params.tone ?? 7500;

      tail.connect(dry);
      dry.connect(merge);
      tail.connect(shaper);
      shaper.connect(tone);
      tone.connect(wet);
      wet.connect(merge);

      tail = merge;
      activeNodes.push(dry, wet, merge, shaper, tone);
    } else if (plugin.type === 'chorus') {
      const wetRatio = Math.max(0, Math.min(1, (plugin.params.mix ?? 35) / 100));
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const merge = ctx.createGain();
      dry.gain.value = 1 - wetRatio * 0.35;
      wet.gain.value = wetRatio;

      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.015;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = plugin.params.rate ?? 1.1;

      const depthGain = ctx.createGain();
      depthGain.gain.value = (plugin.params.depth ?? 4.5) / 1000;

      lfo.connect(depthGain);
      depthGain.connect(delay.delayTime);
      lfo.start();
      oscsToStop.push(lfo);

      tail.connect(dry);
      dry.connect(merge);
      tail.connect(delay);
      delay.connect(wet);
      wet.connect(merge);

      tail = merge;
      activeNodes.push(dry, wet, merge, delay, depthGain);
    } else if (plugin.type === 'filter' || plugin.type === 'custom_dsp') {
      const filter = ctx.createBiquadFilter();
      const modeVal = Math.round(plugin.params.mode ?? 0);
      filter.type = modeVal >= 1 ? 'highpass' : 'lowpass';
      filter.frequency.value = Math.max(40, Math.min(19000, plugin.params.cutoff ?? 8500));
      filter.Q.value = Math.max(0.5, plugin.params.resonance ?? 2.2);

      // Optional drive for custom_dsp plugins
      if (plugin.type === 'custom_dsp' && (plugin.params.drive ?? 0) > 0) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeDistortionCurve(plugin.params.drive ?? 0);
        tail.connect(shaper);
        shaper.connect(filter);
        activeNodes.push(shaper);
      } else {
        tail.connect(filter);
      }
      tail = filter;
      activeNodes.push(filter);
    }
  }

  tail.connect(output);

  return {
    input,
    output,
    cleanup: () => {
      oscsToStop.forEach((o) => {
        try {
          o.stop();
        } catch {
          // ignore
        }
      });
      activeNodes.forEach((n) => {
        try {
          n.disconnect();
        } catch {
          // ignore
        }
      });
    },
  };
}
