import crypto from 'node:crypto';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  where,
  type DocumentReference,
} from 'firebase/firestore';
import { firebaseConfig, getDb } from './firestoreServer.ts';
import type {
  CollectionStorageBreakdown,
  DatabaseUsageMetrics,
  DeletionAuditLogEntry,
  DeletionExecutionResult,
  DeletionRequestPayload,
  IndividualRecordItem,
  SessionCategoryCount,
  SessionDeletionCategory,
  SessionDeletionPreview,
  SessionSummaryRow,
  StorageWarningLevel,
} from '../src/types/index.ts';

const SPARK_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GiB (1,073,741,824 bytes)
const DEFAULT_SESSIONS = ['2023-27', '2024-28', '2025-29', '2026-30'];
const BATCH_CHUNK_SIZE = 350; // Safe margin under Firestore's 500-op batch ceiling

const COLLECTION_META: Array<{
  name: string;
  label: string;
  category: CollectionStorageBreakdown['category'];
}> = [
  { name: 'students', label: 'Master Student Directory', category: 'students' },
  { name: 'paperStudents', label: 'Student Excel Upload Records', category: 'students' },
  { name: 'formEnrollments', label: 'Form Enrollment Snapshots', category: 'students' },
  { name: 'practicalForms', label: 'Practical Examination Forms', category: 'examination' },
  { name: 'marks', label: 'Marks Evaluation Records', category: 'examination' },
  { name: 'examinerAssignments', label: 'Examiner Assignments & Tokens', category: 'examination' },
  { name: 'academicPapers', label: 'Subject & Paper Allocations', category: 'academic' },
  { name: 'memoSheetConfigs', label: 'Memo Sheet Configurations', category: 'academic' },
  { name: 'practical_exams', label: 'Rubric Practical Exams', category: 'examination' },
  { name: 'academicSessions', label: 'Academic Sessions', category: 'academic' },
  { name: 'academicSemesters', label: 'Academic Semesters', category: 'academic' },
  { name: 'departments', label: 'Departments', category: 'academic' },
  { name: 'subjects', label: 'Subjects Directory', category: 'academic' },
  { name: 'practicalSubjects', label: 'Practical Subjects Master', category: 'academic' },
  { name: 'activityLogs', label: 'System Activity Logs', category: 'logs' },
  { name: 'deletionAuditLogs', label: 'Deletion Audit Logs (Protected)', category: 'logs' },
  { name: 'admins', label: 'Administrator Accounts (Protected)', category: 'system' },
  { name: 'systemSettings', label: 'System Settings (Protected)', category: 'system' },
];

interface RawDocRecord {
  id: string;
  collectionName: string;
  data: Record<string, any>;
  rawJsonBytes: number;
  estimatedFirestoreBytes: number;
}

function normStr(value: unknown): string {
  return String(value ?? '').trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detailsMentionExactSession(details: unknown, sessionName: string): boolean {
  const text = normStr(details);
  const target = normStr(sessionName);
  if (!text || !target) return false;
  const regex = new RegExp(`(^|[^a-zA-Z0-9_-])${escapeRegExp(target)}([^a-zA-Z0-9_-]|$)`);
  return regex.test(text);
}

/**
 * Computes Firestore-aligned document storage size in bytes based on Google's documented
 * formula: 32-byte record overhead + document path name bytes + field names & typed values.
 */
function estimateFirestoreValueBytes(value: unknown): number {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return 1;
  }
  if (typeof value === 'number') {
    return 8;
  }
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8') + 1;
  }
  if (Array.isArray(value)) {
    let total = 0;
    for (const item of value) {
      total += estimateFirestoreValueBytes(item);
    }
    return total;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    let total = 0;
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      total += Buffer.byteLength(k, 'utf8') + 1 + estimateFirestoreValueBytes(v);
    }
    return total;
  }
  return 8;
}

export function estimateFirestoreDocBytes(
  collectionPath: string,
  docId: string,
  data: Record<string, any>
): number {
  const pathBytes =
    collectionPath
      .split('/')
      .filter(Boolean)
      .reduce((sum, seg) => sum + Buffer.byteLength(seg, 'utf8') + 1, 0) +
    Buffer.byteLength(docId, 'utf8') +
    1 +
    16;
  const fieldBytes = estimateFirestoreValueBytes(data);
  return 32 + pathBytes + fieldBytes;
}

function estimateRawJsonBytes(docId: string, data: Record<string, any>): number {
  try {
    return Buffer.byteLength(JSON.stringify({ id: docId, ...data }), 'utf8');
  } catch {
    return 0;
  }
}

async function readCollectionDocs(
  db: ReturnType<typeof getDb>,
  collectionName: string
): Promise<RawDocRecord[]> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, any>;
      return {
        id: d.id,
        collectionName,
        data,
        rawJsonBytes: estimateRawJsonBytes(d.id, data),
        estimatedFirestoreBytes: estimateFirestoreDocBytes(collectionName, d.id, data),
      };
    });
  } catch (err) {
    console.warn(`[DBMgmt] Could not read collection ${collectionName}:`, (err as Error).message);
    return [];
  }
}

async function loadAllCollectionsSnapshot(db: ReturnType<typeof getDb>) {
  const entries = await Promise.all(
    COLLECTION_META.map(async (meta) => {
      const docs = await readCollectionDocs(db, meta.name);
      return [meta.name, docs] as const;
    })
  );

  const byCollection: Record<string, RawDocRecord[]> = {};
  for (const [name, docs] of entries) {
    byCollection[name] = docs;
  }

  // Also check nested students subcollection under practical_exams
  const practicalExams = byCollection['practical_exams'] || [];
  const practicalExamStudents: RawDocRecord[] = [];
  for (const examDoc of practicalExams) {
    try {
      const subSnap = await getDocs(collection(db, 'practical_exams', examDoc.id, 'students'));
      for (const sd of subSnap.docs) {
        const data = sd.data() as Record<string, any>;
        const subPath = `practical_exams/${examDoc.id}/students`;
        practicalExamStudents.push({
          id: sd.id,
          collectionName: subPath,
          data: { ...data, __examId: examDoc.id },
          rawJsonBytes: estimateRawJsonBytes(sd.id, data),
          estimatedFirestoreBytes: estimateFirestoreDocBytes(subPath, sd.id, data),
        });
      }
    } catch {
      // Ignore if subcollection doesn't exist
    }
  }

  return { byCollection, practicalExamStudents };
}

