import React, { useState } from 'react';
import {
  FileEdit,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  Layers,
  Lock,
  Unlock,
  Eye,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  FileCheck,
  Calendar,
} from 'lucide-react';
import { PracticalForm, Department, Subject } from '../types';
import {
  createPracticalForm,
  updatePracticalForm,
  duplicatePracticalForm,
  deletePracticalForm,
  regenerateFormToken,
} from '../services/collegeService';

interface FormBuilderModuleProps {
  forms: PracticalForm[];
  departments: Department[];
  subjects: Subject[];
  onRefresh: () => void;
  onOpenMarksView: (form: PracticalForm) => void;
  onOpenStudentEnrollment: (form: PracticalForm) => void;
}

export const FormBuilderModule: React.FC<FormBuilderModuleProps> = ({
  forms,
  departments,
  subjects,
  onRefresh,
  onOpenMarksView,
  onOpenStudentEnrollment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState<PracticalForm | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [course, setCourse] = useState('B.Sc. Computer Science');
  const [semester, setSemester] = useState('Semester III');
  const [section, setSection] = useState('Section A');
  const [examName, setExamName] = useState('Winter 2024 End Semester Practical Evaluation');
  const [examYear, setExamYear] = useState('2024-2025');
  const [maxMarks, setMaxMarks] = useState(50);
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowDecimals, setAllowDecimals] = useState(true);
  const [instructions, setInstructions] = useState(
    '1. Verify candidate roll number.\n2. Input practical and viva score.\n3. Save marks before leaving.'
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>('published');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setTitle('');
    setDepartmentId(departments[0]?.id || '');
    setSubjectId(subjects[0]?.id || '');
    setMaxMarks(50);
    setExamDate(new Date().toISOString().slice(0, 10));
    setAllowDecimals(true);
    setStatus('published');
    setError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (form: PracticalForm) => {
    setEditingForm(form);
    setTitle(form.title);
    setDepartmentId(form.departmentId);
    setSubjectId(form.subjectId);
    setCourse(form.course);
    setSemester(form.semester);
    setSection(form.section || '');
    setExamName(form.examName);
    setExamYear(form.examYear);
    setMaxMarks(form.maxMarks);
    setExamDate(form.examDate);
    setAllowDecimals(form.allowDecimals);
    setInstructions(form.instructions || '');
    setStatus(form.status);
    setError(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !departmentId || !subjectId) {
      setError('Form title, department, and subject are required.');
      return;
    }

    const selectedSubj = subjects.find((s) => s.id === subjectId);
    const subjectCode = selectedSubj?.code || 'PRACTICAL';
    const subjectName = selectedSubj?.name || title;

    try {
      setLoading(true);
      setError(null);

      if (editingForm) {
        await updatePracticalForm(editingForm.id, {
          title: title.trim(),
          departmentId,
          subjectId,
          subjectCode,
          subjectName,
          course,
          semester,
          section,
          examName,
          examYear,
          maxMarks: Number(maxMarks),
          instructions,
          examDate,
          allowDecimals,
          status,
        });
        setEditingForm(null);
      } else {
        await createPracticalForm({
          title: title.trim(),
          departmentId,
          subjectId,
          subjectCode,
          subjectName,
          course,
          semester,
          section,
          examName,
          examYear,
          maxMarks: Number(maxMarks),
          instructions,
          examDate,
          allowDecimals,
          status,
          isActive: true,
          isStudentListLocked: status === 'published',
        });
        setShowCreateModal(false);
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save form');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicatePracticalForm(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate form');
    }
  };

  const handleDelete = async (id: string, titleStr: string) => {
    const ok = window.confirm(`Permanently delete practical form "${titleStr}"?`);
    if (!ok) return;

    try {
      await deletePracticalForm(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete form');
    }
  };

  const handleRegenerateToken = async (id: string) => {
    const ok = window.confirm('Regenerate public shareable link? The previous link will immediately stop working.');
    if (!ok) return;

    try {
      await regenerateFormToken(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate link');
    }
  };

  const handleToggleStatus = async (form: PracticalForm, newStatus: 'draft' | 'published' | 'closed') => {
    try {
      await updatePracticalForm(form.id, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleToggleActive = async (form: PracticalForm) => {
    try {
      await updatePracticalForm(form.id, { isActive: !form.isActive });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle active state');
    }
  };

  const handleToggleLock = async (form: PracticalForm) => {
    const willLock = !form.isStudentListLocked;
    const ok = window.confirm(
      willLock
        ? 'Lock verified student list? After locking, public link users can only enter marks for assigned students.'
        : 'Unlock student list? This permits administrator editing of the candidate roster.'
    );
    if (!ok) return;

    try {
      await updatePracticalForm(form.id, { isStudentListLocked: willLock });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle lock');
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-100">Dynamic Practical Form Builder</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create unlimited practical examination forms independently, similar to Google Forms. Every form gets an isolated token and independent link.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Practical Form</span>
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
            placeholder="Search forms by title or subject code..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredForms.map((form) => {
          const shareUrl = `${window.location.origin}/?token=${form.token}`;
          return (
            <div
              key={form.id}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                {/* Status Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {form.subjectCode}
                    </span>
                    <button
                      onClick={() => handleToggleActive(form)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                        form.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Toggle active status"
                    >
                      {form.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      form.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        : form.status === 'closed'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    }`}
                  >
                    {form.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-100 text-base line-clamp-1">{form.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                  {form.course} • {form.semester} {form.section ? `(${form.section})` : ''}
                </p>

                {/* Info strip */}
                <div className="mt-3.5 space-y-1 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Examination:</span>
                    <strong className="text-slate-300 font-mono text-[11px] truncate max-w-[170px]">{form.examName}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Exam Date:</span>
                    <strong className="text-slate-300 font-mono">{form.examDate}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Maximum Marks:</span>
                    <strong className="text-amber-400 font-mono">{form.maxMarks}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Student List:</span>
                    <button
                      onClick={() => handleToggleLock(form)}
                      className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                        form.isStudentListLocked ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {form.isStudentListLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{form.isStudentListLocked ? 'Locked' : 'Open'}</span>
                    </button>
                  </div>
                </div>

                {/* Share Link Preview */}
                <div className="mt-3 p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-slate-400 truncate">
                    ?token={form.token.slice(0, 14)}...
                  </span>
                  <button
                    onClick={() => handleCopyLink(form.token)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0"
                    title="Copy unique public examiner link"
                  >
                    {copiedToken === form.token ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedToken === form.token ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onOpenMarksView(form)}
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-center transition-colors"
                  >
                    Manage Marks
                  </button>
                  <button
                    onClick={() => onOpenStudentEnrollment(form)}
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-center transition-colors"
                  >
                    Verify Students
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(form)}
                      className="p-1 text-slate-400 hover:text-slate-200"
                      title="Edit Form"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(form.id)}
                      className="p-1 text-slate-400 hover:text-indigo-300"
                      title="Duplicate Form"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRegenerateToken(form.id)}
                      className="p-1 text-slate-400 hover:text-amber-300"
                      title="Regenerate Public Link"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(form.id, form.title)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Delete Form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <select
                    value={form.status}
                    onChange={(e) => handleToggleStatus(form, e.target.value as any)}
                    className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-300 font-medium"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Publish</option>
                    <option value="closed">Close</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Form Modal */}
      {(showCreateModal || editingForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setEditingForm(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-100 mb-2">
              {editingForm ? 'Edit Practical Examination Form' : 'Build New Practical Examination Form'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Specify examination metadata, curriculum subjects, maximum marks, and instructions.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Practical Form Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms Lab - Final Practical"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Department *
                  </label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Subject *
                  </label>
                  <select
                    required
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Course / Degree
                  </label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="B.Sc. Computer Science"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="Semester III"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="Section A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Examination Session Name
                  </label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. Winter 2024 End Semester Examination"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={examYear}
                    onChange={(e) => setExamYear(e.target.value)}
                    placeholder="2024-2025"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    required
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Allow Decimals
                  </label>
                  <select
                    value={allowDecimals ? 'YES' : 'NO'}
                    onChange={(e) => setAllowDecimals(e.target.value === 'YES')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="YES">Yes (e.g. 42.5)</option>
                    <option value="NO">No (Integers Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Examination Instructions for Examiners
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instructions displayed at the top of the teacher's evaluation form..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Initial Publication Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="published">Published (Link is immediately active)</option>
                  <option value="draft">Draft (Restricted / Unpublished)</option>
                  <option value="closed">Closed (Submissions disabled)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingForm(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : editingForm ? 'Update Form' : 'Generate Practical Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
