import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Grid,
  Piano,
  Sliders,
  Volume2,
  X,
} from 'lucide-react';
import { CountInStatus, dawEngine } from './audio/dawEngine';
import { importExternalPluginFile } from './audio/exportUtils';
import { createPluginInstance } from './audio/fxEngine';
import { midiManager, QWERTY_TO_SEMITONE_OFFSET } from './audio/midiManager';
import { getSampleCatalog, initSampleLibrary } from './audio/sampleLibrary';
import { ExportModal } from './components/ExportModal';
import { MidiControllerBar } from './components/MidiControllerBar';
import { MixerConsole } from './components/MixerConsole';
import { PianoRollEditor } from './components/PianoRollEditor';
import { PluginRack } from './components/PluginRack';
import { ProjectsModal } from './components/ProjectsModal';
import { SampleBrowserSidebar } from './components/SampleBrowserSidebar';
import { StepSequencer } from './components/StepSequencer';
import { TopTransportBar } from './components/TopTransportBar';
import { TrackListAndTimeline } from './components/TrackListAndTimeline';
import { VstPluginModal } from './components/VstPluginModal';
import { createTrack, PROJECT_TEMPLATES, ProjectTemplateInfo } from './data/presets';
import { loadLastProjectFromDb, saveProjectToDb } from './storage/projectStorage';
import {
  BottomDockTab,
  Clip,
  InstrumentType,
  Lpk25Settings,
  MidiDeviceInfo,
  MidiMessageLog,
  MidiNote,
  PluginInstance,
  PluginType,
  Project,
  SampleAsset,
  Track,
} from './types/daw';

const TRACK_COLORS = ['#F59E0B', '#0EA5E9', '#10B981', '#EC4899', '#A855F7', '#EF4444'];