function getWarningTier(usagePercentage: number): {
  level: StorageWarningLevel;
  label: string;
} {
  if (usagePercentage >= 95) {
    return { level: 'critical', label: 'Critical Storage Usage (>=95%)' };
  }
  if (usagePercentage >= 85) {
    return { level: 'high', label: 'High Storage Usage (85%–94%)' };
  }
  if (usagePercentage >= 70) {
    return { level: 'warning', label: 'Storage Usage Warning (70%–84%)' };
  }
  return { level: 'normal', label: 'Normal (<70%)' };
}

function discoverAllSessionNames(byCollection: Record<string, RawDocRecord[]>): string[] {
  const sessionSet = new Set<string>(DEFAULT_SESSIONS);

  for (const d of byCollection['academicSessions'] || []) {
    const s = normStr(d.data.sessionName);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['students'] || []) {
    const s = normStr(d.data.academicSession);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['paperStudents'] || []) {
    const s = normStr(d.data.session);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['academicPapers'] || []) {
    const s = normStr(d.data.session);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['examinerAssignments'] || []) {
    const s = normStr(d.data.session);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['practicalForms'] || []) {
    const s = normStr(d.data.session);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['memoSheetConfigs'] || []) {
    const s = normStr(d.data.session);
    if (s) sessionSet.add(s);
  }
  for (const d of byCollection['practical_exams'] || []) {
    const s = normStr(d.data.academicYear);
    if (s) sessionSet.add(s);
  }

  return Array.from(sessionSet).sort((a, b) => a.localeCompare(b));
}

interface ResolvedSessionData {
  session: string;
  students: RawDocRecord[];
  paperStudents: RawDocRecord[];
  academicPapers: RawDocRecord[];
  practicalForms: RawDocRecord[];
  formEnrollmentsByForm: RawDocRecord[];
  formEnrollmentsByStudent: RawDocRecord[];
  formEnrollmentsAll: RawDocRecord[];
  marks: RawDocRecord[];
  examinerAssignments: RawDocRecord[];
  activeFormTokensToRevoke: RawDocRecord[];
  memoSheetConfigs: RawDocRecord[];
  practicalExams: RawDocRecord[];
  practicalExamStudents: RawDocRecord[];
  exclusiveSubjects: RawDocRecord[];
  sessionActivityLogs: RawDocRecord[];
}

