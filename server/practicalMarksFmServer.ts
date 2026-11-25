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

export interface PracticalMarksFmConfigRecord {
  id: string;
  label: string;
  fullMarks: number;
  session?: string;
  semester?: string;
  category?: 'ALL' | 'MJC' | 'MIC' | 'MDC';
  isDefault?: boolean;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const COLLECTION_NAME = 'practicalMarksFmSettings';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as T;
}

function validateFmPayload(body: any): {
  label: string;
  fullMarks: number;
  session?: string;
  semester?: string;
  category?: 'ALL' | 'MJC' | 'MIC' | 'MDC';
  isDefault: boolean;
  notes?: string;
} {
  const rawLabel = typeof body?.label === 'string' ? body.label.trim() : '';
  const numFm = Number(body?.fullMarks);

  if (!rawLabel) {
    throw new Error('Configuration label is required (e.g., "Standard Practical FM 70").');
  }
  if (!Number.isFinite(numFm) || numFm <= 0) {
    throw new Error('Full Marks (FM) must be a positive number greater than 0.');
  }
  if (numFm > 1000) {
    throw new Error('Full Marks (FM) cannot exceed 1000.');
  }

  const rawCat = typeof body?.category === 'string' ? body.category.trim().toUpperCase() : 'ALL';
  const category: 'ALL' | 'MJC' | 'MIC' | 'MDC' =
    rawCat === 'MJC' || rawCat === 'MIC' || rawCat === 'MDC' ? rawCat : 'ALL';

  const session = typeof body?.session === 'string' && body.session.trim() ? body.session.trim() : undefined;
  const semester = typeof body?.semester === 'string' && body.semester.trim() ? body.semester.trim() : undefined;
  const notes = typeof body?.notes === 'string' && body.notes.trim() ? body.notes.trim() : undefined;

  return {
    label: rawLabel,
    fullMarks: numFm,
    session,
    semester,
    category,
    isDefault: Boolean(body?.isDefault),
    notes,
  };
}

export async function listPracticalMarksFmConfigsServer(): Promise<PracticalMarksFmConfigRecord[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const list: PracticalMarksFmConfigRecord[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<PracticalMarksFmConfigRecord, 'id'>) });
  });
  return list.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

async function clearDefaultFlagsExcept(exceptId: string) {
  const db = getDb();
  const snap = await getDocs(collection(db, COLLECTION_NAME));
  const batch = writeBatch(db);
  let hasUpdates = false;
  snap.forEach((d) => {
    const data = d.data();
    if (d.id !== exceptId && data?.isDefault) {
      batch.update(d.ref, { isDefault: false });
      hasUpdates = true;
    }
  });
  if (hasUpdates) {
    await batch.commit();
  }
}

export async function createPracticalMarksFmConfigServer(
  body: any,
  adminUsername: string
): Promise<PracticalMarksFmConfigRecord> {
  const validated = validateFmPayload(body);
  const db = getDb();
  const now = new Date().toISOString();
  const id = `pmfm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const record: PracticalMarksFmConfigRecord = stripUndefined({
    id,
    label: validated.label,
    fullMarks: validated.fullMarks,
    session: validated.session,
    semester: validated.semester,
    category: validated.category,
    isDefault: validated.isDefault,
    notes: validated.notes,
    createdBy: adminUsername,
    updatedBy: adminUsername,
    createdAt: now,
    updatedAt: now,
  });

  if (record.isDefault) {
    await clearDefaultFlagsExcept(id);
  }

  await setDoc(doc(db, COLLECTION_NAME, id), record);
  return record;
}

export async function updatePracticalMarksFmConfigServer(
  id: string,
  body: any,
  adminUsername: string
): Promise<PracticalMarksFmConfigRecord> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    throw new Error('Configuration ID is required.');
  }

  const db = getDb();
  const ref = doc(db, COLLECTION_NAME, cleanId);
  const existingSnap = await getDoc(ref);
  if (!existingSnap.exists()) {
    throw new Error('Saved Full Marks configuration not found.');
  }

  const existing = existingSnap.data() as PracticalMarksFmConfigRecord;
  const validated = validateFmPayload({
    label: body?.label ?? existing.label,
    fullMarks: body?.fullMarks ?? existing.fullMarks,
    session: body?.session !== undefined ? body.session : existing.session,
    semester: body?.semester !== undefined ? body.semester : existing.semester,
    category: body?.category ?? existing.category,
    isDefault: body?.isDefault !== undefined ? body.isDefault : existing.isDefault,
    notes: body?.notes !== undefined ? body.notes : existing.notes,
  });

  const now = new Date().toISOString();
  const updated: PracticalMarksFmConfigRecord = stripUndefined({
    ...existing,
    id: cleanId,
    label: validated.label,
    fullMarks: validated.fullMarks,
    session: validated.session,
    semester: validated.semester,
    category: validated.category,
    isDefault: validated.isDefault,
    notes: validated.notes,
    updatedBy: adminUsername,
    updatedAt: now,
  });

  if (updated.isDefault) {
    await clearDefaultFlagsExcept(cleanId);
  }

  await setDoc(ref, updated);
  return updated;
}

export async function deletePracticalMarksFmConfigServer(id: string): Promise<void> {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    throw new Error('Configuration ID is required.');
  }
  const db = getDb();
  const ref = doc(db, COLLECTION_NAME, cleanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Saved Full Marks configuration not found.');
  }
  await deleteDoc(ref);
}
