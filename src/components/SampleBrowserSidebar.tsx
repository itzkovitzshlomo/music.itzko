import React, { useMemo, useRef, useState } from 'react';
import {
  Disc3,
  FileAudio,
  Music2,
  Play,
  Plus,
  Search,
  Sliders,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import { PLUGIN_CATALOG } from '../audio/fxEngine';
import { registerUserAudioFile } from '../audio/sampleLibrary';
import { INSTRUMENT_CATALOG, PROJECT_TEMPLATES, ProjectTemplateInfo } from '../data/presets';
import { InstrumentType, PluginType, SampleAsset, SidebarTab } from '../types/daw';

interface SampleBrowserSidebarProps {
  samples: SampleAsset[];
  onSamplesUpdated: (samples: SampleAsset[]) => void;
  onInsertSample: (sample: SampleAsset) => void;
  onAddInstrumentTrack: (instrument: InstrumentType, name: string) => void;
  onApplyInstrumentToSelected: (instrument: InstrumentType) => void;
  onAddPluginToSelectedTrack: (type: PluginType) => void;
  onImportExternalPluginFile: (file: File) => void;
  onLoadTemplate: (template: ProjectTemplateInfo) => void;
  onClose: () => void;
  selectedTrackName?: string;
}

export const SampleBrowserSidebar: React.FC<SampleBrowserSidebarProps> = ({
  samples,
  onSamplesUpdated,
  onInsertSample,
  onAddInstrumentTrack,
  onApplyInstrumentToSelected,
  onAddPluginToSelectedTrack,
  onImportExternalPluginFile,
  onLoadTemplate,
  onClose,
  selectedTrackName,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('samples');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const audioInputRef = useRef<HTMLInputElement>(null);
  const pluginInputRef = useRef<HTMLInputElement>(null);

  const filteredSamples = useMemo(() => {
    const q = search.trim().toLowerCase();
    return samples.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.hebrewName.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q)
      );
    });
  }, [samples, category, search]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const ctx = dawEngine.ensureContext();
    let updated = [...samples];
    for (const file of Array.from(files)) {
      const asset = await registerUserAudioFile(ctx, file);
      updated = [asset, ...updated];
    }
    onSamplesUpdated(updated);
    e.target.value = '';
  };

  const handlePluginUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportExternalPluginFile(file);
    }
    e.target.value = '';
  };

  return (
    <aside className="w-[320px] max-w-[88vw] h-full bg-[#FFFDF0] border-l-2 border-[#333333] shadow-[-6px_0_0_rgba(51,51,51,0.08)] flex flex-col overflow-hidden">
      {/* Drawer Header */}
      <div className="px-4 py-3 bg-white border-b-2 border-[#333333] flex items-center justify-between">
        <span className="text-sm font-bold text-[#333333]">ספריית הפקה וכלים</span>
        <button
          type="button"
          onClick={onClose}
          title="סגור ספרייה"
          className="w-7 h-7 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-[#333333] flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tactile Tabs */}
      <div className="grid grid-cols-4 bg-[#FFFDF0] p-2 gap-1.5 border-b border-[#333333]/15">
        {[
          { id: 'samples', label: 'דגימות', icon: Disc3 },
          { id: 'instruments', label: 'כלים', icon: Music2 },
          { id: 'vst', label: 'VST', icon: Sliders },
          { id: 'templates', label: 'תבניות', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SidebarTab)}
              className={`py-2 px-1 rounded-xl border-2 text-[11px] font-bold flex flex-col items-center gap-1 transition-all whitespace-nowrap ${
                active
                  ? 'bg-[#7B61FF] text-white border-[#333333] shadow-[2px_2px_0_#333333]'
                  : 'bg-white text-[#333333] border-[#333333]/25 hover:border-[#333333]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Samples Tab */}
      {activeTab === 'samples' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#777777] absolute right-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חפש דגימה, קיק, לופ..."
                className="w-full bg-white border-2 border-[#333333] rounded-full pr-8 pl-3 py-1.5 text-xs font-medium text-[#333333] placeholder:text-[#888888] outline-none focus:ring-2 focus:ring-[#7B61FF]/30"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'הכל' },
                { id: 'drums', label: 'תופים' },
                { id: 'bass', label: 'בס' },
                { id: 'synths', label: 'סינת׳' },
                { id: 'loops', label: 'לופים' },
                { id: 'fx', label: 'FX' },
                { id: 'user', label: 'אישי' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors whitespace-nowrap ${
                    category === cat.id
                      ? 'bg-[#333333] text-white border-[#333333]'
                      : 'bg-white text-[#333333] border-[#333333]/30 hover:border-[#333333]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff"
              multiple
              onChange={handleAudioUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white shadow-[2px_2px_0_#333333] text-xs font-bold text-[#333333] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>ייבוא קובץ שמע (WAV/MP3)</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
            {filteredSamples.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#777777]">
                לא נמצאו דגימות התואמות לחיפוש
              </div>
            ) : (
              filteredSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="p-3 rounded-2xl bg-white border-2 border-[#333333] shadow-[3px_3px_0_#333333] transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => dawEngine.previewSample(sample.id)}
                      title="השמע תצוגה מקדימה"
                      className="w-8 h-8 shrink-0 rounded-full border-2 border-[#333333] bg-[#FFFDF0] hover:bg-[#7B61FF] hover:text-white text-[#333333] flex items-center justify-center transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-[#333333] truncate">
                        {sample.hebrewName}
                      </div>
                      <div className="text-[10px] text-[#777777] flex items-center gap-1.5 font-mono-num">
                        <span className="truncate">{sample.genre}</span>
                        <span>·</span>
                        <span>{sample.durationSec.toFixed(2)}s</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInsertSample(sample)}
                      title="הוסף לציר הזמן"
                      className="px-2.5 py-1 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>הוסף</span>
                    </button>
                  </div>

                  <div
                    dir="ltr"
                    className="mt-2 h-4 flex items-center gap-[1.5px] px-1.5 bg-[#FFFDF0] border border-[#333333]/20 rounded-md"
                  >
                    {sample.peaks.slice(0, 36).map((pk, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-[#333333]/70 group-hover:bg-[#7B61FF] rounded-full"
                        style={{ height: `${Math.max(15, Math.round(pk * 100))}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Instruments Tab */}
      {activeTab === 'instruments' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          <div className="p-2.5 rounded-xl bg-white border border-[#333333]/25 text-[11px] text-[#555555]">
            ערוץ נבחר: <span className="text-[#7B61FF] font-bold">{selectedTrackName || 'ללא'}</span>
          </div>
          {INSTRUMENT_CATALOG.map((inst) => (
            <div
              key={inst.type}
              className="p-3 rounded-2xl bg-white border-2 border-[#333333] shadow-[3px_3px_0_#333333] space-y-2"
            >
              <div>
                <div className="text-xs font-bold text-[#333333]">{inst.hebrewName}</div>
                <div className="text-[11px] font-medium text-[#777777]">{inst.category}</div>
              </div>
              <p className="text-[11px] text-[#555555] leading-relaxed">{inst.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApplyInstrumentToSelected(inst.type)}
                  className="flex-1 py-1.5 px-2 rounded-full border-2 border-[#333333] bg-white hover:bg-[#D6E4FF] text-[11px] font-bold text-[#333333] transition-colors"
                >
                  טען לערוץ
                </button>
                <button
                  type="button"
                  onClick={() => onAddInstrumentTrack(inst.type, inst.hebrewName)}
                  className="py-1.5 px-3 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors"
                >
                  + ערוץ חדש
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VST & Plugins Tab */}
      {activeTab === 'vst' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 space-y-2">
            <input
              ref={pluginInputRef}
              type="file"
              accept=".vstpreset,.fxp,.fxb,.json,.js"
              onChange={handlePluginUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => pluginInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white shadow-[2px_2px_0_#333333] text-xs font-bold text-[#333333] transition-colors"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>הטמע פלאגין (.vstpreset / .fxp / .js)</span>
            </button>
            <p className="text-[11px] text-[#777777]">
              יעד: {selectedTrackName || 'בחר ערוץ'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
            {PLUGIN_CATALOG.map((plg) => (
              <div
                key={plg.type}
                className="p-3 rounded-2xl bg-white border-2 border-[#333333] shadow-[3px_3px_0_#333333] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#333333]">{plg.hebrewName}</div>
                    <div className="text-[10px] font-mono-num text-[#777777]">
                      {plg.name} · {plg.vstUid}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddPluginToSelectedTrack(plg.type)}
                    className="px-3 py-1 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors shrink-0"
                  >
                    + הוסף
                  </button>
                </div>
                <p className="text-[11px] text-[#555555]">{plg.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {PROJECT_TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="p-3.5 rounded-2xl bg-white border-2 border-[#333333] shadow-[3px_3px_0_#333333] space-y-2"
            >
              <div className="text-xs font-bold text-[#333333]">{tpl.name}</div>
              <div className="text-[11px] text-[#777777] font-mono-num">
                {tpl.genre} · {tpl.bpm} BPM
              </div>
              <p className="text-[11px] text-[#555555] leading-relaxed">{tpl.description}</p>
              <button
                type="button"
                onClick={() => onLoadTemplate(tpl)}
                className="w-full py-1.5 px-3 rounded-full border-2 border-[#333333] bg-[#333333] hover:bg-[#7B61FF] text-xs font-bold text-white transition-colors"
              >
                פתח תבנית עבודה זו
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
