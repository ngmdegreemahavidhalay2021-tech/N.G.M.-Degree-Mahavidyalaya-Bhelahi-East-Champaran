import {
  collection,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  AcademicSemester,
  AcademicSession,
  Department,
  ExaminerAssignment,
  FormEnrollment,
  MarksRecord,
  PaperStudent,
  PracticalForm,
  SUBJECT_TYPES,
  SubjectType,
} from '../types';
import {
  PracticalCategoryDisplay,
  PracticalCategorySheetPayload,
  PracticalCategoryValidationSummary,
  PracticalExamTypeOption,
  PracticalMarksDepartmentOption,
  PracticalMarksFmConfig,
  PracticalMarksSubjectOption,
  PracticalStudentMarkRow,
} from '../types/practicalMarksGenerator';
import { normalizeSemester } from './collegeService';

export interface PracticalMarksDatabaseSnapshot {
  sessions: AcademicSession[];
  semesters: AcademicSemester[];
  departments: Department[];
  practicalForms: PracticalForm[];
  formEnrollments: FormEnrollment[];
  marks: MarksRecord[];
  examinerAssignments: ExaminerAssignment[];
  paperStudents: PaperStudent[];
  loadedAt: string;
}

export function mapCategoryToDisplay(category: SubjectType): PracticalCategoryDisplay {
  if (category === 'MJC') return 'MAJOR';
  if (category === 'MIC') return 'MINOR';
  return 'MDC';
}

export function mapDisplayToCategory(display: PracticalCategoryDisplay): SubjectType {
  if (display === 'MAJOR') return 'MJC';
  if (display === 'MINOR') return 'MIC';
  return 'MDC';
}

/**
 * Strictly excludes any CIA, Practical CIA, Internal Assessment, Mid-Term, or Sessional record.
 */
export function isCiaOrNonPracticalText(...values: Array<string | undefined | null>): boolean {
  const combined = values
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (!combined) return false;
  return (
    /\b(cia|internal[\s_-]*assessment|mid[\s_-]*term|sessional)\b/i.test(combined) ||
    /practical[\s_-]*cia/i.test(combined) ||
    /cia[\s_-]*practical/i.test(combined)
  );
}

export function isValidPracticalCategory(cat: unknown): cat is SubjectType {
  const clean = String(cat ?? '').trim().toUpperCase();
  return clean === 'MJC' || clean === 'MIC' || clean === 'MDC';
}

export function isEligiblePracticalForm(form: PracticalForm): boolean {
  const cat = String(form.subjectType || 'MJC').trim().toUpperCase();
  if (!isValidPracticalCategory(cat)) return false;
  return !isCiaOrNonPracticalText(
    form.examName,
    form.title,
    form.subjectType,
    form.paperName,
    form.course,
    form.subjectName
  );
}

export function isEligibleExaminerAssignment(assignment: ExaminerAssignment): boolean {
  const cat = String(assignment.subjectType || '').trim().toUpperCase();
  if (!isValidPracticalCategory(cat)) return false;
  return !isCiaOrNonPracticalText(
    assignment.subjectType,
    assignment.paperName,
    assignment.subjectName
  );
}

/**
 * Determines whether a stored marks document represents an actual entered mark or explicit absence
 * (as opposed to an untouched pending draft row where marksObtained is null and isPresent is true).
 */
export function isActualEnteredMarkRecord(mark: Partial<MarksRecord> & Record<string, any>): boolean {
  if (!mark) return false;
  if (mark.isPresent === false) return true;
  if (mark.marksObtained !== null && mark.marksObtained !== undefined) {
    const str = String(mark.marksObtained).trim();
    if (str !== '') return true;
  }
  return false;
}

