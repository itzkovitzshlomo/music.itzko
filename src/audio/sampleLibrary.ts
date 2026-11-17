import { SampleAsset } from '../types/daw';

// Registry of decoded AudioBuffers stored in memory for zero-latency playback
const bufferRegistry = new Map<string, AudioBuffer>();
const reversedBufferRegistry = new Map<string, AudioBuffer>();

let libraryCatalog: SampleAsset[] = [];
let initialized = false;

function computePeaks(channelData: Float32Array, numBins = 48): number[] {
  const peaks: number[] = [];
  const step = Math.max(1, Math.floor(channelData.length / numBins));
  for (let i = 0; i < numBins; i++) {
    let maxVal = 0;
    const start = i * step;
    const end = Math.min(channelData.length, start + step);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(Math.min(1, maxVal));
  }
  return peaks;
}

function createStereoBuffer(ctx: BaseAudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  return ctx.createBuffer(2, length, sampleRate);
}

// Deterministic pseudo-random noise for clean repeatable studio samples
function createNoiseGen(seed = 1337) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

function synthKick808(ctx: BaseAudioContext): AudioBuffer {
  const dur = 0.72;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const freq = 46 + 135 * Math.exp(-t * 36);
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.exp(-t * 4.2) * Math.min(1, t / 0.002);
    const click = Math.exp(-t * 220) * 0.35;
    const raw = Math.sin(phase) * env + click;
    const saturated = Math.tanh(raw * 1.45) * 0.88;
    L[i] = saturated;
    R[i] = saturated;
  }
  return buf;
}

function synthPunchKick(ctx: BaseAudioContext): AudioBuffer {
  const dur = 0.36;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const rand = createNoiseGen(101);
  let phase = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const freq = 54 + 190 * Math.exp(-t * 48);
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.exp(-t * 10.5) * Math.min(1, t / 0.0015);
    const beater = rand() * Math.exp(-t * 140) * 0.25;
    const sample = Math.tanh((Math.sin(phase) * env + beater) * 1.3) * 0.9;
    L[i] = sample;
    R[i] = sample;
  }
  return buf;
}

function synthSnare(ctx: BaseAudioContext, tight = false): AudioBuffer {
  const dur = tight ? 0.24 : 0.38;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const randL = createNoiseGen(202);
  const randR = createNoiseGen(303);
  let phase = 0;
  let hpL = 0;
  let hpR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const bodyFreq = (tight ? 195 : 175) + 95 * Math.exp(-t * 50);
    phase += (2 * Math.PI * bodyFreq) / sr;
    const body = Math.sin(phase) * Math.exp(-t * (tight ? 22 : 15)) * 0.6;
    const nL = randL();
    const nR = randR();
    // Simple high-pass character for snare wires
    const wireL = nL - hpL * 0.65;
    hpL = nL;
    const wireR = nR - hpR * 0.65;
    hpR = nR;
    const wireEnv = Math.exp(-t * (tight ? 18 : 11)) * 0.55;
    L[i] = Math.tanh((body + wireL * wireEnv) * 1.2) * 0.85;
    R[i] = Math.tanh((body + wireR * wireEnv) * 1.2) * 0.85;
  }
  return buf;
}

function synthClap(ctx: BaseAudioContext): AudioBuffer {
  const dur = 0.35;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const randL = createNoiseGen(404);
  const randR = createNoiseGen(505);
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    // Multi-burst clap transient at 0ms, 11ms, 22ms + tail
    const burst =
      (t < 0.01 ? 1 : 0) * Math.exp(-t * 140) +
      (t >= 0.011 && t < 0.022 ? 0.9 : 0) * Math.exp(-(t - 0.011) * 140) +
      (t >= 0.022 ? 0.85 : 0) * Math.exp(-(t - 0.022) * 12);
    lpL = lpL * 0.45 + randL() * 0.55;
    lpR = lpR * 0.45 + randR() * 0.55;
    L[i] = Math.tanh(lpL * burst * 1.6) * 0.82;
    R[i] = Math.tanh(lpR * burst * 1.6) * 0.82;
  }
  return buf;
}

