import React, { useState } from 'react';
import { CheckCircle2, Download, FileAudio, Loader2, Music, X } from 'lucide-react';
import { dawEngine } from '../audio/dawEngine';
import {
  encodeAiff,
  encodeStandardMidi,
  encodeWav,
  encodeWebmOpus,
  triggerDownload,
} from '../audio/exportUtils';
import { ExportAudioFormat, Project } from '../types/daw';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

const FORMAT_OPTIONS: Array<{
  id: ExportAudioFormat;
  title: string;
  ext: string;
  desc: string;
}> = [
  {
    id: 'wav24',
    title: 'WAV Master 24-bit / 44.1kHz',
    ext: '.wav',
    desc: 'איכות מאסטרינג אולפנית לא דחוסה (Lossless PCM).',
  },
  {
    id: 'wav16',
    title: 'WAV CD Standard 16-bit / 44.1kHz',
    ext: '.wav',
    desc: 'תואם מלא לכל נגני המדיה, מערכות סאונד ועורכי וידאו.',
  },
  {
    id: 'aiff16',
    title: 'AIFF Studio 16-bit',
    ext: '.aiff',
    desc: 'פורמט אולפני תקני ל-Logic Pro, Pro Tools ו-MacOS.',
  },
  {
    id: 'webm_opus',
    title: 'WebM / Opus דחוס (192kbps)',
    ext: '.webm',
    desc: 'קובץ קל לשיתוף מהיר ברשת ובמובייל באיכות גבוהה.',
  },
  {
    id: 'midi',
    title: 'Standard MIDI File (SMF Type 1)',
    ext: '.mid',
    desc: 'ייצוא כל ערוצי ה-MIDI, התווים והקצב לתוכנות DAW חיצוניות.',
  },
  {
    id: 'stems_wav',
    title: 'ייצוא ערוצים נפרדים (Stems WAV)',
    ext: '.wav × N',
    desc: 'מרנדר כל ערוץ פתוח לקובץ WAV נפרד למיקס חיצוני.',
  },
  {
    id: 'project_json',
    title: 'גיבוי פרויקט מלא (Harmonia Project)',
    ext: '.harmonia.json',
    desc: 'שומר את כל הערוצים, התווים והפלאגינים לטעינה חוזרת.',
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportAudioFormat>('wav24');
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progressText, setProgressText] = useState('');

  if (!isOpen) return null;

  const safeFileBase = project.name.replace(/[^\w\u0590-\u05FF-]+/g, '_') || 'harmonia_mix';

  const handleExport = async () => {
    setStatus('rendering');
    setProgressText('מאתחל מנוע רינדור אולפני...');
    try {
      if (selectedFormat === 'midi') {
        const midiBlob = encodeStandardMidi(project);
        triggerDownload(midiBlob, `${safeFileBase}.mid`);
        setStatus('done');
        setProgressText('קובץ ה-MIDI יוצא בהצלחה.');
        return;
      }

      if (selectedFormat === 'project_json') {
        const jsonBlob = new Blob([JSON.stringify(project, null, 2)], {
          type: 'application/json',
        });
        triggerDownload(jsonBlob, `${safeFileBase}.harmonia.json`);
        setStatus('done');
        setProgressText('קובץ הפרויקט נשמר בהצלחה.');
        return;
      }

      if (selectedFormat === 'stems_wav') {
        const activeTracks = project.tracks.filter((t) => !t.muted);
        for (let i = 0; i < activeTracks.length; i++) {
          const tr = activeTracks[i];
          setProgressText(`מרנדר ערוץ ${i + 1}/${activeTracks.length}: ${tr.name}...`);
          const buf = await dawEngine.renderOfflineMix(project, tr.id);
          const wav = encodeWav(buf, 16);
          const trSafe = tr.name.replace(/[^\w\u0590-\u05FF-]+/g, '_');
          triggerDownload(wav, `${safeFileBase}_STEM_${trSafe}.wav`);
        }
        setStatus('done');
        setProgressText(`יוצאו ${activeTracks.length} ערוצי Stems בהצלחה.`);
        return;
      }

      setProgressText('מרנדר מיקס מלא ב-OfflineAudioContext...');
      const mixBuffer = await dawEngine.renderOfflineMix(project);

      if (selectedFormat === 'wav16') {
        triggerDownload(encodeWav(mixBuffer, 16), `${safeFileBase}_16bit.wav`);
      } else if (selectedFormat === 'wav24') {
        triggerDownload(encodeWav(mixBuffer, 24), `${safeFileBase}_24bit.wav`);
      } else if (selectedFormat === 'aiff16') {
        triggerDownload(encodeAiff(mixBuffer), `${safeFileBase}.aiff`);
      } else if (selectedFormat === 'webm_opus') {
        setProgressText('מקודד זרם Opus...');
        const webmBlob = await encodeWebmOpus(mixBuffer);
        triggerDownload(webmBlob, `${safeFileBase}.webm`);
      }

      setStatus('done');
      setProgressText('הייצוא הושלם והקובץ הורד למחשב.');
    } catch (err) {
      setStatus('error');
      setProgressText(err instanceof Error ? err.message : 'שגיאה ברינדור הייצוא');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#333333]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#FFFDF0] border-2 border-[#333333] shadow-[8px_8px_0_#333333] rounded-3xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-6 py-4 bg-white border-b-2 border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileAudio className="w-5 h-5 text-[#7B61FF]" />
            <div>
              <h2 className="text-base font-extrabold text-[#333333]">ייצוא מיקס וקבצי פרויקט</h2>
              <p className="text-xs text-[#666666]">
                רינדור ישיר מתוך מנוע האודיו · {project.bpm} BPM · {project.tracks.length} ערוצים
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

        <div className="p-5 overflow-y-auto space-y-2.5">
          {FORMAT_OPTIONS.map((opt) => {
            const active = selectedFormat === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedFormat(opt.id);
                  setStatus('idle');
                }}
                className={`w-full text-right p-3.5 rounded-2xl border-2 border-[#333333] transition-all flex items-center justify-between gap-3 ${
                  active
                    ? 'bg-[#D6E4FF] shadow-[4px_4px_0_#333333]'
                    : 'bg-white hover:bg-[#FAF8EC]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#333333]">{opt.title}</div>
                  <div className="text-[11px] text-[#666666]">{opt.desc}</div>
                </div>
                <span className="font-mono-num text-xs font-bold text-[#7B61FF] shrink-0">
                  {opt.ext}
                </span>
              </button>
            );
          })}

          {status !== 'idle' && (
            <div
              className={`mt-3 p-3.5 rounded-2xl border-2 border-[#333333] text-xs font-bold flex items-center gap-2 ${
                status === 'error'
                  ? 'bg-[#FFD6E8] text-red-700'
                  : status === 'done'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-[#D6E4FF] text-[#333333]'
              }`}
            >
              {status === 'rendering' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {status === 'done' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {status === 'error' && <Music className="w-4 h-4 shrink-0" />}
              <span>{progressText}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t-2 border-[#333333] bg-white flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border-2 border-[#333333] bg-white hover:bg-[#EEECE0] text-xs font-bold text-[#333333]"
          >
            סגור
          </button>
          <button
            type="button"
            disabled={status === 'rendering'}
            onClick={handleExport}
            className="px-5 py-2 rounded-full border-2 border-[#333333] shadow-[3px_3px_0_#333333] bg-[#333333] hover:bg-[#7B61FF] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{status === 'rendering' ? 'מייצא...' : 'התחל ייצוא'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
