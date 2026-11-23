import crypto from 'crypto';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from './firestoreServer.ts';
import {
  NEP_CATEGORIES,
  type NepCategoryKey,
  type NepCategoryRule,
  type PublicNepSelectionFormPayload,
  type SelectionFormStatus,
  type SubjectUpdateAllocationStatus,
  type SubjectUpdateAssignmentTargetType,
  type SubjectUpdateCategory,
  type SubjectUpdateCombination,
  type SubjectUpdateDepartment,
  type SubjectUpdateItem,
  type SubjectUpdateNepConfig,
  type SubjectUpdateNepStudentSelection,
  type SubjectUpdateSelectionForm,
  type SubjectUpdateSemester,
  type SubjectUpdateSession,
  type SubjectUpdateStaff,
  type SubjectUpdateStaffAssignment,
  type SubjectUpdateStudent,
  type SubjectUpdateStudentGroup,
  type SubjectUpdateSystemSettings,
  type SubjectUpdateSystemState,
  type SubjectUpdateWorkAllocation,
  type SubjectUpdateWorkPriority,
  type SubjectUpdateWorkStatus,
} from '../src/types/index.ts';

const COLLECTIONS = {
  subjects: 'subjectUpdateSubjects',
  sessions: 'subjectUpdateSessions',
  semesters: 'subjectUpdateSemesters',
  categories: 'subjectUpdateCategories',
  departments: 'subjectUpdateDepartments',
  combinations: 'subjectUpdateCombinations',
  students: 'subjectUpdateStudents',
  groups: 'subjectUpdateStudentGroups',
  staff: 'subjectUpdateStaff',
  staffAssignments: 'subjectUpdateStaffAssignments',
  workAllocations: 'subjectUpdateWorkAllocations',
  nepConfigs: 'subjectUpdateNepConfigs',
  selectionForms: 'subjectUpdateSelectionForms',
  settings: 'subjectUpdateSystemSettings',
} as const;

const DEFAULT_SESSIONS = ['2023-27', '2024-28', '2025-29', '2026-30'];

const DEFAULT_SEMESTERS = Array.from({ length: 8 }, (_, idx) => ({
  id: `susem_${idx + 1}`,
  semesterName: `Semester ${idx + 1}`,
  order: idx + 1,
}));

const DEFAULT_CATEGORIES = [
  { id: 'sucat_mjc', code: 'MJC', label: 'Major Course (MJC)', description: 'Major Core Practical / Theory Subject' },
  { id: 'sucat_mic', code: 'MIC', label: 'Minor Course (MIC)', description: 'Minor Subject Stream' },
  { id: 'sucat_mdc', code: 'MDC', label: 'Multidisciplinary Course (MDC)', description: 'Multidisciplinary Elective Subject' },
];

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as T;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function buildDefaultSettings(now: string): SubjectUpdateSystemSettings {
  return {
    id: 'default',
    systemTitle: 'SUBJECT UPDATE',
    institutionName: 'NGM Degree Mahavidyalaya',
    defaultSession: '2024-28',
    defaultCategory: 'MJC',
    enforceUppercaseCodes: true,
    preventDuplicateCodes: true,
    notes: '',
    updatedBy: 'SYSTEM',
    updatedAt: now,
  };
}

/**
 * Seeds independent SUBJECT UPDATE defaults strictly into `subjectUpdate*` collections
 * on first initialization. Never reads or modifies existing ERP collections.
 */
