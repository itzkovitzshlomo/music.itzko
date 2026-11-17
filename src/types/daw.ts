export type InstrumentType =
  | 'grand_piano'
  | 'electric_piano'
  | 'analog_poly'
  | 'acid_sub_bass'
  | 'karplus_pluck'
  | 'lush_pad'
  | 'drum_kit'
  | 'audio_sampler';

export type PluginType =
  | 'eq4'
  | 'compressor'
  | 'delay'
  | 'reverb'
  | 'overdrive'
  | 'chorus'
  | 'filter'
  | 'custom_dsp';

export interface PluginParam {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export interface PluginInstance {
  id: string;
  type: PluginType;
  name: string;
  vendor: string;
  enabled: boolean;
  params: Record<string, number>;
  customScript?: string; // For custom WebAudio DSP plugins
  vstUid?: string; // Compatibility ID for .vstpreset/.fxp interchange
}

export interface MidiNote {
  id: string;
  pitch: number; // MIDI note 0-127 (60 = C4)
  startBeat: number; // Relative to clip start
  durationBeats: number;
  velocity: number; // 1-127
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  type: 'midi' | 'audio';
  startBeat: number; // Timeline position in beats
  durationBeats: number;
  color: string;
  notes: MidiNote[];
  // Audio sample properties
  sampleId?: string;
  sampleOffsetSec?: number;
  pitchSemitones?: number;
  gain?: number;
  reverse?: boolean;
  fadeInSec?: number;
  fadeOutSec?: number;
  loop?: boolean;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  instrument: InstrumentType;
  volume: number; // 0.0 to 1.25 (1.0 = 0 dB)
  pan: number; // -1.0 to 1.0
  muted: boolean;
  solo: boolean;
  armed: boolean; // Armed for MIDI / LPK25 recording
  midiChannel: number; // 0 = All/Omni, 1..16
  plugins: PluginInstance[];
  synthSettings: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    cutoff: number;
    resonance: number;
    detune: number;
  };
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
  loopEnabled: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  swing: number; // 0 to 0.5
  masterVolume: number; // 0 to 1.2
  masterPlugins: PluginInstance[];
  tracks: Track[];
  clips: Clip[];
  updatedAt: number;
}

export interface SampleAsset {
  id: string;
  name: string;
  hebrewName: string;
  category: 'drums' | 'bass' | 'synths' | 'loops' | 'fx' | 'user';
  genre: string;
  bpm?: number;
  rootNote?: number;
  durationSec: number;
  peaks: number[]; // Normalized 0..1 waveform peaks for UI rendering
  isUserUploaded?: boolean;
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  isLpk25: boolean;
}

export type ArpMode = 'off' | 'up' | 'down' | 'up_down' | 'random';
export type ArpRate = '1/4' | '1/8' | '1/16' | '1/32' | '1/8T';

export interface Lpk25Settings {
  octaveOffset: number; // -2 to +2 (LPK25 default C3-C5 is 0)
  programBank: 1 | 2 | 3 | 4;
  arpEnabled: boolean;
  arpMode: ArpMode;
  arpRate: ArpRate;
  arpOctaves: 1 | 2 | 3;
  arpLatch: boolean;
  sustainOn: boolean;
  velocityCurve: 'linear' | 'soft' | 'hard' | 'fixed100';
  qwertyEnabled: boolean;
}

export interface MidiMessageLog {
  timestamp: number;
  deviceName: string;
  type: 'noteon' | 'noteoff' | 'cc' | 'pitchbend';
  note?: number;
  velocity?: number;
  cc?: number;
  value?: number;
  channel: number;
}

export type ExportAudioFormat =
  | 'wav16'
  | 'wav24'
  | 'aiff16'
  | 'webm_opus'
  | 'midi'
  | 'stems_wav'
  | 'project_json';

export type BottomDockTab = 'piano_roll' | 'step_sequencer' | 'mixer' | 'plugins';
export type SidebarTab = 'samples' | 'instruments' | 'templates' | 'vst';
