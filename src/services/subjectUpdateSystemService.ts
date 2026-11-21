import {
  SubjectUpdateCategory,
  SubjectUpdateDepartment,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateSystemSettings,
  SubjectUpdateSystemState,
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
