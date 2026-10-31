import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  FileEdit,
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  ArrowRightLeft,
  UserCheck,
} from 'lucide-react';
import { Department, Subject, PracticalForm, Student } from '../types';
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  transferSubjectDepartment,
  createSubject,
} from '../services/collegeService';

interface DepartmentModuleProps {
  departments: Department[];
  subjects: Subject[];
  forms: PracticalForm[];
  students: Student[];
  onRefresh: () => void;
}

export const DepartmentModule: React.FC<DepartmentModuleProps> = ({
  departments,
  subjects,
  forms,
  students,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [selectedDeptDetail, setSelectedDeptDetail] = useState<Department | null>(null);

  // Form inputs
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coordinator, setCoordinator] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transfer subject state
  const [transferringSubjectId, setTransferringSubjectId] = useState<string | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const handleOpenAdd = () => {
    setCode('');
    setName('');
    setDescription('');
    setCoordinator('');
    setIsGroup(false);
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setCode(dept.code);
    setName(dept.name);
    setDescription(dept.description || '');
    setCoordinator(dept.coordinator || '');
    setIsGroup(Boolean(dept.isGroup));
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Department Code and Name are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingDept) {
        await updateDepartment(editingDept.id, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          coordinator: coordinator.trim(),
          isGroup,
        });
        setEditingDept(null);
      } else {
        await createDepartment({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          coordinator: coordinator.trim(),
          isGroup,
        });
        setShowAddModal(false);
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubject = async (subjectId: string, destDeptId: string) => {
    if (!destDeptId || destDeptId === selectedDeptDetail?.id) return;
    try {
      setTransferLoading(true);
      await transferSubjectDepartment(subjectId, destDeptId);
      setTransferringSubjectId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to transfer subject');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async (id: string, deptName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${deptName}"?\nThis action will remove the department definition. Historical forms and marks will remain preserved.`
    );
    if (!confirmed) return;

    try {
      await deleteDepartment(id);
      if (selectedDeptDetail?.id === id) {
        setSelectedDeptDetail(null);
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete department');
    }
  };

  const filteredDepts = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-100">Department Management</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize college faculty departments, assign subjects, view student enrollments and examination forms.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </button>
      </div>

      {/* Search and Stats bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search departments by code or name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <span className="text-xs text-slate-400">
          Total Departments: <strong className="text-slate-200 font-mono">{departments.length}</strong>
        </span>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDepts.map((dept) => {
          const deptSubjects = subjects.filter((s) => s.departmentId === dept.id);
          const deptForms = forms.filter((f) => f.departmentId === dept.id);
          const deptStudents = students.filter((s) => s.departmentId === dept.id);

          return (
            <div
              key={dept.id}
              className={`p-5 bg-slate-900 border rounded-2xl shadow-lg transition-all flex flex-col justify-between ${
                dept.isGroup
                  ? 'border-indigo-500/40 hover:border-indigo-400 bg-gradient-to-b from-slate-900 to-indigo-950/20'
                  : 'border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {dept.code}
                    </span>
                    {dept.isGroup ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        <Layers className="w-3 h-3" />
                        Parent Group
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-800">
                        Department
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(dept)}
                      className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Edit department"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id, dept.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-100 text-base">{dept.name}</h3>
                {dept.coordinator && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-300 font-medium bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    <UserCheck className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span className="truncate">In-Charge: {dept.coordinator}</span>
                  </div>
                )}
                {dept.description && (
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{dept.description}</p>
                )}

                {/* Assigned Subjects Summary Preview */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-blue-400" />
                      Assigned Subjects ({deptSubjects.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                    {deptSubjects.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic">No subjects assigned yet</span>
                    ) : (
                      deptSubjects.map((s) => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-300"
                          title={`${s.code}: ${s.name}`}
                        >
                          <strong className="text-blue-400">{s.code}</strong> {s.name.slice(0, 16)}...
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Subjects</span>
                    <strong className="text-slate-200 font-mono">{deptSubjects.length}</strong>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Forms</span>
                    <strong className="text-blue-400 font-mono">{deptForms.length}</strong>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Students</span>
                    <strong className="text-emerald-400 font-mono">{deptStudents.length}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setSelectedDeptDetail(dept)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <span>Manage Subjects & Transfer</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingDept) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingDept(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-2">
              {editingDept ? 'Edit Department / Parent Group' : 'Add New Department / Parent Group'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Create single faculty departments or hybrid parent groups that manage multiple subjects under one coordinator.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGroup}
                    onChange={(e) => setIsGroup(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Designate as Parent Department / Hybrid Group
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Enable this if one faculty/department head manages multiple subjects jointly (e.g. History & AIH&C Group).
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Department / Group Code *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. HIST-GRP, CS, PHY, BCA"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono uppercase focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Department / Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. History & AIH&C Group, Dept. of Computer Science"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Faculty Coordinator / Head In-Charge (Optional)
                </label>
                <input
                  type="text"
                  value={coordinator}
                  onChange={(e) => setCoordinator(e.target.value)}
                  placeholder="e.g. Dr. R. P. Sharma (Managing History & AIH&C)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Description / Remarks
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Joint humanities group, laboratory facilities, faculty assignments, etc."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDept(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : editingDept ? 'Update Department' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Detail Modal (manage department-wise subjects, transfers, forms) */}
      {selectedDeptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 my-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {selectedDeptDetail.code}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{selectedDeptDetail.name}</h3>
                {selectedDeptDetail.isGroup && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Parent Group
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedDeptDetail(null);
                  setTransferringSubjectId(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-5 py-4">
              {selectedDeptDetail.coordinator && (
                <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200">
                  <span className="font-semibold block text-indigo-400 uppercase text-[10px]">Coordinator In-Charge</span>
                  <p className="mt-0.5 font-medium">{selectedDeptDetail.coordinator}</p>
                </div>
              )}

              {/* Subjects in this dept */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    Assigned Subjects ({subjects.filter((s) => s.departmentId === selectedDeptDetail.id).length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Each subject has its own permanent ID and curriculum mapping
                  </span>
                </div>

                <div className="space-y-2">
                  {subjects.filter((s) => s.departmentId === selectedDeptDetail.id).length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                      No subjects are assigned to this parent department yet. Use Subject Management or transfer subjects here.
                    </div>
                  ) : (
                    subjects
                      .filter((s) => s.departmentId === selectedDeptDetail.id)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-400">{s.code}</span>
                              <span className="text-slate-200 font-semibold">{s.name}</span>
                            </div>
                            <span className="text-slate-500 text-[11px] block mt-0.5">
                              {s.course} • {s.semester} {s.section ? `• ${s.section}` : ''} • ID: <span className="font-mono text-slate-600">{s.id}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {transferringSubjectId === s.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={targetDeptId}
                                  onChange={(e) => setTargetDeptId(e.target.value)}
                                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none"
                                >
                                  <option value="">Choose New Parent Group...</option>
                                  {departments
                                    .filter((d) => d.id !== selectedDeptDetail.id)
                                    .map((d) => (
                                      <option key={d.id} value={d.id}>
                                        {d.name} ({d.code}) {d.isGroup ? '• Parent Group' : ''}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!targetDeptId || transferLoading}
                                  onClick={() => handleTransferSubject(s.id, targetDeptId)}
                                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs disabled:opacity-50"
                                >
                                  {transferLoading ? 'Moving...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTransferringSubjectId(null)}
                                  className="text-slate-400 hover:text-slate-200 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferringSubjectId(s.id);
                                  setTargetDeptId('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                                <span>Transfer Parent Group</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Forms in this dept */}
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                  <FileEdit className="w-4 h-4 text-emerald-400" />
                  Practical Examination Forms ({forms.filter((f) => f.departmentId === selectedDeptDetail.id).length})
                </h4>
                <div className="space-y-1.5">
                  {forms
                    .filter((f) => f.departmentId === selectedDeptDetail.id)
                    .map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-200">{f.title}</span>
                          <span className="text-slate-500 block text-[11px]">{f.subjectCode} • Max: {f.maxMarks} • Pass: {f.minPassingMarks}</span>
                        </div>
                        <span className="font-mono text-emerald-400 uppercase text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {f.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setSelectedDeptDetail(null);
                  setTransferringSubjectId(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
