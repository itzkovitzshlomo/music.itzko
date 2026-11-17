import React, { useEffect, useRef, useState } from 'react';
import { Mic, Sliders } from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import { Track } from '../types/daw';

interface MixerConsoleProps {
  tracks: Track[];
  masterVolume: number;
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, partial: Partial<Track>) => void;
  onChangeMasterVolume: (vol: number) => void;
  onOpenTrackPlugins: (trackId: string) => void;
}

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  tracks,
  masterVolume,
  selectedTrackId,
  onSelectTrack,
  onUpdateTrack,
  onChangeMasterVolume,
  onOpenTrackPlugins,
}) => {
  const [peaks, setPeaks] = useState<Record<string, number>>({});
  const [masterPeak, setMasterPeak] = useState(0);
  const smoothedPeaksRef = useRef<Record<string, number>>({});
  const smoothedMasterRef = useRef(0);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const freqData = new Uint8Array(new ArrayBuffer(256));

    const tick = () => {
      const nextPeaks: Record<string, number> = {};
      for (const t of tracks) {
        const raw = dawEngine.getTrackPeakLevel(t.id);
        const prev = smoothedPeaksRef.current[t.id] || 0;
        const smooth = raw > prev ? raw : prev * 0.86;
        smoothedPeaksRef.current[t.id] = smooth;
        nextPeaks[t.id] = smooth;
      }
      setPeaks(nextPeaks);

      const rawMaster = dawEngine.getMasterPeakLevel();
      smoothedMasterRef.current =
        rawMaster > smoothedMasterRef.current ? rawMaster : smoothedMasterRef.current * 0.86;
      setMasterPeak(smoothedMasterRef.current);

      const canvas = spectrumCanvasRef.current;
      if (canvas && dawEngine.getMasterSpectrum(freqData)) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          const barCount = 32;
          const barW = w / barCount;
          for (let i = 0; i < barCount; i++) {
            const val = freqData[i * 2] / 255;
            const barH = Math.max(2, val * (h - 6));
            ctx.fillStyle = val > 0.78 ? '#7B61FF' : '#333333';
            ctx.fillRect(i * barW + 1, h - barH, Math.max(2, barW - 2.5), barH);
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tracks]);

  const toDbLabel = (vol: number) => {
    if (vol <= 0.005) return '-∞';
    const db = 20 * Math.log10(vol);
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
  };

  return (
    <div dir="ltr" className="h-full bg-[#FFFDF0] flex overflow-x-auto gap-3 p-4">
      {tracks.map((track, idx) => {
        const isSel = track.id === selectedTrackId;
        const level = peaks[track.id] || 0;
        const meterPct = Math.min(100, Math.round(level * 120));

        return (
          <div
            key={track.id}
            onClick={() => onSelectTrack(track.id)}
            className={`w-32 shrink-0 rounded-2xl border-2 border-[#333333] shadow-[4px_4px_0_#333333] flex flex-col px-3 py-3 gap-2.5 cursor-pointer transition-colors ${
              isSel ? 'bg-[#D6E4FF]/55' : 'bg-white hover:bg-[#FAF8EC]'
            }`}
          >
            {/* Strip Title */}
            <div className="flex items-center justify-between gap-1.5 border-b border-[#333333]/15 pb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full border border-[#333333] shrink-0"
                style={{ backgroundColor: idx % 2 === 0 ? '#D6E4FF' : '#FFD6E8' }}
              />
              <span
                dir="rtl"
                className="text-xs font-bold text-[#333333] truncate flex-1 text-right"
              >
                {track.name}
              </span>
            </div>

            {/* FX Slot */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTrackPlugins(track.id);
              }}
              className="w-full py-1 px-2.5 rounded-full border border-[#333333] bg-[#FFFDF0] hover:bg-[#FFD6E8] flex items-center justify-between text-[10px] font-bold text-[#333333] transition-colors"
            >
              <span className="flex items-center gap-1">
                <Sliders className="w-2.5 h-2.5 text-[#7B61FF]" />
                <span>FX</span>
              </span>
              <span className="font-mono-num">{track.plugins.length}</span>
            </button>

            {/* Pan Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] font-mono-num font-bold text-[#777777]">
                <span>PAN</span>
                <span className="text-[#333333]">
                  {Math.abs(track.pan) < 0.04
                    ? 'C'
                    : track.pan < 0
                    ? `L${Math.round(-track.pan * 100)}`
                    : `R${Math.round(track.pan * 100)}`}
                </span>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={track.pan}
                onChange={(e) => onUpdateTrack(track.id, { pan: Number(e.target.value) })}
                className="studio-slider w-full"
              />
            </div>

            {/* Fader + Peak Meter */}
            <div className="flex-1 flex items-center justify-center gap-3 min-h-[110px] py-1">
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.01}
                value={track.volume}
                onChange={(e) => onUpdateTrack(track.id, { volume: Number(e.target.value) })}
                className="mixer-fader h-24 w-5"
              />

              <div className="w-2.5 h-24 bg-[#EEECE0] border border-[#333333] rounded-full overflow-hidden flex flex-col justify-end">
                <div
                  className={`w-full transition-all duration-75 ${
                    meterPct > 92
                      ? 'bg-red-500'
                      : meterPct > 72
                      ? 'bg-[#7B61FF]'
                      : 'bg-emerald-500'
                  }`}
                  style={{ height: `${meterPct}%` }}
                />
              </div>
            </div>

            <div className="text-center font-mono-num text-[10px] font-bold text-[#333333]">
              {toDbLabel(track.volume)} dB
            </div>

            {/* Round M / S / R Buttons */}
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateTrack(track.id, { muted: !track.muted });
                }}
                className={`w-7 h-7 rounded-full border-2 border-[#333333] text-[10px] font-bold transition-colors ${
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
                className={`w-7 h-7 rounded-full border-2 border-[#333333] text-[10px] font-bold transition-colors ${
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
                className={`w-7 h-7 rounded-full border-2 border-[#333333] flex items-center justify-center transition-colors ${
                  track.armed
                    ? 'bg-[#7B61FF] text-white'
                    : 'bg-white text-[#333333] hover:bg-[#FFD6E8]'
                }`}
              >
                <Mic className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Master Bus */}
      <div className="w-64 shrink-0 rounded-2xl border-2 border-[#333333] shadow-[4px_4px_0_#333333] bg-white p-3.5 flex flex-col justify-between gap-3 ml-auto">
        <div className="flex items-center justify-between border-b border-[#333333]/15 pb-1.5">
          <span className="text-xs font-extrabold text-[#333333]">MASTER BUS</span>
          <span className="font-mono-num text-[11px] font-bold text-[#7B61FF]">
            {toDbLabel(masterVolume)} dB
          </span>
        </div>

        <canvas
          ref={spectrumCanvasRef}
          width={210}
          height={92}
          className="w-full h-[92px] bg-[#FFFDF0] border-2 border-[#333333] rounded-xl"
        />

        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <span className="text-[10px] font-mono-num font-bold uppercase text-[#777777]">
              Output Level
            </span>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.01}
              value={masterVolume}
              onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
          <div className="w-3 h-12 bg-[#EEECE0] border border-[#333333] rounded-full overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                masterPeak > 0.9 ? 'bg-red-500' : masterPeak > 0.7 ? 'bg-[#7B61FF]' : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, Math.round(masterPeak * 120))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
