import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  FileEdit,
  Building2,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { Subject, Department, PracticalForm } from '../types';
import {
  createSubject,
  updateSubject,
  deleteSubject,
  transferSubjectDepartment,
} from '../services/collegeService';

interface SubjectModuleProps {
  subjects: Subject[];
  departments: Department[];
  forms: PracticalForm[];
  onRefresh: () => void;
  onCreateFormForSubject: (subject: Subject) => void;
}

export const SubjectModule: React.FC<SubjectModuleProps> = ({
  subjects,
  departments,
  forms,
  onRefresh,
  onCreateFormForSubject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubj, setEditingSubj] = useState<Subject | null>(null);

  // Transfer subject state
  const [transferringSubjId, setTransferringSubjId] = useState<string | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Form fields
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('B.Sc. Computer Science');
  const [semester, setSemester] = useState('Semester III');
  const [section, setSection] = useState('Section A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setDepartmentId(departments[0]?.id || '');
    setCode('');
    setName('');
    setCourse('B.Sc. Computer Science');
    setSemester('Semester III');
    setSection('Section A');
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (subj: Subject) => {
    setEditingSubj(subj);
    setDepartmentId(subj.departmentId);
    setCode(subj.code);
    setName(subj.name);
    setCourse(subj.course);
    setSemester(subj.semester);
    setSection(subj.section || 'Section A');
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !departmentId) {
      setError('Please provide parent department, subject code and subject name.');
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    // Prevent duplicate subject entries
    const dup = subjects.find(
      (s) => s.code.trim().toUpperCase() === cleanCode && s.id !== editingSubj?.id
    );
    if (dup) {
      const existingDept = deptMap.get(dup.departmentId);
      setError(
        `Duplicate Subject Code: Subject "${cleanCode}" already exists as "${dup.name}" under ${existingDept?.name || 'another group'}. Each subject must retain its unique subject code and identity.`
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingSubj) {
        await updateSubject(editingSubj.id, {
          departmentId,
          code: cleanCode,
          name: cleanName,
          course,
          semester,
          section,
        });
        setEditingSubj(null);
      } else {
        await createSubject({
          departmentId,
          code: cleanCode,
          name: cleanName,
          course,
          semester,
          section,
        });
        setShowAddModal(false);
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save subject');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubject = async (subjectId: string, newDeptId: string) => {
    if (!newDeptId) return;
    try {
      setTransferLoading(true);
      await transferSubjectDepartment(subjectId, newDeptId);
      setTransferringSubjId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to transfer subject');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async (id: string, nameStr: string) => {
    const confirmed = window.confirm(
      `Delete subject "${nameStr}"?\nExisting practical examinations and historical marks for this subject will be preserved in records.`
    );
    if (!confirmed) return;

    try {
      await deleteSubject(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject');
    }
  };

  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || s.departmentId === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">Subject Management</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure curriculum courses, syllabus codes, parent department/group assignments, and generate examination forms.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, title or course..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Filter Dept:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Parent Departments & Groups</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code}) {d.isGroup ? '• Parent Group' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-28">Subject Code</th>
                <th className="py-3 px-4">Subject Name</th>
                <th className="py-3 px-4">Parent Dept / Group</th>
                <th className="py-3 px-4">Course & Semester</th>
                <th className="py-3 px-4 text-center">Forms Built</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-medium">No subjects found</p>
                    <p className="text-xs text-slate-500">Add subjects or adjust filters.</p>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((subj) => {
                  const dept = deptMap.get(subj.departmentId);
                  const subjForms = forms.filter((f) => f.subjectId === subj.id);

                  return (
                    <tr key={subj.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {subj.code}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {subj.name}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {dept ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-medium">
                              {dept.name} ({dept.code})
                            </span>
                            {dept.isGroup && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                <Layers className="w-2.5 h-2.5" />
                                Parent Group
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {subj.course} • {subj.semester} {subj.section ? `(${subj.section})` : ''}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                        {subjForms.length}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {transferringSubjId === subj.id ? (
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-700">
                              <select
                                value={targetDeptId}
                                onChange={(e) => setTargetDeptId(e.target.value)}
                                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                              >
                                <option value="">Select New Parent...</option>
                                {departments
                                  .filter((d) => d.id !== subj.departmentId)
                                  .map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name} ({d.code}) {d.isGroup ? '• Group' : ''}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                disabled={!targetDeptId || transferLoading}
                                onClick={() => handleTransferSubject(subj.id, targetDeptId)}
                                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs disabled:opacity-50"
                              >
                                {transferLoading ? '...' : 'Transfer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransferringSubjId(null)}
                                className="px-1 text-slate-400 hover:text-slate-200 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTransferringSubjId(subj.id);
                                setTargetDeptId('');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              title="Transfer subject to another Parent Department / Group"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                              <span>Transfer</span>
                            </button>
                          )}

                          <button
                            onClick={() => onCreateFormForSubject(subj)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300 border border-emerald-500/20 transition-colors"
                            title="Create new examination form for this subject"
                          >
                            <FileEdit className="w-3 h-3" />
                            <span>Create Form</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(subj)}
                            className="p-1.5 text-slate-400 hover:text-indigo-300 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Edit subject"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(subj.id, subj.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
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
      {/* Modal Add / Edit */}
      {(showAddModal || editingSubj) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingSubj(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-4">
              {editingSubj ? 'Edit Subject Details' : 'Add New Curriculum Subject'}
            </h3>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Assign to Parent Department / Group *
                </label>
                <select
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code}) {d.isGroup ? '— [Parent Group]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CS301P"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Course / Degree *
                  </label>
                  <input
                    type="text"
                    required
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="B.Sc. Computer Science"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Subject Title *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms Practical"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="Semester III"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Section (Optional)
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="Section A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSubj(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : editingSubj ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
