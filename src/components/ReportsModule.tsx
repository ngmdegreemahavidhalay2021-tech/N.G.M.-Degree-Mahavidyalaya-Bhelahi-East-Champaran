import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Building2,
  BookOpen,
  Users,
  Search,
  Award,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Department,
  Subject,
  PracticalForm,
  Student,
  AcademicSession,
  AcademicPaper,
  PracticalSubject,
  ExaminerAssignment,
  AssignmentMarkRecord,
  PaperStudent,
  ALL_ACADEMIC_SESSIONS,
  ALL_SEMESTERS,
  SUBJECT_TYPES,
  SubjectType,
} from '../types';
import {
  getFormEnrollments,
  getFormMarks,
  getAcademicSessions,
  getPracticalSubjects,
  getAcademicPapers,
  getExaminerAssignments,
  getPaperStudents,
  getAssignmentMarks,
} from '../services/collegeService';
import { exportExaminerAssignmentMarksheetExcel } from '../lib/collegeExport';

interface ReportsModuleProps {
  departments: Department[];
  subjects: Subject[];
  forms: PracticalForm[];
  students: Student[];
  collegeName: string;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  departments,
  subjects,
  forms,
  students,
  collegeName,
}) => {
  const [reportType, setReportType] = useState<
    'cbcs' | 'department' | 'completion' | 'pending'
  >('cbcs');

  // CBCS Loaded Data
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [practicalSubjects, setPracticalSubjects] = useState<PracticalSubject[]>([]);
  const [papers, setPapers] = useState<AcademicPaper[]>([]);
  const [assignments, setAssignments] = useState<ExaminerAssignment[]>([]);
  const [paperStudents, setPaperStudents] = useState<PaperStudent[]>([]);
  const [assignmentMarksMap, setAssignmentMarksMap] = useState<Record<string, AssignmentMarkRecord[]>>({});

  // CBCS Filters
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedSubjectType, setSelectedSubjectType] = useState<string>('ALL');
  const [selectedPaperName, setSelectedPaperName] = useState<string>('ALL');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded assignment accordion cards
  const [expandedAssignments, setExpandedAssignments] = useState<Record<string, boolean>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Legacy Stats
  const [loading, setLoading] = useState(false);
  const [formStats, setFormStats] = useState<
    Array<{
      formId: string;
      title: string;
      subjectCode: string;
      deptId: string;
      enrolled: number;
      evaluated: number;
      absent: number;
      pending: number;
      rate: number;
    }>
  >([]);

  useEffect(() => {
    loadCBCSData();
    loadStats();
  }, [forms]);

  const loadCBCSData = async () => {
    try {
      setLoading(true);
      const [sList, pSubjs, pList, aList, stdList] = await Promise.all([
        getAcademicSessions().catch(() => []),
        getPracticalSubjects().catch(() => []),
        getAcademicPapers().catch(() => []),
        getExaminerAssignments().catch(() => []),
        getPaperStudents().catch(() => []),
      ]);

      setSessions(sList);
      setPracticalSubjects(pSubjs);
      setPapers(pList);
      setAssignments(aList);
      setPaperStudents(stdList);

      // Pre-load marks for all assignments
      const marksMap: Record<string, AssignmentMarkRecord[]> = {};
      await Promise.all(
        aList.map(async (asgn) => {
          const mList = await getAssignmentMarks(asgn.id).catch(() => []);
          marksMap[asgn.id] = mList;
        })
      );
      setAssignmentMarksMap(marksMap);
    } catch (err) {
      console.warn('Error loading CBCS report records:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const list = await Promise.all(
        forms.map(async (f) => {
          const [enr, mrk] = await Promise.all([
            getFormEnrollments(f.id).catch(() => []),
            getFormMarks(f.id).catch(() => []),
          ]);
          const enrolled = enr.length;
          let evaluated = 0;
          let absent = 0;
          mrk.forEach((m) => {
            if (!m.isPresent) absent++;
            else if (m.marksObtained !== null && m.marksObtained !== undefined) evaluated++;
          });
          const pending = Math.max(0, enrolled - (evaluated + absent));
          const rate = enrolled > 0 ? ((evaluated + absent) / enrolled) * 100 : 0;
          return {
            formId: f.id,
            title: f.title,
            subjectCode: f.subjectCode,
            deptId: f.departmentId,
            enrolled,
            evaluated,
            absent,
            pending,
            rate,
          };
        })
      );
      setFormStats(list);
    } catch (err) {
      console.error('Error loading legacy report stats:', err);
    }
  };

  // Filter CBCS assignments
  const filteredAssignments = assignments.filter((asgn) => {
    if (selectedSession !== 'ALL' && asgn.session !== selectedSession) return false;
    if (selectedSemester !== 'ALL' && asgn.semester !== selectedSemester) return false;
    if (selectedSubjectType !== 'ALL' && asgn.subjectType !== selectedSubjectType) return false;
    if (selectedPaperName !== 'ALL' && asgn.paperName !== selectedPaperName) return false;
    if (selectedSubjectName !== 'ALL' && asgn.subjectName !== selectedSubjectName) return false;
    if (selectedStatus !== 'ALL' && asgn.status !== selectedStatus) return false;
    return true;
  });

  // Unique distinct values for dropdowns
  const sessionOptions = Array.from(
    new Set([...ALL_ACADEMIC_SESSIONS, ...sessions.map((s) => s.sessionName)])
  );
  const paperNames = Array.from(new Set(papers.map((p) => p.paperName)));
  const practicalSubjectNames = Array.from(
    new Set(practicalSubjects.map((s) => s.name))
  );

  // Compute aggregate numbers for filtered CBCS assignments
  const totalEnrolledCandidates = filteredAssignments.reduce((acc, a) => acc + (a.totalStudents || 0), 0);
  const totalEvaluatedCandidates = filteredAssignments.reduce((acc, a) => acc + (a.evaluatedCount || 0), 0);
  const totalAbsentCandidates = filteredAssignments.reduce((acc, a) => acc + (a.absentCount || 0), 0);
  const totalPendingCandidates = filteredAssignments.reduce((acc, a) => acc + (a.pendingCount || 0), 0);
  const overallRate = totalEnrolledCandidates > 0
    ? (((totalEvaluatedCandidates + totalAbsentCandidates) / totalEnrolledCandidates) * 100).toFixed(1)
    : '0.0';

  const toggleAccordion = (id: string) => {
    setExpandedAssignments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyTokenUrl = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handlePrintMarksheet = (assignment: ExaminerAssignment, stdList: PaperStudent[], marksList: AssignmentMarkRecord[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print marksheets.');
      return;
    }

    const marksMap = new Map(marksList.map((m) => [m.studentId, m]));
    let presentCount = 0;
    let absentCount = 0;
    let passCount = 0;
    let failCount = 0;

    const rowsHtml = stdList.map((std, idx) => {
      const mark = marksMap.get(std.id);
      const isPresent = mark ? mark.isPresent : true;
      const score = mark ? (isPresent ? (mark.marksObtained ?? '-') : 'ABSENT') : '-';
      const status = mark ? (isPresent ? 'PRESENT' : 'ABSENT') : 'PENDING';
      let result = 'PENDING';

      if (mark) {
        if (!isPresent) {
          result = 'ABSENT';
          absentCount++;
        } else if (mark.marksObtained !== null && mark.marksObtained !== undefined) {
          presentCount++;
          if (Number(mark.marksObtained) >= assignment.minMarks) {
            result = 'PASS';
            passCount++;
          } else {
            result = 'FAIL';
            failCount++;
          }
        }
      }

      return `
        <tr>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">${std.rollNumber}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${std.studentName}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${std.fatherName || '-'}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${std.subject}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${status}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${score}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${result}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${mark?.remarks || ''}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${collegeName} - Practical Marksheet - ${assignment.paperName} (${assignment.subjectName})</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; margin: 0; }
            h1 { text-align: center; font-size: 20px; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { text-align: center; font-size: 14px; margin: 4px 0 16px 0; color: #475569; }
            .meta-box { border: 1px solid #94a3b8; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px; display: grid; grid-template-columns: repeat(3, 1fr); font-size: 12px; gap: 6px; }
            .meta-item { display: flex; gap: 4px; }
            .meta-label { font-weight: bold; color: #334155; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
            th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; text-align: center; text-transform: uppercase; font-size: 10px; }
            .summary-box { display: flex; justify-content: space-between; border-top: 2px solid #0f172a; padding-top: 12px; margin-top: 16px; font-size: 12px; font-weight: bold; }
            .signature-area { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; }
            .signature-line { border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 6px; font-weight: bold; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 8px;">
            <button onclick="window.print()" style="padding: 6px 14px; font-weight: bold; cursor: pointer; background: #0284c7; color: white; border: none; border-radius: 4px;">Print Document</button>
          </div>
          <h1>${collegeName}</h1>
          <h2>PRACTICAL EXAMINATION OFFICIAL MARKSHEET</h2>

          <div class="meta-box">
            <div class="meta-item"><span class="meta-label">Academic Session:</span> <span>${assignment.session}</span></div>
            <div class="meta-item"><span class="meta-label">Semester:</span> <span>${assignment.semester}</span></div>
            <div class="meta-item"><span class="meta-label">Subject Type:</span> <span>${assignment.subjectType}</span></div>
            <div class="meta-item"><span class="meta-label">Paper Name:</span> <span>${assignment.paperName}</span></div>
            <div class="meta-item"><span class="meta-label">Practical Subject:</span> <span>${assignment.subjectName}</span></div>
            <div class="meta-item"><span class="meta-label">Max Marks / Pass:</span> <span>${assignment.maxMarks} / ${assignment.minMarks}</span></div>
            <div class="meta-item"><span class="meta-label">Internal Incharge:</span> <span>${assignment.inchargeName || 'Not Assigned'}</span></div>
            <div class="meta-item"><span class="meta-label">External Examiner:</span> <span>${assignment.examinerName || 'Not Assigned'}</span></div>
            <div class="meta-item"><span class="meta-label">Form Status:</span> <span>${assignment.status}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 36px;">#</th>
                <th style="width: 120px;">Roll Number</th>
                <th>Candidate Name</th>
                <th>Father's Name</th>
                <th style="width: 100px;">Subject</th>
                <th style="width: 80px;">Attendance</th>
                <th style="width: 80px;">Marks</th>
                <th style="width: 70px;">Result</th>
                <th style="width: 120px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <span>Total Enrolled: ${stdList.length}</span>
            <span>Evaluated (Present): ${presentCount}</span>
            <span>Absent: ${absentCount}</span>
            <span>Passed: ${passCount}</span>
            <span>Failed: ${failCount}</span>
          </div>

          <div class="signature-area">
            <div class="signature-line">
              Internal Incharge Signature<br>
              <small style="font-weight: normal; color: #64748b;">(${assignment.inchargeName || 'Name'})</small>
            </div>
            <div class="signature-line">
              External Examiner Signature<br>
              <small style="font-weight: normal; color: #64748b;">(${assignment.examinerName || 'Name'})</small>
            </div>
            <div class="signature-line">
              Principal / Exam Controller<br>
              <small style="font-weight: normal; color: #64748b;">(${collegeName})</small>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export current report table to Excel
  const handleExportCurrentReport = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'department') {
      const rows = [
        [collegeName.toUpperCase()],
        ['DEPARTMENT-WISE PRACTICAL EVALUATION REPORT'],
        [],
        ['Department Name', 'Code', 'Total Subjects', 'Active Forms', 'Total Enrolled', 'Evaluated', 'Pending', 'Completion Rate'],
      ];
      departments.forEach((d) => {
        const dSubjs = subjects.filter((s) => s.departmentId === d.id);
        const dStats = formStats.filter((f) => f.deptId === d.id);
        const enr = dStats.reduce((acc, c) => acc + c.enrolled, 0);
        const evald = dStats.reduce((acc, c) => acc + c.evaluated, 0);
        const pend = dStats.reduce((acc, c) => acc + c.pending, 0);
        const rate = enr > 0 ? ((evald / enr) * 100).toFixed(1) + '%' : '0%';
        rows.push([d.name, d.code, dSubjs.length as any, dStats.length as any, enr as any, evald as any, pend as any, rate as any]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Dept_Report');
      XLSX.writeFile(wb, `Department_Practical_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else if (reportType === 'completion' || reportType === 'pending') {
      const rows = [
        [collegeName.toUpperCase()],
        ['SUBJECT AND EXAMINATION COMPLETION REPORT'],
        [],
        ['Subject Code', 'Examination Title', 'Total Enrolled', 'Evaluated', 'Absent', 'Pending Entries', 'Completion Rate'],
      ];
      formStats.forEach((f) => {
        rows.push([
          f.subjectCode,
          f.title,
          f.enrolled as any,
          f.evaluated as any,
          f.absent as any,
          f.pending as any,
          f.rate.toFixed(1) + '%',
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Completion_Report');
      XLSX.writeFile(wb, `Examination_Completion_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      // Master CBCS Marks Export
      const masterRows = [
        [collegeName.toUpperCase()],
        ['ACADEMIC SESSION, SEMESTER & PAPER PRACTICAL MARKS STATEMENT'],
        [],
        [
          'SN.',
          'Roll Number',
          'Student Name',
          "Father's Name",
          'Session',
          'Semester',
          'Subject Type',
          'Paper Name',
          'Practical Subject',
          'Internal Incharge',
          'External Examiner',
          'Max Marks',
          'Min Pass',
          'Obtained Marks',
          'Attendance',
          'Result Status',
          'Remarks',
        ],
      ];

      let count = 1;
      filteredAssignments.forEach((asgn) => {
        const stdList = paperStudents.filter(
          (s) =>
            s.paperId === asgn.paperId &&
            s.subject.toUpperCase() === asgn.subjectName.toUpperCase()
        );
        const marksList = assignmentMarksMap[asgn.id] || [];
        const marksMap = new Map(marksList.map((m) => [m.studentId, m]));

        stdList.forEach((std) => {
          const mark = marksMap.get(std.id);
          const isPresent = mark ? mark.isPresent : true;
          const score = mark ? (isPresent ? (mark.marksObtained ?? '') : 'ABSENT') : '';
          const status = mark ? (isPresent ? 'PRESENT' : 'ABSENT') : 'PENDING';
          const result = mark ? mark.resultStatus : 'PENDING';

          masterRows.push([
            count++ as any,
            std.rollNumber,
            std.studentName,
            std.fatherName || '-',
            asgn.session,
            asgn.semester,
            asgn.subjectType,
            asgn.paperName,
            asgn.subjectName,
            asgn.inchargeName || 'Not Assigned',
            asgn.examinerName || 'Not Assigned',
            asgn.maxMarks as any,
            asgn.minMarks as any,
            score as any,
            status,
            result,
            mark?.remarks || '',
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(masterRows);
      XLSX.utils.book_append_sheet(wb, ws, 'CBCS_Marksheet');
      XLSX.writeFile(wb, `CBCS_Practical_Marks_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">Reports & Analytics Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Session & Paper-wise marks statements, official printable marksheets, completion audits, and pending marks diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCurrentReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Master Report (.xlsx)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-xl bg-slate-800 border border-slate-700"
            title="Print Current View"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Switch Tabs */}
      <div className="flex flex-wrap bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit gap-1">
        <button
          onClick={() => setReportType('cbcs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'cbcs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Semester Paper Marksheets</span>
        </button>
        <button
          onClick={() => setReportType('department')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'department'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Department-wise Summary</span>
        </button>
        <button
          onClick={() => setReportType('completion')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'completion'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Form Completion Rates</span>
        </button>
        <button
          onClick={() => setReportType('pending')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'pending'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Marks Diagnostics</span>
        </button>
      </div>

      {/* ==================== CBCS PAPER MARKSHEETS TAB ==================== */}
      {reportType === 'cbcs' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Session Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Academic Session
                </label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-medium"
                >
                  <option value="ALL">All Sessions</option>
                  {sessionOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Semester Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="ALL">All Semesters</option>
                  {ALL_SEMESTERS.map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>

              {/* Subject Type Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Subject Type
                </label>
                <select
                  value={selectedSubjectType}
                  onChange={(e) => setSelectedSubjectType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-bold"
                >
                  <option value="ALL">All Types</option>
                  {SUBJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Paper Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Paper Name
                </label>
                <select
                  value={selectedPaperName}
                  onChange={(e) => setSelectedPaperName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="ALL">All Papers</option>
                  {paperNames.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Practical Subject Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Practical Subject
                </label>
                <select
                  value={selectedSubjectName}
                  onChange={(e) => setSelectedSubjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-medium"
                >
                  <option value="ALL">All Subjects</option>
                  {practicalSubjectNames.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Evaluation Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Final Submitted">Final Submitted</option>
                  <option value="Ready to Submit">Ready to Submit</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Draft Saved">Draft Saved</option>
                  <option value="Not Started">Not Started</option>
                </select>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates by student name or roll number across filtered assignments..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtered Forms</span>
              <p className="text-xl font-bold text-slate-100 mt-0.5">{filteredAssignments.length}</p>
            </div>
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Enrolled</span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">{totalEnrolledCandidates}</p>
            </div>
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Marks Entered</span>
              <p className="text-xl font-bold text-emerald-300 mt-0.5">{totalEvaluatedCandidates}</p>
            </div>
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Absent Candidates</span>
              <p className="text-xl font-bold text-rose-300 mt-0.5">{totalAbsentCandidates}</p>
            </div>
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pending Entries</span>
              <p className="text-xl font-bold text-amber-300 mt-0.5">{totalPendingCandidates}</p>
            </div>
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Completion Rate</span>
              <p className="text-xl font-bold text-cyan-300 mt-0.5">{overallRate}%</p>
            </div>
          </div>

          {/* Assignments List / Accordion */}
          {filteredAssignments.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-200">No Practical Examination Assignments Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No assignments match the selected session, semester, subject type, or subject filters. Add papers and upload students in Student Management to configure practical marks.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((asgn) => {
                const isExpanded = !!expandedAssignments[asgn.id];
                const allAssignedStudents = paperStudents.filter(
                  (s) =>
                    s.paperId === asgn.paperId &&
                    s.subject.toUpperCase() === asgn.subjectName.toUpperCase()
                );

                // Filter students by search query
                const displayedStudents = allAssignedStudents.filter((s) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return s.studentName.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q);
                });

                const marksList = assignmentMarksMap[asgn.id] || [];
                const marksMap = new Map(marksList.map((m) => [m.studentId, m]));

                const statusBg =
                  asgn.status === 'Final Submitted'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : asgn.status === 'Ready to Submit'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : asgn.status === 'In Progress'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : asgn.status === 'Draft Saved'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700';

                return (
                  <div
                    key={asgn.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all"
                  >
                    {/* Card Summary Header */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30">
                            {asgn.session}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {asgn.semester}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {asgn.subjectType}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {asgn.paperName}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusBg}`}>
                            {asgn.status}
                          </span>
                          {asgn.isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <Lock className="w-3 h-3" />
                              <span>Locked</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-100 truncate">
                            {asgn.subjectName}
                          </h3>
                          <span className="text-xs text-slate-400">
                            (Max: {asgn.maxMarks} | Pass: {asgn.minMarks})
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-0.5">
                          <span>
                            Internal Incharge:{' '}
                            <strong className="text-slate-200">{asgn.inchargeName || 'Not Assigned'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            External Examiner:{' '}
                            <strong className="text-slate-200">{asgn.examinerName || 'Not Assigned'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyTokenUrl(asgn.token)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                          title="Copy public teacher URL (no Admin login)"
                        >
                          {copiedToken === asgn.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => exportExaminerAssignmentMarksheetExcel(asgn, allAssignedStudents, marksList, collegeName)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                          title="Export Excel Marksheet"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Export Excel</span>
                        </button>

                        <button
                          onClick={() => handlePrintMarksheet(asgn, allAssignedStudents, marksList)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          title="Print official college marksheet with signatures"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-400" />
                          <span>Print</span>
                        </button>

                        <button
                          onClick={() => toggleAccordion(asgn.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Marks' : 'View Marks'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-slate-950 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <span>Total: <strong className="text-slate-200">{allAssignedStudents.length}</strong></span>
                        <span>•</span>
                        <span>Evaluated: <strong className="text-emerald-400">{asgn.evaluatedCount || 0}</strong></span>
                        <span>•</span>
                        <span>Absent: <strong className="text-rose-400">{asgn.absentCount || 0}</strong></span>
                        <span>•</span>
                        <span>Pending: <strong className="text-amber-400">{asgn.pendingCount || 0}</strong></span>
                      </div>
                      <div className="font-mono font-bold text-slate-300">
                        {allAssignedStudents.length > 0
                          ? ((((asgn.evaluatedCount || 0) + (asgn.absentCount || 0)) / allAssignedStudents.length) * 100).toFixed(0)
                          : 0}% Completed
                      </div>
                    </div>

                    {/* Accordion Body: Candidate Marks Table */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-950/60 overflow-x-auto">
                        {displayedStudents.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">
                            No students match the search filter for this practical subject.
                          </p>
                        ) : (
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3">#</th>
                                <th className="py-2.5 px-3">Roll Number</th>
                                <th className="py-2.5 px-3">Candidate Name</th>
                                <th className="py-2.5 px-3">Father's Name</th>
                                <th className="py-2.5 px-3 text-center">Attendance</th>
                                <th className="py-2.5 px-3 text-center">Max Marks</th>
                                <th className="py-2.5 px-3 text-center">Min Pass</th>
                                <th className="py-2.5 px-3 text-center">Obtained Marks</th>
                                <th className="py-2.5 px-3 text-center">Result Status</th>
                                <th className="py-2.5 px-3">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-sans">
                              {displayedStudents.map((std, idx) => {
                                const mark = marksMap.get(std.id);
                                const isPresent = mark ? mark.isPresent : true;
                                const score = mark
                                  ? isPresent
                                    ? mark.marksObtained !== null && mark.marksObtained !== undefined
                                      ? mark.marksObtained
                                      : '-'
                                    : 'ABSENT'
                                  : '-';
                                const status = mark ? (isPresent ? 'PRESENT' : 'ABSENT') : 'PENDING';
                                const result = mark ? mark.resultStatus : 'PENDING';

                                const resultClass =
                                  result === 'PASS'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : result === 'FAIL'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : result === 'ABSENT'
                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';

                                return (
                                  <tr key={std.id} className="hover:bg-slate-800/40">
                                    <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                                      {std.rollNumber}
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-slate-200">
                                      {std.studentName}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-400">
                                      {std.fatherName || '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          status === 'PRESENT'
                                            ? 'text-emerald-400 bg-emerald-500/10'
                                            : status === 'ABSENT'
                                            ? 'text-rose-400 bg-rose-500/10'
                                            : 'text-slate-400 bg-slate-800'
                                        }`}
                                      >
                                        {status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                      {asgn.maxMarks}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                      {asgn.minMarks}
                                    </td>
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-100">
                                      {score}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resultClass}`}>
                                        {result}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">
                                      {mark?.remarks || '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== LEGACY DEPARTMENT-WISE TAB ==================== */}
      {reportType === 'department' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Code</th>
                  <th className="py-3 px-4 text-center">Total Subjects</th>
                  <th className="py-3 px-4 text-center">Active Forms</th>
                  <th className="py-3 px-4 text-center">Enrolled Candidates</th>
                  <th className="py-3 px-4 text-center">Marks Entered</th>
                  <th className="py-3 px-4 text-center">Pending Entries</th>
                  <th className="py-3 px-4 text-center">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {departments.map((dept) => {
                  const dSubjs = subjects.filter((s) => s.departmentId === dept.id);
                  const dStats = formStats.filter((f) => f.deptId === dept.id);
                  const enr = dStats.reduce((acc, c) => acc + c.enrolled, 0);
                  const evald = dStats.reduce((acc, c) => acc + c.evaluated, 0);
                  const pend = dStats.reduce((acc, c) => acc + c.pending, 0);
                  const rate = enr > 0 ? (evald / enr) * 100 : 0;

                  return (
                    <tr key={dept.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-200">{dept.name}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">{dept.code}</td>
                      <td className="py-3 px-4 text-center font-mono">{dSubjs.length}</td>
                      <td className="py-3 px-4 text-center font-mono">{dStats.length}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{enr}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400">{evald}</td>
                      <td className="py-3 px-4 text-center font-mono text-amber-400">{pend}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className={rate >= 80 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-slate-400'}>
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FORM COMPLETION / PENDING TABS ==================== */}
      {(reportType === 'completion' || reportType === 'pending') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Subject Code</th>
                  <th className="py-3 px-4">Examination Title</th>
                  <th className="py-3 px-4 text-center">Enrolled</th>
                  <th className="py-3 px-4 text-center">Marks Entered</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Pending Entries</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {formStats
                  .filter((f) => (reportType === 'pending' ? f.pending > 0 : true))
                  .map((f) => (
                    <tr key={f.formId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{f.subjectCode}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{f.title}</td>
                      <td className="py-3 px-4 text-center font-mono">{f.enrolled}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400">{f.evaluated}</td>
                      <td className="py-3 px-4 text-center font-mono text-rose-400">{f.absent}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">{f.pending}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            f.pending === 0 && f.enrolled > 0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {f.pending === 0 && f.enrolled > 0 ? 'COMPLETED' : 'IN PROGRESS'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
