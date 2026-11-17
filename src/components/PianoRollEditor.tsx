import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eraser,
  Gauge,
  Grid,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import { midiNumberToNoteName } from '../audio/midiManager';
import { getSampleCatalog } from '../audio/sampleLibrary';
import { Clip, MidiNote, Track } from '../types/daw';

interface PianoRollEditorProps {
  clip: Clip | null;
  track: Track | null;
  onUpdateClip: (clipId: string, partial: Partial<Clip>, commitHistory?: boolean) => void;
  onCreateClipOnSelectedTrack: () => void;
}

const MIN_MIDI = 36; // C2
const MAX_MIDI = 84; // C6
const PITCH_COUNT = MAX_MIDI - MIN_MIDI + 1;
const ROW_HEIGHT = 16;

function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

export const PianoRollEditor: React.FC<PianoRollEditorProps> = ({
  clip,
  track,
  onUpdateClip,
  onCreateClipOnSelectedTrack,
}) => {
  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [snapBeats, setSnapBeats] = useState(0.25); // 1/16 default
  const [pxPerBeat, setPxPerBeat] = useState(64);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const sampleAsset = useMemo(() => {
    if (!clip?.sampleId) return null;
    return getSampleCatalog().find((s) => s.id === clip.sampleId) || null;
  }, [clip?.sampleId]);

  if (!clip || !track) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-[#FFFDF0]">
        <p className="text-xs font-medium text-[#555555]">
          בחר קליפ על ציר הזמן כדי לערוך תווים בפסנתר-רול, או צור קליפ חדש.
        </p>
        <button
          type="button"
          onClick={onCreateClipOnSelectedTrack}
          className="px-4 py-2 rounded-full border-2 border-[#333333] bg-[#7B61FF] hover:bg-[#6A4FF0] text-white shadow-[3px_3px_0_#333333] text-xs font-bold transition-colors"
        >
          צור קליפ MIDI חדש
        </button>
      </div>
    );
  }

  // Audio Sample Clip Editor Mode
  if (clip.type === 'audio') {
    const peaks = sampleAsset?.peaks || [0.4, 0.8, 0.6, 0.9, 0.5, 0.7, 0.4, 0.8];
    return (
      <div className="h-full flex flex-col bg-[#FFFDF0] p-5 gap-4 overflow-y-auto">
        <div className="flex items-center justify-between border-b-2 border-[#333333]/15 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#333333]">
              עריכת דגימת אודיו: {clip.name}
            </h3>
            <p className="text-xs text-[#666666]">
              גובה צליל (Pitch), עוצמה, היפוך כיוון ו-Fade In/Out
            </p>
          </div>
          <button
            type="button"
            onClick={() => clip.sampleId && dawEngine.previewSample(clip.sampleId)}
            className="px-4 py-1.5 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white shadow-[2px_2px_0_#333333] text-[#333333] text-xs font-bold transition-colors"
          >
            השמע דגימה
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-white border-2 border-[#333333] rounded-2xl p-4">
          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#333333]">
            <span>Pitch: {clip.pitchSemitones ?? 0} st</span>
            <input
              type="range"
              min={-24}
              max={24}
              step={1}
              value={clip.pitchSemitones ?? 0}
              onChange={(e) =>
                onUpdateClip(clip.id, { pitchSemitones: Number(e.target.value) }, true)
              }
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#333333]">
            <span>עוצמה: {Math.round((clip.gain ?? 0.9) * 100)}%</span>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={clip.gain ?? 0.9}
              onChange={(e) => onUpdateClip(clip.id, { gain: Number(e.target.value) }, true)}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#333333]">
            <span>Fade In: {(clip.fadeInSec ?? 0.01).toFixed(2)}s</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.02}
              value={clip.fadeInSec ?? 0.01}
              onChange={(e) =>
                onUpdateClip(clip.id, { fadeInSec: Number(e.target.value) }, true)
              }
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#333333]">
            <span>Fade Out: {(clip.fadeOutSec ?? 0.02).toFixed(2)}s</span>
            <input
              type="range"
              min={0}
              max={1.0}
              step={0.02}
              value={clip.fadeOutSec ?? 0.02}
              onChange={(e) =>
                onUpdateClip(clip.id, { fadeOutSec: Number(e.target.value) }, true)
              }
              className="studio-slider"
            />
          </label>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onUpdateClip(clip.id, { reverse: !clip.reverse }, true)}
              className={`w-full py-2 px-3 rounded-full border-2 border-[#333333] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                clip.reverse
                  ? 'bg-[#FFD6E8] text-[#333333]'
                  : 'bg-[#FFFDF0] text-[#333333] hover:bg-[#D6E4FF]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reverse</span>
            </button>
          </div>
        </div>

        <div
          dir="ltr"
          className="flex-1 min-h-[120px] bg-white border-2 border-[#333333] rounded-2xl p-4 flex items-center gap-1.5"
        >
          {(clip.reverse ? [...peaks].reverse() : peaks).map((pk, idx) => (
            <div
              key={idx}
              className="flex-1 bg-[#7B61FF] border border-[#333333] rounded-full"
              style={{ height: `${Math.max(10, Math.round(pk * 100))}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const totalBeats = Math.max(4, clip.durationBeats);
  const snap = (b: number) =>
    snapBeats > 0 ? Math.max(0, Math.round(b / snapBeats) * snapBeats) : Math.max(0, b);

  const commitNotes = (notes: MidiNote[], commitHistory = true) => {
    onUpdateClip(clip.id, { notes }, commitHistory);
  };

  // Smooth click-and-drag note drawing (drag horizontally to set note length in real time)
  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool === 'erase') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rawBeat = x / pxPerBeat;
    const startBeat = Math.min(totalBeats - snapBeats, snap(rawBeat));
    const row = Math.floor(y / ROW_HEIGHT);
    const pitch = MAX_MIDI - row;
    if (pitch < MIN_MIDI || pitch > MAX_MIDI) return;

    dawEngine.noteOn(track, pitch, 100);

    const newNoteId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let currentNote: MidiNote = {
      id: newNoteId,
      pitch,
      startBeat,
      durationBeats: Math.max(0.25, snapBeats),
      velocity: 100,
    };

    const baseNotes = [...clip.notes];
    setSelectedNoteId(newNoteId);
    commitNotes([...baseNotes, currentNote], false);

    const startX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const dragBeats = (ev.clientX - startX) / pxPerBeat;
      if (dragBeats > 0.05) {
        const nextDur = Math.max(snapBeats, snap(dragBeats + snapBeats));
        currentNote = { ...currentNote, durationBeats: Math.min(totalBeats - startBeat, nextDur) };
        commitNotes([...baseNotes, currentNote], false);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dawEngine.noteOff(track, pitch);
      commitNotes([...baseNotes, currentNote], true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startDragNote = (
    e: React.MouseEvent,
    targetNote: MidiNote,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    if (tool === 'erase') {
      commitNotes(
        clip.notes.filter((n) => n.id !== targetNote.id),
        true
      );
      return;
    }

    setSelectedNoteId(targetNote.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origStart = targetNote.startBeat;
    const origPitch = targetNote.pitch;
    const origDur = targetNote.durationBeats;

    let latest = { ...targetNote };

    const onMove = (ev: MouseEvent) => {
      const dxBeats = (ev.clientX - startX) / pxPerBeat;
      const dyRows = Math.round((ev.clientY - startY) / ROW_HEIGHT);

      if (mode === 'move') {
        const nextStart = Math.max(0, Math.min(totalBeats - 0.125, snap(origStart + dxBeats)));
        const nextPitch = Math.max(MIN_MIDI, Math.min(MAX_MIDI, origPitch - dyRows));
        if (nextPitch !== latest.pitch) {
          dawEngine.noteOn(track, nextPitch, targetNote.velocity);
          setTimeout(() => dawEngine.noteOff(track, nextPitch), 110);
        }
        latest = { ...latest, startBeat: nextStart, pitch: nextPitch };
      } else {
        const nextDur = Math.max(0.125, snap(origDur + dxBeats));
        latest = { ...latest, durationBeats: nextDur };
      }

      commitNotes(
        clip.notes.map((n) => (n.id === targetNote.id ? latest : n)),
        false
      );
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      commitNotes(
        clip.notes.map((n) => (n.id === targetNote.id ? latest : n)),
        true
      );
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const quantizeNotes = (stepOverride?: number) => {
    const step = Math.max(0.125, stepOverride ?? snapBeats);
    const quantized = clip.notes.map((n) => ({
      ...n,
      startBeat: Math.round(n.startBeat / step) * step,
      durationBeats: Math.max(step, Math.round(n.durationBeats / step) * step),
    }));
    commitNotes(quantized, true);
  };

  const transposeNotes = (semitones: number) => {
    const transposed = clip.notes.map((n) => ({
      ...n,
      pitch: Math.max(0, Math.min(127, n.pitch + semitones)),
    }));
    commitNotes(transposed, true);
  };

  // One-touch Velocity Scaling (applies to selected note if chosen, or all notes in clip)
  const scaleVelocity = (factor: number | 'normalize') => {
    const targetIds = selectedNoteId ? new Set([selectedNoteId]) : null;
    const updated = clip.notes.map((n) => {
      if (targetIds && !targetIds.has(n.id)) return n;
      if (factor === 'normalize') {
        return { ...n, velocity: 100 };
      }
      return {
        ...n,
        velocity: Math.max(12, Math.min(127, Math.round(n.velocity * factor))),
      };
    });
    commitNotes(updated, true);
  };

  const doubleClipLength = () => {
    const oldLen = clip.durationBeats;
    const cloned = clip.notes.map((n) => ({
      ...n,
      id: `${n.id}_dbl_${Math.random().toString(36).slice(2, 5)}`,
      startBeat: n.startBeat + oldLen,
    }));
    onUpdateClip(
      clip.id,
      { durationBeats: oldLen * 2, notes: [...clip.notes, ...cloned] },
      true
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#FFFDF0] overflow-hidden">
      {/* One-Touch Shortcut Toolbar: Draw/Erase, Quantize, Transpose, Velocity Scaling */}
      <div className="h-11 shrink-0 bg-white border-b-2 border-[#333333] px-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-[#333333] truncate max-w-[160px]">
            {clip.name}
          </span>
          <span className="text-[10px] text-[#777777] font-mono-num">
            {clip.notes.length}t
          </span>

          <div className="flex items-center bg-[#FFFDF0] border-2 border-[#333333] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setTool('draw')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-colors ${
                tool === 'draw' ? 'bg-[#7B61FF] text-white' : 'text-[#333333] hover:bg-[#EEECE0]'
              }`}
            >
              <Pencil className="w-3 h-3" />
              <span>ציור</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('erase')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-colors ${
                tool === 'erase' ? 'bg-[#FFD6E8] text-[#333333]' : 'text-[#333333] hover:bg-[#EEECE0]'
              }`}
            >
              <Eraser className="w-3 h-3" />
              <span>מחיקה</span>
            </button>
          </div>
        </div>

        {/* Direct One-Click Quantize, Transpose & Velocity Scaling */}
        <div dir="ltr" className="flex items-center gap-2 shrink-0">
          {/* Grid Snap */}
          <select
            value={snapBeats}
            onChange={(e) => setSnapBeats(Number(e.target.value))}
            className="bg-[#FFFDF0] border-2 border-[#333333] rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#333333] outline-none font-mono-num"
          >
            <option value={1}>1/4</option>
            <option value={0.5}>1/8</option>
            <option value={0.25}>1/16</option>
            <option value={0.125}>1/32</option>
          </select>

          {/* One-touch Quantize */}
          <div className="flex items-center bg-[#FFFDF0] border-2 border-[#333333] rounded-full overflow-hidden">
            <button
              type="button"
              onClick={() => quantizeNotes(0.25)}
              title="יישור תווים לרשת 1/16"
              className="px-2.5 py-0.5 text-[11px] font-bold text-[#7B61FF] hover:bg-[#D6E4FF] flex items-center gap-1 font-mono-num"
            >
              <Grid className="w-3 h-3" />
              <span>Q 1/16</span>
            </button>
            <button
              type="button"
              onClick={() => quantizeNotes(0.5)}
              title="יישור תווים לרשת 1/8"
              className="px-2.5 py-0.5 text-[11px] font-bold text-[#333333] border-l border-[#333333]/25 hover:bg-[#D6E4FF] font-mono-num"
            >
              Q 1/8
            </button>
          </div>

          {/* One-touch Transpose */}
          <div className="flex items-center bg-[#FFFDF0] border-2 border-[#333333] rounded-full overflow-hidden text-[10px] font-bold font-mono-num">
            <button
              type="button"
              onClick={() => transposeNotes(-12)}
              title="טרנספוזיציה אוקטבה למטה (-12)"
              className="px-2 py-0.5 text-[#333333] hover:bg-[#D6E4FF] flex items-center"
            >
              <ArrowDown className="w-2.5 h-2.5" />
              12
            </button>
            <button
              type="button"
              onClick={() => transposeNotes(-1)}
              title="חצי טון למטה"
              className="px-2 py-0.5 text-[#333333] border-l border-[#333333]/25 hover:bg-[#D6E4FF]"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => transposeNotes(1)}
              title="חצי טון למעלה"
              className="px-2 py-0.5 text-[#333333] border-l border-[#333333]/25 hover:bg-[#D6E4FF]"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => transposeNotes(12)}
              title="טרנספוזיציה אוקטבה למעלה (+12)"
              className="px-2 py-0.5 text-[#333333] border-l border-[#333333]/25 hover:bg-[#D6E4FF] flex items-center"
            >
              <ArrowUp className="w-2.5 h-2.5" />
              12
            </button>
          </div>

          {/* One-touch Velocity Scaling */}
          <div className="flex items-center bg-[#FFFDF0] border-2 border-[#333333] rounded-full overflow-hidden text-[10px] font-bold font-mono-num">
            <span className="px-2 text-[#777777] flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              VEL
            </span>
            <button
              type="button"
              onClick={() => scaleVelocity(0.85)}
              title="הנמך עוצמת תווים ב-15%"
              className="px-2 py-0.5 text-[#333333] border-l border-[#333333]/25 hover:bg-[#FFD6E8]"
            >
              -15%
            </button>
            <button
              type="button"
              onClick={() => scaleVelocity('normalize')}
              title="אחד עוצמה (100)"
              className="px-2 py-0.5 text-[#7B61FF] border-l border-[#333333]/25 hover:bg-[#FFD6E8]"
            >
              100
            </button>
            <button
              type="button"
              onClick={() => scaleVelocity(1.15)}
              title="הגבר עוצמת תווים ב-15%"
              className="px-2 py-0.5 text-[#333333] border-l border-[#333333]/25 hover:bg-[#FFD6E8]"
            >
              +15%
            </button>
          </div>

          <button
            type="button"
            onClick={doubleClipLength}
            className="px-2.5 py-0.5 rounded-full border-2 border-[#333333] bg-[#FFFDF0] hover:bg-[#D6E4FF] text-[11px] font-bold text-[#333333]"
          >
            ×2
          </button>

          <button
            type="button"
            onClick={() => commitNotes([], true)}
            className="p-1.5 rounded-full hover:bg-[#FFD6E8] text-[#777777] hover:text-red-600"
            title="נקה תווים"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={36}
            max={110}
            value={pxPerBeat}
            onChange={(e) => setPxPerBeat(Number(e.target.value))}
            title="זום אופקי"
            className="studio-slider w-14"
          />
        </div>
      </div>

      {/* Piano Roll Grid + Velocity Lane */}
      <div dir="ltr" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex min-h-0 overflow-auto">
          {/* Left Piano Keys */}
          <div className="w-12 shrink-0 bg-white border-r-2 border-[#333333] sticky left-0 z-20">
            {Array.from({ length: PITCH_COUNT }).map((_, rowIdx) => {
              const midi = MAX_MIDI - rowIdx;
              const black = isBlackKey(midi);
              const isC = midi % 12 === 0;
              return (
                <div
                  key={midi}
                  onMouseDown={() => dawEngine.noteOn(track, midi, 100)}
                  onMouseUp={() => dawEngine.noteOff(track, midi)}
                  onMouseLeave={() => dawEngine.noteOff(track, midi)}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={`px-1.5 flex items-center justify-end text-[9px] font-mono-num border-b border-[#E6E3D5] cursor-pointer select-none ${
                    black
                      ? 'bg-[#333333] text-white/70 hover:bg-[#7B61FF]'
                      : isC
                      ? 'bg-[#D6E4FF] text-[#333333] font-bold hover:bg-[#7B61FF] hover:text-white'
                      : 'bg-white text-[#777777] hover:bg-[#FFD6E8]'
                  }`}
                >
                  {isC ? midiNumberToNoteName(midi) : ''}
                </div>
              );
            })}
          </div>

          {/* Crisp Cream/White Note Grid */}
          <div
            ref={gridRef}
            onMouseDown={handleGridMouseDown}
            className="relative bg-white shrink-0"
            style={{
              width: `${totalBeats * pxPerBeat}px`,
              height: `${PITCH_COUNT * ROW_HEIGHT}px`,
            }}
          >
            {/* Subtle Pitch Lanes */}
            {Array.from({ length: PITCH_COUNT }).map((_, rowIdx) => {
              const midi = MAX_MIDI - rowIdx;
              const black = isBlackKey(midi);
              const isOctaveLine = midi % 12 === 0;
              return (
                <div
                  key={midi}
                  style={{ top: `${rowIdx * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                  className={`absolute left-0 right-0 border-b pointer-events-none ${
                    isOctaveLine ? 'border-[#333333]/15' : 'border-[#F0EEE2]'
                  } ${black ? 'bg-[#FFFDF0]' : 'bg-white'}`}
                />
              );
            })}

            {/* Beat & Bar Markers */}
            {Array.from({ length: Math.ceil(totalBeats / snapBeats) }).map((_, idx) => {
              const beat = idx * snapBeats;
              const isBar = Math.abs(beat % 4) < 0.001;
              const isBeat = Math.abs(beat % 1) < 0.001;
              return (
                <div
                  key={idx}
                  style={{ left: `${beat * pxPerBeat}px` }}
                  className={`absolute top-0 bottom-0 border-l pointer-events-none ${
                    isBar
                      ? 'border-[#333333]/20'
                      : isBeat
                      ? 'border-[#333333]/10'
                      : 'border-[#F3F1E8]'
                  }`}
                />
              );
            })}

            {/* Notes */}
            {clip.notes.map((n) => {
              if (n.pitch < MIN_MIDI || n.pitch > MAX_MIDI) return null;
              const top = (MAX_MIDI - n.pitch) * ROW_HEIGHT;
              const left = n.startBeat * pxPerBeat;
              const width = Math.max(10, n.durationBeats * pxPerBeat);
              const isSel = n.id === selectedNoteId;
              const opacity = 0.65 + (n.velocity / 127) * 0.35;

              return (
                <div
                  key={n.id}
                  onMouseDown={(e) => startDragNote(e, n, 'move')}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    commitNotes(
                      clip.notes.filter((x) => x.id !== n.id),
                      true
                    );
                  }}
                  style={{
                    top: `${top + 1}px`,
                    left: `${left}px`,
                    width: `${width}px`,
                    height: `${ROW_HEIGHT - 2}px`,
                    opacity,
                  }}
                  className={`absolute rounded-md border-[1.5px] border-[#333333] cursor-move flex items-center px-1 overflow-hidden select-none ${
                    isSel ? 'bg-[#FFD6E8] text-[#333333]' : 'bg-[#7B61FF] text-white'
                  }`}
                >
                  <span className="text-[9px] font-mono-num font-bold truncate pointer-events-none">
                    {width > 26 ? midiNumberToNoteName(n.pitch) : ''}
                  </span>
                  <div
                    onMouseDown={(e) => startDragNote(e, n, 'resize')}
                    className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/60"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Clean Velocity Lane */}
        <div className="h-12 shrink-0 bg-[#FFFDF0] border-t-2 border-[#333333] flex">
          <div className="w-12 shrink-0 bg-white border-r-2 border-[#333333] flex items-center justify-center text-[9px] font-mono-num font-bold text-[#777777]">
            VEL
          </div>
          <div
            className="relative flex-1 overflow-hidden"
            style={{ minWidth: `${totalBeats * pxPerBeat}px` }}
          >
            {clip.notes.map((n) => {
              const left = n.startBeat * pxPerBeat;
              const heightPct = Math.max(12, Math.round((n.velocity / 127) * 100));
              const isSel = n.id === selectedNoteId;
              return (
                <div
                  key={n.id}
                  title={`Velocity: ${n.velocity}`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedNoteId(n.id);
                    const startY = e.clientY;
                    const origVel = n.velocity;
                    let nextVel = origVel;
                    const onMove = (ev: MouseEvent) => {
                      nextVel = Math.max(10, Math.min(127, Math.round(origVel + (startY - ev.clientY) * 1.5)));
                      commitNotes(
                        clip.notes.map((x) => (x.id === n.id ? { ...x, velocity: nextVel } : x)),
                        false
                      );
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                      commitNotes(
                        clip.notes.map((x) => (x.id === n.id ? { ...x, velocity: nextVel } : x)),
                        true
                      );
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                  style={{
                    left: `${left}px`,
                    height: `${heightPct}%`,
                  }}
                  className={`absolute bottom-0 w-2 rounded-t border border-[#333333] cursor-ns-resize transition-colors ${
                    isSel ? 'bg-[#FFD6E8]' : 'bg-[#7B61FF] hover:bg-[#333333]'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