function resolveSessionDataFromSnapshot(
  sessionName: string,
  byCollection: Record<string, RawDocRecord[]>,
  allPracticalExamStudents: RawDocRecord[]
): ResolvedSessionData {
  const target = normStr(sessionName);

  const academicPapers = (byCollection['academicPapers'] || []).filter(
    (d) => normStr(d.data.session) === target
  );
  const paperIdSet = new Set(academicPapers.map((d) => d.id));
  const otherPaperIdSet = new Set(
    (byCollection['academicPapers'] || [])
      .filter((d) => normStr(d.data.session) && normStr(d.data.session) !== target)
      .map((d) => d.id)
  );

  const students = (byCollection['students'] || []).filter(
    (d) => normStr(d.data.academicSession) === target
  );
  const studentIdSet = new Set(students.map((d) => d.id));
  const otherStudentIdSet = new Set(
    (byCollection['students'] || [])
      .filter((d) => normStr(d.data.academicSession) && normStr(d.data.academicSession) !== target)
      .map((d) => d.id)
  );

  const paperStudents = (byCollection['paperStudents'] || []).filter(
    (d) => normStr(d.data.session) === target
  );
  const paperStudentIdSet = new Set(paperStudents.map((d) => d.id));
  const otherPaperStudentIdSet = new Set(
    (byCollection['paperStudents'] || [])
      .filter((d) => normStr(d.data.session) && normStr(d.data.session) !== target)
      .map((d) => d.id)
  );

  const practicalForms: RawDocRecord[] = [];
  const otherFormIds = new Set<string>();
  for (const d of byCollection['practicalForms'] || []) {
    const explicitSession = normStr(d.data.session);
    const examYear = normStr(d.data.examYear);
    const paperId = normStr(d.data.paperId);

    let belongsToTarget = false;
    let belongsToOther = false;

    if (explicitSession) {
      if (explicitSession === target) belongsToTarget = true;
      else belongsToOther = true;
    } else {
      if (paperId && paperIdSet.has(paperId)) {
        belongsToTarget = true;
      } else if (paperId && otherPaperIdSet.has(paperId)) {
        belongsToOther = true;
      } else if (examYear === target) {
        belongsToTarget = true;
      } else if (examYear) {
        belongsToOther = true;
      }
    }

    if (belongsToTarget) practicalForms.push(d);
    else if (belongsToOther) otherFormIds.add(d.id);
  }
  const formIdSet = new Set(practicalForms.map((d) => d.id));

  const examinerAssignments = (byCollection['examinerAssignments'] || []).filter(
    (d) => normStr(d.data.session) === target
  );
  const assignmentIdSet = new Set(examinerAssignments.map((d) => d.id));
  const otherAssignmentIdSet = new Set(
    (byCollection['examinerAssignments'] || [])
      .filter((d) => normStr(d.data.session) && normStr(d.data.session) !== target)
      .map((d) => d.id)
  );

  const formEnrollmentsByForm: RawDocRecord[] = [];
  const formEnrollmentsByStudent: RawDocRecord[] = [];
  const enrollmentAllMap = new Map<string, RawDocRecord>();

  for (const d of byCollection['formEnrollments'] || []) {
    const enrSession = normStr(d.data.academicSession);
    if (enrSession && enrSession !== target && !formIdSet.has(normStr(d.data.practicalFormId))) {
      continue;
    }
    const matchesForm = formIdSet.has(normStr(d.data.practicalFormId));
    const matchesStudent =
      enrSession === target || studentIdSet.has(normStr(d.data.studentId));
    if (matchesForm) formEnrollmentsByForm.push(d);
    if (matchesStudent) formEnrollmentsByStudent.push(d);
    if (matchesForm || matchesStudent) enrollmentAllMap.set(d.id, d);
  }

  const marks = (byCollection['marks'] || []).filter((d) => {
    const fId = normStr(d.data.practicalFormId);
    const aId = normStr(d.data.assignmentId);
    const sId = normStr(d.data.studentId);

    // Explicitly exclude marks tied to any other session's forms/assignments/students
    if (
      (fId && (otherFormIds.has(fId) || otherPaperIdSet.has(fId))) ||
      (aId && otherAssignmentIdSet.has(aId)) ||
      (sId && (otherStudentIdSet.has(sId) || otherPaperStudentIdSet.has(sId)))
    ) {
      return false;
    }

    return (
      (fId && (formIdSet.has(fId) || paperIdSet.has(fId))) ||
      (aId && assignmentIdSet.has(aId)) ||
      (sId && (studentIdSet.has(sId) || paperStudentIdSet.has(sId)))
    );
  });

  const activeFormTokensToRevoke = practicalForms.filter((d) => {
    const tok = normStr(d.data.token);
    return Boolean(d.data.isActive) || (tok !== '' && !tok.startsWith('REVOKED_'));
  });

  const memoSheetConfigs = (byCollection['memoSheetConfigs'] || []).filter(
    (d) => normStr(d.data.session) === target
  );

  const practicalExams = (byCollection['practical_exams'] || []).filter(
    (d) => normStr(d.data.academicYear) === target
  );
  const practicalExamIdSet = new Set(practicalExams.map((d) => d.id));
  const practicalExamStudents = allPracticalExamStudents.filter((d) =>
    practicalExamIdSet.has(normStr(d.data.__examId))
  );

  // Department & Subject Records (where applicable):
  // Shared college masters (departments, practicalSubjects, general subjects) are NEVER auto-targeted
  // unless a subject doc explicitly carries a session tag matching target AND is not used by other sessions.
  const otherSessionUsedSubjectIds = new Set<string>();
  for (const d of byCollection['practicalForms'] || []) {
    if (!formIdSet.has(d.id)) {
      if (d.data.subjectId) otherSessionUsedSubjectIds.add(normStr(d.data.subjectId));
      if (Array.isArray(d.data.subjectAssignments)) {
        for (const sa of d.data.subjectAssignments) {
          if (sa?.subjectId) otherSessionUsedSubjectIds.add(normStr(sa.subjectId));
        }
      }
    }
  }
  const exclusiveSubjects = (byCollection['subjects'] || []).filter((d) => {
    const subjSession = normStr(d.data.session || d.data.academicSession);
    return subjSession === target && !otherSessionUsedSubjectIds.has(d.id);
  });

  const sessionEntityIds = new Set<string>([
    ...students.map((d) => d.id),
    ...paperStudents.map((d) => d.id),
    ...practicalForms.map((d) => d.id),
    ...examinerAssignments.map((d) => d.id),
    ...academicPapers.map((d) => d.id),
    ...memoSheetConfigs.map((d) => d.id),
    ...practicalExams.map((d) => d.id),
  ]);

  const sessionActivityLogs = (byCollection['activityLogs'] || []).filter((d) => {
    const action = normStr(d.data.action);
    if (action === 'DATABASE_PERMANENT_DELETE' || action === 'SESSION_BACKUP_EXPORTED') {
      return false;
    }
    const entityId = normStr(d.data.entityId);
    if (entityId && sessionEntityIds.has(entityId)) return true;
    return detailsMentionExactSession(d.data.details, target);
  });

  return {
    session: target,
    students,
    paperStudents,
    academicPapers,
    practicalForms,
    formEnrollmentsByForm,
    formEnrollmentsByStudent,
    formEnrollmentsAll: Array.from(enrollmentAllMap.values()),
    marks,
    examinerAssignments,
    activeFormTokensToRevoke,
    memoSheetConfigs,
    practicalExams,
    practicalExamStudents,
    exclusiveSubjects,
    sessionActivityLogs,
  };
}

/**
 * Live Database Usage Metrics across all Firestore collections
 */
