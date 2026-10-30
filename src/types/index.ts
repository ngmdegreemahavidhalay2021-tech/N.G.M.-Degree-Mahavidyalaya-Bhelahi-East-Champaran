export type FormStatus = 'draft' | 'published' | 'closed';

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
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
  departmentId: string;
  course: string;
  semester: string;
  section?: string;
  createdAt: string;
}

export interface FormEnrollment {
  id: string;
  practicalFormId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  departmentId: string;
  course: string;
  semester: string;
  section?: string;
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
  role: 'admin';
  institutionName: string;
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

