import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudOff,
  GraduationCap,
  Loader2,
  Lock,
  Search,
  Send,
} from 'lucide-react';
import {
  NEP_CATEGORIES,
  NepCategoryKey,
  PublicNepSelectionFormPayload,
  SubjectUpdateItem,
  SubjectUpdateNepStudentSelection,
} from '../types';
import {
  fetchPublicSelectionForm,
  savePublicStudentSelection,
  submitPublicSelectionForm,
} from '../services/subjectUpdateSystemService';
import { usePortalTheme } from '../lib/themeManager';
import { PortalThemeSelector } from './PortalThemeSelector';

interface PublicNepSelectionFormProps {
  token: string;
  onExit?: () => void;
}

type SyncState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

export const PublicNepSelectionForm: React.FC<PublicNepSelectionFormProps> = ({ token, onExit }) => {
  usePortalTheme('staff');
  const [payload, setPayload] = useState<PublicNepSelectionFormPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [syncState, setSyncState] = useState<SyncState>('IDLE');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [savingStudentIds, setSavingStudentIds] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadForm = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPublicSelectionForm(token);
      setPayload(data);
      setSyncState('SAVED');
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load Department Subject Selection Form.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const subjectById = useMemo(() => {
    const map = new Map<string, SubjectUpdateItem>();
    if (!payload) return map;
    NEP_CATEGORIES.forEach((cat) => {
      (payload.subjectsByCategory[cat] || []).forEach((s) => map.set(s.id, s));
    });
    return map;
  }, [payload]);

  const majorOptions = useMemo(() => {
    if (!payload) return [];
    const allowedSet = new Set(payload.nepConfig.allowedMajorIds || []);
    const allMajors = payload.subjectsByCategory.MAJOR || [];
    if (allowedSet.size === 0) return [];
    return allMajors.filter((s) => allowedSet.has(s.id));
  }, [payload]);

  const getMicOptionsForMajor = useCallback(
    (majorId?: string): SubjectUpdateItem[] => {
      if (!payload || !majorId) return [];
      const allowedMicIds = new Set(payload.nepConfig.majorToMicMap?.[majorId] || []);
      if (allowedMicIds.size === 0) return [];
      const allMics = payload.subjectsByCategory.MIC || [];
      const filtered = allMics.filter((s) => allowedMicIds.has(s.id));
      // Fallback via subjectById in case MIC subject was cross-listed
      if (filtered.length < allowedMicIds.size) {
        const seen = new Set(filtered.map((f) => f.id));
        allowedMicIds.forEach((id) => {
          if (!seen.has(id)) {
            const sub = subjectById.get(id);
            if (sub) filtered.push(sub);
          }
        });
      }
      return filtered;
    },
    [payload, subjectById]
  );

  const getPoolOptions = useCallback(
    (cat: Exclude<NepCategoryKey, 'MAJOR' | 'MIC'>): SubjectUpdateItem[] => {
      if (!payload) return [];
      const ruleIds = new Set(payload.nepConfig.categoryRules?.[cat]?.subjectIds || []);
      if (ruleIds.size === 0) return [];
      const all = payload.subjectsByCategory[cat] || [];
      return all.filter((s) => ruleIds.has(s.id));
    },
    [payload]
  );

  const filteredStudents = useMemo(() => {
    if (!payload) return [];
    const q = searchQuery.trim().toLowerCase();
    return payload.students.filter((st) => {
      if (statusFilter === 'PENDING' && st.isComplete) return false;
      if (statusFilter === 'COMPLETED' && !st.isComplete) return false;
      if (!q) return true;
      return (
        (st.applicationNo || '').toLowerCase().includes(q) ||
        st.studentName.toLowerCase().includes(q) ||
        (st.rollNumber || '').toLowerCase().includes(q)
      );
    });
  }, [payload, searchQuery, statusFilter]);

  const handleStudentChange = async (
    student: SubjectUpdateNepStudentSelection,
    patch: Partial<{
      majorIds: string[];
      micIds: string[];
      mdcIds: string[];
      aecIds: string[];
      secIds: string[];
      vacIds: string[];
    }>
  ) => {
    if (!payload || payload.form.isLocked) return;

    const nextMajorIds = patch.majorIds !== undefined ? patch.majorIds : student.majorIds;
    let nextMicIds = patch.micIds !== undefined ? patch.micIds : student.micIds;

    // Auto-clear invalid MIC immediately on client when Major changes
    if (patch.majorIds !== undefined) {
      const selectedMajorId = nextMajorIds[0] || '';
      const validMicSet = new Set(
        selectedMajorId ? payload.nepConfig.majorToMicMap?.[selectedMajorId] || [] : []
      );
      nextMicIds = nextMicIds.filter((id) => validMicSet.has(id));
    }

    const nextRow: SubjectUpdateNepStudentSelection = {
      ...student,
      ...patch,
      majorIds: nextMajorIds,
      micIds: nextMicIds,
    };

    // Optimistic local state update
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            students: prev.students.map((s) => (s.studentId === student.studentId ? nextRow : s)),
          }
        : prev
    );

    setSyncState('SAVING');
    setSyncError(null);
    setSavingStudentIds((prev) => ({ ...prev, [student.studentId]: true }));

    try {
      const res = await savePublicStudentSelection(token, student.studentId, {
        majorIds: nextRow.majorIds,
        micIds: nextRow.micIds,
        mdcIds: nextRow.mdcIds,
        aecIds: nextRow.aecIds,
        secIds: nextRow.secIds,
        vacIds: nextRow.vacIds,
      });

      setPayload((prev) =>
        prev
          ? {
              ...prev,
              form: res.formSummary,
              students: prev.students.map((s) =>
                s.studentId === student.studentId ? res.studentSelection : s
              ),
            }
          : prev
      );
      setSyncState('SAVED');
    } catch (err: any) {
      setSyncState('ERROR');
      setSyncError(err?.message || 'Failed to save selection to cloud.');
      if (String(err?.message || '').startsWith('LOCKED:')) {
        await loadForm();
      }
    } finally {
      setSavingStudentIds((prev) => {
        const next = { ...prev };
        delete next[student.studentId];
        return next;
      });
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await submitPublicSelectionForm(token);
      setPayload(updated);
      setConfirmSubmitOpen(false);
      setSubmitSuccess('Subject selections finalized and locked successfully.');
      setSyncState('SAVED');
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to finalize submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategoryCell = (
    student: SubjectUpdateNepStudentSelection,
    cat: NepCategoryKey,
    options: SubjectUpdateItem[],
    selectedIds: string[],
    fieldKey: 'majorIds' | 'micIds' | 'mdcIds' | 'aecIds' | 'secIds' | 'vacIds',
    placeholderText: string
  ) => {
    if (!payload) return null;
    const rule = payload.nepConfig.categoryRules[cat];
    const isLocked = payload.form.isLocked;
    const maxSelect = rule?.maxSelect ?? 1;

    if (maxSelect <= 1) {
      const currentVal = selectedIds[0] || '';
      return (
        <select
          disabled={isLocked || options.length === 0}
          value={currentVal}
          onChange={(e) => {
            const val = e.target.value;
            handleStudentChange(student, { [fieldKey]: val ? [val] : [] });
          }}
          className={`w-full min-w-[165px] px-2.5 py-2 rounded-lg border text-xs transition ${
            isLocked
              ? 'bg-slate-900/60 border-slate-800 text-slate-400 cursor-not-allowed'
              : currentVal
                ? 'bg-slate-950 border-slate-700 text-slate-100 focus:border-blue-500 focus:outline-none'
                : rule?.required
                  ? 'bg-slate-950 border-amber-500/40 text-slate-300 focus:border-blue-500 focus:outline-none'
                  : 'bg-slate-950 border-slate-800 text-slate-400 focus:border-blue-500 focus:outline-none'
          }`}
        >
          <option value="">{options.length === 0 ? placeholderText : `-- Select ${cat} --`}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.subjectCode} - {opt.subjectName}
            </option>
          ))}
        </select>
      );
    }

    // Multi-select checkboxes when Admin configured maxSelect > 1
    return (
      <div className="min-w-[180px] space-y-1 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-slate-950 border border-slate-800">
        {options.length === 0 ? (
          <span className="text-[11px] text-slate-500">{placeholderText}</span>
        ) : (
          options.map((opt) => {
            const checked = selectedIds.includes(opt.id);
            const atLimit = !checked && selectedIds.length >= maxSelect;
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-1.5 text-[11px] ${
                  isLocked || atLimit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer text-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={isLocked || atLimit}
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selectedIds.filter((id) => id !== opt.id)
                      : [...selectedIds, opt.id];
                    handleStudentChange(student, { [fieldKey]: next });
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600"
                />
                <span className="truncate">
                  {opt.subjectCode} - {opt.subjectName}
                </span>
              </label>
            );
          })
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        <p className="text-sm text-slate-300">Loading Department NEP Subject Selection Form...</p>
      </div>
    );
  }

  if (loadError || !payload) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-base font-semibold">Selection Form Unavailable</h2>
          <p className="text-xs text-slate-400">{loadError || 'This link could not be verified.'}</p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  const { form, nepConfig } = payload;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* Top Institutional & Form Metadata Banner */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {form.institutionName || 'NGM Degree Mahavidyalaya'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  NEP Subject Selection Form · {form.title}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <PortalThemeSelector scope="staff" compact />

              {/* Real-time Cloud Sync Indicator */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                  syncState === 'SAVING'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : syncState === 'ERROR'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {syncState === 'SAVING' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : syncState === 'ERROR' ? (
                  <CloudOff className="w-3.5 h-3.5" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span>
                  {syncState === 'SAVING'
                    ? 'Saving to Cloud...'
                    : syncState === 'ERROR'
                      ? 'Save Error'
                      : 'Saved to Cloud'}
                </span>
              </div>

              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Exit
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Academic Session</div>
              <div className="font-mono font-semibold text-slate-100 mt-0.5">{form.session}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Semester</div>
              <div className="font-semibold text-slate-100 mt-0.5">{form.semester}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Department</div>
              <div className="font-semibold text-slate-100 mt-0.5">{form.departmentName}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Department In-Charge</div>
              <div className="font-semibold text-slate-100 mt-0.5">{form.inChargeStaffName}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Progress</div>
              <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                <span className="text-emerald-400">{form.completedCount}</span> / {form.totalStudents}{' '}
                <span className="text-[11px] font-normal text-amber-400">({form.pendingCount} left)</span>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Deadline</div>
              <div className="font-mono font-semibold text-slate-100 mt-0.5">{form.deadline}</div>
            </div>
          </div>
        </header>

        {/* Locked / Submitted Banner */}
        {form.isLocked && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Final Submitted &amp; Locked</strong>
                {form.submittedAt ? ` on ${new Date(form.submittedAt).toLocaleString('en-IN')}` : ''}. All
                selections are read-only unless reopened by Admin.
              </span>
            </div>
          </div>
        )}

        {/* Alerts */}
        {syncError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}
        {submitSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {/* Filter Bar + Final Submit Action */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search application no. or student name..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'COMPLETED')}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
            >
              <option value="ALL">All Students ({form.totalStudents})</option>
              <option value="PENDING">Pending ({form.pendingCount})</option>
              <option value="COMPLETED">Completed ({form.completedCount})</option>
            </select>
          </div>

          {!form.isLocked && (
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setConfirmSubmitOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Final Submit Selections
            </button>
          )}
        </div>

        {/* Student Selection Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-3 font-semibold">Application No.</th>
                  <th className="px-3 py-3 font-semibold">Student Name</th>
                  {NEP_CATEGORIES.map((cat) => {
                    const required = nepConfig.categoryRules[cat]?.required;
                    return (
                      <th key={cat} className="px-3 py-3 font-semibold">
                        <span>{cat}</span>
                        <span
                          className={`ml-1 text-[10px] font-normal ${
                            required ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        >
                          {required ? '*' : '(Opt)'}
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                      No matching students in this selection form.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const selectedMajorId = st.majorIds?.[0] || '';
                    const micOptions = getMicOptionsForMajor(selectedMajorId);
                    const isSavingRow = Boolean(savingStudentIds[st.studentId]);

                    return (
                      <tr key={st.studentId} className="hover:bg-slate-800/20 transition">
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-200 whitespace-nowrap">
                          {st.applicationNo || st.rollNumber}
                        </td>
                        <td className="px-3 py-2.5 text-slate-100 font-medium whitespace-nowrap">
                          {st.studentName}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'MAJOR',
                            majorOptions,
                            st.majorIds || [],
                            'majorIds',
                            'No Major configured'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'MIC',
                            micOptions,
                            st.micIds || [],
                            'micIds',
                            selectedMajorId ? 'No MIC mapped' : 'Select Major first'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'MDC',
                            getPoolOptions('MDC'),
                            st.mdcIds || [],
                            'mdcIds',
                            'No MDC configured'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'AEC',
                            getPoolOptions('AEC'),
                            st.aecIds || [],
                            'aecIds',
                            'No AEC configured'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'SEC',
                            getPoolOptions('SEC'),
                            st.secIds || [],
                            'secIds',
                            'No SEC configured'
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderCategoryCell(
                            st,
                            'VAC',
                            getPoolOptions('VAC'),
                            st.vacIds || [],
                            'vacIds',
                            'Optional / None'
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {isSavingRow ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400 inline" />
                          ) : st.isComplete ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              Done
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[11px]">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Final Submission Confirmation Modal */}
      {confirmSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Confirm Final Submission</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are about to submit NEP subject selections for{' '}
              <strong className="text-slate-200">{form.departmentName}</strong> ({form.session} ·{' '}
              {form.semester}). Once submitted, all selections are locked and only Admin can reopen them.
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-500">Total</div>
                <div className="font-mono font-bold text-slate-100">{form.totalStudents}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Completed</div>
                <div className="font-mono font-bold text-emerald-400">{form.completedCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Pending</div>
                <div className="font-mono font-bold text-amber-400">{form.pendingCount}</div>
              </div>
            </div>

            {submitError && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit &amp; Lock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
