import * as XLSX from 'xlsx';
import { PracticalExam, ExamStudent, RubricCriterion } from '../types';

export function exportExamMarksToExcel(exam: PracticalExam, students: ExamStudent[], institutionName = 'NGM Degree Mahavidyalaya') {
  const rows: any[][] = [];

  rows.push([institutionName.toUpperCase()]);
  rows.push(['OFFICIAL PRACTICAL EXAMINATION EVALUATION & MARKS STATEMENT']);
  rows.push([]);
  rows.push(['Course / Degree:', exam.course, 'Semester:', exam.semester, 'Academic Year:', exam.academicYear]);
  rows.push(['Subject:', `${exam.title} (${exam.subjectCode})`, 'Exam Date:', exam.examDate, 'Venue:', exam.venue]);
  rows.push(['Maximum Marks:', exam.maxMarks, 'Passing Marks:', exam.passingMarks, 'Evaluation Status:', exam.status.toUpperCase()]);
  rows.push(['Internal Examiner:', exam.internalExaminerName || 'N/A', 'External Examiner:', exam.externalExaminerName || 'N/A']);
  rows.push([]);

  const headerRow: string[] = ['S.No.', 'Roll Number', 'Registration / PRN', 'Candidate Name', 'Batch', 'Attendance'];

  exam.rubricCriteria.forEach((criterion: RubricCriterion) => {
    headerRow.push(`${criterion.name} (Max ${criterion.maxMarks})`);
  });

  headerRow.push(`Total Marks (/${exam.maxMarks})`);
  headerRow.push('Percentage (%)');
  headerRow.push('Result Status');
  headerRow.push('Examiner Remarks');

  rows.push(headerRow);

  let presentCount = 0;
  let passCount = 0;
  let failCount = 0;

  students.forEach((student, index) => {
    const isPresent = student.attendance === 'present';
    if (isPresent) {
      presentCount++;
      if (student.status === 'pass') passCount++;
      else if (student.status === 'fail') failCount++;
    }

    const row: any[] = [
      index + 1,
      student.rollNo,
      student.regNo || '-',
      student.studentName,
      student.batch || 'Batch 1',
      student.attendance.toUpperCase(),
    ];

    exam.rubricCriteria.forEach((criterion: RubricCriterion) => {
      if (!isPresent) {
        row.push('AB');
      } else {
        const mark = student.criteriaMarks?.[criterion.id];
        row.push(mark !== undefined && mark !== null ? mark : 0);
      }
    });

    row.push(isPresent ? student.totalMarks : 'AB');
    row.push(isPresent ? `${student.percentage.toFixed(1)}%` : '0%');
    row.push(isPresent ? student.status.toUpperCase() : 'ABSENT');
    row.push(student.remarks || '');

    rows.push(row);
  });

  const absentCount = students.length - presentCount;
  const passRate = presentCount > 0 ? ((passCount / presentCount) * 100).toFixed(1) : '0';

  rows.push([]);
  rows.push(['EXAMINATION SUMMARY & RESULT STATISTICS']);
  rows.push(['Total Enrolled Candidates:', students.length]);
  rows.push(['Present Candidates:', presentCount]);
  rows.push(['Absent Candidates:', absentCount]);
  rows.push(['Passed Candidates:', passCount]);
  rows.push(['Failed Candidates:', failCount]);
  rows.push(['Overall Pass Rate (Present):', `${passRate}%`]);
  rows.push([]);
  rows.push([]);

  rows.push([
    '______________________________',
    '',
    '______________________________',
    '',
    '______________________________',
  ]);
  rows.push([
    `Internal Examiner (${exam.internalExaminerName || 'Sign'})`,
    '',
    `External Examiner (${exam.externalExaminerName || 'Sign'})`,
    '',
    'Principal / HoD Seal & Sign',
  ]);
  rows.push(['Date: __________________', '', 'Date: __________________', '', 'Date: __________________']);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    ...exam.rubricCriteria.map(() => ({ wch: 22 })),
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 30 },
  ];

  const wb = XLSX.utils.book_new();
  const safeSheetName = (exam.subjectCode || 'Marksheet').slice(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const cleanTitle = (exam.title || 'Practical_Exam').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${exam.subjectCode || 'EXAM'}_${cleanTitle}_Marks_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(wb, filename);
}

export function exportExamMarksToCSV(exam: PracticalExam, students: ExamStudent[]) {
  const headers = [
    'Roll No',
    'Registration No',
    'Student Name',
    'Attendance',
    ...exam.rubricCriteria.map((c: RubricCriterion) => `${c.name} (${c.maxMarks})`),
    'Total Marks',
    'Percentage',
    'Status',
    'Remarks',
  ];
  const lines = [headers.join(',')];

  students.forEach((s) => {
    const isPresent = s.attendance === 'present';
    const row = [
      `"${s.rollNo}"`,
      `"${s.regNo || ''}"`,
      `"${s.studentName}"`,
      s.attendance.toUpperCase(),
      ...exam.rubricCriteria.map((c: RubricCriterion) => (isPresent ? (s.criteriaMarks?.[c.id] ?? 0) : 'AB')),
      isPresent ? s.totalMarks : 'AB',
      isPresent ? `${s.percentage.toFixed(1)}%` : '0%',
      isPresent ? s.status.toUpperCase() : 'ABSENT',
      `"${(s.remarks || '').replace(/"/g, '""')}"`,
    ];
    lines.push(row.join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exam.subjectCode || 'EXAM'}_marks_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
