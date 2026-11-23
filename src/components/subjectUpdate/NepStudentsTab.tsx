import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Edit3,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  SubjectUpdateDepartment,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStudent,
} from '../../types';
import {
  createSubjectUpdateStudent,
  updateSubjectUpdateStudent,
  uploadSubjectUpdateStudentsBatch,
} from '../../services/subjectUpdateSystemService';

interface NepStudentsTabProps {
  students: SubjectUpdateStudent[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  departments: SubjectUpdateDepartment[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
  onRequestDeleteStudent: (student: SubjectUpdateStudent) => void;
}

interface ParsedStudentRow {
  sn: string;
  applicationNo: string;
  studentName: string;
  rollNumber: string;
  departmentName: string;
}

export const NepStudentsTab: React.FC<NepStudentsTabProps> = ({
  students,
  sessions,
  semesters,
  departments,
  onRefresh,
  onToast,
  onRequestDeleteStudent,
}) => {
  const [search, setSearch] = useState('');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  // Upload state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadSession, setUploadSession] = useState(
    sessions.find((s) => s.sessionName === '2026-30')?.sessionName || sessions[0]?.sessionName || '2026-30'
  );
  const [uploadSemester, setUploadSemester] = useState(semesters[0]?.semesterName || 'Semester 1');
  const [uploadDept, setUploadDept] = useState(departments[0]?.name || 'General');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [previewRows, setPreviewRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Add/Edit Student modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateStudent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    applicationNo: '',
    studentName: '',
    rollNumber: '',
    departmentName: departments[0]?.name || 'General',
    session: sessions[0]?.sessionName || '2026-30',
    semester: semesters[0]?.semesterName || 'Semester 1',
  });

