import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Save, Search, Trash2, UserCheck, X } from 'lucide-react';
import {
  SubjectUpdateAssignmentTargetType,
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStaff,
  SubjectUpdateStaffAssignment,
  SubjectUpdateStudentGroup,
} from '../../types';
import {
  createSubjectUpdateStaffAssignment,
  StaffAssignmentPayload,
  updateSubjectUpdateStaffAssignment,
} from '../../services/subjectUpdateSystemService';

interface StaffAssignmentsTabProps {
  assignments: SubjectUpdateStaffAssignment[];
  staff: SubjectUpdateStaff[];
  subjects: SubjectUpdateItem[];
  combinations: SubjectUpdateCombination[];
  groups: SubjectUpdateStudentGroup[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  categories: SubjectUpdateCategory[];
  defaultSession: string;
  defaultCategory: string;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onRequestDelete: (id: string, label: string) => void;
}

export const StaffAssignmentsTab: React.FC<StaffAssignmentsTabProps> = ({
  assignments,
  staff,
  subjects,
  combinations,
  groups,
  sessions,
  semesters,
  categories,
  defaultSession,
  defaultCategory,
  onRefresh,
  onNotify,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterTargetType, setFilterTargetType] = useState<'ALL' | SubjectUpdateAssignmentTargetType>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateStaffAssignment | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);