function synthHiHat(ctx: BaseAudioContext, open = false): AudioBuffer {
  const dur = open ? 0.52 : 0.085;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const rand = createNoiseGen(open ? 606 : 707);
  const ratios = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
  let prev = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    let metal = 0;
    for (let k = 0; k < ratios.length; k++) {
      metal += Math.sin(2 * Math.PI * ratios[k] * t) > 0 ? 1 : -1;
    }
    metal = (metal / ratios.length) * 0.55 + rand() * 0.45;
    const hp = metal - prev * 0.85;
    prev = metal;
    const env = Math.exp(-t * (open ? 7.2 : 52)) * Math.min(1, t / 0.001);
    const val = hp * env * 0.52;
    L[i] = val;
    R[i] = val * 0.96;
  }
  return buf;
}

function synthRimshot(ctx: BaseAudioContext): AudioBuffer {
  const dur = 0.11;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const s =
      (Math.sin(2 * Math.PI * 465 * t) * 0.6 + Math.sin(2 * Math.PI * 1680 * t) * 0.4) *
      Math.exp(-t * 58);
    L[i] = s * 0.8;
    R[i] = s * 0.8;
  }
  return buf;
}

function synthTom(ctx: BaseAudioContext, baseFreq: number): AudioBuffer {
  const dur = 0.38;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  let phase = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const f = baseFreq + baseFreq * 0.9 * Math.exp(-t * 26);
    phase += (2 * Math.PI * f) / sr;
    const val = Math.sin(phase) * Math.exp(-t * 8.5) * 0.82;
    L[i] = val;
    R[i] = val;
  }
  return buf;
}

function synthCrash(ctx: BaseAudioContext): AudioBuffer {
  const dur = 1.6;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const randL = createNoiseGen(808);
  const randR = createNoiseGen(909);
  let prevL = 0;
  let prevR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const nL = randL();
    const nR = randR();
    const hpL = nL - prevL * 0.82;
    const hpR = nR - prevR * 0.82;
    prevL = nL;
    prevR = nR;
    const shimmer = 1 + 0.25 * Math.sin(2 * Math.PI * 430 * t);
    const env = Math.exp(-t * 2.2) * Math.min(1, t / 0.004);
    L[i] = hpL * shimmer * env * 0.5;
    R[i] = hpR * shimmer * env * 0.5;
  }
  return buf;
}

function synthShaker(ctx: BaseAudioContext): AudioBuffer {
  const dur = 0.14;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const rand = createNoiseGen(1111);
  let prev = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const n = rand();
    const bp = n - prev * 0.78;
    prev = n;
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) * Math.exp(-t * 14);
    L[i] = bp * env * 0.45;
    R[i] = bp * env * 0.45;
  }
  return buf;
}

function synthBassShot(ctx: BaseAudioContext, freq: number, saw = false): AudioBuffer {
  const dur = 0.55;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  let lp = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const raw = saw
      ? ((t * freq) % 1) * 2 - 1 + Math.sin(2 * Math.PI * freq * t) * 0.5
      : Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 2 * t) * 0.22;
    const cutoff = 0.08 + 0.55 * Math.exp(-t * 8);
    lp = lp + cutoff * (raw - lp);
    const env = Math.exp(-t * 3.8) * Math.min(1, t / 0.006);
    const val = Math.tanh(lp * 1.3) * env * 0.78;
    L[i] = val;
    R[i] = val;
  }
  return buf;
}

function synthChordStab(ctx: BaseAudioContext, freqs: number[]): AudioBuffer {
  const dur = 0.65;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  let lpL = 0;
  let lpR = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    let sumL = 0;
    let sumR = 0;
    for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
      const f = freqs[fIdx];
      const s1 = ((t * f * 0.997) % 1) * 2 - 1;
      const s2 = ((t * f * 1.003) % 1) * 2 - 1;
      sumL += s1 * 0.7 + s2 * 0.3;
      sumR += s2 * 0.7 + s1 * 0.3;
    }
    sumL /= freqs.length;
    sumR /= freqs.length;
    const alpha = 0.05 + 0.45 * Math.exp(-t * 7);
    lpL += alpha * (sumL - lpL);
    lpR += alpha * (sumR - lpR);
    const env = Math.exp(-t * 4.2) * Math.min(1, t / 0.005);
    L[i] = lpL * env * 0.7;
    R[i] = lpR * env * 0.7;
  }
  return buf;
}

function synthRiserFx(ctx: BaseAudioContext): AudioBuffer {
  const dur = 1.8;
  const buf = createStereoBuffer(ctx, dur);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const sr = ctx.sampleRate;
  const rand = createNoiseGen(2026);
  let lp = 0;
  for (let i = 0; i < L.length; i++) {
    const t = i / sr;
    const progress = t / dur;
    const alpha = 0.02 + progress * progress * 0.75;
    lp += alpha * (rand() - lp);
    const env = Math.pow(progress, 1.8) * (1 - Math.max(0, (progress - 0.94) / 0.06));
    const val = lp * env * 0.65;
    L[i] = val;
    R[i] = val * (0.85 + 0.15 * Math.sin(t * 14));
  }
  return buf;
}

