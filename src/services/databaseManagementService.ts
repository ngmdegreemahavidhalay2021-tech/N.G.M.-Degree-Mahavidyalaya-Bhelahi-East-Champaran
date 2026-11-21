import {
  DatabaseUsageMetrics,
  DeletionAuditLogEntry,
  DeletionExecutionResult,
  DeletionRequestPayload,
  SessionDeletionPreview,
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

export async function fetchDatabaseUsageMetrics(): Promise<DatabaseUsageMetrics> {
  const res = await fetch('/api/admin/database/usage', {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });
  const data = await handleApiResponse<{ success: boolean; usage: DatabaseUsageMetrics }>(
    res,
    'Failed to load database storage usage metrics.'
  );
  return data.usage;
}

export async function fetchSessionDeletionPreview(
  sessionName: string
): Promise<SessionDeletionPreview> {
  const encoded = encodeURIComponent(sessionName.trim());
  const res = await fetch(`/api/admin/database/session/${encoded}/preview`, {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });
  const data = await handleApiResponse<{ success: boolean; preview: SessionDeletionPreview }>(
    res,
    'Failed to calculate session record preview.'
  );
  return data.preview;
}

export async function downloadSessionBackupSnapshot(
  sessionName: string
): Promise<{ filename: string; auditLogId: string; totalRecords: number }> {
  const encoded = encodeURIComponent(sessionName.trim());
  const res = await fetch(`/api/admin/database/session/${encoded}/backup`, {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });
  const data = await handleApiResponse<{
    success: boolean;
    backup: any;
    auditLogId: string;
  }>(res, 'Failed to export session backup.');

  const counts = data.backup?.counts || {};
  const totalRecords = Object.values(counts).reduce<number>(
    (acc, val) => acc + Number(val || 0),
    0
  );

  const safeSession = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `NGM_ERP_Session_Backup_${safeSession}_${timestamp}.json`;

  const blob = new Blob([JSON.stringify(data.backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { filename, auditLogId: data.auditLogId, totalRecords };
}

export async function executePermanentDelete(
  payload: DeletionRequestPayload
): Promise<DeletionExecutionResult> {
  const res = await fetch('/api/admin/database/delete', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleApiResponse<DeletionExecutionResult>(
    res,
    'Permanent deletion request failed.'
  );
}

export async function fetchDeletionAuditLogs(): Promise<DeletionAuditLogEntry[]> {
  const res = await fetch('/api/admin/database/audit-logs', {
    method: 'GET',
    headers: getAdminAuthHeaders(),
  });
  const data = await handleApiResponse<{ success: boolean; logs: DeletionAuditLogEntry[] }>(
    res,
    'Failed to retrieve deletion audit logs.'
  );
  return data.logs || [];
}
