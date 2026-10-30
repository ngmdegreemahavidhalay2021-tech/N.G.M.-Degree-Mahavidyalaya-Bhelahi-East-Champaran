import React, { useState, useEffect, useRef } from 'react';
import {
  FileEdit,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  Layers,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  FileCheck,
  Calendar,
  Upload,
  Download,
  UserPlus,
  Users,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PracticalForm, Department, Subject, FormEnrollment, Student } from '../types';
import {
  createPracticalForm,
  updatePracticalForm,
  duplicatePracticalForm,
  deletePracticalForm,
  regenerateFormToken,
  getFormEnrollments,
  enrollStudentsInForm,
  removeStudentFromForm,
  batchImportStudents,
  generatePermanentStudentId,
  createStudent,
  logActivity,
} from '../services/collegeService';

interface FormBuilderModuleProps {
  forms: PracticalForm[];
  departments: Department[];
  subjects: Subject[];
  onRefresh: () => void;
  onOpenMarksView: (form: PracticalForm) => void;
  onOpenStudentEnrollment?: (form: PracticalForm) => void;
}

interface ParsedCandidateRow {
  id: string;
  rollNumber: string;
  studentName: string;
  fatherName: string;
  course: string;
  semester: string;
  section: string;
  hasError: boolean;
  errorMessage?: string;
  isDuplicate?: boolean;
}

