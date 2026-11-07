import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  PracticalForm,
  FormEnrollment,
  MarksRecord,
  Department,
  Subject,
  ExaminerAssignment,
  AssignmentMarkRecord,
  PaperStudent,
} from '../types';

export interface ExportFilterOptions {
  departmentId?: string;
  subjectId?: string;
  practicalFormId?: string;
  course?: string;
  semester?: string;
  examYear?: string;
  session?: string;
  inchargeName?: string;
  practicalSubject?: string;
  subjectType?: string;
  paperName?: string;
  marksStatus?: 'ALL' | 'ENTERED' | 'PENDING';
  searchQuery?: string;
}

export interface UnifiedExportRecord {
  sn?: number;
  session: string;
  semester: string;
  departmentName: string;
  parentGroupName?: string;
  inchargeName: string;
  practicalSubject: string;
  subjectType: string;
  paper: string;
  rollNumber: string;
  studentName: string;
  fatherName: string;
  maxMarks: number;
  minPassingMarks: number;
  marksObtained: number | string;
  marksStatus: 'PRESENT' | 'ABSENT' | 'PENDING';
  resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';
  remarks: string;
  exportDate: string;
  // Backward compatibility fields
  course?: string;
  section?: string;
  subjectCode?: string;
  subjectName?: string;
  examinationName?: string;
  examinationYear?: string;
  examDate?: string;
  status?: 'PRESENT' | 'ABSENT' | 'PENDING';
}

