import {
  NepCategoryKey,
  NepCategoryRule,
  PublicNepSelectionFormPayload,
  SubjectUpdateAssignmentTargetType,
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateDepartment,
  SubjectUpdateItem,
  SubjectUpdateNepConfig,
  SubjectUpdateNepStudentSelection,
  SubjectUpdateSelectionForm,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateStaff,
  SubjectUpdateStaffAssignment,
  SubjectUpdateStudent,
  SubjectUpdateStudentGroup,
  SubjectUpdateSystemSettings,
  SubjectUpdateSystemState,
  SubjectUpdateWorkAllocation,
  SubjectUpdateWorkPriority,
  SubjectUpdateWorkStatus,
} from '../types';

function getAdminAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_session_token') || '';
  if (!token) {
    throw new Error('Administrator session expired. Please sign in again.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleApiResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || fallbackError);
  }
  return data as T;
}

export async function fetchSubjectUpdateSystemState(): Promise<SubjectUpdateSystemState> {
  const res = await fetch('/api/admin/subject-update-system/state', {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });
  const data = await handleApiResponse<{ success: boolean; state: SubjectUpdateSystemState }>(
    res,
    'Failed to load Subject Update System data.'
  );
  return data.state;
}

export interface SubjectPayload {
  subjectCode: string;
  subjectName: string;
  category: string;
  session: string;
  semester: string;
  departmentName?: string;
  paperTitle?: string;
  subjectInfo?: string;
  isActive?: boolean;
}

export async function createSubjectUpdateItem(payload: SubjectPayload): Promise<SubjectUpdateItem> {
  const res = await fetch('/api/admin/subject-update-system/subjects', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; subject: SubjectUpdateItem }>(
    res,
    'Failed to add subject.'
  );
  return data.subject;
}

export async function updateSubjectUpdateItem(
  id: string,
  payload: Partial<SubjectPayload>
): Promise<SubjectUpdateItem> {
  const res = await fetch(`/api/admin/subject-update-system/subjects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; subject: SubjectUpdateItem }>(
    res,
    'Failed to update subject.'
  );
  return data.subject;
}

export async function deleteSubjectUpdateItem(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/subjects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete subject.');
}

export async function importSubjectUpdateBatch(
  rows: SubjectPayload[],
  duplicateStrategy: 'skip' | 'update' = 'skip'
): Promise<{ createdCount: number; updatedCount: number; skippedCount: number; errors: string[] }> {
  const res = await fetch('/api/admin/subject-update-system/subjects/import', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ rows, duplicateStrategy }),
  });
  return handleApiResponse<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  }>(res, 'Failed to import subjects.');
}

// Sessions
export async function createSubjectUpdateSession(payload: {
  sessionName: string;
  isActive?: boolean;
}): Promise<SubjectUpdateSession> {
  const res = await fetch('/api/admin/subject-update-system/sessions', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; session: SubjectUpdateSession }>(
    res,
    'Failed to create session.'
  );
  return data.session;
}

export async function updateSubjectUpdateSession(
  id: string,
  payload: { sessionName?: string; isActive?: boolean }
): Promise<SubjectUpdateSession> {
  const res = await fetch(`/api/admin/subject-update-system/sessions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; session: SubjectUpdateSession }>(
    res,
    'Failed to update session.'
  );
  return data.session;
}

export async function deleteSubjectUpdateSession(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete session.');
}

// Semesters
export async function createSubjectUpdateSemester(payload: {
  semesterName: string;
  order?: number;
  isActive?: boolean;
}): Promise<SubjectUpdateSemester> {
  const res = await fetch('/api/admin/subject-update-system/semesters', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; semester: SubjectUpdateSemester }>(
    res,
    'Failed to create semester.'
  );
  return data.semester;
}

export async function updateSubjectUpdateSemester(
  id: string,
  payload: { semesterName?: string; order?: number; isActive?: boolean }
): Promise<SubjectUpdateSemester> {
  const res = await fetch(`/api/admin/subject-update-system/semesters/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; semester: SubjectUpdateSemester }>(
    res,
    'Failed to update semester.'
  );
  return data.semester;
}

export async function deleteSubjectUpdateSemester(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/semesters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete semester.');
}

// Categories
export async function createSubjectUpdateCategory(payload: {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
}): Promise<SubjectUpdateCategory> {
  const res = await fetch('/api/admin/subject-update-system/categories', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; category: SubjectUpdateCategory }>(
    res,
    'Failed to create category.'
  );
  return data.category;
}

export async function updateSubjectUpdateCategory(
  id: string,
  payload: { code?: string; label?: string; description?: string; isActive?: boolean }
): Promise<SubjectUpdateCategory> {
  const res = await fetch(`/api/admin/subject-update-system/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; category: SubjectUpdateCategory }>(
    res,
    'Failed to update category.'
  );
  return data.category;
}

