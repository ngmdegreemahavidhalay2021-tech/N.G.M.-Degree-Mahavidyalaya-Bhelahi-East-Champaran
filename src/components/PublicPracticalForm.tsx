import React, { useState, useEffect } from 'react';
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
  CloudCheck,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ExaminerAssignment,
  PaperStudent,
  AssignmentMarkRecord,
  PracticalForm,
  FormEnrollment,
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
} from '../services/collegeService';
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

export const PublicPracticalForm: React.FC<PublicPracticalFormProps> = ({
  token,
  collegeName = 'NGM Degree Mahavidyalaya',
}) => {
  // Assignment mode (New) vs Legacy PracticalForm mode
  const [assignment, setAssignment] = useState<ExaminerAssignment | null>(null);
  const [legacyForm, setLegacyForm] = useState<PracticalForm | null>(null);

  // Unified candidate list
  const [candidates, setCandidates] = useState<EvaluatedStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Evaluation Input Map: studentId -> { marks: string; isPresent: boolean; remarks: string }
  const [inputMap, setInputMap] = useState<
    Record<string, { marks: string; isPresent: boolean; remarks: string }>
  >({});

  // Examiner name & search
  const [examinerName, setExaminerName] = useState('External Examiner');
  const [tableSearch, setTableSearch] = useState('');
  const [mode, setMode] = useState<'bulk' | 'individual'>('bulk');
  const [selectedStudent, setSelectedStudent] = useState<EvaluatedStudentItem | null>(null);
  const [indivMarks, setIndivMarks] = useState('');
  const [indivPresent, setIndivPresent] = useState(true);
  const [indivRemarks, setIndivRemarks] = useState('');

  // Final submission state
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    loadExaminationData();
  }, [token]);

  const loadExaminationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Try finding an ExaminerAssignment matching this token
      const asgn = await getExaminerAssignmentByToken(token);
      if (asgn) {
        setAssignment(asgn);
        setExaminerName(asgn.examinerName || 'External Examiner');

        // Fetch students enrolled in this paper with this practical subject
        const paperStudents = await getPaperStudents(asgn.paperId);
        const filtered = paperStudents.filter(
          (s) => s.subject.toUpperCase() === asgn.subjectName.toUpperCase() && s.status !== 'removed'
        );

        const mappedCandidates: EvaluatedStudentItem[] = filtered.map((s) => ({
          studentId: s.id,
          rollNumber: s.rollNumber,
          studentName: s.studentName,
          subject: s.subject,
          fatherName: s.fatherName,
        }));
        setCandidates(mappedCandidates);

        // Fetch saved marks from Firestore
        const savedMarks = await getAssignmentMarks(asgn.id);
        const marksMap = new Map(savedMarks.map((m) => [m.studentId, m]));

        const initialInputs: Record<string, { marks: string; isPresent: boolean; remarks: string }> = {};
        mappedCandidates.forEach((c) => {
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

      // 2. Fallback to Legacy PracticalForm by token
      const legacy = await getPracticalFormByToken(token);
      if (legacy) {
        if (!legacy.isActive) {
          setError('This practical examination link is currently deactivated by the Administration.');
          return;
        }
        if (legacy.status === 'draft') {
          setError('This practical examination form is currently in Draft status.');
          return;
        }

        setLegacyForm(legacy);
        const [enrs, marks] = await Promise.all([
          getFormEnrollments(legacy.id),
          getFormMarks(legacy.id),
        ]);

        const mapped: EvaluatedStudentItem[] = enrs.map((e) => ({
          studentId: e.studentId,
          rollNumber: e.rollNumber,
          studentName: e.studentName,
          subject: legacy.subjectName,
          fatherName: e.fatherName,
        }));
        setCandidates(mapped);

        const marksMap = new Map(marks.map((m) => [m.studentId, m]));
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

      setError('Invalid or expired practical examination link. Please check your token URL.');
    } catch (err: any) {
      setError(err.message || 'Failed to load examination form');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = assignment?.isLocked || legacyForm?.status === 'closed';
  const maxMarks = assignment ? assignment.maxMarks : legacyForm?.maxMarks || 50;
  const minMarks = assignment ? assignment.minMarks : legacyForm?.minPassingMarks ?? Math.round(maxMarks * 0.33);
  const allowDecimals = assignment ? assignment.allowDecimals : legacyForm?.allowDecimals ?? true;
  const examTitle = assignment
    ? `${assignment.paperName} — ${assignment.subjectName} Practical Evaluation`
    : legacyForm?.title || 'Practical Examination';
  const examSubTitle = assignment
    ? `Academic Session: ${assignment.session} • ${assignment.semester} (${assignment.subjectType})`
    : `${legacyForm?.course} • ${legacyForm?.semester}`;

  // Handle Mark Change
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
      },
    }));

    // Trigger debounced auto-save or explicit save
    setSaveStatus('idle');
  };

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

  const handleRemarksChange = (studentId: string, remarks: string) => {
    if (isLocked) return;
    setInputMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { marks: '', isPresent: true }),
        remarks,
      },
    }));
    setSaveStatus('idle');
  };

  // Explicit / Auto-Save to Firestore
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

        await saveAssignmentMarks(assignment, records, examinerName || 'Examiner');
      } else if (legacyForm) {
        const records = candidates.map((c) => {
          const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
          return {
            studentId: c.studentId,
            rollNumber: c.rollNumber,
            studentName: c.studentName,
            marksObtained: inp.isPresent && inp.marks !== '' ? Number(inp.marks) : null,
            isPresent: inp.isPresent,
            remarks: inp.remarks,
            minPassingMarks: minMarks,
          };
        });

        await saveBulkMarks(legacyForm.id, records, examinerName || 'Examiner');
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

    // Check that every candidate has a score or is marked absent
    const pendingList = candidates.filter((c) => {
      const inp = inputMap[c.studentId];
      if (!inp) return true;
      if (inp.isPresent && (inp.marks === '' || inp.marks === null || inp.marks === undefined)) return true;
      return false;
    });

    if (pendingList.length > 0) {
      alert(
        `Final Submit Incomplete: There are ${pendingList.length} candidate(s) awaiting marks or attendance. All candidates must have evaluated marks or be marked Absent before final submission.`
      );
      return;
    }

    const ok = window.confirm(
      `Confirm Final Submission of Marks?\n\nAfter submission, the evaluation form will be permanently locked against changes. Only College Administration can authorize reopening.\n\nExaminer Name: ${examinerName}`
    );
    if (!ok) return;

    try {
      setSubmitting(true);

      // First save all current marks
      await handleSaveDraftToFirestore();

      if (assignment) {
        await finalSubmitExaminerAssignment(assignment.id, examinerName);
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

  // Export Marksheet for Examiner
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'SN.',
      'Roll Number',
      'Student Name',
      "Father's Name",
      'Practical Subject',
      'Attendance',
      `Max Marks (${maxMarks})`,
      `Min Pass Marks (${minMarks})`,
      'Marks Obtained',
      'Result Status',
      'Remarks',
    ];

    const rows = candidates.map((c, idx) => {
      const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
      const num = inp.marks !== '' ? Number(inp.marks) : null;
      const resStatus = calculateResultStatus(num, inp.isPresent, minMarks);

      return [
        idx + 1,
        c.rollNumber,
        c.studentName,
        c.fatherName || '-',
        c.subject,
        inp.isPresent ? 'PRESENT' : 'ABSENT',
        maxMarks,
        minMarks,
        inp.isPresent ? (num !== null ? num : 'PENDING') : 'ABSENT',
        resStatus,
        inp.remarks || '',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([
      [collegeName.toUpperCase()],
      [`PRACTICAL EXAMINATION EVALUATION MARKSHEET - ${examTitle}`],
      [`Academic Session: ${examSubTitle} | Evaluated by: ${examinerName}`],
      [],
      headers,
      ...rows,
    ]);

    XLSX.utils.book_append_sheet(wb, ws, 'Marksheet');
    XLSX.writeFile(wb, `Practical_Marksheet_${examTitle.slice(0, 20)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Practical Examination Link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Examination Link Inaccessible</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <span className="text-[11px] text-slate-400 block pt-2">
            Please verify the token URL with College Administration.
          </span>
        </div>
      </div>
    );
  }

  // Live Count Calculations
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

  const filteredCandidates = candidates.filter(
    (c) =>
      c.rollNumber.toLowerCase().includes(tableSearch.toLowerCase()) ||
      c.studentName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16">
      {/* Top Academic Header (STRICTLY NO ADMIN LOGIN BUTTON/LINK) */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
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
            {/* Auto-Save Cloud Status Indicator */}
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

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Sheet</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Examination Form Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-5">
        {/* Exam Metadata Card */}
        <div className="bg-white border-t-8 border-t-blue-600 border-x border-b border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {assignment ? `${assignment.subjectType} - ${assignment.paperName}` : legacyForm?.subjectCode}
            </span>
            <div>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 px-3 py-1 rounded-full bg-rose-50 border border-rose-200">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Final Submitted & Locked</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                  Open for Evaluation
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">{examTitle}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">{examSubTitle}</p>
          </div>

          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Maximum Marks:</span>
              <strong className="text-base text-blue-700 font-mono">{maxMarks}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Min Passing Marks:</span>
              <strong className="text-base text-amber-600 font-mono">{minMarks}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Marks Format:</span>
              <strong className="text-slate-700">
                {allowDecimals ? 'Decimals Allowed' : 'Integers Only'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total Candidates:</span>
              <strong className="text-slate-700 font-mono">{candidates.length} Assigned</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Completed / Absent:</span>
              <strong className="text-emerald-700 font-mono">
                {evaluatedCount} / {absentCount}
              </strong>
            </div>
          </div>

          {/* Examiner Details Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Evaluating Examiner:
              </span>
              <input
                type="text"
                disabled={isLocked}
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="Dr. M. P. Singh"
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Pending: <strong className="text-amber-600 font-mono">{pendingCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {submittedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Practical marks have been finalized, submitted, and locked in the college database!
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

        {/* Evaluation Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search by roll number or candidate name..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {!isLocked && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraftToFirestore}
                  disabled={saveStatus === 'saving'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting || pendingCount > 0}
                  className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Final Submit & Lock</span>
                </button>
              </div>
            )}
          </div>

          {/* Candidates Evaluation Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-28">Roll Number</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3 w-24 text-center">Attendance</th>
                  <th className="py-3 px-2 w-20 text-center">Max Marks</th>
                  <th className="py-3 px-2 w-20 text-center">Min Pass</th>
                  <th className="py-3 px-3 w-32 text-center">Obtained Marks</th>
                  <th className="py-3 px-3 w-24 text-center">Result Status</th>
                  <th className="py-3 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No candidates found matching search.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c, idx) => {
                    const inp = inputMap[c.studentId] || { marks: '', isPresent: true, remarks: '' };
                    const isPresent = inp.isPresent;
                    const numMarks = inp.marks !== '' ? Number(inp.marks) : null;
                    const resStatus = calculateResultStatus(numMarks, isPresent, minMarks);

                    return (
                      <tr
                        key={c.studentId}
                        className={!isPresent ? 'bg-rose-50/40' : 'hover:bg-slate-50/70'}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {c.rollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {c.studentName}
                          {c.fatherName && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Father: {c.fatherName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleAttendanceToggle(c.studentId)}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isPresent ? 'PRESENT' : 'ABSENT'}
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                          {maxMarks}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-semibold text-amber-700">
                          {minMarks}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isPresent ? (
                            <input
                              type="number"
                              step={allowDecimals ? '0.1' : '1'}
                              min={0}
                              max={maxMarks}
                              disabled={isLocked}
                              value={inp.marks}
                              onChange={(e) => handleMarkChange(c.studentId, e.target.value)}
                              placeholder="Empty"
                              className="w-24 py-1.5 px-2 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="font-mono text-rose-600 font-bold text-xs">
                              ABSENT
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {resStatus === 'PASS' ? (
                            <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PASS
                            </span>
                          ) : resStatus === 'FAIL' ? (
                            <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              FAIL
                            </span>
                          ) : resStatus === 'ABSENT' ? (
                            <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              ABSENT
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={inp.remarks}
                            onChange={(e) => handleRemarksChange(c.studentId, e.target.value)}
                            placeholder="Optional examiner remarks"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                          />
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
    </div>
  );
};