async function ensureDefaultsSeeded(): Promise<SubjectUpdateSystemSettings> {
  const db = getDb();
  const now = new Date().toISOString();
  const settingsRef = doc(db, COLLECTIONS.settings, 'default');
  const settingsSnap = await getDoc(settingsRef);

  if (settingsSnap.exists()) {
    return {
      ...buildDefaultSettings(now),
      ...(settingsSnap.data() as Partial<SubjectUpdateSystemSettings>),
      id: 'default',
    };
  }

  const [sessSnap, semSnap, catSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.sessions)),
    getDocs(collection(db, COLLECTIONS.semesters)),
    getDocs(collection(db, COLLECTIONS.categories)),
  ]);

  const batch = writeBatch(db);

  if (sessSnap.empty) {
    for (const sessionName of DEFAULT_SESSIONS) {
      const id = `susess_${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const record: SubjectUpdateSession = {
        id,
        sessionName,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, COLLECTIONS.sessions, id), record);
    }
  }

  if (semSnap.empty) {
    for (const sem of DEFAULT_SEMESTERS) {
      const record: SubjectUpdateSemester = {
        id: sem.id,
        semesterName: sem.semesterName,
        order: sem.order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, COLLECTIONS.semesters, sem.id), record);
    }
  }

  if (catSnap.empty) {
    for (const cat of DEFAULT_CATEGORIES) {
      const record: SubjectUpdateCategory = {
        id: cat.id,
        code: cat.code,
        label: cat.label,
        description: cat.description,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, COLLECTIONS.categories, cat.id), record);
    }
  }

  const defaultSettings = buildDefaultSettings(now);
  batch.set(settingsRef, defaultSettings);

  await batch.commit();
  return defaultSettings;
}

async function getSystemSettingsOnly(): Promise<SubjectUpdateSystemSettings> {
  return ensureDefaultsSeeded();
}

export async function getSubjectUpdateSystemStateServer(): Promise<SubjectUpdateSystemState> {
  const db = getDb();
  const settings = await ensureDefaultsSeeded();

  const [
    subjSnap,
    sessSnap,
    semSnap,
    catSnap,
    deptSnap,
    combSnap,
    studSnap,
    groupSnap,
    staffSnap,
    assignSnap,
    workSnap,
    nepConfigSnap,
    selectionFormSnap,
  ] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.sessions)),
    getDocs(collection(db, COLLECTIONS.semesters)),
    getDocs(collection(db, COLLECTIONS.categories)),
    getDocs(collection(db, COLLECTIONS.departments)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.groups)),
    getDocs(collection(db, COLLECTIONS.staff)),
    getDocs(collection(db, COLLECTIONS.staffAssignments)),
    getDocs(collection(db, COLLECTIONS.workAllocations)),
    getDocs(collection(db, COLLECTIONS.nepConfigs)),
    getDocs(collection(db, COLLECTIONS.selectionForms)),
  ]);

  const subjects = subjSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }))
    .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode) || a.subjectName.localeCompare(b.subjectName));

  const sessions = sessSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateSession, 'id'>) }))
    .sort((a, b) => a.sessionName.localeCompare(b.sessionName));

  const semesters = semSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateSemester, 'id'>) }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.semesterName.localeCompare(b.semesterName));

  const categories = catSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCategory, 'id'>) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const departments = deptSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateDepartment, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const combinations = combSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCombination, 'id'>) }))
    .sort((a, b) => a.combinationCode.localeCompare(b.combinationCode) || a.combinationName.localeCompare(b.combinationName));

  const students = studSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) }))
    .sort((a, b) => {
      const snA = Number(a.sn);
      const snB = Number(b.sn);
      if (!isNaN(snA) && !isNaN(snB) && snA !== snB) return snA - snB;
      return (a.applicationNo || a.rollNumber || '').localeCompare(b.applicationNo || b.rollNumber || '');
    });

  const groups = groupSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudentGroup, 'id'>) }))
    .sort((a, b) => a.groupCode.localeCompare(b.groupCode) || a.groupName.localeCompare(b.groupName));

  const staff = staffSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const staffAssignments = assignSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStaffAssignment, 'id'>) }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const workAllocations = workSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateWorkAllocation, 'id'>) }))
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  const nepConfigs = nepConfigSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateNepConfig, 'id'>) }))
    .sort((a, b) => a.session.localeCompare(b.session) || a.semester.localeCompare(b.semester));

  const selectionForms = selectionFormSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateSelectionForm, 'id'>) }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  return {
    subjects,
    sessions,
    semesters,
    categories,
    departments,
    combinations,
    students,
    groups,
    staff,
    staffAssignments,
    workAllocations,
    nepConfigs,
    selectionForms,
    settings,
  };
}

export interface SubjectInputPayload {
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

export async function createSubjectServer(
  payload: SubjectInputPayload,
  adminUsername: string
): Promise<SubjectUpdateItem> {
  const db = getDb();
  const settings = await getSystemSettingsOnly();

  const rawCode = String(payload.subjectCode || '').trim();
  const subjectCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const subjectName = String(payload.subjectName || '').trim();
  const category = String(payload.category || '').trim().toUpperCase();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const departmentName = String(payload.departmentName || '').trim() || 'General';
  const paperTitle = payload.paperTitle !== undefined ? String(payload.paperTitle).trim() : '';
  const subjectInfo = payload.subjectInfo !== undefined ? String(payload.subjectInfo).trim() : '';

  if (!subjectCode) throw new Error('Subject Code is required.');
  if (!subjectName) throw new Error('Subject Name is required.');
  if (!category) throw new Error('Subject Category is required.');
  if (!session) throw new Error('Academic Session is required.');
  if (!semester) throw new Error('Semester is required.');

  if (settings.preventDuplicateCodes) {
    const existingSnap = await getDocs(collection(db, COLLECTIONS.subjects));
    const dup = existingSnap.docs.find((d) => {
      const data = d.data() as SubjectUpdateItem;
      return (
        String(data.subjectCode || '').trim().toUpperCase() === subjectCode.toUpperCase() &&
        String(data.session || '').trim() === session &&
        String(data.semester || '').trim() === semester
      );
    });
    if (dup) {
      throw new Error(`Subject code "${subjectCode}" already exists in ${session} (${semester}).`);
    }
  }

  const now = new Date().toISOString();
  const id = makeId('susubj');
  const item: SubjectUpdateItem = stripUndefined({
    id,
    subjectCode,
    subjectName,
    category,
    session,
    semester,
    departmentName,
    paperTitle: paperTitle || undefined,
    subjectInfo: subjectInfo || undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.subjects, id), item);
  return item;
}

export async function updateSubjectServer(
  id: string,
  payload: Partial<SubjectInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateItem> {
  const db = getDb();
  const docRef = doc(db, COLLECTIONS.subjects, id);
  const existingSnap = await getDoc(docRef);
  if (!existingSnap.exists()) {
    throw new Error('Subject record not found.');
  }

  const existing = existingSnap.data() as SubjectUpdateItem;
  const settings = await getSystemSettingsOnly();

  const rawCode = payload.subjectCode !== undefined ? String(payload.subjectCode).trim() : existing.subjectCode;
  const subjectCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const subjectName = payload.subjectName !== undefined ? String(payload.subjectName).trim() : existing.subjectName;
  const category = payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const departmentName =
    payload.departmentName !== undefined
      ? String(payload.departmentName).trim() || 'General'
      : existing.departmentName;
  const paperTitle = payload.paperTitle !== undefined ? String(payload.paperTitle).trim() : existing.paperTitle;
  const subjectInfo = payload.subjectInfo !== undefined ? String(payload.subjectInfo).trim() : existing.subjectInfo;
  const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive;

  if (!subjectCode) throw new Error('Subject Code cannot be empty.');
  if (!subjectName) throw new Error('Subject Name cannot be empty.');
  if (!category) throw new Error('Subject Category cannot be empty.');
  if (!session) throw new Error('Academic Session cannot be empty.');
  if (!semester) throw new Error('Semester cannot be empty.');

  if (settings.preventDuplicateCodes) {
    const allSnap = await getDocs(collection(db, COLLECTIONS.subjects));
    const dup = allSnap.docs.find((d) => {
      if (d.id === id) return false;
      const data = d.data() as SubjectUpdateItem;
      return (
        String(data.subjectCode || '').trim().toUpperCase() === subjectCode.toUpperCase() &&
        String(data.session || '').trim() === session &&
        String(data.semester || '').trim() === semester
      );
    });
    if (dup) {
      throw new Error(`Subject code "${subjectCode}" already exists in ${session} (${semester}).`);
    }
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateItem = stripUndefined({
    id,
    subjectCode,
    subjectName,
    category,
    session,
    semester,
    departmentName,
    paperTitle: paperTitle || undefined,
    subjectInfo: subjectInfo || undefined,
    isActive,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(docRef, updated);
  return updated;
}

export async function deleteSubjectServer(id: string): Promise<void> {
  const db = getDb();
  const docRef = doc(db, COLLECTIONS.subjects, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Subject record not found.');
  }
  await deleteDoc(docRef);
}

export async function importSubjectsBatchServer(
  rows: SubjectInputPayload[],
  adminUsername: string,
  duplicateStrategy: 'skip' | 'update' = 'skip'
): Promise<{
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}> {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Import payload must contain at least one subject row.');
  }
  if (rows.length > 1000) {
    throw new Error('Import is limited to 1,000 rows per batch.');
  }

  const db = getDb();
  const settings = await getSystemSettingsOnly();
  const existingSnap = await getDocs(collection(db, COLLECTIONS.subjects));

  const existingByKey = new Map<string, { id: string; item: SubjectUpdateItem }>();
  for (const d of existingSnap.docs) {
    const item = { id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) };
    const key = `${item.subjectCode.trim().toUpperCase()}__${item.session.trim()}__${item.semester.trim()}`;
    existingByKey.set(key, { id: d.id, item });
  }

  const now = new Date().toISOString();
  const ops: Array<{ id: string; data: SubjectUpdateItem }> = [];
  const errors: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  rows.forEach((rawRow, idx) => {
    const rawCode = String(rawRow?.subjectCode || '').trim();
    const subjectCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
    const subjectName = String(rawRow?.subjectName || '').trim();
    const category = String(rawRow?.category || settings.defaultCategory || 'MJC').trim().toUpperCase();
    const session = String(rawRow?.session || settings.defaultSession || '2024-28').trim();
    const semester = String(rawRow?.semester || 'Semester 1').trim();
    const departmentName = String(rawRow?.departmentName || '').trim() || 'General';
    const paperTitle = rawRow?.paperTitle ? String(rawRow.paperTitle).trim() : undefined;
    const subjectInfo = rawRow?.subjectInfo ? String(rawRow.subjectInfo).trim() : undefined;
    const isActive = rawRow?.isActive !== undefined ? Boolean(rawRow.isActive) : true;

    if (!subjectCode || !subjectName) {
      errors.push(`Row ${idx + 1}: Missing Subject Code or Subject Name.`);
      skippedCount += 1;
      return;
    }

    const key = `${subjectCode.toUpperCase()}__${session}__${semester}`;
    const existing = existingByKey.get(key);

    if (existing) {
      if (duplicateStrategy === 'update') {
        const merged: SubjectUpdateItem = stripUndefined({
          id: existing.id,
          subjectCode,
          subjectName,
          category,
          session,
          semester,
          departmentName,
          paperTitle: paperTitle || existing.item.paperTitle,
          subjectInfo: subjectInfo || existing.item.subjectInfo,
          isActive,
          createdBy: existing.item.createdBy || adminUsername,
          updatedBy: adminUsername,
          createdAt: existing.item.createdAt || now,
          updatedAt: now,
        });
        ops.push({ id: existing.id, data: merged });
        existingByKey.set(key, { id: existing.id, item: merged });
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
      return;
    }

    const id = makeId('susubj');
    const created: SubjectUpdateItem = stripUndefined({
      id,
      subjectCode,
      subjectName,
      category,
      session,
      semester,
      departmentName,
      paperTitle,
      subjectInfo,
      isActive,
      createdBy: adminUsername,
      updatedBy: adminUsername,
      createdAt: now,
      updatedAt: now,
    });
    ops.push({ id, data: created });
    existingByKey.set(key, { id, item: created });
    createdCount += 1;
  });

  for (let i = 0; i < ops.length; i += 350) {
    const chunk = ops.slice(i, i + 350);
    const batch = writeBatch(db);
    for (const op of chunk) {
      batch.set(doc(db, COLLECTIONS.subjects, op.id), op.data);
    }
    await batch.commit();
  }

  return {
    createdCount,
    updatedCount,
    skippedCount,
    errors,
  };
}

// --- Sessions CRUD ---

export async function createSessionServer(payload: {
  sessionName: string;
  isActive?: boolean;
}): Promise<SubjectUpdateSession> {
  const db = getDb();
  const sessionName = String(payload.sessionName || '').trim();
  if (!sessionName) throw new Error('Session name is required (e.g. 2027-31).');

  const existingSnap = await getDocs(collection(db, COLLECTIONS.sessions));
  const dup = existingSnap.docs.find(
    (d) => String((d.data() as SubjectUpdateSession).sessionName || '').trim().toLowerCase() === sessionName.toLowerCase()
  );
  if (dup) {
    throw new Error(`Session "${sessionName}" already exists.`);
  }

  const now = new Date().toISOString();
  const id = makeId('susess');
  const record: SubjectUpdateSession = {
    id,
    sessionName,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, COLLECTIONS.sessions, id), record);
  return record;
}

export async function updateSessionServer(
  id: string,
  payload: { sessionName?: string; isActive?: boolean }
): Promise<SubjectUpdateSession> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.sessions, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session record not found.');

  const existing = snap.data() as SubjectUpdateSession;
  const sessionName =
    payload.sessionName !== undefined ? String(payload.sessionName).trim() : existing.sessionName;
  if (!sessionName) throw new Error('Session name cannot be empty.');

  const allSnap = await getDocs(collection(db, COLLECTIONS.sessions));
  const dup = allSnap.docs.find(
    (d) =>
      d.id !== id &&
      String((d.data() as SubjectUpdateSession).sessionName || '').trim().toLowerCase() === sessionName.toLowerCase()
  );
  if (dup) {
    throw new Error(`Session "${sessionName}" already exists.`);
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateSession = {
    id,
    sessionName,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  await setDoc(ref, updated);
  return updated;
}

export async function deleteSessionServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.sessions, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session record not found.');
  await deleteDoc(ref);
}

// --- Semesters CRUD ---

export async function createSemesterServer(payload: {
  semesterName: string;
  order?: number;
  isActive?: boolean;
}): Promise<SubjectUpdateSemester> {
  const db = getDb();
  const semesterName = String(payload.semesterName || '').trim();
  if (!semesterName) throw new Error('Semester name is required.');

  const existingSnap = await getDocs(collection(db, COLLECTIONS.semesters));
  const dup = existingSnap.docs.find(
    (d) =>
      String((d.data() as SubjectUpdateSemester).semesterName || '').trim().toLowerCase() ===
      semesterName.toLowerCase()
  );
  if (dup) {
    throw new Error(`Semester "${semesterName}" already exists.`);
  }

  const maxOrder = existingSnap.docs.reduce(
    (max, d) => Math.max(max, Number((d.data() as SubjectUpdateSemester).order || 0)),
    0
  );
  const order =
    payload.order !== undefined && !isNaN(Number(payload.order)) && Number(payload.order) > 0
      ? Math.floor(Number(payload.order))
      : maxOrder + 1;

  const now = new Date().toISOString();
  const id = makeId('susem');
  const record: SubjectUpdateSemester = {
    id,
    semesterName,
    order,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, COLLECTIONS.semesters, id), record);
  return record;
}

export async function updateSemesterServer(
  id: string,
  payload: { semesterName?: string; order?: number; isActive?: boolean }
): Promise<SubjectUpdateSemester> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.semesters, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Semester record not found.');

  const existing = snap.data() as SubjectUpdateSemester;
  const semesterName =
    payload.semesterName !== undefined ? String(payload.semesterName).trim() : existing.semesterName;
  if (!semesterName) throw new Error('Semester name cannot be empty.');

  const allSnap = await getDocs(collection(db, COLLECTIONS.semesters));
  const dup = allSnap.docs.find(
    (d) =>
      d.id !== id &&
      String((d.data() as SubjectUpdateSemester).semesterName || '').trim().toLowerCase() ===
        semesterName.toLowerCase()
  );
  if (dup) {
    throw new Error(`Semester "${semesterName}" already exists.`);
  }

  const order =
    payload.order !== undefined && !isNaN(Number(payload.order)) && Number(payload.order) > 0
      ? Math.floor(Number(payload.order))
      : existing.order;

  const now = new Date().toISOString();
  const updated: SubjectUpdateSemester = {
    id,
    semesterName,
    order,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  await setDoc(ref, updated);
  return updated;
}

export async function deleteSemesterServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.semesters, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Semester record not found.');
  await deleteDoc(ref);
}

// --- Categories CRUD ---

export async function createCategoryServer(payload: {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
}): Promise<SubjectUpdateCategory> {
  const db = getDb();
  const code = String(payload.code || '').trim().toUpperCase();
  const label = String(payload.label || '').trim();
  const description = payload.description !== undefined ? String(payload.description).trim() : '';

  if (!code) throw new Error('Category code is required (e.g. MJC, MIC, MDC).');
  if (!label) throw new Error('Category label is required.');

  const existingSnap = await getDocs(collection(db, COLLECTIONS.categories));
  const dup = existingSnap.docs.find(
    (d) => String((d.data() as SubjectUpdateCategory).code || '').trim().toUpperCase() === code
  );
  if (dup) {
    throw new Error(`Category code "${code}" already exists.`);
  }

  const now = new Date().toISOString();
  const id = makeId('sucat');
  const record: SubjectUpdateCategory = stripUndefined({
    id,
    code,
    label,
    description: description || undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, COLLECTIONS.categories, id), record);
  return record;
}

export async function updateCategoryServer(
  id: string,
  payload: { code?: string; label?: string; description?: string; isActive?: boolean }
): Promise<SubjectUpdateCategory> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.categories, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Category record not found.');

  const existing = snap.data() as SubjectUpdateCategory;
  const code = payload.code !== undefined ? String(payload.code).trim().toUpperCase() : existing.code;
  const label = payload.label !== undefined ? String(payload.label).trim() : existing.label;
  const description =
    payload.description !== undefined ? String(payload.description).trim() : existing.description;

  if (!code) throw new Error('Category code cannot be empty.');
  if (!label) throw new Error('Category label cannot be empty.');

  const allSnap = await getDocs(collection(db, COLLECTIONS.categories));
  const dup = allSnap.docs.find(
    (d) => d.id !== id && String((d.data() as SubjectUpdateCategory).code || '').trim().toUpperCase() === code
  );
  if (dup) {
    throw new Error(`Category code "${code}" already exists.`);
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateCategory = stripUndefined({
    id,
    code,
    label,
    description: description || undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });
  await setDoc(ref, updated);
  return updated;
}

export async function deleteCategoryServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.categories, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Category record not found.');
  await deleteDoc(ref);
}

// --- Departments CRUD ---

export async function createDepartmentServer(payload: {
  code: string;
  name: string;
  info?: string;
  isActive?: boolean;
}): Promise<SubjectUpdateDepartment> {
  const db = getDb();
  const code = String(payload.code || '').trim().toUpperCase();
  const name = String(payload.name || '').trim();
  const info = payload.info !== undefined ? String(payload.info).trim() : '';

  if (!code) throw new Error('Department code is required.');
  if (!name) throw new Error('Department name is required.');

  const existingSnap = await getDocs(collection(db, COLLECTIONS.departments));
  const dup = existingSnap.docs.find((d) => {
    const data = d.data() as SubjectUpdateDepartment;
    return (
      String(data.code || '').trim().toUpperCase() === code ||
      String(data.name || '').trim().toLowerCase() === name.toLowerCase()
    );
  });
  if (dup) {
    throw new Error(`Department "${name}" (${code}) already exists.`);
  }

  const now = new Date().toISOString();
  const id = makeId('sudept');
  const record: SubjectUpdateDepartment = stripUndefined({
    id,
    code,
    name,
    info: info || undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdAt: now,
    updatedAt: now,
  });
  await setDoc(doc(db, COLLECTIONS.departments, id), record);
  return record;
}

export async function updateDepartmentServer(
  id: string,
  payload: { code?: string; name?: string; info?: string; isActive?: boolean }
): Promise<SubjectUpdateDepartment> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.departments, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Department record not found.');

  const existing = snap.data() as SubjectUpdateDepartment;
  const code = payload.code !== undefined ? String(payload.code).trim().toUpperCase() : existing.code;
  const name = payload.name !== undefined ? String(payload.name).trim() : existing.name;
  const info = payload.info !== undefined ? String(payload.info).trim() : existing.info;

  if (!code) throw new Error('Department code cannot be empty.');
  if (!name) throw new Error('Department name cannot be empty.');

  const allSnap = await getDocs(collection(db, COLLECTIONS.departments));
  const dup = allSnap.docs.find((d) => {
    if (d.id === id) return false;
    const data = d.data() as SubjectUpdateDepartment;
    return (
      String(data.code || '').trim().toUpperCase() === code ||
      String(data.name || '').trim().toLowerCase() === name.toLowerCase()
    );
  });
  if (dup) {
    throw new Error(`Department "${name}" (${code}) already exists.`);
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateDepartment = stripUndefined({
    id,
    code,
    name,
    info: info || undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });
  await setDoc(ref, updated);
  return updated;
}

export async function deleteDepartmentServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.departments, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Department record not found.');
  await deleteDoc(ref);
}

// --- Settings ---

export async function saveSubjectUpdateSystemSettingsServer(
  payload: Partial<SubjectUpdateSystemSettings>,
  adminUsername: string
): Promise<SubjectUpdateSystemSettings> {
  const db = getDb();
  const current = await getSystemSettingsOnly();
  const now = new Date().toISOString();

  const updated: SubjectUpdateSystemSettings = {
    id: 'default',
    systemTitle:
      payload.systemTitle !== undefined && String(payload.systemTitle).trim()
        ? String(payload.systemTitle).trim()
        : current.systemTitle,
    institutionName:
      payload.institutionName !== undefined && String(payload.institutionName).trim()
        ? String(payload.institutionName).trim()
        : current.institutionName,
    defaultSession:
      payload.defaultSession !== undefined && String(payload.defaultSession).trim()
        ? String(payload.defaultSession).trim()
        : current.defaultSession,
    defaultCategory:
      payload.defaultCategory !== undefined && String(payload.defaultCategory).trim()
        ? String(payload.defaultCategory).trim().toUpperCase()
        : current.defaultCategory,
    enforceUppercaseCodes:
      payload.enforceUppercaseCodes !== undefined
        ? Boolean(payload.enforceUppercaseCodes)
        : current.enforceUppercaseCodes,
    preventDuplicateCodes:
      payload.preventDuplicateCodes !== undefined
        ? Boolean(payload.preventDuplicateCodes)
        : current.preventDuplicateCodes,
    notes: payload.notes !== undefined ? String(payload.notes).trim() : current.notes,
    updatedBy: adminUsername,
    updatedAt: now,
  };

  await setDoc(doc(db, COLLECTIONS.settings, 'default'), updated);
  return updated;
}

// ============================================================================
// SUBJECT COMBINATION MANAGEMENT CRUD
// ============================================================================

export interface CombinationInputPayload {
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

async function resolveSubjectsByIds(subjectIds: string[]): Promise<SubjectUpdateItem[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, COLLECTIONS.subjects));
  const map = new Map<string, SubjectUpdateItem>();
  for (const d of snap.docs) {
    map.set(d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) });
  }
  const uniqueIds = Array.from(new Set(subjectIds.map((id) => String(id).trim()).filter(Boolean)));
  const resolved: SubjectUpdateItem[] = [];
  for (const id of uniqueIds) {
    const item = map.get(id);
    if (!item) {
      throw new Error(`Selected subject (${id}) was not found.`);
    }
    resolved.push(item);
  }
  return resolved;
}

export async function createCombinationServer(
  payload: CombinationInputPayload,
  adminUsername: string
): Promise<SubjectUpdateCombination> {
  const db = getDb();
  const settings = await getSystemSettingsOnly();

  const rawCode = String(payload.combinationCode || '').trim();
  const combinationCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const category = String(payload.category || '').trim().toUpperCase();
  const subjectCount = Math.floor(Number(payload.subjectCount || 0));
  const rawSubjectIds = Array.isArray(payload.subjectIds) ? payload.subjectIds : [];

  if (!combinationCode) throw new Error('Combination Code is required.');
  if (!session) throw new Error('Academic Session is required.');
  if (!semester) throw new Error('Semester is required.');
  if (!category) throw new Error('Category is required.');
  if (isNaN(subjectCount) || subjectCount < 1) {
    throw new Error('Subject Count must be at least 1.');
  }

  const resolvedSubjects = await resolveSubjectsByIds(rawSubjectIds);
  if (resolvedSubjects.length !== subjectCount) {
    throw new Error(
      `Combination is configured for ${subjectCount} subject(s), but ${resolvedSubjects.length} selected.`
    );
  }

  const existingSnap = await getDocs(collection(db, COLLECTIONS.combinations));
  const dup = existingSnap.docs.find((d) => {
    const c = d.data() as SubjectUpdateCombination;
    return (
      String(c.combinationCode || '').trim().toUpperCase() === combinationCode.toUpperCase() &&
      String(c.session || '').trim() === session &&
      String(c.semester || '').trim() === semester
    );
  });
  if (dup) {
    throw new Error(`Combination code "${combinationCode}" already exists in ${session} (${semester}).`);
  }

  const subjectIds = resolvedSubjects.map((s) => s.id);
  const subjectCodes = resolvedSubjects.map((s) => s.subjectCode);
  const subjectNames = resolvedSubjects.map((s) => s.subjectName);
  const combinationName =
    String(payload.combinationName || '').trim() || subjectNames.join(' + ');

  const now = new Date().toISOString();
  const id = makeId('sucomb');
  const record: SubjectUpdateCombination = stripUndefined({
    id,
    combinationCode,
    combinationName,
    session,
    semester,
    category,
    subjectCount,
    subjectIds,
    subjectCodes,
    subjectNames,
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.combinations, id), record);
  return record;
}

export async function updateCombinationServer(
  id: string,
  payload: Partial<CombinationInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateCombination> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.combinations, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Subject combination record not found.');

  const existing = snap.data() as SubjectUpdateCombination;
  const settings = await getSystemSettingsOnly();

  const rawCode =
    payload.combinationCode !== undefined
      ? String(payload.combinationCode).trim()
      : existing.combinationCode;
  const combinationCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const category =
    payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;
  const subjectCount =
    payload.subjectCount !== undefined ? Math.floor(Number(payload.subjectCount)) : existing.subjectCount;

  if (!combinationCode) throw new Error('Combination Code cannot be empty.');
  if (!session || !semester || !category) throw new Error('Session, Semester, and Category are required.');
  if (isNaN(subjectCount) || subjectCount < 1) throw new Error('Subject Count must be at least 1.');

  const subjectIdsInput = Array.isArray(payload.subjectIds) ? payload.subjectIds : existing.subjectIds;
  const resolvedSubjects = await resolveSubjectsByIds(subjectIdsInput);
  if (resolvedSubjects.length !== subjectCount) {
    throw new Error(
      `Combination is configured for ${subjectCount} subject(s), but ${resolvedSubjects.length} selected.`
    );
  }

  const allSnap = await getDocs(collection(db, COLLECTIONS.combinations));
  const dup = allSnap.docs.find((d) => {
    if (d.id === id) return false;
    const c = d.data() as SubjectUpdateCombination;
    return (
      String(c.combinationCode || '').trim().toUpperCase() === combinationCode.toUpperCase() &&
      String(c.session || '').trim() === session &&
      String(c.semester || '').trim() === semester
    );
  });
  if (dup) {
    throw new Error(`Combination code "${combinationCode}" already exists in ${session} (${semester}).`);
  }

  const subjectIds = resolvedSubjects.map((s) => s.id);
  const subjectCodes = resolvedSubjects.map((s) => s.subjectCode);
  const subjectNames = resolvedSubjects.map((s) => s.subjectName);
  const combinationName =
    payload.combinationName !== undefined
      ? String(payload.combinationName).trim() || subjectNames.join(' + ')
      : existing.combinationName;

  const now = new Date().toISOString();
  const updated: SubjectUpdateCombination = stripUndefined({
    id,
    combinationCode,
    combinationName,
    session,
    semester,
    category,
    subjectCount,
    subjectIds,
    subjectCodes,
    subjectNames,
    notes:
      payload.notes !== undefined
        ? String(payload.notes).trim() || undefined
        : existing.notes,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  return updated;
}

export async function deleteCombinationServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.combinations, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Subject combination record not found.');
  await deleteDoc(ref);
}

// ============================================================================
// STUDENT ALLOCATION, EXCEL UPLOAD & GROUP MATCHING
// ============================================================================

function normalizeText(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function splitSubjectTokens(rawSubjectText: string): string[] {
  const raw = String(rawSubjectText || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,;+|/]+|\s+&\s+|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [raw];
}

function matchStudentSubjectsAndCombination(
  rawSubjectText: string,
  session: string,
  semester: string,
  category: string,
  allSubjects: SubjectUpdateItem[],
  allCombinations: SubjectUpdateCombination[],
  allGroups: SubjectUpdateStudentGroup[]
): {
  matchedSubjectIds: string[];
  matchedSubjectNames: string[];
  combinationId?: string;
  combinationName?: string;
  groupId?: string;
  groupName?: string;
  allocationStatus: SubjectUpdateAllocationStatus;
} {
  const normRaw = normalizeText(rawSubjectText);
  const tokens = splitSubjectTokens(rawSubjectText);

  // Scoped subjects for session & semester (+ category unless category is ALL)
  const scopedSubjects = allSubjects.filter(
    (s) =>
      s.session === session &&
      s.semester === semester &&
      (!category || category === 'ALL' || s.category === category)
  );
  const fallbackSessionSubjects =
    scopedSubjects.length > 0
      ? scopedSubjects
      : allSubjects.filter((s) => s.session === session);
  const candidateSubjects = fallbackSessionSubjects.length > 0 ? fallbackSessionSubjects : allSubjects;

  const findSubjectMatch = (token: string): SubjectUpdateItem | undefined => {
    const nTok = normalizeText(token);
    if (!nTok) return undefined;
    // Exact code, exact name, or exact departmentName match first
    const exact = candidateSubjects.find(
      (s) =>
        normalizeText(s.subjectCode) === nTok ||
        normalizeText(s.subjectName) === nTok ||
        normalizeText(s.departmentName) === nTok
    );
    if (exact) return exact;

    // Contains match (if token >= 3 chars)
    if (nTok.length >= 3) {
      return candidateSubjects.find(
        (s) =>
          normalizeText(s.subjectName).includes(nTok) ||
          nTok.includes(normalizeText(s.subjectName)) ||
          normalizeText(s.subjectCode).includes(nTok)
      );
    }
    return undefined;
  };

  const matchedMap = new Map<string, SubjectUpdateItem>();
  // Check full string first (in case subject name contains '&' or '/')
  const fullMatch = findSubjectMatch(rawSubjectText);
  if (fullMatch) {
    matchedMap.set(fullMatch.id, fullMatch);
  }
  let unresolvedTokens = 0;
  for (const tok of tokens) {
    const m = findSubjectMatch(tok);
    if (m) {
      matchedMap.set(m.id, m);
    } else if (!fullMatch) {
      unresolvedTokens += 1;
    }
  }

  // Scoped combinations
  const scopedCombinations = allCombinations.filter(
    (c) =>
      c.isActive &&
      c.session === session &&
      c.semester === semester &&
      (!category || category === 'ALL' || c.category === category)
  );

  // 1. Direct match by combination code or name
  let matchedCombination = scopedCombinations.find(
    (c) =>
      normalizeText(c.combinationCode) === normRaw ||
      normalizeText(c.combinationName) === normRaw
  );

  // If direct combination matched, populate its subjects if matchedMap wasn't complete
  if (matchedCombination) {
    const subjById = new Map(allSubjects.map((s) => [s.id, s]));
    for (const sid of matchedCombination.subjectIds) {
      const s = subjById.get(sid);
      if (s) matchedMap.set(s.id, s);
    }
    unresolvedTokens = 0;
  } else if (matchedMap.size > 0) {
    // 2. Match combination whose subjects match all or subset of matchedMap (prefer exact size match, then largest matching)
    const matchedIds = new Set(Array.from(matchedMap.keys()));
    const exactComb = scopedCombinations.find(
      (c) =>
        c.subjectIds.length === matchedIds.size &&
        c.subjectIds.every((id) => matchedIds.has(id))
    );
    if (exactComb) {
      matchedCombination = exactComb;
    } else {
      const contained = scopedCombinations
        .filter((c) => c.subjectIds.length > 0 && c.subjectIds.every((id) => matchedIds.has(id)))
        .sort((a, b) => b.subjectIds.length - a.subjectIds.length);
      if (contained.length > 0) {
        matchedCombination = contained[0];
      }
    }
  }

  const matchedSubjects = Array.from(matchedMap.values());
  const matchedSubjectIds = matchedSubjects.map((s) => s.id);
  const matchedSubjectNames = matchedSubjects.map((s) => s.subjectName);

  // Auto-link unambiguous group if exactly 1 matching active group exists
  const candidateGroups = allGroups.filter(
    (g) => g.isActive && g.session === session && g.semester === semester
  );
  let matchedGroup: SubjectUpdateStudentGroup | undefined;
  if (matchedCombination) {
    const combGroups = candidateGroups.filter((g) => g.combinationId === matchedCombination!.id);
    if (combGroups.length === 1) matchedGroup = combGroups[0];
  } else if (matchedSubjectIds.length === 1) {
    const subjGroups = candidateGroups.filter((g) => g.subjectId === matchedSubjectIds[0]);
    if (subjGroups.length === 1) matchedGroup = subjGroups[0];
  }

  let allocationStatus: SubjectUpdateAllocationStatus = 'UNMATCHED';
  if (matchedCombination || (matchedSubjectIds.length > 0 && unresolvedTokens === 0)) {
    allocationStatus = 'ALLOCATED';
  } else if (matchedSubjectIds.length > 0) {
    allocationStatus = 'PARTIAL';
  }

  return {
    matchedSubjectIds,
    matchedSubjectNames,
    combinationId: matchedCombination?.id,
    combinationName: matchedCombination?.combinationName,
    groupId: matchedGroup?.id,
    groupName: matchedGroup?.groupName,
    allocationStatus,
  };
}

export interface StudentInputPayload {
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

export async function createStudentServer(
  payload: StudentInputPayload,
  adminUsername: string
): Promise<SubjectUpdateStudent> {
  const db = getDb();
  const studentName = String(payload.studentName || '').trim();
  const applicationNoInput = String(payload.applicationNo || '').trim();
  const rollInput = String(payload.rollNumber || '').trim();
  const rollNumber = rollInput || applicationNoInput;
  const applicationNo = applicationNoInput || rollInput;
  const departmentName = String(payload.departmentName || '').trim() || 'General';
  const rawSubjectText = String(payload.rawSubjectText || '').trim();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const category = String(payload.category || '').trim().toUpperCase() || 'MAJOR';
  const sn = String(payload.sn || '').trim() || '1';

  if (!studentName) throw new Error('Student Name is required.');
  if (!rollNumber && !applicationNo) throw new Error('Application No. or Roll Number is required.');
  if (!session || !semester) throw new Error('Session and Semester are required.');

  const [studSnap, subjSnap, combSnap, groupSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);

  const dup = studSnap.docs.find((d) => {
    const s = d.data() as SubjectUpdateStudent;
    const sameApp =
      applicationNo &&
      s.applicationNo &&
      normalizeText(s.applicationNo) === normalizeText(applicationNo);
    const sameRoll = normalizeText(s.rollNumber) === normalizeText(rollNumber);
    return (sameApp || sameRoll) && s.session === session && s.semester === semester;
  });
  if (dup) {
    throw new Error(
      `Student "${applicationNo || rollNumber}" already exists in ${session} (${semester}).`
    );
  }

  const allSubjects = subjSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }));
  const allCombinations = combSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCombination, 'id'>) }));
  const allGroups = groupSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudentGroup, 'id'>) }));

  let allocation = matchStudentSubjectsAndCombination(
    rawSubjectText,
    session,
    semester,
    category,
    allSubjects,
    allCombinations,
    allGroups
  );

  // Honor explicit manual selections if provided
  if (Array.isArray(payload.matchedSubjectIds) && payload.matchedSubjectIds.length > 0) {
    const subjMap = new Map(allSubjects.map((s) => [s.id, s]));
    const manualSubjs = payload.matchedSubjectIds
      .map((id) => subjMap.get(id))
      .filter((s): s is SubjectUpdateItem => Boolean(s));
    allocation.matchedSubjectIds = manualSubjs.map((s) => s.id);
    allocation.matchedSubjectNames = manualSubjs.map((s) => s.subjectName);
    allocation.allocationStatus = 'ALLOCATED';
  }
  if (payload.combinationId) {
    const comb = allCombinations.find((c) => c.id === payload.combinationId);
    if (comb) {
      allocation.combinationId = comb.id;
      allocation.combinationName = comb.combinationName;
      allocation.allocationStatus = 'ALLOCATED';
    }
  }
  if (payload.groupId) {
    const grp = allGroups.find((g) => g.id === payload.groupId);
    if (grp) {
      allocation.groupId = grp.id;
      allocation.groupName = grp.groupName;
    }
  }

  const now = new Date().toISOString();
  const id = makeId('sustud');
  const record: SubjectUpdateStudent = stripUndefined({
    id,
    sn,
    applicationNo,
    studentName,
    rollNumber,
    departmentName,
    rawSubjectText: rawSubjectText || allocation.matchedSubjectNames.join(', '),
    session,
    semester,
    category,
    matchedSubjectIds: allocation.matchedSubjectIds,
    matchedSubjectNames: allocation.matchedSubjectNames,
    combinationId: allocation.combinationId,
    combinationName: allocation.combinationName,
    groupId: allocation.groupId,
    groupName: allocation.groupName,
    allocationStatus: allocation.allocationStatus,
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.students, id), record);

  // Sync student into group's studentIds array if assigned
  if (record.groupId) {
    const grp = allGroups.find((g) => g.id === record.groupId);
    if (grp && !grp.studentIds.includes(record.id)) {
      await setDoc(doc(db, COLLECTIONS.groups, grp.id), {
        ...grp,
        studentIds: [...grp.studentIds, record.id],
        updatedAt: now,
      });
    }
  }

  return record;
}

export async function updateStudentServer(
  id: string,
  payload: Partial<StudentInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateStudent> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.students, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Student record not found.');

  const existing = snap.data() as SubjectUpdateStudent;

  const studentName =
    payload.studentName !== undefined ? String(payload.studentName).trim() : existing.studentName;
  const applicationNo =
    payload.applicationNo !== undefined
      ? String(payload.applicationNo).trim()
      : existing.applicationNo || existing.rollNumber;
  const rollNumber =
    payload.rollNumber !== undefined
      ? String(payload.rollNumber).trim() || applicationNo
      : existing.rollNumber;
  const departmentName =
    payload.departmentName !== undefined
      ? String(payload.departmentName).trim() || 'General'
      : existing.departmentName || 'General';
  const sn = payload.sn !== undefined ? String(payload.sn).trim() : existing.sn;
  const rawSubjectText =
    payload.rawSubjectText !== undefined
      ? String(payload.rawSubjectText).trim()
      : existing.rawSubjectText;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const category =
    payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;

  if (!studentName || (!rollNumber && !applicationNo)) {
    throw new Error('Student Name and Application No. / Roll Number cannot be empty.');
  }

  const [studSnap, subjSnap, combSnap, groupSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);

  const dup = studSnap.docs.find((d) => {
    if (d.id === id) return false;
    const s = d.data() as SubjectUpdateStudent;
    return (
      normalizeText(s.rollNumber) === normalizeText(rollNumber) &&
      s.session === session &&
      s.semester === semester
    );
  });
  if (dup) {
    throw new Error(`Roll No. "${rollNumber}" already exists in ${session} (${semester}).`);
  }

  const allSubjects = subjSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }));
  const allCombinations = combSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCombination, 'id'>) }));
  const allGroups = groupSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudentGroup, 'id'>) }));

  let matchedSubjectIds = existing.matchedSubjectIds || [];
  let matchedSubjectNames = existing.matchedSubjectNames || [];
  let combinationId = existing.combinationId;
  let combinationName = existing.combinationName;
  let groupId = existing.groupId;
  let groupName = existing.groupName;
  let allocationStatus = existing.allocationStatus;

  if (payload.matchedSubjectIds !== undefined) {
    const subjMap = new Map(allSubjects.map((s) => [s.id, s]));
    const resolved = payload.matchedSubjectIds
      .map((sid) => subjMap.get(sid))
      .filter((s): s is SubjectUpdateItem => Boolean(s));
    matchedSubjectIds = resolved.map((s) => s.id);
    matchedSubjectNames = resolved.map((s) => s.subjectName);
  } else if (payload.rawSubjectText !== undefined && payload.rawSubjectText !== existing.rawSubjectText) {
    const auto = matchStudentSubjectsAndCombination(
      rawSubjectText,
      session,
      semester,
      category,
      allSubjects,
      allCombinations,
      allGroups
    );
    matchedSubjectIds = auto.matchedSubjectIds;
    matchedSubjectNames = auto.matchedSubjectNames;
    combinationId = auto.combinationId;
    combinationName = auto.combinationName;
    allocationStatus = auto.allocationStatus;
  }

  if (payload.combinationId !== undefined) {
    if (!payload.combinationId) {
      combinationId = undefined;
      combinationName = undefined;
    } else {
      const comb = allCombinations.find((c) => c.id === payload.combinationId);
      if (comb) {
        combinationId = comb.id;
        combinationName = comb.combinationName;
        if (matchedSubjectIds.length === 0) {
          matchedSubjectIds = [...comb.subjectIds];
          matchedSubjectNames = [...comb.subjectNames];
        }
      }
    }
  }

  if (payload.groupId !== undefined) {
    if (!payload.groupId) {
      groupId = undefined;
      groupName = undefined;
    } else {
      const grp = allGroups.find((g) => g.id === payload.groupId);
      if (grp) {
        groupId = grp.id;
        groupName = grp.groupName;
      }
    }
  }

  if (combinationId || matchedSubjectIds.length > 0) {
    allocationStatus = 'ALLOCATED';
  } else {
    allocationStatus = 'UNMATCHED';
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateStudent = stripUndefined({
    id,
    sn,
    applicationNo,
    studentName,
    rollNumber,
    departmentName,
    rawSubjectText,
    session,
    semester,
    category,
    matchedSubjectIds,
    matchedSubjectNames,
    combinationId,
    combinationName,
    groupId,
    groupName,
    selectionFormId: existing.selectionFormId,
    selectionFormName: existing.selectionFormName,
    allocationStatus,
    notes:
      payload.notes !== undefined
        ? String(payload.notes).trim() || undefined
        : existing.notes,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);

  // Sync group membership changes if groupId changed
  if (existing.groupId !== updated.groupId) {
    if (existing.groupId) {
      const oldGrp = allGroups.find((g) => g.id === existing.groupId);
      if (oldGrp) {
        await setDoc(doc(db, COLLECTIONS.groups, oldGrp.id), {
          ...oldGrp,
          studentIds: oldGrp.studentIds.filter((sid) => sid !== id),
          updatedAt: now,
        });
      }
    }
    if (updated.groupId) {
      const newGrp = allGroups.find((g) => g.id === updated.groupId);
      if (newGrp && !newGrp.studentIds.includes(id)) {
        await setDoc(doc(db, COLLECTIONS.groups, newGrp.id), {
          ...newGrp,
          studentIds: [...newGrp.studentIds, id],
          updatedAt: now,
        });
      }
    }
  }

  return updated;
}

export async function deleteStudentServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.students, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Student record not found.');
  const existing = snap.data() as SubjectUpdateStudent;

  await deleteDoc(ref);

  if (existing.groupId) {
    const grpRef = doc(db, COLLECTIONS.groups, existing.groupId);
    const grpSnap = await getDoc(grpRef);
    if (grpSnap.exists()) {
      const grp = grpSnap.data() as SubjectUpdateStudentGroup;
      await setDoc(grpRef, {
        ...grp,
        studentIds: (grp.studentIds || []).filter((sid) => sid !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function uploadStudentsBatchServer(
  payload: {
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
    duplicateStrategy?: 'skip' | 'update';
  },
  adminUsername: string
): Promise<{
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  allocatedCount: number;
  partialCount: number;
  unmatchedCount: number;
  errors: string[];
}> {
  const rows = payload.rows;
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const defaultDept = String(payload.departmentName || '').trim() || 'General';
  const category = String(payload.category || '').trim().toUpperCase() || 'MAJOR';
  const duplicateStrategy = payload.duplicateStrategy === 'update' ? 'update' : 'skip';

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Excel upload must contain at least one student row.');
  }
  if (rows.length > 2000) {
    throw new Error('Excel upload is limited to 2,000 student rows per batch.');
  }
  if (!session || !semester) {
    throw new Error('Academic Session and Semester must be selected for student upload.');
  }

  const db = getDb();
  const [studSnap, subjSnap, combSnap, groupSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);

  const allSubjects = subjSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }));
  const allCombinations = combSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCombination, 'id'>) }));
  const allGroups = groupSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudentGroup, 'id'>) }));

  const existingByKey = new Map<string, SubjectUpdateStudent>();
  for (const d of studSnap.docs) {
    const s = { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) };
    const idKey = normalizeText(s.applicationNo || s.rollNumber);
    const key = `${idKey}__${s.session}__${s.semester}`;
    existingByKey.set(key, s);
    const rollKey = `${normalizeText(s.rollNumber)}__${s.session}__${s.semester}`;
    existingByKey.set(rollKey, s);
  }

  const now = new Date().toISOString();
  const ops: SubjectUpdateStudent[] = [];
  const errors: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let allocatedCount = 0;
  let partialCount = 0;
  let unmatchedCount = 0;

  rows.forEach((rawRow, idx) => {
    const studentName = String(rawRow?.studentName || '').trim();
    const rawAppNo = String(rawRow?.applicationNo || '').trim();
    const rawRoll = String(rawRow?.rollNumber || '').trim();
    const applicationNo = rawAppNo || rawRoll;
    const rollNumber = rawRoll || rawAppNo;
    const departmentName = String(rawRow?.departmentName || '').trim() || defaultDept;
    const rawSubjectText = String(rawRow?.rawSubjectText || '').trim();
    const sn =
      rawRow?.sn !== undefined && String(rawRow.sn).trim() !== ''
        ? String(rawRow.sn).trim()
        : String(idx + 1);

    if (!studentName || (!applicationNo && !rollNumber)) {
      errors.push(`Row ${idx + 1}: Missing NAME OF STUDENT or APPLICATION NO. / ROLL NO.`);
      skippedCount += 1;
      return;
    }

    const auto = matchStudentSubjectsAndCombination(
      rawSubjectText,
      session,
      semester,
      category,
      allSubjects,
      allCombinations,
      allGroups
    );

    const key = `${normalizeText(applicationNo || rollNumber)}__${session}__${semester}`;
    const existing = existingByKey.get(key) || existingByKey.get(`${normalizeText(rollNumber)}__${session}__${semester}`);

    if (existing) {
      if (duplicateStrategy === 'update') {
        const merged: SubjectUpdateStudent = stripUndefined({
          id: existing.id,
          sn,
          applicationNo,
          studentName,
          rollNumber,
          departmentName,
          rawSubjectText: rawSubjectText || existing.rawSubjectText || '',
          session,
          semester,
          category,
          matchedSubjectIds:
            auto.matchedSubjectIds.length > 0 ? auto.matchedSubjectIds : existing.matchedSubjectIds || [],
          matchedSubjectNames:
            auto.matchedSubjectNames.length > 0 ? auto.matchedSubjectNames : existing.matchedSubjectNames || [],
          combinationId: auto.combinationId || existing.combinationId,
          combinationName: auto.combinationName || existing.combinationName,
          groupId: auto.groupId || existing.groupId,
          groupName: auto.groupName || existing.groupName,
          selectionFormId: existing.selectionFormId,
          selectionFormName: existing.selectionFormName,
          allocationStatus:
            auto.matchedSubjectIds.length > 0 ? auto.allocationStatus : existing.allocationStatus,
          notes: existing.notes,
          createdBy: existing.createdBy || adminUsername,
          updatedBy: adminUsername,
          createdAt: existing.createdAt || now,
          updatedAt: now,
        });
        ops.push(merged);
        existingByKey.set(key, merged);
        updatedCount += 1;
        if (merged.allocationStatus === 'ALLOCATED') allocatedCount += 1;
        else if (merged.allocationStatus === 'PARTIAL') partialCount += 1;
        else unmatchedCount += 1;
      } else {
        skippedCount += 1;
      }
      return;
    }

    const id = makeId('sustud');
    const created: SubjectUpdateStudent = stripUndefined({
      id,
      sn,
      applicationNo,
      studentName,
      rollNumber,
      departmentName,
      rawSubjectText,
      session,
      semester,
      category,
      matchedSubjectIds: auto.matchedSubjectIds,
      matchedSubjectNames: auto.matchedSubjectNames,
      combinationId: auto.combinationId,
      combinationName: auto.combinationName,
      groupId: auto.groupId,
      groupName: auto.groupName,
      allocationStatus: auto.allocationStatus,
      createdBy: adminUsername,
      updatedBy: adminUsername,
      createdAt: now,
      updatedAt: now,
    });
    ops.push(created);
    existingByKey.set(key, created);
    createdCount += 1;
    if (created.allocationStatus === 'ALLOCATED') allocatedCount += 1;
    else if (created.allocationStatus === 'PARTIAL') partialCount += 1;
    else unmatchedCount += 1;
  });

  for (let i = 0; i < ops.length; i += 350) {
    const chunk = ops.slice(i, i + 350);
    const batch = writeBatch(db);
    for (const studentDoc of chunk) {
      batch.set(doc(db, COLLECTIONS.students, studentDoc.id), studentDoc);
    }
    await batch.commit();
  }

  return {
    createdCount,
    updatedCount,
    skippedCount,
    allocatedCount,
    partialCount,
    unmatchedCount,
    errors,
  };
}

export async function autoAllocateStudentsServer(
  scope: { session?: string; semester?: string; category?: string },
  adminUsername: string
): Promise<{ updatedCount: number; allocatedCount: number; partialCount: number; unmatchedCount: number }> {
  const db = getDb();
  const [studSnap, subjSnap, combSnap, groupSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.groups)),
  ]);

  const allSubjects = subjSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }));
  const allCombinations = combSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateCombination, 'id'>) }));
  const allGroups = groupSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateStudentGroup, 'id'>) }));

  const now = new Date().toISOString();
  const ops: SubjectUpdateStudent[] = [];
  let allocatedCount = 0;
  let partialCount = 0;
  let unmatchedCount = 0;

  for (const d of studSnap.docs) {
    const s = { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) };
    if (scope.session && scope.session !== 'ALL' && s.session !== scope.session) continue;
    if (scope.semester && scope.semester !== 'ALL' && s.semester !== scope.semester) continue;
    if (scope.category && scope.category !== 'ALL' && s.category !== scope.category) continue;

    const auto = matchStudentSubjectsAndCombination(
      s.rawSubjectText,
      s.session,
      s.semester,
      s.category,
      allSubjects,
      allCombinations,
      allGroups
    );

    const updated = stripUndefined({
      ...s,
      matchedSubjectIds: auto.matchedSubjectIds,
      matchedSubjectNames: auto.matchedSubjectNames,
      combinationId: auto.combinationId,
      combinationName: auto.combinationName,
      groupId: s.groupId || auto.groupId,
      groupName: s.groupName || auto.groupName,
      allocationStatus: auto.allocationStatus,
      updatedBy: adminUsername,
      updatedAt: now,
    });
    ops.push(updated);
    if (updated.allocationStatus === 'ALLOCATED') allocatedCount += 1;
    else if (updated.allocationStatus === 'PARTIAL') partialCount += 1;
    else unmatchedCount += 1;
  }

  for (let i = 0; i < ops.length; i += 350) {
    const chunk = ops.slice(i, i + 350);
    const batch = writeBatch(db);
    for (const studentDoc of chunk) {
      batch.set(doc(db, COLLECTIONS.students, studentDoc.id), studentDoc);
    }
    await batch.commit();
  }

  return {
    updatedCount: ops.length,
    allocatedCount,
    partialCount,
    unmatchedCount,
  };
}

// ============================================================================
// STUDENT GROUP MANAGEMENT CRUD
// ============================================================================

export interface GroupInputPayload {
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

async function syncGroupMembershipOnStudents(
  group: SubjectUpdateStudentGroup,
  previousStudentIds: string[],
  adminUsername: string
): Promise<void> {
  const db = getDb();
  const studSnap = await getDocs(collection(db, COLLECTIONS.students));
  const newSet = new Set(group.studentIds);
  const oldSet = new Set(previousStudentIds);
  const now = new Date().toISOString();

  const updates: SubjectUpdateStudent[] = [];
  for (const d of studSnap.docs) {
    const s = { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) };
    if (newSet.has(s.id) && (s.groupId !== group.id || s.groupName !== group.groupName)) {
      updates.push(
        stripUndefined({
          ...s,
          groupId: group.id,
          groupName: group.groupName,
          updatedBy: adminUsername,
          updatedAt: now,
        })
      );
    } else if (!newSet.has(s.id) && oldSet.has(s.id) && s.groupId === group.id) {
      const { groupId: _gid, groupName: _gn, ...rest } = s;
      updates.push(
        stripUndefined({
          ...rest,
          updatedBy: adminUsername,
          updatedAt: now,
        })
      );
    }
  }

  for (let i = 0; i < updates.length; i += 350) {
    const chunk = updates.slice(i, i + 350);
    const batch = writeBatch(db);
    for (const st of chunk) {
      batch.set(doc(db, COLLECTIONS.students, st.id), st);
    }
    await batch.commit();
  }
}

export async function createGroupServer(
  payload: GroupInputPayload,
  adminUsername: string
): Promise<SubjectUpdateStudentGroup> {
  const db = getDb();
  const settings = await getSystemSettingsOnly();
  const rawCode = String(payload.groupCode || '').trim();
  const groupCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const groupName = String(payload.groupName || '').trim();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const category = String(payload.category || '').trim().toUpperCase();

  if (!groupCode) throw new Error('Group Code is required.');
  if (!groupName) throw new Error('Group Name is required.');
  if (!session || !semester || !category) throw new Error('Session, Semester, and Category are required.');

  const [groupSnap, subjSnap, combSnap, staffSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.groups)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.staff)),
  ]);

  const dup = groupSnap.docs.find((d) => {
    const g = d.data() as SubjectUpdateStudentGroup;
    return (
      String(g.groupCode || '').trim().toUpperCase() === groupCode.toUpperCase() &&
      g.session === session &&
      g.semester === semester
    );
  });
  if (dup) {
    throw new Error(`Group code "${groupCode}" already exists in ${session} (${semester}).`);
  }

  let subjectLabel: string | undefined;
  if (payload.subjectId) {
    const sDoc = subjSnap.docs.find((d) => d.id === payload.subjectId);
    if (sDoc) {
      const s = sDoc.data() as SubjectUpdateItem;
      subjectLabel = `${s.subjectCode} · ${s.subjectName}`;
    }
  }

  let combinationLabel: string | undefined;
  if (payload.combinationId) {
    const cDoc = combSnap.docs.find((d) => d.id === payload.combinationId);
    if (cDoc) {
      const c = cDoc.data() as SubjectUpdateCombination;
      combinationLabel = `${c.combinationCode} · ${c.combinationName}`;
    }
  }

  const staffMap = new Map(
    staffSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }])
  );
  const staffIdSet = new Set(Array.isArray(payload.assignedStaffIds) ? payload.assignedStaffIds.filter(Boolean) : []);
  if (payload.inChargeStaffId && staffMap.has(payload.inChargeStaffId)) {
    staffIdSet.add(payload.inChargeStaffId);
  }
  const assignedStaffIds = Array.from(staffIdSet).filter((sid) => staffMap.has(sid));
  const assignedStaffNames = assignedStaffIds.map((sid) => staffMap.get(sid)!.fullName);
  const inChargeStaff = payload.inChargeStaffId ? staffMap.get(payload.inChargeStaffId) : undefined;

  const studentIds = Array.from(new Set(Array.isArray(payload.studentIds) ? payload.studentIds.filter(Boolean) : []));
  const now = new Date().toISOString();
  const id = makeId('sugrp');

  const record: SubjectUpdateStudentGroup = stripUndefined({
    id,
    groupCode,
    groupName,
    session,
    semester,
    category,
    subjectId: payload.subjectId || undefined,
    subjectLabel,
    combinationId: payload.combinationId || undefined,
    combinationLabel,
    studentIds,
    capacity: payload.capacity && Number(payload.capacity) > 0 ? Math.floor(Number(payload.capacity)) : undefined,
    inChargeStaffId: inChargeStaff?.id,
    inChargeStaffName: inChargeStaff?.fullName,
    assignedStaffIds,
    assignedStaffNames,
    notes: payload.notes ? String(payload.notes).trim() : undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.groups, id), record);
  if (studentIds.length > 0) {
    await syncGroupMembershipOnStudents(record, [], adminUsername);
  }
  return record;
}

export async function updateGroupServer(
  id: string,
  payload: Partial<GroupInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateStudentGroup> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.groups, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Student group record not found.');

  const existing = snap.data() as SubjectUpdateStudentGroup;
  const settings = await getSystemSettingsOnly();

  const rawCode = payload.groupCode !== undefined ? String(payload.groupCode).trim() : existing.groupCode;
  const groupCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const groupName = payload.groupName !== undefined ? String(payload.groupName).trim() : existing.groupName;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const category =
    payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;

  if (!groupCode || !groupName) throw new Error('Group Code and Group Name cannot be empty.');

  const [groupSnap, subjSnap, combSnap, staffSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.groups)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.staff)),
  ]);

  const dup = groupSnap.docs.find((d) => {
    if (d.id === id) return false;
    const g = d.data() as SubjectUpdateStudentGroup;
    return (
      String(g.groupCode || '').trim().toUpperCase() === groupCode.toUpperCase() &&
      g.session === session &&
      g.semester === semester
    );
  });
  if (dup) {
    throw new Error(`Group code "${groupCode}" already exists in ${session} (${semester}).`);
  }

  const subjectId = payload.subjectId !== undefined ? payload.subjectId || undefined : existing.subjectId;
  let subjectLabel = existing.subjectLabel;
  if (payload.subjectId !== undefined) {
    const sDoc = subjectId ? subjSnap.docs.find((d) => d.id === subjectId) : undefined;
    subjectLabel = sDoc
      ? `${(sDoc.data() as SubjectUpdateItem).subjectCode} · ${(sDoc.data() as SubjectUpdateItem).subjectName}`
      : undefined;
  }

  const combinationId =
    payload.combinationId !== undefined ? payload.combinationId || undefined : existing.combinationId;
  let combinationLabel = existing.combinationLabel;
  if (payload.combinationId !== undefined) {
    const cDoc = combinationId ? combSnap.docs.find((d) => d.id === combinationId) : undefined;
    combinationLabel = cDoc
      ? `${(cDoc.data() as SubjectUpdateCombination).combinationCode} · ${(cDoc.data() as SubjectUpdateCombination).combinationName}`
      : undefined;
  }

  const staffMap = new Map(
    staffSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }])
  );
  const inChargeStaffId =
    payload.inChargeStaffId !== undefined ? payload.inChargeStaffId || undefined : existing.inChargeStaffId;
  const staffIdSet = new Set(
    payload.assignedStaffIds !== undefined
      ? payload.assignedStaffIds.filter(Boolean)
      : existing.assignedStaffIds || []
  );
  if (inChargeStaffId && staffMap.has(inChargeStaffId)) {
    staffIdSet.add(inChargeStaffId);
  }
  const assignedStaffIds = Array.from(staffIdSet).filter((sid) => staffMap.has(sid));
  const assignedStaffNames = assignedStaffIds.map((sid) => staffMap.get(sid)!.fullName);
  const inChargeStaff = inChargeStaffId ? staffMap.get(inChargeStaffId) : undefined;

  const studentIds =
    payload.studentIds !== undefined
      ? Array.from(new Set(payload.studentIds.filter(Boolean)))
      : existing.studentIds || [];

  const now = new Date().toISOString();
  const updated: SubjectUpdateStudentGroup = stripUndefined({
    id,
    groupCode,
    groupName,
    session,
    semester,
    category,
    subjectId,
    subjectLabel,
    combinationId,
    combinationLabel,
    studentIds,
    capacity:
      payload.capacity !== undefined
        ? Number(payload.capacity) > 0
          ? Math.floor(Number(payload.capacity))
          : undefined
        : existing.capacity,
    inChargeStaffId: inChargeStaff?.id,
    inChargeStaffName: inChargeStaff?.fullName,
    assignedStaffIds,
    assignedStaffNames,
    notes: payload.notes !== undefined ? String(payload.notes).trim() || undefined : existing.notes,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  if (payload.studentIds !== undefined) {
    await syncGroupMembershipOnStudents(updated, existing.studentIds || [], adminUsername);
  }
  return updated;
}

export async function deleteGroupServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.groups, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Student group record not found.');
  const existing = snap.data() as SubjectUpdateStudentGroup;

  await deleteDoc(ref);
  await syncGroupMembershipOnStudents({ ...existing, studentIds: [] }, existing.studentIds || [], 'SYSTEM');
}

// ============================================================================
// STAFF MANAGEMENT CRUD
// ============================================================================

export interface StaffInputPayload {
  staffCode: string;
  fullName: string;
  designation: string;
  departmentName?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  isActive?: boolean;
}

export async function createStaffServer(
  payload: StaffInputPayload,
  adminUsername: string
): Promise<SubjectUpdateStaff> {
  const db = getDb();
  const settings = await getSystemSettingsOnly();
  const rawCode = String(payload.staffCode || '').trim();
  const staffCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const fullName = String(payload.fullName || '').trim();
  const designation = String(payload.designation || '').trim() || 'Assistant Professor';
  const departmentName = String(payload.departmentName || '').trim() || 'General';

  if (!staffCode) throw new Error('Staff Code / ID is required.');
  if (!fullName) throw new Error('Staff Full Name is required.');

  const existingSnap = await getDocs(collection(db, COLLECTIONS.staff));
  const dup = existingSnap.docs.find(
    (d) =>
      String((d.data() as SubjectUpdateStaff).staffCode || '').trim().toUpperCase() ===
      staffCode.toUpperCase()
  );
  if (dup) {
    throw new Error(`Staff code "${staffCode}" already exists.`);
  }

  const now = new Date().toISOString();
  const id = makeId('sustaff');
  const record: SubjectUpdateStaff = stripUndefined({
    id,
    staffCode,
    fullName,
    designation,
    departmentName,
    email: payload.email ? String(payload.email).trim().toLowerCase() : undefined,
    phone: payload.phone ? String(payload.phone).trim() : undefined,
    specialization: payload.specialization ? String(payload.specialization).trim() : undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.staff, id), record);
  return record;
}

export async function updateStaffServer(
  id: string,
  payload: Partial<StaffInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateStaff> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.staff, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Staff record not found.');

  const existing = snap.data() as SubjectUpdateStaff;
  const settings = await getSystemSettingsOnly();

  const rawCode = payload.staffCode !== undefined ? String(payload.staffCode).trim() : existing.staffCode;
  const staffCode = settings.enforceUppercaseCodes ? rawCode.toUpperCase() : rawCode;
  const fullName = payload.fullName !== undefined ? String(payload.fullName).trim() : existing.fullName;
  const designation =
    payload.designation !== undefined ? String(payload.designation).trim() || 'Lecturer' : existing.designation;
  const departmentName =
    payload.departmentName !== undefined ? String(payload.departmentName).trim() || 'General' : existing.departmentName;

  if (!staffCode || !fullName) throw new Error('Staff Code and Full Name cannot be empty.');

  const allSnap = await getDocs(collection(db, COLLECTIONS.staff));
  const dup = allSnap.docs.find(
    (d) =>
      d.id !== id &&
      String((d.data() as SubjectUpdateStaff).staffCode || '').trim().toUpperCase() ===
        staffCode.toUpperCase()
  );
  if (dup) {
    throw new Error(`Staff code "${staffCode}" already exists.`);
  }

  const now = new Date().toISOString();
  const updated: SubjectUpdateStaff = stripUndefined({
    id,
    staffCode,
    fullName,
    designation,
    departmentName,
    email:
      payload.email !== undefined
        ? String(payload.email).trim().toLowerCase() || undefined
        : existing.email,
    phone: payload.phone !== undefined ? String(payload.phone).trim() || undefined : existing.phone,
    specialization:
      payload.specialization !== undefined
        ? String(payload.specialization).trim() || undefined
        : existing.specialization,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  return updated;
}

export async function deleteStaffServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.staff, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Staff record not found.');
  await deleteDoc(ref);
}

// ============================================================================
// STAFF ASSIGNMENT & IN-CHARGE ALLOCATION CRUD
// ============================================================================

export interface StaffAssignmentInputPayload {
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

async function resolveTargetAndStaff(payload: {
  targetType?: SubjectUpdateAssignmentTargetType;
  subjectId?: string;
  combinationId?: string;
  groupId?: string;
  staffIds: string[];
  inChargeStaffId: string;
}) {
  const db = getDb();
  const [subjSnap, combSnap, groupSnap, staffSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.combinations)),
    getDocs(collection(db, COLLECTIONS.groups)),
    getDocs(collection(db, COLLECTIONS.staff)),
  ]);

  let subjectLabel: string | undefined;
  if (payload.subjectId) {
    const found = subjSnap.docs.find((d) => d.id === payload.subjectId);
    if (found) {
      const s = found.data() as SubjectUpdateItem;
      subjectLabel = `${s.subjectCode} · ${s.subjectName}`;
    }
  }

  let combinationLabel: string | undefined;
  if (payload.combinationId) {
    const found = combSnap.docs.find((d) => d.id === payload.combinationId);
    if (found) {
      const c = found.data() as SubjectUpdateCombination;
      combinationLabel = `${c.combinationCode} · ${c.combinationName}`;
    }
  }

  let groupLabel: string | undefined;
  let groupDoc: SubjectUpdateStudentGroup | undefined;
  if (payload.groupId) {
    const found = groupSnap.docs.find((d) => d.id === payload.groupId);
    if (found) {
      groupDoc = { id: found.id, ...(found.data() as Omit<SubjectUpdateStudentGroup, 'id'>) };
      groupLabel = `${groupDoc.groupCode} · ${groupDoc.groupName}`;
    }
  }

  const staffMap = new Map(
    staffSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }])
  );
  const inCharge = staffMap.get(payload.inChargeStaffId);
  if (!inCharge) {
    throw new Error('A valid In-charge staff member must be selected.');
  }

  const staffIdSet = new Set(Array.isArray(payload.staffIds) ? payload.staffIds.filter(Boolean) : []);
  staffIdSet.add(inCharge.id);
  const staffIds = Array.from(staffIdSet).filter((sid) => staffMap.has(sid));
  const staffNames = staffIds.map((sid) => staffMap.get(sid)!.fullName);

  return {
    subjectLabel,
    combinationLabel,
    groupLabel,
    groupDoc,
    staffIds,
    staffNames,
    inChargeStaffId: inCharge.id,
    inChargeStaffName: inCharge.fullName,
  };
}

export async function createStaffAssignmentServer(
  payload: StaffAssignmentInputPayload,
  adminUsername: string
): Promise<SubjectUpdateStaffAssignment> {
  const db = getDb();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const category = String(payload.category || '').trim().toUpperCase();
  const targetType = payload.targetType;

  if (!session || !semester || !category) throw new Error('Session, Semester, and Category are required.');
  if (targetType !== 'SUBJECT' && targetType !== 'COMBINATION' && targetType !== 'GROUP') {
    throw new Error('Target Type must be SUBJECT, COMBINATION, or GROUP.');
  }
  if (targetType === 'SUBJECT' && !payload.subjectId) throw new Error('Please select a Subject.');
  if (targetType === 'COMBINATION' && !payload.combinationId) throw new Error('Please select a Subject Combination.');
  if (targetType === 'GROUP' && !payload.groupId) throw new Error('Please select a Student Group.');

  const resolved = await resolveTargetAndStaff({
    targetType,
    subjectId: payload.subjectId,
    combinationId: payload.combinationId,
    groupId: payload.groupId,
    staffIds: payload.staffIds || [],
    inChargeStaffId: payload.inChargeStaffId,
  });

  const now = new Date().toISOString();
  const id = makeId('suassign');
  const record: SubjectUpdateStaffAssignment = stripUndefined({
    id,
    session,
    semester,
    category,
    targetType,
    subjectId: payload.subjectId || undefined,
    subjectLabel: resolved.subjectLabel,
    combinationId: payload.combinationId || undefined,
    combinationLabel: resolved.combinationLabel,
    groupId: payload.groupId || undefined,
    groupLabel: resolved.groupLabel,
    staffIds: resolved.staffIds,
    staffNames: resolved.staffNames,
    inChargeStaffId: resolved.inChargeStaffId,
    inChargeStaffName: resolved.inChargeStaffName,
    remarks: payload.remarks ? String(payload.remarks).trim() : undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.staffAssignments, id), record);

  // Sync in-charge onto student group when targetType === 'GROUP'
  if (targetType === 'GROUP' && resolved.groupDoc) {
    await setDoc(doc(db, COLLECTIONS.groups, resolved.groupDoc.id), {
      ...resolved.groupDoc,
      inChargeStaffId: resolved.inChargeStaffId,
      inChargeStaffName: resolved.inChargeStaffName,
      assignedStaffIds: resolved.staffIds,
      assignedStaffNames: resolved.staffNames,
      updatedBy: adminUsername,
      updatedAt: now,
    });
  }

  return record;
}

export async function updateStaffAssignmentServer(
  id: string,
  payload: Partial<StaffAssignmentInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateStaffAssignment> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.staffAssignments, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Staff assignment record not found.');

  const existing = snap.data() as SubjectUpdateStaffAssignment;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const category =
    payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;
  const targetType = payload.targetType !== undefined ? payload.targetType : existing.targetType;
  const subjectId = payload.subjectId !== undefined ? payload.subjectId || undefined : existing.subjectId;
  const combinationId =
    payload.combinationId !== undefined ? payload.combinationId || undefined : existing.combinationId;
  const groupId = payload.groupId !== undefined ? payload.groupId || undefined : existing.groupId;

  const resolved = await resolveTargetAndStaff({
    targetType,
    subjectId,
    combinationId,
    groupId,
    staffIds: payload.staffIds !== undefined ? payload.staffIds : existing.staffIds,
    inChargeStaffId:
      payload.inChargeStaffId !== undefined ? payload.inChargeStaffId : existing.inChargeStaffId,
  });

  const now = new Date().toISOString();
  const updated: SubjectUpdateStaffAssignment = stripUndefined({
    id,
    session,
    semester,
    category,
    targetType,
    subjectId,
    subjectLabel: resolved.subjectLabel,
    combinationId,
    combinationLabel: resolved.combinationLabel,
    groupId,
    groupLabel: resolved.groupLabel,
    staffIds: resolved.staffIds,
    staffNames: resolved.staffNames,
    inChargeStaffId: resolved.inChargeStaffId,
    inChargeStaffName: resolved.inChargeStaffName,
    remarks:
      payload.remarks !== undefined
        ? String(payload.remarks).trim() || undefined
        : existing.remarks,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : existing.isActive,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);

  if (targetType === 'GROUP' && resolved.groupDoc) {
    await setDoc(doc(db, COLLECTIONS.groups, resolved.groupDoc.id), {
      ...resolved.groupDoc,
      inChargeStaffId: resolved.inChargeStaffId,
      inChargeStaffName: resolved.inChargeStaffName,
      assignedStaffIds: resolved.staffIds,
      assignedStaffNames: resolved.staffNames,
      updatedBy: adminUsername,
      updatedAt: now,
    });
  }

  return updated;
}

export async function deleteStaffAssignmentServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.staffAssignments, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Staff assignment record not found.');
  await deleteDoc(ref);
}

// ============================================================================
// WORK ALLOCATION CRUD
// ============================================================================

export interface WorkAllocationInputPayload {
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

export async function createWorkAllocationServer(
  payload: WorkAllocationInputPayload,
  adminUsername: string
): Promise<SubjectUpdateWorkAllocation> {
  const db = getDb();
  const title = String(payload.title || '').trim();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const category = String(payload.category || '').trim().toUpperCase();
  const instructions = String(payload.instructions || '').trim();
  const deadline = String(payload.deadline || '').trim();
  const priority: SubjectUpdateWorkPriority =
    payload.priority === 'HIGH' || payload.priority === 'URGENT' ? payload.priority : 'NORMAL';
  const progressStatus: SubjectUpdateWorkStatus =
    payload.progressStatus === 'IN_PROGRESS' ||
    payload.progressStatus === 'COMPLETED' ||
    payload.progressStatus === 'ON_HOLD'
      ? payload.progressStatus
      : 'PENDING';

  if (!title) throw new Error('Work Allocation Title is required.');
  if (!session || !semester || !category) throw new Error('Session, Semester, and Category are required.');
  if (!instructions) throw new Error('Work instructions are required.');
  if (!deadline) throw new Error('Deadline date is required.');

  const resolved = await resolveTargetAndStaff({
    subjectId: payload.subjectId,
    combinationId: payload.combinationId,
    groupId: payload.groupId,
    staffIds: payload.staffIds || [],
    inChargeStaffId: payload.inChargeStaffId,
  });

  const now = new Date().toISOString();
  const id = makeId('suwork');
  const record: SubjectUpdateWorkAllocation = stripUndefined({
    id,
    title,
    session,
    semester,
    category,
    subjectId: payload.subjectId || undefined,
    subjectLabel: resolved.subjectLabel,
    combinationId: payload.combinationId || undefined,
    combinationLabel: resolved.combinationLabel,
    groupId: payload.groupId || undefined,
    groupLabel: resolved.groupLabel,
    staffIds: resolved.staffIds,
    staffNames: resolved.staffNames,
    inChargeStaffId: resolved.inChargeStaffId,
    inChargeStaffName: resolved.inChargeStaffName,
    instructions,
    deadline,
    priority,
    progressStatus,
    remarks: payload.remarks ? String(payload.remarks).trim() : undefined,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.workAllocations, id), record);
  return record;
}

export async function updateWorkAllocationServer(
  id: string,
  payload: Partial<WorkAllocationInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateWorkAllocation> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.workAllocations, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Work allocation record not found.');

  const existing = snap.data() as SubjectUpdateWorkAllocation;

  const title = payload.title !== undefined ? String(payload.title).trim() : existing.title;
  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const category =
    payload.category !== undefined ? String(payload.category).trim().toUpperCase() : existing.category;
  const instructions =
    payload.instructions !== undefined ? String(payload.instructions).trim() : existing.instructions;
  const deadline = payload.deadline !== undefined ? String(payload.deadline).trim() : existing.deadline;
  const priority = payload.priority !== undefined ? payload.priority : existing.priority;
  const progressStatus =
    payload.progressStatus !== undefined ? payload.progressStatus : existing.progressStatus;

  if (!title || !instructions || !deadline) {
    throw new Error('Title, Instructions, and Deadline cannot be empty.');
  }

  const subjectId = payload.subjectId !== undefined ? payload.subjectId || undefined : existing.subjectId;
  const combinationId =
    payload.combinationId !== undefined ? payload.combinationId || undefined : existing.combinationId;
  const groupId = payload.groupId !== undefined ? payload.groupId || undefined : existing.groupId;

  const resolved = await resolveTargetAndStaff({
    subjectId,
    combinationId,
    groupId,
    staffIds: payload.staffIds !== undefined ? payload.staffIds : existing.staffIds,
    inChargeStaffId:
      payload.inChargeStaffId !== undefined ? payload.inChargeStaffId : existing.inChargeStaffId,
  });

  const now = new Date().toISOString();
  const updated: SubjectUpdateWorkAllocation = stripUndefined({
    id,
    title,
    session,
    semester,
    category,
    subjectId,
    subjectLabel: resolved.subjectLabel,
    combinationId,
    combinationLabel: resolved.combinationLabel,
    groupId,
    groupLabel: resolved.groupLabel,
    staffIds: resolved.staffIds,
    staffNames: resolved.staffNames,
    inChargeStaffId: resolved.inChargeStaffId,
    inChargeStaffName: resolved.inChargeStaffName,
    instructions,
    deadline,
    priority,
    progressStatus,
    remarks:
      payload.remarks !== undefined
        ? String(payload.remarks).trim() || undefined
        : existing.remarks,
    createdBy: existing.createdBy || adminUsername,
    updatedBy: adminUsername,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  return updated;
}

export async function deleteWorkAllocationServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.workAllocations, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Work allocation record not found.');
  await deleteDoc(ref);
}

// ============================================================================
// NEP COMBINATION CONFIG & DEPARTMENT IN-CHARGE SELECTION WORKFLOW
// ============================================================================

export function normalizeNepCategory(cat?: string): NepCategoryKey | null {
  const upper = String(cat || '').trim().toUpperCase();
  if (upper === 'MJC' || upper === 'MAJOR') return 'MAJOR';
  if (upper === 'MIC') return 'MIC';
  if (upper === 'MDC') return 'MDC';
  if (upper === 'AEC') return 'AEC';
  if (upper === 'SEC') return 'SEC';
  if (upper === 'VAC') return 'VAC';
  return null;
}

function makeNepConfigDocId(session: string, semester: string): string {
  return `nep_${session.replace(/[^a-zA-Z0-9]/g, '_')}_${semester.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function buildEmptyNepConfig(session: string, semester: string): SubjectUpdateNepConfig {
  const now = new Date().toISOString();
  return {
    id: makeNepConfigDocId(session, semester),
    session,
    semester,
    allowedMajorIds: [],
    majorToMicMap: {},
    categoryRules: {
      MAJOR: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
      MIC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
      MDC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
      AEC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
      SEC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
      VAC: { subjectIds: [], required: false, minSelect: 0, maxSelect: 1 },
    },
    updatedBy: 'SYSTEM',
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeNepConfig(
  raw: SubjectUpdateNepConfig,
  allSubjects: SubjectUpdateItem[]
): SubjectUpdateNepConfig {
  const validSubjIds = new Set(allSubjects.map((s) => s.id));
  const base = buildEmptyNepConfig(raw.session, raw.semester);

  const allowedMajorIds = Array.from(
    new Set((Array.isArray(raw.allowedMajorIds) ? raw.allowedMajorIds : []).filter((id) => validSubjIds.has(id)))
  );

  const categoryRules = { ...base.categoryRules };
  for (const cat of NEP_CATEGORIES) {
    const r = raw.categoryRules?.[cat];
    if (r) {
      const minSelect = Math.max(0, Math.floor(Number(r.minSelect ?? (r.required ? 1 : 0))));
      const maxSelect = Math.max(minSelect, Math.floor(Number(r.maxSelect ?? (cat === 'VAC' ? 1 : 1))));
      const subjectIds = Array.from(
        new Set((Array.isArray(r.subjectIds) ? r.subjectIds : []).filter((id) => validSubjIds.has(id)))
      );
      categoryRules[cat] = {
        subjectIds: cat === 'MAJOR' && subjectIds.length === 0 ? allowedMajorIds : subjectIds,
        required: Boolean(r.required),
        minSelect,
        maxSelect,
      };
    }
  }
  if (allowedMajorIds.length > 0 && categoryRules.MAJOR.subjectIds.length === 0) {
    categoryRules.MAJOR.subjectIds = [...allowedMajorIds];
  }

  const majorToMicMap: Record<string, string[]> = {};
  for (const majorId of allowedMajorIds) {
    const rawMics = raw.majorToMicMap?.[majorId];
    majorToMicMap[majorId] = Array.from(
      new Set((Array.isArray(rawMics) ? rawMics : []).filter((id) => validSubjIds.has(id)))
    );
  }

  return {
    id: raw.id || makeNepConfigDocId(raw.session, raw.semester),
    session: raw.session,
    semester: raw.semester,
    allowedMajorIds,
    majorToMicMap,
    categoryRules,
    updatedBy: raw.updatedBy || 'SYSTEM',
    createdAt: raw.createdAt || base.createdAt,
    updatedAt: raw.updatedAt || base.updatedAt,
  };
}

export interface SaveNepConfigPayload {
  session: string;
  semester: string;
  allowedMajorIds: string[];
  majorToMicMap: Record<string, string[]>;
  categoryRules: Record<NepCategoryKey, NepCategoryRule>;
}

export async function saveNepConfigServer(
  payload: SaveNepConfigPayload,
  adminUsername: string
): Promise<SubjectUpdateNepConfig> {
  const db = getDb();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  if (!session || !semester) {
    throw new Error('Academic Session and Semester are required.');
  }

  const subjSnap = await getDocs(collection(db, COLLECTIONS.subjects));
  const allSubjects = subjSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SubjectUpdateItem, 'id'>),
  }));

  const id = makeNepConfigDocId(session, semester);
  const existingSnap = await getDoc(doc(db, COLLECTIONS.nepConfigs, id));
  const existing = existingSnap.exists() ? (existingSnap.data() as SubjectUpdateNepConfig) : null;
  const now = new Date().toISOString();

  const sanitized = sanitizeNepConfig(
    {
      id,
      session,
      semester,
      allowedMajorIds: payload.allowedMajorIds || [],
      majorToMicMap: payload.majorToMicMap || {},
      categoryRules: payload.categoryRules || buildEmptyNepConfig(session, semester).categoryRules,
      updatedBy: adminUsername,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    },
    allSubjects
  );

  await setDoc(doc(db, COLLECTIONS.nepConfigs, id), sanitized);
  return sanitized;
}

function emptyStudentSelection(student: SubjectUpdateStudent): SubjectUpdateNepStudentSelection {
  return {
    studentId: student.id,
    applicationNo: student.applicationNo || student.rollNumber || '',
    rollNumber: student.rollNumber || '',
    studentName: student.studentName || '',
    departmentName: student.departmentName || 'General',
    majorIds: [],
    micIds: [],
    mdcIds: [],
    aecIds: [],
    secIds: [],
    vacIds: [],
    isComplete: false,
  };
}

function evaluateNepSelection(
  input: {
    studentId: string;
    applicationNo: string;
    rollNumber: string;
    studentName: string;
    departmentName: string;
    majorIds?: string[];
    micIds?: string[];
    mdcIds?: string[];
    aecIds?: string[];
    secIds?: string[];
    vacIds?: string[];
  },
  nepConfig: SubjectUpdateNepConfig
): { selection: SubjectUpdateNepStudentSelection; missingCategories: string[] } {
  const allowedMajors = new Set(
    nepConfig.allowedMajorIds.length > 0
      ? nepConfig.allowedMajorIds
      : nepConfig.categoryRules.MAJOR.subjectIds
  );

  const clampByRule = (ids: string[] | undefined, rule: NepCategoryRule, allowSet?: Set<string>): string[] => {
    const clean = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean))).filter((id) =>
      allowSet ? allowSet.has(id) : true
    );
    return rule.maxSelect > 0 ? clean.slice(0, rule.maxSelect) : clean;
  };

  const majorIds = clampByRule(input.majorIds, nepConfig.categoryRules.MAJOR, allowedMajors);
  const selectedMajorId = majorIds[0] || '';

  // STRICT DYNAMIC RULE: MIC dropdown options depend on selected Major in nepConfig.majorToMicMap
  const allowedMicsForMajor = new Set(
    selectedMajorId ? nepConfig.majorToMicMap[selectedMajorId] || [] : []
  );
  const micIds = clampByRule(input.micIds, nepConfig.categoryRules.MIC, allowedMicsForMajor);

  const mdcSet = new Set(nepConfig.categoryRules.MDC.subjectIds);
  const aecSet = new Set(nepConfig.categoryRules.AEC.subjectIds);
  const secSet = new Set(nepConfig.categoryRules.SEC.subjectIds);
  const vacSet = new Set(nepConfig.categoryRules.VAC.subjectIds);

  const mdcIds = clampByRule(input.mdcIds, nepConfig.categoryRules.MDC, mdcSet);
  const aecIds = clampByRule(input.aecIds, nepConfig.categoryRules.AEC, aecSet);
  const secIds = clampByRule(input.secIds, nepConfig.categoryRules.SEC, secSet);
  const vacIds = clampByRule(input.vacIds, nepConfig.categoryRules.VAC, vacSet);

  const valuesByCat: Record<NepCategoryKey, string[]> = {
    MAJOR: majorIds,
    MIC: micIds,
    MDC: mdcIds,
    AEC: aecIds,
    SEC: secIds,
    VAC: vacIds,
  };

  const missingCategories: string[] = [];
  for (const cat of NEP_CATEGORIES) {
    const rule = nepConfig.categoryRules[cat];
    const picked = valuesByCat[cat];
    if (rule.required) {
      const minNeed = Math.max(1, rule.minSelect);
      if (picked.length < minNeed) {
        missingCategories.push(cat);
      }
    } else if (picked.length > 0 && rule.minSelect > 0 && picked.length < rule.minSelect) {
      missingCategories.push(cat);
    }
  }

  return {
    selection: {
      studentId: input.studentId,
      applicationNo: input.applicationNo,
      rollNumber: input.rollNumber,
      studentName: input.studentName,
      departmentName: input.departmentName,
      majorIds,
      micIds,
      mdcIds,
      aecIds,
      secIds,
      vacIds,
      isComplete: missingCategories.length === 0,
    },
    missingCategories,
  };
}

