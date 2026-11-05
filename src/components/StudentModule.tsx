import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Layers,
  BookOpen,
  Calendar,
  Lock,
  Unlock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Student,
  Department,
  AcademicSession,
  AcademicPaper,
  PracticalSubject,
  PaperStudent,
  ExaminerAssignment,
  ALL_ACADEMIC_SESSIONS,
  ALL_SEMESTERS,
  SUBJECT_TYPES,
  SubjectType,
  INITIAL_PRACTICAL_SUBJECTS,
} from '../types';
import {
  getAcademicSessions,
  createAcademicSession,
  getAcademicPapers,
  createAcademicPaper,
  updateAcademicPaper,
  deleteAcademicPaper,
  getPracticalSubjects,
  createPracticalSubject,
  updatePracticalSubject,
  deletePracticalSubject,
  getPaperStudents,
  batchImportPaperStudents,
  deletePaperStudent,
  getExaminerAssignments,
  saveExaminerAssignment,
  deleteExaminerAssignment,
  regenerateAssignmentToken,
  reopenExaminerAssignment,
  generatePermanentPaperStudentId,
  matchPracticalSubject,
} from '../services/collegeService';

interface StudentModuleProps {
  students: Student[];
  departments: Department[];
  onRefresh: () => void;
}

interface ParsedUploadRow {
  id: string;
  serialNo: number | string;
  studentName: string;
  rollNumber: string;
  rawSubject: string;
  normalizedSubject: string;
  fatherName: string;
  section: string;
  hasError: boolean;
  errorMessage?: string;
  isDuplicate?: boolean;
  isUnknownSubject?: boolean;
}

