import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileText,
  HardDrive,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  AdminProfile,
  ALL_ACADEMIC_SESSIONS,
  DatabaseUsageMetrics,
  DeletionAuditLogEntry,
  DeletionRequestPayload,
  IndividualRecordItem,
  SessionCategoryCount,
  SessionDeletionPreview,
  StorageWarningLevel,
} from '../types';
import { getAcademicSessions } from '../services/collegeService';
import {
  downloadSessionBackupSnapshot,
  executePermanentDelete,
  fetchDatabaseUsageMetrics,
  fetchDeletionAuditLogs,
  fetchSessionDeletionPreview,
} from '../services/databaseManagementService';

interface DatabaseManagementModuleProps {
  admin: AdminProfile;
  onDataChanged?: () => Promise<void> | void;
}

type ActiveTab = 'session-cleanup' | 'individual-records' | 'storage-audit';
type IndividualCollectionTab =
  | 'students'
  | 'paperStudents'
  | 'practicalForms'
  | 'marks'
  | 'examinerAssignments'
  | 'academicPapers';

interface PendingDeleteModalState {
  mode: 'category' | 'complete_session' | 'individual';
  title: string;
  description: string;
  session: string;
  category?: SessionCategoryCount['category'] | 'complete_session';
  estimatedCount: number;
  estimatedBytes?: number;
  targetCollection?: IndividualRecordItem['collection'];
  targetId?: string;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(3)} GB`;
}

function getWarningStyles(level: StorageWarningLevel) {
  switch (level) {
    case 'critical':
      return {
        badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
        bar: 'bg-rose-500',
        banner: 'bg-rose-950/40 border-rose-500/40 text-rose-200',
      };
    case 'high':
      return {
        badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
        bar: 'bg-orange-500',
        banner: 'bg-orange-950/40 border-orange-500/40 text-orange-200',
      };
    case 'warning':
      return {
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
        bar: 'bg-amber-500',
        banner: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
      };
    default:
      return {
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
        bar: 'bg-emerald-500',
        banner: 'bg-slate-900 border-slate-800 text-slate-300',
      };
  }
}

export const DatabaseManagementModule: React.FC<DatabaseManagementModuleProps> = ({
  admin,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('session-cleanup');
  const [usage, setUsage] = useState<DatabaseUsageMetrics | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('2024-28');
  const [availableSessions, setAvailableSessions] = useState<string[]>([...ALL_ACADEMIC_SESSIONS]);
  const [preview, setPreview] = useState<SessionDeletionPreview | null>(null);
  const [auditLogs, setAuditLogs] = useState<DeletionAuditLogEntry[]>([]);

  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [backupDownloadedForSession, setBackupDownloadedForSession] = useState<Record<string, boolean>>({});

  const [individualCol, setIndividualCol] = useState<IndividualCollectionTab>('students');
  const [searchQuery, setSearchQuery] = useState('');

  const [pendingDelete, setPendingDelete] = useState<PendingDeleteModalState | null>(null);
  const [confirmSessionInput, setConfirmSessionInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const loadUsageAndSessions = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const [metrics, configuredSessions] = await Promise.all([
        fetchDatabaseUsageMetrics(),
        getAcademicSessions().catch(() => []),
      ]);
      setUsage(metrics);

      const sessionSet = new Set<string>([...ALL_ACADEMIC_SESSIONS]);
      configuredSessions.forEach((s) => {
        if (s.sessionName?.trim()) sessionSet.add(s.sessionName.trim());
      });
      metrics.sessionSummaries.forEach((row) => {
        if (row.session?.trim()) sessionSet.add(row.session.trim());
      });

      const sorted = Array.from(sessionSet).sort((a, b) => a.localeCompare(b));
      setAvailableSessions(sorted);
      setSelectedSession((prev) => (sorted.includes(prev) ? prev : sorted[0] || '2024-28'));
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to load database usage metrics.',
      });
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  const loadPreview = useCallback(async (sessionName: string) => {
    if (!sessionName) return;
    setLoadingPreview(true);
    try {
      const data = await fetchSessionDeletionPreview(sessionName);
      setPreview(data);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || `Failed to inspect records for session ${sessionName}.`,
      });
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const logs = await fetchDeletionAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to load deletion audit logs.',
      });
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadUsageAndSessions();
    loadAuditLogs();
  }, [loadUsageAndSessions, loadAuditLogs]);

  useEffect(() => {
    if (selectedSession) {
      loadPreview(selectedSession);
    }
  }, [selectedSession, loadPreview]);

  const handleRefreshAll = async () => {
    setStatusMessage(null);
    await Promise.all([
      loadUsageAndSessions(),
      loadPreview(selectedSession),
      loadAuditLogs(),
    ]);
  };

  const handleDownloadBackup = async (sessionName: string) => {
    setExportingBackup(true);
    setStatusMessage(null);
    try {
      const res = await downloadSessionBackupSnapshot(sessionName);
      setBackupDownloadedForSession((prev) => ({ ...prev, [sessionName]: true }));
      setStatusMessage({
        type: 'success',
        text: `Session backup "${res.filename}" downloaded (${res.totalRecords} records preserved).`,
      });
      await loadAuditLogs();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to export session backup.',
      });
    } finally {
      setExportingBackup(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!pendingDelete) return;
    if (
      pendingDelete.mode === 'complete_session' &&
      confirmSessionInput.trim() !== pendingDelete.session.trim()
    ) {
      setStatusMessage({
        type: 'error',
        text: `Please type "${pendingDelete.session}" exactly to confirm complete session deletion.`,
      });
      return;
    }

    setDeleting(true);
    setStatusMessage(null);

    try {
      const payload: DeletionRequestPayload = {
        mode: pendingDelete.mode,
        session: pendingDelete.session,
        category: pendingDelete.category,
        confirmSessionText:
          pendingDelete.mode === 'complete_session' ? confirmSessionInput.trim() : undefined,
        backupDownloaded: Boolean(backupDownloadedForSession[pendingDelete.session]),
        targetCollection: pendingDelete.targetCollection,
        targetId: pendingDelete.targetId,
      };

      const res = await executePermanentDelete(payload);

      if (res.updatedUsage) {
        setUsage(res.updatedUsage);
      } else {
        await loadUsageAndSessions();
      }

      await Promise.all([loadPreview(pendingDelete.session), loadAuditLogs()]);
      if (onDataChanged) {
        await onDataChanged();
      }

      setStatusMessage({
        type: res.failedCount > 0 ? 'info' : 'success',
        text: res.message,
      });
      setPendingDelete(null);
      setConfirmSessionInput('');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Permanent deletion failed.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredIndividualItems = useMemo(() => {
    if (!preview) return [];
    const list = preview.individualRecords[individualCol] || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.primaryLabel.toLowerCase().includes(q) ||
        item.secondaryLabel.toLowerCase().includes(q) ||
        item.meta.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }, [preview, individualCol, searchQuery]);

  const warningStyle = getWarningStyles(usage?.warningLevel || 'normal');
  const progressBarWidth = usage
    ? Math.min(100, Math.max(usage.estimatedFirestoreBytesUsed > 0 ? 1 : 0, usage.usagePercentage))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                Database & Storage Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor live Firestore record usage, export session backups, and permanently remove unwanted academic records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 whitespace-nowrap">
            Admin: {admin.username}
          </span>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={loadingUsage || loadingPreview}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
            <span>Refresh Live Metrics</span>
          </button>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Database Usage Monitor + Warning Bar */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Live Database Storage Usage Monitor
            </h3>
          </div>
          {usage && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${warningStyle.badge}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{usage.warningLabel}</span>
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <div className="text-slate-300">
              <span className="font-semibold">Estimated Firestore Record Storage Used: </span>
              <span className="font-mono tabular-nums font-bold text-slate-100">
                {usage ? formatBytes(usage.estimatedFirestoreBytesUsed) : 'Calculating...'}
              </span>
              {usage && (
                <span className="text-slate-400 font-mono tabular-nums ml-2">
                  (Raw JSON: {formatBytes(usage.rawJsonBytesTotal)})
                </span>
              )}
            </div>
            <div className="font-mono tabular-nums text-slate-300">
              <span className="font-bold text-white">
                {usage ? `${usage.usagePercentage.toFixed(4)}%` : '--'}
              </span>
              <span className="text-slate-400 ml-2">
                of {usage ? formatBytes(usage.storageQuotaBytes) : '1.000 GB'} Spark Plan Quota
              </span>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${warningStyle.bar}`}
              style={{ width: `${progressBarWidth}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
            <span>
              Available Quota Remaining:{' '}
              <strong className="text-slate-200">
                {usage ? formatBytes(usage.availableStorageBytes) : '--'}
              </strong>
            </span>
            <span>
              Total Firestore Documents:{' '}
              <strong className="text-slate-200">
                {usage ? usage.totals.totalDocuments.toLocaleString() : '--'}
              </strong>
            </span>
          </div>
        </div>

        {/* 4 Primary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Students
            </span>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {usage ? usage.totals.totalStudents.toLocaleString() : '--'}
            </p>
            <span className="text-[11px] text-slate-500 font-mono">
              Master + {usage?.totals.totalPaperStudents ?? 0} Excel rows
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Practical Forms
            </span>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {usage ? usage.totals.totalPracticalForms.toLocaleString() : '--'}
            </p>
            <span className="text-[11px] text-slate-500 font-mono">
              {usage?.totals.totalExaminerTokens ?? 0} examiner tokens
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Marks Records
            </span>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {usage ? usage.totals.totalMarksRecords.toLocaleString() : '--'}
            </p>
            <span className="text-[11px] text-slate-500 font-mono">
              Evaluated & pending marks
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Sessions
            </span>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
              {usage ? usage.totals.totalSessions.toLocaleString() : '--'}
            </p>
            <span className="text-[11px] text-slate-500 font-mono">
              {usage?.totals.totalDeletionAuditLogs ?? 0} audit entries
            </span>
          </div>
        </div>

        {/* Honest Telemetry & Plan Quotas Strip */}
        {usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Estimated Record Storage</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {usage.telemetryHonesty.estimationMethod}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Cloud Monitoring & File Storage</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {usage.telemetryHonesty.cloudMonitoringMessage}{' '}
                {usage.telemetryHonesty.firebaseStorageMessage}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Official Firestore Spark Quotas</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                Storage: {usage.telemetryHonesty.sparkPlanQuotas.storageLimit}
                <br />
                Reads: {usage.telemetryHonesty.sparkPlanQuotas.dailyReads} • Writes:{' '}
                {usage.telemetryHonesty.sparkPlanQuotas.dailyWrites} • Deletes:{' '}
                {usage.telemetryHonesty.sparkPlanQuotas.dailyDeletes}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('session-cleanup')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'session-cleanup'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Session-Wise Delete & Backup</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('individual-records')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'individual-records'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Individual Record Inspector</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('storage-audit')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'storage-audit'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Collection Breakdown & Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* Session Selector Bar (shared by Tab 1 & Tab 2) */}
      {(activeTab === 'session-cleanup' || activeTab === 'individual-records') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="db-session-selector"
              className="text-xs font-bold uppercase tracking-wider text-slate-300"
            >
              Target Academic Session:
            </label>
            <select
              id="db-session-selector"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
            >
              {availableSessions.map((sess) => (
                <option key={sess} value={sess}>
                  {sess}
                </option>
              ))}
            </select>
            {preview && (
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {preview.totalEstimatedRecords.toLocaleString()} scoped doc(s) •{' '}
                {formatBytes(preview.totalEstimatedBytes)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadBackup(selectedSession)}
              disabled={exportingBackup || loadingPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {exportingBackup ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {backupDownloadedForSession[selectedSession]
                  ? `Backup Saved (${selectedSession})`
                  : `Export Session Backup (${selectedSession})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: SESSION-WISE DELETE MANAGEMENT */}
      {activeTab === 'session-cleanup' && (
        <div className="space-y-5">
          {loadingPreview && !preview ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 flex items-center justify-center gap-2.5 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Scanning Firestore collections for session {selectedSession}...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(preview?.categories || []).map((cat) => (
                  <div
                    key={cat.category}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-bold text-slate-100">{cat.label}</h4>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-slate-200 whitespace-nowrap shrink-0">
                          {cat.estimatedCount.toLocaleString()} records
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{cat.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500">
                        <span>Collections: {cat.collections.join(', ')}</span>
                        <span>•</span>
                        <span>{formatBytes(cat.estimatedBytes)}</span>
                      </div>
                      {cat.note && (
                        <p className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                          {cat.note}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-800/70">
                      <button
                        type="button"
                        disabled={cat.estimatedCount === 0 || deleting}
                        onClick={() => {
                          setConfirmSessionInput('');
                          setPendingDelete({
                            mode: 'category',
                            title: `Delete ${cat.label}`,
                            description: `This will permanently remove all ${cat.label.toLowerCase()} strictly belonging to session ${selectedSession}. Records in other sessions will not be touched.`,
                            session: selectedSession,
                            category: cat.category,
                            estimatedCount: cat.estimatedCount,
                            estimatedBytes: cat.estimatedBytes,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {cat.actionType === 'revoke_and_delete'
                            ? 'Delete & Revoke Links'
                            : 'Delete Permanently'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Complete Session Danger Zone */}
              <div className="bg-rose-950/25 border border-rose-500/40 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-300">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <h4 className="text-sm font-bold uppercase tracking-wide">
                      Complete Academic Session Cleanup
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    Permanently delete all students, Excel rosters, practical forms, marks evaluations,
                    examiner links/tokens, subject paper allocations, and session activity records for{' '}
                    <strong className="text-white">{selectedSession}</strong>. Other sessions, admin accounts,
                    shared masters, and deletion audit logs remain intact.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!preview || preview.totalEstimatedRecords === 0 || deleting}
                  onClick={() => {
                    setConfirmSessionInput('');
                    setPendingDelete({
                      mode: 'complete_session',
                      title: 'DELETE COMPLETE SESSION DATA',
                      description: `You are about to permanently erase every record belonging to academic session ${selectedSession}. This action cannot be undone once confirmed.`,
                      session: selectedSession,
                      category: 'complete_session',
                      estimatedCount: preview?.totalEstimatedRecords || 0,
                      estimatedBytes: preview?.totalEstimatedBytes || 0,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    DELETE COMPLETE SESSION DATA ({preview?.totalEstimatedRecords ?? 0})
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: INDIVIDUAL RECORD INSPECTOR */}
      {activeTab === 'individual-records' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['students', 'Master Students'],
                  ['paperStudents', 'Excel Rosters'],
                  ['practicalForms', 'Practical Forms'],
                  ['marks', 'Marks Records'],
                  ['examinerAssignments', 'Examiner Tokens'],
                  ['academicPapers', 'Subject Allocations'],
                ] as Array<[IndividualCollectionTab, string]>
              ).map(([colKey, label]) => {
                const count = preview?.individualRecords[colKey]?.length ?? 0;
                return (
                  <button
                    key={colKey}
                    type="button"
                    onClick={() => setIndividualCol(colKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                      individualCol === colKey
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roll no, name, ID..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3 font-semibold">Record</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold">Metadata / ID</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {loadingPreview ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Loading session records...
                    </td>
                  </tr>
                ) : filteredIndividualItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No matching records found in session {selectedSession}.
                    </td>
                  </tr>
                ) : (
                  filteredIndividualItems.slice(0, 150).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-semibold text-slate-100">
                        {item.primaryLabel}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{item.secondaryLabel}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                        <div>{item.meta}</div>
                        <div className="text-slate-500 truncate max-w-xs" title={item.id}>
                          ID: {item.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => {
                            setConfirmSessionInput('');
                            setPendingDelete({
                              mode: 'individual',
                              title: `Delete Individual Record (${item.collection})`,
                              description: `Permanently delete "${item.primaryLabel}" (${item.id}) from ${item.collection}.`,
                              session: item.session,
                              estimatedCount: 1,
                              targetCollection: item.collection,
                              targetId: item.id,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredIndividualItems.length > 150 && (
            <p className="text-[11px] text-slate-400 font-mono">
              Showing first 150 of {filteredIndividualItems.length} matching records. Use search to narrow down.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: COLLECTION BREAKDOWN & IMMUTABLE AUDIT LOGS */}
      {activeTab === 'storage-audit' && (
        <div className="space-y-6">
          {/* Collection Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Firestore Collection Size Breakdown
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                18 Collections Inspected Live
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3 font-semibold">Collection</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold text-right">Documents</th>
                    <th className="px-4 py-3 font-semibold text-right">Raw JSON Bytes</th>
                    <th className="px-4 py-3 font-semibold text-right">Est. Firestore Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {(usage?.collectionBreakdown || []).map((col) => (
                    <tr key={col.collectionName} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-100">{col.label}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          /{col.collectionName}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 uppercase font-mono text-[11px] text-slate-400">
                        {col.category}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-200">
                        {col.documentCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">
                        {formatBytes(col.rawJsonBytes)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-100">
                        {formatBytes(col.estimatedFirestoreBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deletion Audit Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Immutable Deletion & Backup Audit Logs
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Preserved permanently across session cleanups
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Admin</th>
                    <th className="px-4 py-3 font-semibold">Session & Category</th>
                    <th className="px-4 py-3 font-semibold text-right">Deleted</th>
                    <th className="px-4 py-3 font-semibold">Backup</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Loading deletion audit logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No deletion or backup audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-200 whitespace-nowrap">
                          {log.deletedBy}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-blue-300 font-semibold">
                            {log.session}
                          </span>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {log.mode} • {log.category}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-slate-100">
                          {log.deletedCount}
                          {log.revokedCount ? ` (+${log.revokedCount} revoked)` : ''}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {log.backupDownloaded ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-md">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-modal-title"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="confirm-delete-modal-title" className="text-base font-bold text-white">
                    {pendingDelete.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Permanent Firestore Deletion Confirmation
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-40"
                aria-label="Close confirmation dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Selected Session:</span>
                <span className="font-mono font-bold text-white">{pendingDelete.session}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category / Target:</span>
                <span className="font-mono text-rose-300">
                  {pendingDelete.category || pendingDelete.targetCollection}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Records to Delete:</span>
                <span className="font-mono font-bold text-amber-300">
                  {pendingDelete.estimatedCount.toLocaleString()} record(s)
                  {pendingDelete.estimatedBytes
                    ? ` (${formatBytes(pendingDelete.estimatedBytes)})`
                    : ''}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{pendingDelete.description}</p>

            {/* Optional Pre-Delete Backup Trigger */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                <span className="font-semibold block text-slate-100">
                  Optional Safety Backup
                </span>
                <span className="text-[11px] text-slate-400">
                  {backupDownloadedForSession[pendingDelete.session]
                    ? `JSON backup exported for ${pendingDelete.session}.`
                    : `Download a JSON snapshot of ${pendingDelete.session} before deleting.`}
                </span>
              </div>
              <button
                type="button"
                disabled={exportingBackup || deleting}
                onClick={() => handleDownloadBackup(pendingDelete.session)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Backup</span>
              </button>
            </div>

            {/* Typed Session Verification for Complete Session Deletion */}
            {pendingDelete.mode === 'complete_session' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-rose-200">
                  Type exact session name <code className="font-mono text-white">{pendingDelete.session}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmSessionInput}
                  onChange={(e) => setConfirmSessionInput(e.target.value)}
                  placeholder={pendingDelete.session}
                  disabled={deleting}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/50 text-sm font-mono text-white focus:outline-none focus:border-rose-400"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleting ||
                  (pendingDelete.mode === 'complete_session' &&
                    confirmSessionInput.trim() !== pendingDelete.session.trim())
                }
                onClick={handleConfirmPermanentDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Permanently...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Permanent Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