export function generateExportRecords(
  forms: PracticalForm[],
  departments: Department[],
  subjects: Subject[],
  enrollmentsMap: Record<string, FormEnrollment[]>,
  marksMap: Record<string, MarksRecord[]>,
  options: ExportFilterOptions = {}
): UnifiedExportRecord[] {
  const records: UnifiedExportRecord[] = [];
  const exportDate = new Date().toISOString().slice(0, 10);

  const deptLookup = new Map(departments.map((d) => [d.id, d]));
  const subjLookup = new Map(subjects.map((s) => [s.id, s]));

  forms.forEach((form) => {
    // Apply form level filters
    if (options.departmentId && options.departmentId !== 'ALL' && form.departmentId !== options.departmentId) return;
    if (options.practicalFormId && options.practicalFormId !== 'ALL' && form.id !== options.practicalFormId) return;
    if (options.course && options.course !== 'ALL' && form.course !== options.course) return;
    if (options.semester && options.semester !== 'ALL' && form.semester !== options.semester) return;
    if (options.examYear && options.examYear !== 'ALL' && form.examYear !== options.examYear) return;
    if (options.session && options.session !== 'ALL' && (form.session || form.examYear) !== options.session) return;
    if (options.subjectType && options.subjectType !== 'ALL' && (form.subjectType || 'MJC') !== options.subjectType) return;
    if (options.paperName && options.paperName !== 'ALL' && (form.paperName || '') !== options.paperName) return;
    if (options.inchargeName && options.inchargeName !== 'ALL' && (form.inchargeName || '') !== options.inchargeName) return;

    const enrollments = enrollmentsMap[form.id] || [];
    const marks = marksMap[form.id] || [];

    // Index marks by studentId and composite key studentId_SUBJECT
    const marksByStudentId = new Map(marks.map((m) => [m.studentId, m]));
    const marksByStudentAndSubj = new Map(
      marks.map((m) => [`${m.studentId}_${(m.subject || '').trim().toUpperCase()}`, m])
    );

    const deptObj = deptLookup.get(form.departmentId);
    const minPass = form.minPassingMarks ?? Math.round(form.maxMarks * 0.33);

    enrollments.forEach((enr) => {
      // Determine candidate's real assigned subject
      const rawSubj = (enr.subject || form.subjectName || 'GENERAL').trim().toUpperCase();
      const markRec = marksByStudentAndSubj.get(`${enr.studentId}_${rawSubj}`) || marksByStudentId.get(enr.studentId);
      const candidateSubject = (enr.subject || markRec?.subject || form.subjectName || 'GENERAL').trim().toUpperCase();

      // Filter by practicalSubject
      if (options.practicalSubject && options.practicalSubject !== 'ALL') {
        if (candidateSubject !== options.practicalSubject.trim().toUpperCase()) return;
      }

      // Filter by subjectId if specified
      if (options.subjectId && options.subjectId !== 'ALL') {
        const targetSubj = subjLookup.get(options.subjectId);
        const matchesSubjName = targetSubj && targetSubj.name.trim().toUpperCase() === candidateSubject;
        const matchesFormSubj = form.subjectId === options.subjectId;
        const matchesSubjAssignment = form.subjectAssignments?.some(
          (a) => a.subjectId === options.subjectId && a.subjectName.trim().toUpperCase() === candidateSubject
        );
        if (!matchesSubjName && !matchesFormSubj && !matchesSubjAssignment) return;
      }

      const isPresent = markRec?.isPresent ?? false;
      const hasMarks = markRec && markRec.marksObtained !== null && markRec.marksObtained !== undefined;

      let status: 'PRESENT' | 'ABSENT' | 'PENDING' = 'PENDING';
      let score: number | string = '-';
      let resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING' = 'PENDING';

      if (markRec) {
        if (!markRec.isPresent) {
          status = 'ABSENT';
          score = 'ABSENT';
          resultStatus = 'ABSENT';
        } else if (hasMarks) {
          status = 'PRESENT';
          score = markRec.marksObtained!;
          resultStatus = Number(markRec.marksObtained) >= minPass ? 'PASS' : 'FAIL';
        }
      }

      // Filter by marks status
      if (options.marksStatus === 'ENTERED' && status === 'PENDING') return;
      if (options.marksStatus === 'PENDING' && status !== 'PENDING') return;

      // Filter by search query
      if (options.searchQuery) {
        const q = options.searchQuery.toLowerCase();
        const matchesRoll = String(enr.rollNumber || '').toLowerCase().includes(q);
        const matchesName = String(enr.studentName || '').toLowerCase().includes(q);
        if (!matchesRoll && !matchesName) return;
      }

      const rowSession = form.session || form.examYear || '2025-29';
      const rowSemester = form.semester || 'Semester 2';
      const rowDept = deptObj?.name || form.departmentName || form.departmentId;
      const rowIncharge = form.inchargeName || 'Subject Incharge';
      const rowSubjType = form.subjectType || 'MJC';
      const rowPaper = form.paperName || form.examName || 'MJ5';
      const rowSubjCode =
        form.subjectAssignments?.find((a) => a.subjectName.trim().toUpperCase() === candidateSubject)?.subjectCode ||
        form.subjectCode ||
        candidateSubject.slice(0, 4);

      records.push({
        session: rowSession,
        semester: rowSemester,
        departmentName: rowDept,
        parentGroupName: deptObj?.isGroup ? deptObj.name : undefined,
        inchargeName: rowIncharge,
        practicalSubject: candidateSubject,
        subjectType: rowSubjType,
        paper: rowPaper,
        rollNumber: String(enr.rollNumber || ''),
        studentName: String(enr.studentName || ''),
        fatherName: String(enr.fatherName || '-'),
        maxMarks: form.maxMarks,
        minPassingMarks: minPass,
        marksObtained: score,
        marksStatus: status,
        resultStatus,
        remarks: markRec?.remarks || '',
        exportDate,
        // compatibility fields
        course: form.course || 'B.A./B.Sc.',
        section: enr.section || form.section || 'All',
        subjectCode: rowSubjCode,
        subjectName: candidateSubject,
        examinationName: form.examName,
        examinationYear: rowSession,
        examDate: form.examDate,
        status,
      });
    });
  });

  return records;
}

