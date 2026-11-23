import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  SubjectUpdateDepartment,
  SubjectUpdateSelectionForm,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStaff,
  SubjectUpdateStudent,
} from '../../types';
import {
  createSubjectUpdateSelectionForm,
  createSubjectUpdateStaffMember,
  updateSubjectUpdateSelectionForm,
  updateSubjectUpdateStaffMember,
} from '../../services/subjectUpdateSystemService';

interface NepStaffAssignmentTabProps {
  staffMembers: SubjectUpdateStaff[];
  students: SubjectUpdateStudent[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  departments: SubjectUpdateDepartment[];
  selectionForms: SubjectUpdateSelectionForm[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onRequestDeleteStaff: (staff: SubjectUpdateStaff) => void;
  onRequestDeleteSelectionForm: (form: SubjectUpdateSelectionForm) => void;
  onOpenSelectionFormPreview: (token: string) => void;
}

export const NepStaffAssignmentTab: React.FC<NepStaffAssignmentTabProps> = ({
  staffMembers,
  students,
  sessions,
  semesters,
  departments,
  selectionForms,
  onRefresh,
  onToast,
  onRequestDeleteStaff,
  onRequestDeleteSelectionForm,
  onOpenSelectionFormPreview,
}) => {
  // Staff CRUD modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SubjectUpdateStaff | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({
    staffCode: '',
    fullName: '',
    designation: 'Assistant Professor',
    departmentName: departments[0]?.name || 'General',
    email: '',
    phone: '',
  });

