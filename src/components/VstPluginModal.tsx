import React, { useRef, useState } from 'react';
import { Code2, Download, FileUp, Layers, Plus, X } from 'lucide-react';
import {
  exportJuceVst3Source,
  exportVstPresetFile,
  exportWebAudioPluginBundle,
  triggerDownload,
} from '../audio/exportUtils';
import { createPluginInstance, PLUGIN_CATALOG } from '../audio/fxEngine';
import { PluginInstance, PluginType, Track } from '../types/daw';

interface VstPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack: Track | null;
  onAddBuiltInPlugin: (trackId: string, type: PluginType) => void;
  onImportCustomPlugin: (trackId: string, plugin: PluginInstance) => void;
  onImportExternalFile: (file: File) => void;
}

export const VstPluginModal: React.FC<VstPluginModalProps> = ({
  isOpen,
  onClose,
  selectedTrack,
  onAddBuiltInPlugin,
  onImportCustomPlugin,
  onImportExternalFile,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [customName, setCustomName] = useState('Custom Analog Warmth VST');
  const [cutoff, setCutoff] = useState(6800);
  const [resonance, setResonance] = useState(2.4);
  const [drive, setDrive] = useState(24);

  if (!isOpen) return null;

  const handleMountCustomDsp = () => {
    if (!selectedTrack) return;
    const plugin = createPluginInstance('custom_dsp', {
      name: customName.trim() || 'Custom DSP Plugin',
      vendor: 'Harmonia Custom VST',
      vstUid: `CUST-${Date.now().toString().slice(-4)}`,
      params: { cutoff, resonance, drive, mode: 0 },
    });
    onImportCustomPlugin(selectedTrack.id, plugin);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#333333]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#FFFDF0] border-2 border-[#333333] shadow-[8px_8px_0_#333333] rounded-3xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b-2 border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#7B61FF]" />
            <div>
              <h2 className="text-base font-extrabold text-[#333333]">
                ניהול והטמעת פלאגינים ו-VST
              </h2>
              <p className="text-xs text-[#666666]">
                טעינת קבצי <span className="font-mono-num">.vstpreset / .fxp / .json / .js</span>, בניית מודול DSP וייצוא קוד VST3 ל-JUCE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-[#333333] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Import External Plugin / Preset */}
          <div className="p-4 rounded-2xl bg-white border-2 border-[#333333] shadow-[4px_4px_0_#333333] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#333333]">
                ייבוא והטמעת פלאגין חיצוני לערוץ ({selectedTrack?.name || 'בחר ערוץ'})
              </div>
              <p className="text-xs text-[#666666]">
                תומך בייבוא קבצי פריסט <span className="font-mono-num">.vstpreset</span>,{' '}
                <span className="font-mono-num">.fxp</span>, מודולי{' '}
                <span className="font-mono-num">.harmonia-vst.json</span> או סקריפטי WebAudio{' '}
                <span className="font-mono-num">.js</span>.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".vstpreset,.fxp,.fxb,.json,.js"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  onImportExternalFile(f);
                  onClose();
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-full border-2 border-[#333333] shadow-[2px_2px_0_#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[#333333] text-xs font-bold flex items-center gap-2 shrink-0 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              <span>בחר קובץ פלאגין / VST</span>
            </button>
          </div>

          {/* Custom DSP Plugin Builder + VST3 Export */}
          <div className="p-4 rounded-2xl bg-white border-2 border-[#333333] shadow-[4px_4px_0_#333333] space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#7B61FF]">
              <Code2 className="w-4 h-4" />
              <span>בניית פלאגין DSP מותאם אישית וייצוא ל-VST3</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-xs font-bold text-[#333333]">
                <span>שם הפלאגין</span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-[#FFFDF0] border-2 border-[#333333] rounded-full px-3 py-1.5 text-xs text-[#333333] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#333333]">
                <span className="flex justify-between font-mono-num">
                  <span>Drive (Saturation)</span>
                  <span className="text-[#7B61FF]">{drive}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={drive}
                  onChange={(e) => setDrive(Number(e.target.value))}
                  className="studio-slider mt-1"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#333333]">
                <span className="flex justify-between font-mono-num">
                  <span>Filter Cutoff</span>
                  <span className="text-[#7B61FF]">{cutoff} Hz</span>
                </span>
                <input
                  type="range"
                  min={150}
                  max={18000}
                  step={50}
                  value={cutoff}
                  onChange={(e) => setCutoff(Number(e.target.value))}
                  className="studio-slider mt-1"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#333333]">
                <span className="flex justify-between font-mono-num">
                  <span>Filter Resonance</span>
                  <span className="text-[#7B61FF]">{resonance} Q</span>
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={14}
                  step={0.2}
                  value={resonance}
                  onChange={(e) => setResonance(Number(e.target.value))}
                  className="studio-slider mt-1"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={!selectedTrack}
                onClick={handleMountCustomDsp}
                className="px-4 py-2 rounded-full border-2 border-[#333333] shadow-[2px_2px_0_#333333] bg-[#7B61FF] hover:bg-[#6A4FF0] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>הטמע פלאגין לערוץ הנבחר</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const plg = createPluginInstance('custom_dsp', {
                    name: customName,
                    params: { cutoff, resonance, drive, mode: 0 },
                  });
                  triggerDownload(exportJuceVst3Source(plg), `${customName.replace(/\s+/g, '_')}_VST3.cpp`);
                }}
                className="px-3 py-2 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-xs font-bold text-[#333333] flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ייצא קוד JUCE VST3 (.cpp)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const plg = createPluginInstance('custom_dsp', {
                    name: customName,
                    params: { cutoff, resonance, drive, mode: 0 },
                  });
                  triggerDownload(exportVstPresetFile(plg), `${customName.replace(/\s+/g, '_')}.vstpreset`);
                }}
                className="px-3 py-2 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-xs font-bold text-[#333333] flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ייצא .vstpreset</span>
              </button>
            </div>
          </div>

          {/* Export Existing Track Plugins or Add Built-in */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#333333]">
              תוספים פעילים בערוץ הנבחר ({selectedTrack?.plugins.length || 0})
            </h3>
            {selectedTrack && selectedTrack.plugins.length > 0 ? (
              <div className="divide-y divide-[#333333]/15 border-2 border-[#333333] rounded-2xl bg-white overflow-hidden">
                {selectedTrack.plugins.map((plg) => (
                  <div key={plg.id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#333333]">{plg.name}</div>
                      <div className="text-[11px] font-mono-num text-[#777777]">
                        {plg.vendor} · {plg.vstUid}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(exportVstPresetFile(plg), `${plg.name.replace(/\s+/g, '_')}.vstpreset`)
                        }
                        className="px-3 py-1 rounded-full border border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors"
                      >
                        ייצא .vstpreset
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(exportWebAudioPluginBundle(plg), `${plg.name.replace(/\s+/g, '_')}.harmonia-vst.json`)
                        }
                        className="px-3 py-1 rounded-full border border-[#333333] bg-[#FFFDF0] hover:bg-[#EEECE0] text-[11px] font-bold text-[#333333]"
                      >
                        ייצא Bundle
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          triggerDownload(exportJuceVst3Source(plg), `${plg.name.replace(/\s+/g, '_')}_VST3.cpp`)
                        }
                        className="px-3 py-1 rounded-full border border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors"
                      >
                        JUCE C++
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#666666] py-2">
                אין עדיין תוספים בערוץ זה. ניתן להוסיף מהרשימה המובנית:
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {selectedTrack &&
                PLUGIN_CATALOG.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onAddBuiltInPlugin(selectedTrack.id, item.type)}
                    className="px-3.5 py-1.5 rounded-full border-2 border-[#333333] bg-white hover:bg-[#7B61FF] hover:text-white text-xs font-bold text-[#333333] transition-colors"
                  >
                    + {item.hebrewName}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
