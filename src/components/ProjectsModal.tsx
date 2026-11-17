import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus, Trash2, Upload, X } from 'lucide-react';
import { PROJECT_TEMPLATES, ProjectTemplateInfo } from '../data/presets';
import { deleteProjectFromDb, listProjectsFromDb } from '../storage/projectStorage';
import { Project } from '../types/daw';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  onSelectProject: (project: Project) => void;
  onLoadTemplate: (template: ProjectTemplateInfo) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onLoadTemplate,
}) => {
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const list = await listProjectsFromDb();
    setSavedProjects(list);
  };

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Project;
      if (parsed && Array.isArray(parsed.tracks) && Array.isArray(parsed.clips)) {
        onSelectProject({ ...parsed, id: `proj_${Date.now()}` });
        onClose();
      }
    } catch {
      // ignore invalid JSON
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#333333]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#FFFDF0] border-2 border-[#333333] shadow-[8px_8px_0_#333333] rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 bg-white border-b-2 border-[#333333] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-5 h-5 text-[#7B61FF]" />
            <h2 className="text-base font-extrabold text-[#333333]">פרויקטים שמורים ותבניות</h2>
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
          {/* Import JSON Backup */}
          <div className="flex items-center justify-between bg-white border-2 border-[#333333] shadow-[4px_4px_0_#333333] rounded-2xl p-3.5">
            <span className="text-xs font-bold text-[#333333]">
              ייבא קובץ פרויקט שמור (<span className="font-mono-num">.harmonia.json</span>)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-full border-2 border-[#333333] bg-[#D6E4FF] hover:bg-[#7B61FF] hover:text-white text-xs font-bold text-[#333333] flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>טען קובץ</span>
            </button>
          </div>

          {/* Saved in Browser IndexedDB */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#333333]">פרויקטים שמורים אוטומטית</h3>
            {savedProjects.length === 0 ? (
              <p className="text-xs text-[#666666]">אין עדיין פרויקטים נוספים שמורים.</p>
            ) : (
              <div className="divide-y divide-[#333333]/15 border-2 border-[#333333] rounded-2xl bg-white overflow-hidden">
                {savedProjects.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#333333]">
                        {p.name}{' '}
                        {p.id === currentProjectId && (
                          <span className="text-[#7B61FF] text-[10px]">(פעיל כעת)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#777777] font-mono-num">
                        {p.bpm} BPM · {p.tracks.length} ערוצים ·{' '}
                        {new Date(p.updatedAt || Date.now()).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(p);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 rounded-full border-2 border-[#333333] bg-[#FFD6E8] hover:bg-[#7B61FF] hover:text-white text-xs font-bold text-[#333333] transition-colors"
                      >
                        פתח
                      </button>
                      {p.id !== currentProjectId && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteProjectFromDb(p.id);
                            void refresh();
                          }}
                          className="p-1.5 rounded-full hover:bg-[#FFD6E8] text-[#777777] hover:text-red-600"
                          title="מחק פרויקט"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Starter Templates */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#333333]">התחל מתבנית סגנון חדשה</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onLoadTemplate(tpl);
                    onClose();
                  }}
                  className="text-right p-3.5 rounded-2xl bg-white hover:bg-[#D6E4FF] border-2 border-[#333333] shadow-[3px_3px_0_#333333] transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#333333]">{tpl.name}</span>
                    <Plus className="w-3.5 h-3.5 text-[#7B61FF] shrink-0" />
                  </div>
                  <div className="text-[11px] text-[#777777] font-mono-num">{tpl.genre}</div>
                  <p className="text-[11px] text-[#555555]">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
