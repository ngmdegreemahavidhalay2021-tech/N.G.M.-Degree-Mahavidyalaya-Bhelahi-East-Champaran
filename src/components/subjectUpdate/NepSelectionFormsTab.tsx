import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  SubjectUpdateItem,
  SubjectUpdateSelectionForm,
} from '../../types';
import { reopenSubjectUpdateSelectionForm } from '../../services/subjectUpdateSystemService';

interface NepSelectionFormsTabProps {
  selectionForms: SubjectUpdateSelectionForm[];
  subjects: SubjectUpdateItem[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onOpenSelectionFormPreview: (token: string) => void;
}

export const NepSelectionFormsTab: React.FC<NepSelectionFormsTabProps> = ({
  selectionForms,
  subjects,
  onRefresh,
  onToast,
  onOpenSelectionFormPreview,
}) => {
  const [inspectForm, setInspectForm] = useState<SubjectUpdateSelectionForm | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const subjectMap = useMemo(() => {
    const map = new Map<string, SubjectUpdateItem>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const formatSubjects = (ids: string[] | undefined) => {
    if (!ids || ids.length === 0) return '—';
    return ids
      .map((id) => {
        const s = subjectMap.get(id);
        return s ? `${s.subjectCode} - ${s.subjectName}` : id;
      })
      .join(', ');
  };

  const handleExportExcel = (form: SubjectUpdateSelectionForm) => {
    const rows = form.studentIds.map((sid, idx) => {
      const sel = form.selections?.[sid];
      return {
        'S.No': idx + 1,
        'Application Number': sel?.applicationNo || sel?.rollNumber || '',
        'Roll Number': sel?.rollNumber || '',
        'Student Name': sel?.studentName || '',
        Department: sel?.departmentName || form.departmentName,
        Session: form.session,
        Semester: form.semester,
        MAJOR: formatSubjects(sel?.majorIds),
        MIC: formatSubjects(sel?.micIds),
        MDC: formatSubjects(sel?.mdcIds),
        AEC: formatSubjects(sel?.aecIds),
        SEC: formatSubjects(sel?.secIds),
        VAC: formatSubjects(sel?.vacIds),
        'Completion Status': sel?.isComplete ? 'Completed' : 'Pending',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NEP Selections');
    const safeDept = form.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `NEP_Selections_${safeDept}_${form.session}.xlsx`);
    onToast('success', `Exported Excel report for ${form.departmentName}.`);
  };

  const handleReopen = async (form: SubjectUpdateSelectionForm) => {
    setReopeningId(form.id);
    try {
      await reopenSubjectUpdateSelectionForm(form.id);
      await onRefresh();
      onToast('success', `Reopened "${form.departmentName} (${form.inChargeStaffName})" for edits.`);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to reopen selection form.');
    } finally {
      setReopeningId(null);
    }
  };

  const handleCopy = async (token: string, inCharge: string) => {
    try {
      const url = `${window.location.origin}/?selectionToken=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(url);
      onToast('success', `Copied secure link for ${inCharge}.`);
    } catch {
      onToast('error', 'Could not copy link.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-100">Selection Forms Summary</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Track Department In-charge submission status, inspect selections, export Excel reports, or reopen locked forms.
        </p>
      </div>

      {/* Essential Columns ONLY Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">In-charge Name</th>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold text-right">Total Students</th>
                <th className="px-4 py-3 font-semibold text-right">Completed</th>
                <th className="px-4 py-3 font-semibold text-right">Pending</th>
                <th className="px-4 py-3 font-semibold">Submission Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {selectionForms.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No Selection Forms assigned yet. Create one in "Staff &amp; Assignment".
                  </td>
                </tr>
              ) : (
                selectionForms.map((form) => (
                  <tr key={form.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-slate-100">{form.departmentName}</td>
                    <td className="px-4 py-3 text-slate-200">{form.inChargeStaffName}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-300">{form.session}</td>
                    <td className="px-4 py-3 text-slate-300">{form.semester}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                      {form.totalStudents}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-400">
                      {form.completedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-400">
                      {form.pendingCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium border ${
                          form.isLocked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : form.status === 'IN_PROGRESS'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                        }`}
                      >
                        {form.isLocked ? 'SUBMITTED' : form.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectForm(form)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="View Student Selections"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportExcel(form)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 cursor-pointer"
                          title="Export Excel (.xlsx)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(form.token, form.inChargeStaffName)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          title="Copy Link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSelectionFormPreview(form.token)}
                          className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 cursor-pointer"
                          title="Open In-Charge Form"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        {form.isLocked && (
                          <button
                            type="button"
                            onClick={() => handleReopen(form)}
                            disabled={reopeningId === form.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium cursor-pointer disabled:opacity-50"
                            title="Reopen for Editing"
                          >
                            {reopeningId === form.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            Reopen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Student Selections Modal */}
      {inspectForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {inspectForm.departmentName} · Student NEP Subject Selections
                </h3>
                <p className="text-xs text-slate-400">
                  In-charge: {inspectForm.inChargeStaffName} · {inspectForm.session} ({inspectForm.semester}) ·{' '}
                  {inspectForm.completedCount}/{inspectForm.totalStudents} Completed
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportExcel(inspectForm)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => setInspectForm(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-auto border border-slate-800 rounded-xl flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">Application No.</th>
                    <th className="px-3 py-2.5">Student Name</th>
                    <th className="px-3 py-2.5">MAJOR</th>
                    <th className="px-3 py-2.5">MIC</th>
                    <th className="px-3 py-2.5">MDC</th>
                    <th className="px-3 py-2.5">AEC</th>
                    <th className="px-3 py-2.5">SEC</th>
                    <th className="px-3 py-2.5">VAC</th>
                    <th className="px-3 py-2.5">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {inspectForm.studentIds.map((sid) => {
                    const sel = inspectForm.selections?.[sid];
                    return (
                      <tr key={sid}>
                        <td className="px-3 py-2 font-mono text-slate-300 whitespace-nowrap">
                          {sel?.applicationNo || sel?.rollNumber || '—'}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-100 whitespace-nowrap">
                          {sel?.studentName || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.majorIds)}</td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.micIds)}</td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.mdcIds)}</td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.aecIds)}</td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.secIds)}</td>
                        <td className="px-3 py-2 text-slate-300">{formatSubjects(sel?.vacIds)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              sel?.isComplete
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {sel?.isComplete ? 'Done' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
