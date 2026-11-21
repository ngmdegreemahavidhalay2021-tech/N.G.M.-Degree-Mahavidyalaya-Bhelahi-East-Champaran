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
import type {
  SubjectUpdateCategory,
  SubjectUpdateDepartment,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateSystemSettings,
  SubjectUpdateSystemState,
} from '../src/types/index.ts';

const COLLECTIONS = {
  subjects: 'subjectUpdateSubjects',
  sessions: 'subjectUpdateSessions',
  semesters: 'subjectUpdateSemesters',
  categories: 'subjectUpdateCategories',
  departments: 'subjectUpdateDepartments',
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

  const [subjSnap, sessSnap, semSnap, catSnap, deptSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.subjects)),
    getDocs(collection(db, COLLECTIONS.sessions)),
    getDocs(collection(db, COLLECTIONS.semesters)),
    getDocs(collection(db, COLLECTIONS.categories)),
    getDocs(collection(db, COLLECTIONS.departments)),
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

  return {
    subjects,
    sessions,
    semesters,
    categories,
    departments,
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