export async function deleteSubjectUpdateCategory(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete category.');
}

// Departments
export async function createSubjectUpdateDepartment(payload: {
  code: string;
  name: string;
  info?: string;
  isActive?: boolean;
}): Promise<SubjectUpdateDepartment> {
  const res = await fetch('/api/admin/subject-update-system/departments', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; department: SubjectUpdateDepartment }>(
    res,
    'Failed to create department.'
  );
  return data.department;
}

export async function updateSubjectUpdateDepartment(
  id: string,
  payload: { code?: string; name?: string; info?: string; isActive?: boolean }
): Promise<SubjectUpdateDepartment> {
  const res = await fetch(`/api/admin/subject-update-system/departments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; department: SubjectUpdateDepartment }>(
    res,
    'Failed to update department.'
  );
  return data.department;
}

export async function deleteSubjectUpdateDepartment(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete department.');
}

// Settings
export async function saveSubjectUpdateSystemSettings(
  payload: Partial<SubjectUpdateSystemSettings>
): Promise<SubjectUpdateSystemSettings> {
  const res = await fetch('/api/admin/subject-update-system/settings', {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; settings: SubjectUpdateSystemSettings }>(
    res,
    'Failed to save Subject Update settings.'
  );
  return data.settings;
}

// --- Combinations ---

export interface CombinationPayload {
  combinationCode: string;
  combinationName?: string;
  session: string;
  semester: string;
  category: string;
  subjectCount: number;
  subjectIds: string[];
  notes?: string;
  isActive?: boolean;
}

export async function createSubjectUpdateCombination(
  payload: CombinationPayload
): Promise<SubjectUpdateCombination> {
  const res = await fetch('/api/admin/subject-update-system/combinations', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; combination: SubjectUpdateCombination }>(
    res,
    'Failed to create subject combination.'
  );
  return data.combination;
}

export async function updateSubjectUpdateCombination(
  id: string,
  payload: Partial<CombinationPayload>
): Promise<SubjectUpdateCombination> {
  const res = await fetch(`/api/admin/subject-update-system/combinations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; combination: SubjectUpdateCombination }>(
    res,
    'Failed to update subject combination.'
  );
  return data.combination;
}

export async function deleteSubjectUpdateCombination(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/combinations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete subject combination.');
}

// --- Students & Excel Upload ---

export interface StudentPayload {
  sn?: string;
  applicationNo?: string;
  studentName: string;
  rollNumber: string;
  departmentName?: string;
  rawSubjectText?: string;
  session: string;
  semester: string;
  category?: string;
  matchedSubjectIds?: string[];
  combinationId?: string;
  groupId?: string;
  notes?: string;
}

export async function createSubjectUpdateStudent(
  payload: StudentPayload
): Promise<SubjectUpdateStudent> {
  const res = await fetch('/api/admin/subject-update-system/students', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; student: SubjectUpdateStudent }>(
    res,
    'Failed to add student.'
  );
  return data.student;
}

