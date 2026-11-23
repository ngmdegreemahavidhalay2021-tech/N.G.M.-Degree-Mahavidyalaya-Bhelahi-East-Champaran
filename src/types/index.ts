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

export interface PracticalFormSubjectAssignment {
  subjectId: string;
  subjectName: string; // e.g. "GEOGRAPHY", "BOTANY", "ZOOLOGY"
  subjectCode: string; // e.g. "GEO", "BOT", "ZOO"
  departmentId?: string;
  departmentName?: string;
  studentCount?: number;
  status: 'active' | 'archived';
  addedAt: string;
}

export interface MarksUnlockHistoryEntry {
  unlockedBy: string;
  unlockedByUid?: string;
  unlockedAt: string;
  previousSubmittedAt?: string;
  previousSubmittedBy?: string;
  reason?: string;
}

export interface PracticalForm {
  id: string;
  title: string;
  session?: string; // e.g. "2025-29"
  sessionId?: string;
  semester: string; // e.g. "Semester 2"
  semesterId?: string;
  subjectType?: SubjectType; // "MJC" | "MIC" | "MDC"
  paperId?: string; // e.g. "paper_2025_29_Semester_2_MJC_MJC_5"
  paperName?: string; // e.g. "MJC-5"
  departmentId: string;
  departmentName?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string; // Primary subject name
  subjectAssignments?: PracticalFormSubjectAssignment[]; // Multiple subjects assigned to this Incharge
  inchargeName?: string; // Coordinator / Subject Incharge (e.g. "Kunal Singh")
  examinerName?: string; // Internal / External Examiner
  studentCount?: number; // Total enrolled / allotted students across active subjects
  course: string;
  section?: string;
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
  isMarksLocked?: boolean;
  marksLockStatus?: 'open' | 'locked' | 'unlocked';
  finalSubmittedAt?: string;
  finalSubmittedBy?: string;
  lastUnlockedAt?: string;
  lastUnlockedBy?: string;
  unlockHistory?: MarksUnlockHistoryEntry[];
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
  subject?: string; // Practical Subject name (e.g. "GEOGRAPHY", "BOTANY", "ZOOLOGY")
  subjectId?: string;
}

