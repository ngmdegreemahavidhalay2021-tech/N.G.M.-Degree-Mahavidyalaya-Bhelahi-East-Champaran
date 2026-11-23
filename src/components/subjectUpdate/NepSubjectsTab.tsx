import React, { useMemo, useState } from 'react';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  Edit3,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  NEP_CATEGORIES,
  NepCategoryKey,
  SubjectUpdateDepartment,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
} from '../../types';
import {
  createSubjectUpdateDepartment,
  createSubjectUpdateItem,
  createSubjectUpdateSemester,
  createSubjectUpdateSession,
  SubjectPayload,
  updateSubjectUpdateItem,
} from '../../services/subjectUpdateSystemService';

interface NepSubjectsTabProps {
  subjects: SubjectUpdateItem[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  departments: SubjectUpdateDepartment[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onRequestDeleteSubject: (subject: SubjectUpdateItem) => void;
}

export function normalizeNepCat(cat?: string): NepCategoryKey | string {
  const upper = String(cat || '').trim().toUpperCase();
  if (upper === 'MJC' || upper === 'MAJOR') return 'MAJOR';
  return upper;
}

export const NepSubjectsTab: React.FC<NepSubjectsTabProps> = ({
  subjects,
  sessions,
  semesters,
  departments,
  onRefresh,
  onToast,
  onRequestDeleteSubject,
}) => {
  const [search, setSearch] = useState('');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SubjectPayload>({
    subjectCode: '',
    subjectName: '',
    category: 'MAJOR',
    session: sessions[0]?.sessionName || '2026-30',
    semester: semesters[0]?.semesterName || 'Semester 1',
    departmentName: departments[0]?.name || 'General',
    isActive: true,
  });

  // Compact inline quick-add modals for Session / Semester / Department (keeps top nav minimal at 5 options)
  const [quickAddType, setQuickAddType] = useState<'session' | 'semester' | 'department' | null>(null);
  const [quickSessionName, setQuickSessionName] = useState('');
  const [quickSemesterName, setQuickSemesterName] = useState('');
  const [quickSemesterOrder, setQuickSemesterOrder] = useState(semesters.length + 1);
  const [quickDeptCode, setQuickDeptCode] = useState('');
  const [quickDeptName, setQuickDeptName] = useState('');

  const deptNames = useMemo(() => {
    const set = new Set<string>(['General']);
    departments.forEach((d) => set.add(d.name));
    subjects.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, subjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects.filter((s) => {
      if (filterSession !== 'ALL' && s.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && s.semester !== filterSemester) return false;
      if (filterCategory !== 'ALL' && normalizeNepCat(s.category) !== filterCategory) return false;
      if (!q) return true;
      return (
        s.subjectCode.toLowerCase().includes(q) ||
        s.subjectName.toLowerCase().includes(q) ||
        s.departmentName.toLowerCase().includes(q) ||
        normalizeNepCat(s.category).toLowerCase().includes(q)
      );
    });
  }, [subjects, search, filterSession, filterSemester, filterCategory]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      subjectCode: '',
      subjectName: '',
      category: filterCategory !== 'ALL' ? filterCategory : 'MAJOR',
      session: filterSession !== 'ALL' ? filterSession : sessions[0]?.sessionName || '2026-30',
      semester: filterSemester !== 'ALL' ? filterSemester : semesters[0]?.semesterName || 'Semester 1',
      departmentName: deptNames[0] || 'General',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (item: SubjectUpdateItem) => {
    setEditing(item);
    setForm({
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      category: String(normalizeNepCat(item.category)),
      session: item.session,
      semester: item.semester,
      departmentName: item.departmentName || 'General',
      isActive: item.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSubjectUpdateItem(editing.id, form);
        onToast('success', `Subject "${updated.subjectCode} - ${updated.subjectName}" updated.`);
      } else {
        const created = await createSubjectUpdateItem(form);
        onToast('success', `Subject "${created.subjectCode} - ${created.subjectName}" added.`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save subject.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: SubjectUpdateItem) => {
    try {
      await updateSubjectUpdateItem(item.id, { isActive: !item.isActive });
      await onRefresh();
      onToast('success', `${item.subjectCode} marked ${!item.isActive ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to update status.');
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (quickAddType === 'session') {
        await createSubjectUpdateSession({ sessionName: quickSessionName.trim() });
        onToast('success', `Session "${quickSessionName.trim()}" added.`);
        setQuickSessionName('');
      } else if (quickAddType === 'semester') {
        await createSubjectUpdateSemester({
          semesterName: quickSemesterName.trim(),
          order: Number(quickSemesterOrder) || semesters.length + 1,
        });
        onToast('success', `Semester "${quickSemesterName.trim()}" added.`);
        setQuickSemesterName('');
      } else if (quickAddType === 'department') {
        await createSubjectUpdateDepartment({
          code: quickDeptCode.trim(),
          name: quickDeptName.trim(),
        });
        onToast('success', `Department "${quickDeptName.trim()}" added.`);
        setQuickDeptCode('');
        setQuickDeptName('');
      }
      setQuickAddType(null);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to add record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Setup */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">NEP Subjects Master</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage subjects independently across MAJOR, MIC, MDC, AEC, SEC, and VAC categories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQuickAddType('session')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
          >
            <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
            + Session
          </button>
          <button
            type="button"
            onClick={() => {
              setQuickSemesterOrder(semesters.length + 1);
              setQuickAddType('semester');
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            + Semester
          </button>
          <button
            type="button"
            onClick={() => setQuickAddType('department')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            + Department
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subject
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name, dept..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.semesterName}>
              {s.semesterName}
            </option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">All NEP Categories</option>
          {NEP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Subject Name</th>
                <th className="px-4 py-3 font-semibold">NEP Category</th>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No subjects found for the selected filters. Click "Add Subject" to create NEP subjects.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const normCat = normalizeNepCat(item.category);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {item.subjectCode}
                      </td>
                      <td className="px-4 py-3 text-slate-100 font-medium">{item.subjectName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[11px]">
                          {normCat}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-300">{item.session}</td>
                      <td className="px-4 py-3 text-slate-300">{item.semester}</td>
                      <td className="px-4 py-3 text-slate-300">{item.departmentName || 'General'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                            item.isActive
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {item.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            title="Edit subject"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDeleteSubject(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer"
                            title="Delete subject"
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

      {/* Add/Edit Subject Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">
                {editing ? 'Edit NEP Subject' : 'Add NEP Subject'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject Code *</label>
                <input
                  type="text"
                  required
                  value={form.subjectCode}
                  onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
                  placeholder="e.g., HIS-MAJ-101"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">NEP Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                >
                  {NEP_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject Name *</label>
              <input
                type="text"
                required
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                placeholder="e.g., History of India"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Session *</label>
                <select
                  value={form.session}
                  onChange={(e) => setForm({ ...form, session: e.target.value })}
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
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Semester *</label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
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
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Department</label>
                <select
                  value={form.departmentName}
                  onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
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

            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive !== false}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-700 bg-slate-950 text-blue-600"
              />
              Subject is active and available for NEP combinations
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Update Subject' : 'Save Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Session / Semester / Department Modal */}
      {quickAddType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleQuickAddSubmit}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Add New {quickAddType === 'session' ? 'Session' : quickAddType === 'semester' ? 'Semester' : 'Department'}
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddType(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickAddType === 'session' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Academic Session *</label>
                <input
                  type="text"
                  required
                  value={quickSessionName}
                  onChange={(e) => setQuickSessionName(e.target.value)}
                  placeholder="e.g., 2027-31"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>
            )}

            {quickAddType === 'semester' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Semester Name *</label>
                  <input
                    type="text"
                    required
                    value={quickSemesterName}
                    onChange={(e) => setQuickSemesterName(e.target.value)}
                    placeholder="e.g., Semester 9"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Sort Order</label>
                  <input
                    type="number"
                    min={1}
                    value={quickSemesterOrder}
                    onChange={(e) => setQuickSemesterOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>
            )}

            {quickAddType === 'department' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Department Code *</label>
                  <input
                    type="text"
                    required
                    value={quickDeptCode}
                    onChange={(e) => setQuickDeptCode(e.target.value)}
                    placeholder="e.g., POL"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={quickDeptName}
                    onChange={(e) => setQuickDeptName(e.target.value)}
                    placeholder="e.g., POLITICAL SCIENCE"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setQuickAddType(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
