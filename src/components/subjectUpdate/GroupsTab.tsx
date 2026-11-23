import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Edit3,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStaff,
  SubjectUpdateStudent,
  SubjectUpdateStudentGroup,
} from '../../types';
import {
  createSubjectUpdateGroup,
  GroupPayload,
  updateSubjectUpdateGroup,
} from '../../services/subjectUpdateSystemService';

interface GroupsTabProps {
  groups: SubjectUpdateStudentGroup[];
  students: SubjectUpdateStudent[];
  subjects: SubjectUpdateItem[];
  combinations: SubjectUpdateCombination[];
  staff: SubjectUpdateStaff[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  categories: SubjectUpdateCategory[];
  defaultSession: string;
  defaultCategory: string;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onRequestDelete: (id: string, label: string) => void;
}

export const GroupsTab: React.FC<GroupsTabProps> = ({
  groups,
  students,
  subjects,
  combinations,
  staff,
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
  const [inspectGroupId, setInspectGroupId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateStudentGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');

  const [form, setForm] = useState<GroupPayload>({
    groupCode: '',
    groupName: '',
    session: defaultSession || sessions[0]?.sessionName || '2024-28',
    semester: semesters[0]?.semesterName || 'Semester 1',
    category: defaultCategory || categories[0]?.code || 'MJC',
    subjectId: '',
    combinationId: '',
    studentIds: [],
    capacity: 30,
    inChargeStaffId: '',
    assignedStaffIds: [],
    notes: '',
    isActive: true,
  });

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (filterSession !== 'ALL' && g.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && g.semester !== filterSemester) return false;
      if (!q) return true;
      return (
        g.groupCode.toLowerCase().includes(q) ||
        g.groupName.toLowerCase().includes(q) ||
        (g.subjectLabel || '').toLowerCase().includes(q) ||
        (g.combinationLabel || '').toLowerCase().includes(q) ||
        (g.inChargeStaffName || '').toLowerCase().includes(q)
      );
    });
  }, [groups, search, filterSession, filterSemester]);

  const inspectedGroup = useMemo(
    () => groups.find((g) => g.id === inspectGroupId) || null,
    [groups, inspectGroupId]
  );

  const inspectedMembers = useMemo(() => {
    if (!inspectedGroup) return [];
    const idSet = new Set(inspectedGroup.studentIds || []);
    return students.filter((s) => idSet.has(s.id) || s.groupId === inspectedGroup.id);
  }, [inspectedGroup, students]);

  const modalSubjects = useMemo(
    () => subjects.filter((s) => s.session === form.session && s.semester === form.semester),
    [subjects, form.session, form.semester]
  );

  const modalCombinations = useMemo(
    () => combinations.filter((c) => c.session === form.session && c.semester === form.semester),
    [combinations, form.session, form.semester]
  );

  const modalStudents = useMemo(() => {
    const q = studentPickerSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (s.session !== form.session || s.semester !== form.semester) return false;
      if (!q) return true;
      return (
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.rawSubjectText.toLowerCase().includes(q)
      );
    });
  }, [students, form.session, form.semester, studentPickerSearch]);

  const openCreateModal = () => {
    setEditing(null);
    setStudentPickerSearch('');
    setForm({
      groupCode: '',
      groupName: '',
      session: defaultSession || sessions[0]?.sessionName || '2024-28',
      semester: semesters[0]?.semesterName || 'Semester 1',
      category: defaultCategory || categories[0]?.code || 'MJC',
      subjectId: '',
      combinationId: '',
      studentIds: [],
      capacity: 30,
      inChargeStaffId: '',
      assignedStaffIds: [],
      notes: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (grp: SubjectUpdateStudentGroup) => {
    setEditing(grp);
    setStudentPickerSearch('');
    setForm({
      groupCode: grp.groupCode,
      groupName: grp.groupName,
      session: grp.session,
      semester: grp.semester,
      category: grp.category,
      subjectId: grp.subjectId || '',
      combinationId: grp.combinationId || '',
      studentIds: grp.studentIds || [],
      capacity: grp.capacity || 30,
      inChargeStaffId: grp.inChargeStaffId || '',
      assignedStaffIds: grp.assignedStaffIds || [],
      notes: grp.notes || '',
      isActive: grp.isActive,
    });
    setModalOpen(true);
  };

  const handleSelectMatchingStudents = () => {
    const matching = modalStudents.filter((s) => {
      if (form.combinationId && s.combinationId === form.combinationId) return true;
      if (form.subjectId && s.matchedSubjectIds.includes(form.subjectId)) return true;
      return !form.combinationId && !form.subjectId;
    });
    setForm((p) => ({
      ...p,
      studentIds: Array.from(new Set([...(p.studentIds || []), ...matching.map((m) => m.id)])),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSubjectUpdateGroup(editing.id, form);
        onNotify('success', `Updated student group "${updated.groupCode} · ${updated.groupName}".`);
      } else {
        const created = await createSubjectUpdateGroup(form);
        onNotify('success', `Created student group "${created.groupCode} · ${created.groupName}".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save student group.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportGroupRoster = (grp: SubjectUpdateStudentGroup) => {
    const idSet = new Set(grp.studentIds || []);
    const members = students.filter((s) => idSet.has(s.id) || s.groupId === grp.id);
    const rows = members.map((m, idx) => ({
      'SN.': m.sn || idx + 1,
      'ROLL NO.': m.rollNumber,
      'NAME OF STUDENT': m.studentName,
      SUBJECT: m.matchedSubjectNames.join(', ') || m.rawSubjectText,
      Group: `${grp.groupCode} - ${grp.groupName}`,
      Session: grp.session,
      Semester: grp.semester,
      'In-Charge': grp.inChargeStaffName || 'Unassigned',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Group Roster');
    XLSX.writeFile(wb, `Group_${grp.groupCode}_Roster.xlsx`);
    onNotify('success', `Exported ${members.length} students for group "${grp.groupName}".`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Student Group Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Organize uploaded students into practical/academic batches linked to subjects, combinations, and staff in-charges.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Student Group
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search group code, name, subject, combination, in-charge..."
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
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Group Code & Name</th>
                <th className="px-4 py-3">Scope & Linked Target</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">In-Charge & Staff</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No student groups created yet.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((grp) => (
                  <tr key={grp.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-blue-300">{grp.groupCode}</div>
                      <div className="font-semibold text-slate-100">{grp.groupName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">
                        {grp.session} · {grp.semester} · {grp.category}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {grp.combinationLabel || grp.subjectLabel || 'General Group'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectGroupId(inspectGroupId === grp.id ? null : grp.id)
                        }
                        className="text-blue-400 hover:underline cursor-pointer"
                      >
                        {grp.studentIds.length}
                        {grp.capacity ? ` / ${grp.capacity}` : ''} students
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-100">
                        {grp.inChargeStaffName ? `In-charge: ${grp.inChargeStaffName}` : 'No In-charge'}
                      </div>
                      {grp.assignedStaffNames.length > 0 && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Staff: {grp.assignedStaffNames.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleExportGroupRoster(grp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Export Group Roster (.xlsx)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(grp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Edit Group"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDelete(grp.id, `Group ${grp.groupCode} (${grp.groupName})`)
                          }
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspected Group Roster Drawer/Panel */}
      {inspectedGroup && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Roster: {inspectedGroup.groupCode} · {inspectedGroup.groupName}
              </h4>
              <p className="text-xs text-slate-400">
                {inspectedMembers.length} students enrolled · In-charge:{' '}
                {inspectedGroup.inChargeStaffName || 'Unassigned'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInspectGroupId(null)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-64">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="px-3 py-2">SN.</th>
                  <th className="px-3 py-2">Roll No.</th>
                  <th className="px-3 py-2">Student Name</th>
                  <th className="px-3 py-2">Subjects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {inspectedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      No students assigned to this group yet. Edit the group to assign students.
                    </td>
                  </tr>
                ) : (
                  inspectedMembers.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 font-mono text-slate-400">{m.sn}</td>
                      <td className="px-3 py-2 font-mono text-blue-300">{m.rollNumber}</td>
                      <td className="px-3 py-2 text-slate-100 font-medium">{m.studentName}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {m.matchedSubjectNames.join(', ') || m.rawSubjectText}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Group Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editing ? `Edit Group (${editing.groupCode})` : 'Create Student Group'}
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
                    Group Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PHY-G1"
                    value={form.groupCode}
                    onChange={(e) => setForm((p) => ({ ...p, groupCode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Physics Practical Batch A"
                    value={form.groupName}
                    onChange={(e) => setForm((p) => ({ ...p, groupName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacity || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        capacity: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Linked Subject (Optional)
                  </label>
                  <select
                    value={form.subjectId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">None</option>
                    {modalSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subjectCode} · {s.subjectName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Linked Subject Combination (Optional)
                  </label>
                  <select
                    value={form.combinationId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, combinationId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">None</option>
                    {modalCombinations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.combinationCode} · {c.combinationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Group In-Charge Staff (Optional)
                </label>
                <select
                  value={form.inChargeStaffId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, inChargeStaffId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  <option value="">Unassigned (or assign via Staff Assignment)</option>
                  {staff
                    .filter((st) => st.isActive)
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.staffCode} · {st.departmentName})
                      </option>
                    ))}
                </select>
              </div>

              {/* Student Membership Picker */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Enroll Students (
                    <span className="font-mono text-blue-400">
                      {(form.studentIds || []).length}
                    </span>{' '}
                    selected)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectMatchingStudents}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                    >
                      Select Matching Students
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, studentIds: [] }))}
                      className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={studentPickerSearch}
                  onChange={(e) => setStudentPickerSearch(e.target.value)}
                  placeholder="Filter students in selected session & semester..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />

                <div className="max-h-44 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/70">
                  {modalStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No uploaded students in {form.session} · {form.semester}.
                    </div>
                  ) : (
                    modalStudents.map((st) => {
                      const checked = (form.studentIds || []).includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-800/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm((p) => {
                                  const list = p.studentIds || [];
                                  return {
                                    ...p,
                                    studentIds: list.includes(st.id)
                                      ? list.filter((id) => id !== st.id)
                                      : [...list, st.id],
                                  };
                                })
                              }
                              className="rounded border-slate-700 bg-slate-900 text-blue-600"
                            />
                            <span className="font-mono text-blue-300">{st.rollNumber}</span>
                            <span className="text-slate-100 truncate">{st.studentName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 truncate ml-2">
                            {st.matchedSubjectNames.join(', ') || st.rawSubjectText}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
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
                  {saving ? 'Saving...' : editing ? 'Save Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