function synthDrumLoop(ctx: BaseAudioContext, bpm: number, variant: 'house' | 'trap'): AudioBuffer {
  const beatSec = 60 / bpm;
  const totalSec = beatSec * 4; // 1 bar loop
  const buf = createStereoBuffer(ctx, totalSec);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const kick = variant === 'house' ? synthPunchKick(ctx) : synthKick808(ctx);
  const snare = synthSnare(ctx, variant === 'trap');
  const clap = synthClap(ctx);
  const chh = synthHiHat(ctx, false);
  const ohh = synthHiHat(ctx, true);

  const mixIn = (src: AudioBuffer, beatPos: number, gain: number) => {
    const startIdx = Math.floor(beatPos * beatSec * ctx.sampleRate);
    const sL = src.getChannelData(0);
    const sR = src.getChannelData(1);
    for (let i = 0; i < sL.length && startIdx + i < L.length; i++) {
      L[startIdx + i] += sL[i] * gain;
      R[startIdx + i] += sR[i] * gain;
    }
  };

  if (variant === 'house') {
    [0, 1, 2, 3].forEach((b) => mixIn(kick, b, 0.9));
    [1, 3].forEach((b) => mixIn(clap, b, 0.7));
    [0.5, 1.5, 2.5, 3.5].forEach((b) => mixIn(ohh, b, 0.55));
    [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75].forEach((b) => mixIn(chh, b, 0.35));
  } else {
    [0, 0.75, 2.5].forEach((b) => mixIn(kick, b, 0.92));
    [1, 3].forEach((b) => mixIn(snare, b, 0.78));
    for (let s = 0; s < 16; s++) {
      mixIn(chh, s * 0.25, s % 2 === 0 ? 0.52 : 0.3);
    }
    mixIn(chh, 2.875, 0.42);
    mixIn(chh, 3.625, 0.45);
  }
  return buf;
}

