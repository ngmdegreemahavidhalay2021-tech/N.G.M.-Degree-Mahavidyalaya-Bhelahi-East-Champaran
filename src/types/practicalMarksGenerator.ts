import { SubjectType } from './index';

export type PracticalCategoryDisplay = 'MAJOR' | 'MINOR' | 'MDC';

export interface PracticalMarksFmConfig {
  id: string;
  label: string;
  fullMarks: number;
  session?: string;
  semester?: string;
  category?: SubjectType | 'ALL';
  isDefault?: boolean;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PracticalExamTypeOption {
  examType: string;
  sourceFormIds: string[];
  sourceAssignmentIds: string[];
  categories: SubjectType[];
  totalEnrolled: number;
  actualMarksCount: number;
}

export interface PracticalMarksDepartmentOption {
  departmentId: string;
  departmentName: string;
  studentCount: number;
  actualMarksCount: number;
}

export interface PracticalMarksSubjectOption {
  subject: string;
  departmentIds: string[];
  departmentNames: string[];
  papers: string[];
  totalStudents: number;
  actualMarksCount: number;
}

export type PracticalMarkRowStatus = 'PRESENT' | 'ABSENT' | 'MISSING';

export interface PracticalStudentMarkRow {
  rowKey: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  subject: string;
  category: SubjectType;
  departmentId: string;
  departmentName: string;
  paperName: string;
  session: string;
  semester: string;
  examType: string;
  formId?: string;
  formTitle?: string;
  assignmentId?: string;
  rawMarksObtained: number | null;
  rawMarkInput: unknown;
  isPresent: boolean;
  status: PracticalMarkRowStatus;
  displayMarks: string;
  exceedsFm: boolean;
  isNegative: boolean;
  isInvalid: boolean;
  validationIssue?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PracticalCategoryValidationSummary {
  category: SubjectType;
  categoryDisplay: PracticalCategoryDisplay;
  fullMarks: number;
  totalStudents: number;
  marksAvailable: number;
  presentMarksCount: number;
  absentCount: number;
  missingMarksCount: number;
  exceedsFmStudents: PracticalStudentMarkRow[];
  invalidMarksStudents: PracticalStudentMarkRow[];
  missingStudents: PracticalStudentMarkRow[];
  hasBlockingErrors: boolean;
}

export interface PracticalCategorySheetPayload {
  category: SubjectType;
  categoryDisplay: PracticalCategoryDisplay;
  session: string;
  semester: string;
  examType: string;
  collegeName: string;
  fullMarks: number;
  rows: PracticalStudentMarkRow[];
  summary: PracticalCategoryValidationSummary;
}
