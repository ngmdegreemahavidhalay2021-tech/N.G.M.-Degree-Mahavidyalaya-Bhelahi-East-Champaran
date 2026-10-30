import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PracticalForm, FormEnrollment, MarksRecord, Department, Subject } from '../types';

export interface ExportFilterOptions {
  departmentId?: string;
  subjectId?: string;
  practicalFormId?: string;
  course?: string;
  semester?: string;
  examYear?: string;
  marksStatus?: 'ALL' | 'ENTERED' | 'PENDING';
  searchQuery?: string;
}

export interface UnifiedExportRecord {
  departmentName: string;
  parentGroupName?: string;
  course: string;
  semester: string;
  section: string;
  subjectCode: string;
  subjectName: string;
  examinationName: string;
  examinationYear: string;
  examDate: string;
  maxMarks: number;
  minPassingMarks: number;
  rollNumber: string;
  studentName: string;
  fatherName: string;
  marksObtained: number | string;
  status: 'PRESENT' | 'ABSENT' | 'PENDING';
  resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';
  remarks: string;
  exportDate: string;
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
    if (options.subjectId && options.subjectId !== 'ALL' && form.subjectId !== options.subjectId) return;
    if (options.practicalFormId && options.practicalFormId !== 'ALL' && form.id !== options.practicalFormId) return;
    if (options.course && options.course !== 'ALL' && form.course !== options.course) return;
    if (options.semester && options.semester !== 'ALL' && form.semester !== options.semester) return;
    if (options.examYear && options.examYear !== 'ALL' && form.examYear !== options.examYear) return;

    const enrollments = enrollmentsMap[form.id] || [];
    const marks = marksMap[form.id] || [];
    const marksByStudentId = new Map(marks.map((m) => [m.studentId, m]));
    const deptObj = deptLookup.get(form.departmentId);
    const minPass = form.minPassingMarks ?? Math.round(form.maxMarks * 0.33);

    enrollments.forEach((enr) => {
      const markRec = marksByStudentId.get(enr.studentId);
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
        const matchesRoll = enr.rollNumber.toLowerCase().includes(q);
        const matchesName = enr.studentName.toLowerCase().includes(q);
        if (!matchesRoll && !matchesName) return;
      }

      records.push({
        departmentName: deptObj?.name || form.departmentId,
        parentGroupName: deptObj?.isGroup ? deptObj.name : undefined,
        course: form.course,
        semester: form.semester,
        section: form.section || 'All',
        subjectCode: form.subjectCode,
        subjectName: form.subjectName,
        examinationName: form.examName,
        examinationYear: form.examYear,
        examDate: form.examDate,
        maxMarks: form.maxMarks,
        minPassingMarks: minPass,
        rollNumber: enr.rollNumber,
        studentName: enr.studentName,
        fatherName: enr.fatherName || '',
        marksObtained: score,
        status,
        resultStatus,
        remarks: markRec?.remarks || '',
        exportDate,
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

  // 1. Master Records Sheet
  const masterHeaders = [
    'Roll Number',
    'Student Name',
    "Father's Name",
    'Department / Parent Group',
    'Course',
    'Semester',
    'Section',
    'Subject Code',
    'Subject Name',
    'Examination Name',
    'Academic Year',
    'Exam Date',
    'Max Marks',
    'Min Passing Marks',
    'Marks Obtained',
    'Attendance Status',
    'Result Status',
    'Remarks',
    'Export Date',
  ];

  const masterRows = records.map((r) => [
    r.rollNumber,
    r.studentName,
    r.fatherName,
    r.parentGroupName ? `${r.departmentName} (${r.parentGroupName})` : r.departmentName,
    r.course,
    r.semester,
    r.section,
    r.subjectCode,
    r.subjectName,
    r.examinationName,
    r.examinationYear,
    r.examDate,
    r.maxMarks,
    r.minPassingMarks,
    r.marksObtained,
    r.status,
    r.resultStatus,
    r.remarks,
    r.exportDate,
  ]);

  const wsMaster = XLSX.utils.aoa_to_sheet([
    [institutionName.toUpperCase()],
    ['COMPREHENSIVE COLLEGE PRACTICAL EXAMINATION MARKS STATEMENT'],
    [],
    masterHeaders,
    ...masterRows,
  ]);

  wsMaster['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 28 },
    { wch: 20 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 32 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, wsMaster, 'All Practical Records');

  // 2. Summary Statistics Sheet
  const deptStats: Record<string, { total: number; present: number; absent: number; pending: number }> = {};
  records.forEach((r) => {
    if (!deptStats[r.departmentName]) {
      deptStats[r.departmentName] = { total: 0, present: 0, absent: 0, pending: 0 };
    }
    deptStats[r.departmentName].total++;
    if (r.status === 'PRESENT') deptStats[r.departmentName].present++;
    else if (r.status === 'ABSENT') deptStats[r.departmentName].absent++;
    else deptStats[r.departmentName].pending++;
  });

  const summaryRows = [
    [institutionName.toUpperCase()],
    ['DEPARTMENT-WISE EVALUATION SUMMARY STATISTICS'],
    [],
    ['Department Name', 'Total Enrolled', 'Evaluated (Present)', 'Absent Candidates', 'Pending Marks', 'Completion Rate'],
  ];

  Object.entries(deptStats).forEach(([dept, s]) => {
    const rate = s.total > 0 ? (((s.present + s.absent) / s.total) * 100).toFixed(1) + '%' : '0%';
    summaryRows.push([dept, s.total as any, s.present as any, s.absent as any, s.pending as any, rate as any]);
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
  institutionName = 'NGM Degree Mahavidyalaya'
) {
  const marksMap = new Map(marks.map((m) => [m.studentId, m]));
  const minPass = form.minPassingMarks ?? Math.round(form.maxMarks * 0.33);
  const headers = [
    'S.No.',
    'Roll Number',
    'Student Name',
    "Father's Name",
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

  const rows = enrollments.map((enr, idx) => {
    const markRec = marksMap.get(enr.studentId);
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
      enr.rollNumber,
      enr.studentName,
      enr.fatherName || '-',
      form.course,
      form.semester,
      enr.section || form.section || '-',
      status,
      form.maxMarks,
      minPass,
      score,
      resultStatus,
      markRec?.remarks || '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [institutionName.toUpperCase()],
    [`PRACTICAL EXAMINATION MARKSHEET - ${form.title}`],
    [`Subject: ${form.subjectName} (${form.subjectCode}) | Date: ${form.examDate} | Max Marks: ${form.maxMarks} | Min Pass Marks: ${minPass}`],
    [],
    headers,
    ...rows,
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (form.subjectCode || 'Marksheet').slice(0, 31));
  XLSX.writeFile(wb, `${form.subjectCode}_Practical_Marks_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
