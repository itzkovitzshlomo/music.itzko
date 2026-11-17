import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Mic,
  Music,
  Piano,
  Plus,
  Scissors,
  Sliders,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { INSTRUMENT_CATALOG } from '../data/presets';
import { getSampleCatalog } from '../audio/sampleLibrary';
import { Clip, InstrumentType, Track } from '../types/daw';

interface TrackListAndTimelineProps {
  tracks: Track[];
  clips: Clip[];
  selectedTrackId: string;
  selectedClipId: string | null;
  playheadBeat: number;
  loopEnabled: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  onSelectTrack: (trackId: string) => void;
  onSelectClip: (clipId: string | null) => void;
  onOpenClipInPianoRoll: (clipId: string) => void;
  onOpenTrackPlugins: (trackId: string) => void;
  onUpdateTrack: (trackId: string, partial: Partial<Track>) => void;
  onAddTrack: (instrument: InstrumentType) => void;
  onDeleteTrack: (trackId: string) => void;
  onCreateClip: (trackId: string, startBeat: number, durationBeats?: number) => void;
  onUpdateClip: (clipId: string, partial: Partial<Clip>, commitHistory?: boolean) => void;
  onDeleteClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onSplitClipAtPlayhead: (clipId: string) => void;
  onSeekPlayhead: (beat: number) => void;
  onUpdateLoopRange: (startBeat: number, endBeat: number) => void;
}

const SNAP_OPTIONS = [
  { label: '1/1 תיבה', value: 4 },
  { label: '1/2', value: 2 },
  { label: '1/4 ביט', value: 1 },
  { label: '1/8', value: 0.5 },
  { label: '1/16', value: 0.25 },
  { label: 'חופשי', value: 0 },
];

const TOTAL_BARS = 24;
const TOTAL_BEATS = TOTAL_BARS * 4;