export interface SelectionFormInputPayload {
  title?: string;
  session: string;
  semester: string;
  departmentName: string;
  inChargeStaffId: string;
  assignedStaffIds?: string[];
  studentIds: string[];
  deadline: string;
}

async function syncSelectionFormOnStudents(
  form: SubjectUpdateSelectionForm,
  previousStudentIds: string[],
  adminUsername: string
): Promise<void> {
  const db = getDb();
  const studSnap = await getDocs(collection(db, COLLECTIONS.students));
  const newSet = new Set(form.studentIds);
  const oldSet = new Set(previousStudentIds);
  const now = new Date().toISOString();
  const updates: SubjectUpdateStudent[] = [];

  for (const d of studSnap.docs) {
    const s = { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) };
    if (newSet.has(s.id) && (s.selectionFormId !== form.id || s.selectionFormName !== form.title)) {
      updates.push(
        stripUndefined({
          ...s,
          selectionFormId: form.id,
          selectionFormName: form.title,
          updatedBy: adminUsername,
          updatedAt: now,
        })
      );
    } else if (!newSet.has(s.id) && oldSet.has(s.id) && s.selectionFormId === form.id) {
      const { selectionFormId: _sfid, selectionFormName: _sfn, ...rest } = s;
      updates.push(
        stripUndefined({
          ...rest,
          updatedBy: adminUsername,
          updatedAt: now,
        })
      );
    }
  }

  for (let i = 0; i < updates.length; i += 350) {
    const chunk = updates.slice(i, i + 350);
    const batch = writeBatch(db);
    for (const st of chunk) {
      batch.set(doc(db, COLLECTIONS.students, st.id), st);
    }
    await batch.commit();
  }
}

