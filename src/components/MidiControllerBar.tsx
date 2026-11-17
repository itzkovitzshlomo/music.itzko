import React, { useMemo } from 'react';
import { Keyboard, RefreshCw, Usb, VolumeX } from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import { midiManager, midiNumberToNoteName } from '../audio/midiManager';
import {
  ArpMode,
  ArpRate,
  Lpk25Settings,
  MidiDeviceInfo,
  MidiMessageLog,
} from '../types/daw';

interface MidiControllerBarProps {
  devices: MidiDeviceInfo[];
  midiSupported: boolean;
  midiError?: string;
  settings: Lpk25Settings;
  activePitches: Set<number>;
  lastMidiLog: MidiMessageLog | null;
  armedTrackName?: string;
  onUpdateSettings: (partial: Partial<Lpk25Settings>) => void;
  onRefreshMidi: () => void;
  onNoteOn: (pitch: number, velocity: number) => void;
  onNoteOff: (pitch: number) => void;
  onPanic: () => void;
}

const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMITONE_POSITIONS: Array<{ semitone: number; whiteIndexOffset: number }> = [
  { semitone: 1, whiteIndexOffset: 0 },
  { semitone: 3, whiteIndexOffset: 1 },
  { semitone: 6, whiteIndexOffset: 3 },
  { semitone: 8, whiteIndexOffset: 4 },
  { semitone: 10, whiteIndexOffset: 5 },
];