  const deptNames = useMemo(() => {
    const set = new Set<string>(['General']);
    departments.forEach((d) => set.add(d.name));
    students.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (filterSession !== 'ALL' && s.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && s.semester !== filterSemester) return false;
      if (filterDepartment !== 'ALL' && (s.departmentName || 'General') !== filterDepartment) return false;
      if (!q) return true;
      return (
        (s.applicationNo || '').toLowerCase().includes(q) ||
        s.studentName.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        (s.departmentName || '').toLowerCase().includes(q)
      );
    });
  }, [students, search, filterSession, filterSemester, filterDepartment]);

  const handleDownloadTemplate = () => {
    const sample = [
      {
        'APPLICATION NO.': 'NGM260001',
        'NAME OF STUDENT': 'Aarav Kumar',
        'ROLL NO.': '26001',
        DEPARTMENT: departments[0]?.name || 'HISTORY',
      },
      {
        'APPLICATION NO.': 'NGM260002',
        'NAME OF STUDENT': 'Priya Kumari',
        'ROLL NO.': '26002',
        DEPARTMENT: departments[0]?.name || 'HISTORY',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'NEP_Students_Template.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.SheetNames[0];
      const raw: Record<string, any>[] = sheet
        ? XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })
        : [];

      const parsed: ParsedStudentRow[] = raw
        .map((r, idx) => {
          const normMap = new Map<string, any>();
          Object.entries(r).forEach(([k, v]) => {
            normMap.set(k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), v);
          });
          const pick = (...keys: string[]) => {
            for (const k of keys) {
              const v = normMap.get(k);
              if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
            }
            return '';
          };
          const appNo = pick('applicationno', 'appno', 'applicationnumber', 'regno', 'registrationno');
          const rollNo = pick('rollno', 'rollnumber', 'roll');
          const studentName = pick('nameofstudent', 'studentname', 'name');
          const dept = pick('department', 'dept', 'departmentname');
          const sn = pick('sn', 'sno', 'serialno') || String(idx + 1);
          return {
            sn,
            applicationNo: appNo || rollNo,
            studentName,
            rollNumber: rollNo || appNo,
            departmentName: dept || uploadDept,
          };
        })
        .filter((r) => r.studentName && (r.applicationNo || r.rollNumber));

      if (parsed.length === 0) {
        onToast('error', 'No valid student rows found. Expected APPLICATION NO., NAME OF STUDENT, ROLL NO.');
        setPreviewRows([]);
      } else {
        setPreviewRows(parsed);
        onToast('success', `Loaded ${parsed.length} student rows from "${file.name}". Review and Upload.`);
      }
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to read spreadsheet file.');
      setPreviewRows([]);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleUploadConfirm = async () => {
    if (previewRows.length === 0) return;
    setUploading(true);
    try {
      const res = await uploadSubjectUpdateStudentsBatch({
        rows: previewRows,
        session: uploadSession,
        semester: uploadSemester,
        departmentName: uploadDept,
        category: 'MAJOR',
        duplicateStrategy,
      });
      onToast(
        'success',
        `Uploaded students: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`
      );
      setPreviewRows([]);
      setShowUploadPanel(false);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Student upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      applicationNo: '',
      studentName: '',
      rollNumber: '',
      departmentName: filterDepartment !== 'ALL' ? filterDepartment : deptNames[0] || 'General',
      session: filterSession !== 'ALL' ? filterSession : sessions[0]?.sessionName || '2026-30',
      semester: filterSemester !== 'ALL' ? filterSemester : semesters[0]?.semesterName || 'Semester 1',
    });
    setModalOpen(true);
  };

  const openEdit = (s: SubjectUpdateStudent) => {
    setEditing(s);
    setForm({
      applicationNo: s.applicationNo || s.rollNumber,
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      departmentName: s.departmentName || 'General',
      session: s.session,
      semester: s.semester,
    });
    setModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateSubjectUpdateStudent(editing.id, form);
        onToast('success', `Updated student "${form.studentName}".`);
      } else {
        await createSubjectUpdateStudent({ ...form, category: 'MAJOR' });
        onToast('success', `Added student "${form.studentName}".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Independent Students Registry</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload student lists from Excel/CSV (APPLICATION NO., NAME OF STUDENT, ROLL NO., DEPARTMENT) grouped by Session &amp; Semester.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUploadPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 border border-slate-700 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Excel / CSV Upload
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Student
          </button>
        </div>
      </div>

      {/* Excel Upload Panel */}
      {showUploadPanel && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">Upload Students Spreadsheet</h4>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Template
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Session *</label>
              <select
                value={uploadSession}
                onChange={(e) => setUploadSession(e.target.value)}
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
                value={uploadSemester}
                onChange={(e) => setUploadSemester(e.target.value)}
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
              <label className="block text-[11px] text-slate-400 mb-1">Default Department</label>
              <select
                value={uploadDept}
                onChange={(e) => setUploadDept(e.target.value)}
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
              <label className="block text-[11px] text-slate-400 mb-1">Duplicate Handling</label>
              <select
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value as 'skip' | 'update')}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              >
                <option value="skip">Skip existing</option>
                <option value="update">Update existing</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 border border-slate-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              {fileName ? `Selected: ${fileName}` : 'Choose Excel / CSV File'}
            </button>

            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={handleUploadConfirm}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import {previewRows.length} Students
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search app no., name, roll..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <select
          value={filterSession}
          onChange={(e) => setFilterSession(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
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
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
        >
          <option value="ALL">All Semesters</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.semesterName}>
              {s.semesterName}
            </option>
          ))}
        </select>

        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
        >
          <option value="ALL">All Departments</option>
          {deptNames.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">Application No.</th>
                <th className="px-4 py-3 font-semibold">Student Name</th>
                <th className="px-4 py-3 font-semibold">Roll No.</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Session · Sem</th>
                <th className="px-4 py-3 font-semibold">Form Assignment</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No students uploaded for this filter. Use "Excel / CSV Upload" or "Add Student".
                  </td>
                </tr>
              ) : (
                filtered.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {st.applicationNo || st.rollNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-100 font-medium">{st.studentName}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{st.rollNumber}</td>
                    <td className="px-4 py-3 text-slate-300">{st.departmentName || 'General'}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <span className="font-mono">{st.session}</span> · {st.semester}
                    </td>
                    <td className="px-4 py-3">
                      {st.selectionFormName ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px]">
                          {st.selectionFormName}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(st)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          title="Edit student"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDeleteStudent(st)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer"
                          title="Delete student"
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

      {/* Add/Edit Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveStudent}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">
                {editing ? 'Edit Student' : 'Add Student'}
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
                <label className="block text-[11px] text-slate-400 mb-1">Application No. *</label>
                <input
                  type="text"
                  required
                  value={form.applicationNo}
                  onChange={(e) => setForm({ ...form, applicationNo: e.target.value })}
                  placeholder="NGM260001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Roll No. *</label>
                <input
                  type="text"
                  required
                  value={form.rollNumber}
                  onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                  placeholder="26001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Student Name *</label>
              <input
                type="text"
                required
                value={form.studentName}
                onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                placeholder="Full student name"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Session *</label>
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
                <label className="block text-[11px] text-slate-400 mb-1">Semester *</label>
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
                <label className="block text-[11px] text-slate-400 mb-1">Department *</label>
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
