import React, { useEffect, useState } from 'react';
import {
  Circle,
  Disc3,
  Download,
  FolderOpen,
  Grid,
  Keyboard,
  Layers,
  Pause,
  Play,
  Redo2,
  Repeat,
  Square,
  Undo2,
  Volume2,
} from 'lucide-react';
import { CountInStatus } from '../audio/dawEngine';
import { BottomDockTab } from '../types/daw';

interface TopTransportBarProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  isPlaying: boolean;
  isRecording: boolean;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  countInBars: 0 | 1 | 2;
  countInStatus: CountInStatus;
  playheadBeat: number;
  canUndo: boolean;
  canRedo: boolean;
  showSidebar: boolean;
  showLpk25Dock: boolean;
  lpk25Connected: boolean;
  activeEditorTab: BottomDockTab | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleRecord: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onCycleCountIn: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSidebar: () => void;
  onToggleLpk25Dock: () => void;
  onOpenEditorTab: (tab: BottomDockTab) => void;
  onOpenProjectsModal: () => void;
  onOpenVstModal: () => void;
  onOpenExportModal: () => void;
}

export const TopTransportBar: React.FC<TopTransportBarProps> = ({
  projectName,
  onRenameProject,
  bpm,
  onChangeBpm,
  isPlaying,
  isRecording,
  loopEnabled,
  metronomeEnabled,
  countInBars,
  countInStatus,
  playheadBeat,
  canUndo,
  canRedo,
  showSidebar,
  showLpk25Dock,
  lpk25Connected,
  activeEditorTab,
  onTogglePlay,
  onStop,
  onToggleRecord,
  onToggleLoop,
  onToggleMetronome,
  onCycleCountIn,
  onUndo,
  onRedo,
  onToggleSidebar,
  onToggleLpk25Dock,
  onOpenEditorTab,
  onOpenProjectsModal,
  onOpenVstModal,
  onOpenExportModal,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);

  useEffect(() => {
    setDraftName(projectName);
  }, [projectName]);

  const bar = Math.floor(playheadBeat / 4) + 1;
  const beat = Math.floor(playheadBeat % 4) + 1;
  const totalSec = (playheadBeat * 60) / Math.max(40, bpm);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);

  return (
    <header className="shrink-0 bg-[#FFFDF0] px-6 lg:px-10 py-3.5 flex flex-wrap xl:flex-nowrap items-center justify-between gap-4">
      {/* Zone 1: Brand Wordmark & Workspace File Actions */}
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        <span className="font-display text-2xl font-black tracking-[-0.04em] text-[#333333] whitespace-nowrap shrink-0">
          HARMONIA.
        </span>

        <button
          type="button"
          onClick={onToggleSidebar}
          title="ספריית דגימות, כלים ותבניות"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border-2 border-[#333333] text-xs font-bold transition-all whitespace-nowrap shrink-0 shadow-[2px_2px_0_#333333] active:translate-y-0.5 ${
            showSidebar
              ? 'bg-[#7B61FF] text-white'
              : 'bg-white text-[#333333] hover:bg-[#D6E4FF]'
          }`}
        >
          <Disc3 className="w-3.5 h-3.5" />
          <span>ספרייה</span>
        </button>

        <button
          type="button"
          onClick={onOpenProjectsModal}
          title="פרויקטים ותבניות"
          className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-[#333333] flex items-center justify-center transition-colors shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="בטל (Ctrl+Z)"
            className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#EEECE0] text-[#333333] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="בצע שוב (Ctrl+Y)"
            className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#EEECE0] text-[#333333] flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 2: Signature Playful Canvas White Pill Transport */}
      <div
        dir="ltr"
        className="bg-white px-5 py-1.5 rounded-full border-2 border-[#333333] shadow-[0_4px_0_#E6E2CE] flex items-center gap-5 shrink-0"
      >
        {/* Transport Play / Stop / Record */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onStop}
            title="עצור (Enter)"
            className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#EEECE0] text-[#333333] flex items-center justify-center transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            title="נגן / השהה (Space)"
            className={`w-9 h-8 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-[#7B61FF] text-white'
                : 'bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[#333333]'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleRecord}
            title="הקלטת שכבה (Overdub)"
            className={`w-8 h-8 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
              isRecording || countInStatus.active
                ? 'bg-red-500 text-white'
                : 'bg-white hover:bg-[#FFD6E8] text-[#333333]'
            }`}
          >
            <Circle className="w-3 h-3 fill-current" />
          </button>
        </div>

        {/* PROJECT / BPM / TIME Stacked Metadata */}
        <div className="flex items-center gap-6">
          <div className="text-center min-w-[78px]">
            <div className="font-mono-num text-[10px] uppercase text-[#5C5C5C] leading-none mb-0.5">
              PROJECT
            </div>
            {editingName ? (
              <input
                type="text"
                dir="rtl"
                value={draftName}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  if (draftName.trim()) onRenameProject(draftName.trim());
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditingName(false);
                    if (draftName.trim()) onRenameProject(draftName.trim());
                  }
                }}
                className="bg-[#FFFDF0] border border-[#333333] rounded px-1.5 py-0.5 text-xs font-bold text-[#333333] outline-none w-28 text-center"
              />
            ) : (
              <button
                type="button"
                dir="rtl"
                onClick={() => setEditingName(true)}
                title="לחץ לשינוי שם הפרויקט"
                className="text-xs font-bold text-[#333333] hover:text-[#7B61FF] truncate max-w-[115px] block mx-auto"
              >
                {projectName}
              </button>
            )}
          </div>

          <div className="text-center">
            <div className="font-mono-num text-[10px] uppercase text-[#5C5C5C] leading-none mb-0.5">
              BPM
            </div>
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) onChangeBpm(Math.max(40, Math.min(240, v)));
              }}
              className="w-11 bg-transparent font-mono-num text-xs font-bold text-[#333333] outline-none focus:text-[#7B61FF] text-center"
            />
          </div>

          <div className="text-center min-w-[82px]">
            <div className="font-mono-num text-[10px] uppercase text-[#5C5C5C] leading-none mb-0.5">
              {countInStatus.active ? 'COUNT-IN' : 'TIME'}
            </div>
            {countInStatus.active ? (
              <div className="font-mono-num text-xs font-bold text-[#7B61FF]">
                {countInStatus.currentBar}/{countInStatus.totalBars} · {countInStatus.beatInBar}
              </div>
            ) : (
              <div className="font-mono-num text-xs font-bold text-[#333333]">
                {String(bar).padStart(2, '0')}:{beat} · {String(mins).padStart(2, '0')}:
                {String(secs).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* Count-in, Metronome, Loop */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCycleCountIn}
            title="ספירה לאחור לפני הקלטה (Count-in)"
            className={`px-2.5 h-7 rounded-full border-2 border-[#333333] text-[10px] font-mono-num font-bold transition-colors ${
              countInBars > 0
                ? 'bg-[#FFD6E8] text-[#333333]'
                : 'bg-white text-[#5C5C5C] hover:text-[#333333]'
            }`}
          >
            {countInBars === 0 ? 'CNT 0' : `CNT ${countInBars}B`}
          </button>

          <button
            type="button"
            onClick={onToggleMetronome}
            title="מטרונום"
            className={`w-7 h-7 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
              metronomeEnabled
                ? 'bg-[#7B61FF] text-white'
                : 'bg-white text-[#5C5C5C] hover:text-[#333333]'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M5 20h14L14 4h-4L5 20z" />
              <path d="M12 16l5-9" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            title="לופ"
            className={`w-7 h-7 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
              loopEnabled
                ? 'bg-[#D6E4FF] text-[#333333]'
                : 'bg-white text-[#5C5C5C] hover:text-[#333333]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zone 3: Workspace Popout Pill CTAs & Primary Export */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => onOpenEditorTab('mixer')}
          title="פתח מיקסר"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] text-xs font-bold transition-all whitespace-nowrap shrink-0 active:translate-y-0.5 ${
            activeEditorTab === 'mixer'
              ? 'bg-[#7B61FF] text-white'
              : 'bg-white text-[#333333] hover:bg-[#D6E4FF]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>מיקסר</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenEditorTab('step_sequencer')}
          title="פתח סיקוונסר תופים"
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] text-xs font-bold transition-all whitespace-nowrap shrink-0 active:translate-y-0.5 ${
            activeEditorTab === 'step_sequencer'
              ? 'bg-[#7B61FF] text-white'
              : 'bg-white text-[#333333] hover:bg-[#FFD6E8]'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>תופים</span>
        </button>

        <button
          type="button"
          onClick={onToggleLpk25Dock}
          title="הצג / הסתר מקלדת Akai LPK25 וירטואלית"
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] text-xs font-bold transition-all whitespace-nowrap shrink-0 active:translate-y-0.5 ${
            showLpk25Dock
              ? 'bg-[#7B61FF] text-white'
              : lpk25Connected
              ? 'bg-[#D6E4FF] text-[#333333]'
              : 'bg-white text-[#333333] hover:bg-[#EEECE0]'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>LPK25</span>
        </button>

        <button
          type="button"
          onClick={onOpenVstModal}
          title="ניהול פלאגינים ו-VST"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] bg-white hover:bg-[#D6E4FF] text-xs font-bold text-[#333333] transition-all whitespace-nowrap shrink-0 active:translate-y-0.5"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>VST</span>
        </button>

        <button
          type="button"
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] bg-[#333333] hover:bg-[#7B61FF] text-white text-xs font-bold transition-all whitespace-nowrap shrink-0 active:translate-y-0.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ייצוא</span>
        </button>
      </div>
    </header>
  );
};