export async function createSelectionFormServer(
  payload: SelectionFormInputPayload,
  adminUsername: string
): Promise<SubjectUpdateSelectionForm> {
  const db = getDb();
  const session = String(payload.session || '').trim();
  const semester = String(payload.semester || '').trim();
  const departmentName = String(payload.departmentName || '').trim();
  const inChargeStaffId = String(payload.inChargeStaffId || '').trim();
  const deadline = String(payload.deadline || '').trim();
  const studentIds = Array.from(new Set((Array.isArray(payload.studentIds) ? payload.studentIds : []).filter(Boolean)));

  if (!session || !semester) throw new Error('Session and Semester are required.');
  if (!departmentName) throw new Error('Department is required.');
  if (!inChargeStaffId) throw new Error('Department In-charge must be selected.');
  if (!deadline) throw new Error('Selection Deadline is required.');
  if (studentIds.length === 0) throw new Error('Please allocate at least one student to this assignment.');

  const [staffSnap, studSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.staff)),
    getDocs(collection(db, COLLECTIONS.students)),
  ]);

  const staffMap = new Map(
    staffSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }])
  );
  const inCharge = staffMap.get(inChargeStaffId);
  if (!inCharge) throw new Error('Selected Department In-charge was not found.');

  const staffSet = new Set(Array.isArray(payload.assignedStaffIds) ? payload.assignedStaffIds.filter(Boolean) : []);
  staffSet.add(inCharge.id);
  const assignedStaffIds = Array.from(staffSet).filter((sid) => staffMap.has(sid));
  const assignedStaffNames = assignedStaffIds.map((sid) => staffMap.get(sid)!.fullName);

  const studentMap = new Map(
    studSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) }])
  );

  const validStudentIds = studentIds.filter((sid) => studentMap.has(sid));
  if (validStudentIds.length === 0) {
    throw new Error('None of the selected students exist in the database.');
  }

  const selections: Record<string, SubjectUpdateNepStudentSelection> = {};
  for (const sid of validStudentIds) {
    const st = studentMap.get(sid)!;
    selections[sid] = emptyStudentSelection(st);
  }

  const now = new Date().toISOString();
  const id = makeId('sunepform');
  const title =
    String(payload.title || '').trim() || `${departmentName} · ${semester} (${session})`;
  const token = `nep_${crypto.randomBytes(20).toString('hex')}`;

  const record: SubjectUpdateSelectionForm = stripUndefined({
    id,
    title,
    session,
    semester,
    departmentName,
    inChargeStaffId: inCharge.id,
    inChargeStaffName: inCharge.fullName,
    assignedStaffIds,
    assignedStaffNames,
    studentIds: validStudentIds,
    deadline,
    token,
    status: 'OPEN' as SelectionFormStatus,
    isLocked: false,
    selections,
    totalStudents: validStudentIds.length,
    completedCount: 0,
    pendingCount: validStudentIds.length,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.selectionForms, id), record);
  await syncSelectionFormOnStudents(record, [], adminUsername);
  return record;
}

