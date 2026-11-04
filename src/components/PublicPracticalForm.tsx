import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Search,
  FileSpreadsheet,
  Send,
  Upload,
  Download,
  AlertTriangle,
  X,
  Check,
  RotateCcw,
  BookOpen,
  Layers,
  ShieldCheck,
  RefreshCw,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ExaminerAssignment,
  PaperStudent,
  PracticalForm,
  FormEnrollment,
  PracticalFormSubjectAssignment,
  MarksRecord,
} from '../types';
import {
  getExaminerAssignmentByToken,
  getPaperStudents,
  getAssignmentMarks,
  saveAssignmentMarks,
  finalSubmitExaminerAssignment,
  getPracticalFormByToken,
  getFormEnrollments,
  getFormMarks,
  saveBulkMarks,
  saveSingleMark,
  calculateResultStatus,
  getFormActiveSubjects,
  logActivity,
} from '../services/collegeService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as XLSX from 'xlsx';

interface PublicPracticalFormProps {
  token: string;
  collegeName?: string;
  onExit?: () => void;
}

interface EvaluatedStudentItem {
  studentId: string;
  rollNumber: string;
  studentName: string;
  subject: string;
  fatherName?: string;
}

interface ExcelImportRowError {
  rowNumber: number;
  rollNumber: string;
  studentName?: string;
  marks?: any;
  reason: string;
}

