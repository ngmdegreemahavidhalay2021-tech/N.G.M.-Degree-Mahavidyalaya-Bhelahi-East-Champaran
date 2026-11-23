import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookCheck,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  GitFork,
  GraduationCap,
  Loader2,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AdminProfile,
  SubjectUpdateItem,
  SubjectUpdateSelectionForm,
  SubjectUpdateStaff,
  SubjectUpdateStudent,
  SubjectUpdateSystemState,
} from '../types';
import {
  deleteSubjectUpdateItem,
  deleteSubjectUpdateSelectionForm,
  deleteSubjectUpdateStaffMember,
  deleteSubjectUpdateStudent,
  fetchSubjectUpdateSystemState,
} from '../services/subjectUpdateSystemService';
import { NepSubjectsTab } from './subjectUpdate/NepSubjectsTab';
import { NepCombinationsTab } from './subjectUpdate/NepCombinationsTab';
import { NepStudentsTab } from './subjectUpdate/NepStudentsTab';
import { NepStaffAssignmentTab } from './subjectUpdate/NepStaffAssignmentTab';
import { NepSelectionFormsTab } from './subjectUpdate/NepSelectionFormsTab';
import { PublicNepSelectionForm } from './PublicNepSelectionForm';

type NepMainOption =
  | 'subjects'
  | 'nep-combinations'
  | 'students'
  | 'staff-assignment'
  | 'selection-forms';

interface SubjectUpdateModuleProps {
  admin: AdminProfile;
}

interface DeleteTarget {
  type: 'subject' | 'student' | 'staff' | 'selection-form';
  id: string;
  label: string;
}

const MAIN_OPTIONS: Array<{
  id: NepMainOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'subjects', label: 'Subjects', icon: BookCheck },
  { id: 'nep-combinations', label: 'NEP Combinations', icon: GitFork },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'staff-assignment', label: 'Staff & Assignment', icon: UserCheck },
  { id: 'selection-forms', label: 'Selection Forms', icon: ClipboardList },
];

export const SubjectUpdateModule: React.FC<SubjectUpdateModuleProps> = ({ admin }) => {
  const [activeOption, setActiveOption] = useState<NepMainOption>('subjects');
  const [systemState, setSystemState] = useState<SubjectUpdateSystemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // In-app preview of tokenized In-Charge selection form (avoids window.open inside iFrame)
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
  }, []);

  const loadState = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const state = await fetchSubjectUpdateSystemState();
        setSystemState(state);
      } catch (err: any) {
        showToast('error', err?.message || 'Unable to load SUBJECT UPDATE data.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadState(false);
  }, [loadState]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'subject') await deleteSubjectUpdateItem(deleteTarget.id);
      if (deleteTarget.type === 'student') await deleteSubjectUpdateStudent(deleteTarget.id);
      if (deleteTarget.type === 'staff') await deleteSubjectUpdateStaffMember(deleteTarget.id);
      if (deleteTarget.type === 'selection-form') {
        await deleteSubjectUpdateSelectionForm(deleteTarget.id);
      }
      showToast('success', `Deleted "${deleteTarget.label}".`);
      setDeleteTarget(null);
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  if (previewToken) {
    return (
      <PublicNepSelectionForm
        token={previewToken}
        onExit={() => {
          setPreviewToken(null);
          loadState(true);
        }}
      />
    );
  }

  if (loading && !systemState) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        <p className="text-sm font-medium">Loading SUBJECT UPDATE...</p>
      </div>
    );
  }

  const subjects = systemState?.subjects || [];
  const sessions = systemState?.sessions || [];
  const semesters = systemState?.semesters || [];
  const departments = systemState?.departments || [];
  const students = systemState?.students || [];
  const staffMembers = systemState?.staff || [];
  const nepConfigs = systemState?.nepConfigs || [];
  const selectionForms = systemState?.selectionForms || [];

  const getOptionCount = (id: NepMainOption): number => {
    if (id === 'subjects') return subjects.length;
    if (id === 'nep-combinations') return nepConfigs.length;
    if (id === 'students') return students.length;
    if (id === 'staff-assignment') return staffMembers.length;
    if (id === 'selection-forms') return selectionForms.length;
    return 0;
  };

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">SUBJECT UPDATE</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              NGM Degree Mahavidyalaya · NEP Subject Combination &amp; Student Selection System ({admin.username})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadState(false)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Minimal 5-Option Navigation Bar */}
      <nav className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-wrap gap-1.5">
        {MAIN_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeOption === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActiveOption(opt.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{opt.label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {getOptionCount(opt.id)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Status Notification */}
      {banner && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs ${
            banner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-lg hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Subjects */}
      {activeOption === 'subjects' && (
        <NepSubjectsTab
          subjects={subjects}
          sessions={sessions}
          semesters={semesters}
          departments={departments}
          onRefresh={() => loadState(true)}
          onToast={showToast}
          onRequestDeleteSubject={(s: SubjectUpdateItem) =>
            setDeleteTarget({
              type: 'subject',
              id: s.id,
              label: `${s.subjectCode} · ${s.subjectName}`,
            })
          }
        />
      )}

      {/* 2. NEP Combinations */}
      {activeOption === 'nep-combinations' && (
        <NepCombinationsTab
          subjects={subjects}
          sessions={sessions}
          semesters={semesters}
          nepConfigs={nepConfigs}
          onRefresh={() => loadState(true)}
          onToast={showToast}
        />
      )}

      {/* 3. Students */}
      {activeOption === 'students' && (
        <NepStudentsTab
          students={students}
          sessions={sessions}
          semesters={semesters}
          departments={departments}
          onRefresh={() => loadState(true)}
          onToast={showToast}
          onRequestDeleteStudent={(s: SubjectUpdateStudent) =>
            setDeleteTarget({
              type: 'student',
              id: s.id,
              label: `${s.applicationNo || s.rollNumber} · ${s.studentName}`,
            })
          }
        />
      )}

      {/* 4. Staff & Assignment */}
      {activeOption === 'staff-assignment' && (
        <NepStaffAssignmentTab
          staffMembers={staffMembers}
          students={students}
          sessions={sessions}
          semesters={semesters}
          departments={departments}
          selectionForms={selectionForms}
          onRefresh={() => loadState(true)}
          onToast={showToast}
          onRequestDeleteStaff={(st: SubjectUpdateStaff) =>
            setDeleteTarget({
              type: 'staff',
              id: st.id,
              label: `${st.staffCode} · ${st.fullName}`,
            })
          }
          onRequestDeleteSelectionForm={(f: SubjectUpdateSelectionForm) =>
            setDeleteTarget({
              type: 'selection-form',
              id: f.id,
              label: `${f.departmentName} (${f.inChargeStaffName})`,
            })
          }
          onOpenSelectionFormPreview={(token) => setPreviewToken(token)}
        />
      )}

      {/* 5. Selection Forms */}
      {activeOption === 'selection-forms' && (
        <NepSelectionFormsTab
          selectionForms={selectionForms}
          subjects={subjects}
          onRefresh={() => loadState(true)}
          onToast={showToast}
          onOpenSelectionFormPreview={(token) => setPreviewToken(token)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Confirm Deletion</h3>
            <p className="text-xs text-slate-400">
              Permanently delete <strong className="text-slate-100">{deleteTarget.label}</strong>? This
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