export function initSampleLibrary(ctx: BaseAudioContext): SampleAsset[] {
  if (initialized && libraryCatalog.length > 0) {
    return libraryCatalog;
  }

  const definitions: Array<{
    id: string;
    name: string;
    hebrewName: string;
    category: SampleAsset['category'];
    genre: string;
    bpm?: number;
    rootNote?: number;
    builder: () => AudioBuffer;
  }> = [
    { id: 'kick_808', name: '808 Sub Kick', hebrewName: 'קיק 808 עמוק', category: 'drums', genre: 'Hip-Hop / Trap', builder: () => synthKick808(ctx) },
    { id: 'kick_punch', name: 'Studio Punch Kick', hebrewName: 'קיק אולפן חד', category: 'drums', genre: 'House / Pop', builder: () => synthPunchKick(ctx) },
    { id: 'snare_acoustic', name: 'Crisp Acoustic Snare', hebrewName: 'סנר אקוסטי חי', category: 'drums', genre: 'Pop / Rock', builder: () => synthSnare(ctx, false) },
    { id: 'snare_tight', name: 'Tight Trap Snare', hebrewName: 'סנר טראפ הדוק', category: 'drums', genre: 'Trap / Hip-Hop', builder: () => synthSnare(ctx, true) },
    { id: 'clap_analog', name: 'Analog Studio Clap', hebrewName: 'מחיאת כף אנלוגית', category: 'drums', genre: 'Electronic / Pop', builder: () => synthClap(ctx) },
    { id: 'hat_closed', name: 'Closed Hi-Hat', hebrewName: 'היי-האט סגור', category: 'drums', genre: 'All Genres', builder: () => synthHiHat(ctx, false) },
    { id: 'hat_open', name: 'Open Hi-Hat', hebrewName: 'היי-האט פתוח', category: 'drums', genre: 'House / Trap', builder: () => synthHiHat(ctx, true) },
    { id: 'rim_click', name: 'Wood Rimshot', hebrewName: 'רימשוט עץ', category: 'drums', genre: 'Lo-Fi / Latin', builder: () => synthRimshot(ctx) },
    { id: 'tom_low', name: 'Floor Tom Low', hebrewName: 'טום נמוך', category: 'drums', genre: 'Acoustic / Pop', builder: () => synthTom(ctx, 88) },
    { id: 'tom_mid', name: 'Rack Tom Mid', hebrewName: 'טום בינוני', category: 'drums', genre: 'Acoustic / Pop', builder: () => synthTom(ctx, 132) },
    { id: 'shaker_perc', name: 'Studio Shaker', hebrewName: 'שייקר כלי הקשה', category: 'drums', genre: 'Lo-Fi / Pop', builder: () => synthShaker(ctx) },
    { id: 'crash_cymbal', name: 'Stereo Crash Cymbal', hebrewName: 'מצילת קראש', category: 'drums', genre: 'All Genres', builder: () => synthCrash(ctx) },
    { id: 'bass_sub_c', name: 'Deep Sub Bass (C2)', hebrewName: 'סאב בס עמוק (C2)', category: 'bass', genre: 'Electronic / Hip-Hop', rootNote: 36, builder: () => synthBassShot(ctx, 65.41, false) },
    { id: 'bass_reese_c', name: 'Analog Saw Bass (C2)', hebrewName: 'בס מסור אנלוגי (C2)', category: 'bass', genre: 'EDM / Synthwave', rootNote: 36, builder: () => synthBassShot(ctx, 65.41, true) },
    { id: 'stab_minor', name: 'Deep House Chord (Am7)', hebrewName: 'אקורד האוס Am7', category: 'synths', genre: 'House / Lo-Fi', rootNote: 57, builder: () => synthChordStab(ctx, [220, 261.63, 329.63, 392]) },
    { id: 'stab_maj9', name: 'Warm Rhodes Chord (Cmaj9)', hebrewName: 'אקורד רודס חם Cmaj9', category: 'synths', genre: 'Lo-Fi / Neo-Soul', rootNote: 60, builder: () => synthChordStab(ctx, [261.63, 329.63, 392, 493.88, 587.33]) },
    { id: 'loop_house_124', name: 'House Groove Loop 124', hebrewName: 'לופ האוס 124 BPM', category: 'loops', genre: 'House', bpm: 124, builder: () => synthDrumLoop(ctx, 124, 'house') },
    { id: 'loop_trap_140', name: 'Trap Beat Loop 140', hebrewName: 'לופ טראפ 140 BPM', category: 'loops', genre: 'Trap / Hip-Hop', bpm: 140, builder: () => synthDrumLoop(ctx, 140, 'trap') },
    { id: 'fx_riser', name: 'White Noise Riser', hebrewName: 'עליית מתח אטמוספרית', category: 'fx', genre: 'Electronic / Pop', builder: () => synthRiserFx(ctx) },
  ];

  libraryCatalog = definitions.map((def) => {
    const buffer = def.builder();
    bufferRegistry.set(def.id, buffer);
    return {
      id: def.id,
      name: def.name,
      hebrewName: def.hebrewName,
      category: def.category,
      genre: def.genre,
      bpm: def.bpm,
      rootNote: def.rootNote,
      durationSec: buffer.duration,
      peaks: computePeaks(buffer.getChannelData(0), 48),
    };
  });

  initialized = true;
  return libraryCatalog;
}

export function getSampleBuffer(sampleId: string, reverse = false): AudioBuffer | undefined {
  const buf = bufferRegistry.get(sampleId);
  if (!buf) return undefined;
  if (!reverse) return buf;

  const cachedRev = reversedBufferRegistry.get(sampleId);
  if (cachedRev) return cachedRev;

  // Create reversed copy on demand
  const rev = new AudioBuffer({
    numberOfChannels: buf.numberOfChannels,
    length: buf.length,
    sampleRate: buf.sampleRate,
  });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = rev.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[src.length - 1 - i];
    }
  }
  reversedBufferRegistry.set(sampleId, rev);
  return rev;
}

export function getSampleCatalog(): SampleAsset[] {
  return libraryCatalog;
}

export async function registerUserAudioFile(
  ctx: BaseAudioContext,
  file: File
): Promise<SampleAsset> {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  bufferRegistry.set(id, decoded);

  const asset: SampleAsset = {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    hebrewName: file.name.replace(/\.[^.]+$/, ''),
    category: 'user',
    genre: 'ייבוא משתמש',
    durationSec: decoded.duration,
    peaks: computePeaks(decoded.getChannelData(0), 64),
    isUserUploaded: true,
  };

  libraryCatalog = [asset, ...libraryCatalog];
  return asset;
}