export async function getDatabaseUsageMetricsServer(): Promise<DatabaseUsageMetrics> {
  const db = getDb();
  const { byCollection, practicalExamStudents } = await loadAllCollectionsSnapshot(db);

  const collectionBreakdown: CollectionStorageBreakdown[] = [];
  let totalDocuments = 0;
  let rawJsonBytesTotal = 0;
  let estimatedFirestoreBytesUsed = 0;

  for (const meta of COLLECTION_META) {
    const docs = byCollection[meta.name] || [];
    let colRaw = 0;
    let colEst = 0;
    for (const d of docs) {
      colRaw += d.rawJsonBytes;
      colEst += d.estimatedFirestoreBytes;
    }
    if (meta.name === 'practical_exams' && practicalExamStudents.length > 0) {
      for (const sd of practicalExamStudents) {
        colRaw += sd.rawJsonBytes;
        colEst += sd.estimatedFirestoreBytes;
      }
    }

    const docCount =
      docs.length + (meta.name === 'practical_exams' ? practicalExamStudents.length : 0);

    totalDocuments += docCount;
    rawJsonBytesTotal += colRaw;
    estimatedFirestoreBytesUsed += colEst;

    collectionBreakdown.push({
      collectionName: meta.name,
      label: meta.label,
      documentCount: docCount,
      rawJsonBytes: colRaw,
      estimatedFirestoreBytes: colEst,
      category: meta.category,
    });
  }

  collectionBreakdown.sort((a, b) => b.estimatedFirestoreBytes - a.estimatedFirestoreBytes);

  const sessionsList = discoverAllSessionNames(byCollection);
  const sessionSummaries: SessionSummaryRow[] = sessionsList.map((sess) => {
    const resolved = resolveSessionDataFromSnapshot(sess, byCollection, practicalExamStudents);
    const bytes = [
      ...resolved.students,
      ...resolved.paperStudents,
      ...resolved.practicalForms,
      ...resolved.formEnrollmentsAll,
      ...resolved.marks,
      ...resolved.examinerAssignments,
      ...resolved.academicPapers,
      ...resolved.memoSheetConfigs,
      ...resolved.practicalExams,
      ...resolved.practicalExamStudents,
      ...resolved.sessionActivityLogs,
    ].reduce((sum, d) => sum + d.estimatedFirestoreBytes, 0);

    return {
      session: sess,
      studentsCount: resolved.students.length,
      excelUploadsCount: resolved.paperStudents.length,
      practicalFormsCount: resolved.practicalForms.length,
      marksCount: resolved.marks.length,
      tokensCount: resolved.examinerAssignments.length + resolved.activeFormTokensToRevoke.length,
      allocationsCount: resolved.academicPapers.length + resolved.memoSheetConfigs.length,
      estimatedFirestoreBytes: bytes,
    };
  });

  const usagePercentage = Number(
    ((estimatedFirestoreBytesUsed / SPARK_QUOTA_BYTES) * 100).toFixed(4)
  );
  const warning = getWarningTier(usagePercentage);

  return {
    generatedAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    storageQuotaBytes: SPARK_QUOTA_BYTES,
    estimatedFirestoreBytesUsed,
    rawJsonBytesTotal,
    availableStorageBytes: Math.max(0, SPARK_QUOTA_BYTES - estimatedFirestoreBytesUsed),
    usagePercentage,
    warningLevel: warning.level,
    warningLabel: warning.label,
    totals: {
      totalDocuments,
      totalStudents:
        (byCollection['students'] || []).length + (byCollection['paperStudents'] || []).length,
      totalPaperStudents: (byCollection['paperStudents'] || []).length,
      totalPracticalForms: (byCollection['practicalForms'] || []).length,
      totalMarksRecords: (byCollection['marks'] || []).length,
      totalSessions: sessionsList.length,
      totalExaminerTokens: (byCollection['examinerAssignments'] || []).length,
      totalActivityLogs: (byCollection['activityLogs'] || []).length,
      totalDeletionAuditLogs: (byCollection['deletionAuditLogs'] || []).length,
    },
    collectionBreakdown,
    sessionSummaries,
    telemetryHonesty: {
      estimationMethod:
        'Live document payload & Firestore record overhead calculation across all 18 ERP collections (32 B record header + path bytes + UTF-8 field values).',
      cloudMonitoringStatus: 'unavailable_starter_iam',
      cloudMonitoringMessage:
        'GCP Cloud Monitoring / Billing byte metrics are unavailable in this runtime (Firebase Admin SDK on Starter Tier returns PERMISSION_DENIED). Figures above are computed live from actual Firestore documents.',
      firebaseStorageBucket: firebaseConfig.storageBucket,
      firebaseStorageStatus: 'not_provisioned',
      firebaseStorageBytesUsed: 0,
      firebaseStorageMessage:
        'Firebase Cloud Storage bucket is not provisioned (404 No bucket; 0 B binary files). All ERP records reside in Firestore.',
      sparkPlanQuotas: {
        storageLimit: '1 GiB (1,073,741,824 bytes)',
        dailyReads: '50,000 / day',
        dailyWrites: '20,000 / day',
        dailyDeletes: '20,000 / day',
      },
    },
  };
}

/**
 * Preview deletion counts and individual records for a single session
 */