export const TrackListAndTimeline: React.FC<TrackListAndTimelineProps> = ({
  tracks,
  clips,
  selectedTrackId,
  selectedClipId,
  playheadBeat,
  loopEnabled,
  loopStartBeat,
  loopEndBeat,
  onSelectTrack,
  onSelectClip,
  onOpenClipInPianoRoll,
  onOpenTrackPlugins,
  onUpdateTrack,
  onAddTrack,
  onDeleteTrack,
  onCreateClip,
  onUpdateClip,
  onDeleteClip,
  onDuplicateClip,
  onSplitClipAtPlayhead,
  onSeekPlayhead,
  onUpdateLoopRange,
}) => {
  const [pxPerBeat, setPxPerBeat] = useState(34);
  const [snapBeats, setSnapBeats] = useState(1);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [draftTrackName, setDraftTrackName] = useState('');
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const sampleMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of getSampleCatalog()) {
      map.set(s.id, s.peaks);
    }
    return map;
  }, [clips]);

  const snapValue = (rawBeat: number) => {
    if (snapBeats <= 0) return Math.max(0, Math.round(rawBeat * 100) / 100);
    return Math.max(0, Math.round(rawBeat / snapBeats) * snapBeats);
  };

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateFromClientX = (clientX: number) => {
      const x = Math.max(0, clientX - rect.left);
      const beat = snapValue(x / pxPerBeat);
      onSeekPlayhead(Math.min(TOTAL_BEATS, beat));
    };
    updateFromClientX(e.clientX);

    const onMove = (ev: MouseEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startDragClip = (
    e: React.MouseEvent,
    clip: Clip,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    onSelectClip(clip.id);
    onSelectTrack(clip.trackId);

    const startX = e.clientX;
    const origStart = clip.startBeat;
    const origDur = clip.durationBeats;
    let latestStart = origStart;
    let latestDur = origDur;

    const onMove = (ev: MouseEvent) => {
      const deltaBeats = (ev.clientX - startX) / pxPerBeat;
      if (mode === 'move') {
        latestStart = snapValue(Math.max(0, origStart + deltaBeats));
        onUpdateClip(clip.id, { startBeat: latestStart }, false);
      } else {
        const minDur = snapBeats > 0 ? snapBeats : 0.25;
        latestDur = Math.max(minDur, snapValue(origDur + deltaBeats));
        onUpdateClip(clip.id, { durationBeats: latestDur }, false);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (mode === 'move' && latestStart !== origStart) {
        onUpdateClip(clip.id, { startBeat: latestStart }, true);
      } else if (mode === 'resize' && latestDur !== origDur) {
        onUpdateClip(clip.id, { durationBeats: latestDur }, true);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-[#FFFDF0] px-6 lg:px-10 pb-5 overflow-hidden gap-3">
      {/* Main Split: Track Control Pills Stack + Rounded Timeline Grid Card */}
      <div className="flex-1 flex min-h-0 overflow-hidden gap-7">
        {/* Track Control Cards Column */}
        <div className="w-[300px] lg:w-[330px] shrink-0 flex flex-col min-h-0 gap-3">
          <div className="flex items-center justify-between px-1 shrink-0">
            <span className="font-mono-num text-[11px] font-bold uppercase text-[#777777]">
              ערוצים ({tracks.length})
            </span>
            <button
              type="button"
              onClick={() => onAddTrack('analog_poly')}
              className="flex items-center gap-1 px-3 py-1 rounded-full border-2 border-[#333333] bg-white hover:bg-[#D6E4FF] shadow-[2px_2px_0_#333333] text-xs font-bold text-[#333333] transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#7B61FF]" />
              <span>ערוץ חדש</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pl-1 pb-2 space-y-3">
            {tracks.map((track, idx) => {
              const selected = track.id === selectedTrackId;
              const trkNum = String(idx + 1).padStart(2, '0');
              return (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track.id)}
                  className={`rounded-2xl border-2 border-[#333333] shadow-[4px_4px_0_#333333] p-3.5 flex flex-col gap-2.5 cursor-pointer transition-colors ${
                    selected ? 'bg-[#FFFDF0]' : 'bg-white hover:bg-[#FAF8EC]'
                  }`}
                >
                  {/* Control Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-[#333333] shrink-0"
                        style={{ backgroundColor: idx % 2 === 0 ? '#D6E4FF' : '#FFD6E8' }}
                      />
                      {editingTrackId === track.id ? (
                        <input
                          type="text"
                          value={draftTrackName}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setDraftTrackName(e.target.value)}
                          onBlur={() => {
                            setEditingTrackId(null);
                            if (draftTrackName.trim()) {
                              onUpdateTrack(track.id, { name: draftTrackName.trim() });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingTrackId(null);
                              if (draftTrackName.trim()) {
                                onUpdateTrack(track.id, { name: draftTrackName.trim() });
                              }
                            }
                          }}
                          className="bg-white border border-[#333333] rounded px-1.5 py-0.5 text-xs font-bold text-[#333333] outline-none w-28"
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTrackId(track.id);
                            setDraftTrackName(track.name);
                          }}
                          title="לחיצה כפולה לשינוי שם"
                          className="text-sm font-bold text-[#333333] truncate"
                        >
                          {track.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono-num text-[10px] font-bold text-[#777777]">
                        TRK {trkNum}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTrackPlugins(track.id);
                        }}
                        title="אפקטים וסינתיסייזר"
                        className="w-6 h-6 rounded-full border border-[#333333]/30 hover:border-[#333333] hover:bg-[#D6E4FF] flex items-center justify-center text-[#333333] transition-colors"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                      {tracks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTrack(track.id);
                          }}
                          title="מחק ערוץ"
                          className="w-6 h-6 rounded-full hover:bg-[#FFD6E8] flex items-center justify-center text-[#777777] hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Round M / S / R Buttons + Volume Slider */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, { muted: !track.muted });
                      }}
                      title="Mute"
                      className={`w-8 h-8 rounded-full border-2 border-[#333333] text-[11px] font-bold transition-colors shrink-0 ${
                        track.muted
                          ? 'bg-[#FFD6E8] text-[#333333]'
                          : 'bg-white text-[#333333] hover:bg-[#EEECE0]'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, { solo: !track.solo });
                      }}
                      title="Solo"
                      className={`w-8 h-8 rounded-full border-2 border-[#333333] text-[11px] font-bold transition-colors shrink-0 ${
                        track.solo
                          ? 'bg-[#D6E4FF] text-[#333333]'
                          : 'bg-white text-[#333333] hover:bg-[#EEECE0]'
                      }`}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTrack(track.id, { armed: !track.armed });
                      }}
                      title="Arm להקלטה (LPK25)"
                      className={`w-8 h-8 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors shrink-0 ${
                        track.armed
                          ? 'bg-[#7B61FF] text-white'
                          : 'bg-white text-[#333333] hover:bg-[#FFD6E8]'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>

                    <div dir="ltr" className="flex-1 flex items-center px-1">
                      <input
                        type="range"
                        min={0}
                        max={1.2}
                        step={0.02}
                        value={track.volume}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { volume: Number(e.target.value) })
                        }
                        className="studio-slider w-full"
                      />
                    </div>
                  </div>

                  {/* Instrument Selector */}
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={track.instrument}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onUpdateTrack(track.id, { instrument: e.target.value as InstrumentType })
                      }
                      className="w-full bg-[#FFFDF0] border border-[#333333]/25 focus:border-[#333333] rounded-lg px-2 py-1 text-[11px] font-medium text-[#333333] outline-none"
                    >
                      {INSTRUMENT_CATALOG.map((inst) => (
                        <option key={inst.type} value={inst.type}>
                          {inst.hebrewName}
                        </option>
                      ))}
                      <option value="audio_sampler">דגימות שמע</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playful Canvas Timeline Container */}
        <div className="flex-1 min-w-0 bg-white border-2 border-[#333333] shadow-[8px_8px_0_rgba(51,51,51,0.08)] rounded-3xl flex flex-col overflow-hidden">
          {/* Timeline Action Strip */}
          <div className="h-12 shrink-0 bg-[#FFFDF0] border-b-2 border-[#333333]/10 px-5 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onCreateClip(selectedTrackId, snapValue(playheadBeat), 4)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-[#333333] bg-white hover:bg-[#D6E4FF] text-xs font-bold text-[#333333] transition-colors whitespace-nowrap"
              >
                <Music className="w-3.5 h-3.5 text-[#7B61FF]" />
                <span>קליפ חדש</span>
              </button>

              {selectedClipId && (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenClipInPianoRoll(selectedClipId)}
                    className="flex items-center gap-1.5 px-3.5 py-1 rounded-full border-2 border-[#333333] bg-[#7B61FF] hover:bg-[#6A4FF0] text-xs font-bold text-white shadow-[2px_2px_0_#333333] transition-colors whitespace-nowrap"
                  >
                    <Piano className="w-3.5 h-3.5" />
                    <span>ערוך ב-Piano Roll</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSplitClipAtPlayhead(selectedClipId)}
                    title="פצל קליפ במיקום הסמן"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#333333]/30 hover:border-[#333333] bg-white hover:bg-[#EEECE0] text-xs font-semibold text-[#333333] transition-colors whitespace-nowrap"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>פצל</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateClip(selectedClipId)}
                    title="שכפל קליפ"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#333333]/30 hover:border-[#333333] bg-white hover:bg-[#EEECE0] text-xs font-semibold text-[#333333] transition-colors whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>שכפל</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteClip(selectedClipId)}
                    title="מחק קליפ נבחר"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#333333]/30 hover:border-[#333333] bg-white hover:bg-[#FFD6E8] text-xs font-semibold text-[#333333] hover:text-red-700 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>מחק</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden xl:inline text-[11px] font-medium text-[#777777]">
                לחיצה כפולה על קליפ פותחת Piano Roll
              </span>

              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-[#777777] font-semibold">רשת:</span>
                <select
                  value={snapBeats}
                  onChange={(e) => setSnapBeats(Number(e.target.value))}
                  className="bg-white border border-[#333333]/30 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-[#333333] outline-none"
                >
                  {SNAP_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div dir="ltr" className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPxPerBeat((z) => Math.max(16, z - 6))}
                  className="p-1 rounded-full hover:bg-[#EEECE0] text-[#333333]"
                  title="הקטן תצוגה"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={16}
                  max={64}
                  value={pxPerBeat}
                  onChange={(e) => setPxPerBeat(Number(e.target.value))}
                  className="studio-slider w-16"
                />
                <button
                  type="button"
                  onClick={() => setPxPerBeat((z) => Math.min(64, z + 6))}
                  className="p-1 rounded-full hover:bg-[#EEECE0] text-[#333333]"
                  title="הגדל תצוגה"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* LTR Scrollable Musical Grid */}
          <div ref={timelineScrollRef} dir="ltr" className="flex-1 overflow-auto relative bg-white">
            <div
              className="relative min-h-full"
              style={{ width: `${TOTAL_BEATS * pxPerBeat}px` }}
            >
              {/* Bar Ruler */}
              <div
                onMouseDown={handleRulerMouseDown}
                className="h-8 bg-[#FFFDF0] border-b border-[#EEEEEE] relative cursor-pointer select-none sticky top-0 z-20"
              >
                {loopEnabled && loopEndBeat > loopStartBeat && (
                  <div
                    className="absolute top-0 bottom-0 bg-[#D6E4FF]/55 border-x-2 border-[#7B61FF]"
                    style={{
                      left: `${loopStartBeat * pxPerBeat}px`,
                      width: `${(loopEndBeat - loopStartBeat) * pxPerBeat}px`,
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onUpdateLoopRange(0, 16);
                    }}
                  />
                )}

                {Array.from({ length: TOTAL_BARS }).map((_, barIdx) => {
                  const left = barIdx * 4 * pxPerBeat;
                  return (
                    <div
                      key={barIdx}
                      className="absolute top-0 bottom-0 border-l border-[#E0DDD0] pl-2 flex items-center"
                      style={{ left: `${left}px`, width: `${4 * pxPerBeat}px` }}
                    >
                      <span className="font-mono-num text-[10px] font-bold text-[#777777]">
                        {barIdx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Track Lanes */}
              <div className="relative p-2 space-y-3">
                {/* Clean Vertical Hairline Beat Guides */}
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: TOTAL_BEATS }).map((_, b) => (
                    <div
                      key={b}
                      className={`absolute top-0 bottom-0 border-l ${
                        b % 4 === 0 ? 'border-[#E6E4DA]' : 'border-[#F3F2EC]'
                      }`}
                      style={{ left: `${b * pxPerBeat}px` }}
                    />
                  ))}
                </div>

                {tracks.map((track, idx) => {
                  const trackClips = clips.filter((c) => c.trackId === track.id);
                  const selected = track.id === selectedTrackId;
                  const pastelFill = idx % 2 === 0 ? '#D6E4FF' : '#FFD6E8';
                  return (
                    <div
                      key={track.id}
                      onClick={() => onSelectTrack(track.id)}
                      onDoubleClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickBeat = snapValue((e.clientX - rect.left) / pxPerBeat);
                        onCreateClip(track.id, clickBeat, 4);
                      }}
                      className={`h-[76px] rounded-2xl relative transition-colors ${
                        selected ? 'bg-[#FFFDF0]' : 'bg-[#FAF9F2]/60'
                      }`}
                    >
                      {trackClips.map((clip) => {
                        const isClipSelected = clip.id === selectedClipId;
                        const leftPx = clip.startBeat * pxPerBeat;
                        const widthPx = Math.max(48, clip.durationBeats * pxPerBeat);
                        const audioPeaks = clip.sampleId ? sampleMap.get(clip.sampleId) : undefined;

                        let minPitch = 48;
                        let maxPitch = 72;
                        if (clip.notes.length > 0) {
                          minPitch = Math.min(...clip.notes.map((n) => n.pitch)) - 2;
                          maxPitch = Math.max(...clip.notes.map((n) => n.pitch)) + 2;
                        }
                        const pitchSpan = Math.max(12, maxPitch - minPitch);

                        return (
                          <div
                            key={clip.id}
                            onMouseDown={(e) => startDragClip(e, clip, 'move')}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectClip(clip.id);
                              onSelectTrack(clip.trackId);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              onOpenClipInPianoRoll(clip.id);
                            }}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              backgroundColor: pastelFill,
                            }}
                            className={`absolute top-1.5 bottom-1.5 rounded-xl border-2 border-[#333333] overflow-hidden cursor-grab active:cursor-grabbing select-none transition-shadow ${
                              isClipSelected
                                ? 'shadow-[4px_4px_0_#7B61FF] ring-2 ring-[#7B61FF] z-10'
                                : 'shadow-[3px_3px_0_#333333]'
                            }`}
                          >
                            <div className="h-5 px-2.5 border-b border-[#333333]/20 flex items-center justify-between text-[11px] font-bold text-[#333333] truncate">
                              <span className="truncate">{clip.name}</span>
                              <span className="font-mono-num text-[9px] text-[#333333]/70 ml-1 shrink-0">
                                {clip.type === 'midi' ? `${clip.notes.length}N` : 'WAV'}
                              </span>
                            </div>

                            <div className="relative h-[calc(100%-20px)] w-full px-1 py-1 pointer-events-none">
                              {clip.type === 'midi' ? (
                                clip.notes.map((n) => {
                                  const relLeft = (n.startBeat / Math.max(0.5, clip.durationBeats)) * 100;
                                  const relWidth = (n.durationBeats / Math.max(0.5, clip.durationBeats)) * 100;
                                  const relTop = ((maxPitch - n.pitch) / pitchSpan) * 82;
                                  return (
                                    <div
                                      key={n.id}
                                      style={{
                                        left: `${relLeft}%`,
                                        width: `${Math.max(2, relWidth)}%`,
                                        top: `${Math.max(6, Math.min(84, relTop))}%`,
                                      }}
                                      className="absolute h-1.5 rounded-full bg-[#333333]"
                                    />
                                  );
                                })
                              ) : (
                                <div className="h-full w-full flex items-center gap-[2px] px-1">
                                  {(audioPeaks || [0.4, 0.8, 0.6, 0.9, 0.5, 0.7, 0.3, 0.6]).map((pk, pIdx) => (
                                    <div
                                      key={pIdx}
                                      style={{ height: `${Math.max(15, Math.round(pk * 86))}%` }}
                                      className="flex-1 rounded-full bg-[#333333]/80"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            <div
                              onMouseDown={(e) => startDragClip(e, clip, 'resize')}
                              title="גרור לשינוי אורך"
                              className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#7B61FF]/40"
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#7B61FF] pointer-events-none z-30"
                style={{ left: `${playheadBeat * pxPerBeat}px` }}
              >
                <div className="w-3 h-3 -ml-[5px] bg-[#7B61FF] border-2 border-[#333333] rounded-full -mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
