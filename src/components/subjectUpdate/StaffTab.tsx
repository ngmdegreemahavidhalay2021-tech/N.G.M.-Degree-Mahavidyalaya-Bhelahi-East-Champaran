import React, { useMemo, useState } from 'react';
import { Edit3, Eye, Plus, Save, Search, Trash2, UserCheck, X } from 'lucide-react';
import {
  SubjectUpdateStaff,
  SubjectUpdateStaffAssignment,
  SubjectUpdateStudentGroup,
  SubjectUpdateWorkAllocation,
} from '../../types';
import {
  createSubjectUpdateStaffMember,
  StaffPayload,
  updateSubjectUpdateStaffMember,
} from '../../services/subjectUpdateSystemService';

interface StaffTabProps {
  staff: SubjectUpdateStaff[];
  staffAssignments: SubjectUpdateStaffAssignment[];
  groups: SubjectUpdateStudentGroup[];
  workAllocations: SubjectUpdateWorkAllocation[];
  departmentSuggestions: string[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onRequestDelete: (id: string, label: string) => void;
}

export const StaffTab: React.FC<StaffTabProps> = ({
  staff,
  staffAssignments,
  groups,
  workAllocations,
  departmentSuggestions,
  onRefresh,
  onNotify,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateStaff | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<StaffPayload>({
    staffCode: '',
    fullName: '',
    designation: 'Assistant Professor',
    departmentName: 'General',
    email: '',
    phone: '',
    specialization: '',
    isActive: true,
  });

  const deptOptions = useMemo(() => {
    const set = new Set<string>(departmentSuggestions);
    staff.forEach((s) => set.add(s.departmentName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departmentSuggestions, staff]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (filterDept !== 'ALL' && s.departmentName !== filterDept) return false;
      if (!q) return true;
      return (
        s.staffCode.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q) ||
        s.departmentName.toLowerCase().includes(q) ||
        (s.specialization || '').toLowerCase().includes(q)
      );
    });
  }, [staff, search, filterDept]);

  const selectedStaff = useMemo(
    () => staff.find((s) => s.id === selectedStaffId) || null,
    [staff, selectedStaffId]
  );

  const selectedResponsibilities = useMemo(() => {
    if (!selectedStaff) return null;
    const sid = selectedStaff.id;
    const assignments = staffAssignments.filter(
      (a) => a.inChargeStaffId === sid || a.staffIds.includes(sid)
    );
    const assignedGroups = groups.filter(
      (g) => g.inChargeStaffId === sid || g.assignedStaffIds.includes(sid)
    );
    const works = workAllocations.filter(
      (w) => w.inChargeStaffId === sid || w.staffIds.includes(sid)
    );
    return { assignments, assignedGroups, works };
  }, [selectedStaff, staffAssignments, groups, workAllocations]);

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      staffCode: '',
      fullName: '',
      designation: 'Assistant Professor',
      departmentName: deptOptions[0] || 'General',
      email: '',
      phone: '',
      specialization: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (member: SubjectUpdateStaff) => {
    setEditing(member);
    setForm({
      staffCode: member.staffCode,
      fullName: member.fullName,
      designation: member.designation,
      departmentName: member.departmentName,
      email: member.email || '',
      phone: member.phone || '',
      specialization: member.specialization || '',
      isActive: member.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSubjectUpdateStaffMember(editing.id, form);
        onNotify('success', `Updated staff "${updated.fullName} (${updated.staffCode})".`);
      } else {
        const created = await createSubjectUpdateStaffMember(form);
        onNotify('success', `Added staff "${created.fullName} (${created.staffCode})".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save staff profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: SubjectUpdateStaff) => {
    try {
      await updateSubjectUpdateStaffMember(member.id, { isActive: !member.isActive });
      await onRefresh();
      onNotify(
        'success',
        `Staff "${member.fullName}" marked ${!member.isActive ? 'Active' : 'Inactive'}.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update staff status.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Staff Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Maintain independent staff profiles for Subject Update and inspect each staff member&apos;s assigned responsibilities.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Staff Profile
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff code, name, designation, department..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Departments</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name & Designation</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Responsibilities</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No staff profiles added yet. Add staff members to assign subjects, combinations, groups, and work.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const assignCount = staffAssignments.filter(
                    (a) => a.inChargeStaffId === member.id || a.staffIds.includes(member.id)
                  ).length;
                  const workCount = workAllocations.filter(
                    (w) => w.inChargeStaffId === member.id || w.staffIds.includes(member.id)
                  ).length;
                  const inChargeCount =
                    staffAssignments.filter((a) => a.inChargeStaffId === member.id).length +
                    workAllocations.filter((w) => w.inChargeStaffId === member.id).length;

                  return (
                    <tr key={member.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-300 whitespace-nowrap">
                        {member.staffCode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-100">{member.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                          {member.designation}
                          {member.phone ? ` · ${member.phone}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{member.departmentName}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                        {assignCount} assigns · {workCount} tasks · {inChargeCount} in-charge
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member)}
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                            member.isActive
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStaffId(selectedStaffId === member.id ? null : member.id)
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600/20 text-blue-300 cursor-pointer"
                            title="View Responsibilities"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            title="Edit Staff"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onRequestDelete(member.id, `Staff ${member.fullName} (${member.staffCode})`)
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Delete Staff"
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
      </div>

      {/* Staff Responsibilities Inspection Panel */}
      {selectedStaff && selectedResponsibilities && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-100">
                Responsibilities · {selectedStaff.fullName} ({selectedStaff.staffCode})
              </h4>
              <p className="text-xs text-slate-400">
                {selectedStaff.designation} · {selectedStaff.departmentName}
                {selectedStaff.specialization ? ` · ${selectedStaff.specialization}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStaffId(null)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-200">
                Subject / Combination / Group Assignments ({selectedResponsibilities.assignments.length})
              </h5>
              {selectedResponsibilities.assignments.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  No subject, combination, or group assignments yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedResponsibilities.assignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-blue-300">{a.targetType}</span>
                        <span
                          className={`text-[11px] font-medium ${
                            a.inChargeStaffId === selectedStaff.id
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {a.inChargeStaffId === selectedStaff.id ? 'In-Charge' : 'Assigned Staff'}
                        </span>
                      </div>
                      <div className="font-medium text-slate-100">
                        {a.subjectLabel || a.combinationLabel || a.groupLabel}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {a.session} · {a.semester} · {a.category}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-200">
                Work Allocations ({selectedResponsibilities.works.length})
              </h5>
              {selectedResponsibilities.works.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  No academic work allocations assigned yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedResponsibilities.works.map((w) => (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-100">{w.title}</span>
                        <span className="font-mono text-[11px] text-blue-300">{w.progressStatus}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Deadline: <span className="font-mono">{w.deadline}</span> ·{' '}
                        {w.inChargeStaffId === selectedStaff.id ? 'In-Charge' : 'Team Member'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editing ? `Edit Staff (${editing.staffCode})` : 'Add Staff Profile'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Staff Code / ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STF-PHY-01"
                    value={form.staffCode}
                    onChange={(e) => setForm((p) => ({ ...p, staffCode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.designation}
                    onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    list="su-dept-suggestions"
                    value={form.departmentName || ''}
                    onChange={(e) => setForm((p) => ({ ...p, departmentName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone || ''}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Specialization / Expertise
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solid State Physics, Practical Instrumentation"
                  value={form.specialization || ''}
                  onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
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
                Staff is Active
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
                  {saving ? 'Saving...' : editing ? 'Save Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