export async function getSessionDeletionPreviewServer(
  sessionName: string
): Promise<SessionDeletionPreview> {
  const cleanSession = normStr(sessionName);
  if (!cleanSession) {
    throw new Error('Academic Session is required.');
  }

  const db = getDb();
  const { byCollection, practicalExamStudents } = await loadAllCollectionsSnapshot(db);
  const resolved = resolveSessionDataFromSnapshot(
    cleanSession,
    byCollection,
    practicalExamStudents
  );

  const sumBytes = (list: RawDocRecord[]) =>
    list.reduce((s, d) => s + d.estimatedFirestoreBytes, 0);

  const categories: SessionCategoryCount[] = [
    {
      category: 'students',
      label: '1. Students',
      description: 'Master student directory entries and linked form enrollments for this session.',
      collections: ['students', 'formEnrollments'],
      estimatedCount: resolved.students.length + resolved.formEnrollmentsByStudent.length,
      estimatedBytes: sumBytes(resolved.students) + sumBytes(resolved.formEnrollmentsByStudent),
      actionType: 'delete',
    },
    {
      category: 'excel_uploads',
      label: '2. Student Excel Upload Records',
      description: 'Paper-wise imported student roster records uploaded via Excel.',
      collections: ['paperStudents'],
      estimatedCount: resolved.paperStudents.length,
      estimatedBytes: sumBytes(resolved.paperStudents),
      actionType: 'delete',
    },
    {
      category: 'practical_forms',
      label: '3. Practical Forms',
      description: 'Practical examination forms and their form-specific enrollment snapshots.',
      collections: ['practicalForms', 'formEnrollments'],
      estimatedCount: resolved.practicalForms.length + resolved.formEnrollmentsByForm.length,
      estimatedBytes: sumBytes(resolved.practicalForms) + sumBytes(resolved.formEnrollmentsByForm),
      actionType: 'delete',
    },
    {
      category: 'marks_records',
      label: '4. Marks Records',
      description: 'All practical evaluation marks entered for this session’s forms & assignments.',
      collections: ['marks'],
      estimatedCount: resolved.marks.length,
      estimatedBytes: sumBytes(resolved.marks),
      actionType: 'delete',
    },
    {
      category: 'form_links_tokens',
      label: '5. Generated Form Links / Tokens',
      description:
        'Examiner access link assignments deleted + active practical form links permanently revoked.',
      collections: ['examinerAssignments', 'practicalForms (token revoke)'],
      estimatedCount:
        resolved.examinerAssignments.length + resolved.activeFormTokensToRevoke.length,
      estimatedBytes: sumBytes(resolved.examinerAssignments),
      actionType: 'revoke_and_delete',
      note:
        resolved.activeFormTokensToRevoke.length > 0
          ? `${resolved.examinerAssignments.length} examiner token record(s) deleted; ${resolved.activeFormTokensToRevoke.length} practical form link(s) deactivated without deleting form marks.`
          : undefined,
    },
    {
      category: 'subject_allocations',
      label: '6. Subject Allocations',
      description: 'Session paper allocations, memo sheet configs, and rubric exam headers.',
      collections: ['academicPapers', 'memoSheetConfigs', 'practical_exams'],
      estimatedCount:
        resolved.academicPapers.length +
        resolved.memoSheetConfigs.length +
        resolved.practicalExams.length +
        resolved.practicalExamStudents.length,
      estimatedBytes:
        sumBytes(resolved.academicPapers) +
        sumBytes(resolved.memoSheetConfigs) +
        sumBytes(resolved.practicalExams) +
        sumBytes(resolved.practicalExamStudents),
      actionType: 'delete',
    },
    {
      category: 'departments_subjects',
      label: '7. Department & Subject Records (Session-Scoped)',
      description:
        'Session-tagged subjects unused by other sessions. Shared college-wide Department & Subject masters are protected.',
      collections: ['subjects'],
      estimatedCount: resolved.exclusiveSubjects.length,
      estimatedBytes: sumBytes(resolved.exclusiveSubjects),
      actionType: 'delete',
      note:
        resolved.exclusiveSubjects.length === 0
          ? 'All existing departments and curriculum subjects are shared masters across sessions and safely protected.'
          : undefined,
    },
    {
      category: 'session_activity',
      label: '8. Session-wise Activity Records',
      description:
        'Operational activity logs referencing this session. Deletion audit logs are permanently preserved.',
      collections: ['activityLogs'],
      estimatedCount: resolved.sessionActivityLogs.length,
      estimatedBytes: sumBytes(resolved.sessionActivityLogs),
      actionType: 'delete',
    },
  ];

  // Deduplicated complete session count
  const uniqueDocKeys = new Set<string>();
  let totalEstimatedBytes = 0;
  const addUnique = (list: RawDocRecord[]) => {
    for (const d of list) {
      const key = `${d.collectionName}/${d.id}`;
      if (!uniqueDocKeys.has(key)) {
        uniqueDocKeys.add(key);
        totalEstimatedBytes += d.estimatedFirestoreBytes;
      }
    }
  };
  addUnique(resolved.students);
  addUnique(resolved.paperStudents);
  addUnique(resolved.practicalForms);
  addUnique(resolved.formEnrollmentsAll);
  addUnique(resolved.marks);
  addUnique(resolved.examinerAssignments);
  addUnique(resolved.academicPapers);
  addUnique(resolved.memoSheetConfigs);
  addUnique(resolved.practicalExams);
  addUnique(resolved.practicalExamStudents);
  addUnique(resolved.exclusiveSubjects);
  addUnique(resolved.sessionActivityLogs);

  const toIndividualItem = (
    d: RawDocRecord,
    col: IndividualRecordItem['collection'],
    primaryLabel: string,
    secondaryLabel: string,
    meta: string
  ): IndividualRecordItem => ({
    id: d.id,
    collection: col,
    primaryLabel,
    secondaryLabel,
    meta,
    session: cleanSession,
    createdAt: d.data.createdAt || d.data.updatedAt || '',
  });

  return {
    session: cleanSession,
    generatedAt: new Date().toISOString(),
    totalEstimatedRecords: uniqueDocKeys.size,
    totalEstimatedBytes,
    categories,
    individualRecords: {
      students: resolved.students.map((d) =>
        toIndividualItem(
          d,
          'students',
          `${normStr(d.data.rollNumber)} — ${normStr(d.data.studentName)}`,
          `${normStr(d.data.course)} ${normStr(d.data.semester)}`.trim(),
          `Session: ${normStr(d.data.academicSession)}`
        )
      ),
      paperStudents: resolved.paperStudents.map((d) =>
        toIndividualItem(
          d,
          'paperStudents',
          `${normStr(d.data.rollNumber)} — ${normStr(d.data.studentName)}`,
          `${normStr(d.data.subject)} (${normStr(d.data.subjectType)} ${normStr(d.data.paperName)})`,
          `${normStr(d.data.semester)} • ${normStr(d.data.session)}`
        )
      ),
      practicalForms: resolved.practicalForms.map((d) =>
        toIndividualItem(
          d,
          'practicalForms',
          normStr(d.data.title) || d.id,
          `${normStr(d.data.subjectName)} (${normStr(d.data.subjectCode)}) • ${normStr(d.data.semester)}`,
          `Status: ${normStr(d.data.status)} • Locked: ${d.data.isMarksLocked ? 'Yes' : 'No'}`
        )
      ),
      marks: resolved.marks.map((d) =>
        toIndividualItem(
          d,
          'marks',
          `${normStr(d.data.rollNumber)} — ${normStr(d.data.studentName)}`,
          `Marks: ${d.data.isPresent === false ? 'ABSENT' : d.data.marksObtained ?? 'Pending'} (${normStr(d.data.resultStatus || 'PENDING')})`,
          `${normStr(d.data.subject) || 'Practical'} • Form/Assign: ${normStr(d.data.practicalFormId || d.data.assignmentId)}`
        )
      ),
      examinerAssignments: resolved.examinerAssignments.map((d) =>
        toIndividualItem(
          d,
          'examinerAssignments',
          `${normStr(d.data.subjectName)} — ${normStr(d.data.paperName)}`,
          `Examiner: ${normStr(d.data.examinerName)} • Incharge: ${normStr(d.data.inchargeName)}`,
          `Token: ${normStr(d.data.token).slice(0, 12)}... • ${normStr(d.data.status)}`
        )
      ),
      academicPapers: resolved.academicPapers.map((d) =>
        toIndividualItem(
          d,
          'academicPapers',
          `${normStr(d.data.subjectType)} — ${normStr(d.data.paperName)}`,
          normStr(d.data.semester),
          `Session: ${normStr(d.data.session)}`
        )
      ),
    },
  };
}