export async function updateSelectionFormServer(
  id: string,
  payload: Partial<SelectionFormInputPayload>,
  adminUsername: string
): Promise<SubjectUpdateSelectionForm> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.selectionForms, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Selection Form assignment not found.');
  const existing = snap.data() as SubjectUpdateSelectionForm;

  const session = payload.session !== undefined ? String(payload.session).trim() : existing.session;
  const semester = payload.semester !== undefined ? String(payload.semester).trim() : existing.semester;
  const departmentName =
    payload.departmentName !== undefined ? String(payload.departmentName).trim() : existing.departmentName;
  const deadline = payload.deadline !== undefined ? String(payload.deadline).trim() : existing.deadline;
  const inChargeStaffId =
    payload.inChargeStaffId !== undefined ? String(payload.inChargeStaffId).trim() : existing.inChargeStaffId;

  const [staffSnap, studSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.staff)),
    getDocs(collection(db, COLLECTIONS.students)),
  ]);

  const staffMap = new Map(
    staffSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStaff, 'id'>) }])
  );
  const inCharge = staffMap.get(inChargeStaffId);
  if (!inCharge) throw new Error('Selected Department In-charge was not found.');

  const staffSet = new Set(
    payload.assignedStaffIds !== undefined ? payload.assignedStaffIds.filter(Boolean) : existing.assignedStaffIds
  );
  staffSet.add(inCharge.id);
  const assignedStaffIds = Array.from(staffSet).filter((sid) => staffMap.has(sid));
  const assignedStaffNames = assignedStaffIds.map((sid) => staffMap.get(sid)!.fullName);

  const studentMap = new Map(
    studSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) }])
  );

  const targetStudentIds =
    payload.studentIds !== undefined
      ? Array.from(new Set(payload.studentIds.filter((sid) => studentMap.has(sid))))
      : existing.studentIds.filter((sid) => studentMap.has(sid));

  if (targetStudentIds.length === 0) {
    throw new Error('At least one valid student must remain allocated.');
  }

  const nextSelections: Record<string, SubjectUpdateNepStudentSelection> = {};
  let completedCount = 0;
  for (const sid of targetStudentIds) {
    const st = studentMap.get(sid)!;
    const prev = existing.selections?.[sid];
    const rowSel: SubjectUpdateNepStudentSelection = prev
      ? {
          ...prev,
          applicationNo: st.applicationNo || st.rollNumber || prev.applicationNo,
          rollNumber: st.rollNumber || prev.rollNumber,
          studentName: st.studentName || prev.studentName,
          departmentName: st.departmentName || prev.departmentName,
        }
      : emptyStudentSelection(st);
    nextSelections[sid] = rowSel;
    if (rowSel.isComplete) completedCount += 1;
  }

  const now = new Date().toISOString();
  const title =
    payload.title !== undefined
      ? String(payload.title).trim() || `${departmentName} · ${semester} (${session})`
      : existing.title;

  const updated: SubjectUpdateSelectionForm = stripUndefined({
    ...existing,
    id,
    title,
    session,
    semester,
    departmentName,
    inChargeStaffId: inCharge.id,
    inChargeStaffName: inCharge.fullName,
    assignedStaffIds,
    assignedStaffNames,
    studentIds: targetStudentIds,
    deadline,
    selections: nextSelections,
    totalStudents: targetStudentIds.length,
    completedCount,
    pendingCount: Math.max(0, targetStudentIds.length - completedCount),
    updatedBy: adminUsername,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  await syncSelectionFormOnStudents(updated, existing.studentIds || [], adminUsername);
  return updated;
}

export async function deleteSelectionFormServer(id: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.selectionForms, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Selection Form assignment not found.');
  const existing = snap.data() as SubjectUpdateSelectionForm;

  await deleteDoc(ref);
  await syncSelectionFormOnStudents({ ...existing, studentIds: [] }, existing.studentIds || [], 'SYSTEM');
}

export async function reopenSelectionFormServer(
  id: string,
  adminUsername: string
): Promise<SubjectUpdateSelectionForm> {
  const db = getDb();
  const ref = doc(db, COLLECTIONS.selectionForms, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Selection Form assignment not found.');
  const existing = snap.data() as SubjectUpdateSelectionForm;
  const now = new Date().toISOString();

  const updated: SubjectUpdateSelectionForm = stripUndefined({
    ...existing,
    isLocked: false,
    status: (existing.completedCount > 0 ? 'IN_PROGRESS' : 'OPEN') as SelectionFormStatus,
    reopenedAt: now,
    reopenedBy: adminUsername,
    updatedBy: adminUsername,
    updatedAt: now,
  });

  await setDoc(ref, updated);
  return updated;
}

async function loadPublicFormContext(token: string) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Selection form token is required.');

  const db = getDb();
  const [formSnap, subjSnap, studSnap, nepSnap, settings] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.selectionForms)),
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.students)),
    getDocs(collection(db, COLLECTIONS.nepConfigs)),
    getSystemSettingsOnly(),
  ]);

  const foundDoc = formSnap.docs.find((d) => (d.data() as SubjectUpdateSelectionForm).token === cleanToken);
  if (!foundDoc) {
    throw new Error('Selection form link is invalid or has been removed.');
  }

  const form = { id: foundDoc.id, ...(foundDoc.data() as Omit<SubjectUpdateSelectionForm, 'id'>) };
  const allSubjects = subjSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubjectUpdateItem, 'id'>) }));
  const studentMap = new Map(
    studSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<SubjectUpdateStudent, 'id'>) }])
  );

  const rawNepDoc = nepSnap.docs.find((d) => {
    const c = d.data() as SubjectUpdateNepConfig;
    return c.session === form.session && c.semester === form.semester;
  });
  const nepConfig = rawNepDoc
    ? sanitizeNepConfig({ id: rawNepDoc.id, ...(rawNepDoc.data() as Omit<SubjectUpdateNepConfig, 'id'>) }, allSubjects)
    : buildEmptyNepConfig(form.session, form.semester);

  return { db, form, allSubjects, studentMap, nepConfig, settings };
}

