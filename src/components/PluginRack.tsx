import React from 'react';
import { Download, Plus, Power, Trash2 } from 'lucide-react';
import {
  exportJuceVst3Source,
  exportVstPresetFile,
  exportWebAudioPluginBundle,
  triggerDownload,
} from '../audio/exportUtils';
import { getPluginParamDefs, PLUGIN_CATALOG } from '../audio/fxEngine';
import { PluginInstance, PluginType, Track } from '../types/daw';

interface PluginRackProps {
  track: Track | null;
  onUpdateTrack: (trackId: string, partial: Partial<Track>) => void;
  onAddPlugin: (trackId: string, type: PluginType) => void;
  onUpdatePlugin: (trackId: string, pluginId: string, partial: Partial<PluginInstance>) => void;
  onRemovePlugin: (trackId: string, pluginId: string) => void;
  onOpenVstModal: () => void;
}

export const PluginRack: React.FC<PluginRackProps> = ({
  track,
  onUpdateTrack,
  onAddPlugin,
  onUpdatePlugin,
  onRemovePlugin,
  onOpenVstModal,
}) => {
  if (!track) {
    return (
      <div className="h-full flex items-center justify-center text-xs font-medium text-[#666666] bg-[#FFFDF0]">
        בחר ערוץ כדי לערוך את הסינתיסייזר ותוספי האפקטים (VST / DSP).
      </div>
    );
  }

  const updateSynth = (key: keyof Track['synthSettings'], val: number) => {
    onUpdateTrack(track.id, {
      synthSettings: {
        ...track.synthSettings,
        [key]: val,
      },
    });
  };

  return (
    <div className="h-full bg-[#FFFDF0] flex overflow-x-auto gap-3.5 p-4">
      {/* Built-in Instrument Synth Panel */}
      <div className="w-72 shrink-0 rounded-2xl border-2 border-[#333333] shadow-[4px_4px_0_#333333] p-4 bg-white flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#333333]/15 pb-2">
          <div>
            <div className="text-xs font-extrabold text-[#7B61FF]">מנוע כלי מובנה</div>
            <div className="text-[11px] font-bold text-[#333333]">{track.name}</div>
          </div>
          <span className="font-mono-num text-[10px] font-bold text-[#777777]">
            {track.instrument}
          </span>
        </div>

        <div dir="ltr" className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 text-[11px] font-bold text-[#333333]">
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>ATK</span>
              <span className="text-[#7B61FF]">{(track.synthSettings.attack * 1000).toFixed(0)}ms</span>
            </span>
            <input
              type="range"
              min={0.002}
              max={0.6}
              step={0.004}
              value={track.synthSettings.attack}
              onChange={(e) => updateSynth('attack', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>DEC</span>
              <span className="text-[#7B61FF]">{(track.synthSettings.decay * 1000).toFixed(0)}ms</span>
            </span>
            <input
              type="range"
              min={0.02}
              max={1.5}
              step={0.02}
              value={track.synthSettings.decay}
              onChange={(e) => updateSynth('decay', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>SUS</span>
              <span className="text-[#7B61FF]">{Math.round(track.synthSettings.sustain * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.02}
              value={track.synthSettings.sustain}
              onChange={(e) => updateSynth('sustain', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>REL</span>
              <span className="text-[#7B61FF]">{(track.synthSettings.release * 1000).toFixed(0)}ms</span>
            </span>
            <input
              type="range"
              min={0.03}
              max={1.8}
              step={0.02}
              value={track.synthSettings.release}
              onChange={(e) => updateSynth('release', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1 col-span-2">
            <span className="flex justify-between font-mono-num">
              <span>FILTER CUTOFF</span>
              <span className="text-[#7B61FF]">{Math.round(track.synthSettings.cutoff)} Hz</span>
            </span>
            <input
              type="range"
              min={150}
              max={16000}
              step={50}
              value={track.synthSettings.cutoff}
              onChange={(e) => updateSynth('cutoff', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>RES</span>
              <span className="text-[#7B61FF]">{track.synthSettings.resonance.toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0.5}
              max={14}
              step={0.2}
              value={track.synthSettings.resonance}
              onChange={(e) => updateSynth('resonance', Number(e.target.value))}
              className="studio-slider"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono-num">
              <span>DETUNE</span>
              <span className="text-[#7B61FF]">{track.synthSettings.detune} ct</span>
            </span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={track.synthSettings.detune}
              onChange={(e) => updateSynth('detune', Number(e.target.value))}
              className="studio-slider"
            />
          </label>
        </div>
      </div>

      {/* Track Insert FX / VST Rack */}
      <div className="flex-1 flex items-stretch gap-3.5 overflow-x-auto pb-1">
        {track.plugins.map((plugin) => {
          const defs = getPluginParamDefs(plugin);
          return (
            <div
              key={plugin.id}
              className={`w-64 shrink-0 rounded-2xl border-2 border-[#333333] shadow-[4px_4px_0_#333333] p-3.5 flex flex-col justify-between gap-2 transition-opacity ${
                plugin.enabled ? 'bg-white' : 'bg-[#F3F1E5] opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#333333]/15 pb-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#333333] truncate">{plugin.name}</div>
                  <div className="text-[10px] font-mono-num text-[#777777] truncate">
                    {plugin.vendor} · {plugin.vstUid || 'DSP'}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePlugin(track.id, plugin.id, { enabled: !plugin.enabled })
                    }
                    title="הפעל / עקוף (Bypass)"
                    className={`w-7 h-7 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
                      plugin.enabled
                        ? 'bg-[#D6E4FF] text-[#333333]'
                        : 'bg-white text-[#888888]'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePlugin(track.id, plugin.id)}
                    title="הסר פלאגין"
                    className="w-7 h-7 rounded-full hover:bg-[#FFD6E8] text-[#777777] hover:text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div dir="ltr" className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {defs.map((def) => {
                  const current = plugin.params[def.id] ?? def.value;
                  return (
                    <label key={def.id} className="flex flex-col gap-0.5 text-[11px] font-bold text-[#333333]">
                      <span className="flex justify-between font-mono-num">
                        <span>{def.label}</span>
                        <span className="text-[#7B61FF]">
                          {current}
                          {def.unit}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={current}
                        onChange={(e) =>
                          onUpdatePlugin(track.id, plugin.id, {
                            params: { ...plugin.params, [def.id]: Number(e.target.value) },
                          })
                        }
                        className="studio-slider"
                      />
                    </label>
                  );
                })}
              </div>

              {/* Direct VST Preset / JUCE Export per Plugin */}
              <div className="pt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      exportVstPresetFile(plugin),
                      `${plugin.name.replace(/\s+/g, '_')}.vstpreset`
                    )
                  }
                  className="flex-1 py-1 px-2 rounded-full border border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[10px] font-bold text-[#333333] flex items-center justify-center gap-1 transition-colors"
                  title="ייצא כקובץ .vstpreset"
                >
                  <Download className="w-2.5 h-2.5" />
                  <span>.vstpreset</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      exportJuceVst3Source(plugin),
                      `${plugin.name.replace(/\s+/g, '_')}_VST3.cpp`
                    )
                  }
                  className="flex-1 py-1 px-2 rounded-full border border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-[10px] font-bold text-[#333333] flex items-center justify-center gap-1 transition-colors"
                  title="ייצא קוד מקור JUCE VST3 C++"
                >
                  <Download className="w-2.5 h-2.5" />
                  <span>VST3 C++</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      exportWebAudioPluginBundle(plugin),
                      `${plugin.name.replace(/\s+/g, '_')}.harmonia-vst.json`
                    )
                  }
                  className="py-1 px-2 rounded-full border border-[#333333] bg-[#FFFDF0] hover:bg-[#EEECE0] text-[10px] font-bold text-[#333333] transition-colors"
                  title="ייצא פלאגין WebAudio נייד"
                >
                  .json
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Plugin Card */}
        <div className="w-60 shrink-0 rounded-2xl border-2 border-dashed border-[#333333] p-3.5 flex flex-col justify-between bg-white">
          <div className="text-xs font-bold text-[#333333]">הוסף אפקט / VST לערוץ</div>
          <div className="grid grid-cols-1 gap-1.5 my-2 overflow-y-auto">
            {PLUGIN_CATALOG.slice(0, 5).map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => onAddPlugin(track.id, item.type)}
                className="text-right px-3 py-1.5 rounded-full border border-[#333333] bg-[#FFFDF0] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] flex items-center justify-between transition-colors"
              >
                <span>{item.hebrewName}</span>
                <Plus className="w-3 h-3 shrink-0" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenVstModal}
            className="w-full py-2 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-[11px] font-bold text-[#333333] transition-colors"
          >
            הטמע / ייצא VST חיצוני...
          </button>
        </div>
      </div>
    </div>
  );
};