  const [form, setForm] = useState<StaffAssignmentPayload>({
    session: defaultSession || sessions[0]?.sessionName || '2024-28',
    semester: semesters[0]?.semesterName || 'Semester 1',
    category: defaultCategory || categories[0]?.code || 'MJC',
    targetType: 'SUBJECT',
    subjectId: '',
    combinationId: '',
    groupId: '',
    staffIds: [],
    inChargeStaffId: '',
    remarks: '',
    isActive: true,
  });

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (filterSession !== 'ALL' && a.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && a.semester !== filterSemester) return false;
      if (filterTargetType !== 'ALL' && a.targetType !== filterTargetType) return false;
      if (!q) return true;
      return (
        (a.subjectLabel || '').toLowerCase().includes(q) ||
        (a.combinationLabel || '').toLowerCase().includes(q) ||
        (a.groupLabel || '').toLowerCase().includes(q) ||
        a.inChargeStaffName.toLowerCase().includes(q) ||
        a.staffNames.some((n) => n.toLowerCase().includes(q)) ||
        (a.remarks || '').toLowerCase().includes(q)
      );
    });
  }, [assignments, search, filterSession, filterSemester, filterTargetType]);

  const scopedSubjects = useMemo(() => {
    if (showAllTargets) return subjects;
    return subjects.filter(
      (s) => s.session === form.session && s.semester === form.semester && s.category === form.category
    );
  }, [subjects, form.session, form.semester, form.category, showAllTargets]);

  const scopedCombinations = useMemo(() => {
    if (showAllTargets) return combinations;
    return combinations.filter((c) => c.session === form.session && c.semester === form.semester);
  }, [combinations, form.session, form.semester, showAllTargets]);

  const scopedGroups = useMemo(() => {
    if (showAllTargets) return groups;
    return groups.filter((g) => g.session === form.session && g.semester === form.semester);
  }, [groups, form.session, form.semester, showAllTargets]);

  const openCreateModal = () => {
    setEditing(null);
    setShowAllTargets(false);
    const activeStaff = staff.filter((s) => s.isActive);
    setForm({
      session: defaultSession || sessions[0]?.sessionName || '2024-28',
      semester: semesters[0]?.semesterName || 'Semester 1',
      category: defaultCategory || categories[0]?.code || 'MJC',
      targetType: 'SUBJECT',
      subjectId: '',
      combinationId: '',
      groupId: '',
      staffIds: activeStaff[0] ? [activeStaff[0].id] : [],
      inChargeStaffId: activeStaff[0]?.id || '',
      remarks: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (a: SubjectUpdateStaffAssignment) => {
    setEditing(a);
    setShowAllTargets(true);
    setForm({
      session: a.session,
      semester: a.semester,
      category: a.category,
      targetType: a.targetType,
      subjectId: a.subjectId || '',
      combinationId: a.combinationId || '',
      groupId: a.groupId || '',
      staffIds: a.staffIds || [],
      inChargeStaffId: a.inChargeStaffId || '',
      remarks: a.remarks || '',
      isActive: a.isActive,
    });
    setModalOpen(true);
  };

  const handleToggleTeamMember = (staffId: string) => {
    setForm((p) => {
      const exists = p.staffIds.includes(staffId);
      const next = exists ? p.staffIds.filter((id) => id !== staffId) : [...p.staffIds, staffId];
      return { ...p, staffIds: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inChargeStaffId) {
      onNotify('error', 'Please select an In-Charge Staff member.');
      return;
    }
    if (form.targetType === 'SUBJECT' && !form.subjectId) {
      onNotify('error', 'Please select a Subject for this assignment.');
      return;
    }
    if (form.targetType === 'COMBINATION' && !form.combinationId) {
      onNotify('error', 'Please select a Subject Combination for this assignment.');
      return;
    }
    if (form.targetType === 'GROUP' && !form.groupId) {
      onNotify('error', 'Please select a Student Group for this assignment.');
      return;
    }

    const normalizedStaffIds = Array.from(new Set([...(form.staffIds || []), form.inChargeStaffId]));
    const payload: StaffAssignmentPayload = {
      ...form,
      staffIds: normalizedStaffIds,
      subjectId: form.targetType === 'SUBJECT' ? form.subjectId : undefined,
      combinationId: form.targetType === 'COMBINATION' ? form.combinationId : undefined,
      groupId: form.targetType === 'GROUP' ? form.groupId : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSubjectUpdateStaffAssignment(editing.id, payload);
        onNotify('success', 'Staff & In-charge assignment updated.');
      } else {
        await createSubjectUpdateStaffAssignment(payload);
        onNotify('success', 'Staff & In-charge assignment created.');
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save staff assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (a: SubjectUpdateStaffAssignment) => {
    try {
      await updateSubjectUpdateStaffAssignment(a.id, { isActive: !a.isActive });
      await onRefresh();
      onNotify('success', `Assignment marked ${!a.isActive ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update assignment status.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100">Staff Assignment &amp; In-Charge Allocation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Assign staff teams and designate an In-charge for Subjects, Subject Combinations, and Student Groups.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Assign Staff &amp; In-Charge
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
        <div className="relative xl:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search target, in-charge, staff..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.sessionName}>
              {s.sessionName}
            </option>
          ))}
        </select>

        <select
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.semesterName}>
              {s.semesterName}
            </option>
          ))}
        </select>

        <select
          value={filterTargetType}
          onChange={(e) =>
            setFilterTargetType(e.target.value as 'ALL' | SubjectUpdateAssignmentTargetType)
          }
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">All Targets</option>
          <option value="SUBJECT">Subject</option>
          <option value="COMBINATION">Combination</option>
          <option value="GROUP">Student Group</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Target Type &amp; Name</th>
              <th className="px-4 py-3">Academic Scope</th>
              <th className="px-4 py-3">In-Charge</th>
              <th className="px-4 py-3">Assigned Staff Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No staff assignments found. Click &quot;Assign Staff &amp; In-Charge&quot; to allocate staff responsibilities.
                </td>
              </tr>
            ) : (
              filteredAssignments.map((a) => {
                const targetLabel = a.subjectLabel || a.combinationLabel || a.groupLabel || '—';
                return (
                  <tr key={a.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-blue-300">
                        {a.targetType}
                      </span>
                      <div className="font-semibold text-slate-100 mt-1">{targetLabel}</div>
                      {a.remarks && <div className="text-[11px] text-slate-400 mt-0.5">{a.remarks}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{a.session}</div>
                      <div className="text-[11px] text-slate-400">
                        {a.semester} · {a.category}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                        {a.inChargeStaffName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs">
                      <div className="text-xs leading-relaxed">
                        {a.staffNames.length > 0 ? a.staffNames.join(', ') : a.inChargeStaffName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(a)}
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                          a.isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(a)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Edit / Change In-Charge"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDelete(a.id, `${a.targetType} Assignment (${targetLabel})`)
                          }
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Remove Assignment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assign / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editing ? 'Edit Staff & In-Charge Assignment' : 'Assign Staff & In-Charge'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Session *
                  </label>
                  <select
                    value={form.session}
                    onChange={(e) => setForm((p) => ({ ...p, session: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.sessionName}>
                        {s.sessionName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Semester *
                  </label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.semesterName}>
                        {s.semesterName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Assignment Target *
                  </label>
                  <select
                    value={form.targetType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        targetType: e.target.value as SubjectUpdateAssignmentTargetType,
                        subjectId: '',
                        combinationId: '',
                        groupId: '',
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="SUBJECT">Subject</option>
                    <option value="COMBINATION">Subject Combination</option>
                    <option value="GROUP">Student Group</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-400">
                      Select{' '}
                      {form.targetType === 'SUBJECT'
                        ? 'Subject'
                        : form.targetType === 'COMBINATION'
                        ? 'Combination'
                        : 'Student Group'}{' '}
                      *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAllTargets((v) => !v)}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                    >
                      {showAllTargets ? 'Filter by Scope' : 'Show All'}
                    </button>
                  </div>

                  {form.targetType === 'SUBJECT' && (
                    <select
                      required
                      value={form.subjectId || ''}
                      onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                    >
                      <option value="">Select Subject...</option>
                      {scopedSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.subjectCode} · {s.subjectName} ({s.session} {s.semester})
                        </option>
                      ))}
                    </select>
                  )}

                  {form.targetType === 'COMBINATION' && (
                    <select
                      required
                      value={form.combinationId || ''}
                      onChange={(e) => setForm((p) => ({ ...p, combinationId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                    >
                      <option value="">Select Subject Combination...</option>
                      {scopedCombinations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.combinationCode} · {c.combinationName} ({c.subjectCount} subj)
                        </option>
                      ))}
                    </select>
                  )}

                  {form.targetType === 'GROUP' && (
                    <select
                      required
                      value={form.groupId || ''}
                      onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                    >
                      <option value="">Select Student Group...</option>
                      {scopedGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.groupCode} · {g.groupName} ({g.studentIds.length} students)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  In-Charge Staff *
                </label>
                <select
                  required
                  value={form.inChargeStaffId}
                  onChange={(e) => setForm((p) => ({ ...p, inChargeStaffId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  <option value="">Select In-Charge Staff...</option>
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.staffCode} · {st.departmentName})
                      {!st.isActive ? ' [Inactive]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-400">
                    Assigned Staff Team (In-Charge is automatically included)
                  </label>
                  <span className="text-[11px] font-mono text-blue-400">
                    {Array.from(
                      new Set([
                        ...(form.staffIds || []),
                        ...(form.inChargeStaffId ? [form.inChargeStaffId] : []),
                      ])
                    ).length}{' '}
                    selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/70">
                  {staff.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No staff profiles created yet. Add staff in Staff Management first.
                    </div>
                  ) : (
                    staff.map((st) => {
                      const isInCharge = st.id === form.inChargeStaffId;
                      const checked = isInCharge || form.staffIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-800/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isInCharge}
                              onChange={() => handleToggleTeamMember(st.id)}
                              className="rounded border-slate-700 bg-slate-900 text-blue-600"
                            />
                            <span className="font-mono text-blue-300">{st.staffCode}</span>
                            <span className="text-slate-100 truncate">{st.fullName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                            {isInCharge ? 'In-Charge' : st.departmentName}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Remarks / Assignment Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional assignment instructions or room/lab schedule notes"
                  value={form.remarks || ''}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600"
                />
                Assignment is Active
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : editing ? 'Update Assignment' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
