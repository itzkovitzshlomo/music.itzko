import { createPluginInstance } from '../audio/fxEngine';
import { Clip, InstrumentType, MidiNote, Project, Track } from '../types/daw';

export interface InstrumentCatalogItem {
  type: InstrumentType;
  name: string;
  hebrewName: string;
  category: string;
  description: string;
  defaultSettings: Track['synthSettings'];
}

export const INSTRUMENT_CATALOG: InstrumentCatalogItem[] = [
  {
    type: 'grand_piano',
    name: 'Concert Grand Piano',
    hebrewName: 'פסנתר כנף קונצרטי',
    category: 'קלידים ואקוסטי',
    description: 'צליל פסנתר עשיר עם דינמיקה רגישה לעוצמת הקליד ב-LPK25.',
    defaultSettings: { attack: 0.008, decay: 0.65, sustain: 0.35, release: 0.45, cutoff: 9500, resonance: 1.0, detune: 3 },
  },
  {
    type: 'electric_piano',
    name: 'FM Electric Rhodes',
    hebrewName: 'פסנתר חשמלי רודס FM',
    category: 'קלידים / Lo-Fi / ניאו-סול',
    description: 'חמימות קלאסית עם פעמון FM עדין לאקורדים וגרוב.',
    defaultSettings: { attack: 0.006, decay: 0.55, sustain: 0.45, release: 0.42, cutoff: 7200, resonance: 1.2, detune: 4 },
  },
  {
    type: 'analog_poly',
    name: 'Analog Poly Synth',
    hebrewName: 'סינתיסייזר פוליפוני אנלוגי',
    category: 'סינת׳ / פופ / אלקטרוני',
    description: 'מתנדים כפולים עם פילטר תהודה להובלות ואקורדים שמנים.',
    defaultSettings: { attack: 0.015, decay: 0.28, sustain: 0.65, release: 0.28, cutoff: 6400, resonance: 3.2, detune: 9 },
  },
  {
    type: 'acid_sub_bass',
    name: 'Sub & Analog Bass',
    hebrewName: 'בס אנלוגי וסאב 808',
    category: 'בס / היפ-הופ / האוס',
    description: 'תדר נמוך עמוק עם הרמוניות מסור מסוננות.',
    defaultSettings: { attack: 0.006, decay: 0.22, sustain: 0.72, release: 0.16, cutoff: 1450, resonance: 4.5, detune: 4 },
  },
  {
    type: 'karplus_pluck',
    name: 'Plucked Acoustic / Oud',
    hebrewName: 'פריטת מיתר / גיטרה / עוד',
    category: 'אתני / אקוסטי / פופ',
    description: 'מודל מיתר פריך לפריטות, ארפג׳יו ומנגינות מזרחיות.',
    defaultSettings: { attack: 0.004, decay: 0.36, sustain: 0.12, release: 0.35, cutoff: 8200, resonance: 1.8, detune: 2 },
  },
  {
    type: 'lush_pad',
    name: 'Ensemble Strings Pad',
    hebrewName: 'פאד מיתרים ואווירה',
    category: 'קולנועי / אמביינט / פופ',
    description: '4 קולות מיתר רחבים עם פתיחה איטית לעומק אטמוספרי.',
    defaultSettings: { attack: 0.24, decay: 0.4, sustain: 0.85, release: 0.75, cutoff: 5200, resonance: 1.5, detune: 14 },
  },
  {
    type: 'drum_kit',
    name: 'Studio Drum Kit',
    hebrewName: 'ערכת תופים אולפנית',
    category: 'תופים וכלי הקשה',
    description: '16 צלילי תופים ממופים אוטומטית למקשי ה-LPK25 ולסיקוונסר.',
    defaultSettings: { attack: 0.002, decay: 0.2, sustain: 0.8, release: 0.15, cutoff: 16000, resonance: 1.0, detune: 0 },
  },
];

function note(pitch: number, startBeat: number, durationBeats: number, velocity = 98): MidiNote {
  return {
    id: `n_${Math.random().toString(36).slice(2, 9)}`,
    pitch,
    startBeat,
    durationBeats,
    velocity,
  };
}

export function createTrack(
  name: string,
  instrument: InstrumentType,
  color: string,
  armed = false
): Track {
  const spec = INSTRUMENT_CATALOG.find((i) => i.type === instrument) || INSTRUMENT_CATALOG[0];
  return {
    id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    color,
    instrument,
    volume: 0.82,
    pan: 0,
    muted: false,
    solo: false,
    armed,
    midiChannel: 0,
    plugins: [],
    synthSettings: { ...spec.defaultSettings },
  };
}