export async function updateSubjectUpdateStudent(
  id: string,
  payload: Partial<StudentPayload>
): Promise<SubjectUpdateStudent> {
  const res = await fetch(`/api/admin/subject-update-system/students/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; student: SubjectUpdateStudent }>(
    res,
    'Failed to update student.'
  );
  return data.student;
}

export async function deleteSubjectUpdateStudent(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete student.');
}

export async function uploadSubjectUpdateStudentsBatch(payload: {
  rows: Array<{
    sn?: string | number;
    applicationNo?: string;
    studentName: string;
    rollNumber?: string;
    departmentName?: string;
    rawSubjectText?: string;
  }>;
  session: string;
  semester: string;
  departmentName?: string;
  category?: string;
  duplicateStrategy: 'skip' | 'update';
}): Promise<{
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  allocatedCount: number;
  partialCount: number;
  unmatchedCount: number;
  errors: string[];
}> {
  const res = await fetch('/api/admin/subject-update-system/students/upload', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleApiResponse(res, 'Failed to upload students Excel sheet.');
}

export async function autoAllocateSubjectUpdateStudents(scope: {
  session?: string;
  semester?: string;
  category?: string;
}): Promise<{
  updatedCount: number;
  allocatedCount: number;
  partialCount: number;
  unmatchedCount: number;
}> {
  const res = await fetch('/api/admin/subject-update-system/students/auto-allocate', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(scope),
  });
  return handleApiResponse(res, 'Failed to auto-allocate students.');
}

// --- Student Groups ---

export interface GroupPayload {
  groupCode: string;
  groupName: string;
  session: string;
  semester: string;
  category: string;
  subjectId?: string;
  combinationId?: string;
  studentIds?: string[];
  capacity?: number;
  inChargeStaffId?: string;
  assignedStaffIds?: string[];
  notes?: string;
  isActive?: boolean;
}

export async function createSubjectUpdateGroup(
  payload: GroupPayload
): Promise<SubjectUpdateStudentGroup> {
  const res = await fetch('/api/admin/subject-update-system/groups', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; group: SubjectUpdateStudentGroup }>(
    res,
    'Failed to create student group.'
  );
  return data.group;
}

export async function updateSubjectUpdateGroup(
  id: string,
  payload: Partial<GroupPayload>
): Promise<SubjectUpdateStudentGroup> {
  const res = await fetch(`/api/admin/subject-update-system/groups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; group: SubjectUpdateStudentGroup }>(
    res,
    'Failed to update student group.'
  );
  return data.group;
}

export async function deleteSubjectUpdateGroup(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete student group.');
}

// --- Staff ---

export interface StaffPayload {
  staffCode: string;
  fullName: string;
  designation: string;
  departmentName?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  isActive?: boolean;
}

export async function createSubjectUpdateStaffMember(
  payload: StaffPayload
): Promise<SubjectUpdateStaff> {
  const res = await fetch('/api/admin/subject-update-system/staff', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; staffMember: SubjectUpdateStaff }>(
    res,
    'Failed to add staff profile.'
  );
  return data.staffMember;
}

export async function updateSubjectUpdateStaffMember(
  id: string,
  payload: Partial<StaffPayload>
): Promise<SubjectUpdateStaff> {
  const res = await fetch(`/api/admin/subject-update-system/staff/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; staffMember: SubjectUpdateStaff }>(
    res,
    'Failed to update staff profile.'
  );
  return data.staffMember;
}

export async function deleteSubjectUpdateStaffMember(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/staff/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete staff profile.');
}

// --- Staff Assignments ---

export interface StaffAssignmentPayload {
  session: string;
  semester: string;
  category: string;
  targetType: SubjectUpdateAssignmentTargetType;
  subjectId?: string;
  combinationId?: string;
  groupId?: string;
  staffIds: string[];
  inChargeStaffId: string;
  remarks?: string;
  isActive?: boolean;
}

export async function createSubjectUpdateStaffAssignment(
  payload: StaffAssignmentPayload
): Promise<SubjectUpdateStaffAssignment> {
  const res = await fetch('/api/admin/subject-update-system/staff-assignments', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; assignment: SubjectUpdateStaffAssignment }>(
    res,
    'Failed to create staff assignment.'
  );
  return data.assignment;
}

export async function updateSubjectUpdateStaffAssignment(
  id: string,
  payload: Partial<StaffAssignmentPayload>
): Promise<SubjectUpdateStaffAssignment> {
  const res = await fetch(`/api/admin/subject-update-system/staff-assignments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; assignment: SubjectUpdateStaffAssignment }>(
    res,
    'Failed to update staff assignment.'
  );
  return data.assignment;
}

export async function deleteSubjectUpdateStaffAssignment(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/staff-assignments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete staff assignment.');
}

// --- Work Allocations ---

export interface WorkAllocationPayload {
  title: string;
  session: string;
  semester: string;
  category: string;
  subjectId?: string;
  combinationId?: string;
  groupId?: string;
  staffIds: string[];
  inChargeStaffId: string;
  instructions: string;
  deadline: string;
  priority?: SubjectUpdateWorkPriority;
  progressStatus?: SubjectUpdateWorkStatus;
  remarks?: string;
}

export async function createSubjectUpdateWorkAllocation(
  payload: WorkAllocationPayload
): Promise<SubjectUpdateWorkAllocation> {
  const res = await fetch('/api/admin/subject-update-system/work-allocations', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; workAllocation: SubjectUpdateWorkAllocation }>(
    res,
    'Failed to create work allocation.'
  );
  return data.workAllocation;
}