export const FormBuilderModule: React.FC<FormBuilderModuleProps> = ({
  forms,
  departments,
  subjects,
  onRefresh,
  onOpenMarksView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState<PracticalForm | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [subjectId, setSubjectId] = useState('');
  const [course, setCourse] = useState('B.Sc. Computer Science');
  const [semester, setSemester] = useState('Semester III');
  const [section, setSection] = useState('Section A');
  const [examName, setExamName] = useState('Winter 2024 End Semester Practical Evaluation');
  const [examYear, setExamYear] = useState('2024-2025');
  const [maxMarks, setMaxMarks] = useState(50);
  const [minPassingMarks, setMinPassingMarks] = useState(17);
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowDecimals, setAllowDecimals] = useState(true);
  const [instructions, setInstructions] = useState(
    '1. Verify candidate roll number.\n2. Input practical and viva score.\n3. Save marks before leaving.'
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>('published');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate Roster Management Modal State
  const [activeRosterForm, setActiveRosterForm] = useState<PracticalForm | null>(null);
  const [currentEnrollments, setCurrentEnrollments] = useState<FormEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [rosterTab, setRosterTab] = useState<'upload' | 'manual' | 'list'>('upload');
  const [rosterSearch, setRosterSearch] = useState('');

  // Upload parsed state
  const [parsedRows, setParsedRows] = useState<ParsedCandidateRow[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingRoster, setSavingRoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Candidate Input state
  const [manualRoll, setManualRoll] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualFather, setManualFather] = useState('');
  const [manualCourse, setManualCourse] = useState('');
  const [manualSem, setManualSem] = useState('');
  const [manualSec, setManualSec] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Filter subjects by chosen Parent Department
  const filteredDepartmentSubjects = subjects.filter((s) => s.departmentId === departmentId);

  // Update subjectId when departmentId changes
  useEffect(() => {
    if (filteredDepartmentSubjects.length > 0) {
      if (!filteredDepartmentSubjects.some((s) => s.id === subjectId)) {
        const first = filteredDepartmentSubjects[0];
        setSubjectId(first.id);
        if (first.course) setCourse(first.course);
        if (first.semester) setSemester(first.semester);
      }
    } else {
      setSubjectId('');
    }
  }, [departmentId, subjects]);

  const handleOpenCreate = () => {
    const initialDeptId = departments[0]?.id || '';
    setDepartmentId(initialDeptId);
    const initialSubjs = subjects.filter((s) => s.departmentId === initialDeptId);
    setSubjectId(initialSubjs[0]?.id || '');
    setTitle('');
    setCourse('B.Sc. Computer Science');
    setSemester('Semester III');
    setSection('Section A');
    setExamName('Winter 2024 End Semester Practical Evaluation');
    setExamYear('2024-2025');
    setMaxMarks(50);
    setMinPassingMarks(17);
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
    setMinPassingMarks(form.minPassingMarks ?? Math.round(form.maxMarks * 0.33));
    setExamDate(form.examDate);
    setAllowDecimals(form.allowDecimals);
    setInstructions(form.instructions || '');
    setStatus(form.status);
    setError(null);
  };

  const handleDepartmentChange = (newDeptId: string) => {
    setDepartmentId(newDeptId);
    const available = subjects.filter((s) => s.departmentId === newDeptId);
    if (available.length > 0) {
      setSubjectId(available[0].id);
      if (available[0].course) setCourse(available[0].course);
      if (available[0].semester) setSemester(available[0].semester);
    } else {
      setSubjectId('');
    }
  };

  const handleSubjectChange = (newSubjId: string) => {
    setSubjectId(newSubjId);
    const chosen = subjects.find((s) => s.id === newSubjId);
    if (chosen) {
      if (chosen.course) setCourse(chosen.course);
      if (chosen.semester) setSemester(chosen.semester);
      if (!title || title.includes('Lab') || title.includes('Practical')) {
        setTitle(`${chosen.name} Practical Examination`);
      }
    }
  };

  const handleMaxMarksChange = (val: number) => {
    setMaxMarks(val);
    // If minPassingMarks was not customized or is higher than maxMarks, default to 33%
    if (minPassingMarks > val || minPassingMarks === 0) {
      setMinPassingMarks(Math.round(val * 0.33));
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !departmentId || !subjectId) {
      setError('Form title, parent department, and subject are required.');
      return;
    }

    if (Number(minPassingMarks) > Number(maxMarks)) {
      setError(`Minimum passing marks (${minPassingMarks}) cannot exceed maximum marks (${maxMarks}).`);
      return;
    }

    if (Number(minPassingMarks) < 0 || Number(maxMarks) <= 0) {
      setError('Marks must be positive numbers.');
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
          minPassingMarks: Number(minPassingMarks),
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
          minPassingMarks: Number(minPassingMarks),
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

  // ==================== CANDIDATE ROSTER MODAL ====================

  const handleOpenRosterManager = async (form: PracticalForm) => {
    setActiveRosterForm(form);
    setRosterTab('upload');
    setParsedRows([]);
    setUploadFileName(null);
    setUploadError(null);
    setManualError(null);
    setManualRoll('');
    setManualName('');
    setManualFather('');
    setManualCourse(form.course);
    setManualSem(form.semester);
    setManualSec(form.section || 'A');

    try {
      setLoadingEnrollments(true);
      const enrs = await getFormEnrollments(form.id);
      setCurrentEnrollments(enrs);
    } catch (err: any) {
      console.error('Error fetching enrollments:', err);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  // Option B: Download Excel Template
  const handleDownloadExcelTemplate = () => {
    if (!activeRosterForm) return;

    const wb = XLSX.utils.book_new();
    const headers = [
      'Roll Number',
      'Student Name',
      "Father's Name",
      'Course',
      'Semester',
      'Section',
    ];

    const sampleRows = [
      ['NGM24001', 'Aarav Sharma', 'Rajesh Sharma', activeRosterForm.course, activeRosterForm.semester, activeRosterForm.section || 'A'],
      ['NGM24002', 'Bhavya Patel', 'Mahesh Patel', activeRosterForm.course, activeRosterForm.semester, activeRosterForm.section || 'A'],
      ['NGM24003', 'Chirag Singhal', 'Sunil Singhal', activeRosterForm.course, activeRosterForm.semester, activeRosterForm.section || 'B'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      [`COLLEGE PRACTICAL CANDIDATE ENROLLMENT TEMPLATE - ${activeRosterForm.subjectCode}`],
      [`Practical Form: ${activeRosterForm.title} | Session: ${activeRosterForm.examYear}`],
      [],
      headers,
      ...sampleRows,
    ]);

    ws['!cols'] = [
      { wch: 18 },
      { wch: 25 },
      { wch: 25 },
      { wch: 26 },
      { wch: 16 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Candidate_Template');
    XLSX.writeFile(wb, `Student_Enrollment_Template_${activeRosterForm.subjectCode}.xlsx`);
  };

  // Option A: File Upload (Excel/CSV)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRosterForm) return;

    setUploadFileName(file.name);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawJson || rawJson.length === 0) {
          setUploadError('The selected spreadsheet file appears to be completely empty.');
          return;
        }

        // Locate header row by looking for 'roll' or 'student'
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, rawJson.length); i++) {
          const rowStr = (rawJson[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('roll') || rowStr.includes('student') || rowStr.includes('name')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (rawJson[headerRowIndex] || []).map((h: any) => String(h || '').trim().toLowerCase());
        const rollIdx = headers.findIndex((h: string) => h.includes('roll'));
        const nameIdx = headers.findIndex((h: string) => h.includes('name') && !h.includes('father'));
        const fatherIdx = headers.findIndex((h: string) => h.includes('father'));
        const courseIdx = headers.findIndex((h: string) => h.includes('course') || h.includes('degree'));
        const semIdx = headers.findIndex((h: string) => h.includes('sem'));
        const secIdx = headers.findIndex((h: string) => h.includes('sec'));

        if (rollIdx === -1) {
          setUploadError('Could not find a "Roll Number" column. Please check your headers or use the template.');
          return;
        }

        const parsed: ParsedCandidateRow[] = [];
        const seenInFile = new Set<string>();
        const existingEnrolledRolls = new Set(currentEnrollments.map((e) => e.rollNumber.toUpperCase()));

        for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const rawRoll = String(row[rollIdx] || '').trim();
          if (!rawRoll) continue; // Skip blank lines

          const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
          const rawFather = fatherIdx !== -1 ? String(row[fatherIdx] || '').trim() : '';
          const rawCourse = courseIdx !== -1 ? String(row[courseIdx] || '').trim() : activeRosterForm.course;
          const rawSem = semIdx !== -1 ? String(row[semIdx] || '').trim() : activeRosterForm.semester;
          const rawSec = secIdx !== -1 ? String(row[secIdx] || '').trim() : (activeRosterForm.section || 'A');

          const upperRoll = rawRoll.toUpperCase();
          let hasError = false;
          let errorMessage = '';
          let isDuplicate = false;

          if (!rawRoll) {
            hasError = true;
            errorMessage = 'Missing roll number';
          } else if (!rawName) {
            hasError = true;
            errorMessage = 'Missing student name';
          } else if (seenInFile.has(upperRoll)) {
            hasError = true;
            isDuplicate = true;
            errorMessage = 'Duplicate roll number in this file';
          } else if (existingEnrolledRolls.has(upperRoll)) {
            isDuplicate = true;
            errorMessage = 'Already enrolled in this exam (will update snapshot)';
          }

          seenInFile.add(upperRoll);

          parsed.push({
            id: `row_${i}_${Date.now()}`,
            rollNumber: rawRoll,
            studentName: rawName || 'Unknown Student',
            fatherName: rawFather,
            course: rawCourse || activeRosterForm.course,
            semester: rawSem || activeRosterForm.semester,
            section: rawSec,
            hasError,
            errorMessage: errorMessage || undefined,
            isDuplicate,
          });
        }

        if (parsed.length === 0) {
          setUploadError('No valid student rows found in file.');
          return;
        }

        setParsedRows(parsed);
      } catch (err: any) {
        setUploadError(`Failed to parse file: ${err.message}`);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateParsedRow = (id: string, field: keyof ParsedCandidateRow, val: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: val };
          // Re-evaluate errors
          if (!updated.rollNumber.trim()) {
            updated.hasError = true;
            updated.errorMessage = 'Missing roll number';
          } else if (!updated.studentName.trim()) {
            updated.hasError = true;
            updated.errorMessage = 'Missing student name';
          } else {
            updated.hasError = false;
            updated.errorMessage = undefined;
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleRemoveParsedRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Commit Verified Excel/CSV Candidates
  const handleCommitParsedRows = async () => {
    if (!activeRosterForm || parsedRows.length === 0) return;

    const errorCount = parsedRows.filter((r) => r.hasError).length;
    if (errorCount > 0) {
      const proceed = window.confirm(
        `There are ${errorCount} rows with errors. Do you want to proceed and skip/import valid rows only?`
      );
      if (!proceed) return;
    }

    const validRows = parsedRows.filter((r) => !r.hasError && r.rollNumber.trim());

    try {
      setSavingRoster(true);

      // 1. Create or update master student candidates
      const studentsToCreate: Array<Omit<Student, 'id' | 'createdAt'>> = validRows.map((r) => ({
        rollNumber: r.rollNumber.trim(),
        studentName: r.studentName.trim(),
        fatherName: r.fatherName.trim(),
        departmentId: activeRosterForm.departmentId,
        course: r.course || activeRosterForm.course,
        semester: r.semester || activeRosterForm.semester,
        section: r.section || activeRosterForm.section || 'A',
        academicSession: activeRosterForm.examYear || '2024-2025',
      }));

      await batchImportStudents(studentsToCreate);

      // 2. Build full Student objects with permanent IDs for form enrollment snapshot
      const fullStudents: Student[] = validRows.map((r) => {
        const cleanRoll = r.rollNumber.trim().toUpperCase();
        const studentId = generatePermanentStudentId(
          activeRosterForm.departmentId,
          r.course || activeRosterForm.course,
          r.semester || activeRosterForm.semester,
          cleanRoll,
          activeRosterForm.examYear
        );
        return {
          id: studentId,
          rollNumber: cleanRoll,
          studentName: r.studentName.trim(),
          fatherName: r.fatherName.trim(),
          departmentId: activeRosterForm.departmentId,
          course: r.course || activeRosterForm.course,
          semester: r.semester || activeRosterForm.semester,
          section: r.section || activeRosterForm.section || 'A',
          academicSession: activeRosterForm.examYear || '2024-2025',
          createdAt: new Date().toISOString(),
        };
      });

      // 3. Atomically enroll students into this practical examination form
      await enrollStudentsInForm(activeRosterForm, fullStudents);

      // Refresh enrollments in modal
      const refreshed = await getFormEnrollments(activeRosterForm.id);
      setCurrentEnrollments(refreshed);
      setParsedRows([]);
      setUploadFileName(null);
      setRosterTab('list');
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save students: ${err.message}`);
    } finally {
      setSavingRoster(false);
    }
  };

  // Option C: Manual Candidate Entry
  const handleAddManualCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRosterForm) return;

    const cleanRoll = manualRoll.trim().toUpperCase();
    const cleanName = manualName.trim();

    if (!cleanRoll || !cleanName) {
      setManualError('Roll Number and Student Name are mandatory.');
      return;
    }

    // Check duplicate in current form
    const exists = currentEnrollments.some((e) => e.rollNumber.toUpperCase() === cleanRoll);
    if (exists) {
      setManualError(`Candidate with Roll Number "${cleanRoll}" is already enrolled in this examination.`);
      return;
    }

    try {
      setSavingRoster(true);
      setManualError(null);

      const newStudent = await createStudent({
        rollNumber: cleanRoll,
        studentName: cleanName,
        fatherName: manualFather.trim(),
        departmentId: activeRosterForm.departmentId,
        course: manualCourse || activeRosterForm.course,
        semester: manualSem || activeRosterForm.semester,
        section: manualSec || activeRosterForm.section || 'A',
        academicSession: activeRosterForm.examYear || '2024-2025',
      });

      await enrollStudentsInForm(activeRosterForm, [newStudent]);

      const refreshed = await getFormEnrollments(activeRosterForm.id);
      setCurrentEnrollments(refreshed);

      setManualRoll('');
      setManualName('');
      setManualFather('');
      setRosterTab('list');
      onRefresh();
    } catch (err: any) {
      setManualError(err.message || 'Failed to add student candidate');
    } finally {
      setSavingRoster(false);
    }
  };

  const handleRemoveEnrollment = async (enrollment: FormEnrollment) => {
    if (!activeRosterForm) return;

    if (activeRosterForm.isStudentListLocked) {
      alert('The candidate roster is currently locked. Please unlock the examination list before removing students.');
      return;
    }

    const ok = window.confirm(`Remove candidate ${enrollment.studentName} (${enrollment.rollNumber}) from this examination?`);
    if (!ok) return;

    try {
      await removeStudentFromForm(activeRosterForm.id, enrollment.studentId);
      setCurrentEnrollments((prev) => prev.filter((e) => e.studentId !== enrollment.studentId));
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove candidate');
    }
  };

  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const departmentMap = new Map(departments.map((d) => [d.id, d]));

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
            Create unlimited practical examination forms independently, similar to Google Forms. Every form gets an isolated token, minimum passing marks validation, and candidate roster locking.
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
          const dept = departmentMap.get(form.departmentId);
          const minPass = form.minPassingMarks ?? Math.round(form.maxMarks * 0.33);

          return (
            <div
              key={form.id}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                {/* Status Badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {form.subjectCode}
                    </span>
                    {dept?.isGroup && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {dept.name}
                      </span>
                    )}
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
                <div className="mt-3.5 space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <span>Department / Group:</span>
                    <strong className="text-slate-300 truncate max-w-[170px] text-[11px]">
                      {dept?.name || form.departmentId}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Marks Criteria:</span>
                    <strong className="text-amber-400 font-mono text-[11px]">
                      Max: {form.maxMarks} | Pass: {minPass}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Marks Format:</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {form.allowDecimals ? 'Decimals OK' : 'Integers Only'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Exam Date:</span>
                    <strong className="text-slate-300 font-mono">{form.examDate}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Student Roster:</span>
                    <button
                      onClick={() => handleToggleLock(form)}
                      className={`inline-flex items-center gap-1 font-semibold text-[11px] px-2 py-0.5 rounded border transition-colors ${
                        form.isStudentListLocked
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      }`}
                    >
                      {form.isStudentListLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{form.isStudentListLocked ? 'Locked (Examiner Read-Only)' : 'Open for Editing'}</span>
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
                    onClick={() => handleOpenRosterManager(form)}
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Upload / Roster</span>
                  </button>
                  <button
                    onClick={() => onOpenMarksView(form)}
                    className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-center transition-colors flex items-center justify-center gap-1"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Manage Marks</span>
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

      {/* CREATE / EDIT FORM MODAL */}
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
              Select Parent Department / Group first, then choose its curriculum subject. Configure minimum passing criteria and maximum marks.
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
                  placeholder="e.g. History & AIH&C Annual Practical Examination"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Parent Department -> Subject Cascading Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    1. Parent Department / Group *
                  </label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.isGroup ? '(Group)' : ''} ({d.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Parent Group filters the available subjects below.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    2. Subject under Parent Group *
                  </label>
                  <select
                    required
                    value={subjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {filteredDepartmentSubjects.length === 0 ? (
                      <option value="">No subjects assigned to this parent group</option>
                    ) : (
                      filteredDepartmentSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="text-[10px] text-blue-400 mt-1 block">
                    {filteredDepartmentSubjects.length} subject(s) available in this department.
                  </span>
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
                    placeholder="B.A. / B.Sc."
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

              {/* Min and Max Marks + Decimals */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={maxMarks}
                    onChange={(e) => handleMaxMarksChange(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-amber-300 mb-1">
                    Min Passing Marks *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={maxMarks}
                    required
                    value={minPassingMarks}
                    onChange={(e) => setMinPassingMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-lg text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Pass criteria</span>
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
                  disabled={loading || filteredDepartmentSubjects.length === 0}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : editingForm ? 'Update Form' : 'Generate Practical Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANDIDATE ROSTER & UPLOAD MANAGER MODAL */}
      {activeRosterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6 max-h-[92vh] flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {activeRosterForm.subjectCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100">
                      Candidate Roster: {activeRosterForm.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage candidates for this specific examination. Enrolled students are stored in an isolated form snapshot.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleLock(activeRosterForm)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeRosterForm.isStudentListLocked
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="Locking prevents external examiners from modifying candidate details"
                  >
                    {activeRosterForm.isStudentListLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{activeRosterForm.isStudentListLocked ? 'Locked (Secure)' : 'Unlocked'}</span>
                  </button>

                  <button
                    onClick={() => setActiveRosterForm(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Security Banner */}
              <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Student List Security:</strong> Public evaluation link candidates are strictly read-only. Candidates cannot be added, edited, or removed from public links.
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400 whitespace-nowrap ml-2">
                  {currentEnrollments.length} Enrolled Candidates
                </span>
              </div>

              {/* Roster Tabs: Option A (Upload), Option B (Download Template), Option C (Manual), View Snapshot List */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRosterTab('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      rosterTab === 'upload'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Option A: Upload Excel/CSV</span>
                  </button>

                  <button
                    onClick={() => setRosterTab('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      rosterTab === 'manual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Option C: Manual Entry</span>
                  </button>

                  <button
                    onClick={() => setRosterTab('list')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      rosterTab === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Enrolled List ({currentEnrollments.length})</span>
                  </button>
                </div>

                {/* Option B: Download Excel Template Button */}
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all"
                  title="Download standard columns template (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Option B: Download Excel Template</span>
                </button>
              </div>

              {/* TAB 1: OPTION A - EXCEL / CSV UPLOAD */}
              {rosterTab === 'upload' && (
                <div className="space-y-4">
                  {/* File Upload Drop Area */}
                  <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-6 text-center bg-slate-950/60 transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-200">
                      Upload Candidate Excel or CSV Spreadsheet
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Supports <code className="text-blue-300">.xlsx</code>, <code className="text-blue-300">.xls</code>, and <code className="text-blue-300">.csv</code>.
                      Columns: Roll Number, Student Name, Father's Name, Course, Semester, Section.
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-3">
                      <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all">
                        <span>Select Excel / CSV File</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadFileName && (
                        <span className="text-xs text-emerald-400 font-mono">
                          Selected: {uploadFileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {uploadError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Preview Table before saving */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                            Preview Candidate Records ({parsedRows.length} detected)
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Inspect and correct invalid fields directly in the table below before saving.
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3 w-12 text-center">#</th>
                              <th className="py-2.5 px-3 w-32">Roll Number *</th>
                              <th className="py-2.5 px-3">Student Name *</th>
                              <th className="py-2.5 px-3">Father's Name</th>
                              <th className="py-2.5 px-3 w-28">Course / Sem</th>
                              <th className="py-2.5 px-3 w-36">Status</th>
                              <th className="py-2.5 px-2 text-center w-12">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-sans">
                            {parsedRows.map((row, idx) => (
                              <tr
                                key={row.id}
                                className={`hover:bg-slate-800/40 ${
                                  row.hasError ? 'bg-rose-950/20' : row.isDuplicate ? 'bg-amber-950/20' : ''
                                }`}
                              >
                                <td className="py-2 px-3 text-center font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-1 px-3">
                                  <input
                                    type="text"
                                    value={row.rollNumber}
                                    onChange={(e) => handleUpdateParsedRow(row.id, 'rollNumber', e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                                  />
                                </td>
                                <td className="py-1 px-3">
                                  <input
                                    type="text"
                                    value={row.studentName}
                                    onChange={(e) => handleUpdateParsedRow(row.id, 'studentName', e.target.value)}
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                                  />
                                </td>
                                <td className="py-1 px-3">
                                  <input
                                    type="text"
                                    value={row.fatherName}
                                    onChange={(e) => handleUpdateParsedRow(row.id, 'fatherName', e.target.value)}
                                    placeholder="Optional"
                                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                                  />
                                </td>
                                <td className="py-1 px-3 text-[11px] text-slate-400">
                                  {row.course} • {row.semester}
                                </td>
                                <td className="py-1 px-3">
                                  {row.hasError ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      <AlertTriangle className="w-3 h-3" />
                                      {row.errorMessage || 'Invalid row'}
                                    </span>
                                  ) : row.isDuplicate ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {row.errorMessage || 'Duplicate'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      <CheckCircle className="w-3 h-3" />
                                      Verified Valid
                                    </span>
                                  )}
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveParsedRow(row.id)}
                                    className="p-1 text-slate-500 hover:text-rose-400 rounded"
                                    title="Discard Row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Confirm & Save Button */}
                      <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-400">
                          {parsedRows.filter((r) => !r.hasError).length} valid candidates will be enrolled into the examination snapshot.
                        </span>
                        <button
                          type="button"
                          onClick={handleCommitParsedRows}
                          disabled={savingRoster}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{savingRoster ? 'Saving Roster...' : 'Save Verified Students to Exam'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: OPTION C - MANUAL STUDENT ENTRY */}
              {rosterTab === 'manual' && (
                <form onSubmit={handleAddManualCandidate} className="space-y-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Add Candidate Manually
                  </h4>
                  <p className="text-xs text-slate-400">
                    Candidate will be registered with a unique permanent ID composite of department, course, semester, session, and roll number.
                  </p>

                  {manualError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{manualError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Roll Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualRoll}
                        onChange={(e) => setManualRoll(e.target.value)}
                        placeholder="e.g. NGM24099"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Student Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Father's Name
                      </label>
                      <input
                        type="text"
                        value={manualFather}
                        onChange={(e) => setManualFather(e.target.value)}
                        placeholder="e.g. Anand Kumar"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Course
                      </label>
                      <input
                        type="text"
                        value={manualCourse}
                        onChange={(e) => setManualCourse(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Semester
                      </label>
                      <input
                        type="text"
                        value={manualSem}
                        onChange={(e) => setManualSem(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingRoster}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{savingRoster ? 'Enrolling Candidate...' : 'Enroll Candidate'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: CURRENT ENROLLED CANDIDATES LIST */}
              {rosterTab === 'list' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search roll or student name..."
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <span className="text-xs text-slate-400">
                      Showing {currentEnrollments.filter((e) => e.rollNumber.toLowerCase().includes(rosterSearch.toLowerCase()) || e.studentName.toLowerCase().includes(rosterSearch.toLowerCase())).length} of {currentEnrollments.length} candidate snapshots
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 w-32">Roll Number</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Father's Name</th>
                          <th className="py-2.5 px-3 w-28">Course / Sem</th>
                          <th className="py-2.5 px-3 text-center w-24">Snapshot Status</th>
                          <th className="py-2.5 px-3 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {currentEnrollments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500">
                              No candidates enrolled yet. Use Option A (Upload Excel/CSV) or Option C (Manual Entry) above.
                            </td>
                          </tr>
                        ) : (
                          currentEnrollments
                            .filter(
                              (e) =>
                                e.rollNumber.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                                e.studentName.toLowerCase().includes(rosterSearch.toLowerCase())
                            )
                            .map((enr, idx) => (
                              <tr key={enr.id} className="hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                                  {enr.rollNumber}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-200">
                                  {enr.studentName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {enr.fatherName || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                                  {enr.course} • {enr.semester}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Verified
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEnrollment(enr)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                                    title="Remove Candidate"
                                    disabled={activeRosterForm.isStudentListLocked}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
              <span className="text-xs text-slate-500">
                Permanent IDs: <code className="text-slate-400 font-mono text-[11px]">std_dept_course_sem_session_roll</code>
              </span>
              <button
                type="button"
                onClick={() => setActiveRosterForm(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Candidate Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