  // Selection Form Assignment modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<SubjectUpdateSelectionForm | null>(null);
  const [savingAssign, setSavingAssign] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showAllScopedStudents, setShowAllScopedStudents] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [assignForm, setAssignForm] = useState({
    title: '',
    session: sessions.find((s) => s.sessionName === '2026-30')?.sessionName || sessions[0]?.sessionName || '2026-30',
    semester: semesters[0]?.semesterName || 'Semester 1',
    departmentName: departments[0]?.name || 'General',
    inChargeStaffId: staffMembers[0]?.id || '',
    assignedStaffIds: [] as string[],
    studentIds: [] as string[],
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  const deptNames = useMemo(() => {
    const set = new Set<string>(['General']);
    departments.forEach((d) => set.add(d.name));
    students.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, students]);

  const scopedStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (s.session !== assignForm.session || s.semester !== assignForm.semester) return false;
      if (
        !showAllScopedStudents &&
        assignForm.departmentName &&
        (s.departmentName || 'General').toLowerCase() !== assignForm.departmentName.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        (s.applicationNo || '').toLowerCase().includes(q) ||
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q)
      );
    });
  }, [students, assignForm.session, assignForm.semester, assignForm.departmentName, showAllScopedStudents, studentSearch]);

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      staffCode: '',
      fullName: '',
      designation: 'Assistant Professor',
      departmentName: deptNames[0] || 'General',
      email: '',
      phone: '',
    });
    setStaffModalOpen(true);
  };

  const openEditStaff = (st: SubjectUpdateStaff) => {
    setEditingStaff(st);
    setStaffForm({
      staffCode: st.staffCode,
      fullName: st.fullName,
      designation: st.designation,
      departmentName: st.departmentName || 'General',
      email: st.email || '',
      phone: st.phone || '',
    });
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStaff(true);
    try {
      if (editingStaff) {
        await updateSubjectUpdateStaffMember(editingStaff.id, staffForm);
        onToast('success', `Updated staff profile "${staffForm.fullName}".`);
      } else {
        await createSubjectUpdateStaffMember(staffForm);
        onToast('success', `Added staff member "${staffForm.fullName}".`);
      }
      setStaffModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save staff member.');
    } finally {
      setSavingStaff(false);
    }
  };

  const openCreateAssignment = () => {
    setEditingForm(null);
    setStudentSearch('');
    setShowAllScopedStudents(false);
    setAssignForm({
      title: '',
      session: sessions.find((s) => s.sessionName === '2026-30')?.sessionName || sessions[0]?.sessionName || '2026-30',
      semester: semesters[0]?.semesterName || 'Semester 1',
      departmentName: deptNames[0] || 'General',
      inChargeStaffId: staffMembers[0]?.id || '',
      assignedStaffIds: [],
      studentIds: [],
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    setAssignModalOpen(true);
  };

  const openEditAssignment = (form: SubjectUpdateSelectionForm) => {
    setEditingForm(form);
    setStudentSearch('');
    setShowAllScopedStudents(false);
    setAssignForm({
      title: form.title,
      session: form.session,
      semester: form.semester,
      departmentName: form.departmentName,
      inChargeStaffId: form.inChargeStaffId,
      assignedStaffIds: form.assignedStaffIds || [],
      studentIds: form.studentIds || [],
      deadline: form.deadline,
    });
    setAssignModalOpen(true);
  };

  const toggleStudentInAssignment = (sid: string) => {
    setAssignForm((prev) => {
      const exists = prev.studentIds.includes(sid);
      return {
        ...prev,
        studentIds: exists ? prev.studentIds.filter((id) => id !== sid) : [...prev.studentIds, sid],
      };
    });
  };

  const selectAllScoped = () => {
    const ids = scopedStudents.map((s) => s.id);
    setAssignForm((prev) => ({
      ...prev,
      studentIds: Array.from(new Set([...prev.studentIds, ...ids])),
    }));
  };

  const selectUnassignedScoped = () => {
    const ids = scopedStudents
      .filter((s) => !s.selectionFormId || s.selectionFormId === editingForm?.id)
      .map((s) => s.id);
    setAssignForm((prev) => ({
      ...prev,
      studentIds: Array.from(new Set([...prev.studentIds, ...ids])),
    }));
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAssign(true);
    try {
      if (editingForm) {
        await updateSubjectUpdateSelectionForm(editingForm.id, assignForm);
        onToast('success', 'Updated Department In-Charge assignment.');
      } else {
        const created = await createSubjectUpdateSelectionForm(assignForm);
        onToast('success', `Generated secure selection link for "${created.inChargeStaffName}".`);
      }
      setAssignModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save assignment.');
    } finally {
      setSavingAssign(false);
    }
  };

  const buildShareUrl = (token: string) =>
    `${window.location.origin}/?selectionToken=${encodeURIComponent(token)}`;

  const handleCopyLink = async (form: SubjectUpdateSelectionForm) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(form.token));
      setCopiedId(form.id);
      setTimeout(() => setCopiedId((prev) => (prev === form.id ? null : prev)), 2000);
      onToast('success', `Copied secure link for ${form.inChargeStaffName}.`);
    } catch {
      onToast('error', 'Could not copy link to clipboard.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Staff Directory Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Staff Directory</h3>
            <p className="text-xs text-slate-400">
              Add teaching staff members who can serve as Department In-Charge across one or multiple assignments.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddStaff}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 border border-slate-700 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-400" />
            Add Staff
          </button>
        </div>

        {staffMembers.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            No staff members added yet. Add a staff member to assign as Department In-Charge.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {staffMembers.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-100 truncate">{st.fullName}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    <span className="font-mono">{st.staffCode}</span> · {st.departmentName}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditStaff(st)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Edit staff"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDeleteStaff(st)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 cursor-pointer"
                    title="Delete staff"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Department In-Charge Assignment & Secure Link Generation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Department In-Charge Assignments &amp; Secure Links
            </h3>
            <p className="text-xs text-slate-400">
              Assign a Department In-charge, allocate their student batch, set deadline, and generate a unique selection link.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateAssignment}
            disabled={staffMembers.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            New Assignment &amp; Generate Link
          </button>
        </div>

        {selectionForms.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No Department In-Charge assignments created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {selectionForms.map((form) => {
              const link = buildShareUrl(form.token);
              return (
                <div
                  key={form.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{form.departmentName}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {form.session} · {form.semester}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          form.isLocked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : form.status === 'IN_PROGRESS'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                        }`}
                      >
                        {form.isLocked ? 'SUBMITTED (LOCKED)' : form.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>
                        In-charge: <strong className="text-slate-200">{form.inChargeStaffName}</strong>
                      </span>
                      <span>
                        Allocated:{' '}
                        <strong className="font-mono tabular-nums text-slate-200">{form.totalStudents}</strong>{' '}
                        students ({form.completedCount} done, {form.pendingCount} pending)
                      </span>
                      <span>
                        Deadline: <strong className="font-mono text-slate-200">{form.deadline}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Link2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <code className="text-[11px] font-mono text-blue-300 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 truncate max-w-md">
                        {link}
                      </code>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(form)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 border border-slate-700 cursor-pointer"
                    >
                      {copiedId === form.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedId === form.id ? 'Copied' : 'Copy Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenSelectionFormPreview(form.token)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-xs font-medium text-blue-300 border border-blue-500/30 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Form
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditAssignment(form)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Edit assignment"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDeleteSelectionForm(form)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer"
                      title="Delete assignment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Staff Modal */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStaff}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Staff Code *</label>
                <input
                  type="text"
                  required
                  value={staffForm.staffCode}
                  onChange={(e) => setStaffForm({ ...staffForm, staffCode: e.target.value })}
                  placeholder="FAC-01"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Department</label>
                <select
                  value={staffForm.departmentName}
                  onChange={(e) => setStaffForm({ ...staffForm, departmentName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  {deptNames.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={staffForm.fullName}
                onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                placeholder="Dr. Ramesh Sharma"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Designation</label>
                <input
                  type="text"
                  value={staffForm.designation}
                  onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Phone</label>
                <input
                  type="text"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStaff}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {savingStaff && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingStaff ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create / Edit Assignment & Student Allocator Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAssignment}
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                {editingForm ? 'Edit Department In-Charge Assignment' : 'Assign Department In-Charge & Students'}
              </h3>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Session *</label>
                <select
                  value={assignForm.session}
                  onChange={(e) => setAssignForm({ ...assignForm, session: e.target.value })}
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
                <label className="block text-[11px] text-slate-400 mb-1">Semester *</label>
                <select
                  value={assignForm.semester}
                  onChange={(e) => setAssignForm({ ...assignForm, semester: e.target.value })}
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
                <label className="block text-[11px] text-slate-400 mb-1">Department *</label>
                <select
                  value={assignForm.departmentName}
                  onChange={(e) => setAssignForm({ ...assignForm, departmentName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  {deptNames.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Deadline *</label>
                <input
                  type="date"
                  required
                  value={assignForm.deadline}
                  onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Department In-charge *</label>
                <select
                  required
                  value={assignForm.inChargeStaffId}
                  onChange={(e) => setAssignForm({ ...assignForm, inChargeStaffId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  <option value="">-- Select Staff In-charge --</option>
                  {staffMembers.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.staffCode} · {st.departmentName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Form Title (optional)</label>
                <input
                  type="text"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
                  placeholder={`${assignForm.departmentName} · ${assignForm.semester} (${assignForm.session})`}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>
            </div>

            {/* Allocate Student List */}
            <div className="flex-1 min-h-0 flex flex-col border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Allocate Students ({assignForm.studentIds.length} selected)
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAllScopedStudents}
                      onChange={(e) => setShowAllScopedStudents(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900"
                    />
                    Include other depts
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectUnassignedScoped}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Select Unassigned
                  </button>
                  <button
                    type="button"
                    onClick={selectAllScoped}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Select All ({scopedStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignForm((p) => ({ ...p, studentIds: [] }))}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="p-2 border-b border-slate-800/80">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Filter students by application no., roll, or name..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="overflow-y-auto p-2 space-y-1 max-h-56">
                {scopedStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No students found in {assignForm.session} · {assignForm.semester}
                    {!showAllScopedStudents ? ` (${assignForm.departmentName})` : ''}.
                  </p>
                ) : (
                  scopedStudents.map((st) => {
                    const checked = assignForm.studentIds.includes(st.id);
                    const assignedElsewhere = st.selectionFormId && st.selectionFormId !== editingForm?.id;
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
                          checked ? 'bg-blue-600/15 text-slate-100' : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudentInAssignment(st.id)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600"
                          />
                          <span className="font-mono text-slate-400 shrink-0">
                            {st.applicationNo || st.rollNumber}
                          </span>
                          <span className="font-medium truncate">{st.studentName}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {assignedElsewhere ? `In: ${st.selectionFormName}` : st.departmentName || 'General'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {savingAssign && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingForm ? 'Update Assignment' : 'Create & Generate Link'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