export function compareRollNumbersAscending(a: string, b: string): number {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  const aIsNum = /^\d+$/.test(sa);
  const bIsNum = /^\d+$/.test(sb);
  if (aIsNum && bIsNum) {
    const ba = BigInt(sa);
    const bb = BigInt(sb);
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return sa.localeCompare(sb);
  }
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Fetches a read-only snapshot of all relevant practical examination collections.
 * Strictly read-only — never modifies any ERP collection.
 */
export async function fetchPracticalMarksDatabaseSnapshot(): Promise<PracticalMarksDatabaseSnapshot> {
  const [
    sessSnap,
    semSnap,
    deptSnap,
    formSnap,
    enrSnap,
    markSnap,
    assignSnap,
    paperStudSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'academicSessions')),
    getDocs(collection(db, 'academicSemesters')),
    getDocs(collection(db, 'departments')),
    getDocs(collection(db, 'practicalForms')),
    getDocs(collection(db, 'formEnrollments')),
    getDocs(collection(db, 'marks')),
    getDocs(collection(db, 'examinerAssignments')),
    getDocs(collection(db, 'paperStudents')),
  ]);

  const sessions: AcademicSession[] = [];
  sessSnap.forEach((d) => sessions.push({ id: d.id, ...(d.data() as Omit<AcademicSession, 'id'>) }));
  sessions.sort((a, b) => a.sessionName.localeCompare(b.sessionName));

  const semesters: AcademicSemester[] = [];
  semSnap.forEach((d) => semesters.push({ id: d.id, ...(d.data() as Omit<AcademicSemester, 'id'>) }));
  semesters.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  const departments: Department[] = [];
  deptSnap.forEach((d) => departments.push({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }));
  departments.sort((a, b) => a.name.localeCompare(b.name));

  const practicalForms: PracticalForm[] = [];
  formSnap.forEach((d) => practicalForms.push({ id: d.id, ...(d.data() as Omit<PracticalForm, 'id'>) }));

  const formEnrollments: FormEnrollment[] = [];
  enrSnap.forEach((d) => formEnrollments.push({ id: d.id, ...(d.data() as Omit<FormEnrollment, 'id'>) }));

  const marks: MarksRecord[] = [];
  markSnap.forEach((d) => marks.push({ id: d.id, ...(d.data() as Omit<MarksRecord, 'id'>) }));

  const examinerAssignments: ExaminerAssignment[] = [];
  assignSnap.forEach((d) =>
    examinerAssignments.push({ id: d.id, ...(d.data() as Omit<ExaminerAssignment, 'id'>) })
  );

  const paperStudents: PaperStudent[] = [];
  paperStudSnap.forEach((d) =>
    paperStudents.push({ id: d.id, ...(d.data() as Omit<PaperStudent, 'id'>) })
  );

  return {
    sessions,
    semesters,
    departments,
    practicalForms,
    formEnrollments,
    marks,
    examinerAssignments,
    paperStudents,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Live listener on `marks`, `practicalForms`, and `examinerAssignments` so newly added
 * Practical Marks records are automatically detected without requiring manual page reloads.
 */
export function subscribeToPracticalMarksUpdates(onChange: () => void): Unsubscribe {
  let initializedCount = 0;
  const markReady = () => {
    initializedCount++;
    // Trigger immediately once initial snapshots settle and on every subsequent change
    if (initializedCount >= 3) {
      onChange();
    }
  };

  const u1 = onSnapshot(collection(db, 'marks'), () => markReady(), () => {});
  const u2 = onSnapshot(collection(db, 'practicalForms'), () => markReady(), () => {});
  const u3 = onSnapshot(collection(db, 'examinerAssignments'), () => markReady(), () => {});

  return () => {
    u1();
    u2();
    u3();
  };
}

function getFormExamTypeLabel(form: PracticalForm): string {
  const examName = (form.examName || '').trim();
  if (examName) return examName;
  const title = (form.title || '').trim();
  if (title) return title;
  return `${(form.session || form.examYear || '').trim()} ${normalizeSemester(form.semester)} Practical Examination`.trim();
}

function getAssignmentExamTypeLabel(assignment: ExaminerAssignment): string {
  return `${(assignment.session || '').trim()} ${normalizeSemester(assignment.semester)} Practical Examination`.trim();
}

/**
 * Dynamically extracts available Examination Types strictly from actual saved
 * non-CIA Practical Marks records in Firestore for the selected Session + Semester.
 * Never returns hardcoded options or exam types with 0 entered practical marks.
 */
export function extractAvailableExamTypes(
  snapshot: PracticalMarksDatabaseSnapshot,
  session: string,
  semester: string
): PracticalExamTypeOption[] {
  const cleanSession = (session || '').trim();
  const normSem = normalizeSemester(semester);
  if (!cleanSession || !semester) return [];

  const eligibleForms = snapshot.practicalForms.filter((f) => {
    if (!isEligiblePracticalForm(f)) return false;
    const fSess = (f.session || f.examYear || '').trim();
    const fSem = normalizeSemester(f.semester);
    return fSess === cleanSession && fSem === normSem;
  });

  const eligibleAssignments = snapshot.examinerAssignments.filter((a) => {
    if (!isEligibleExaminerAssignment(a)) return false;
    const aSess = (a.session || '').trim();
    const aSem = normalizeSemester(a.semester);
    return aSess === cleanSession && aSem === normSem;
  });

  const formById = new Map(eligibleForms.map((f) => [f.id, f]));
  const assignById = new Map(eligibleAssignments.map((a) => [a.id, a]));

  // Count actual entered marks per formId and assignmentId (ignoring orphaned marks and blank drafts)
  const actualMarksByFormId = new Map<string, number>();
  const actualMarksByAssignId = new Map<string, number>();

  snapshot.marks.forEach((m: MarksRecord & { assignmentId?: string }) => {
    if (!isActualEnteredMarkRecord(m)) return;
    if (isCiaOrNonPracticalText(m.subject, m.remarks)) return;
    if (m.practicalFormId && formById.has(m.practicalFormId)) {
      actualMarksByFormId.set(m.practicalFormId, (actualMarksByFormId.get(m.practicalFormId) || 0) + 1);
    } else if (m.assignmentId && assignById.has(m.assignmentId)) {
      actualMarksByAssignId.set(m.assignmentId, (actualMarksByAssignId.get(m.assignmentId) || 0) + 1);
    }
  });

  const enrollmentCountByFormId = new Map<string, number>();
  snapshot.formEnrollments.forEach((e) => {
    if (e.status === 'removed') return;
    if (!formById.has(e.practicalFormId)) return;
    enrollmentCountByFormId.set(e.practicalFormId, (enrollmentCountByFormId.get(e.practicalFormId) || 0) + 1);
  });

  const examMap = new Map<
    string,
    {
      examType: string;
      sourceFormIds: string[];
      sourceAssignmentIds: string[];
      categories: Set<SubjectType>;
      totalEnrolled: number;
      actualMarksCount: number;
    }
  >();

  const ensureExam = (label: string) => {
    if (!examMap.has(label)) {
      examMap.set(label, {
        examType: label,
        sourceFormIds: [],
        sourceAssignmentIds: [],
        categories: new Set<SubjectType>(),
        totalEnrolled: 0,
        actualMarksCount: 0,
      });
    }
    return examMap.get(label)!;
  };

  eligibleForms.forEach((form) => {
    const label = getFormExamTypeLabel(form);
    const cat = String(form.subjectType || 'MJC').trim().toUpperCase() as SubjectType;
    const entry = ensureExam(label);
    entry.sourceFormIds.push(form.id);
    entry.categories.add(cat);
    entry.totalEnrolled += enrollmentCountByFormId.get(form.id) || 0;
    entry.actualMarksCount += actualMarksByFormId.get(form.id) || 0;
  });

  eligibleAssignments.forEach((assign) => {
    const label = getAssignmentExamTypeLabel(assign);
    const cat = String(assign.subjectType || 'MJC').trim().toUpperCase() as SubjectType;
    const entry = ensureExam(label);
    entry.sourceAssignmentIds.push(assign.id);
    entry.categories.add(cat);
    entry.actualMarksCount += actualMarksByAssignId.get(assign.id) || 0;
  });

  // Strictly return ONLY examination types that actually have >= 1 entered practical mark record
  return Array.from(examMap.values())
    .filter((item) => item.actualMarksCount > 0)
    .map((item) => ({
      examType: item.examType,
      sourceFormIds: item.sourceFormIds,
      sourceAssignmentIds: item.sourceAssignmentIds,
      categories: SUBJECT_TYPES.filter((c) => item.categories.has(c)),
      totalEnrolled: item.totalEnrolled,
      actualMarksCount: item.actualMarksCount,
    }))
    .sort((a, b) => a.examType.localeCompare(b.examType));
}

function getMatchingFormsAndAssignments(
  snapshot: PracticalMarksDatabaseSnapshot,
  params: {
    session: string;
    semester: string;
    examType?: string;
    category?: SubjectType;
  }
) {
  const cleanSession = (params.session || '').trim();
  const normSem = normalizeSemester(params.semester);
  const cleanExam = (params.examType || '').trim();
  const cleanCat = params.category ? params.category.trim().toUpperCase() : null;

  const forms = snapshot.practicalForms.filter((f) => {
    if (!isEligiblePracticalForm(f)) return false;
    const fSess = (f.session || f.examYear || '').trim();
    const fSem = normalizeSemester(f.semester);
    if (fSess !== cleanSession || fSem !== normSem) return false;
    if (cleanExam && getFormExamTypeLabel(f) !== cleanExam) return false;
    if (cleanCat && String(f.subjectType || 'MJC').trim().toUpperCase() !== cleanCat) return false;
    return true;
  });

  const assignments = snapshot.examinerAssignments.filter((a) => {
    if (!isEligibleExaminerAssignment(a)) return false;
    const aSess = (a.session || '').trim();
    const aSem = normalizeSemester(a.semester);
    if (aSess !== cleanSession || aSem !== normSem) return false;
    if (cleanExam && getAssignmentExamTypeLabel(a) !== cleanExam) return false;
    if (cleanCat && String(a.subjectType || '').trim().toUpperCase() !== cleanCat) return false;
    return true;
  });

  return { forms, assignments };
}

/**
 * Extracts available departments for the active Session + Semester + Exam Type + Category.
 */
export function extractAvailableDepartments(
  snapshot: PracticalMarksDatabaseSnapshot,
  params: {
    session: string;
    semester: string;
    examType: string;
    category: SubjectType;
  }
): PracticalMarksDepartmentOption[] {
  if (!params.session || !params.semester || !params.examType || !params.category) return [];

  const deptById = new Map(snapshot.departments.map((d) => [d.id, d]));
  const { forms } = getMatchingFormsAndAssignments(snapshot, params);
  const formById = new Map(forms.map((f) => [f.id, f]));

  const deptStats = new Map<string, PracticalMarksDepartmentOption>();
  const ensureDept = (deptId: string, fallbackName?: string) => {
    const cleanId = (deptId || 'unassigned').trim();
    if (!deptStats.has(cleanId)) {
      const dept = deptById.get(cleanId);
      deptStats.set(cleanId, {
        departmentId: cleanId,
        departmentName: dept?.name || fallbackName || cleanId,
        studentCount: 0,
        actualMarksCount: 0,
      });
    }
    return deptStats.get(cleanId)!;
  };

  forms.forEach((f) => {
    ensureDept(f.departmentId, f.departmentName);
  });

  snapshot.formEnrollments.forEach((e) => {
    if (e.status === 'removed') return;
    const form = formById.get(e.practicalFormId);
    if (!form) return;
    const dId = form.departmentId || e.departmentId;
    const entry = ensureDept(dId, form.departmentName);
    entry.studentCount += 1;
  });

  snapshot.marks.forEach((m) => {
    if (!isActualEnteredMarkRecord(m)) return;
    const form = formById.get(m.practicalFormId);
    if (!form) return;
    const entry = ensureDept(form.departmentId, form.departmentName);
    entry.actualMarksCount += 1;
  });

  return Array.from(deptStats.values()).sort((a, b) =>
    a.departmentName.localeCompare(b.departmentName)
  );
}

/**
 * Extracts available subjects (and papers if multiple exist) for the active filters.
 */
export function extractAvailableSubjects(
  snapshot: PracticalMarksDatabaseSnapshot,
  params: {
    session: string;
    semester: string;
    examType: string;
    category: SubjectType;
    departmentId?: string;
  }
): PracticalMarksSubjectOption[] {
  if (!params.session || !params.semester || !params.examType || !params.category) return [];

  const deptFilter = params.departmentId && params.departmentId !== 'ALL' ? params.departmentId : null;
  const deptById = new Map(snapshot.departments.map((d) => [d.id, d]));
  const { forms, assignments } = getMatchingFormsAndAssignments(snapshot, params);

  const filteredForms = deptFilter ? forms.filter((f) => f.departmentId === deptFilter) : forms;
  const formById = new Map(filteredForms.map((f) => [f.id, f]));

  const subjectMap = new Map<
    string,
    {
      subject: string;
      departmentIds: Set<string>;
      departmentNames: Set<string>;
      papers: Set<string>;
      rollSet: Set<string>;
      actualMarkKeys: Set<string>;
    }
  >();

  const ensureSubj = (rawSubj: string) => {
    const clean = (rawSubj || '').trim().toUpperCase();
    if (!clean) return null;
    if (!subjectMap.has(clean)) {
      subjectMap.set(clean, {
        subject: clean,
        departmentIds: new Set<string>(),
        departmentNames: new Set<string>(),
        papers: new Set<string>(),
        rollSet: new Set<string>(),
        actualMarkKeys: new Set<string>(),
      });
    }
    return subjectMap.get(clean)!;
  };

  snapshot.formEnrollments.forEach((e) => {
    if (e.status === 'removed') return;
    const form = formById.get(e.practicalFormId);
    if (!form) return;
    const subjName = (e.subject || form.subjectName || '').trim().toUpperCase();
    const entry = ensureSubj(subjName);
    if (!entry) return;
    const dId = form.departmentId || e.departmentId;
    if (dId) {
      entry.departmentIds.add(dId);
      entry.departmentNames.add(deptById.get(dId)?.name || form.departmentName || dId);
    }
    if (form.paperName) entry.papers.add(form.paperName.trim());
    if (e.rollNumber) entry.rollSet.add(`${form.id}::${String(e.rollNumber).trim().toUpperCase()}`);
  });

  snapshot.marks.forEach((m) => {
    if (!isActualEnteredMarkRecord(m)) return;
    const form = formById.get(m.practicalFormId);
    if (!form) return;
    const subjName = (m.subject || form.subjectName || '').trim().toUpperCase();
    const entry = ensureSubj(subjName);
    if (!entry) return;
    if (form.departmentId) {
      entry.departmentIds.add(form.departmentId);
      entry.departmentNames.add(
        deptById.get(form.departmentId)?.name || form.departmentName || form.departmentId
      );
    }
    if (form.paperName) entry.papers.add(form.paperName.trim());
    const rollKey = String(m.rollNumber || m.studentId || m.id).trim().toUpperCase();
    entry.actualMarkKeys.add(`${form.id}::${rollKey}`);
  });

  // Also include examinerAssignments if any exist
  if (!deptFilter && assignments.length > 0) {
    const assignById = new Map(assignments.map((a) => [a.id, a]));
    snapshot.marks.forEach((m: MarksRecord & { assignmentId?: string }) => {
      if (!isActualEnteredMarkRecord(m) || !m.assignmentId) return;
      const assign = assignById.get(m.assignmentId);
      if (!assign) return;
      const subjName = (m.subject || assign.subjectName || '').trim().toUpperCase();
      const entry = ensureSubj(subjName);
      if (!entry) return;
      if (assign.paperName) entry.papers.add(assign.paperName.trim());
      const rollKey = String(m.rollNumber || m.studentId || m.id).trim().toUpperCase();
      entry.actualMarkKeys.add(`${assign.id}::${rollKey}`);
    });
  }

  return Array.from(subjectMap.values())
    .map((item) => ({
      subject: item.subject,
      departmentIds: Array.from(item.departmentIds),
      departmentNames: Array.from(item.departmentNames).sort(),
      papers: Array.from(item.papers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      totalStudents: item.rollSet.size,
      actualMarksCount: item.actualMarkKeys.size,
    }))
    .sort((a, b) => {
      if (a.actualMarksCount > 0 && b.actualMarksCount === 0) return -1;
      if (a.actualMarksCount === 0 && b.actualMarksCount > 0) return 1;
      return a.subject.localeCompare(b.subject);
    });
}

function evaluateRowWithFullMarks(
  base: Omit<
    PracticalStudentMarkRow,
    'displayMarks' | 'exceedsFm' | 'isNegative' | 'isInvalid' | 'validationIssue'
  >,
  fullMarks: number
): PracticalStudentMarkRow {
  if (base.status === 'ABSENT') {
    return {
      ...base,
      displayMarks: 'ABSENT',
      exceedsFm: false,
      isNegative: false,
      isInvalid: false,
    };
  }

  if (base.status === 'MISSING') {
    return {
      ...base,
      displayMarks: '',
      exceedsFm: false,
      isNegative: false,
      isInvalid: false,
    };
  }

  // PRESENT with a mark input
  const rawStr = base.rawMarkInput !== null && base.rawMarkInput !== undefined ? String(base.rawMarkInput).trim() : '';
  const numVal = typeof base.rawMarksObtained === 'number' ? base.rawMarksObtained : Number(rawStr);

  if (rawStr === '' || !Number.isFinite(numVal)) {
    return {
      ...base,
      displayMarks: rawStr || 'INVALID',
      exceedsFm: false,
      isNegative: false,
      isInvalid: true,
      validationIssue: 'Non-numeric marks value in database',
    };
  }

  const isNegative = numVal < 0;
  const exceedsFm = numVal > fullMarks;
  let validationIssue: string | undefined;
  if (isNegative) {
    validationIssue = `Negative marks (${numVal}) are not allowed`;
  } else if (exceedsFm) {
    validationIssue = `Stored marks (${numVal}) exceed selected Full Marks (${fullMarks})`;
  }

  return {
    ...base,
    rawMarksObtained: numVal,
    displayMarks: String(numVal),
    exceedsFm,
    isNegative,
    isInvalid: isNegative,
    validationIssue,
  };
}

/**
 * Builds the validated student-level Practical Marks rows and summary for a category
 * (`MJC`/`MIC`/`MDC`), optionally filtered by Department, Subject, and Paper.
 *
 * Strictly preserves Roll Numbers as exact strings, never mutates/scales/rounds marks,
 * and never converts missing marks to 0.
 */
export function buildCategoryPracticalMarksPayload(
  snapshot: PracticalMarksDatabaseSnapshot,
  params: {
    session: string;
    semester: string;
    examType: string;
    category: SubjectType;
    departmentId?: string; // 'ALL' or specific deptId
    subject?: string; // 'ALL' or specific subject
    paperFilter?: string; // 'ALL' or specific paperName
    fullMarks: number;
    collegeName?: string;
  }
): PracticalCategorySheetPayload {
  const fm = Number.isFinite(params.fullMarks) && params.fullMarks > 0 ? params.fullMarks : 70;
  const deptById = new Map(snapshot.departments.map((d) => [d.id, d]));
  const deptFilter = params.departmentId && params.departmentId !== 'ALL' ? params.departmentId : null;
  const subjFilter =
    params.subject && params.subject !== 'ALL' ? params.subject.trim().toUpperCase() : null;
  const paperFilter =
    params.paperFilter && params.paperFilter !== 'ALL' ? params.paperFilter.trim().toUpperCase() : null;

  const { forms, assignments } = getMatchingFormsAndAssignments(snapshot, {
    session: params.session,
    semester: params.semester,
    examType: params.examType,
    category: params.category,
  });

  const filteredForms = forms.filter((f) => {
    if (deptFilter && f.departmentId !== deptFilter) return false;
    if (paperFilter && (f.paperName || '').trim().toUpperCase() !== paperFilter) return false;
    return true;
  });

  // Group enrollments and marks per formId
  const enrollmentsByForm = new Map<string, FormEnrollment[]>();
  snapshot.formEnrollments.forEach((e) => {
    if (e.status === 'removed') return;
    if (!enrollmentsByForm.has(e.practicalFormId)) enrollmentsByForm.set(e.practicalFormId, []);
    enrollmentsByForm.get(e.practicalFormId)!.push(e);
  });

  const marksByForm = new Map<string, MarksRecord[]>();
  const marksByAssignment = new Map<string, Array<MarksRecord & { assignmentId?: string }>>();

  snapshot.marks.forEach((m: MarksRecord & { assignmentId?: string }) => {
    if (isCiaOrNonPracticalText(m.subject, m.remarks)) return;
    if (m.practicalFormId) {
      if (!marksByForm.has(m.practicalFormId)) marksByForm.set(m.practicalFormId, []);
      marksByForm.get(m.practicalFormId)!.push(m);
    } else if (m.assignmentId) {
      if (!marksByAssignment.has(m.assignmentId)) marksByAssignment.set(m.assignmentId, []);
      marksByAssignment.get(m.assignmentId)!.push(m);
    }
  });

  const rawRows: PracticalStudentMarkRow[] = [];
  const formIdsWithAnyActualMarks = new Set<string>();
  filteredForms.forEach((f) => {
    const fMarks = marksByForm.get(f.id) || [];
    if (fMarks.some((m) => isActualEnteredMarkRecord(m))) {
      formIdsWithAnyActualMarks.add(f.id);
    }
  });

  // If filtering across ALL subjects in a category (e.g. combined Major export),
  // include enrollments from forms in that exam scope (preferring forms/subjects that have started marks,
  // or when a specific subject is chosen, show all its enrolled students even if some/all are pending).
  filteredForms.forEach((form) => {
    const fEnrs = enrollmentsByForm.get(form.id) || [];
    const fMarks = marksByForm.get(form.id) || [];

    // When exporting category-wide without picking a single subject, only include forms that actually
    // belong to the active marks scope (have entered marks in this form) so we don't mix unstarted forms
    // unless a specific subject was explicitly selected.
    if (!subjFilter && !formIdsWithAnyActualMarks.has(form.id)) {
      return;
    }

    // Build subject-strict lookup maps for marks inside this form
    const byStudentSubj = new Map<string, MarksRecord>();
    const byRollSubj = new Map<string, MarksRecord>();
    const byStudentFallback = new Map<string, MarksRecord>();
    const byRollFallback = new Map<string, MarksRecord>();
    const usedMarkIds = new Set<string>();

    fMarks.forEach((m) => {
      const mSubj = (m.subject || '').trim().toUpperCase();
      const sId = (m.studentId || '').trim();
      const rNo = String(m.rollNumber || '').trim().toUpperCase();
      if (mSubj) {
        if (sId) byStudentSubj.set(`${sId}::${mSubj}`, m);
        if (rNo) byRollSubj.set(`${rNo}::${mSubj}`, m);
      } else {
        if (sId) byStudentFallback.set(sId, m);
        if (rNo) byRollFallback.set(rNo, m);
      }
    });

    // Determine which subjects within this form have entered marks when exporting ALL subjects
    const subjectsWithEnteredMarksInForm = new Set<string>();
    fMarks.forEach((m) => {
      if (isActualEnteredMarkRecord(m)) {
        const s = (m.subject || form.subjectName || '').trim().toUpperCase();
        if (s) subjectsWithEnteredMarksInForm.add(s);
      }
    });

    const deptName = deptById.get(form.departmentId)?.name || form.departmentName || form.departmentId;

    fEnrs.forEach((enr) => {
      const subj = (enr.subject || form.subjectName || '').trim().toUpperCase();
      if (!subj) return;
      if (subjFilter && subj !== subjFilter) return;

      // In multi-subject forms (e.g. SCIENCE), if exporting category-wide without subject filter,
      // only include subjects within that form that actually have practical marks entered.
      if (!subjFilter && subjectsWithEnteredMarksInForm.size > 0 && !subjectsWithEnteredMarksInForm.has(subj)) {
        return;
      }

      const sId = (enr.studentId || '').trim();
      const roll = String(enr.rollNumber ?? '').trim();
      const rollUpper = roll.toUpperCase();

      const matchedMark =
        (sId ? byStudentSubj.get(`${sId}::${subj}`) : undefined) ||
        (rollUpper ? byRollSubj.get(`${rollUpper}::${subj}`) : undefined) ||
        (sId ? byStudentFallback.get(sId) : undefined) ||
        (rollUpper ? byRollFallback.get(rollUpper) : undefined);

      if (matchedMark) usedMarkIds.add(matchedMark.id);

      const hasEntered = matchedMark ? isActualEnteredMarkRecord(matchedMark) : false;
      const status: PracticalStudentMarkRow['status'] = !hasEntered
        ? 'MISSING'
        : matchedMark!.isPresent === false
          ? 'ABSENT'
          : 'PRESENT';

      rawRows.push(
        evaluateRowWithFullMarks(
          {
            rowKey: `${form.id}::${subj}::${rollUpper || sId}`,
            studentId: sId || roll,
            rollNumber: roll,
            studentName: enr.studentName || matchedMark?.studentName || '',
            subject: subj,
            category: params.category,
            departmentId: form.departmentId || enr.departmentId,
            departmentName: deptName,
            paperName: form.paperName || '',
            session: params.session,
            semester: params.semester,
            examType: params.examType,
            formId: form.id,
            formTitle: form.title || form.subjectName,
            rawMarksObtained:
              hasEntered && matchedMark?.marksObtained !== null && matchedMark?.marksObtained !== undefined
                ? Number(matchedMark.marksObtained)
                : null,
            rawMarkInput: matchedMark?.marksObtained ?? null,
            isPresent: matchedMark ? matchedMark.isPresent !== false : true,
            status,
            updatedAt: matchedMark?.updatedAt,
            updatedBy: matchedMark?.updatedBy,
          },
          fm
        )
      );
    });

    // Include any actual mark inside this form that wasn't matched to an active enrollment
    fMarks.forEach((m) => {
      if (usedMarkIds.has(m.id)) return;
      if (!isActualEnteredMarkRecord(m)) return;
      const subj = (m.subject || form.subjectName || '').trim().toUpperCase();
      if (!subj) return;
      if (subjFilter && subj !== subjFilter) return;
      const roll = String(m.rollNumber ?? '').trim();
      const status: PracticalStudentMarkRow['status'] = m.isPresent === false ? 'ABSENT' : 'PRESENT';

      rawRows.push(
        evaluateRowWithFullMarks(
          {
            rowKey: `${form.id}::${subj}::${roll.toUpperCase() || m.studentId || m.id}`,
            studentId: m.studentId || roll,
            rollNumber: roll,
            studentName: m.studentName || '',
            subject: subj,
            category: params.category,
            departmentId: form.departmentId,
            departmentName: deptName,
            paperName: form.paperName || '',
            session: params.session,
            semester: params.semester,
            examType: params.examType,
            formId: form.id,
            formTitle: form.title || form.subjectName,
            rawMarksObtained:
              m.marksObtained !== null && m.marksObtained !== undefined ? Number(m.marksObtained) : null,
            rawMarkInput: m.marksObtained ?? null,
            isPresent: m.isPresent !== false,
            status,
            updatedAt: m.updatedAt,
            updatedBy: m.updatedBy,
          },
          fm
        )
      );
    });
  });

  // Also include ExaminerAssignment marks if any exist
  if (!deptFilter && assignments.length > 0) {
    assignments.forEach((assign) => {
      if (paperFilter && (assign.paperName || '').trim().toUpperCase() !== paperFilter) return;
      const aMarks = marksByAssignment.get(assign.id) || [];
      aMarks.forEach((m) => {
        if (!isActualEnteredMarkRecord(m)) return;
        const subj = (m.subject || assign.subjectName || '').trim().toUpperCase();
        if (!subj) return;
        if (subjFilter && subj !== subjFilter) return;
        const roll = String(m.rollNumber ?? '').trim();
        const status: PracticalStudentMarkRow['status'] = m.isPresent === false ? 'ABSENT' : 'PRESENT';
        rawRows.push(
          evaluateRowWithFullMarks(
            {
              rowKey: `${assign.id}::${subj}::${roll.toUpperCase() || m.studentId || m.id}`,
              studentId: m.studentId || roll,
              rollNumber: roll,
              studentName: m.studentName || '',
              subject: subj,
              category: params.category,
              departmentId: assign.parentGroupId || '',
              departmentName: assign.parentGroupName || subj,
              paperName: assign.paperName || '',
              session: params.session,
              semester: params.semester,
              examType: params.examType,
              assignmentId: assign.id,
              formTitle: `${assign.subjectName} (${assign.paperName})`,
              rawMarksObtained:
                m.marksObtained !== null && m.marksObtained !== undefined ? Number(m.marksObtained) : null,
              rawMarkInput: m.marksObtained ?? null,
              isPresent: m.isPresent !== false,
              status,
              updatedAt: m.updatedAt,
              updatedBy: m.updatedBy,
            },
            fm
          )
        );
      });
    });
  }

  // Deduplicate by (subject, rollNumber) preferring rows that have actual entered marks
  const dedupMap = new Map<string, PracticalStudentMarkRow>();
  rawRows.forEach((row) => {
    const key = `${row.subject}::${row.rollNumber.trim().toUpperCase() || row.studentId}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, row);
      return;
    }
    if (existing.status === 'MISSING' && row.status !== 'MISSING') {
      dedupMap.set(key, row);
    }
  });

  // Sort deterministically by Subject, then Roll Number ascending
  const sortedRows = Array.from(dedupMap.values()).sort((a, b) => {
    const subjCmp = a.subject.localeCompare(b.subject);
    if (subjCmp !== 0) return subjCmp;
    return compareRollNumbersAscending(a.rollNumber, b.rollNumber);
  });

  const exceedsFmStudents = sortedRows.filter((r) => r.exceedsFm);
  const invalidMarksStudents = sortedRows.filter((r) => r.isInvalid);
  const missingStudents = sortedRows.filter((r) => r.status === 'MISSING');
  const absentCount = sortedRows.filter((r) => r.status === 'ABSENT').length;
  const presentMarksCount = sortedRows.filter((r) => r.status === 'PRESENT' && !r.isInvalid).length;
  const marksAvailable = sortedRows.filter((r) => r.status !== 'MISSING').length;

  const summary: PracticalCategoryValidationSummary = {
    category: params.category,
    categoryDisplay: mapCategoryToDisplay(params.category),
    fullMarks: fm,
    totalStudents: sortedRows.length,
    marksAvailable,
    presentMarksCount,
    absentCount,
    missingMarksCount: missingStudents.length,
    exceedsFmStudents,
    invalidMarksStudents,
    missingStudents,
    hasBlockingErrors: exceedsFmStudents.length > 0 || invalidMarksStudents.length > 0,
  };

  return {
    category: params.category,
    categoryDisplay: mapCategoryToDisplay(params.category),
    session: params.session,
    semester: params.semester,
    examType: params.examType,
    collegeName: (params.collegeName || 'NGM DEGREE COLLEGE, BHELAHI').trim(),
    fullMarks: fm,
    rows: sortedRows,
    summary,
  };
}

// ==================== ADMIN-ONLY FULL MARKS (FM) PREFERENCES API ====================

function getAdminHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_session_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPracticalMarksFmConfigs(): Promise<PracticalMarksFmConfig[]> {
  const res = await fetch('/api/admin/practical-marks-fm-configs', {
    method: 'GET',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to load saved Full Marks preferences.');
  }
  return Array.isArray(data.configs) ? data.configs : [];
}

export async function createPracticalMarksFmConfig(payload: {
  label: string;
  fullMarks: number;
  session?: string;
  semester?: string;
  category?: SubjectType | 'ALL';
  isDefault?: boolean;
  notes?: string;
}): Promise<PracticalMarksFmConfig> {
  const res = await fetch('/api/admin/practical-marks-fm-configs', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to save Full Marks preference.');
  }
  return data.config;
}

export async function updatePracticalMarksFmConfig(
  id: string,
  payload: Partial<{
    label: string;
    fullMarks: number;
    session?: string;
    semester?: string;
    category?: SubjectType | 'ALL';
    isDefault?: boolean;
    notes?: string;
  }>
): Promise<PracticalMarksFmConfig> {
  const res = await fetch(`/api/admin/practical-marks-fm-configs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to update Full Marks preference.');
  }
  return data.config;
}

export async function deletePracticalMarksFmConfig(id: string): Promise<void> {
  const res = await fetch(`/api/admin/practical-marks-fm-configs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'Failed to delete Full Marks preference.');
  }
}
