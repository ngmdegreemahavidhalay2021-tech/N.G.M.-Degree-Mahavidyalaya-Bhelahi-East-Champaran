export type FormStatus = 'draft' | 'published' | 'closed';

export const ALL_ACADEMIC_SESSIONS = ['2023-27', '2024-28', '2025-29', '2026-30'] as const;
export const ALL_SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
] as const;
export const SUBJECT_TYPES = ['MJC', 'MIC', 'MDC'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const INITIAL_PRACTICAL_SUBJECTS = [
  'BOTANY',
  'CHEMISTRY',
  'PHYSICS',
  'ZOOLOGY',
  'GEOGRAPHY',
  'PSYCHOLOGY',
  'HOME SCIENCE',
] as const;

export interface AcademicSession {
  id: string;
  sessionName: string; // e.g. "2023-27", "2024-28", "2025-29", "2026-30"
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicSemester {
  id: string; // e.g. "sem_1", "sem_2", ...
  semesterName: string; // "Semester 1", "Semester 2", ...
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicPaper {
  id: string; // unique composite key: paper_${cleanSession}_${cleanSem}_${subjectType}_${cleanPaperName}
  session: string; // "2023-27", "2024-28", "2025-29", "2026-30"
  semester: string; // "Semester 1", "Semester 2", ...
  subjectType: SubjectType; // "MJC", "MIC", "MDC"
  paperName: string; // Manually entered, e.g. "MJC 1", "MJC 2", "MIC 1", "MDC 1"
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticalSubject {
  id: string; // psubj_botany, etc.
  name: string; // "BOTANY", "CHEMISTRY", "PHYSICS", etc.
  code?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PaperStudent {
  id: string; // Permanent unique composite ID: std_${cleanSession}_${cleanSem}_${subjectType}_${cleanPaper}_${cleanRoll}
  paperId: string;
  session: string;
  semester: string;
  subjectType: SubjectType;
  paperName: string;
  rollNumber: string;
  studentName: string;
  subject: string; // Normalized uppercase Practical Subject (e.g. "BOTANY")
  fatherName?: string;
  section?: string;
  serialNo?: number | string;
  status: 'active' | 'removed';
  createdAt: string;
}

export type AssignmentStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Draft Saved'
  | 'Pending Entries'
  | 'Ready to Submit'
  | 'Final Submitted';

export interface ExaminerAssignment {
  id: string;
  session: string;
  semester: string;
  subjectType: SubjectType;
  paperId: string;
  paperName: string;
  subjectName: string; // e.g. "BOTANY"
  parentGroupId?: string;
  parentGroupName?: string;
  inchargeName: string;
  examinerName: string;
  maxMarks: number;
  minMarks: number;
  allowDecimals: boolean;
  token: string;
  status: AssignmentStatus;
  isLocked: boolean;
  submittedAt?: string;
  submittedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  totalStudents: number;
  evaluatedCount: number;
  absentCount: number;
  pendingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentMarkRecord {
  id: string; // mark_${assignmentId}_${studentId}
  assignmentId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  subject: string;
  marksObtained: number | null;
  isPresent: boolean;
  resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';
  remarks?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  coordinator?: string; // Head/Faculty coordinator in charge (e.g. "Prof. Sharma (Managing History & AIH&C)")
  isGroup?: boolean; // Whether designated as a Parent Department / Department Group
  createdAt: string;
}

export interface Subject {
  id: string;
  departmentId: string;
  code: string;
  name: string;
  course: string;
  semester: string;
  section?: string;
  createdAt: string;
}

export interface PracticalForm {
  id: string;
  title: string;
  departmentId: string;
  course: string;
  semester: string;
  section?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  examName: string;
  examYear: string;
  maxMarks: number;
  minPassingMarks: number; // Minimum Passing Marks (e.g. 33)
  instructions?: string;
  examDate: string;
  allowDecimals: boolean;
  token: string;
  status: FormStatus;
  isActive: boolean;
  isStudentListLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string; // Permanent studentId
  rollNumber: string;
  studentName: string;
  fatherName?: string;
  departmentId: string;
  course: string;
  semester: string;
  section?: string;
  academicSession?: string;
  createdAt: string;
}

export interface FormEnrollment {
  id: string;
  practicalFormId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  fatherName?: string;
  departmentId: string;
  course: string;
  semester: string;
  section?: string;
  academicSession?: string;
  status: 'enrolled' | 'verified' | 'removed';
  enrolledAt: string;
}

export interface MarksRecord {
  id: string;
  practicalFormId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  marksObtained: number | null;
  isPresent: boolean;
  remarks?: string;
  resultStatus?: 'PASS' | 'FAIL' | 'PENDING' | 'ABSENT';
  updatedAt: string;
  updatedBy: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface AdminProfile {
  uid: string;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  designation?: string;
  photoUrl?: string;
  role: 'admin';
  institutionName: string;
  updatedAt?: string;
}

export type AppearanceMode = 'light' | 'dark' | 'system';
export type AppearanceFont =
  | 'Inter'
  | 'Roboto'
  | 'Poppins'
  | 'Open Sans'
  | 'Lato'
  | 'Arial'
  | 'System Default';
export type AppearanceTheme =
  | 'blue'
  | 'indigo'
  | 'green'
  | 'purple'
  | 'teal'
  | 'slate'
  | 'rose';

export interface AppearanceSettings {
  appearanceMode: AppearanceMode;
  selectedFont: AppearanceFont;
  selectedTheme: AppearanceTheme;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SystemBootstrapStatus {
  isBootstrapped: boolean;
  institutionName: string;
  adminUsername: string | null;
  bootstrappedAt?: string | null;
}

export interface CollegeStats {
  totalDepartments: number;
  totalSubjects: number;
  totalPracticalForms: number;
  totalStudents: number;
  totalMarksSubmitted: number;
  pendingMarksEntries: number;
  activeFormLinks: number;
  closedForms: number;
}

export interface RubricCriterion {
  id: string;
  name: string;
  maxMarks: number;
  description?: string;
}

export type ExamStatus = 'draft' | 'open' | 'submitted' | 'locked';

export interface PracticalExam {
  id: string;
  title: string;
  course: string;
  semester: string;
  subjectCode: string;
  academicYear: string;
  examDate: string;
  venue: string;
  maxMarks: number;
  passingMarks: number;
  rubricCriteria: RubricCriterion[];
  status: ExamStatus;
  accessKey: string;
  externalExaminerName: string;
  internalExaminerName: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type StudentAttendance = 'present' | 'absent';
export type StudentResultStatus = 'pass' | 'fail' | 'absent' | 'pending';

export interface ExamStudent {
  id: string;
  examId: string;
  rollNo: string;
  regNo?: string;
  studentName: string;
  batch?: string;
  attendance: StudentAttendance;
  criteriaMarks: Record<string, number>;
  totalMarks: number;
  percentage: number;
  status: StudentResultStatus;
  remarks?: string;
  enteredAt?: string;
  enteredBy?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