/**
 * Generates an immutable JSON backup snapshot for a session and logs the export
 */
export async function exportSessionBackupServer(
  sessionName: string,
  admin: { uid: string; username: string }
) {
  const cleanSession = normStr(sessionName);
  if (!cleanSession) {
    throw new Error('Academic Session is required for backup export.');
  }

  const db = getDb();
  const { byCollection, practicalExamStudents } = await loadAllCollectionsSnapshot(db);
  const resolved = resolveSessionDataFromSnapshot(
    cleanSession,
    byCollection,
    practicalExamStudents
  );

  const exportDoc = (d: RawDocRecord) => ({ id: d.id, ...d.data });

  const backupPayload = {
    metadata: {
      exportVersion: '1.0',
      institution: 'NGM Degree Mahavidyalaya',
      session: cleanSession,
      exportedAt: new Date().toISOString(),
      exportedBy: admin.username,
      projectId: firebaseConfig.projectId,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    },
    counts: {
      students: resolved.students.length,
      paperStudents: resolved.paperStudents.length,
      practicalForms: resolved.practicalForms.length,
      formEnrollments: resolved.formEnrollmentsAll.length,
      marks: resolved.marks.length,
      examinerAssignments: resolved.examinerAssignments.length,
      academicPapers: resolved.academicPapers.length,
      memoSheetConfigs: resolved.memoSheetConfigs.length,
      practicalExams: resolved.practicalExams.length,
      activityLogs: resolved.sessionActivityLogs.length,
    },
    data: {
      students: resolved.students.map(exportDoc),
      paperStudents: resolved.paperStudents.map(exportDoc),
      practicalForms: resolved.practicalForms.map(exportDoc),
      formEnrollments: resolved.formEnrollmentsAll.map(exportDoc),
      marks: resolved.marks.map(exportDoc),
      examinerAssignments: resolved.examinerAssignments.map(exportDoc),
      academicPapers: resolved.academicPapers.map(exportDoc),
      memoSheetConfigs: resolved.memoSheetConfigs.map(exportDoc),
      practicalExams: resolved.practicalExams.map(exportDoc),
      practicalExamStudents: resolved.practicalExamStudents.map(exportDoc),
      activityLogs: resolved.sessionActivityLogs.map(exportDoc),
    },
  };

  // Write audit log entry to deletionAuditLogs
  const now = new Date().toISOString();
  const logId = `del_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const totalBackedUp = Object.values(backupPayload.counts).reduce((a, b) => a + b, 0);

  const auditEntry: DeletionAuditLogEntry = {
    id: logId,
    action: 'SESSION_BACKUP_EXPORTED',
    mode: 'backup',
    session: cleanSession,
    category: 'session_backup',
    deletedBy: admin.username,
    deletedByUid: admin.uid,
    deletedCount: 0,
    backupDownloaded: true,
    breakdown: backupPayload.counts,
    details: `Administrator ${admin.username} exported session backup for ${cleanSession} (${totalBackedUp} total records).`,
    timestamp: now,
  };

  await setDoc(doc(db, 'deletionAuditLogs', logId), auditEntry);

  return { backup: backupPayload, auditLogId: logId };
}

async function commitOperationsInChunks(
  db: ReturnType<typeof getDb>,
  ops: Array<{
    type: 'delete' | 'update';
    ref: DocumentReference;
    data?: Record<string, any>;
    bucketKey: string;
  }>
): Promise<{
  deletedCount: number;
  revokedCount: number;
  failedCount: number;
  breakdown: Record<string, number>;
}> {
  let deletedCount = 0;
  let revokedCount = 0;
  let failedCount = 0;
  const breakdown: Record<string, number> = {};

  for (let i = 0; i < ops.length; i += BATCH_CHUNK_SIZE) {
    const chunk = ops.slice(i, i + BATCH_CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'update' && op.data) {
        batch.update(op.ref, op.data);
      }
    }

    try {
      await batch.commit();
      for (const op of chunk) {
        if (op.type === 'delete') deletedCount += 1;
        else revokedCount += 1;
        breakdown[op.bucketKey] = (breakdown[op.bucketKey] || 0) + 1;
      }
    } catch (err) {
      console.error('[DBMgmt] Batch commit error:', err);
      failedCount += chunk.length;
    }
  }

  return { deletedCount, revokedCount, failedCount, breakdown };
}

/**
 * Executes permanent deletion for category, complete session, or individual record
 * and writes an immutable record to deletionAuditLogs.
 */
export async function executePermanentDeleteServer(
  payload: DeletionRequestPayload,
  admin: { uid: string; username: string }
): Promise<DeletionExecutionResult> {
  const db = getDb();
  const mode = payload.mode;
  const cleanSession = normStr(payload.session);

  if (!cleanSession) {
    throw new Error('Academic Session is required.');
  }

  const now = new Date().toISOString();
  const ops: Array<{
    type: 'delete' | 'update';
    ref: DocumentReference;
    data?: Record<string, any>;
    bucketKey: string;
  }> = [];

  let categoryLabel = '';

  if (mode === 'individual') {
    const allowedCollections = new Set([
      'students',
      'paperStudents',
      'practicalForms',
      'marks',
      'examinerAssignments',
      'academicPapers',
    ]);
    const targetCol = payload.targetCollection;
    const targetId = normStr(payload.targetId);

    if (!targetCol || !allowedCollections.has(targetCol) || !targetId) {
      throw new Error('Invalid target collection or document ID for individual deletion.');
    }

    const docRef = doc(db, targetCol, targetId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`Record ${targetCol}/${targetId} was not found in Firestore.`);
    }

    const data = snap.data() as Record<string, any>;
    categoryLabel = `individual:${targetCol}`;

    ops.push({ type: 'delete', ref: docRef, bucketKey: targetCol });

    // Cleanly cascade dependent snapshots when deleting a student or practicalForm
    if (targetCol === 'students') {
      const enrSnap = await getDocs(
        query(collection(db, 'formEnrollments'), where('studentId', '==', targetId))
      );
      enrSnap.docs.forEach((ed) => {
        ops.push({ type: 'delete', ref: ed.ref, bucketKey: 'formEnrollments' });
      });
    } else if (targetCol === 'practicalForms') {
      const enrSnap = await getDocs(
        query(collection(db, 'formEnrollments'), where('practicalFormId', '==', targetId))
      );
      enrSnap.docs.forEach((ed) => {
        ops.push({ type: 'delete', ref: ed.ref, bucketKey: 'formEnrollments' });
      });
      const marksSnap = await getDocs(
        query(collection(db, 'marks'), where('practicalFormId', '==', targetId))
      );
      marksSnap.docs.forEach((md) => {
        ops.push({ type: 'delete', ref: md.ref, bucketKey: 'marks' });
      });
    } else if (targetCol === 'academicPapers') {
      const psSnap = await getDocs(
        query(collection(db, 'paperStudents'), where('paperId', '==', targetId))
      );
      psSnap.docs.forEach((pd) => {
        ops.push({ type: 'delete', ref: pd.ref, bucketKey: 'paperStudents' });
      });
      const asgnSnap = await getDocs(
        query(collection(db, 'examinerAssignments'), where('paperId', '==', targetId))
      );
      asgnSnap.docs.forEach((ad) => {
        ops.push({ type: 'delete', ref: ad.ref, bucketKey: 'examinerAssignments' });
      });
    }

    // Also update assignment stats cleanly if deleting an individual assignment mark
    const result = await commitOperationsInChunks(db, ops);

    if (targetCol === 'marks' && data.assignmentId) {
      try {
        const asgnRef = doc(db, 'examinerAssignments', normStr(data.assignmentId));
        const asgnSnap = await getDoc(asgnRef);
        if (asgnSnap.exists()) {
          const remainingMarksSnap = await getDocs(
            query(
              collection(db, 'marks'),
              where('assignmentId', '==', normStr(data.assignmentId))
            )
          );
          let evaluatedCount = 0;
          let absentCount = 0;
          remainingMarksSnap.docs.forEach((m) => {
            const md = m.data();
            if (md.isPresent === false) absentCount += 1;
            else if (md.marksObtained !== null && md.marksObtained !== undefined) {
              evaluatedCount += 1;
            }
          });
          const totalStudents = Number(asgnSnap.data().totalStudents || 0);
          const pendingCount = Math.max(0, totalStudents - evaluatedCount - absentCount);
          const batch = writeBatch(db);
          batch.update(asgnRef, { evaluatedCount, absentCount, pendingCount, updatedAt: now });
          await batch.commit();
        }
      } catch {
        // Non-fatal counter refresh
      }
    }

    const logId = `del_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const auditEntry: DeletionAuditLogEntry = {
      id: logId,
      action: 'DATABASE_PERMANENT_DELETE',
      mode: 'individual',
      session: cleanSession,
      category: categoryLabel,
      deletedBy: admin.username,
      deletedByUid: admin.uid,
      deletedCount: result.deletedCount,
      revokedCount: result.revokedCount,
      failedCount: result.failedCount,
      backupDownloaded: Boolean(payload.backupDownloaded),
      breakdown: result.breakdown,
      details: `Permanently deleted ${targetCol}/${targetId} (${result.deletedCount} doc(s)) in session ${cleanSession}.`,
      timestamp: now,
    };
    await setDoc(doc(db, 'deletionAuditLogs', logId), auditEntry);

    const updatedUsage = await getDatabaseUsageMetricsServer();
    return {
      success: result.failedCount === 0,
      mode: 'individual',
      session: cleanSession,
      category: categoryLabel,
      deletedCount: result.deletedCount,
      revokedCount: result.revokedCount,
      failedCount: result.failedCount,
      breakdown: result.breakdown,
      auditLogId: logId,
      message: `Permanently deleted ${result.deletedCount} record(s) from ${targetCol}.`,
      updatedUsage,
    };
  }

  // Category or Complete Session deletion
  const { byCollection, practicalExamStudents } = await loadAllCollectionsSnapshot(db);
  const resolved = resolveSessionDataFromSnapshot(
    cleanSession,
    byCollection,
    practicalExamStudents
  );

  const seenOpKeys = new Set<string>();
  const addDeleteDocs = (colPath: string, docs: RawDocRecord[], bucketKey: string) => {
    for (const d of docs) {
      const key = `${colPath}/${d.id}`;
      if (seenOpKeys.has(key)) continue;
      seenOpKeys.add(key);
      ops.push({ type: 'delete', ref: doc(db, colPath, d.id), bucketKey });
    }
  };

  if (mode === 'complete_session') {
    if (normStr(payload.confirmSessionText) !== cleanSession) {
      throw new Error(
        `Confirmation mismatch. You must type exact session "${cleanSession}" to delete complete session data.`
      );
    }
    categoryLabel = 'complete_session';

    addDeleteDocs('students', resolved.students, 'students');
    addDeleteDocs('paperStudents', resolved.paperStudents, 'paperStudents');
    addDeleteDocs('practicalForms', resolved.practicalForms, 'practicalForms');
    addDeleteDocs('formEnrollments', resolved.formEnrollmentsAll, 'formEnrollments');
    addDeleteDocs('marks', resolved.marks, 'marks');
    addDeleteDocs('examinerAssignments', resolved.examinerAssignments, 'examinerAssignments');
    addDeleteDocs('academicPapers', resolved.academicPapers, 'academicPapers');
    addDeleteDocs('memoSheetConfigs', resolved.memoSheetConfigs, 'memoSheetConfigs');
    for (const sd of resolved.practicalExamStudents) {
      const key = `${sd.collectionName}/${sd.id}`;
      if (!seenOpKeys.has(key)) {
        seenOpKeys.add(key);
        ops.push({
          type: 'delete',
          ref: doc(db, sd.collectionName, sd.id),
          bucketKey: 'practical_exams_students',
        });
      }
    }
    addDeleteDocs('practical_exams', resolved.practicalExams, 'practical_exams');
    addDeleteDocs('subjects', resolved.exclusiveSubjects, 'subjects');
    addDeleteDocs('activityLogs', resolved.sessionActivityLogs, 'activityLogs');
  } else if (mode === 'category') {
    const cat = payload.category as SessionDeletionCategory | undefined;
    if (!cat || cat === 'complete_session') {
      throw new Error('Valid deletion category is required.');
    }
    categoryLabel = cat;

    switch (cat) {
      case 'students':
        addDeleteDocs('students', resolved.students, 'students');
        addDeleteDocs('formEnrollments', resolved.formEnrollmentsByStudent, 'formEnrollments');
        break;
      case 'excel_uploads':
        addDeleteDocs('paperStudents', resolved.paperStudents, 'paperStudents');
        break;
      case 'practical_forms':
        addDeleteDocs('practicalForms', resolved.practicalForms, 'practicalForms');
        addDeleteDocs('formEnrollments', resolved.formEnrollmentsByForm, 'formEnrollments');
        break;
      case 'marks_records':
        addDeleteDocs('marks', resolved.marks, 'marks');
        break;
      case 'form_links_tokens':
        addDeleteDocs('examinerAssignments', resolved.examinerAssignments, 'examinerAssignments');
        for (const pf of resolved.activeFormTokensToRevoke) {
          ops.push({
            type: 'update',
            ref: doc(db, 'practicalForms', pf.id),
            data: {
              isActive: false,
              token: `REVOKED_${pf.id}_${Date.now()}`,
              updatedAt: now,
            },
            bucketKey: 'practicalForms_links_revoked',
          });
        }
        break;
      case 'subject_allocations':
        addDeleteDocs('academicPapers', resolved.academicPapers, 'academicPapers');
        addDeleteDocs('memoSheetConfigs', resolved.memoSheetConfigs, 'memoSheetConfigs');
        for (const sd of resolved.practicalExamStudents) {
          ops.push({
            type: 'delete',
            ref: doc(db, sd.collectionName, sd.id),
            bucketKey: 'practical_exams_students',
          });
        }
        addDeleteDocs('practical_exams', resolved.practicalExams, 'practical_exams');
        break;
      case 'departments_subjects':
        addDeleteDocs('subjects', resolved.exclusiveSubjects, 'subjects');
        break;
      case 'session_activity':
        addDeleteDocs('activityLogs', resolved.sessionActivityLogs, 'activityLogs');
        break;
      default:
        throw new Error(`Unsupported deletion category: ${String(cat)}`);
    }
  } else {
    throw new Error('Invalid deletion mode.');
  }

  const result = await commitOperationsInChunks(db, ops);

  // Record immutable deletion audit log in deletionAuditLogs (never deleted during cleanup)
  const logId = `del_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const auditEntry: DeletionAuditLogEntry = {
    id: logId,
    action: 'DATABASE_PERMANENT_DELETE',
    mode,
    session: cleanSession,
    category: categoryLabel,
    deletedBy: admin.username,
    deletedByUid: admin.uid,
    deletedCount: result.deletedCount,
    revokedCount: result.revokedCount,
    failedCount: result.failedCount,
    backupDownloaded: Boolean(payload.backupDownloaded),
    breakdown: result.breakdown,
    details:
      mode === 'complete_session'
        ? `Administrator ${admin.username} permanently deleted complete session data for ${cleanSession} (${result.deletedCount} records removed).`
        : `Administrator ${admin.username} permanently deleted "${categoryLabel}" for session ${cleanSession} (${result.deletedCount} deleted, ${result.revokedCount} links revoked).`,
    timestamp: now,
  };

  await setDoc(doc(db, 'deletionAuditLogs', logId), auditEntry);

  const updatedUsage = await getDatabaseUsageMetricsServer();

  return {
    success: result.failedCount === 0,
    mode,
    session: cleanSession,
    category: categoryLabel,
    deletedCount: result.deletedCount,
    revokedCount: result.revokedCount,
    failedCount: result.failedCount,
    breakdown: result.breakdown,
    auditLogId: logId,
    message:
      result.failedCount > 0
        ? `Partial completion: ${result.deletedCount} deleted, ${result.revokedCount} revoked, ${result.failedCount} failed.`
        : `Successfully deleted ${result.deletedCount} record(s)${result.revokedCount > 0 ? ` and revoked ${result.revokedCount} form link(s)` : ''} for session ${cleanSession}.`,
    updatedUsage,
  };
}

/**
 * Retrieves immutable deletion & backup audit logs sorted newest first
 */
export async function getDeletionAuditLogsServer(): Promise<DeletionAuditLogEntry[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'deletionAuditLogs'));
  const logs = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<DeletionAuditLogEntry, 'id'>),
  }));
  return logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}
