import React from 'react';
import { Flame, Play, Trash2 } from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import { DRUM_PAD_NAMES } from '../audio/synthEngine';
import { Clip, MidiNote, Track } from '../types/daw';

interface StepSequencerProps {
  drumTrack: Track | null;
  drumClip: Clip | null;
  playheadBeat: number;
  isPlaying: boolean;
  swing: number;
  onChangeSwing: (swing: number) => void;
  onUpdateClip: (clipId: string, partial: Partial<Clip>, commitHistory?: boolean) => void;
  onCreateDrumClip: () => void;
}

const STEPS = 16;

export const StepSequencer: React.FC<StepSequencerProps> = ({
  drumTrack,
  drumClip,
  playheadBeat,
  isPlaying,
  swing,
  onChangeSwing,
  onUpdateClip,
  onCreateDrumClip,
}) => {
  if (!drumTrack || !drumClip) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-[#FFFDF0]">
        <p className="text-xs font-medium text-[#555555]">
          אין קליפ תופים פעיל לעריכה בסיקוונסר.
        </p>
        <button
          type="button"
          onClick={onCreateDrumClip}
          className="px-4 py-2 rounded-full border-2 border-[#333333] bg-[#7B61FF] hover:bg-[#6A4FF0] text-white shadow-[3px_3px_0_#333333] text-xs font-bold transition-colors"
        >
          צור דפוס תופים חדש (16 צעדים)
        </button>
      </div>
    );
  }

  const currentStep = isPlaying
    ? Math.floor(((playheadBeat - drumClip.startBeat) * 4) % STEPS)
    : -1;

  const hasNoteAtStep = (pitch: number, stepIdx: number) => {
    const stepBeat = stepIdx * 0.25;
    return drumClip.notes.find(
      (n) => n.pitch === pitch && Math.abs((n.startBeat % 4) - stepBeat) < 0.08
    );
  };

  const toggleStep = (pitch: number, stepIdx: number) => {
    const stepBeat = stepIdx * 0.25;
    const existing = hasNoteAtStep(pitch, stepIdx);

    if (existing) {
      onUpdateClip(
        drumClip.id,
        {
          notes: drumClip.notes.filter(
            (n) => !(n.pitch === pitch && Math.abs((n.startBeat % 4) - stepBeat) < 0.08)
          ),
        },
        true
      );
    } else {
      dawEngine.noteOn(drumTrack, pitch, 108);
      setTimeout(() => dawEngine.noteOff(drumTrack, pitch), 150);

      // Add across all 4-beat bars inside clip duration
      const numBars = Math.max(1, Math.floor(drumClip.durationBeats / 4));
      const newNotes: MidiNote[] = [];
      for (let bar = 0; bar < numBars; bar++) {
        newNotes.push({
          id: `seq_${Date.now()}_${bar}_${stepIdx}_${Math.random().toString(36).slice(2, 5)}`,
          pitch,
          startBeat: bar * 4 + stepBeat,
          durationBeats: 0.2,
          velocity: stepIdx % 4 === 0 ? 114 : 94,
        });
      }
      onUpdateClip(
        drumClip.id,
        { notes: [...drumClip.notes, ...newNotes] },
        true
      );
    }
  };

  const applyPatternPreset = (style: 'house' | 'trap' | 'boom' | 'clear') => {
    if (style === 'clear') {
      onUpdateClip(drumClip.id, { notes: [] }, true);
      return;
    }

    const numBars = Math.max(1, Math.floor(drumClip.durationBeats / 4));
    const notes: MidiNote[] = [];
    const addStep = (pitch: number, step: number, vel = 100) => {
      for (let bar = 0; bar < numBars; bar++) {
        notes.push({
          id: `ps_${bar}_${pitch}_${step}_${Math.random().toString(36).slice(2, 5)}`,
          pitch,
          startBeat: bar * 4 + step * 0.25,
          durationBeats: 0.2,
          velocity: vel,
        });
      }
    };

    if (style === 'house') {
      [0, 4, 8, 12].forEach((s) => addStep(36, s, 116));
      [4, 12].forEach((s) => addStep(39, s, 98));
      [2, 6, 10, 14].forEach((s) => addStep(46, s, 88));
      [1, 3, 5, 7, 9, 11, 13, 15].forEach((s) => addStep(42, s, 68));
    } else if (style === 'trap') {
      [0, 6, 10].forEach((s) => addStep(48, s, 118));
      [4, 12].forEach((s) => addStep(40, s, 110));
      for (let s = 0; s < 16; s++) addStep(42, s, s % 2 === 0 ? 92 : 66);
      addStep(47, 14, 78);
    } else if (style === 'boom') {
      [0, 3, 7, 10].forEach((s) => addStep(36, s, 112));
      [4, 12].forEach((s) => addStep(38, s, 104));
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => addStep(42, s, 80));
    }

    onUpdateClip(drumClip.id, { notes }, true);
  };

  return (
    <div className="h-full flex flex-col bg-[#FFFDF0] overflow-hidden">
      {/* Toolbar */}
      <div className="h-11 shrink-0 bg-white border-b-2 border-[#333333] px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#333333]">
            סיקוונסר תופים · {drumClip.name}
          </span>
          <div className="flex items-center gap-1.5 mr-2">
            <button
              type="button"
              onClick={() => applyPatternPreset('house')}
              className="px-3 py-1 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] flex items-center gap-1 transition-colors"
            >
              <Flame className="w-3 h-3" />
              <span>האוס</span>
            </button>
            <button
              type="button"
              onClick={() => applyPatternPreset('trap')}
              className="px-3 py-1 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors"
            >
              טראפ 808
            </button>
            <button
              type="button"
              onClick={() => applyPatternPreset('boom')}
              className="px-3 py-1 rounded-full border-2 border-[#333333] bg-white hover:bg-[#EEECE0] text-[11px] font-bold text-[#333333] transition-colors"
            >
              בום-באפ / Lo-Fi
            </button>
            <button
              type="button"
              onClick={() => applyPatternPreset('clear')}
              className="p-1.5 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-red-600 transition-colors"
              title="נקה מקצב"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div dir="ltr" className="flex items-center gap-2 text-xs text-[#333333]">
          <span className="font-mono-num text-[11px] font-bold text-[#777777]">
            SWING: {Math.round(swing * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={0.45}
            step={0.01}
            value={swing}
            onChange={(e) => onChangeSwing(Number(e.target.value))}
            className="studio-slider w-24"
          />
        </div>
      </div>

      {/* 16-Step Matrix */}
      <div dir="ltr" className="flex-1 overflow-auto p-4 space-y-2">
        {DRUM_PAD_NAMES.map((pad) => (
          <div key={pad.pitch} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                dawEngine.noteOn(drumTrack, pad.pitch, 110);
                setTimeout(() => dawEngine.noteOff(drumTrack, pad.pitch), 120);
              }}
              className="w-28 shrink-0 h-8 px-3 rounded-full border-2 border-[#333333] bg-white hover:bg-[#D6E4FF] flex items-center justify-between text-[11px] font-bold text-[#333333] transition-colors"
            >
              <span className="truncate">{pad.label}</span>
              <Play className="w-2.5 h-2.5 text-[#7B61FF] fill-current shrink-0" />
            </button>

            <div
              className="flex-1 grid gap-1.5"
              style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
            >
              {Array.from({ length: STEPS }).map((_, stepIdx) => {
                const active = Boolean(hasNoteAtStep(pad.pitch, stepIdx));
                const isBeatGroup = Math.floor(stepIdx / 4) % 2 === 0;
                const isPlayStep = currentStep === stepIdx;

                return (
                  <button
                    key={stepIdx}
                    type="button"
                    onClick={() => toggleStep(pad.pitch, stepIdx)}
                    className={`h-8 rounded-lg border-2 border-[#333333] transition-colors ${
                      active
                        ? 'bg-[#7B61FF] shadow-[2px_2px_0_#333333]'
                        : isBeatGroup
                        ? 'bg-white hover:bg-[#D6E4FF]/60'
                        : 'bg-[#F4F1E1] hover:bg-[#FFD6E8]/60'
                    } ${isPlayStep ? 'ring-2 ring-[#333333] ring-offset-1 ring-offset-[#FFFDF0]' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