export interface MarksRecord {
  id: string;
  practicalFormId: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  subject?: string; // Practical Subject name (e.g. "GEOGRAPHY", "BOTANY", "ZOOLOGY")
  subjectId?: string;
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

export type StorageWarningLevel = 'normal' | 'warning' | 'high' | 'critical';

export interface CollectionStorageBreakdown {
  collectionName: string;
  label: string;
  documentCount: number;
  rawJsonBytes: number;
  estimatedFirestoreBytes: number;
  category: 'academic' | 'students' | 'examination' | 'logs' | 'system';
}

export interface SessionSummaryRow {
  session: string;
  studentsCount: number;
  excelUploadsCount: number;
  practicalFormsCount: number;
  marksCount: number;
  tokensCount: number;
  allocationsCount: number;
  estimatedFirestoreBytes: number;
}

export interface DatabaseUsageMetrics {
  generatedAt: string;
  projectId: string;
  firestoreDatabaseId: string;
  storageQuotaBytes: number; // Official Firestore Spark free tier: 1 GiB (1073741824 bytes)
  estimatedFirestoreBytesUsed: number;
  rawJsonBytesTotal: number;
  availableStorageBytes: number;
  usagePercentage: number;
  warningLevel: StorageWarningLevel;
  warningLabel: string;
  totals: {
    totalDocuments: number;
    totalStudents: number;
    totalPaperStudents: number;
    totalPracticalForms: number;
    totalMarksRecords: number;
    totalSessions: number;
    totalExaminerTokens: number;
    totalActivityLogs: number;
    totalDeletionAuditLogs: number;
  };
  collectionBreakdown: CollectionStorageBreakdown[];
  sessionSummaries: SessionSummaryRow[];
  telemetryHonesty: {
    estimationMethod: string;
    cloudMonitoringStatus: 'unavailable_starter_iam' | 'available';
    cloudMonitoringMessage: string;
    firebaseStorageBucket: string;
    firebaseStorageStatus: 'not_provisioned' | 'unavailable' | 'available';
    firebaseStorageBytesUsed: number;
    firebaseStorageMessage: string;
    sparkPlanQuotas: {
      storageLimit: string;
      dailyReads: string;
      dailyWrites: string;
      dailyDeletes: string;
    };
  };
}

export type SessionDeletionCategory =
  | 'students'
  | 'excel_uploads'
  | 'practical_forms'
  | 'marks_records'
  | 'form_links_tokens'
  | 'subject_allocations'
  | 'departments_subjects'
  | 'session_activity'
  | 'complete_session';

export interface SessionCategoryCount {
  category: Exclude<SessionDeletionCategory, 'complete_session'>;
  label: string;
  description: string;
  collections: string[];
  estimatedCount: number;
  estimatedBytes: number;
  actionType: 'delete' | 'revoke_and_delete';
  note?: string;
}

export interface IndividualRecordItem {
  id: string;
  collection:
    | 'students'
    | 'paperStudents'
    | 'practicalForms'
    | 'marks'
    | 'examinerAssignments'
    | 'academicPapers';
  primaryLabel: string;
  secondaryLabel: string;
  meta: string;
  session: string;
  createdAt?: string;
}

export interface SessionDeletionPreview {
  session: string;
  generatedAt: string;
  totalEstimatedRecords: number;
  totalEstimatedBytes: number;
  categories: SessionCategoryCount[];
  individualRecords: {
    students: IndividualRecordItem[];
    paperStudents: IndividualRecordItem[];
    practicalForms: IndividualRecordItem[];
    marks: IndividualRecordItem[];
    examinerAssignments: IndividualRecordItem[];
    academicPapers: IndividualRecordItem[];
  };
}

export interface DeletionRequestPayload {
  mode: 'category' | 'complete_session' | 'individual';
  session: string;
  category?: SessionDeletionCategory;
  confirmSessionText?: string;
  backupDownloaded?: boolean;
  targetCollection?:
    | 'students'
    | 'paperStudents'
    | 'practicalForms'
    | 'marks'
    | 'examinerAssignments'
    | 'academicPapers';
  targetId?: string;
}

export interface DeletionExecutionResult {
  success: boolean;
  mode: 'category' | 'complete_session' | 'individual';
  session: string;
  category: string;
  deletedCount: number;
  revokedCount: number;
  failedCount: number;
  breakdown: Record<string, number>;
  auditLogId: string;
  message: string;
  updatedUsage?: DatabaseUsageMetrics;
}

export interface DeletionAuditLogEntry {
  id: string;
  action: 'DATABASE_PERMANENT_DELETE' | 'SESSION_BACKUP_EXPORTED';
  mode: 'category' | 'complete_session' | 'individual' | 'backup';
  session: string;
  category: string;
  deletedBy: string;
  deletedByUid: string;
  deletedCount: number;
  revokedCount?: number;
  failedCount?: number;
  backupDownloaded: boolean;
  breakdown?: Record<string, number>;
  details: string;
  timestamp: string;
}

export interface SubjectUpdateItem {
  id: string;
  subjectCode: string;
  subjectName: string;
  category: string;
  session: string;
  semester: string;
  departmentName: string;
  paperTitle?: string;
  subjectInfo?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateSession {
  id: string;
  sessionName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateSemester {
  id: string;
  semesterName: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateCategory {
  id: string;
  code: string;
  label: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateDepartment {
  id: string;
  code: string;
  name: string;
  info?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateSystemSettings {
  id: 'default';
  systemTitle: string;
  institutionName: string;
  defaultSession: string;
  defaultCategory: string;
  enforceUppercaseCodes: boolean;
  preventDuplicateCodes: boolean;
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SubjectUpdateCombination {
  id: string;
  combinationCode: string;
  combinationName: string;
  session: string;
  semester: string;
  category: string;
  subjectCount: number;
  subjectIds: string[];
  subjectCodes: string[];
  subjectNames: string[];
  notes?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SubjectUpdateAllocationStatus = 'ALLOCATED' | 'PARTIAL' | 'UNMATCHED';

export interface SubjectUpdateStudent {
  id: string;
  sn: string;
  applicationNo?: string;
  studentName: string;
  rollNumber: string;
  departmentName?: string;
  rawSubjectText: string;
  session: string;
  semester: string;
  category: string;
  matchedSubjectIds: string[];
  matchedSubjectNames: string[];
  combinationId?: string;
  combinationName?: string;
  groupId?: string;
  groupName?: string;
  selectionFormId?: string;
  selectionFormName?: string;
  allocationStatus: SubjectUpdateAllocationStatus;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateStudentGroup {
  id: string;
  groupCode: string;
  groupName: string;
  session: string;
  semester: string;
  category: string;
  subjectId?: string;
  subjectLabel?: string;
  combinationId?: string;
  combinationLabel?: string;
  studentIds: string[];
  capacity?: number;
  inChargeStaffId?: string;
  inChargeStaffName?: string;
  assignedStaffIds: string[];
  assignedStaffNames: string[];
  notes?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateStaff {
  id: string;
  staffCode: string;
  fullName: string;
  designation: string;
  departmentName: string;
  email?: string;
  phone?: string;
  specialization?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SubjectUpdateAssignmentTargetType = 'SUBJECT' | 'COMBINATION' | 'GROUP';

export interface SubjectUpdateStaffAssignment {
  id: string;
  session: string;
  semester: string;
  category: string;
  targetType: SubjectUpdateAssignmentTargetType;
  subjectId?: string;
  subjectLabel?: string;
  combinationId?: string;
  combinationLabel?: string;
  groupId?: string;
  groupLabel?: string;
  staffIds: string[];
  staffNames: string[];
  inChargeStaffId: string;
  inChargeStaffName: string;
  remarks?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SubjectUpdateWorkStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
export type SubjectUpdateWorkPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export interface SubjectUpdateWorkAllocation {
  id: string;
  title: string;
  session: string;
  semester: string;
  category: string;
  subjectId?: string;
  subjectLabel?: string;
  combinationId?: string;
  combinationLabel?: string;
  groupId?: string;
  groupLabel?: string;
  staffIds: string[];
  staffNames: string[];
  inChargeStaffId: string;
  inChargeStaffName: string;
  instructions: string;
  deadline: string;
  priority: SubjectUpdateWorkPriority;
  progressStatus: SubjectUpdateWorkStatus;
  remarks?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// --- NEP Subject Combination & Student Selection System ---

export const NEP_CATEGORIES = ['MAJOR', 'MIC', 'MDC', 'AEC', 'SEC', 'VAC'] as const;
export type NepCategoryKey = (typeof NEP_CATEGORIES)[number];

export interface NepCategoryRule {
  subjectIds: string[];
  required: boolean;
  minSelect: number;
  maxSelect: number;
}

export interface SubjectUpdateNepConfig {
  id: string;
  session: string;
  semester: string;
  allowedMajorIds: string[];
  majorToMicMap: Record<string, string[]>;
  categoryRules: Record<NepCategoryKey, NepCategoryRule>;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectUpdateNepStudentSelection {
  studentId: string;
  applicationNo: string;
  rollNumber: string;
  studentName: string;
  departmentName: string;
  majorIds: string[];
  micIds: string[];
  mdcIds: string[];
  aecIds: string[];
  secIds: string[];
  vacIds: string[];
  isComplete: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export type SelectionFormStatus = 'OPEN' | 'IN_PROGRESS' | 'SUBMITTED';

export interface SubjectUpdateSelectionForm {
  id: string;
  title: string;
  session: string;
  semester: string;
  departmentName: string;
  inChargeStaffId: string;
  inChargeStaffName: string;
  assignedStaffIds: string[];
  assignedStaffNames: string[];
  studentIds: string[];
  deadline: string;
  token: string;
  status: SelectionFormStatus;
  isLocked: boolean;
  selections: Record<string, SubjectUpdateNepStudentSelection>;
  totalStudents: number;
  completedCount: number;
  pendingCount: number;
  submittedAt?: string;
  submittedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNepSelectionFormPayload {
  form: {
    id: string;
    title: string;
    institutionName: string;
    session: string;
    semester: string;
    departmentName: string;
    inChargeStaffName: string;
    deadline: string;
    status: SelectionFormStatus;
    isLocked: boolean;
    totalStudents: number;
    completedCount: number;
    pendingCount: number;
    submittedAt?: string;
  };
  nepConfig: SubjectUpdateNepConfig;
  subjectsByCategory: Record<NepCategoryKey, SubjectUpdateItem[]>;
  students: SubjectUpdateNepStudentSelection[];
}

export interface SubjectUpdateSystemState {
  subjects: SubjectUpdateItem[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  categories: SubjectUpdateCategory[];
  departments: SubjectUpdateDepartment[];
  combinations: SubjectUpdateCombination[];
  students: SubjectUpdateStudent[];
  groups: SubjectUpdateStudentGroup[];
  staff: SubjectUpdateStaff[];
  staffAssignments: SubjectUpdateStaffAssignment[];
  workAllocations: SubjectUpdateWorkAllocation[];
  nepConfigs: SubjectUpdateNepConfig[];
  selectionForms: SubjectUpdateSelectionForm[];
  settings: SubjectUpdateSystemSettings;
}

