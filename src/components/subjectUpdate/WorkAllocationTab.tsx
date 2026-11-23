import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Edit3, Plus, Save, Search, Trash2, X } from 'lucide-react';
import {
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStaff,
  SubjectUpdateStudentGroup,
  SubjectUpdateWorkAllocation,
  SubjectUpdateWorkPriority,
  SubjectUpdateWorkStatus,
} from '../../types';
import {
  createSubjectUpdateWorkAllocation,
  updateSubjectUpdateWorkAllocation,
  WorkAllocationPayload,
} from '../../services/subjectUpdateSystemService';

interface WorkAllocationTabProps {
  workAllocations: SubjectUpdateWorkAllocation[];
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

const PRIORITY_STYLE: Record<SubjectUpdateWorkPriority, string> = {
  URGENT: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  HIGH: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  NORMAL: 'bg-slate-800 border-slate-700 text-slate-300',
};

export const WorkAllocationTab: React.FC<WorkAllocationTabProps> = ({
  workAllocations,
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | SubjectUpdateWorkStatus>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | SubjectUpdateWorkPriority>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateWorkAllocation | null>(null);
  const [saving, setSaving] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<WorkAllocationPayload>({
    title: '',
    session: defaultSession || sessions[0]?.sessionName || '2024-28',
    semester: semesters[0]?.semesterName || 'Semester 1',
    category: defaultCategory || categories[0]?.code || 'MJC',
    subjectId: '',
    combinationId: '',
    groupId: '',
    staffIds: [],
    inChargeStaffId: '',
    instructions: '',
    deadline: todayIso,
    priority: 'NORMAL',
    progressStatus: 'PENDING',
    remarks: '',
  });

  const filteredWork = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workAllocations.filter((w) => {
      if (filterSession !== 'ALL' && w.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && w.semester !== filterSemester) return false;
      if (filterStatus !== 'ALL' && w.progressStatus !== filterStatus) return false;
      if (filterPriority !== 'ALL' && w.priority !== filterPriority) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.instructions.toLowerCase().includes(q) ||
        w.inChargeStaffName.toLowerCase().includes(q) ||
        w.staffNames.some((n) => n.toLowerCase().includes(q)) ||
        (w.subjectLabel || '').toLowerCase().includes(q) ||
        (w.combinationLabel || '').toLowerCase().includes(q) ||
        (w.groupLabel || '').toLowerCase().includes(q)
      );
    });
  }, [workAllocations, search, filterSession, filterSemester, filterStatus, filterPriority]);

  const scopedSubjects = useMemo(
    () => subjects.filter((s) => s.session === form.session && s.semester === form.semester),
    [subjects, form.session, form.semester]
  );

  const scopedCombinations = useMemo(
    () => combinations.filter((c) => c.session === form.session && c.semester === form.semester),
    [combinations, form.session, form.semester]
  );

  const scopedGroups = useMemo(
    () => groups.filter((g) => g.session === form.session && g.semester === form.semester),
    [groups, form.session, form.semester]
  );

  const openCreateModal = () => {
    setEditing(null);
    const activeStaff = staff.filter((s) => s.isActive);
    setForm({
      title: '',
      session: defaultSession || sessions[0]?.sessionName || '2024-28',
      semester: semesters[0]?.semesterName || 'Semester 1',
      category: defaultCategory || categories[0]?.code || 'MJC',
      subjectId: '',
      combinationId: '',
      groupId: '',
      staffIds: activeStaff[0] ? [activeStaff[0].id] : [],
      inChargeStaffId: activeStaff[0]?.id || '',
      instructions: '',
      deadline: todayIso,
      priority: 'NORMAL',
      progressStatus: 'PENDING',
      remarks: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (w: SubjectUpdateWorkAllocation) => {
    setEditing(w);
    setForm({
      title: w.title,
      session: w.session,
      semester: w.semester,
      category: w.category,
      subjectId: w.subjectId || '',
      combinationId: w.combinationId || '',
      groupId: w.groupId || '',
      staffIds: w.staffIds || [],
      inChargeStaffId: w.inChargeStaffId,
      instructions: w.instructions,
      deadline: w.deadline,
      priority: w.priority,
      progressStatus: w.progressStatus,
      remarks: w.remarks || '',
    });
    setModalOpen(true);
  };

  const handleToggleTeamMember = (staffId: string) => {
    setForm((p) => {
      const exists = p.staffIds.includes(staffId);
      return {
        ...p,
        staffIds: exists ? p.staffIds.filter((id) => id !== staffId) : [...p.staffIds, staffId],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inChargeStaffId) {
      onNotify('error', 'Please choose an In-Charge Staff member for this responsibility.');
      return;
    }

    const payload: WorkAllocationPayload = {
      ...form,
      staffIds: Array.from(new Set([...(form.staffIds || []), form.inChargeStaffId])),
      subjectId: form.subjectId || undefined,
      combinationId: form.combinationId || undefined,
      groupId: form.groupId || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSubjectUpdateWorkAllocation(editing.id, payload);
        onNotify('success', `Work allocation "${form.title}" updated.`);
      } else {
        await createSubjectUpdateWorkAllocation(payload);
        onNotify('success', `Work allocation "${form.title}" created.`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save work allocation.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (
    item: SubjectUpdateWorkAllocation,
    progressStatus: SubjectUpdateWorkStatus
  ) => {
    try {
      await updateSubjectUpdateWorkAllocation(item.id, { progressStatus });
      await onRefresh();
      onNotify('success', `"${item.title}" status updated to ${progressStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update progress status.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100">Work Allocation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Assign academic responsibilities per Session, Semester, Subject, Combination, or Group with deadlines and progress tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Allocate Work
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
        <div className="relative xl:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task title, instructions, staff..."
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'ALL' | SubjectUpdateWorkStatus)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">All Progress</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="ON_HOLD">On Hold</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as 'ALL' | SubjectUpdateWorkPriority)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">All Priorities</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Work &amp; Instructions</th>
              <th className="px-4 py-3">Academic Context</th>
              <th className="px-4 py-3">In-Charge &amp; Team</th>
              <th className="px-4 py-3">Deadline &amp; Priority</th>
              <th className="px-4 py-3">Progress Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredWork.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No work allocations found. Click &quot;Allocate Work&quot; to assign academic responsibilities.
                </td>
              </tr>
            ) : (
              filteredWork.map((w) => {
                const isOverdue =
                  w.progressStatus !== 'COMPLETED' && w.deadline && w.deadline < todayIso;
                return (
                  <tr key={w.id} className="hover:bg-slate-800/30 align-top">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-semibold text-slate-100">{w.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {w.instructions}
                      </div>
                      {w.remarks && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Note: {w.remarks}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">
                        {w.session} · {w.semester} · {w.category}
                      </div>
                      <div className="text-[11px] text-slate-400 space-y-0.5 mt-1">
                        {w.subjectLabel && <div>Subject: {w.subjectLabel}</div>}
                        {w.combinationLabel && <div>Combo: {w.combinationLabel}</div>}
                        {w.groupLabel && <div>Group: {w.groupLabel}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-emerald-300">
                        In-charge: {w.inChargeStaffName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Team: {w.staffNames.join(', ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div
                        className={`font-mono tabular-nums ${
                          isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-200'
                        }`}
                      >
                        {w.deadline}
                        {isOverdue ? ' (Overdue)' : ''}
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-medium ${
                          PRIORITY_STYLE[w.priority]
                        }`}
                      >
                        {w.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={w.progressStatus}
                        onChange={(e) =>
                          handleQuickStatusChange(w, e.target.value as SubjectUpdateWorkStatus)
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer focus:outline-none ${
                          w.progressStatus === 'COMPLETED'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : w.progressStatus === 'IN_PROGRESS'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : w.progressStatus === 'ON_HOLD'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-slate-950 border-slate-700 text-slate-300'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="ON_HOLD">ON HOLD</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(w)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Edit Work Allocation"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDelete(w.id, `Work "${w.title}"`)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Delete Work Allocation"
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

      {/* Create / Edit Work Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editing ? 'Edit Work Allocation' : 'Allocate Academic Work'}
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
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Responsibility / Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab Apparatus & Batch Verification for Physics Batch A"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

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
                    Subject (Optional)
                  </label>
                  <select
                    value={form.subjectId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">None</option>
                    {scopedSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subjectCode} · {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Combination (Optional)
                  </label>
                  <select
                    value={form.combinationId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, combinationId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">None</option>
                    {scopedCombinations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.combinationCode} · {c.combinationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Student Group (Optional)
                  </label>
                  <select
                    value={form.groupId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">None</option>
                    {scopedGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.groupCode} · {g.groupName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Deadline *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.deadline}
                    onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Priority *
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        priority: e.target.value as SubjectUpdateWorkPriority,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Progress Status *
                  </label>
                  <select
                    value={form.progressStatus}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        progressStatus: e.target.value as SubjectUpdateWorkStatus,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ON_HOLD">ON HOLD</option>
                  </select>
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
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-400">
                  Responsible Staff Team
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/70">
                  {staff.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Add staff in Staff Management first.
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
                          <span className="text-[11px] text-slate-400">
                            {isInCharge ? 'In-Charge' : st.designation}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Instructions / Responsibility Details *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe exact academic preparation, batch verification, or roster check instructions..."
                  value={form.instructions}
                  onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={form.remarks || ''}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

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
                  {saving ? 'Saving...' : editing ? 'Update Work' : 'Allocate Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