function buildPublicPayloadFromContext(
  form: SubjectUpdateSelectionForm,
  allSubjects: SubjectUpdateItem[],
  studentMap: Map<string, SubjectUpdateStudent>,
  nepConfig: SubjectUpdateNepConfig,
  institutionName: string
): PublicNepSelectionFormPayload {
  const subjectsByCategory: Record<NepCategoryKey, SubjectUpdateItem[]> = {
    MAJOR: [],
    MIC: [],
    MDC: [],
    AEC: [],
    SEC: [],
    VAC: [],
  };

  // Index subjects configured in nepConfig or matching (session, semester)
  const referencedIds = new Set<string>(nepConfig.allowedMajorIds);
  Object.values(nepConfig.majorToMicMap).forEach((arr) => arr.forEach((id) => referencedIds.add(id)));
  NEP_CATEGORIES.forEach((cat) =>
    nepConfig.categoryRules[cat].subjectIds.forEach((id) => referencedIds.add(id))
  );

  for (const subj of allSubjects) {
    const inScope = subj.session === form.session && subj.semester === form.semester;
    if (!inScope && !referencedIds.has(subj.id)) continue;
    if (!subj.isActive && !referencedIds.has(subj.id)) continue;
    const normCat = normalizeNepCategory(subj.category);
    if (normCat) {
      subjectsByCategory[normCat].push(subj);
    }
  }

  const students: SubjectUpdateNepStudentSelection[] = form.studentIds.map((sid) => {
    const live = studentMap.get(sid);
    const saved = form.selections?.[sid];
    const base = saved
      ? {
          ...saved,
          applicationNo: live?.applicationNo || live?.rollNumber || saved.applicationNo,
          rollNumber: live?.rollNumber || saved.rollNumber,
          studentName: live?.studentName || saved.studentName,
          departmentName: live?.departmentName || saved.departmentName,
        }
      : emptyStudentSelection(
          live || ({
            id: sid,
            sn: '',
            applicationNo: '',
            studentName: 'Unknown Student',
            rollNumber: '',
            departmentName: form.departmentName,
            rawSubjectText: '',
            session: form.session,
            semester: form.semester,
            category: 'MAJOR',
            matchedSubjectIds: [],
            matchedSubjectNames: [],
            allocationStatus: 'UNMATCHED',
            createdBy: '',
            updatedBy: '',
            createdAt: '',
            updatedAt: '',
          } as SubjectUpdateStudent)
        );
    return evaluateNepSelection(base, nepConfig).selection;
  });

  const completedCount = students.filter((s) => s.isComplete).length;

  return {
    form: {
      id: form.id,
      title: form.title,
      institutionName,
      session: form.session,
      semester: form.semester,
      departmentName: form.departmentName,
      inChargeStaffName: form.inChargeStaffName,
      deadline: form.deadline,
      status: form.status,
      isLocked: Boolean(form.isLocked),
      totalStudents: students.length,
      completedCount,
      pendingCount: Math.max(0, students.length - completedCount),
      submittedAt: form.submittedAt,
    },
    nepConfig,
    subjectsByCategory,
    students,
  };
}

