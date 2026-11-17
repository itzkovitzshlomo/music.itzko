import { Clip, MidiNote, Project, Track } from '../types/daw';
import { buildFxChain, FxChainResult } from './fxEngine';
import { getSampleBuffer, initSampleLibrary } from './sampleLibrary';
import { ActiveVoice, triggerInstrumentVoice } from './synthEngine';

interface TrackNodeChain {
  input: GainNode;
  pan: StereoPannerNode;
  fader: GainNode;
  analyser: AnalyserNode;
  fx: FxChainResult;
  fxSignature: string;
}

export interface CountInStatus {
  active: boolean;
  currentBar: number;
  totalBars: number;
  beatInBar: number;
  beatsRemaining: number;
}

export type PlayheadListener = (beat: number, isPlaying: boolean) => void;
export type RecordedNoteListener = (trackId: string, note: MidiNote) => void;
export type CountInListener = (status: CountInStatus) => void;

class DawAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private masterFx: FxChainResult | null = null;
  private masterFxSignature = '';
  private trackChains = new Map<string, TrackNodeChain>();

  // Live MIDI voices keyed by `${trackId}_${pitch}`
  private liveVoices = new Map<string, ActiveVoice>();
  // Recording active note start beats keyed by `${trackId}_${pitch}`
  private activeRecNotes = new Map<string, { pitch: number; velocity: number; startBeat: number }>();

  // Transport & Count-in state
  private project: Project | null = null;
  private isPlaying = false;
  private isRecording = false;
  private playheadBeat = 0;
  private nextScheduleBeat = 0;
  private lastTickTime = 0;
  private schedulerTimer: number | null = null;
  private rafId: number | null = null;
  private lastMetronomeBeat = -1;

  // Count-in state
  private countInActive = false;
  private countInStartAudioTime = 0;
  private countInTotalBeats = 0;
  private countInTotalBars = 0;
  private countInTimer: number | null = null;
  private countInResumeMetronome = false;

  private playheadListeners = new Set<PlayheadListener>();
  private recordedNoteListeners = new Set<RecordedNoteListener>();
  private countInListeners = new Set<CountInListener>();

  // Reusable meter buffers (zero GC)
  private meterFloatBuf = new Float32Array(256);

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      // 'interactive' selects the lowest audio hardware buffer size supported by the OS
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      initSampleLibrary(this.ctx);

      this.masterGain = this.ctx.createGain();
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -1.5;
      this.masterLimiter.knee.value = 3;
      this.masterLimiter.ratio.value = 12;
      this.masterLimiter.attack.value = 0.002;
      this.masterLimiter.release.value = 0.1;

      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 512;
      this.masterAnalyser.smoothingTimeConstant = 0.78;

      this.masterGain.connect(this.masterLimiter);
      this.masterLimiter.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getEstimatedLatencyMs(): number {
    if (!this.ctx) return 5.8;
    const base = (this.ctx.baseLatency || 0.005) * 1000;
    const out = (this.ctx.outputLatency || 0) * 1000;
    return Math.round((base + out) * 10) / 10;
  }

  public syncProject(project: Project) {
    this.project = project;
    if (!this.ctx) return;
    this.rebuildTrackRouting(project);
  }

  public rebuildTrackRouting(project: Project) {
    if (!this.ctx || !this.masterGain) return;

    const nextMasterSig = JSON.stringify(project.masterPlugins || []);
    if (!this.masterFx || nextMasterSig !== this.masterFxSignature) {
      if (this.masterFx) {
        this.masterFx.cleanup();
        this.masterFx = null;
      }
      this.masterFx = buildFxChain(this.ctx, project.masterPlugins || []);
      this.masterFx.output.connect(this.masterGain);
      this.masterFxSignature = nextMasterSig;

      // Re-route existing tracks into the newly built masterFx
      for (const chain of this.trackChains.values()) {
        try {
          chain.analyser.disconnect();
        } catch {
          // ignore
        }
        chain.analyser.connect(this.masterFx.input);
      }
    }

    this.masterGain.gain.setTargetAtTime(project.masterVolume, this.ctx.currentTime, 0.015);

    const anySolo = project.tracks.some((t) => t.solo);

    // Clean removed tracks
    const currentIds = new Set(project.tracks.map((t) => t.id));
    for (const [id, chain] of this.trackChains.entries()) {
      if (!currentIds.has(id)) {
        chain.fx.cleanup();
        chain.input.disconnect();
        chain.fader.disconnect();
        this.trackChains.delete(id);
      }
    }

    for (const track of project.tracks) {
      const sig = JSON.stringify(track.plugins);
      const existing = this.trackChains.get(track.id);
      const audible = !track.muted && (!anySolo || track.solo);

      if (existing && existing.fxSignature === sig) {
        // Glitch-free fast mixer update without tearing down live AudioNodes
        existing.fader.gain.setTargetAtTime(audible ? track.volume : 0, this.ctx.currentTime, 0.012);
        existing.pan.pan.setTargetAtTime(track.pan, this.ctx.currentTime, 0.012);
        continue;
      }

      if (existing) {
        existing.fx.cleanup();
        existing.input.disconnect();
        existing.pan.disconnect();
        existing.fader.disconnect();
        existing.analyser.disconnect();
      }

      const input = this.ctx.createGain();
      const fx = buildFxChain(this.ctx, track.plugins);
      const pan = this.ctx.createStereoPanner();
      const fader = this.ctx.createGain();
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;

      fader.gain.value = audible ? track.volume : 0;
      pan.pan.value = track.pan;

      input.connect(fx.input);
      fx.output.connect(pan);
      pan.connect(fader);
      fader.connect(analyser);
      analyser.connect(this.masterFx.input);

      this.trackChains.set(track.id, { input, pan, fader, analyser, fx, fxSignature: sig });
    }
  }

  public updateTrackMixerFast(track: Track, anySolo: boolean) {
    if (!this.ctx) return;
    const chain = this.trackChains.get(track.id);
    if (!chain) return;
    const audible = !track.muted && (!anySolo || track.solo);
    chain.fader.gain.setTargetAtTime(audible ? track.volume : 0, this.ctx.currentTime, 0.012);
    chain.pan.pan.setTargetAtTime(track.pan, this.ctx.currentTime, 0.012);
  }

  public updateMasterVolumeFast(vol: number) {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.012);
  }

  public subscribePlayhead(cb: PlayheadListener): () => void {
    this.playheadListeners.add(cb);
    return () => this.playheadListeners.delete(cb);
  }

  public subscribeRecordedNote(cb: RecordedNoteListener): () => void {
    this.recordedNoteListeners.add(cb);
    return () => this.recordedNoteListeners.delete(cb);
  }

  public subscribeCountIn(cb: CountInListener): () => void {
    this.countInListeners.add(cb);
    return () => this.countInListeners.delete(cb);
  }

  private notifyCountIn(status: CountInStatus) {
    for (const cb of this.countInListeners) {
      cb(status);
    }
  }

  public setPlayheadBeat(beat: number) {
    this.playheadBeat = Math.max(0, beat);
    this.nextScheduleBeat = this.playheadBeat;
    this.lastMetronomeBeat = -1;
    this.notifyPlayhead();
  }

  public getPlayheadBeat(): number {
    return this.playheadBeat;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying || this.countInActive;
  }

  public start(metronomeEnabled: boolean, recordMode = false, countInBars: 0 | 1 | 2 = 0) {
    const ctx = this.ensureContext();
    if (!this.project) return;
    if (this.trackChains.size === 0) {
      this.rebuildTrackRouting(this.project);
    }

    if (recordMode && (countInBars === 1 || countInBars === 2)) {
      this.startWithCountIn(ctx, metronomeEnabled, countInBars);
      return;
    }

    this.beginPlaybackNow(ctx, ctx.currentTime, metronomeEnabled, recordMode);
  }

  private startWithCountIn(ctx: AudioContext, metronomeEnabled: boolean, countInBars: 1 | 2) {
    if (!this.project || !this.masterGain) return;
    this.stopCountInOnly();

    const beatsPerBar = this.project.timeSignatureNumerator || 4;
    const totalBeats = countInBars * beatsPerBar;
    const secPerBeat = 60 / this.project.bpm;
    const startAudioTime = ctx.currentTime + 0.04;

    this.countInActive = true;
    this.isRecording = true;
    this.countInStartAudioTime = startAudioTime;
    this.countInTotalBeats = totalBeats;
    this.countInTotalBars = countInBars;
    this.countInResumeMetronome = metronomeEnabled;

    // Schedule sample-accurate count-in metronome clicks on the Web Audio clock
    for (let b = 0; b < totalBeats; b++) {
      const when = startAudioTime + b * secPerBeat;
      this.triggerMetronomeClick(ctx, this.masterGain, when, b % beatsPerBar === 0);
    }

    const endAudioTime = startAudioTime + totalBeats * secPerBeat;

    // Pre-schedule first lookahead window slightly before count-in finishes for zero-gap drop-in
    let droppedIn = false;
    this.countInTimer = window.setInterval(() => {
      if (!this.ctx || !this.project || !this.countInActive) return;
      const now = this.ctx.currentTime;
      const elapsedBeats = Math.max(0, (now - this.countInStartAudioTime) / secPerBeat);

      if (!droppedIn && now >= endAudioTime - 0.03) {
        droppedIn = true;
        this.countInActive = false;
        if (this.countInTimer !== null) {
          window.clearInterval(this.countInTimer);
          this.countInTimer = null;
        }
        this.notifyCountIn({
          active: false,
          currentBar: countInBars,
          totalBars: countInBars,
          beatInBar: beatsPerBar,
          beatsRemaining: 0,
        });
        this.beginPlaybackNow(this.ctx, endAudioTime, this.countInResumeMetronome, true);
        return;
      }

      const idx = Math.min(totalBeats - 1, Math.floor(elapsedBeats));
      const currentBar = Math.floor(idx / beatsPerBar) + 1;
      const beatInBar = (idx % beatsPerBar) + 1;
      this.notifyCountIn({
        active: true,
        currentBar,
        totalBars: countInBars,
        beatInBar,
        beatsRemaining: Math.max(1, totalBeats - idx),
      });
    }, 25);
  }

  private beginPlaybackNow(
    ctx: AudioContext,
    anchorAudioTime: number,
    metronomeEnabled: boolean,
    recordMode: boolean
  ) {
    this.isPlaying = true;
    this.isRecording = recordMode;
    this.lastTickTime = anchorAudioTime;
    this.nextScheduleBeat = this.playheadBeat;
    this.lastMetronomeBeat = Math.floor(this.playheadBeat) - 1;

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
    }
    // Schedule immediately so beat 0 triggers cleanly with zero delay
    this.scheduleAhead(metronomeEnabled);
    this.schedulerTimer = window.setInterval(() => {
      this.scheduleAhead(metronomeEnabled);
    }, 20);

    const tickRaf = () => {
      if (!this.isPlaying) return;
      this.notifyPlayhead();
      this.rafId = requestAnimationFrame(tickRaf);
    };
    this.rafId = requestAnimationFrame(tickRaf);
  }

  private stopCountInOnly() {
    this.countInActive = false;
    if (this.countInTimer !== null) {
      window.clearInterval(this.countInTimer);
      this.countInTimer = null;
    }
    this.notifyCountIn({
      active: false,
      currentBar: 0,
      totalBars: 0,
      beatInBar: 0,
      beatsRemaining: 0,
    });
  }

  public stop() {
    this.stopCountInOnly();
    this.isPlaying = false;
    this.isRecording = false;
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.allNotesOff();
    this.notifyPlayhead();
  }

  private notifyPlayhead() {
    for (const cb of this.playheadListeners) {
      cb(this.playheadBeat, this.isPlaying);
    }
  }

  private scheduleAhead(metronomeEnabled: boolean) {
    if (!this.ctx || !this.project || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const elapsed = Math.max(0, now - this.lastTickTime);
    this.lastTickTime = now;

    const beatsPerSec = this.project.bpm / 60;
    this.playheadBeat += elapsed * beatsPerSec;

    // Loop wrap
    if (
      this.project.loopEnabled &&
      this.project.loopEndBeat > this.project.loopStartBeat &&
      this.playheadBeat >= this.project.loopEndBeat
    ) {
      const span = this.project.loopEndBeat - this.project.loopStartBeat;
      this.playheadBeat = this.project.loopStartBeat + ((this.playheadBeat - this.project.loopStartBeat) % span);
      this.nextScheduleBeat = this.playheadBeat;
      this.lastMetronomeBeat = Math.floor(this.playheadBeat) - 1;
    }

    const lookaheadBeats = 0.12 * beatsPerSec;
    const windowStart = this.nextScheduleBeat;
    let windowEnd = this.playheadBeat + lookaheadBeats;

    if (
      this.project.loopEnabled &&
      this.project.loopEndBeat > this.project.loopStartBeat &&
      windowEnd > this.project.loopEndBeat
    ) {
      windowEnd = this.project.loopEndBeat;
    }

    if (windowEnd > windowStart) {
      this.scheduleWindow(this.ctx, this.project, windowStart, windowEnd, now, metronomeEnabled);
      this.nextScheduleBeat = windowEnd;
    }
  }

  private scheduleWindow(
    ctx: BaseAudioContext,
    project: Project,
    winStart: number,
    winEnd: number,
    nowSec: number,
    metronomeEnabled: boolean
  ) {
    const secPerBeat = 60 / project.bpm;

    // Metronome click
    if (metronomeEnabled && this.masterGain) {
      const firstBeat = Math.ceil(winStart);
      for (let b = firstBeat; b < winEnd; b++) {
        if (b !== this.lastMetronomeBeat) {
          this.lastMetronomeBeat = b;
          const when = nowSec + Math.max(0, (b - this.playheadBeat) * secPerBeat);
          this.triggerMetronomeClick(ctx, this.masterGain, when, b % project.timeSignatureNumerator === 0);
        }
      }
    }

    for (const clip of project.clips) {
      const track = project.tracks.find((t) => t.id === clip.trackId);
      if (!track) continue;
      const chain = this.trackChains.get(track.id);
      if (!chain) continue;

      if (clip.type === 'midi') {
        for (const note of clip.notes) {
          // Apply swing to offbeat 16ths/8ths
          const rawBeat = clip.startBeat + note.startBeat;
          const swingOffset =
            project.swing > 0 && Math.abs((rawBeat * 2) % 1 - 0.5) < 0.08 ? project.swing * 0.25 : 0;
          const absBeat = rawBeat + swingOffset;

          if (absBeat >= winStart && absBeat < winEnd) {
            const when = nowSec + Math.max(0, (absBeat - this.playheadBeat) * secPerBeat);
            const durSec = Math.max(0.04, note.durationBeats * secPerBeat);
            triggerInstrumentVoice(
              ctx,
              chain.input,
              track.instrument,
              track.synthSettings,
              note.pitch,
              note.velocity,
              when,
              durSec
            );
          }
        }
      } else if (clip.type === 'audio' && clip.sampleId) {
        if (clip.startBeat >= winStart && clip.startBeat < winEnd) {
          const when = nowSec + Math.max(0, (clip.startBeat - this.playheadBeat) * secPerBeat);
          this.triggerAudioClip(ctx, chain.input, clip, when, secPerBeat);
        }
      }
    }
  }

  private triggerAudioClip(
    ctx: BaseAudioContext,
    dest: AudioNode,
    clip: Clip,
    when: number,
    secPerBeat: number
  ) {
    if (!clip.sampleId) return;
    const buffer = getSampleBuffer(clip.sampleId, Boolean(clip.reverse));
    if (!buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (clip.pitchSemitones) {
      src.playbackRate.setValueAtTime(Math.pow(2, clip.pitchSemitones / 12), when);
    }
    if (clip.loop) {
      src.loop = true;
    }

    const g = ctx.createGain();
    const targetGain = clip.gain ?? 0.9;
    const maxDur = clip.durationBeats * secPerBeat;
    const fadeIn = clip.fadeInSec ?? 0.005;
    const fadeOut = clip.fadeOutSec ?? 0.02;

    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(targetGain, when + Math.min(fadeIn, maxDur * 0.4));
    g.gain.setValueAtTime(targetGain, when + Math.max(0.01, maxDur - fadeOut));
    g.gain.linearRampToValueAtTime(0.0001, when + maxDur);

    src.connect(g);
    g.connect(dest);
    src.start(when, clip.sampleOffsetSec ?? 0, maxDur);
  }

  private triggerMetronomeClick(ctx: BaseAudioContext, dest: AudioNode, when: number, accent: boolean) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, when);
    g.gain.setValueAtTime(accent ? 0.22 : 0.12, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    osc.connect(g);
    g.connect(dest);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  /**
   * Direct zero-overhead live MIDI trigger for Akai LPK25 & Virtual Keyboard.
   */
  public noteOn(track: Track, pitch: number, velocity = 100) {
    const ctx = this.ensureContext();
    if (!this.trackChains.has(track.id) && this.project) {
      this.rebuildTrackRouting(this.project);
    }
    const chain = this.trackChains.get(track.id);
    if (!chain) return;

    const key = `${track.id}_${pitch}`;
    const prev = this.liveVoices.get(key);
    if (prev) {
      prev.stop(ctx.currentTime);
    }

    const voice = triggerInstrumentVoice(
      ctx,
      chain.input,
      track.instrument,
      track.synthSettings,
      pitch,
      velocity,
      ctx.currentTime
    );
    this.liveVoices.set(key, voice);

    if (this.isPlaying && this.isRecording && track.armed) {
      // Compensate for hardware audio output latency so overdub notes lock tightly to the beat
      const beatsPerSec = (this.project?.bpm || 120) / 60;
      const outLatencySec = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
      const liveBeat =
        this.playheadBeat + (ctx.currentTime - this.lastTickTime - outLatencySec) * beatsPerSec;
      this.activeRecNotes.set(key, {
        pitch,
        velocity,
        startBeat: Math.max(0, liveBeat),
      });
    }
  }

  public noteOff(track: Track, pitch: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const key = `${track.id}_${pitch}`;
    const voice = this.liveVoices.get(key);
    if (voice) {
      voice.stop(ctx.currentTime);
      this.liveVoices.delete(key);
    }

    const rec = this.activeRecNotes.get(key);
    if (rec) {
      this.activeRecNotes.delete(key);
      const beatsPerSec = (this.project?.bpm || 120) / 60;
      const outLatencySec = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
      const liveBeat =
        this.playheadBeat + (ctx.currentTime - this.lastTickTime - outLatencySec) * beatsPerSec;
      const dur = Math.max(0.125, liveBeat - rec.startBeat);
      const newNote: MidiNote = {
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        pitch: rec.pitch,
        startBeat: rec.startBeat,
        durationBeats: Math.round(dur * 16) / 16,
        velocity: rec.velocity,
      };
      for (const cb of this.recordedNoteListeners) {
        cb(track.id, newNote);
      }
    }
  }

  public allNotesOff() {
    if (!this.ctx) return;
    for (const voice of this.liveVoices.values()) {
      voice.stop(this.ctx.currentTime);
    }
    this.liveVoices.clear();
    this.activeRecNotes.clear();
  }

  public previewSample(sampleId: string) {
    const ctx = this.ensureContext();
    const buffer = getSampleBuffer(sampleId);
    if (!buffer || !this.masterGain) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = 0.85;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
  }

  public getTrackPeakLevel(trackId: string): number {
    const chain = this.trackChains.get(trackId);
    if (!chain) return 0;
    chain.analyser.getFloatTimeDomainData(this.meterFloatBuf);
    let peak = 0;
    for (let i = 0; i < this.meterFloatBuf.length; i++) {
      const v = Math.abs(this.meterFloatBuf[i]);
      if (v > peak) peak = v;
    }
    return Math.min(1, peak);
  }

  public getMasterSpectrum(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.masterAnalyser) return false;
    this.masterAnalyser.getByteFrequencyData(target);
    return true;
  }

  public getMasterPeakLevel(): number {
    if (!this.masterAnalyser) return 0;
    this.masterAnalyser.getFloatTimeDomainData(this.meterFloatBuf);
    let peak = 0;
    for (let i = 0; i < this.meterFloatBuf.length; i++) {
      const v = Math.abs(this.meterFloatBuf[i]);
      if (v > peak) peak = v;
    }
    return Math.min(1, peak);
  }

  /**
   * Renders the full project (or a single stem track) offline using OfflineAudioContext.
   */
  public async renderOfflineMix(project: Project, soloTrackId?: string): Promise<AudioBuffer> {
    const sampleRate = 44100;
    const secPerBeat = 60 / project.bpm;

    // Determine song end beat
    let maxBeat = 16;
    for (const clip of project.clips) {
      if (soloTrackId && clip.trackId !== soloTrackId) continue;
      maxBeat = Math.max(maxBeat, clip.startBeat + clip.durationBeats);
    }
    const tailSec = 2.0;
    const durationSec = maxBeat * secPerBeat + tailSec;
    const totalFrames = Math.ceil(durationSec * sampleRate);

    const offline = new OfflineAudioContext(2, totalFrames, sampleRate);
    initSampleLibrary(offline);

    const masterGain = offline.createGain();
    masterGain.gain.value = project.masterVolume;

    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.ratio.value = 10;

    const masterFx = buildFxChain(offline, project.masterPlugins || []);
    masterFx.output.connect(masterGain);
    masterGain.connect(limiter);
    limiter.connect(offline.destination);

    const anySolo = !soloTrackId && project.tracks.some((t) => t.solo);

    for (const track of project.tracks) {
      if (soloTrackId && track.id !== soloTrackId) continue;
      const audible = soloTrackId ? true : !track.muted && (!anySolo || track.solo);
      if (!audible) continue;

      const trackIn = offline.createGain();
      const fx = buildFxChain(offline, track.plugins);
      const pan = offline.createStereoPanner();
      pan.pan.value = track.pan;
      const fader = offline.createGain();
      fader.gain.value = track.volume;

      trackIn.connect(fx.input);
      fx.output.connect(pan);
      pan.connect(fader);
      fader.connect(masterFx.input);

      const trackClips = project.clips.filter((c) => c.trackId === track.id);
      for (const clip of trackClips) {
        if (clip.type === 'midi') {
          for (const note of clip.notes) {
            const rawBeat = clip.startBeat + note.startBeat;
            const swingOffset =
              project.swing > 0 && Math.abs((rawBeat * 2) % 1 - 0.5) < 0.08 ? project.swing * 0.25 : 0;
            const when = Math.max(0, (rawBeat + swingOffset) * secPerBeat);
            const durSec = Math.max(0.04, note.durationBeats * secPerBeat);
            triggerInstrumentVoice(
              offline,
              trackIn,
              track.instrument,
              track.synthSettings,
              note.pitch,
              note.velocity,
              when,
              durSec
            );
          }
        } else if (clip.type === 'audio' && clip.sampleId) {
          const when = Math.max(0, clip.startBeat * secPerBeat);
          this.triggerAudioClip(offline, trackIn, clip, when, secPerBeat);
        }
      }
    }

    return await offline.startRendering();
  }
}

export const dawEngine = new DawAudioEngine();