export const StudentModule: React.FC<StudentModuleProps> = ({
  students,
  departments,
  onRefresh,
}) => {
  // Navigation / Selection State
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('2025-29');
  const [selectedSemester, setSelectedSemester] = useState<string>('Semester 1');
  const [selectedSubjectType, setSelectedSubjectType] = useState<SubjectType>('MJC');

  // Master Practical Subjects State
  const [practicalSubjects, setPracticalSubjects] = useState<PracticalSubject[]>([]);
  const [showSubjectMasterModal, setShowSubjectMasterModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);

  // Papers State
  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [showAddPaperModal, setShowAddPaperModal] = useState(false);
  const [manualPaperName, setManualPaperName] = useState('');
  const [paperError, setPaperError] = useState<string | null>(null);
  const [editingPaper, setEditingPaper] = useState<AcademicPaper | null>(null);

  // Add Session State
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  // Paper Students & Assignments State (indexed by paperId)
  const [paperStudentsMap, setPaperStudentsMap] = useState<Record<string, PaperStudent[]>>({});
  const [paperAssignmentsMap, setPaperAssignmentsMap] = useState<Record<string, ExaminerAssignment[]>>({});

  // Active Upload State
  const [activeUploadPaper, setActiveUploadPaper] = useState<AcademicPaper | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedUploadRow[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingUpload, setSavingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Assignment Modal State
  const [assignmentModalPaper, setAssignmentModalPaper] = useState<AcademicPaper | null>(null);
  const [assignmentModalSubject, setAssignmentModalSubject] = useState<string>('');
  const [activeAssignment, setActiveAssignment] = useState<ExaminerAssignment | null>(null);
  const [assignmentIncharge, setAssignmentIncharge] = useState('');
  const [assignmentExaminer, setAssignmentExaminer] = useState('');
  const [assignmentParentDeptId, setAssignmentParentDeptId] = useState(departments[0]?.id || '');
  const [assignmentMaxMarks, setAssignmentMaxMarks] = useState(50);
  const [assignmentMinMarks, setAssignmentMinMarks] = useState(17);
  const [assignmentAllowDecimals, setAssignmentAllowDecimals] = useState(true);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Copied token state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    loadInitialSessionsAndSubjects();
  }, []);

  useEffect(() => {
    loadPapersForSelection();
  }, [selectedSession, selectedSemester, selectedSubjectType]);

  const loadInitialSessionsAndSubjects = async () => {
    try {
      const [sessList, subjList] = await Promise.all([
        getAcademicSessions(),
        getPracticalSubjects(),
      ]);
      setSessions(sessList);
      if (sessList.length > 0) {
        // Prefer 2025-29 if present, or first
        const has2025 = sessList.find((s) => s.sessionName === '2025-29');
        setSelectedSession(has2025 ? '2025-29' : sessList[0].sessionName);
      }
      setPracticalSubjects(subjList);
    } catch (err) {
      console.error('Error loading sessions/subjects:', err);
    }
  };

  const loadPapersForSelection = async () => {
    try {
      setLoadingPapers(true);
      const papersList = await getAcademicPapers(selectedSession, selectedSemester, selectedSubjectType);
      setPapers(papersList);

      // Load students and assignments for each paper
      const studMap: Record<string, PaperStudent[]> = {};
      const asgnMap: Record<string, ExaminerAssignment[]> = {};

      await Promise.all(
        papersList.map(async (p) => {
          const [stList, asList] = await Promise.all([
            getPaperStudents(p.id),
            getExaminerAssignments({ paperId: p.id }),
          ]);
          studMap[p.id] = stList;
          asgnMap[p.id] = asList;
        })
      );

      setPaperStudentsMap(studMap);
      setPaperAssignmentsMap(asgnMap);
    } catch (err) {
      console.error('Error loading papers:', err);
    } finally {
      setLoadingPapers(false);
    }
  };

  // Add Session
  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    try {
      const newSess = await createAcademicSession(newSessionName.trim());
      setSessions((prev) => [...prev, newSess]);
      setSelectedSession(newSess.sessionName);
      setShowAddSessionModal(false);
      setNewSessionName('');
    } catch (err: any) {
      alert(err.message || 'Failed to add session');
    }
  };

  // Practical Subject Master: Add Subject
  const handleAddPracticalSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const clean = newSubjectName.trim().toUpperCase();

    // Prevent duplicate
    if (practicalSubjects.some((s) => s.name.toUpperCase() === clean)) {
      setSubjectError(`Subject "${clean}" is already in the Global Practical Subject Master.`);
      return;
    }

    try {
      setSubjectError(null);
      const created = await createPracticalSubject(clean);
      setPracticalSubjects((prev) => [...prev, created]);
      setNewSubjectName('');
    } catch (err: any) {
      setSubjectError(err.message || 'Failed to add subject');
    }
  };

  const handleDeletePracticalSubject = async (id: string, name: string) => {
    const ok = window.confirm(`Remove "${name}" from Global Practical Subject Master?`);
    if (!ok) return;
    try {
      await deletePracticalSubject(id);
      setPracticalSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete subject');
    }
  };

  // Manual Paper Creation
  const handleCreatePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPaper = manualPaperName.trim().toUpperCase();
    if (!cleanPaper) {
      setPaperError('Please enter a paper name.');
      return;
    }

    // Check duplicate in current Session + Semester + SubjectType
    const duplicate = papers.some(
      (p) =>
        p.session === selectedSession &&
        p.semester === selectedSemester &&
        p.subjectType === selectedSubjectType &&
        p.paperName.toUpperCase() === cleanPaper &&
        p.id !== editingPaper?.id
    );

    if (duplicate) {
      setPaperError(
        `Duplicate Paper: A paper named "${cleanPaper}" already exists under ${selectedSubjectType} in ${selectedSemester} (${selectedSession}).`
      );
      return;
    }

    try {
      setPaperError(null);
      if (editingPaper) {
        await updateAcademicPaper(editingPaper.id, { paperName: cleanPaper });
        setEditingPaper(null);
      } else {
        await createAcademicPaper({
          session: selectedSession,
          semester: selectedSemester,
          subjectType: selectedSubjectType,
          paperName: cleanPaper,
        });
      }
      setShowAddPaperModal(false);
      setManualPaperName('');
      await loadPapersForSelection();
      onRefresh();
    } catch (err: any) {
      setPaperError(err.message || 'Failed to save paper');
    }
  };

  const handleDeletePaper = async (paper: AcademicPaper) => {
    const ok = window.confirm(
      `Permanently remove paper "${paper.paperName}"?\nAll associated uploaded student lists and assignments for this paper will be affected.`
    );
    if (!ok) return;
    try {
      await deleteAcademicPaper(paper.id);
      await loadPapersForSelection();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete paper');
    }
  };

  // ==================== EXCEL UPLOAD WORKFLOW ====================

  // Download standard template
  const handleDownloadTemplate = (paperName: string) => {
    const wb = XLSX.utils.book_new();
    const headers = ['SN.', 'NAME OF STUDENT', 'ROLL NO.', 'SUBJECT', "FATHER'S NAME", 'SECTION'];

    const sampleRows = [
      [1, 'Aarav Sharma', '24001', 'BOTANY', 'Rajesh Sharma', 'A'],
      [2, 'Bhavya Patel', '24002', 'CHEMISTRY', 'Mahesh Patel', 'A'],
      [3, 'Chirag Singhal', '24003', 'PHYSICS', 'Sunil Singhal', 'B'],
      [4, 'Deepika Verma', '24004', 'ZOOLOGY', 'Anil Verma', 'A'],
      [5, 'Gaurav Kumar', '24005', 'GEOGRAPHY', 'Ramesh Kumar', 'A'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      [`COLLEGE PRACTICAL EXAMINATION STUDENT UPLOAD TEMPLATE`],
      [`Academic Session: ${selectedSession} | ${selectedSemester} | ${selectedSubjectType} - ${paperName}`],
      [],
      headers,
      ...sampleRows,
    ]);

    ws['!cols'] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Student_List');
    XLSX.writeFile(wb, `Student_Upload_Template_${selectedSubjectType}_${paperName}.xlsx`);
  };

  const handleOpenUploadModal = (paper: AcademicPaper) => {
    setActiveUploadPaper(paper);
    setParsedRows([]);
    setUploadFileName(null);
    setUploadError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadPaper) return;

    setUploadFileName(file.name);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawJson || rawJson.length === 0) {
          setUploadError('The selected spreadsheet file is empty.');
          return;
        }

        // Find header row containing 'roll' or 'name' or 'student'
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, rawJson.length); i++) {
          const rowStr = (rawJson[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('roll') || rowStr.includes('student') || rowStr.includes('subject')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (rawJson[headerRowIndex] || []).map((h: any) =>
          String(h || '').trim().toLowerCase()
        );

        const snIdx = headers.findIndex((h: string) => h === 'sn.' || h === 'sn' || h.includes('serial') || h.includes('s.no'));
        const nameIdx = headers.findIndex((h: string) => h.includes('name') && !h.includes('father'));
        const rollIdx = headers.findIndex((h: string) => h.includes('roll'));
        const subjIdx = headers.findIndex((h: string) => h.includes('subject'));
        const fatherIdx = headers.findIndex((h: string) => h.includes('father'));
        const secIdx = headers.findIndex((h: string) => h.includes('sec'));

        if (rollIdx === -1 || nameIdx === -1 || subjIdx === -1) {
          setUploadError(
            'Missing required columns! Excel file must contain: "NAME OF STUDENT", "ROLL NO.", and "SUBJECT". Download template for exact format.'
          );
          return;
        }

        const parsed: ParsedUploadRow[] = [];
        const seenInFile = new Set<string>();
        const existingPaperRolls = new Set(
          (paperStudentsMap[activeUploadPaper.id] || []).map((s) => s.rollNumber.toUpperCase())
        );

        for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const rawRoll = String(row[rollIdx] || '').trim();
          const rawName = String(row[nameIdx] || '').trim();
          const rawSubj = String(row[subjIdx] || '').trim();
          const rawFather = fatherIdx !== -1 ? String(row[fatherIdx] || '').trim() : '';
          const rawSec = secIdx !== -1 ? String(row[secIdx] || '').trim() : 'A';
          const rawSn = snIdx !== -1 ? row[snIdx] : i - headerRowIndex;

          if (!rawRoll && !rawName && !rawSubj) continue; // blank line

          const upperRoll = rawRoll.toUpperCase();
          const matchedSubj = matchPracticalSubject(rawSubj, practicalSubjects);

          let hasError = false;
          let errorMessage = '';
          let isDuplicate = false;
          let isUnknownSubject = false;

          if (!rawRoll) {
            hasError = true;
            errorMessage = 'Missing roll number';
          } else if (!rawName) {
            hasError = true;
            errorMessage = 'Missing student name';
          } else if (!rawSubj) {
            hasError = true;
            errorMessage = 'Missing practical subject';
          } else if (!matchedSubj) {
            hasError = true;
            isUnknownSubject = true;
            errorMessage = `Unknown subject: "${rawSubj}". Must be one of the Global Practical Subjects.`;
          } else if (seenInFile.has(upperRoll)) {
            hasError = true;
            isDuplicate = true;
            errorMessage = 'Duplicate roll number in this file';
          } else if (existingPaperRolls.has(upperRoll)) {
            isDuplicate = true;
            errorMessage = 'Already enrolled in this paper (will update record)';
          }

          seenInFile.add(upperRoll);

          parsed.push({
            id: `row_${i}_${Date.now()}`,
            serialNo: rawSn || i - headerRowIndex,
            studentName: rawName,
            rollNumber: rawRoll,
            rawSubject: rawSubj,
            normalizedSubject: matchedSubj ? matchedSubj.name : rawSubj.trim().toUpperCase(),
            fatherName: rawFather,
            section: rawSec || 'A',
            hasError,
            errorMessage: errorMessage || undefined,
            isDuplicate,
            isUnknownSubject,
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

  const handleUpdateParsedRow = (id: string, field: keyof ParsedUploadRow, val: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: val };
          if (field === 'normalizedSubject') {
            const matched = matchPracticalSubject(val, practicalSubjects);
            if (!matched) {
              updated.hasError = true;
              updated.isUnknownSubject = true;
              updated.errorMessage = `Unknown subject: "${val}".`;
            } else {
              updated.normalizedSubject = matched.name;
              updated.isUnknownSubject = false;
              updated.hasError = false;
              updated.errorMessage = undefined;
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleConfirmUpload = async () => {
    if (!activeUploadPaper || parsedRows.length === 0) return;

    const errorRows = parsedRows.filter((r) => r.hasError);
    if (errorRows.length > 0) {
      const ok = window.confirm(
        `There are ${errorRows.length} rows with errors (missing details or unknown subjects). Would you like to proceed and import only the valid rows?`
      );
      if (!ok) return;
    }

    const validRows = parsedRows.filter((r) => !r.hasError && r.rollNumber.trim() && r.studentName.trim());
    if (validRows.length === 0) {
      alert('No valid rows available to import.');
      return;
    }

    try {
      setSavingUpload(true);
      const studentsToImport: Array<Omit<PaperStudent, 'id' | 'createdAt'>> = validRows.map((r) => ({
        paperId: activeUploadPaper.id,
        session: selectedSession,
        semester: selectedSemester,
        subjectType: selectedSubjectType,
        paperName: activeUploadPaper.paperName,
        rollNumber: r.rollNumber.trim().toUpperCase(),
        studentName: r.studentName.trim(),
        subject: r.normalizedSubject.trim().toUpperCase(),
        fatherName: r.fatherName.trim(),
        section: r.section.trim() || 'A',
        serialNo: r.serialNo,
        status: 'active',
      }));

      const res = await batchImportPaperStudents(studentsToImport);

      alert(
        `Successfully imported ${res.added} students into ${activeUploadPaper.paperName}!\nGrouped across subjects:\n` +
          Object.entries(res.groupedBySubject)
            .map(([s, c]) => `• ${s}: ${c} candidates`)
            .join('\n')
      );

      setActiveUploadPaper(null);
      setParsedRows([]);
      await loadPapersForSelection();
      onRefresh();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setSavingUpload(false);
    }
  };

  // ==================== ASSIGNMENT MODAL ====================

  const handleOpenAssignmentModal = (paper: AcademicPaper, subjectName: string) => {
    setAssignmentModalPaper(paper);
    setAssignmentModalSubject(subjectName);
    setAssignmentError(null);

    // Look for existing assignment
    const existing = (paperAssignmentsMap[paper.id] || []).find((a) => a.subjectName === subjectName);
    if (existing) {
      setActiveAssignment(existing);
      setAssignmentIncharge(existing.inchargeName);
      setAssignmentExaminer(existing.examinerName);
      setAssignmentParentDeptId(existing.parentGroupId || departments[0]?.id || '');
      setAssignmentMaxMarks(existing.maxMarks);
      setAssignmentMinMarks(existing.minMarks);
      setAssignmentAllowDecimals(existing.allowDecimals);
    } else {
      setActiveAssignment(null);
      setAssignmentIncharge('Prof. Department Incharge');
      setAssignmentExaminer('External Examiner');
      setAssignmentParentDeptId(departments[0]?.id || '');
      setAssignmentMaxMarks(50);
      setAssignmentMinMarks(17);
      setAssignmentAllowDecimals(true);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentModalPaper || !assignmentModalSubject) return;

    if (Number(assignmentMinMarks) > Number(assignmentMaxMarks)) {
      setAssignmentError(`Minimum marks (${assignmentMinMarks}) cannot exceed maximum marks (${assignmentMaxMarks}).`);
      return;
    }
    if (Number(assignmentMinMarks) < 0 || Number(assignmentMaxMarks) <= 0) {
      setAssignmentError('Marks must be positive numbers.');
      return;
    }

    try {
      setSavingAssignment(true);
      setAssignmentError(null);

      const parentDept = departments.find((d) => d.id === assignmentParentDeptId);
      const paperStudents = (paperStudentsMap[assignmentModalPaper.id] || []).filter(
        (s) => s.subject === assignmentModalSubject
      );

      await saveExaminerAssignment({
        id: activeAssignment?.id,
        token: activeAssignment?.token,
        session: selectedSession,
        semester: selectedSemester,
        subjectType: selectedSubjectType,
        paperId: assignmentModalPaper.id,
        paperName: assignmentModalPaper.paperName,
        subjectName: assignmentModalSubject,
        parentGroupId: parentDept?.id,
        parentGroupName: parentDept?.name,
        inchargeName: assignmentIncharge.trim(),
        examinerName: assignmentExaminer.trim(),
        maxMarks: Number(assignmentMaxMarks),
        minMarks: Number(assignmentMinMarks),
        allowDecimals: assignmentAllowDecimals,
        status: activeAssignment?.status || 'Not Started',
        isLocked: activeAssignment?.isLocked || false,
        totalStudents: paperStudents.length,
        evaluatedCount: activeAssignment?.evaluatedCount || 0,
        absentCount: activeAssignment?.absentCount || 0,
        pendingCount: paperStudents.length - (activeAssignment?.evaluatedCount || 0) - (activeAssignment?.absentCount || 0),
      });

      setAssignmentModalPaper(null);
      await loadPapersForSelection();
      onRefresh();
    } catch (err: any) {
      setAssignmentError(err.message || 'Failed to save assignment');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleRegenerateToken = async (assignmentId: string) => {
    const ok = window.confirm('Regenerate public examiner link? The old link will immediately stop working.');
    if (!ok) return;
    try {
      await regenerateAssignmentToken(assignmentId);
      await loadPapersForSelection();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate link');
    }
  };

  const handleReopenAssignment = async (assignmentId: string) => {
    const ok = window.confirm('Reopen this submitted examination? This allows the examiner to revise entered marks.');
    if (!ok) return;
    try {
      await reopenExaminerAssignment(assignmentId, 'Administrator');
      await loadPapersForSelection();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reopen assignment');
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Academic Selection Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-slate-100">
                Subject Category, Paper & Student Management
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select Session, Semester, and Subject Type (MJC / MIC / MDC). Add manually named papers with independent Excel uploads, subject grouping, and examiner tokens.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSubjectMasterModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Practical Subject Master ({practicalSubjects.length})</span>
            </button>
          </div>
        </div>

        {/* 1. Session Selector, 2. Semester Selector, 3. Subject Type (MJC, MIC, MDC) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Academic Session */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                1. Academic Session:
              </label>
              <button
                type="button"
                onClick={() => setShowAddSessionModal(true)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
              >
                + Add Session
              </button>
            </div>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.sessionName}>
                  {s.sessionName} {s.isActive ? '' : '(Inactive)'}
                </option>
              ))}
            </select>
          </div>

          {/* Semester (Exactly 8 Semesters) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              2. Semester:
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {ALL_SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Type: Only MJC, MIC, MDC */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              3. Subject Type (Fixed 3 Types):
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {SUBJECT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedSubjectType(type)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
                    selectedSubjectType === type
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PAPER MANAGEMENT & SEPARATE EXCEL UPLOAD SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400">Current Scope:</span>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              {selectedSession}
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {selectedSemester}
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {selectedSubjectType}
            </span>
            <span className="text-xs text-slate-400 ml-1">
              ({papers.length} manually configured paper{papers.length === 1 ? '' : 's'})
            </span>
          </div>

          {/* Add Paper Button */}
          <button
            onClick={() => {
              setEditingPaper(null);
              setManualPaperName('');
              setPaperError(null);
              setShowAddPaperModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Paper ({selectedSubjectType})</span>
          </button>
        </div>

        {/* Papers List: Each Paper displays its own separate Excel Upload Section */}
        {loadingPapers ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading papers and student rosters...</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl space-y-3">
            <Layers className="w-10 h-10 mx-auto text-slate-600" />
            <h4 className="text-sm font-bold text-slate-300">
              No papers configured for {selectedSubjectType} in {selectedSemester} ({selectedSession})
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click the <strong className="text-blue-400">"Add Paper"</strong> button above to manually create a paper (e.g. {selectedSubjectType} 1, {selectedSubjectType} 2). Each paper will immediately receive its own separate Excel upload box.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {papers.map((paper) => {
              const studentsInPaper = paperStudentsMap[paper.id] || [];
              const assignmentsInPaper = paperAssignmentsMap[paper.id] || [];

              // Group students by subject
              const subjectsGrouped: Record<string, PaperStudent[]> = {};
              studentsInPaper.forEach((st) => {
                const sub = st.subject || 'UNASSIGNED';
                if (!subjectsGrouped[sub]) subjectsGrouped[sub] = [];
                subjectsGrouped[sub].push(st);
              });

              const subjectKeys = Object.keys(subjectsGrouped);

              return (
                <div
                  key={paper.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-xl overflow-hidden transition-all"
                >
                  {/* Paper Card Header */}
                  <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-600 text-white shadow-sm">
                        {paper.subjectType}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <span>Paper Name:</span>
                          <span className="text-blue-400 font-mono">{paper.paperName}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {paper.session} • {paper.semester} • {studentsInPaper.length} Candidates Enrolled Across {subjectKeys.length} Practical Subject(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingPaper(paper);
                          setManualPaperName(paper.paperName);
                          setPaperError(null);
                          setShowAddPaperModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Edit Paper Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePaper(paper)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Delete Paper"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* CRITICAL: SEPARATE EXCEL UPLOAD BOX IMMEDIATELY BELOW THE PAPER */}
                  <div className="p-5 bg-gradient-to-r from-blue-950/20 via-slate-900 to-indigo-950/20 border-b border-slate-800/80">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border border-blue-500/20 bg-slate-950/70">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            Separate Excel / CSV Upload for {paper.paperName}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                            Upload student roster for <strong>{paper.paperName}</strong> only. One Excel file may contain multiple practical subjects (e.g. BOTANY, CHEMISTRY, PHYSICS). System will automatically group candidates subject-wise.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate(paper.paperName)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-400" />
                          <span>Download Template</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenUploadModal(paper)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Excel for {paper.paperName}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AUTOMATIC SUBJECT-WISE GROUPING FOR THIS PAPER */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <span>Recognized Practical Subjects in {paper.paperName}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {subjectKeys.length} Group{subjectKeys.length === 1 ? '' : 's'}
                        </span>
                      </h4>
                    </div>

                    {subjectKeys.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                        <p className="text-xs font-medium">No students uploaded yet for {paper.paperName}.</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Click "Upload Excel for {paper.paperName}" above to import students with their respective practical subjects.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjectKeys.map((subjName) => {
                          const subjStudents = subjectsGrouped[subjName] || [];
                          const assignment = assignmentsInPaper.find((a) => a.subjectName === subjName);

                          return (
                            <div
                              key={subjName}
                              className="p-4 bg-slate-950 border border-slate-800 hover:border-blue-500/30 rounded-xl flex flex-col justify-between space-y-3"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-xs font-bold text-amber-300">
                                    {subjName}
                                  </span>
                                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    {subjStudents.length} Students
                                  </span>
                                </div>

                                {/* Assignment Status */}
                                {assignment ? (
                                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                                    <div className="flex items-center justify-between">
                                      <span>Incharge:</span>
                                      <strong className="text-slate-200 truncate max-w-[130px]">
                                        {assignment.inchargeName}
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Examiner:</span>
                                      <strong className="text-slate-200 truncate max-w-[130px]">
                                        {assignment.examinerName}
                                      </strong>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span>Marks:</span>
                                      <span className="font-mono text-[11px] text-amber-400">
                                        Max: {assignment.maxMarks} | Pass: {assignment.minMarks}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                      <span>Status:</span>
                                      <span
                                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                                          assignment.status === 'Final Submitted'
                                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                            : assignment.status === 'Ready to Submit'
                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                            : assignment.status === 'Draft Saved'
                                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                        }`}
                                      >
                                        {assignment.status}
                                      </span>
                                    </div>

                                    {/* Copy Examiner Public Link */}
                                    <div className="mt-2 p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-1">
                                      <span className="font-mono text-[10px] text-slate-400 truncate">
                                        ?token={assignment.token.slice(0, 12)}...
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyLink(assignment.token)}
                                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 font-medium"
                                        title="Copy public evaluation link for examiner"
                                      >
                                        {copiedToken === assignment.token ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                        <span>{copiedToken === assignment.token ? 'Copied' : 'Link'}</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-2.5 bg-slate-900/60 rounded-lg text-xs text-amber-300/80 border border-amber-500/20">
                                    Examiner & Marks not configured yet.
                                  </div>
                                )}
                              </div>

                              {/* Configure Action */}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssignmentModal(paper, subjName)}
                                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-center transition-colors"
                                >
                                  {assignment ? 'Edit Assignment & Marks' : 'Assign Examiner & Marks'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT PAPER MANUALLY */}
      {showAddPaperModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setShowAddPaperModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-1">
              {editingPaper ? 'Edit Paper Name' : `Add Manually Named Paper (${selectedSubjectType})`}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the exact paper name (e.g. <strong>{selectedSubjectType} 1</strong>, <strong>{selectedSubjectType} 2</strong>, or <strong>Paper A</strong>). Paper names are never automatically generated.
            </p>

            {paperError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paperError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePaper} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Manual Paper Name *
                </label>
                <input
                  type="text"
                  required
                  value={manualPaperName}
                  onChange={(e) => setManualPaperName(e.target.value)}
                  placeholder={`e.g. ${selectedSubjectType} 1`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddPaperModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all"
                >
                  {editingPaper ? 'Update Paper' : 'Save Paper'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ACADEMIC SESSION */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => setShowAddSessionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-100 mb-1">Add Academic Session</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter academic session format (e.g. <strong>2027-31</strong>).
            </p>

            <form onSubmit={handleAddSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="2027-31"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSessionModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GLOBAL PRACTICAL SUBJECT MASTER */}
      {showSubjectMasterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6">
            <button
              onClick={() => setShowSubjectMasterModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-100">Global Practical Subject Master</h3>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Shared across all academic sessions, semesters, and papers. Subject matching is case-insensitive.
              Initially contains the 7 core practical subjects (BOTANY, CHEMISTRY, PHYSICS, ZOOLOGY, GEOGRAPHY, PSYCHOLOGY, HOME SCIENCE).
            </p>

            {subjectError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{subjectError}</span>
              </div>
            )}

            {/* Add Subject Input */}
            <form onSubmit={handleAddPracticalSubject} className="flex gap-2 mb-5">
              <input
                type="text"
                required
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Enter new practical subject name..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500 uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shrink-0"
              >
                + Add Subject
              </button>
            </form>

            {/* Subjects Table */}
            <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Practical Subject Name</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3 w-16 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-sans">
                  {practicalSubjects.map((subj, idx) => (
                    <tr key={subj.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-200">{subj.name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Active
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePracticalSubject(subj.id, subj.name)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Delete Subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubjectMasterModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200"
              >
                Close Subject Master
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SEPARATE EXCEL UPLOAD & PREVIEW FOR SPECIFIC PAPER */}
      {activeUploadPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6 max-h-[92vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                      {activeUploadPaper.subjectType}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100">
                      Excel / CSV Upload for Paper: {activeUploadPaper.paperName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedSession} • {selectedSemester}. Required columns:{' '}
                    <code className="text-blue-300">SN.</code>,{' '}
                    <code className="text-blue-300">NAME OF STUDENT</code>,{' '}
                    <code className="text-blue-300">ROLL NO.</code>,{' '}
                    <code className="text-blue-300">SUBJECT</code>.
                  </p>
                </div>

                <button
                  onClick={() => setActiveUploadPaper(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="mt-4 border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl p-6 text-center bg-slate-950/60 transition-colors">
                <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-200">
                  Select Excel or CSV File for {activeUploadPaper.paperName}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  One file may contain multiple practical subjects. System will automatically group candidates subject-wise.
                </p>

                <div className="mt-4 flex items-center justify-center gap-3">
                  <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all">
                    <span>Choose File (.xlsx, .xls, .csv)</span>
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
                <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Preview Table */}
              {parsedRows.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Preview & Validation ({parsedRows.length} Rows)
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {parsedRows.filter((r) => !r.hasError).length} valid,{' '}
                      {parsedRows.filter((r) => r.hasError).length} invalid
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">SN.</th>
                          <th className="py-2.5 px-3 w-28">Roll No. *</th>
                          <th className="py-2.5 px-3">Student Name *</th>
                          <th className="py-2.5 px-3 w-36">Practical Subject *</th>
                          <th className="py-2.5 px-3 w-28">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-sans">
                        {parsedRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`hover:bg-slate-800/40 ${
                              row.hasError
                                ? 'bg-rose-950/20'
                                : row.isDuplicate
                                ? 'bg-amber-950/20'
                                : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono text-slate-500">
                              {row.serialNo}
                            </td>
                            <td className="py-1 px-3">
                              <input
                                type="text"
                                value={row.rollNumber}
                                onChange={(e) => handleUpdateParsedRow(row.id, 'rollNumber', e.target.value)}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                              />
                            </td>
                            <td className="py-1 px-3">
                              <input
                                type="text"
                                value={row.studentName}
                                onChange={(e) => handleUpdateParsedRow(row.id, 'studentName', e.target.value)}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                              />
                            </td>
                            <td className="py-1 px-3">
                              <select
                                value={row.normalizedSubject}
                                onChange={(e) => handleUpdateParsedRow(row.id, 'normalizedSubject', e.target.value)}
                                className={`w-full px-2 py-1 bg-slate-900 border rounded text-xs font-mono ${
                                  row.isUnknownSubject ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-amber-300'
                                }`}
                              >
                                {row.isUnknownSubject && (
                                  <option value={row.rawSubject}>Unknown: {row.rawSubject}</option>
                                )}
                                {practicalSubjects.map((s) => (
                                  <option key={s.id} value={s.name}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-1 px-3">
                              {row.hasError ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  <AlertTriangle className="w-3 h-3" />
                                  {row.errorMessage || 'Invalid'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle className="w-3 h-3" />
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Data will be securely grouped and saved to Firebase Firestore.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveUploadPaper(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={savingUpload || parsedRows.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 disabled:opacity-50 transition-all"
                >
                  {savingUpload ? 'Saving to Firestore...' : 'Confirm & Import to ' + activeUploadPaper.paperName}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSIGN INCHARGE & EXAMINER & CONFIGURE MARKS */}
      {assignmentModalPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6">
            <button
              onClick={() => setAssignmentModalPaper(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-1">
              Configure Examiner & Marks: {assignmentModalSubject}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Paper: <strong className="text-blue-400 font-mono">{assignmentModalPaper.paperName}</strong> ({selectedSession} • {selectedSemester})
            </p>

            {assignmentError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignmentError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAssignment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Group / Incharge Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={assignmentIncharge}
                    onChange={(e) => setAssignmentIncharge(e.target.value)}
                    placeholder="Prof. S. K. Roy (Incharge)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Examiner Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={assignmentExaminer}
                    onChange={(e) => setAssignmentExaminer(e.target.value)}
                    placeholder="Dr. M. P. Singh (Examiner)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Parent Department / Group
                </label>
                <select
                  value={assignmentParentDeptId}
                  onChange={(e) => setAssignmentParentDeptId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.isGroup ? '(Parent Group)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={assignmentMaxMarks}
                    onChange={(e) => setAssignmentMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-amber-300 mb-1">
                    Minimum Passing Marks *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={assignmentMaxMarks}
                    required
                    value={assignmentMinMarks}
                    onChange={(e) => setAssignmentMinMarks(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Allow Decimals
                  </label>
                  <select
                    value={assignmentAllowDecimals ? 'YES' : 'NO'}
                    onChange={(e) => setAssignmentAllowDecimals(e.target.value === 'YES')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="YES">Yes (e.g. 42.5)</option>
                    <option value="NO">No (Integers Only)</option>
                  </select>
                </div>
              </div>

              {activeAssignment && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Public Evaluation Link:</span>
                    <span className="font-mono text-blue-400 text-xs">
                      ?token={activeAssignment.token}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRegenerateToken(activeAssignment.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 text-amber-300 hover:bg-slate-700"
                    >
                      Regenerate
                    </button>
                    {activeAssignment.isLocked && (
                      <button
                        type="button"
                        onClick={() => handleReopenAssignment(activeAssignment.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-rose-600 text-white hover:bg-rose-500"
                      >
                        Reopen Form
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignmentModalPaper(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignment}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 disabled:opacity-50 transition-all"
                >
                  {savingAssignment ? 'Saving...' : 'Save Assignment Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