// Highlight matched text in search results
const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query || !query.trim()) return <>{text}</>;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded-xs">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const PublicPracticalForm: React.FC<PublicPracticalFormProps> = ({
  token,
  collegeName = 'NGM Degree Mahavidyalaya',
  onExit,
}) => {
  // Form entities
  const [assignment, setAssignment] = useState<ExaminerAssignment | null>(null);
  const [practicalForm, setPracticalForm] = useState<PracticalForm | null>(null);

  // Multiple Subjects state
  const [assignedSubjects, setAssignedSubjects] = useState<PracticalFormSubjectAssignment[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>('');
  const [subjectCandidateCounts, setSubjectCandidateCounts] = useState<Record<string, number>>({});

  // Candidates & Marks for active subject
  const [allEnrollments, setAllEnrollments] = useState<FormEnrollment[]>([]);
  const [candidates, setCandidates] = useState<EvaluatedStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-Save / Save status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Evaluation Input Map: studentId -> { marks: string; isPresent: boolean; remarks: string }
  const [inputMap, setInputMap] = useState<
    Record<string, { marks: string; isPresent: boolean; remarks: string }>
  >({});

  // Examiner name & table search
  const [inchargeDisplayName, setInchargeDisplayName] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  // 3-Step Sorting Mode: roll_asc -> pending_first -> promoted_first -> roll_asc
  const [sortMode, setSortMode] = useState<'roll_asc' | 'pending_first' | 'promoted_first'>('roll_asc');
  const handleCycleSortMode = () => {
    setSortMode((prev) => {
      if (prev === 'roll_asc') return 'pending_first';
      if (prev === 'pending_first') return 'promoted_first';
      return 'roll_asc';
    });
  };

  // Final submission state
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Excel Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsingImport, setParsingImport] = useState(false);
  const [importingToDb, setImportingToDb] = useState(false);
  const [importSuccessAlert, setImportSuccessAlert] = useState<string | null>(null);
  const [importMismatchError, setImportMismatchError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    studentsNotFound: number;
    marksOutOfRange: number;
    errors: ExcelImportRowError[];
    validRecords: Array<{
      studentId: string;
      rollNumber: string;
      studentName: string;
      marksObtained: number | null;
      isPresent: boolean;
      remarks?: string;
    }>;
  }>({
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    studentsNotFound: 0,
    marksOutOfRange: 0,
    errors: [],
    validRecords: [],
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadExaminationData();
  }, [token]);

  // Live real-time sync for form metadata (lock state, status, active toggle, deactivation)
  useEffect(() => {
    if (!practicalForm?.id) return;
    const unsub = onSnapshot(
      doc(db, 'practicalForms', practicalForm.id),
      (snap) => {
        if (!snap.exists()) {
          setError('This practical examination form has been deleted or archived by College Administration.');
          return;
        }
        const data = snap.data() as PracticalForm;
        setPracticalForm((prev) => (prev ? { ...prev, ...data } : null));
        if (!data.isActive) {
          setError('This practical examination link has been disabled by College Administration.');
        } else if (data.status === 'closed') {
          // Closed by admin
        }
      },
      (err) => {
        console.warn('Real-time practicalForm snapshot notice:', err);
      }
    );
    return () => unsub();
  }, [practicalForm?.id]);

  const loadExaminationData = async () => {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      setError('No token provided in the URL. Please verify your token link with College Administration.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Timeout wrapper to ensure we never hang forever
      const fetchWithTimeout = async () => {
        // Query both models in parallel for rapid response
        const [asgn, form] = await Promise.all([
          getExaminerAssignmentByToken(cleanToken).catch((err) => {
            console.warn('Assignment lookup notice:', err);
            return null;
          }),
          getPracticalFormByToken(cleanToken).catch((err) => {
            console.warn('Practical form lookup notice:', err);
            return null;
          }),
        ]);
        return { asgn, form };
      };

      const timeoutPromise = new Promise<{ asgn: null; form: null }>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'Connection timed out while loading the examination form. Please verify your internet connection or retry.'
              )
            ),
          12000
        )
      );

      const { asgn, form } = await Promise.race([fetchWithTimeout(), timeoutPromise]);

      // 1. Check ExaminerAssignment (Single Subject Assignment Model)
      if (asgn) {
        setAssignment(asgn);
        setInchargeDisplayName(asgn.inchargeName || asgn.examinerName || 'Subject Incharge');
        const asgnSubject = (asgn.subjectName || '').trim().toUpperCase();
        setActiveSubject(asgnSubject);
        setAssignedSubjects([
          {
            subjectId: asgn.id,
            subjectName: asgnSubject,
            subjectCode: asgn.subjectType,
            status: 'active',
            studentCount: asgn.totalStudents || 0,
            addedAt: asgn.createdAt,
          },
        ]);

        const paperStudents = await getPaperStudents(asgn.paperId);
        const filtered = paperStudents.filter(
          (s) => (s.subject || '').toUpperCase() === asgnSubject && s.status !== 'removed'
        );

        const mapped: EvaluatedStudentItem[] = filtered.map((s) => ({
          studentId: s.id,
          rollNumber: String(s.rollNumber || ''),
          studentName: String(s.studentName || ''),
          subject: s.subject || asgnSubject,
          fatherName: s.fatherName || '',
        }));
        setCandidates(mapped);
        setSubjectCandidateCounts({ [asgnSubject]: mapped.length });

        const savedMarks = await getAssignmentMarks(asgn.id);
        const marksMap = new Map(savedMarks.map((m) => [m.studentId, m]));

        const initialInputs: Record<string, { marks: string; isPresent: boolean; remarks: string }> = {};
        mapped.forEach((c) => {
          const m = marksMap.get(c.studentId);
          if (m) {
            initialInputs[c.studentId] = {
              marks: m.marksObtained !== null && m.marksObtained !== undefined ? String(m.marksObtained) : '',
              isPresent: m.isPresent,
              remarks: m.remarks || '',
            };
          } else {
            initialInputs[c.studentId] = { marks: '', isPresent: true, remarks: '' };
          }
        });

        setInputMap(initialInputs);
        return;
      }

      // 2. PracticalForm Model (Supports Multiple Subjects assigned to one Incharge)
      if (form) {
        if (!form.isActive) {
          setError('This practical examination link has been disabled by College Administration.');
          return;
        }
        if (form.status === 'draft') {
          setError('This practical examination form is currently in Draft status.');
          return;
        }

        setPracticalForm(form);
        setInchargeDisplayName(form.inchargeName || 'Subject Incharge');

        // Resolve all active subjects allotted to this Incharge
        const activeSubjs = getFormActiveSubjects(form);
        setAssignedSubjects(activeSubjs);

        // Pick initial active subject
        const initialSubj =
          activeSubject && activeSubjs.some((s) => s.subjectName.toUpperCase() === activeSubject.toUpperCase())
            ? activeSubject
            : activeSubjs[0]?.subjectName || form.subjectName || 'GEOGRAPHY';
        setActiveSubject(initialSubj);

        // Fetch all form enrollments and marks from Firestore
        await loadSubjectData(form, initialSubj, activeSubjs);
        return;
      }

      setError('Invalid or expired practical examination link. No matching examination record found for this token.');
    } catch (err: any) {
      console.error('Error loading examination data:', err);
      setError(err.message || 'Failed to load examination form. Please check network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Switch or reload active subject candidates & marks
  const loadSubjectData = async (
    form: PracticalForm,
    subjectName: string,
    subjectsList?: PracticalFormSubjectAssignment[]
  ) => {
    try {
      const cleanSubj = subjectName.trim().toUpperCase();

      // Fetch all enrollments for form
      const enrs = await getFormEnrollments(form.id);
      setAllEnrollments(enrs);

      // Compute counts per subject
      const counts: Record<string, number> = {};
      const subjs = subjectsList || assignedSubjects;
      subjs.forEach((s) => {
        const matching = enrs.filter(
          (e) => (e.subject || form.subjectName || '').trim().toUpperCase() === s.subjectName.toUpperCase()
        );
        counts[s.subjectName.toUpperCase()] = matching.length;
      });
      setSubjectCandidateCounts(counts);

      // Filter enrollments for the currently active subject
      const currentEnrs = enrs.filter(
        (e) => (e.subject || form.subjectName || '').trim().toUpperCase() === cleanSubj
      );

      const mapped: EvaluatedStudentItem[] = currentEnrs.map((e) => ({
        studentId: e.studentId,
        rollNumber: String(e.rollNumber || ''),
        studentName: String(e.studentName || ''),
        subject: cleanSubj,
        fatherName: e.fatherName || '',
      }));
      setCandidates(mapped);

      // Fetch saved marks specifically for this subject
      const marks = await getFormMarks(form.id, cleanSubj);
      const marksMap = new Map(marks.map((m) => [m.studentId, m]));

      const inputs: Record<string, { marks: string; isPresent: boolean; remarks: string }> = {};
      mapped.forEach((c) => {
        const m = marksMap.get(c.studentId);
        if (m) {
          inputs[c.studentId] = {
            marks: m.marksObtained !== null && m.marksObtained !== undefined ? String(m.marksObtained) : '',
            isPresent: m.isPresent,
            remarks: m.remarks || '',
          };
        } else {
          inputs[c.studentId] = { marks: '', isPresent: true, remarks: '' };
        }
      });

      setInputMap(inputs);
    } catch (err) {
      console.error('Error loading subject data:', err);
    }
  };

  const handleSwitchSubject = async (newSubject: string) => {
    if (newSubject.toUpperCase() === activeSubject.toUpperCase()) return;
    setActiveSubject(newSubject);
    if (practicalForm) {
      await loadSubjectData(practicalForm, newSubject, assignedSubjects);
    }
  };

  const isLocked = assignment?.isLocked || practicalForm?.status === 'closed';
  const maxMarks = assignment ? assignment.maxMarks : practicalForm?.maxMarks || 50;
  const minMarks = assignment ? assignment.minMarks : practicalForm?.minPassingMarks ?? Math.round(maxMarks * 0.33);
  const allowDecimals = assignment ? assignment.allowDecimals : practicalForm?.allowDecimals ?? false;
  const examSubTitle = assignment
    ? `Academic Session: ${assignment.session} • ${assignment.semester} (${assignment.subjectType})`
    : `Session: ${practicalForm?.session || practicalForm?.examYear || '2025-29'} • ${practicalForm?.semester || 'Semester 2'} (${practicalForm?.subjectType || 'MJC'})`;
  const paperLabel = assignment ? assignment.paperName : practicalForm?.paperName || 'Practical Paper';

  // Mark change with strict validation
  const handleMarkChange = (studentId: string, val: string) => {
    if (isLocked) return;

    if (!allowDecimals && val.includes('.')) {
      alert('This examination is configured for integer marks only.');
      return;
    }

    const num = Number(val);
    if (!isNaN(num) && num > maxMarks) {
      alert(`Marks cannot exceed maximum marks (${maxMarks}).`);
      return;
    }
    if (!isNaN(num) && num < 0) {
      alert('Marks cannot be negative.');
      return;
    }

    setInputMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { isPresent: true, remarks: '' }),
        marks: val,
        isPresent: true,
      },
    }));

    setSaveStatus('idle');
  };

  // Toggle Attendance (Absent / Present)
  const handleAttendanceToggle = (studentId: string) => {
    if (isLocked) return;
    setInputMap((prev) => {
      const cur = prev[studentId] || { marks: '', isPresent: true, remarks: '' };
      const nextPresent = !cur.isPresent;
      return {
        ...prev,
        [studentId]: {
          ...cur,
          isPresent: nextPresent,
          marks: nextPresent ? cur.marks : '',
        },
      };
    });
    setSaveStatus('idle');
  };

  // Save to Firestore (Auto-Save & Manual)
  const handleSaveDraftToFirestore = async () => {
    if (isLocked) return;

    try {
      setSaveStatus('saving');
      setSaveErrorMsg(null);

      if (assignment) {
        const records = candidates.map((c) => {
          const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
          return {
            studentId: c.studentId,
            rollNumber: c.rollNumber,
            studentName: c.studentName,
            subject: c.subject,
            marksObtained: inp.isPresent && inp.marks !== '' ? Number(inp.marks) : null,
            isPresent: inp.isPresent,
            remarks: inp.remarks,
          };
        });

        await saveAssignmentMarks(assignment, records, inchargeDisplayName || 'Examiner');
      } else if (practicalForm) {
        const records = candidates.map((c) => {
          const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
          return {
            studentId: c.studentId,
            rollNumber: c.rollNumber,
            studentName: c.studentName,
            subject: activeSubject,
            marksObtained: inp.isPresent && inp.marks !== '' ? Number(inp.marks) : null,
            isPresent: inp.isPresent,
            remarks: inp.remarks,
            minPassingMarks: minMarks,
          };
        });

        await saveBulkMarks(practicalForm.id, records, inchargeDisplayName || 'Incharge', activeSubject);
      }

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
      }, 3500);
    } catch (err: any) {
      console.error('Error saving marks:', err);
      setSaveStatus('error');
      setSaveErrorMsg(err.message || 'Connection problem or write error');
    }
  };

  // Final Submit & Form Locking
  const handleFinalSubmit = async () => {
    if (isLocked) return;

    // Check if every candidate in the current subject has marks or is marked absent
    const pendingList = candidates.filter((c) => {
      const inp = inputMap[c.studentId];
      if (!inp) return true;
      if (inp.isPresent && (inp.marks === '' || inp.marks === null || inp.marks === undefined)) return true;
      return false;
    });

    if (pendingList.length > 0) {
      alert(
        `Final Submit Incomplete: There are ${pendingList.length} candidate(s) in ${activeSubject} awaiting marks or attendance. All candidates must have evaluated marks or be marked Absent before final submission.`
      );
      return;
    }

    const ok = window.confirm(
      `Confirm Final Submission for ${activeSubject}?\n\nAfter submission, practical examination evaluation for this subject will be locked. Incharge: ${inchargeDisplayName}`
    );
    if (!ok) return;

    try {
      setSubmitting(true);
      await handleSaveDraftToFirestore();

      if (assignment) {
        await finalSubmitExaminerAssignment(assignment.id, inchargeDisplayName);
        setAssignment((prev) => (prev ? { ...prev, isLocked: true, status: 'Final Submitted' } : null));
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSubmittedSuccess(true);
    } catch (err: any) {
      alert(`Final submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== EXCEL EXPORT (EXACT 6 COLUMNS + SAFE METADATA SHEET) ====================
  const handleExportExcel = async () => {
    const formId = practicalForm?.id || assignment?.id || 'exam';
    const cleanSubj = activeSubject.trim().toUpperCase();

    const wb = XLSX.utils.book_new();

    // Main Sheet: EXACT 6 columns specified in the brief
    const mainHeaders = [
      'SN.',
      'ROLL NO.',
      'NAME OF STUDENT',
      "FATHER'S NAME",
      'MARKS',
      'STATUS',
    ];

    const mainRows = candidates.map((c, idx) => {
      const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
      const hasMarks = inp.isPresent && inp.marks !== '' && !isNaN(Number(inp.marks));
      const statusText = isLocked
        ? 'Submitted'
        : !inp.isPresent
        ? 'Absent'
        : hasMarks
        ? 'Saved'
        : 'Pending';

      const markVal = !inp.isPresent ? 'ABSENT' : inp.marks !== '' ? Number(inp.marks) : '';

      return [
        idx + 1,
        c.rollNumber,
        c.studentName,
        c.fatherName || '—',
        markVal,
        statusText,
      ];
    });

    const wsMain = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainRows]);

    // Format column widths for clarity
    wsMain['!cols'] = [
      { wch: 8 },  // SN.
      { wch: 18 }, // ROLL NO.
      { wch: 28 }, // NAME OF STUDENT
      { wch: 26 }, // FATHER'S NAME
      { wch: 12 }, // MARKS
      { wch: 14 }, // STATUS
    ];

    // Technical Verification Sheet: Holds Form ID, Subject, Range constraints
    const metaRows = [
      ['METADATA_VERSION', '1.0'],
      ['FORM_ID', formId],
      ['SUBJECT_NAME', cleanSubj],
      ['SUBJECT_ID', practicalForm?.subjectId || assignment?.id || ''],
      ['PAPER_NAME', paperLabel],
      ['SESSION', practicalForm?.session || assignment?.session || ''],
      ['SEMESTER', practicalForm?.semester || assignment?.semester || ''],
      ['INCHARGE_NAME', inchargeDisplayName],
      ['MAX_MARKS', maxMarks],
      ['MIN_PASS_MARKS', minMarks],
      ['ALLOW_DECIMALS', allowDecimals ? 'YES' : 'NO'],
      [],
      ['STUDENT_ID', 'ROLL_NO', 'STUDENT_NAME', 'SUBJECT'],
      ...candidates.map((c) => [c.studentId, c.rollNumber, c.studentName, c.subject]),
    ];

    const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);

    XLSX.utils.book_append_sheet(wb, wsMain, 'Marksheet');
    XLSX.utils.book_append_sheet(wb, wsMeta, '_METADATA_');

    const fileName = `Practical_Marks_${cleanSubj.replace(/[^a-zA-Z0-9]/g, '_')}_${paperLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    await logActivity(
      'EXCEL_EXPORTED',
      `Exported marksheet template for subject "${cleanSubj}" in form "${formId}" (${candidates.length} students)`,
      'PracticalForm',
      formId,
      inchargeDisplayName
    );
  };

  // ==================== EXCEL IMPORT WITH STRICT VALIDATION ====================
  const handleOpenImportModal = () => {
    setImportFile(null);
    setImportMismatchError(null);
    setImportSuccessAlert(null);
    setImportStats({
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      studentsNotFound: 0,
      marksOutOfRange: 0,
      errors: [],
      validRecords: [],
    });
    setShowImportModal(true);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      parseExcelFile(file);
    }
  };

  const parseExcelFile = (file: File) => {
    setParsingImport(true);
    setImportMismatchError(null);
    setImportSuccessAlert(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });

        const formId = practicalForm?.id || assignment?.id || '';
        const currentSubj = activeSubject.trim().toUpperCase();

        // 1. Verify Metadata if present
        let detectedFormId = '';
        let detectedSubject = '';

        if (wb.Sheets['_METADATA_']) {
          const metaAoa: any[][] = XLSX.utils.sheet_to_json(wb.Sheets['_METADATA_'], { header: 1 });
          metaAoa.forEach((row) => {
            if (row[0] === 'FORM_ID') detectedFormId = String(row[1] || '').trim();
            if (row[0] === 'SUBJECT_NAME') detectedSubject = String(row[1] || '').trim().toUpperCase();
          });

          if (detectedFormId && detectedFormId !== formId) {
            const msg = `Security Mismatch: This Excel file belongs to Form ID "${detectedFormId}", but this portal is for Form ID "${formId}". Import rejected to prevent accidental cross-form overwrites.`;
            setImportMismatchError(msg);
            setParsingImport(false);
            return;
          }

          if (detectedSubject && detectedSubject !== currentSubj) {
            const msg = `Subject Mismatch: This Excel file contains marks for subject "${detectedSubject}", but you are currently evaluating "${currentSubj}". Please select the "${detectedSubject}" tab or upload the matching file.`;
            setImportMismatchError(msg);
            setParsingImport(false);
            return;
          }
        }

        // 2. Parse Main Marksheet
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        if (!sheet) {
          throw new Error('Excel sheet contains no data.');
        }

        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rawRows.length <= 1) {
          throw new Error('Excel file has no student data rows.');
        }

        // Identify column indexes from header row
        let headerRowIndex = 0;
        let rollCol = 1;
        let marksCol = 4;

        for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
          const row = rawRows[r];
          if (!row) continue;
          row.forEach((cell: any, cIdx: number) => {
            const str = String(cell || '').trim().toUpperCase();
            if (str.includes('ROLL') || str === 'ROLL NO.' || str === 'ROLL NO') {
              headerRowIndex = r;
              rollCol = cIdx;
            }
            if (str.includes('MARK') || str === 'MARKS' || str === 'MARKS OBTAINED') {
              marksCol = cIdx;
            }
          });
        }

        const candidateMap = new Map<string, EvaluatedStudentItem>();
        candidates.forEach((c) => {
          candidateMap.set(c.rollNumber.trim().toUpperCase(), c);
        });

        const seenRolls = new Set<string>();
        const errors: ExcelImportRowError[] = [];
        const validRecords: Array<{
          studentId: string;
          rollNumber: string;
          studentName: string;
          marksObtained: number | null;
          isPresent: boolean;
          remarks?: string;
        }> = [];

        let totalRows = 0;
        let validRows = 0;
        let duplicateRows = 0;
        let studentsNotFound = 0;
        let marksOutOfRange = 0;

        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.length === 0) continue;

          const rollRaw = row[rollCol];
          if (rollRaw === undefined || rollRaw === null || String(rollRaw).trim() === '') {
            continue; // Skip trailing empty row
          }

          totalRows++;
          const rollStr = String(rollRaw).trim().toUpperCase();
          const markRaw = row[marksCol];

          // Check duplicate roll number in file
          if (seenRolls.has(rollStr)) {
            duplicateRows++;
            errors.push({
              rowNumber: i + 1,
              rollNumber: rollStr,
              marks: markRaw,
              reason: `Duplicate Roll Number "${rollStr}" in uploaded Excel file.`,
            });
            continue;
          }
          seenRolls.add(rollStr);

          // Find candidate in current subject roster
          const candidate = candidateMap.get(rollStr);
          if (!candidate) {
            studentsNotFound++;
            errors.push({
              rowNumber: i + 1,
              rollNumber: rollStr,
              marks: markRaw,
              reason: `Student with Roll Number "${rollStr}" is not in the allotted candidate list for ${currentSubj}.`,
            });
            continue;
          }

          // Validate Marks
          const markStr = String(markRaw ?? '').trim().toUpperCase();
          let isPresent = true;
          let parsedMarks: number | null = null;

          if (markStr === 'ABS' || markStr === 'ABSENT' || markStr === 'AB') {
            isPresent = false;
            parsedMarks = null;
          } else if (markStr === '' || markStr === 'PENDING' || markStr === 'NULL' || markStr === '-') {
            isPresent = true;
            parsedMarks = null;
          } else {
            const num = Number(markStr);
            if (isNaN(num)) {
              marksOutOfRange++;
              errors.push({
                rowNumber: i + 1,
                rollNumber: rollStr,
                studentName: candidate.studentName,
                marks: markRaw,
                reason: `Invalid non-numeric marks value "${markRaw}". Enter number or "ABSENT".`,
              });
              continue;
            }

            if (!allowDecimals && markStr.includes('.')) {
              errors.push({
                rowNumber: i + 1,
                rollNumber: rollStr,
                studentName: candidate.studentName,
                marks: markRaw,
                reason: `Decimal marks are not permitted. Please enter integers only.`,
              });
              continue;
            }

            if (num < 0 || num > maxMarks) {
              marksOutOfRange++;
              errors.push({
                rowNumber: i + 1,
                rollNumber: rollStr,
                studentName: candidate.studentName,
                marks: markRaw,
                reason: `Marks (${num}) outside permitted range [0 - ${maxMarks}].`,
              });
              continue;
            }

            parsedMarks = num;
            isPresent = true;
          }

          validRows++;
          validRecords.push({
            studentId: candidate.studentId,
            rollNumber: candidate.rollNumber,
            studentName: candidate.studentName,
            marksObtained: parsedMarks,
            isPresent,
            remarks: '',
          });
        }

        setImportStats({
          totalRows,
          validRows,
          invalidRows: errors.length,
          duplicateRows,
          studentsNotFound,
          marksOutOfRange,
          errors,
          validRecords,
        });
      } catch (err: any) {
        setImportMismatchError(err.message || 'Failed to parse Excel file.');
      } finally {
        setParsingImport(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (importStats.validRecords.length === 0) return;

    try {
      setImportingToDb(true);
      const formId = practicalForm?.id || assignment?.id || '';
      const cleanSubj = activeSubject.trim().toUpperCase();

      // Write valid records directly to Firestore
      if (assignment) {
        const records = importStats.validRecords.map((r) => ({
          studentId: r.studentId,
          rollNumber: r.rollNumber,
          studentName: r.studentName,
          subject: cleanSubj,
          marksObtained: r.marksObtained,
          isPresent: r.isPresent,
          remarks: r.remarks,
        }));
        await saveAssignmentMarks(assignment, records, inchargeDisplayName || 'Incharge');
      } else if (practicalForm) {
        const records = importStats.validRecords.map((r) => ({
          studentId: r.studentId,
          rollNumber: r.rollNumber,
          studentName: r.studentName,
          subject: cleanSubj,
          marksObtained: r.marksObtained,
          isPresent: r.isPresent,
          remarks: r.remarks,
          minPassingMarks: minMarks,
        }));
        await saveBulkMarks(practicalForm.id, records, inchargeDisplayName || 'Incharge', cleanSubj);
      }

      await logActivity(
        'MARKS_UPDATED_VIA_IMPORT',
        `Successfully imported and saved marks for ${importStats.validRecords.length} candidates in subject ${cleanSubj}`,
        'MarksRecord',
        formId,
        inchargeDisplayName
      );

      // Update local inputMap
      setInputMap((prev) => {
        const next = { ...prev };
        importStats.validRecords.forEach((r) => {
          next[r.studentId] = {
            marks: r.isPresent && r.marksObtained !== null ? String(r.marksObtained) : '',
            isPresent: r.isPresent,
            remarks: r.remarks || '',
          };
        });
        return next;
      });

      setImportSuccessAlert(`Successfully updated ${importStats.validRecords.length} candidate marks in Firestore!`);
      setTimeout(() => {
        setShowImportModal(false);
      }, 1800);
    } catch (err: any) {
      alert(`Import save failed: ${err.message}`);
    } finally {
      setImportingToDb(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">{collegeName}</h3>
            <p className="text-xs text-blue-600 font-semibold mt-0.5">Connecting to Marks Evaluation Portal...</p>
          </div>
          <p className="text-[11px] text-slate-400">Verifying secure token authorization with Firebase Firestore</p>
          <div className="pt-2">
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                loadExaminationData();
              }}
              className="text-[11px] text-slate-500 hover:text-blue-600 inline-flex items-center gap-1.5 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Taking too long? Click to Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Examination Link Inaccessible</h2>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
            {error}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                loadExaminationData();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Return to College Portal
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-400 block pt-1 border-t border-slate-100">
            Token: <code className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] break-all">{token || 'None'}</code>
          </div>
        </div>
      </div>
    );
  }

  // Live count summary for active subject
  let evaluatedCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  candidates.forEach((c) => {
    const inp = inputMap[c.studentId];
    if (!inp) pendingCount++;
    else if (!inp.isPresent) absentCount++;
    else if (inp.marks !== '') evaluatedCount++;
    else pendingCount++;
  });

  // Categorize students: First 2 numeric digits of roll number
  // Highest prefix = Regular, lower prefixes = Promoted, non-numeric/missing = Unclassified
  const candidateCategories = React.useMemo(() => {
    const prefixMap = new Map<string, number>();
    const validPrefixes: number[] = [];

    candidates.forEach((c) => {
      const rollStr = String(c.rollNumber || '').trim();
      const match = rollStr.match(/^(\d{2})/);
      if (match) {
        const num = parseInt(match[1], 10);
        prefixMap.set(c.studentId, num);
        validPrefixes.push(num);
      }
    });

    const maxPrefix = validPrefixes.length > 0 ? Math.max(...validPrefixes) : null;
    const result = new Map<string, 'regular' | 'promoted' | 'unclassified'>();

    candidates.forEach((c) => {
      const p = prefixMap.get(c.studentId);
      if (p !== undefined && maxPrefix !== null) {
        if (p === maxPrefix) {
          result.set(c.studentId, 'regular');
        } else if (p < maxPrefix) {
          result.set(c.studentId, 'promoted');
        } else {
          result.set(c.studentId, 'regular');
        }
      } else {
        result.set(c.studentId, 'unclassified');
      }
    });

    return result;
  }, [candidates]);

  // Global live search across other allotted subjects for this Incharge
  const crossSubjectMatches = React.useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return [];

    const cleanActive = activeSubject.trim().toUpperCase();
    const matches: Array<{
      subjectName: string;
      studentName: string;
      rollNumber: string;
    }> = [];

    allEnrollments.forEach((e) => {
      const subj = (e.subject || practicalForm?.subjectName || '').trim().toUpperCase();
      if (subj && subj !== cleanActive) {
        const roll = String(e.rollNumber || '').toLowerCase();
        const sName = String(e.studentName || '').toLowerCase();
        if (roll.includes(q) || sName.includes(q)) {
          matches.push({
            subjectName: subj,
            studentName: e.studentName,
            rollNumber: e.rollNumber,
          });
        }
      }
    });

    return matches;
  }, [tableSearch, allEnrollments, activeSubject, practicalForm]);

  // Sorted and Filtered Candidates for the Active Subject
  const filteredCandidates = React.useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    let list = candidates.filter((c) => {
      if (!query) return true;
      const roll = String(c.rollNumber || '').toLowerCase();
      const sName = String(c.studentName || '').toLowerCase();
      return roll.includes(query) || sName.includes(query);
    });

    return [...list].sort((a, b) => {
      const rollA = String(a.rollNumber || '');
      const rollB = String(b.rollNumber || '');

      if (sortMode === 'pending_first') {
        const inpA = inputMap[a.studentId];
        const inpB = inputMap[b.studentId];
        const isPendingA = !inpA || (inpA.isPresent && (inpA.marks === '' || inpA.marks === null || inpA.marks === undefined));
        const isPendingB = !inpB || (inpB.isPresent && (inpB.marks === '' || inpB.marks === null || inpB.marks === undefined));

        if (isPendingA && !isPendingB) return -1;
        if (!isPendingA && isPendingB) return 1;

        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }

      if (sortMode === 'promoted_first') {
        const catA = candidateCategories.get(a.studentId) || 'unclassified';
        const catB = candidateCategories.get(b.studentId) || 'unclassified';

        const weight: Record<'promoted' | 'regular' | 'unclassified', number> = {
          promoted: 1,
          regular: 2,
          unclassified: 3,
        };

        if (weight[catA] !== weight[catB]) {
          return weight[catA] - weight[catB];
        }

        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      }

      // Default 'roll_asc': Natural ascending roll number sort
      return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [candidates, tableSearch, sortMode, inputMap, candidateCategories]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16">
      {/* Top Academic Header */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">{collegeName}</h1>
              <p className="text-xs text-blue-600 font-medium">
                Practical Examination Marks Evaluation Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Save Cloud Status */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border bg-slate-50 border-slate-200">
              {saveStatus === 'saving' && (
                <>
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-blue-600 font-semibold">Saving to Cloud...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Saved to Firestore</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-700 font-semibold">Write Error</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-slate-500">Draft Status</span>
                </>
              )}
            </div>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm"
              title="Download Excel Template for this subject"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {/* Import Excel Button */}
            {!isLocked && (
              <button
                onClick={handleOpenImportModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm"
                title="Upload evaluated marks from Excel"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import Excel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-5">
        {/* PROMINENT INCHARGE & ALLOTTED SUBJECTS HEADER CARD */}
        <div className="bg-white border-t-8 border-t-blue-600 border-x border-b border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-extrabold text-blue-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Authorized Examination Evaluation</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                Incharge: {inchargeDisplayName || 'Kunal Singh'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {examSubTitle} • <strong className="text-slate-700 font-mono">{paperLabel}</strong>
              </p>
            </div>

            <div>
              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 shadow-sm">
                  <Lock className="w-4 h-4" /> Final Submitted & Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Open for Evaluation
                </span>
              )}
            </div>
          </div>

          {/* Allotted Subjects Selector Tabs */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Allotted Subjects for this Incharge ({assignedSubjects.length}):
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Click a subject tab below to switch student marks entry
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {assignedSubjects.map((asgn) => {
                const isSelected = asgn.subjectName.toUpperCase() === activeSubject.toUpperCase();
                const count = subjectCandidateCounts[asgn.subjectName.toUpperCase()] ?? asgn.studentCount ?? 0;
                return (
                  <button
                    key={asgn.subjectName}
                    type="button"
                    onClick={() => handleSwitchSubject(asgn.subjectName)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-600 ring-offset-2'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{asgn.subjectName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count} Candidates
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Subject Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Active Subject:</span>
              <strong className="text-sm text-blue-700 font-bold">{activeSubject}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Maximum Marks:</span>
              <strong className="text-base text-slate-900 font-mono">{maxMarks}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Format:</span>
              <strong className="text-slate-700 font-medium">
                {allowDecimals ? 'Decimals Allowed' : 'Integers Only'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Allotted Candidates:</span>
              <strong className="text-slate-900 font-mono font-bold">{candidates.length}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Saved / Absent:</span>
              <strong className="text-emerald-700 font-mono font-bold">
                {evaluatedCount} / {absentCount}
              </strong>
            </div>
          </div>
        </div>

        {submittedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Practical marks for {activeSubject} have been finalized, submitted, and locked in Firestore!
            </span>
          </div>
        )}

        {isLocked && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">
              This practical examination has been finalized and locked. Editing is restricted unless authorized by College Administration.
            </span>
          </div>
        )}

        {/* INCHARGE MARKS ENTRY TABLE (EXACT 5 COLUMNS) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Global Real-Time Search Input with Clear Button */}
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder={`Search by Roll No. or Student Name...`}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Three-Step Sorting System Button */}
              <button
                type="button"
                onClick={handleCycleSortMode}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 shrink-0"
                title="Click to cycle sorting modes: Roll No ↑ -> Pending First -> Promoted First"
              >
                {sortMode === 'roll_asc' && (
                  <>
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Sort: Roll No. ↑</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">1/3</span>
                  </>
                )}
                {sortMode === 'pending_first' && (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Sort: Pending First</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">2/3</span>
                  </>
                )}
                {sortMode === 'promoted_first' && (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Sort: Promoted First</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">3/3</span>
                  </>
                )}
              </button>
            </div>

            {!isLocked && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraftToFirestore}
                  disabled={saveStatus === 'saving'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting || pendingCount > 0}
                  className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                  title={pendingCount > 0 ? `Please record marks or mark Absent for all ${pendingCount} pending candidates` : 'Final Submit'}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Final Submit & Lock</span>
                </button>
              </div>
            )}
          </div>

          {/* Cross-Subject Global Match Notification */}
          {crossSubjectMatches.length > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 text-indigo-900 shadow-xs">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Found <strong>{crossSubjectMatches.length}</strong> matching candidate(s) in other assigned subject(s):
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(crossSubjectMatches.map((m) => m.subjectName))).map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => handleSwitchSubject(sName)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs"
                  >
                    Switch to {sName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SIMPLIFIED 5-COLUMN TABLE */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-16 text-center">1. SN.</th>
                  <th className="py-3 px-4 w-44">2. ROLL NO.</th>
                  <th className="py-3 px-4">3. NAME OF STUDENT</th>
                  <th className="py-3 px-4 w-40 text-center">4. MARKS</th>
                  <th className="py-3 px-4 w-32 text-center">5. STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No candidates found matching search for {activeSubject}.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c, idx) => {
                    const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
                    const isPresent = inp.isPresent;
                    const hasMark = isPresent && inp.marks !== '' && !isNaN(Number(inp.marks));
                    const category = candidateCategories.get(c.studentId) || 'unclassified';

                    return (
                      <tr
                        key={c.studentId}
                        className={!isPresent ? 'bg-rose-50/50' : 'hover:bg-slate-50/80 transition-colors'}
                      >
                        {/* 1. SN. */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400 font-medium">
                          {idx + 1}
                        </td>

                        {/* 2. ROLL NO. (with Classification Badge) */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>
                              <HighlightedText text={c.rollNumber} query={tableSearch} />
                            </span>
                            {category === 'promoted' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Promoted
                              </span>
                            )}
                            {category === 'regular' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Regular
                              </span>
                            )}
                            {category === 'unclassified' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-zinc-100 text-zinc-500">
                                Unclassified
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. NAME OF STUDENT (with Father's Name directly below) */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 leading-snug">
                            <HighlightedText text={c.studentName} query={tableSearch} />
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                            {c.fatherName ? `Father's Name: ${c.fatherName}` : "Father's Name: —"}
                          </div>
                        </td>

                        {/* 4. MARKS (Editable Input Box) */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              step={allowDecimals ? '0.1' : '1'}
                              min={0}
                              max={maxMarks}
                              disabled={isLocked || !isPresent}
                              value={inp.marks}
                              onChange={(e) => handleMarkChange(c.studentId, e.target.value)}
                              placeholder={isPresent ? '0' : 'ABS'}
                              className={`w-20 py-1.5 px-2 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                                !isPresent
                                  ? 'bg-rose-100 border-rose-300 text-rose-700 font-black cursor-not-allowed'
                                  : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100'
                              }`}
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleAttendanceToggle(c.studentId)}
                                title={isPresent ? 'Click to mark candidate Absent' : 'Click to mark candidate Present'}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                                  !isPresent
                                    ? 'bg-rose-200 text-rose-800 border-rose-300'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                                }`}
                              >
                                {!isPresent ? 'ABS' : 'AB?'}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* 5. STATUS (Pending, Saved, or Submitted) */}
                        <td className="py-3 px-4 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Lock className="w-3 h-3" /> Submitted
                            </span>
                          ) : !isPresent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Absent
                            </span>
                          ) : hasMark ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-500" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ==================== EXCEL IMPORT MODAL ==================== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Import Evaluated Marks from Excel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Active Subject: <strong className="text-blue-600 font-bold">{activeSubject}</strong> • Max Marks: {maxMarks}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Instructions */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Excel Import Verification & Safety Rules:
                </p>
                <ul className="list-disc list-inside text-[11px] text-blue-800 space-y-0.5">
                  <li>Upload the Excel template previously exported for <strong>{activeSubject}</strong>.</li>
                  <li>Matching uses stable roll numbers against the active subject roster.</li>
                  <li>Only the <strong>MARKS</strong> field is updated; student identities are never overwritten.</li>
                </ul>
              </div>

              {/* Upload Input Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <FileSpreadsheet className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {importFile ? importFile.name : 'Click to browse or drop evaluated Excel file (.xlsx)'}
                </p>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Supports standard Excel format exported from this portal
                </span>
              </div>

              {parsingImport && (
                <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold">Validating Excel rows and marks constraints...</span>
                </div>
              )}

              {importMismatchError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Upload Rejected – File Mismatch</span>
                  </div>
                  <p className="text-xs leading-relaxed">{importMismatchError}</p>
                </div>
              )}

              {importSuccessAlert && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{importSuccessAlert}</span>
                </div>
              )}

              {/* Preview Stats Strip */}
              {importStats.totalRows > 0 && !importMismatchError && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="p-2.5 bg-slate-100 rounded-xl">
                      <span className="text-slate-500 block text-[10px]">Total Rows</span>
                      <strong className="text-sm font-bold text-slate-800">{importStats.totalRows}</strong>
                    </div>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-emerald-700 block text-[10px]">Valid Marks</span>
                      <strong className="text-sm font-bold text-emerald-700">{importStats.validRows}</strong>
                    </div>
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                      <span className="text-rose-700 block text-[10px]">Invalid Rows</span>
                      <strong className="text-sm font-bold text-rose-700">{importStats.invalidRows}</strong>
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-amber-700 block text-[10px]">Duplicates</span>
                      <strong className="text-sm font-bold text-amber-700">{importStats.duplicateRows}</strong>
                    </div>
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                      <span className="text-purple-700 block text-[10px]">Not Found</span>
                      <strong className="text-sm font-bold text-purple-700">{importStats.studentsNotFound}</strong>
                    </div>
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl">
                      <span className="text-red-700 block text-[10px]">Out of Range</span>
                      <strong className="text-sm font-bold text-red-700">{importStats.marksOutOfRange}</strong>
                    </div>
                  </div>

                  {/* Errors Table if any */}
                  {importStats.errors.length > 0 && (
                    <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/50 space-y-2">
                      <div className="font-bold text-rose-900 flex items-center justify-between text-xs">
                        <span>Row-wise Validation Issues ({importStats.errors.length}):</span>
                        <span className="text-[11px] text-rose-600 font-normal">
                          Only valid rows will be imported if confirmed
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importStats.errors.map((err, i) => (
                          <div key={i} className="text-[11px] text-rose-800 bg-white p-2 rounded-lg border border-rose-200 flex items-start gap-2">
                            <span className="font-mono font-bold shrink-0">Row {err.rowNumber}:</span>
                            <span className="font-mono shrink-0">[{err.rollNumber}]</span>
                            <span className="flex-1">{err.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importStats.validRows === 0 || importingToDb || !!importMismatchError}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
              >
                {importingToDb ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Save {importStats.validRows} Marks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