export function exportMasterCollegeWorkbook(
  records: UnifiedExportRecord[],
  institutionName = 'NGM Degree Mahavidyalaya',
  filenamePrefix = 'College_Practical_Examination_Data'
) {
  const wb = XLSX.utils.book_new();

  // 1. Master Records Sheet — EXACT 15 COLUMNS
  const masterHeaders = [
    'SN.',
    'Session',
    'Semester',
    'Department',
    'Incharge Name',
    'Practical Subject',
    'Subject Type',
    'Paper',
    'Roll Number',
    'Student Name',
    "Father's Name",
    'Maximum Marks',
    'Minimum Marks',
    'Obtained Marks',
    'Marks Status',
  ];

  const masterRows = records.map((r, idx) => [
    idx + 1,
    r.session,
    r.semester,
    r.departmentName,
    r.inchargeName,
    r.practicalSubject,
    r.subjectType,
    r.paper,
    r.rollNumber,
    r.studentName,
    r.fatherName,
    r.maxMarks,
    r.minPassingMarks,
    r.marksObtained,
    r.marksStatus,
  ]);

  const wsMaster = XLSX.utils.aoa_to_sheet([
    [institutionName.toUpperCase()],
    ['COMPREHENSIVE COLLEGE PRACTICAL EXAMINATION MARKS STATEMENT'],
    [],
    masterHeaders,
    ...masterRows,
  ]);

  wsMaster['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 26 },
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, wsMaster, 'All Practical Records');

  // 2. Individual Subject Sheets (if multiple distinct subjects exist)
  const distinctSubjects = Array.from(new Set(records.map((r) => r.practicalSubject)));
  if (distinctSubjects.length > 1) {
    distinctSubjects.forEach((subj) => {
      const subjRecords = records.filter((r) => r.practicalSubject === subj);
      const rows = subjRecords.map((r, idx) => [
        idx + 1,
        r.session,
        r.semester,
        r.departmentName,
        r.inchargeName,
        r.practicalSubject,
        r.subjectType,
        r.paper,
        r.rollNumber,
        r.studentName,
        r.fatherName,
        r.maxMarks,
        r.minPassingMarks,
        r.marksObtained,
        r.marksStatus,
      ]);

      const wsSubj = XLSX.utils.aoa_to_sheet([
        [institutionName.toUpperCase()],
        [`PRACTICAL EXAMINATION STATEMENT - ${subj}`],
        [],
        masterHeaders,
        ...rows,
      ]);

      wsSubj['!cols'] = wsMaster['!cols'];
      const safeSheetName = subj.slice(0, 31).replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.utils.book_append_sheet(wb, wsSubj, safeSheetName);
    });
  }

  // 3. Summary Statistics Sheet
  const subjectStats: Record<string, { total: number; present: number; absent: number; pending: number }> = {};
  records.forEach((r) => {
    const key = r.practicalSubject;
    if (!subjectStats[key]) {
      subjectStats[key] = { total: 0, present: 0, absent: 0, pending: 0 };
    }
    subjectStats[key].total++;
    if (r.marksStatus === 'PRESENT') subjectStats[key].present++;
    else if (r.marksStatus === 'ABSENT') subjectStats[key].absent++;
    else subjectStats[key].pending++;
  });

  const summaryRows = [
    [institutionName.toUpperCase()],
    ['PRACTICAL EXAMINATION SUBJECT-WISE SUMMARY STATISTICS'],
    [],
    ['Practical Subject', 'Total Enrolled', 'Evaluated (Present)', 'Absent Candidates', 'Pending Marks', 'Completion Rate'],
  ];

  Object.entries(subjectStats).forEach(([subj, s]) => {
    const rate = s.total > 0 ? (((s.present + s.absent) / s.total) * 100).toFixed(1) + '%' : '0%';
    summaryRows.push([subj, s.total as any, s.present as any, s.absent as any, s.pending as any, rate as any]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Statistics');

  const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportZipDepartmentSheets(
  records: UnifiedExportRecord[],
  institutionName = 'NGM Degree Mahavidyalaya'
) {
  const zip = new JSZip();

  // Group by department
  const byDept: Record<string, UnifiedExportRecord[]> = {};
  records.forEach((r) => {
    const key = r.departmentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!byDept[key]) byDept[key] = [];
    byDept[key].push(r);
  });

  const headers = [
    'Roll Number',
    'Student Name',
    'Course',
    'Semester',
    'Subject Code',
    'Subject Name',
    'Exam Date',
    'Max Marks',
    'Marks Obtained',
    'Status',
    'Remarks',
  ];

  for (const [deptKey, deptRecords] of Object.entries(byDept)) {
    const wb = XLSX.utils.book_new();
    const rows = deptRecords.map((r) => [
      r.rollNumber,
      r.studentName,
      r.course,
      r.semester,
      r.subjectCode,
      r.subjectName,
      r.examDate,
      r.maxMarks,
      r.marksObtained,
      r.status,
      r.remarks,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      [institutionName.toUpperCase()],
      [`DEPARTMENT PRACTICAL MARKS - ${deptRecords[0].departmentName}`],
      [],
      headers,
      ...rows,
    ]);

    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file(`${deptKey}_Practical_Marks.xlsx`, out);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `College_Departments_Marks_Archive_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSingleFormExcel(
  form: PracticalForm,
  enrollments: FormEnrollment[],
  marks: MarksRecord[],
  institutionName = 'NGM Degree Mahavidyalaya',
  targetSubject?: string
) {
  const normTarget = targetSubject ? targetSubject.trim().toUpperCase() : null;
  const filteredEnrollments = normTarget
    ? enrollments.filter(
        (e) => (e.subject || form.subjectName || '').trim().toUpperCase() === normTarget
      )
    : enrollments;

  const marksMap = new Map(marks.map((m) => [m.studentId, m]));
  const marksByStudentAndSubj = new Map(
    marks.map((m) => [`${m.studentId}_${(m.subject || '').trim().toUpperCase()}`, m])
  );
  const minPass = form.minPassingMarks ?? Math.round(form.maxMarks * 0.33);

  const headers = [
    'S.No.',
    'Roll Number',
    'Student Name',
    "Father's Name",
    'Practical Subject',
    'Course',
    'Semester',
    'Section',
    'Attendance',
    `Maximum Marks (${form.maxMarks})`,
    `Min Passing Marks (${minPass})`,
    'Marks Obtained',
    'Result Status',
    'Remarks',
  ];

  const rows = filteredEnrollments.map((enr, idx) => {
    const rawSubj = (enr.subject || form.subjectName || '').trim().toUpperCase();
    const markRec = marksByStudentAndSubj.get(`${enr.studentId}_${rawSubj}`) || marksMap.get(enr.studentId);
    const candidateSubject = enr.subject || markRec?.subject || form.subjectName || 'GENERAL';

    const isPresent = markRec?.isPresent ?? false;
    const hasScore = markRec && markRec.marksObtained !== null && markRec.marksObtained !== undefined;
    const score = isPresent ? (hasScore ? markRec.marksObtained! : '') : 'ABSENT';
    const status = markRec ? (isPresent ? 'PRESENT' : 'ABSENT') : 'PENDING';

    let resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING' = 'PENDING';
    if (markRec) {
      if (!isPresent) resultStatus = 'ABSENT';
      else if (hasScore) resultStatus = Number(markRec.marksObtained) >= minPass ? 'PASS' : 'FAIL';
    }

    return [
      idx + 1,
      String(enr.rollNumber || ''),
      String(enr.studentName || ''),
      String(enr.fatherName || '-'),
      candidateSubject,
      form.course || 'B.A./B.Sc.',
      form.semester || 'Semester 2',
      enr.section || form.section || '-',
      status,
      form.maxMarks,
      minPass,
      score,
      resultStatus,
      markRec?.remarks || '',
    ];
  });

  const displaySubject = normTarget || form.subjectName || 'PRACTICAL';
  const ws = XLSX.utils.aoa_to_sheet([
    [institutionName.toUpperCase()],
    [`PRACTICAL EXAMINATION MARKSHEET - ${form.title}`],
    [
      `Subject: ${displaySubject} | Incharge: ${form.inchargeName || 'Incharge'} | Date: ${form.examDate || 'Current'} | Max Marks: ${form.maxMarks} | Min Pass Marks: ${minPass}`,
    ],
    [],
    headers,
    ...rows,
  ]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 26 },
    { wch: 26 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  const safeSheetName = (displaySubject || 'Marksheet').slice(0, 31).replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  XLSX.writeFile(
    wb,
    `${displaySubject}_Practical_Marks_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export function exportExaminerAssignmentMarksheetExcel(
  assignment: ExaminerAssignment,
  students: PaperStudent[],
  marks: AssignmentMarkRecord[],
  institutionName = 'NGM Degree Mahavidyalaya'
) {
  const marksMap = new Map(marks.map((m) => [m.studentId, m]));
  const headers = [
    'SN.',
    'Roll Number',
    'Candidate Name',
    "Father's Name",
    'Practical Subject',
    'Session',
    'Semester',
    'Subject Type',
    'Paper Name',
    'Attendance',
    `Max Marks (${assignment.maxMarks})`,
    `Min Pass Marks (${assignment.minMarks})`,
    'Obtained Marks',
    'Result Status',
    'Remarks',
  ];

  let presentCount = 0;
  let absentCount = 0;
  let passedCount = 0;
  let failedCount = 0;

  const rows = students.map((std, idx) => {
    const markRec = marksMap.get(std.id);
    const isPresent = markRec ? markRec.isPresent : true;
    const hasMarks = markRec && markRec.marksObtained !== null && markRec.marksObtained !== undefined;
    const score = markRec ? (isPresent ? (hasMarks ? markRec.marksObtained! : '') : 'ABSENT') : '';
    const status = markRec ? (isPresent ? 'PRESENT' : 'ABSENT') : 'PENDING';

    let resultStatus = 'PENDING';
    if (markRec) {
      if (!isPresent) {
        resultStatus = 'ABSENT';
        absentCount++;
      } else if (hasMarks) {
        presentCount++;
        if (Number(markRec.marksObtained) >= assignment.minMarks) {
          resultStatus = 'PASS';
          passedCount++;
        } else {
          resultStatus = 'FAIL';
          failedCount++;
        }
      }
    }

    return [
      idx + 1,
      std.rollNumber,
      std.studentName,
      std.fatherName || '-',
      std.subject,
      assignment.session,
      assignment.semester,
      assignment.subjectType,
      assignment.paperName,
      status,
      assignment.maxMarks,
      assignment.minMarks,
      score,
      resultStatus,
      markRec?.remarks || '',
    ];
  });

  const metadataRows = [
    [institutionName.toUpperCase()],
    ['PRACTICAL EXAMINATION OFFICIAL MARKSHEET'],
    [],
    [
      `Academic Session: ${assignment.session}`,
      `Semester: ${assignment.semester}`,
      `Subject Type: ${assignment.subjectType}`,
      `Paper Name: ${assignment.paperName}`,
      `Practical Subject: ${assignment.subjectName}`,
    ],
    [
      `Internal Incharge: ${assignment.inchargeName || 'Not Assigned'}`,
      `External Examiner: ${assignment.examinerName || 'Not Assigned'}`,
      `Max Marks: ${assignment.maxMarks}`,
      `Min Pass Marks: ${assignment.minMarks}`,
      `Status: ${assignment.status}`,
    ],
    [],
  ];

  const summaryRows = [
    [],
    ['--- SUMMARY STATISTICS ---'],
    ['Total Enrolled Candidates', students.length],
    ['Candidates Evaluated (Present)', presentCount],
    ['Absent Candidates', absentCount],
    ['Passed Candidates', passedCount],
    ['Failed Candidates', failedCount],
    [],
    ['INTERNAL INCHARGE SIGNATURE: _______________________', '', 'EXTERNAL EXAMINER SIGNATURE: _______________________', '', 'PRINCIPAL / CONTROLLER OF EXAMS: _______________________'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    ...metadataRows,
    headers,
    ...rows,
    ...summaryRows,
  ]);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 26 },
    { wch: 26 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  const safeSheetName = `${assignment.paperName}_${assignment.subjectName}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const cleanFile = `${assignment.session}_${assignment.semester}_${assignment.subjectType}_${assignment.paperName}_${assignment.subjectName}_Marks_${new Date().toISOString().slice(0, 10)}.xlsx`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '');

  XLSX.writeFile(wb, cleanFile);
}