export const MidiControllerBar: React.FC<MidiControllerBarProps> = ({
  devices,
  midiSupported,
  midiError,
  settings,
  activePitches,
  lastMidiLog,
  armedTrackName,
  onUpdateSettings,
  onRefreshMidi,
  onNoteOn,
  onNoteOff,
  onPanic,
}) => {
  const baseMidi = 48 + settings.octaveOffset * 12;

  const { whiteKeys, blackKeys } = useMemo(() => {
    const whites: Array<{ pitch: number; label: string }> = [];
    const blacks: Array<{ pitch: number; leftPercent: number; label: string }> = [];

    for (let oct = 0; oct < 2; oct++) {
      for (const semi of WHITE_SEMITONES) {
        const pitch = baseMidi + oct * 12 + semi;
        whites.push({ pitch, label: midiNumberToNoteName(pitch) });
      }
    }
    whites.push({ pitch: baseMidi + 24, label: midiNumberToNoteName(baseMidi + 24) });

    const totalWhites = whites.length;
    for (let oct = 0; oct < 2; oct++) {
      for (const blk of BLACK_SEMITONE_POSITIONS) {
        const pitch = baseMidi + oct * 12 + blk.semitone;
        const whiteIdx = oct * 7 + blk.whiteIndexOffset;
        const leftPercent = ((whiteIdx + 0.68) / totalWhites) * 100;
        blacks.push({ pitch, leftPercent, label: midiNumberToNoteName(pitch) });
      }
    }

    return { whiteKeys: whites, blackKeys: blacks };
  }, [baseMidi]);

  const lpk25Device = devices.find((d) => d.isLpk25 && d.state === 'connected');
  const anyConnected = devices.find((d) => d.state === 'connected');
  const latencyMs = dawEngine.getEstimatedLatencyMs();

  return (
    <div className="shrink-0 bg-white border-t-2 border-[#333333] px-6 lg:px-10 py-2.5 flex flex-col gap-2">
      {/* Hardware Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Usb
              className={`w-3.5 h-3.5 ${
                lpk25Device
                  ? 'text-emerald-600'
                  : anyConnected
                  ? 'text-[#7B61FF]'
                  : 'text-[#777777]'
              }`}
            />
            <div className="text-xs">
              <span className="font-bold text-[#333333]">
                {lpk25Device
                  ? `מחובר: ${lpk25Device.name}`
                  : anyConnected
                  ? `בקר MIDI מחובר: ${anyConnected.name}`
                  : 'Akai LPK25 (מוכן לחיבור USB MIDI)'}
              </span>
              {midiError && <span className="text-red-600 mr-2 text-[11px]">{midiError}</span>}
              {!midiSupported && !midiError && (
                <span className="text-[#7B61FF] mr-2 text-[11px] font-medium">
                  מקלדת וירטואלית (Web MIDI דורש Chrome/Edge)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onRefreshMidi}
              title="סרוק התקני USB MIDI מחדש"
              className="w-7 h-7 rounded-full border border-[#333333] bg-[#FFFDF0] hover:bg-[#D6E4FF] text-[#333333] flex items-center justify-center"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <span className="text-[11px] text-[#777777] font-mono-num">
            יעד: <strong className="text-[#7B61FF]">{armedTrackName || 'ללא'}</strong>
            {' · '}השהייה: <strong className="text-[#333333]">{latencyMs}ms</strong>
          </span>

          {lastMidiLog && (
            <span dir="ltr" className="text-[10px] font-mono-num text-[#777777]">
              IN: {lastMidiLog.note !== undefined ? midiNumberToNoteName(lastMidiLog.note) : lastMidiLog.type}
              {lastMidiLog.velocity ? ` v${lastMidiLog.velocity}` : ''}
            </span>
          )}
        </div>

        {/* LPK25 Function Pills */}
        <div dir="ltr" className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-[#FFFDF0] border-2 border-[#333333] rounded-full overflow-hidden">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ octaveOffset: Math.max(-2, settings.octaveOffset - 1) })
              }
              className="px-2.5 py-0.5 text-[11px] font-bold text-[#333333] hover:bg-[#D6E4FF]"
            >
              OCT-
            </button>
            <span className="px-2 text-[11px] font-mono-num font-bold text-[#7B61FF]">
              {settings.octaveOffset >= 0 ? `+${settings.octaveOffset}` : settings.octaveOffset}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ octaveOffset: Math.min(2, settings.octaveOffset + 1) })
              }
              className="px-2.5 py-0.5 text-[11px] font-bold text-[#333333] hover:bg-[#D6E4FF]"
            >
              OCT+
            </button>
          </div>

          <button
            type="button"
            onClick={() => onUpdateSettings({ arpEnabled: !settings.arpEnabled })}
            className={`px-3 py-1 rounded-full border-2 border-[#333333] text-[11px] font-bold transition-colors ${
              settings.arpEnabled
                ? 'bg-[#FFD6E8] text-[#333333]'
                : 'bg-white text-[#333333] hover:bg-[#EEECE0]'
            }`}
          >
            ARP {settings.arpEnabled ? 'ON' : 'OFF'}
          </button>

          {settings.arpEnabled && (
            <>
              <select
                value={settings.arpMode}
                onChange={(e) => onUpdateSettings({ arpMode: e.target.value as ArpMode })}
                className="bg-[#FFFDF0] border-2 border-[#333333] rounded-full px-2 py-0.5 text-[11px] font-bold text-[#333333] outline-none"
              >
                <option value="up">UP</option>
                <option value="down">DOWN</option>
                <option value="up_down">UP/DN</option>
                <option value="random">RAND</option>
              </select>
              <select
                value={settings.arpRate}
                onChange={(e) => onUpdateSettings({ arpRate: e.target.value as ArpRate })}
                className="bg-[#FFFDF0] border-2 border-[#333333] rounded-full px-2 py-0.5 text-[11px] font-bold text-[#333333] outline-none"
              >
                <option value="1/4">1/4</option>
                <option value="1/8">1/8</option>
                <option value="1/16">1/16</option>
                <option value="1/32">1/32</option>
                <option value="1/8T">1/8T</option>
              </select>
            </>
          )}

          <button
            type="button"
            onClick={() => onUpdateSettings({ sustainOn: !settings.sustainOn })}
            className={`px-3 py-1 rounded-full border-2 border-[#333333] text-[11px] font-bold transition-colors ${
              settings.sustainOn
                ? 'bg-[#7B61FF] text-white'
                : 'bg-white text-[#333333] hover:bg-[#EEECE0]'
            }`}
          >
            SUSTAIN
          </button>

          <select
            value={settings.velocityCurve}
            onChange={(e) =>
              onUpdateSettings({
                velocityCurve: e.target.value as Lpk25Settings['velocityCurve'],
              })
            }
            title="עקומת רגישות קלידים (Velocity)"
            className="bg-[#FFFDF0] border-2 border-[#333333] rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#333333] outline-none"
          >
            <option value="linear">Vel: Linear</option>
            <option value="soft">Vel: Soft</option>
            <option value="hard">Vel: Hard</option>
            <option value="fixed100">Vel: Fixed 100</option>
          </select>

          <button
            type="button"
            onClick={() => onUpdateSettings({ qwertyEnabled: !settings.qwertyEnabled })}
            title="נגינה באמצעות מקלדת המחשב (Z-M / Q-I)"
            className={`px-2.5 py-1 rounded-full border-2 border-[#333333] text-[11px] font-bold flex items-center gap-1 transition-colors ${
              settings.qwertyEnabled
                ? 'bg-[#D6E4FF] text-[#333333]'
                : 'bg-white text-[#777777] hover:text-[#333333]'
            }`}
          >
            <Keyboard className="w-3 h-3" />
            <span>QWERTY</span>
          </button>

          <button
            type="button"
            onClick={() => {
              midiManager.panic();
              onPanic();
            }}
            title="עצור את כל הצלילים התקועים (MIDI Panic)"
            className="w-7 h-7 rounded-full border-2 border-[#333333] bg-white hover:bg-[#FFD6E8] text-[#333333] flex items-center justify-center"
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Compact 25-Key Akai LPK25 Hardware Keybed */}
      <div
        dir="ltr"
        className="relative h-12 w-full bg-[#FFFDF0] border-2 border-[#333333] rounded-xl select-none overflow-hidden"
      >
        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
        >
          {whiteKeys.map((k) => {
            const active = activePitches.has(k.pitch);
            return (
              <button
                key={k.pitch}
                type="button"
                onMouseDown={() => onNoteOn(k.pitch, 105)}
                onMouseUp={() => onNoteOff(k.pitch)}
                onMouseLeave={() => {
                  if (activePitches.has(k.pitch)) onNoteOff(k.pitch);
                }}
                className={`relative border-r border-[#333333]/35 last:border-r-0 flex items-end justify-center pb-1 transition-colors ${
                  active
                    ? 'bg-[#7B61FF] text-white'
                    : 'bg-white hover:bg-[#D6E4FF]/50 text-[#555555]'
                }`}
              >
                <span className="font-mono-num text-[9px] font-bold">
                  {k.pitch % 12 === 0 ? k.label : ''}
                </span>
              </button>
            );
          })}
        </div>

        {blackKeys.map((k) => {
          const active = activePitches.has(k.pitch);
          return (
            <button
              key={k.pitch}
              type="button"
              onMouseDown={(e) => {
                e.stopPropagation();
                onNoteOn(k.pitch, 110);
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                onNoteOff(k.pitch);
              }}
              onMouseLeave={() => {
                if (activePitches.has(k.pitch)) onNoteOff(k.pitch);
              }}
              style={{
                left: `${k.leftPercent}%`,
                width: '4.1%',
              }}
              className={`absolute top-0 h-[58%] rounded-b-md border-2 border-[#333333] z-10 transition-colors ${
                active ? 'bg-[#FFD6E8]' : 'bg-[#333333] hover:bg-[#555555]'
              }`}
              title={k.label}
            />
          );
        })}
      </div>
    </div>
  );
};