export async function getPublicSelectionFormByTokenServer(
  token: string
): Promise<PublicNepSelectionFormPayload> {
  const { form, allSubjects, studentMap, nepConfig, settings } = await loadPublicFormContext(token);
  return buildPublicPayloadFromContext(
    form,
    allSubjects,
    studentMap,
    nepConfig,
    settings.institutionName || 'NGM Degree Mahavidyalaya'
  );
}

export async function savePublicStudentSelectionServer(
  token: string,
  studentId: string,
  selectionInput: {
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
  const { db, form, allSubjects, studentMap, nepConfig, settings } = await loadPublicFormContext(token);

  if (form.isLocked) {
    throw new Error('LOCKED: This selection form has been finalized and locked. Contact Admin to reopen.');
  }
  if (!form.studentIds.includes(studentId)) {
    throw new Error('Student is not assigned to this selection form.');
  }

  const live = studentMap.get(studentId);
  const existingSel = form.selections?.[studentId];
  const now = new Date().toISOString();

  const { selection: evaluated } = evaluateNepSelection(
    {
      studentId,
      applicationNo: live?.applicationNo || live?.rollNumber || existingSel?.applicationNo || '',
      rollNumber: live?.rollNumber || existingSel?.rollNumber || '',
      studentName: live?.studentName || existingSel?.studentName || 'Student',
      departmentName: live?.departmentName || existingSel?.departmentName || form.departmentName,
      majorIds: selectionInput.majorIds ?? existingSel?.majorIds ?? [],
      micIds: selectionInput.micIds ?? existingSel?.micIds ?? [],
      mdcIds: selectionInput.mdcIds ?? existingSel?.mdcIds ?? [],
      aecIds: selectionInput.aecIds ?? existingSel?.aecIds ?? [],
      secIds: selectionInput.secIds ?? existingSel?.secIds ?? [],
      vacIds: selectionInput.vacIds ?? existingSel?.vacIds ?? [],
    },
    nepConfig
  );

  const studentSelection: SubjectUpdateNepStudentSelection = stripUndefined({
    ...evaluated,
    updatedAt: now,
    updatedBy: form.inChargeStaffName,
  });

  const nextSelections: Record<string, SubjectUpdateNepStudentSelection> = {
    ...(form.selections || {}),
    [studentId]: studentSelection,
  };

  let completedCount = 0;
  let anyProgress = false;
  for (const sid of form.studentIds) {
    const s = nextSelections[sid];
    if (!s) continue;
    if (s.isComplete) completedCount += 1;
    if (
      s.majorIds.length > 0 ||
      s.micIds.length > 0 ||
      s.mdcIds.length > 0 ||
      s.aecIds.length > 0 ||
      s.secIds.length > 0 ||
      s.vacIds.length > 0
    ) {
      anyProgress = true;
    }
  }

  const updatedForm: SubjectUpdateSelectionForm = stripUndefined({
    ...form,
    selections: nextSelections,
    totalStudents: form.studentIds.length,
    completedCount,
    pendingCount: Math.max(0, form.studentIds.length - completedCount),
    status: (anyProgress ? 'IN_PROGRESS' : 'OPEN') as SelectionFormStatus,
    updatedBy: form.inChargeStaffName,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.selectionForms, form.id), updatedForm);

  // Also mirror selected subject IDs & status onto subjectUpdateStudents for Admin visibility
  if (live) {
    const subjById = new Map(allSubjects.map((s) => [s.id, s]));
    const pickedIds = Array.from(
      new Set([
        ...studentSelection.majorIds,
        ...studentSelection.micIds,
        ...studentSelection.mdcIds,
        ...studentSelection.aecIds,
        ...studentSelection.secIds,
        ...studentSelection.vacIds,
      ])
    ).filter((id) => subjById.has(id));
    const pickedNames = pickedIds.map((id) => subjById.get(id)!.subjectName);

    const updatedStudent: SubjectUpdateStudent = stripUndefined({
      ...live,
      matchedSubjectIds: pickedIds,
      matchedSubjectNames: pickedNames,
      allocationStatus: studentSelection.isComplete
        ? 'ALLOCATED'
        : pickedIds.length > 0
          ? 'PARTIAL'
          : 'UNMATCHED',
      updatedBy: form.inChargeStaffName,
      updatedAt: now,
    });
    await setDoc(doc(db, COLLECTIONS.students, live.id), updatedStudent);
  }

  return {
    formSummary: {
      id: updatedForm.id,
      title: updatedForm.title,
      institutionName: settings.institutionName || 'NGM Degree Mahavidyalaya',
      session: updatedForm.session,
      semester: updatedForm.semester,
      departmentName: updatedForm.departmentName,
      inChargeStaffName: updatedForm.inChargeStaffName,
      deadline: updatedForm.deadline,
      status: updatedForm.status,
      isLocked: updatedForm.isLocked,
      totalStudents: updatedForm.totalStudents,
      completedCount: updatedForm.completedCount,
      pendingCount: updatedForm.pendingCount,
      submittedAt: updatedForm.submittedAt,
    },
    studentSelection,
  };
}

export async function submitPublicSelectionFormServer(
  token: string
): Promise<PublicNepSelectionFormPayload> {
  const { db, form, allSubjects, studentMap, nepConfig, settings } = await loadPublicFormContext(token);

  if (form.isLocked) {
    throw new Error('LOCKED: This selection form is already finalized and locked.');
  }

  const nextSelections: Record<string, SubjectUpdateNepStudentSelection> = {};
  const incompleteList: Array<{ studentName: string; applicationNo: string; missingCategories: string[] }> = [];

  for (const sid of form.studentIds) {
    const live = studentMap.get(sid);
    const existingSel = form.selections?.[sid];
    const { selection, missingCategories } = evaluateNepSelection(
      {
        studentId: sid,
        applicationNo: live?.applicationNo || live?.rollNumber || existingSel?.applicationNo || '',
        rollNumber: live?.rollNumber || existingSel?.rollNumber || '',
        studentName: live?.studentName || existingSel?.studentName || 'Student',
        departmentName: live?.departmentName || existingSel?.departmentName || form.departmentName,
        majorIds: existingSel?.majorIds || [],
        micIds: existingSel?.micIds || [],
        mdcIds: existingSel?.mdcIds || [],
        aecIds: existingSel?.aecIds || [],
        secIds: existingSel?.secIds || [],
        vacIds: existingSel?.vacIds || [],
      },
      nepConfig
    );
    nextSelections[sid] = stripUndefined({
      ...selection,
      updatedAt: existingSel?.updatedAt,
      updatedBy: existingSel?.updatedBy,
    });
    if (missingCategories.length > 0) {
      incompleteList.push({
        studentName: selection.studentName,
        applicationNo: selection.applicationNo || selection.rollNumber,
        missingCategories,
      });
    }
  }

  if (incompleteList.length > 0) {
    const first = incompleteList[0];
    throw new Error(
      `Cannot finalize submission: ${incompleteList.length} student(s) still have incomplete mandatory selections (e.g. ${first.studentName}${first.applicationNo ? ` [${first.applicationNo}]` : ''} missing ${first.missingCategories.join(', ')}).`
    );
  }

  const now = new Date().toISOString();
  const submittedForm: SubjectUpdateSelectionForm = stripUndefined({
    ...form,
    selections: nextSelections,
    totalStudents: form.studentIds.length,
    completedCount: form.studentIds.length,
    pendingCount: 0,
    status: 'SUBMITTED' as SelectionFormStatus,
    isLocked: true,
    submittedAt: now,
    submittedBy: form.inChargeStaffName,
    updatedBy: form.inChargeStaffName,
    updatedAt: now,
  });

  await setDoc(doc(db, COLLECTIONS.selectionForms, form.id), submittedForm);

  return buildPublicPayloadFromContext(
    submittedForm,
    allSubjects,
    studentMap,
    nepConfig,
    settings.institutionName || 'NGM Degree Mahavidyalaya'
  );
}


