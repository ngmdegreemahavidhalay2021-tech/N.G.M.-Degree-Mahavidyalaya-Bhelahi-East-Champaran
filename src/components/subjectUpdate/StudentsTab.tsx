import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStudent,
  SubjectUpdateStudentGroup,
} from '../../types';
import {
  autoAllocateSubjectUpdateStudents,
  createSubjectUpdateStudent,
  StudentPayload,
  updateSubjectUpdateStudent,
  uploadSubjectUpdateStudentsBatch,
} from '../../services/subjectUpdateSystemService';

interface StudentsTabProps {
  students: SubjectUpdateStudent[];
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

interface ParsedStudentRow {
  sn: string;
  studentName: string;
  rollNumber: string;
  rawSubjectText: string;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
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
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ALLOCATED' | 'PARTIAL' | 'UNMATCHED'>('ALL');
  const [filterGroupId, setFilterGroupId] = useState('ALL');

  // Upload states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadSession, setUploadSession] = useState(
    defaultSession || sessions[0]?.sessionName || '2024-28'
  );
  const [uploadSemester, setUploadSemester] = useState(
    semesters[0]?.semesterName || 'Semester 1'
  );
  const [uploadCategory, setUploadCategory] = useState(
    defaultCategory || categories[0]?.code || 'MJC'
  );
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [previewRows, setPreviewRows] = useState<ParsedStudentRow[]>([]);
  const [previewFileName, setPreviewFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [allocating, setAllocating] = useState(false);

  // Add / Edit Student Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateStudent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StudentPayload>({
    sn: '1',
    studentName: '',
    rollNumber: '',
    rawSubjectText: '',
    session: defaultSession || sessions[0]?.sessionName || '2024-28',
    semester: semesters[0]?.semesterName || 'Semester 1',
    category: defaultCategory || categories[0]?.code || 'MJC',
    matchedSubjectIds: [],
    combinationId: '',
    groupId: '',
    notes: '',
  });

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (filterSession !== 'ALL' && st.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && st.semester !== filterSemester) return false;
      if (filterCategory !== 'ALL' && st.category !== filterCategory) return false;
      if (filterStatus !== 'ALL' && st.allocationStatus !== filterStatus) return false;
      if (filterGroupId !== 'ALL') {
        if (filterGroupId === 'UNGROUPED' && st.groupId) return false;
        if (filterGroupId !== 'UNGROUPED' && st.groupId !== filterGroupId) return false;
      }
      if (!q) return true;
      return (
        st.studentName.toLowerCase().includes(q) ||
        st.rollNumber.toLowerCase().includes(q) ||
        st.sn.toLowerCase().includes(q) ||
        st.rawSubjectText.toLowerCase().includes(q) ||
        (st.combinationName || '').toLowerCase().includes(q) ||
        (st.groupName || '').toLowerCase().includes(q) ||
        st.matchedSubjectNames.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [
    students,
    search,
    filterSession,
    filterSemester,
    filterCategory,
    filterStatus,
    filterGroupId,
  ]);

  const stats = useMemo(() => {
    const allocated = students.filter((s) => s.allocationStatus === 'ALLOCATED').length;
    const partial = students.filter((s) => s.allocationStatus === 'PARTIAL').length;
    const unmatched = students.filter((s) => s.allocationStatus === 'UNMATCHED').length;
    return { total: students.length, allocated, partial, unmatched };
  }, [students]);

  const handleDownloadTemplate = () => {
    const templateRows = [
      {
        'SN.': 1,
        'NAME OF STUDENT': 'Aarav Kumar',
        'ROLL NO.': '2401001',
        SUBJECT: 'Physics, Chemistry, Mathematics',
      },
      {
        'SN.': 2,
        'NAME OF STUDENT': 'Priya Kumari',
        'ROLL NO.': '2401002',
        SUBJECT: 'Botany + Zoology',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'SUBJECT_UPDATE_Student_Upload_Template.xlsx');
    onNotify('success', 'Downloaded Student Excel template (SN., NAME OF STUDENT, ROLL NO., SUBJECT).');
  };

  const handleExportStudents = () => {
    const rows = filteredStudents.map((s) => ({
      'SN.': s.sn,
      'NAME OF STUDENT': s.studentName,
      'ROLL NO.': s.rollNumber,
      SUBJECT: s.rawSubjectText,
      Session: s.session,
      Semester: s.semester,
      Category: s.category,
      'Matched Subjects': s.matchedSubjectNames.join(', '),
      'Subject Combination': s.combinationName || '',
      'Student Group': s.groupName || '',
      'Allocation Status': s.allocationStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student Allocations');
    XLSX.writeFile(wb, `SUBJECT_UPDATE_Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onNotify('success', `Exported ${filteredStudents.length} student records to Excel.`);
  };

  const normalizeRow = (raw: Record<string, any>, index: number): ParsedStudentRow => {
    const map = new Map<string, any>();
    Object.entries(raw || {}).forEach(([k, v]) => {
      map.set(k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), v);
    });
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const val = map.get(k);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
      return '';
    };

    return {
      sn: pick('sn', 'sno', 'serialno', 'serialnumber') || String(index + 1),
      studentName: pick('nameofstudent', 'studentname', 'name', 'candidate'),
      rollNumber: pick('rollno', 'rollnumber', 'roll', 'universityrollno'),
      rawSubjectText: pick('subject', 'subjects', 'subjectcombination', 'combination', 'paper'),
    };
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      const rawRows = firstSheet
        ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], { defval: '' })
        : [];
      const parsed = rawRows
        .map((r, idx) => normalizeRow(r, idx))
        .filter((r) => r.studentName || r.rollNumber);

      if (parsed.length === 0) {
        onNotify(
          'error',
          'No valid student rows found. Expected columns: SN., NAME OF STUDENT, ROLL NO., SUBJECT.'
        );
        setPreviewRows([]);
      } else {
        setPreviewRows(parsed);
        onNotify(
          'success',
          `Parsed ${parsed.length} rows from "${file.name}". Review preview and click Upload & Auto-Allocate.`
        );
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to parse student Excel file.');
      setPreviewRows([]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommitUpload = async () => {
    if (previewRows.length === 0) return;
    setUploading(true);
    try {
      const res = await uploadSubjectUpdateStudentsBatch({
        rows: previewRows,
        session: uploadSession,
        semester: uploadSemester,
        category: uploadCategory,
        duplicateStrategy,
      });
      setPreviewRows([]);
      await onRefresh();
      onNotify(
        'success',
        `Upload complete: ${res.createdCount} added, ${res.updatedCount} updated, ${res.skippedCount} skipped. Matched: ${res.allocatedCount} allocated, ${res.partialCount} partial, ${res.unmatchedCount} unmatched.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to upload students.');
    } finally {
      setUploading(false);
    }
  };

  const handleAutoAllocateAll = async () => {
    setAllocating(true);
    try {
      const res = await autoAllocateSubjectUpdateStudents({
        session: filterSession,
        semester: filterSemester,
        category: filterCategory,
      });
      await onRefresh();
      onNotify(
        'success',
        `Re-evaluated ${res.updatedCount} students: ${res.allocatedCount} allocated, ${res.partialCount} partial, ${res.unmatchedCount} unmatched.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Auto-allocation failed.');
    } finally {
      setAllocating(false);
    }
  };

  const openAddModal = () => {
    setEditing(null);
    setForm({
      sn: String(students.length + 1),
      studentName: '',
      rollNumber: '',
      rawSubjectText: '',
      session: defaultSession || sessions[0]?.sessionName || '2024-28',
      semester: semesters[0]?.semesterName || 'Semester 1',
      category: defaultCategory || categories[0]?.code || 'MJC',
      matchedSubjectIds: [],
      combinationId: '',
      groupId: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (st: SubjectUpdateStudent) => {
    setEditing(st);
    setForm({
      sn: st.sn,
      studentName: st.studentName,
      rollNumber: st.rollNumber,
      rawSubjectText: st.rawSubjectText,
      session: st.session,
      semester: st.semester,
      category: st.category,
      matchedSubjectIds: st.matchedSubjectIds || [],
      combinationId: st.combinationId || '',
      groupId: st.groupId || '',
      notes: st.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSubjectUpdateStudent(editing.id, form);
        onNotify('success', `Updated student "${updated.studentName} (${updated.rollNumber})".`);
      } else {
        const created = await createSubjectUpdateStudent(form);
        onNotify('success', `Added student "${created.studentName} (${created.rollNumber})".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save student record.');
    } finally {
      setSaving(false);
    }
  };

  const modalSubjects = useMemo(
    () =>
      subjects.filter(
        (s) => s.session === form.session && s.semester === form.semester
      ),
    [subjects, form.session, form.semester]
  );

  const modalCombinations = useMemo(
    () =>
      combinations.filter(
        (c) => c.session === form.session && c.semester === form.semester
      ),
    [combinations, form.session, form.semester]
  );

  const modalGroups = useMemo(
    () =>
      groups.filter(
        (g) => g.session === form.session && g.semester === form.semester
      ),
    [groups, form.session, form.semester]
  );

  return (
    <div className="space-y-4">
      {/* Excel Upload Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Student Excel Upload & Automatic Allocation
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload Excel sheets with columns <span className="font-mono text-slate-200">SN.</span>,{' '}
              <span className="font-mono text-slate-200">NAME OF STUDENT</span>,{' '}
              <span className="font-mono text-slate-200">ROLL NO.</span>, and{' '}
              <span className="font-mono text-slate-200">SUBJECT</span> for case-insensitive subject and combination matching.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel Template
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Student
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
          <select
            value={uploadSession}
            onChange={(e) => setUploadSession(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.sessionName}>
                Upload Session: {s.sessionName}
              </option>
            ))}
          </select>

          <select
            value={uploadSemester}
            onChange={(e) => setUploadSemester(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.semesterName}>
                Upload Sem: {s.semesterName}
              </option>
            ))}
          </select>

          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                Category: {c.code}
              </option>
            ))}
          </select>

          <select
            value={duplicateStrategy}
            onChange={(e) => setDuplicateStrategy(e.target.value as 'skip' | 'update')}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="skip">Duplicate Roll No: Skip</option>
            <option value="update">Duplicate Roll No: Update</option>
          </select>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFilePicked}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Choose Excel File
            </button>
          </div>
        </div>

        {previewRows.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-200">
                Previewing <strong>{previewRows.length}</strong> students from{' '}
                <span className="font-mono text-blue-300">{previewFileName}</span> for{' '}
                <span className="font-mono">{uploadSession}</span> · {uploadSemester} · {uploadCategory}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewRows([])}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleCommitUpload}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading & Matching...' : `Upload & Auto-Allocate (${previewRows.length})`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="px-3 py-2">SN.</th>
                    <th className="px-3 py-2">NAME OF STUDENT</th>
                    <th className="px-3 py-2">ROLL NO.</th>
                    <th className="px-3 py-2">SUBJECT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {previewRows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-slate-400">{r.sn}</td>
                      <td className="px-3 py-1.5 text-slate-100">{r.studentName || 'MISSING'}</td>
                      <td className="px-3 py-1.5 font-mono text-blue-300">{r.rollNumber || 'MISSING'}</td>
                      <td className="px-3 py-1.5 text-slate-300">{r.rawSubjectText || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Student Management Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>
              Total: <strong className="font-mono tabular-nums text-slate-100">{stats.total}</strong>
            </span>
            <span className="text-emerald-400">
              Allocated: <strong className="font-mono tabular-nums">{stats.allocated}</strong>
            </span>
            <span className="text-amber-400">
              Partial: <strong className="font-mono tabular-nums">{stats.partial}</strong>
            </span>
            <span className="text-rose-400">
              Unmatched: <strong className="font-mono tabular-nums">{stats.unmatched}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={allocating || students.length === 0}
              onClick={handleAutoAllocateAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${allocating ? 'animate-spin' : ''}`} />
              Re-Run Auto-Allocation
            </button>
            <button
              type="button"
              onClick={handleExportStudents}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
          <div className="relative xl:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student name, roll no, subject, group..."
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
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Allocation Status</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="PARTIAL">Partial Match</option>
            <option value="UNMATCHED">Unmatched</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Showing <strong className="font-mono text-slate-100">{filteredStudents.length}</strong> of{' '}
            <strong className="font-mono text-slate-100">{students.length}</strong> students
          </span>
          <select
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Student Groups</option>
            <option value="UNGROUPED">Ungrouped Only</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.groupCode} · {g.groupName}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3">SN.</th>
                <th className="px-3 py-3">Roll No.</th>
                <th className="px-3 py-3">Student Name</th>
                <th className="px-3 py-3">Uploaded Subject / Matched</th>
                <th className="px-3 py-3">Combination / Group</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No student records match the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-400">{st.sn}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-blue-300 whitespace-nowrap">
                      {st.rollNumber}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-100">{st.studentName}</div>
                      <div className="text-[11px] text-slate-400">
                        {st.session} · {st.semester} · {st.category}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-200">{st.rawSubjectText || '—'}</div>
                      {st.matchedSubjectNames.length > 0 && (
                        <div className="text-[11px] text-emerald-400 mt-0.5">
                          Matched: {st.matchedSubjectNames.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-200">{st.combinationName || '—'}</div>
                      <div className="text-[11px] text-slate-400">
                        {st.groupName ? `Group: ${st.groupName}` : 'No group assigned'}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                          st.allocationStatus === 'ALLOCATED'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : st.allocationStatus === 'PARTIAL'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {st.allocationStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(st)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Edit / Reassign Student"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDelete(st.id, `${st.studentName} (Roll ${st.rollNumber})`)
                          }
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Delete Student"
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

      {/* Add / Edit & Reassign Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editing ? `Edit & Reassign Student (${editing.rollNumber})` : 'Add Student Record'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">SN.</label>
                  <input
                    type="text"
                    value={form.sn || ''}
                    onChange={(e) => setForm((p) => ({ ...p, sn: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.rollNumber}
                    onChange={(e) => setForm((p) => ({ ...p, rollNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.studentName}
                    onChange={(e) => setForm((p) => ({ ...p, studentName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Session *</label>
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
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Semester *</label>
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
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Category *</label>
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

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Uploaded Subject Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Physics, Chemistry, Mathematics"
                  value={form.rawSubjectText}
                  onChange={(e) => setForm((p) => ({ ...p, rawSubjectText: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Assigned Combination
                  </label>
                  <select
                    value={form.combinationId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, combinationId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">Auto / None</option>
                    {modalCombinations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.combinationCode} · {c.combinationName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Assigned Student Group
                  </label>
                  <select
                    value={form.groupId || ''}
                    onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">Unassigned</option>
                    {modalGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.groupCode} · {g.groupName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-400">
                  Manually Assign Subjects (Optional)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {modalSubjects.length === 0 ? (
                    <div className="col-span-2 text-xs text-slate-400 p-2">
                      No subjects in {form.session} · {form.semester}.
                    </div>
                  ) : (
                    modalSubjects.map((s) => {
                      const checked = (form.matchedSubjectIds || []).includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/50 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm((p) => {
                                const list = p.matchedSubjectIds || [];
                                return {
                                  ...p,
                                  matchedSubjectIds: list.includes(s.id)
                                    ? list.filter((id) => id !== s.id)
                                    : [...list, s.id],
                                };
                              })
                            }
                            className="rounded border-slate-700 bg-slate-900 text-blue-600"
                          />
                          <span className="font-mono text-blue-300">{s.subjectCode}</span>
                          <span className="text-slate-200 truncate">{s.subjectName}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes || ''}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
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
                  {saving ? 'Saving...' : editing ? 'Save Reassignment' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