export function App() {
  const [project, setProject] = useState<Project>(() => PROJECT_TEMPLATES[0].build());
  const [historyPast, setHistoryPast] = useState<Project[]>([]);
  const [historyFuture, setHistoryFuture] = useState<Project[]>([]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    () => project.tracks[2]?.id || project.tracks[0]?.id || ''
  );
  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    () => project.clips[0]?.id || null
  );

  const [samples, setSamples] = useState<SampleAsset[]>(() => {
    // Pre-populate catalog with an offline context on initial render so UI is populated immediately
    if (typeof window !== 'undefined' && 'OfflineAudioContext' in window) {
      const dummy = new OfflineAudioContext(2, 1024, 44100);
      return initSampleLibrary(dummy);
    }
    return getSampleCatalog();
  });

  // Transport & UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [countInBars, setCountInBars] = useState<0 | 1 | 2>(1);
  const [countInStatus, setCountInStatus] = useState<CountInStatus>({
    active: false,
    currentBar: 0,
    totalBars: 0,
    beatInBar: 0,
    beatsRemaining: 0,
  });
  const [playheadBeat, setPlayheadBeat] = useState(0);
  const [activeEditorTab, setActiveEditorTab] = useState<BottomDockTab | null>(null);
  const [showLpk25Dock, setShowLpk25Dock] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Modals
  const [exportOpen, setExportOpen] = useState(false);
  const [vstOpen, setVstOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // MIDI & Akai LPK25 state
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);
  const [midiSupported, setMidiSupported] = useState(true);
  const [midiError, setMidiError] = useState<string | undefined>();
  const [lpkSettings, setLpkSettings] = useState<Lpk25Settings>(() => midiManager.getSettings());
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const [lastMidiLog, setLastMidiLog] = useState<MidiMessageLog | null>(null);

  // Refs for zero-latency MIDI callback access without stale closures
  const projectRef = useRef(project);
  projectRef.current = project;
  const selectedTrackIdRef = useRef(selectedTrackId);
  selectedTrackIdRef.current = selectedTrackId;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  // Load last saved project from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    void loadLastProjectFromDb().then((saved) => {
      if (mounted && saved && saved.tracks.length > 0) {
        setProject(saved);
        setSelectedTrackId(saved.tracks[0].id);
        setSelectedClipId(saved.clips[0]?.id || null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-save project debounced
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveProjectToDb(project);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project]);

  // Keep audio engine synchronized with project state
  useEffect(() => {
    dawEngine.syncProject(project);
    midiManager.setBpm(project.bpm);
  }, [project]);

  // Playhead & Count-in subscriptions
  useEffect(() => {
    const unsubPlayhead = dawEngine.subscribePlayhead((beat, playing) => {
      setPlayheadBeat(beat);
      setIsPlaying(playing);
      if (!playing && !dawEngine.getIsPlaying()) {
        setIsRecording(false);
      }
    });
    const unsubCountIn = dawEngine.subscribeCountIn((status) => {
      setCountInStatus(status);
    });
    return () => {
      unsubPlayhead();
      unsubCountIn();
    };
  }, []);

  // Auto-collapse library drawer when viewport space becomes tight
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1100) {
        setShowSidebar(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Commit project mutation with optional Undo history
  const updateProject = useCallback((updater: (prev: Project) => Project, commitHistory = true) => {
    setProject((prev) => {
      const next = updater(prev);
      if (commitHistory) {
        setHistoryPast((past) => [...past.slice(-39), prev]);
        setHistoryFuture([]);
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setHistoryFuture((fut) => [projectRef.current, ...fut.slice(0, 39)]);
      setProject(previous);
      return past.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setHistoryPast((past) => [...past, projectRef.current]);
      setProject(next);
      return fut.slice(1);
    });
  }, []);

  // Recorded MIDI note capture (from physical Akai LPK25 or Virtual keyboard during Record)
  useEffect(() => {
    return dawEngine.subscribeRecordedNote((trackId, note: MidiNote) => {
      updateProject((prev) => {
        const existingClip = prev.clips.find(
          (c) =>
            c.trackId === trackId &&
            c.type === 'midi' &&
            note.startBeat >= c.startBeat &&
            note.startBeat <= c.startBeat + c.durationBeats + 2
        );

        if (existingClip) {
          const relNote: MidiNote = {
            ...note,
            startBeat: Math.max(0, note.startBeat - existingClip.startBeat),
          };
          const neededEnd = relNote.startBeat + relNote.durationBeats;
          return {
            ...prev,
            clips: prev.clips.map((c) =>
              c.id === existingClip.id
                ? {
                    ...c,
                    durationBeats: Math.max(c.durationBeats, Math.ceil(neededEnd / 4) * 4),
                    notes: [...c.notes, relNote],
                  }
                : c
            ),
          };
        }

        const track = prev.tracks.find((t) => t.id === trackId);
        const clipStart = Math.floor(note.startBeat / 4) * 4;
        const newClip: Clip = {
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          trackId,
          name: `LPK25 Take`,
          type: 'midi',
          startBeat: clipStart,
          durationBeats: 8,
          color: track?.color || '#0EA5E9',
          notes: [
            {
              ...note,
              startBeat: Math.max(0, note.startBeat - clipStart),
            },
          ],
        };
        setSelectedClipId(newClip.id);
        return {
          ...prev,
          clips: [...prev.clips, newClip],
        };
      }, true);
    });
  }, [updateProject]);

  // Direct Low-Latency Web MIDI + Akai LPK25 Hook
  const resolveTargetTrack = useCallback((): Track | undefined => {
    const p = projectRef.current;
    return (
      p.tracks.find((t) => t.id === selectedTrackIdRef.current && t.armed) ||
      p.tracks.find((t) => t.armed) ||
      p.tracks.find((t) => t.id === selectedTrackIdRef.current) ||
      p.tracks[0]
    );
  }, []);

  const initMidiConnection = useCallback(async () => {
    const res = await midiManager.initialize();
    setMidiSupported(res.supported);
    setMidiError(res.error);
    setMidiDevices(res.devices);
    const lpk = res.devices.find((d) => d.isLpk25 && d.state === 'connected');
    if (lpk) {
      showToast(`מקלדת ${lpk.name} זוהתה ומחוברת בהשהיה מינימלית`);
    }
  }, [showToast]);

  useEffect(() => {
    void initMidiConnection();
    const unsubDevices = midiManager.subscribeDevices((devs) => {
      setMidiDevices(devs);
    });
    const unsubLogs = midiManager.subscribeLogs((log) => {
      setLastMidiLog(log);
    });

    // Synchronous low-latency direct callback for note triggers
    midiManager.setDirectHandler((type, pitch, velocity) => {
      const targetTrack = resolveTargetTrack();
      if (!targetTrack) return;

      if (type === 'noteon') {
        dawEngine.noteOn(targetTrack, pitch, velocity);
        setActivePitches((prev) => {
          const next = new Set(prev);
          next.add(pitch);
          return next;
        });
      } else {
        dawEngine.noteOff(targetTrack, pitch);
        setActivePitches((prev) => {
          if (!prev.has(pitch)) return prev;
          const next = new Set(prev);
          next.delete(pitch);
          return next;
        });
      }
    });

    return () => {
      unsubDevices();
      unsubLogs();
      midiManager.setDirectHandler(null);
    };
  }, [initMidiConnection, resolveTargetTrack]);

  // Transport handlers
  const handleTogglePlay = useCallback(() => {
    if (dawEngine.getIsPlaying()) {
      dawEngine.stop();
    } else {
      dawEngine.start(metronomeEnabled, isRecordingRef.current, isRecordingRef.current ? countInBars : 0);
    }
  }, [countInBars, metronomeEnabled]);

  const handleStop = useCallback(() => {
    dawEngine.stop();
    dawEngine.setPlayheadBeat(0);
  }, []);

  const handleToggleRecord = useCallback(() => {
    const nextRec = !isRecordingRef.current;
    setIsRecording(nextRec);
    if (nextRec && !dawEngine.getIsPlaying()) {
      // Ensure selected track (or at least one track) is armed for Overdub
      const hasArmed = projectRef.current.tracks.some((t) => t.armed);
      if (!hasArmed && selectedTrackIdRef.current) {
        updateProject(
          (prev) => ({
            ...prev,
            tracks: prev.tracks.map((t) =>
              t.id === selectedTrackIdRef.current ? { ...t, armed: true } : t
            ),
          }),
          false
        );
      }
      dawEngine.start(metronomeEnabled, true, countInBars);
    } else if (!nextRec && countInStatus.active) {
      dawEngine.stop();
    }
  }, [countInBars, countInStatus.active, metronomeEnabled, updateProject]);

  // Global keyboard shortcuts (Space, Ctrl+Z, Ctrl+Y, and QWERTY -> LPK25 Piano)
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const isInputFocused = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused(e.target)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.code === 'Escape') {
        setActiveEditorTab(null);
        setShowSidebar(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        handleStop();
        return;
      }

      // QWERTY LPK25 playing
      if (midiManager.getSettings().qwertyEnabled && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const lower = e.key.toLowerCase();
        if (lower in QWERTY_TO_SEMITONE_OFFSET && !pressedKeys.has(lower)) {
          pressedKeys.add(lower);
          const baseMidi = 48 + midiManager.getSettings().octaveOffset * 12;
          const pitch = baseMidi + QWERTY_TO_SEMITONE_OFFSET[lower];
          midiManager.triggerVirtualNoteOn(pitch, 102);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const lower = e.key.toLowerCase();
      if (pressedKeys.has(lower)) {
        pressedKeys.delete(lower);
        const baseMidi = 48 + midiManager.getSettings().octaveOffset * 12;
        const pitch = baseMidi + QWERTY_TO_SEMITONE_OFFSET[lower];
        midiManager.triggerVirtualNoteOff(pitch);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleRedo, handleStop, handleTogglePlay, handleUndo]);

  const selectedTrack = useMemo(
    () => project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0] || null,
    [project.tracks, selectedTrackId]
  );

  const armedTrack = useMemo(
    () =>
      project.tracks.find((t) => t.id === selectedTrackId && t.armed) ||
      project.tracks.find((t) => t.armed) ||
      selectedTrack,
    [project.tracks, selectedTrack, selectedTrackId]
  );

  const selectedClip = useMemo(
    () => project.clips.find((c) => c.id === selectedClipId) || null,
    [project.clips, selectedClipId]
  );

  const drumTrack = useMemo(
    () =>
      (selectedTrack?.instrument === 'drum_kit' ? selectedTrack : null) ||
      project.tracks.find((t) => t.instrument === 'drum_kit') ||
      null,
    [project.tracks, selectedTrack]
  );

  const drumClip = useMemo(() => {
    if (!drumTrack) return null;
    if (selectedClip && selectedClip.trackId === drumTrack.id && selectedClip.type === 'midi') {
      return selectedClip;
    }
    return project.clips.find((c) => c.trackId === drumTrack.id && c.type === 'midi') || null;
  }, [drumTrack, project.clips, selectedClip]);

  // Track & Clip operations
  const handleUpdateTrack = (trackId: string, partial: Partial<Track>) => {
    const isFastMixerOnly =
      Object.keys(partial).every((k) => k === 'volume' || k === 'pan' || k === 'muted' || k === 'solo');
    updateProject(
      (prev) => {
        const nextTracks = prev.tracks.map((t) => (t.id === trackId ? { ...t, ...partial } : t));
        if (isFastMixerOnly) {
          const anySolo = nextTracks.some((t) => t.solo);
          const updated = nextTracks.find((t) => t.id === trackId);
          if (updated) dawEngine.updateTrackMixerFast(updated, anySolo);
        }
        return { ...prev, tracks: nextTracks };
      },
      !isFastMixerOnly
    );
  };

  const handleAddTrack = (instrument: InstrumentType, customName?: string) => {
    const color = TRACK_COLORS[project.tracks.length % TRACK_COLORS.length];
    const newTrack = createTrack(
      customName || `ערוץ ${project.tracks.length + 1}`,
      instrument,
      color,
      true
    );
    updateProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
    setSelectedTrackId(newTrack.id);
  };

  const handleDeleteTrack = (trackId: string) => {
    updateProject((prev) => {
      if (prev.tracks.length <= 1) return prev;
      const remaining = prev.tracks.filter((t) => t.id !== trackId);
      if (selectedTrackId === trackId) {
        setSelectedTrackId(remaining[0].id);
      }
      return {
        ...prev,
        tracks: remaining,
        clips: prev.clips.filter((c) => c.trackId !== trackId),
      };
    });
  };

  const handleCreateClip = (trackId: string, startBeat: number, durationBeats = 4) => {
    const track = project.tracks.find((t) => t.id === trackId) || project.tracks[0];
    if (!track) return;
    const newClip: Clip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trackId: track.id,
      name: `${track.name} Pattern`,
      type: 'midi',
      startBeat,
      durationBeats,
      color: track.color,
      notes: [],
    };
    updateProject((prev) => ({
      ...prev,
      clips: [...prev.clips, newClip],
    }));
    setSelectedClipId(newClip.id);
    setSelectedTrackId(track.id);
    setActiveEditorTab(track.instrument === 'drum_kit' ? 'step_sequencer' : 'piano_roll');
  };

  const handleUpdateClip = (clipId: string, partial: Partial<Clip>, commitHistory = true) => {
    updateProject(
      (prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === clipId ? { ...c, ...partial } : c)),
      }),
      commitHistory
    );
  };

  const handleDeleteClip = (clipId: string) => {
    updateProject((prev) => ({
      ...prev,
      clips: prev.clips.filter((c) => c.id !== clipId),
    }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const handleDuplicateClip = (clipId: string) => {
    const src = project.clips.find((c) => c.id === clipId);
    if (!src) return;
    const clone: Clip = {
      ...src,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startBeat: src.startBeat + src.durationBeats,
      notes: src.notes.map((n) => ({
        ...n,
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    updateProject((prev) => ({
      ...prev,
      clips: [...prev.clips, clone],
    }));
    setSelectedClipId(clone.id);
  };

  const handleSplitClipAtPlayhead = (clipId: string) => {
    const src = project.clips.find((c) => c.id === clipId);
    if (!src) return;
    const splitRel = playheadBeat - src.startBeat;
    if (splitRel <= 0.125 || splitRel >= src.durationBeats - 0.125) {
      showToast('מקם את הסמן בתוך גבולות הקליפ כדי לפצל אותו');
      return;
    }

    const leftClip: Clip = {
      ...src,
      durationBeats: splitRel,
      notes: src.notes.filter((n) => n.startBeat < splitRel),
    };
    const rightClip: Clip = {
      ...src,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startBeat: src.startBeat + splitRel,
      durationBeats: src.durationBeats - splitRel,
      notes: src.notes
        .filter((n) => n.startBeat >= splitRel)
        .map((n) => ({
          ...n,
          id: `n_${Math.random().toString(36).slice(2, 7)}`,
          startBeat: n.startBeat - splitRel,
        })),
    };

    updateProject((prev) => ({
      ...prev,
      clips: [...prev.clips.filter((c) => c.id !== clipId), leftClip, rightClip],
    }));
    setSelectedClipId(rightClip.id);
  };

  const handleInsertSample = (sample: SampleAsset) => {
    let targetTrack = selectedTrack;
    const beatsDur = Math.max(1, Math.round((sample.durationSec * (project.bpm / 60)) * 4) / 4);

    if (!targetTrack) {
      const created = createTrack(sample.hebrewName, 'audio_sampler', '#0EA5E9', false);
      targetTrack = created;
      updateProject((prev) => ({ ...prev, tracks: [...prev.tracks, created] }));
    }

    const clip: Clip = {
      id: `smp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trackId: targetTrack.id,
      name: sample.hebrewName,
      type: 'audio',
      startBeat: Math.round(playheadBeat * 4) / 4,
      durationBeats: beatsDur,
      color: targetTrack.color,
      notes: [],
      sampleId: sample.id,
      gain: 0.92,
      pitchSemitones: 0,
    };

    updateProject((prev) => ({
      ...prev,
      clips: [...prev.clips, clip],
    }));
    setSelectedClipId(clip.id);
    showToast(`הדגימה "${sample.hebrewName}" נוספה לציר הזמן`);
  };

  // Plugin / VST handlers
  const handleAddPluginToTrack = (trackId: string, type: PluginType) => {
    const plg = createPluginInstance(type);
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, plugins: [...t.plugins, plg] } : t
      ),
    }));
    setActiveEditorTab('plugins');
  };

  const handleMountCustomPlugin = (trackId: string, plugin: PluginInstance) => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, plugins: [...t.plugins, plugin] } : t
      ),
    }));
    setActiveEditorTab('plugins');
    showToast(`הפלאגין "${plugin.name}" הוטמע בהצלחה בערוץ`);
  };

  const handleImportExternalPluginFile = async (file: File) => {
    const target = selectedTrack || project.tracks[0];
    if (!target) return;
    try {
      const plg = await importExternalPluginFile(file);
      handleMountCustomPlugin(target.id, plg);
    } catch {
      showToast('לא ניתן היה לקרוא את קובץ הפלאגין');
    }
  };

  const handleUpdatePlugin = (
    trackId: string,
    pluginId: string,
    partial: Partial<PluginInstance>
  ) => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              plugins: t.plugins.map((p) => (p.id === pluginId ? { ...p, ...partial } : p)),
            }
          : t
      ),
    }));
  };

  const handleRemovePlugin = (trackId: string, pluginId: string) => {
    updateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? { ...t, plugins: t.plugins.filter((p) => p.id !== pluginId) }
          : t
      ),
    }));
  };

  const handleLoadTemplate = (tpl: ProjectTemplateInfo) => {
    dawEngine.stop();
    const fresh = tpl.build();
    setProject(fresh);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedTrackId(fresh.tracks[0]?.id || '');
    setSelectedClipId(fresh.clips[0]?.id || null);
    dawEngine.setPlayheadBeat(0);
    showToast(`נטענה תבנית: ${tpl.name}`);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#FFFDF0] text-[#333333] overflow-hidden">
      {/* Playful Canvas Top Studio Transport Bar */}
      <TopTransportBar
        projectName={project.name}
        onRenameProject={(name) => updateProject((p) => ({ ...p, name }))}
        bpm={project.bpm}
        onChangeBpm={(bpm) => updateProject((p) => ({ ...p, bpm }), false)}
        isPlaying={isPlaying}
        isRecording={isRecording}
        loopEnabled={project.loopEnabled}
        metronomeEnabled={metronomeEnabled}
        countInBars={countInBars}
        countInStatus={countInStatus}
        playheadBeat={playheadBeat}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        showSidebar={showSidebar}
        showLpk25Dock={showLpk25Dock}
        lpk25Connected={midiDevices.some((d) => d.isLpk25 && d.state === 'connected')}
        activeEditorTab={activeEditorTab}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onToggleRecord={handleToggleRecord}
        onToggleLoop={() =>
          updateProject((p) => ({ ...p, loopEnabled: !p.loopEnabled }), false)
        }
        onToggleMetronome={() => setMetronomeEnabled((m) => !m)}
        onCycleCountIn={() =>
          setCountInBars((c) => (c === 0 ? 1 : c === 1 ? 2 : 0))
        }
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleSidebar={() => setShowSidebar((s) => !s)}
        onToggleLpk25Dock={() => setShowLpk25Dock((s) => !s)}
        onOpenEditorTab={(tab) => setActiveEditorTab((cur) => (cur === tab ? null : tab))}
        onOpenProjectsModal={() => setProjectsOpen(true)}
        onOpenVstModal={() => setVstOpen(true)}
        onOpenExportModal={() => setExportOpen(true)}
      />

      {/* Spacious Full-Width Central Arrangement Canvas */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#FFFDF0] relative">
        <TrackListAndTimeline
          tracks={project.tracks}
          clips={project.clips}
          selectedTrackId={selectedTrack?.id || ''}
          selectedClipId={selectedClipId}
          playheadBeat={playheadBeat}
          loopEnabled={project.loopEnabled}
          loopStartBeat={project.loopStartBeat}
          loopEndBeat={project.loopEndBeat}
          onSelectTrack={setSelectedTrackId}
          onSelectClip={setSelectedClipId}
          onOpenClipInPianoRoll={(clipId) => {
            setSelectedClipId(clipId);
            const clip = project.clips.find((c) => c.id === clipId);
            if (clip) setSelectedTrackId(clip.trackId);
            setActiveEditorTab('piano_roll');
          }}
          onOpenTrackPlugins={(trackId) => {
            setSelectedTrackId(trackId);
            setActiveEditorTab('plugins');
          }}
          onUpdateTrack={handleUpdateTrack}
          onAddTrack={(inst) => handleAddTrack(inst)}
          onDeleteTrack={handleDeleteTrack}
          onCreateClip={handleCreateClip}
          onUpdateClip={handleUpdateClip}
          onDeleteClip={handleDeleteClip}
          onDuplicateClip={handleDuplicateClip}
          onSplitClipAtPlayhead={handleSplitClipAtPlayhead}
          onSeekPlayhead={(beat) => {
            dawEngine.setPlayheadBeat(beat);
            setPlayheadBeat(beat);
          }}
          onUpdateLoopRange={(startBeat, endBeat) =>
            updateProject((p) => ({ ...p, loopStartBeat: startBeat, loopEndBeat: endBeat }))
          }
        />
      </main>

      {/* Collapsible Right-Side (RTL Start) Library & Instruments Drawer */}
      {showSidebar && (
        <>
          <div
            onClick={() => setShowSidebar(false)}
            className="fixed inset-0 top-[68px] z-30 bg-[#333333]/25"
          />
          <div className="fixed right-0 top-[68px] bottom-0 z-40">
            <SampleBrowserSidebar
              samples={samples}
              onSamplesUpdated={setSamples}
              onInsertSample={handleInsertSample}
              onAddInstrumentTrack={(inst, name) => handleAddTrack(inst, name)}
              onApplyInstrumentToSelected={(inst) => {
                if (selectedTrack) handleUpdateTrack(selectedTrack.id, { instrument: inst });
              }}
              onAddPluginToSelectedTrack={(type) => {
                if (selectedTrack) handleAddPluginToTrack(selectedTrack.id, type);
              }}
              onImportExternalPluginFile={handleImportExternalPluginFile}
              onLoadTemplate={(tpl) => {
                handleLoadTemplate(tpl);
                setShowSidebar(false);
              }}
              onClose={() => setShowSidebar(false)}
              selectedTrackName={selectedTrack?.name}
            />
          </div>
        </>
      )}

      {/* Floating Modal / Drawer Editor (Piano Roll, Sequencer, Mixer, Plugins) - Hidden by Default */}
      {activeEditorTab && (
        <div
          onClick={() => setActiveEditorTab(null)}
          className="fixed inset-0 z-50 bg-[#333333]/35 backdrop-blur-[2px] flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[1280px] h-[72vh] max-h-[680px] min-h-[380px] bg-[#FFFDF0] border-2 border-[#333333] shadow-[8px_8px_0_#333333] rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden"
          >
            <div className="h-12 shrink-0 bg-white border-b-2 border-[#333333] px-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'piano_roll', label: 'פסנתר-רול ועריכת קליפ', icon: Piano },
                  { id: 'step_sequencer', label: 'סיקוונסר תופים', icon: Grid },
                  { id: 'mixer', label: 'מיקסר וספקטרום', icon: Volume2 },
                  { id: 'plugins', label: 'סינתיסייזר ואפקטי VST', icon: Sliders },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = activeEditorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveEditorTab(tab.id as BottomDockTab)}
                      className={`px-3.5 py-1.5 rounded-full border-2 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#7B61FF] text-white border-[#333333] shadow-[2px_2px_0_#333333]'
                          : 'bg-[#FFFDF0] text-[#333333] border-transparent hover:border-[#333333]/40'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setActiveEditorTab(null)}
                title="סגור חלון עריכה (Esc)"
                className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-[#333333] flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden bg-[#FFFDF0]">
              {activeEditorTab === 'piano_roll' && (
                <PianoRollEditor
                  clip={selectedClip}
                  track={
                    project.tracks.find((t) => t.id === selectedClip?.trackId) || selectedTrack
                  }
                  onUpdateClip={handleUpdateClip}
                  onCreateClipOnSelectedTrack={() =>
                    selectedTrack && handleCreateClip(selectedTrack.id, playheadBeat, 8)
                  }
                />
              )}

              {activeEditorTab === 'step_sequencer' && (
                <StepSequencer
                  drumTrack={drumTrack}
                  drumClip={drumClip}
                  playheadBeat={playheadBeat}
                  isPlaying={isPlaying}
                  swing={project.swing}
                  onChangeSwing={(swing) => updateProject((p) => ({ ...p, swing }), false)}
                  onUpdateClip={handleUpdateClip}
                  onCreateDrumClip={() => {
                    if (drumTrack) {
                      handleCreateClip(drumTrack.id, 0, 8);
                    } else {
                      handleAddTrack('drum_kit', 'תופים אולפן');
                    }
                  }}
                />
              )}

              {activeEditorTab === 'mixer' && (
                <MixerConsole
                  tracks={project.tracks}
                  masterVolume={project.masterVolume}
                  selectedTrackId={selectedTrack?.id || ''}
                  onSelectTrack={setSelectedTrackId}
                  onUpdateTrack={handleUpdateTrack}
                  onChangeMasterVolume={(masterVolume) => {
                    dawEngine.updateMasterVolumeFast(masterVolume);
                    updateProject((p) => ({ ...p, masterVolume }), false);
                  }}
                  onOpenTrackPlugins={(trackId) => {
                    setSelectedTrackId(trackId);
                    setActiveEditorTab('plugins');
                  }}
                />
              )}

              {activeEditorTab === 'plugins' && (
                <PluginRack
                  track={selectedTrack}
                  onUpdateTrack={handleUpdateTrack}
                  onAddPlugin={handleAddPluginToTrack}
                  onUpdatePlugin={handleUpdatePlugin}
                  onRemovePlugin={handleRemovePlugin}
                  onOpenVstModal={() => setVstOpen(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact Akai Professional LPK25 Dock - Hidden by Default, Hardware Always Live */}
      {showLpk25Dock && (
        <MidiControllerBar
          devices={midiDevices}
          midiSupported={midiSupported}
          midiError={midiError}
          settings={lpkSettings}
          activePitches={activePitches}
          lastMidiLog={lastMidiLog}
          armedTrackName={armedTrack?.name}
          onUpdateSettings={(partial) => {
            midiManager.updateSettings(partial);
            setLpkSettings(midiManager.getSettings());
          }}
          onRefreshMidi={() => void initMidiConnection()}
          onNoteOn={(pitch, vel) => midiManager.triggerVirtualNoteOn(pitch, vel)}
          onNoteOff={(pitch) => midiManager.triggerVirtualNoteOff(pitch)}
          onPanic={() => {
            dawEngine.allNotesOff();
            setActivePitches(new Set());
          }}
        />
      )}

      {/* Modals */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        project={project}
      />

      <VstPluginModal
        isOpen={vstOpen}
        onClose={() => setVstOpen(false)}
        selectedTrack={selectedTrack}
        onAddBuiltInPlugin={handleAddPluginToTrack}
        onImportCustomPlugin={handleMountCustomPlugin}
        onImportExternalFile={handleImportExternalPluginFile}
      />

      <ProjectsModal
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        currentProjectId={project.id}
        onSelectProject={(loaded) => {
          dawEngine.stop();
          setProject(loaded);
          setHistoryPast([]);
          setHistoryFuture([]);
          setSelectedTrackId(loaded.tracks[0]?.id || '');
          setSelectedClipId(loaded.clips[0]?.id || null);
          dawEngine.setPlayheadBeat(0);
        }}
        onLoadTemplate={handleLoadTemplate}
      />

      {/* Visual Count-in Overlay before Overdub Recording */}
      {countInStatus.active && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-white border-2 border-[#333333] shadow-[6px_6px_0_#333333] rounded-3xl px-8 py-5 flex flex-col items-center gap-1.5">
            <span className="text-xs font-bold text-[#666666]">
              ספירה לאחור להקלטה · תיבה {countInStatus.currentBar} מתוך {countInStatus.totalBars}
            </span>
            <span className="font-mono-num text-5xl font-extrabold text-[#7B61FF]">
              {countInStatus.beatInBar}
            </span>
          </div>
        </div>
      )}

      {/* Clean Studio Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-white border-2 border-[#333333] shadow-[4px_4px_0_#333333] text-[#333333] text-xs font-bold px-4 py-2.5 rounded-full">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