export interface ProjectTemplateInfo {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  description: string;
  build: () => Project;
}

export const PROJECT_TEMPLATES: ProjectTemplateInfo[] = [
  {
    id: 'house_groove',
    name: 'גרוב האוס ואלקטרוני (124 BPM)',
    genre: 'Electronic / Deep House',
    bpm: 124,
    description: 'הפקה מוכנה עם תופי האוס, סאב-בס פועם, אקורדי רודס ומלודיית סינת׳ לעריכה מיידית.',
    build: () => {
      const trDrums = createTrack('תופי האוס', 'drum_kit', '#F59E0B', false);
      trDrums.plugins = [createPluginInstance('compressor', { params: { threshold: -14, ratio: 4, attack: 8, release: 120, makeup: 2 } })];

      const trBass = createTrack('סאב בס עמוק', 'acid_sub_bass', '#10B981', false);
      trBass.plugins = [createPluginInstance('overdrive', { params: { drive: 20, tone: 3200, mix: 30 } })];

      const trChords = createTrack('אקורדי רודס', 'electric_piano', '#0EA5E9', true);
      trChords.plugins = [
        createPluginInstance('reverb', { params: { mix: 28, decay: 2.2, damp: 6000 } }),
        createPluginInstance('chorus', { params: { rate: 0.9, depth: 4, mix: 32 } }),
      ];

      const trLead = createTrack('סינת׳ מלודי (LPK25)', 'analog_poly', '#EC4899', true);
      trLead.plugins = [createPluginInstance('delay', { params: { timeMs: 362, feedback: 34, tone: 4500, mix: 25 } })];

      // 2 bars (8 beats) drum groove
      const drumNotes: MidiNote[] = [];
      for (let bar = 0; bar < 2; bar++) {
        const b = bar * 4;
        [0, 1, 2, 3].forEach((k) => drumNotes.push(note(36, b + k, 0.25, 114)));
        [1, 3].forEach((c) => drumNotes.push(note(39, b + c, 0.25, 96)));
        [0.5, 1.5, 2.5, 3.5].forEach((h) => drumNotes.push(note(46, b + h, 0.25, 84)));
        [0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75].forEach((ch) => drumNotes.push(note(42, b + ch, 0.15, 68)));
      }

      const bassNotes: MidiNote[] = [
        note(33, 0, 0.75, 108), note(33, 1.5, 0.5, 96), note(33, 2.5, 0.5, 100), note(36, 3.5, 0.5, 95),
        note(38, 4, 0.75, 108), note(38, 5.5, 0.5, 96), note(36, 6.5, 0.5, 98), note(40, 7.5, 0.5, 102),
      ];

      const chordNotes: MidiNote[] = [
        // Am7 -> Dm7 -> Fmaj7 -> Em7
        note(57, 0, 1.75, 84), note(60, 0, 1.75, 82), note(64, 0, 1.75, 84), note(67, 0, 1.75, 80),
        note(57, 2.25, 1.25, 76), note(60, 2.25, 1.25, 76), note(64, 2.25, 1.25, 78),
        note(53, 4, 1.75, 86), note(57, 4, 1.75, 84), note(60, 4, 1.75, 84), note(64, 4, 1.75, 82),
        note(52, 6, 1.75, 82), note(55, 6, 1.75, 80), note(59, 6, 1.75, 82), note(62, 6, 1.75, 78),
      ];

      const leadNotes: MidiNote[] = [
        note(72, 0.5, 0.5, 92), note(76, 1.0, 0.5, 96), note(79, 1.75, 0.75, 102),
        note(76, 3.0, 0.5, 88), note(74, 4.5, 0.5, 94), note(72, 5.25, 0.75, 98),
        note(71, 6.5, 1.0, 90),
      ];

      const clips: Clip[] = [
        { id: 'c_drums_1', trackId: trDrums.id, name: 'House Drum Pattern', type: 'midi', startBeat: 0, durationBeats: 8, color: trDrums.color, notes: drumNotes },
        { id: 'c_drums_2', trackId: trDrums.id, name: 'House Drum Pattern', type: 'midi', startBeat: 8, durationBeats: 8, color: trDrums.color, notes: drumNotes.map((n) => ({ ...n, id: `${n.id}_2` })) },
        { id: 'c_bass_1', trackId: trBass.id, name: 'Sub Bassline', type: 'midi', startBeat: 0, durationBeats: 8, color: trBass.color, notes: bassNotes },
        { id: 'c_bass_2', trackId: trBass.id, name: 'Sub Bassline', type: 'midi', startBeat: 8, durationBeats: 8, color: trBass.color, notes: bassNotes.map((n) => ({ ...n, id: `${n.id}_2` })) },
        { id: 'c_chords_1', trackId: trChords.id, name: 'Rhodes Progression', type: 'midi', startBeat: 0, durationBeats: 8, color: trChords.color, notes: chordNotes },
        { id: 'c_chords_2', trackId: trChords.id, name: 'Rhodes Progression', type: 'midi', startBeat: 8, durationBeats: 8, color: trChords.color, notes: chordNotes.map((n) => ({ ...n, id: `${n.id}_2` })) },
        { id: 'c_lead_1', trackId: trLead.id, name: 'Synth Hook', type: 'midi', startBeat: 8, durationBeats: 8, color: trLead.color, notes: leadNotes },
      ];

      return {
        id: `proj_${Date.now()}`,
        name: 'הפקת האוס אולפנית',
        bpm: 124,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        loopEnabled: true,
        loopStartBeat: 0,
        loopEndBeat: 16,
        swing: 0.08,
        masterVolume: 0.9,
        masterPlugins: [createPluginInstance('eq4', { params: { lowGain: 1.5, lowMidGain: -1, highMidGain: 1, highGain: 1.5 } })],
        tracks: [trDrums, trBass, trChords, trLead],
        clips,
        updatedAt: Date.now(),
      };
    },
  },
  {
    id: 'trap_hiphop',
    name: 'ביט היפ-הופ / טראפ (140 BPM)',
    genre: 'Hip-Hop / Trap',
    bpm: 140,
    description: 'קיק 808 עמוק, היי-האטים מהירים ומנגינת פסנתר חשמלי אפלה.',
    build: () => {
      const trDrums = createTrack('תופי טראפ 808', 'drum_kit', '#F59E0B', false);
      const trBass = createTrack('808 סאב גלייד', 'acid_sub_bass', '#10B981', false);
      const trPiano = createTrack('פסנתר טראפ', 'grand_piano', '#38BDF8', true);
      trPiano.plugins = [createPluginInstance('reverb', { params: { mix: 32, decay: 2.8, damp: 5000 } })];

      const drumNotes: MidiNote[] = [
        note(48, 0, 0.5, 118), note(48, 1.5, 0.5, 108), note(48, 2.75, 0.5, 112),
        note(48, 4, 0.5, 118), note(48, 6.5, 0.5, 110),
        note(40, 2, 0.25, 110), note(40, 6, 0.25, 112),
        note(39, 2, 0.25, 85), note(39, 6, 0.25, 88),
      ];
      for (let i = 0; i < 16; i++) {
        drumNotes.push(note(42, i * 0.5, 0.2, i % 2 === 0 ? 92 : 66));
      }
      // Trap hi-hat roll
      [2.5, 2.625, 2.75, 2.875, 7.25, 7.375, 7.5, 7.625].forEach((b) =>
        drumNotes.push(note(42, b, 0.1, 80))
      );

      const bassNotes: MidiNote[] = [
        note(36, 0, 1.5, 116), note(36, 1.5, 1.25, 106), note(39, 2.75, 1.25, 110),
        note(36, 4, 2.5, 115), note(34, 6.5, 1.5, 108),
      ];

      const pianoNotes: MidiNote[] = [
        note(60, 0, 1.0, 90), note(63, 1.0, 1.0, 86), note(67, 2.0, 1.5, 92),
        note(68, 4.0, 1.0, 88), note(67, 5.0, 1.0, 85), note(63, 6.0, 1.5, 84),
      ];

      return {
        id: `proj_${Date.now()}`,
        name: 'ביט טראפ 808',
        bpm: 140,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        loopEnabled: true,
        loopStartBeat: 0,
        loopEndBeat: 8,
        swing: 0,
        masterVolume: 0.9,
        masterPlugins: [],
        tracks: [trDrums, trBass, trPiano],
        clips: [
          { id: 't_d1', trackId: trDrums.id, name: 'Trap Drums', type: 'midi', startBeat: 0, durationBeats: 8, color: trDrums.color, notes: drumNotes },
          { id: 't_b1', trackId: trBass.id, name: '808 Sub', type: 'midi', startBeat: 0, durationBeats: 8, color: trBass.color, notes: bassNotes },
          { id: 't_p1', trackId: trPiano.id, name: 'Dark Keys', type: 'midi', startBeat: 0, durationBeats: 8, color: trPiano.color, notes: pianoNotes },
        ],
        updatedAt: Date.now(),
      };
    },
  },
  {
    id: 'lofi_chill',
    name: 'לו-פיי צ׳יל ואקוסטי (82 BPM)',
    genre: 'Lo-Fi / Chillhop',
    bpm: 82,
    description: 'מקצב סווינג רך, רודס חמים ופריטת גיטרה אקוסטית.',
    build: () => {
      const trDrums = createTrack('תופי Lo-Fi', 'drum_kit', '#F59E0B', false);
      const trRhodes = createTrack('רודס חמים', 'electric_piano', '#38BDF8', true);
      trRhodes.plugins = [createPluginInstance('chorus', { params: { rate: 0.7, depth: 5, mix: 40 } })];
      const trGuitar = createTrack('פריטת מיתר', 'karplus_pluck', '#A855F7', false);
      trGuitar.plugins = [createPluginInstance('reverb', { params: { mix: 35, decay: 2.5, damp: 4500 } })];

      const drumNotes: MidiNote[] = [
        note(36, 0, 0.5, 100), note(36, 2.5, 0.5, 92),
        note(38, 1, 0.3, 86), note(38, 3, 0.3, 88),
        note(42, 0, 0.25, 68), note(42, 0.5, 0.25, 58), note(42, 1.5, 0.25, 62),
        note(42, 2, 0.25, 68), note(42, 2.5, 0.25, 56), note(42, 3.5, 0.25, 64),
      ];

      const rhodesNotes: MidiNote[] = [
        note(57, 0, 2.0, 78), note(60, 0, 2.0, 76), note(64, 0, 2.0, 78), note(67, 0, 2.0, 74),
        note(53, 2, 2.0, 78), note(57, 2, 2.0, 76), note(60, 2, 2.0, 76), note(64, 2, 2.0, 74),
      ];

      const pluckNotes: MidiNote[] = [
        note(72, 0.5, 0.75, 82), note(76, 1.25, 0.75, 80),
        note(79, 2.5, 0.75, 84), note(76, 3.25, 0.75, 76),
      ];

      return {
        id: `proj_${Date.now()}`,
        name: 'לו-פיי צ׳יל',
        bpm: 82,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        loopEnabled: true,
        loopStartBeat: 0,
        loopEndBeat: 8,
        swing: 0.22,
        masterVolume: 0.88,
        masterPlugins: [],
        tracks: [trDrums, trRhodes, trGuitar],
        clips: [
          { id: 'lf_d1', trackId: trDrums.id, name: 'Lo-Fi Beat', type: 'midi', startBeat: 0, durationBeats: 4, color: trDrums.color, notes: drumNotes },
          { id: 'lf_d2', trackId: trDrums.id, name: 'Lo-Fi Beat', type: 'midi', startBeat: 4, durationBeats: 4, color: trDrums.color, notes: drumNotes.map((n) => ({ ...n, id: `${n.id}_b` })) },
          { id: 'lf_r1', trackId: trRhodes.id, name: 'Warm Chords', type: 'midi', startBeat: 0, durationBeats: 4, color: trRhodes.color, notes: rhodesNotes },
          { id: 'lf_r2', trackId: trRhodes.id, name: 'Warm Chords', type: 'midi', startBeat: 4, durationBeats: 4, color: trRhodes.color, notes: rhodesNotes.map((n) => ({ ...n, id: `${n.id}_b` })) },
          { id: 'lf_g1', trackId: trGuitar.id, name: 'Acoustic Pluck', type: 'midi', startBeat: 0, durationBeats: 4, color: trGuitar.color, notes: pluckNotes },
        ],
        updatedAt: Date.now(),
      };
    },
  },
  {
    id: 'empty_studio',
    name: 'פרויקט אולפן ריק (120 BPM)',
    genre: 'כל הסגנונות',
    bpm: 120,
    description: 'דף נקי עם ערוץ תופים וערוץ פסנתר מוכן לנגינה ב-Akai LPK25.',
    build: () => {
      const trDrums = createTrack('תופים ראשיים', 'drum_kit', '#F59E0B', false);
      const trKeys = createTrack('פסנתר כנף (LPK25)', 'grand_piano', '#0EA5E9', true);
      return {
        id: `proj_${Date.now()}`,
        name: 'פרויקט חדש',
        bpm: 120,
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        loopEnabled: false,
        loopStartBeat: 0,
        loopEndBeat: 16,
        swing: 0,
        masterVolume: 0.9,
        masterPlugins: [],
        tracks: [trDrums, trKeys],
        clips: [
          { id: 'empty_c1', trackId: trKeys.id, name: 'LPK25 Pattern 1', type: 'midi', startBeat: 0, durationBeats: 8, color: trKeys.color, notes: [] },
        ],
        updatedAt: Date.now(),
      };
    },
  },
];