export async function updateSubjectUpdateWorkAllocation(
  id: string,
  payload: Partial<WorkAllocationPayload>
): Promise<SubjectUpdateWorkAllocation> {
  const res = await fetch(`/api/admin/subject-update-system/work-allocations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; workAllocation: SubjectUpdateWorkAllocation }>(
    res,
    'Failed to update work allocation.'
  );
  return data.workAllocation;
}

export async function deleteSubjectUpdateWorkAllocation(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/work-allocations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete work allocation.');
}

// --- NEP Combinations Config ---

export interface SaveNepConfigPayload {
  session: string;
  semester: string;
  allowedMajorIds: string[];
  majorToMicMap: Record<string, string[]>;
  categoryRules: Record<NepCategoryKey, NepCategoryRule>;
}

export async function saveSubjectUpdateNepConfig(
  payload: SaveNepConfigPayload
): Promise<SubjectUpdateNepConfig> {
  const res = await fetch('/api/admin/subject-update-system/nep-configs', {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; nepConfig: SubjectUpdateNepConfig }>(
    res,
    'Failed to save NEP combination settings.'
  );
  return data.nepConfig;
}

// --- Selection Forms / Staff & Student Assignments ---

export interface SelectionFormPayload {
  title?: string;
  session: string;
  semester: string;
  departmentName: string;
  inChargeStaffId: string;
  assignedStaffIds?: string[];
  studentIds: string[];
  deadline: string;
}

export async function createSubjectUpdateSelectionForm(
  payload: SelectionFormPayload
): Promise<SubjectUpdateSelectionForm> {
  const res = await fetch('/api/admin/subject-update-system/selection-forms', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; selectionForm: SubjectUpdateSelectionForm }>(
    res,
    'Failed to create selection form assignment.'
  );
  return data.selectionForm;
}

export async function updateSubjectUpdateSelectionForm(
  id: string,
  payload: Partial<SelectionFormPayload>
): Promise<SubjectUpdateSelectionForm> {
  const res = await fetch(`/api/admin/subject-update-system/selection-forms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await handleApiResponse<{ success: boolean; selectionForm: SubjectUpdateSelectionForm }>(
    res,
    'Failed to update selection form assignment.'
  );
  return data.selectionForm;
}

export async function deleteSubjectUpdateSelectionForm(id: string): Promise<void> {
  const res = await fetch(`/api/admin/subject-update-system/selection-forms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  await handleApiResponse<{ success: boolean }>(res, 'Failed to delete selection form assignment.');
}

export async function reopenSubjectUpdateSelectionForm(
  id: string
): Promise<SubjectUpdateSelectionForm> {
  const res = await fetch(
    `/api/admin/subject-update-system/selection-forms/${encodeURIComponent(id)}/reopen`,
    {
      method: 'POST',
      headers: getAdminAuthHeaders(),
    }
  );
  const data = await handleApiResponse<{ success: boolean; selectionForm: SubjectUpdateSelectionForm }>(
    res,
    'Failed to reopen selection form.'
  );
  return data.selectionForm;
}

// --- Public Tokenized In-Charge Selection Form Calls ---

export async function fetchPublicSelectionForm(
  token: string
): Promise<PublicNepSelectionFormPayload> {
  const res = await fetch(`/api/selection-form/${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleApiResponse<{ success: boolean } & PublicNepSelectionFormPayload>(
    res,
    'Unable to load Department Subject Selection Form.'
  );
  return {
    form: data.form,
    nepConfig: data.nepConfig,
    subjectsByCategory: data.subjectsByCategory,
    students: data.students,
  };
}

export async function savePublicStudentSelection(
  token: string,
  studentId: string,
  payload: {
    majorIds?: string[];
    micIds?: string[];
    mdcIds?: string[];
    aecIds?: string[];
    secIds?: string[];
    vacIds?: string[];
  }
): Promise<{
  formSummary: PublicNepSelectionFormPayload['form'];
  studentSelection: SubjectUpdateNepStudentSelection;
}> {
  const res = await fetch(
    `/api/selection-form/${encodeURIComponent(token)}/student/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return handleApiResponse(res, 'Failed to save student subject selection.');
}

export async function submitPublicSelectionForm(
  token: string
): Promise<PublicNepSelectionFormPayload> {
  const res = await fetch(`/api/selection-form/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleApiResponse<{ success: boolean } & PublicNepSelectionFormPayload>(
    res,
    'Failed to submit selection form.'
  );
  return {
    form: data.form,
    nepConfig: data.nepConfig,
    subjectsByCategory: data.subjectsByCategory,
    students: data.students,
  };
}


