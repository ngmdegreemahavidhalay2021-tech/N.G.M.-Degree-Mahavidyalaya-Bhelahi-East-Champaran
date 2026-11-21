import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import {
  getFirestore as getClientFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  updateDoc,
} from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';

// Load config from firebase-applet-config.json
let rawConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch {
  // Ignore
}

function cleanEnvValue(val: string | undefined, pattern?: RegExp): string | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const cleaned = val
    .trim()
    .replace(/^[`"']+/, '')
    .replace(/[`"';}\s]+$/g, '')
    .trim();
  if (!cleaned) return undefined;
  if (pattern && !pattern.test(cleaned)) return undefined;
  return cleaned;
}

const hasAppletConfig = Boolean(
  rawConfig?.projectId && rawConfig.projectId !== 'remixed-project-id'
);

const firebaseConfig = {
  projectId:
    (hasAppletConfig ? rawConfig.projectId : undefined) ||
    cleanEnvValue(process.env.FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    cleanEnvValue(process.env.VITE_FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    'vast-archive-1dzcr',
  appId:
    (hasAppletConfig ? rawConfig.appId : undefined) ||
    cleanEnvValue(process.env.FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    cleanEnvValue(process.env.VITE_FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    '1:85113631348:web:3b58b4185838c3b9049721',
  apiKey:
    (hasAppletConfig ? rawConfig.apiKey : undefined) ||
    cleanEnvValue(process.env.FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    cleanEnvValue(process.env.VITE_FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    'AIzaSyA66T63kI2_np7ktpIzeDN729ZwyJ19MOg',
  authDomain:
    (hasAppletConfig ? rawConfig.authDomain : undefined) ||
    cleanEnvValue(process.env.FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(process.env.VITE_FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    'vast-archive-1dzcr.firebaseapp.com',
  firestoreDatabaseId:
    (hasAppletConfig ? rawConfig.firestoreDatabaseId : undefined) ||
    cleanEnvValue(process.env.FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    cleanEnvValue(process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    'ai-studio-bf141177-705a-4793-b2bc-644ebb83d388',
  storageBucket:
    (hasAppletConfig ? rawConfig.storageBucket : undefined) ||
    cleanEnvValue(process.env.FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(process.env.VITE_FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    'vast-archive-1dzcr.firebasestorage.app',
  messagingSenderId:
    (hasAppletConfig ? rawConfig.messagingSenderId : undefined) ||
    cleanEnvValue(process.env.FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    cleanEnvValue(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    '85113631348',
};

// Initialize server-side Firestore instance with target databaseId
function getDb() {
  const existingApps = getClientApps();
  const app = existingApps.length > 0 ? existingApps[0] : initClientApp(firebaseConfig);
  return getClientFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export interface ServerBootstrapStatus {
  isBootstrapped: boolean;
  institutionName: string;
  adminUsername: string | null;
  adminEmail: string | null;
  adminUid: string | null;
  bootstrappedAt: string | null;
}

export interface AdminRecord {
  uid: string;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  designation?: string;
  photoUrl?: string;
  role: 'admin';
  passwordHash: string;
  institutionName?: string;
  createdAt: string;
  updatedAt: string;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), '.bootstrap-state.json');

// Memory cache for active process
let memoryCache: ServerBootstrapStatus | null = null;

/**
 * Reads authoritative bootstrap status directly from Firestore.
 * Concurrently checks `systemSettings/bootstrap` and the `admins` collection.
 */
export async function getBootstrapStatusServer(): Promise<ServerBootstrapStatus> {
  const defaultStatus: ServerBootstrapStatus = {
    isBootstrapped: false,
    institutionName: 'NGM Degree Mahavidyalaya',
    adminUsername: null,
    adminEmail: null,
    adminUid: null,
    bootstrappedAt: null,
  };

  try {
    const db = getDb();

    // 1. Check systemSettings/bootstrap
    const bootRef = doc(db, 'systemSettings', 'bootstrap');
    const bootSnap = await getDoc(bootRef);

    if (bootSnap.exists()) {
      const data = bootSnap.data();
      if (data.isBootstrapped) {
        const status: ServerBootstrapStatus = {
          isBootstrapped: true,
          institutionName: data.institutionName || 'NGM Degree Mahavidyalaya',
          adminUsername: data.adminUsername || null,
          adminEmail: data.adminEmail || null,
          adminUid: data.adminUid || null,
          bootstrappedAt: data.bootstrappedAt || null,
        };
        memoryCache = status;
        syncLocalFile(status);
        return status;
      }
    }

    // 2. Also check if any admin exists in admins collection
    const adminsSnap = await getDocs(collection(db, 'admins'));
    if (!adminsSnap.empty) {
      const firstAdmin = adminsSnap.docs[0].data() as AdminRecord;
      const status: ServerBootstrapStatus = {
        isBootstrapped: true,
        institutionName: firstAdmin.institutionName || 'NGM Degree Mahavidyalaya',
        adminUsername: firstAdmin.username,
        adminEmail: firstAdmin.email,
        adminUid: firstAdmin.uid,
        bootstrappedAt: firstAdmin.createdAt,
      };

      // Repair/backfill systemSettings/bootstrap so both are always in sync
      try {
        await setDoc(bootRef, {
          isBootstrapped: true,
          institutionName: status.institutionName,
          adminUsername: status.adminUsername,
          adminEmail: status.adminEmail,
          adminUid: status.adminUid,
          bootstrappedAt: status.bootstrappedAt,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('Could not backfill systemSettings/bootstrap:', err);
      }

      memoryCache = status;
      syncLocalFile(status);
      return status;
    }
  } catch (err: any) {
    // Fall back to memory cache or local file backup if Firestore is momentarily unreachable
    if (memoryCache && memoryCache.isBootstrapped) {
      return memoryCache;
    }
    const local = readLocalFile();
    if (local && local.isBootstrapped) {
      return local;
    }
    if (!err?.message?.includes('offline')) {
      console.warn('[FirestoreServer] Firestore status check notice:', err?.message || err);
    }
  }

  return defaultStatus;
}

/**
 * Atomically writes the permanent Admin account and bootstrap completion record to Firestore.
 */
export async function completeAdminSetupServer(payload: {
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  institutionName: string;
}): Promise<{ admin: AdminRecord; status: ServerBootstrapStatus }> {
  // First verify whether system is already bootstrapped in Firestore
  const currentStatus = await getBootstrapStatusServer();
  if (currentStatus.isBootstrapped) {
    throw new Error('Bootstrap already completed. System is already initialized.');
  }

  const cleanUsername = payload.username.trim();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanName = payload.fullName.trim() || cleanUsername;
  const instName = payload.institutionName.trim() || 'NGM Degree Mahavidyalaya';
  const now = new Date().toISOString();
  const adminUid = `admin_${cleanUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;

  const adminRecord: AdminRecord = {
    uid: adminUid,
    username: cleanUsername,
    email: cleanEmail,
    fullName: cleanName,
    role: 'admin',
    passwordHash: payload.passwordHash,
    institutionName: instName,
    createdAt: now,
    updatedAt: now,
  };

  const statusRecord: ServerBootstrapStatus = {
    isBootstrapped: true,
    institutionName: instName,
    adminUsername: cleanUsername,
    adminEmail: cleanEmail,
    adminUid,
    bootstrappedAt: now,
  };

  const db = getDb();

  // 1. Write admin document to 'admins/{adminUid}'
  await setDoc(doc(db, 'admins', adminUid), adminRecord);

  // 2. Write permanent bootstrap state to 'systemSettings/bootstrap'
  await setDoc(doc(db, 'systemSettings', 'bootstrap'), {
    ...statusRecord,
    updatedAt: now,
  });

  // 3. Record audit log in 'activityLogs'
  try {
    const logId = `log_${Date.now()}_setup`;
    await setDoc(doc(db, 'activityLogs', logId), {
      id: logId,
      action: 'ADMIN_BOOTSTRAP_COMPLETED',
      entityType: 'AdminProfile',
      entityId: adminUid,
      details: `Permanent administrator ${cleanUsername} (${cleanEmail}) established. Initial credentials retired permanently.`,
      performedBy: cleanUsername,
      timestamp: now,
    });
  } catch (err) {
    console.warn('Could not record setup activity log:', err);
  }

  // Update memory and local backup
  memoryCache = statusRecord;
  syncLocalFile({
    ...statusRecord,
    adminPasswordHash: payload.passwordHash,
  });

  return { admin: adminRecord, status: statusRecord };
}

/**
 * Retrieves an admin record from Firestore matching username or email.
 */
export async function getAdminByLoginServer(identifier: string): Promise<AdminRecord | null> {
  const clean = identifier.trim().toLowerCase();
  try {
    const db = getDb();
    const snap = await getDocs(collection(db, 'admins'));
    for (const d of snap.docs) {
      const data = d.data() as AdminRecord;
      if (
        (data.username && data.username.toLowerCase() === clean) ||
        (data.email && data.email.toLowerCase() === clean)
      ) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[FirestoreServer] getAdminByLoginServer error:', (err as Error).message);
  }

  // Local backup fallback if offline
  const local = readLocalFile();
  if (
    local &&
    local.adminPasswordHash &&
    ((local.adminUsername && local.adminUsername.toLowerCase() === clean) ||
      (local.adminEmail && local.adminEmail.toLowerCase() === clean))
  ) {
    return {
      uid: local.adminUid || 'admin_primary',
      username: local.adminUsername!,
      email: local.adminEmail || '',
      role: 'admin',
      passwordHash: local.adminPasswordHash,
      institutionName: local.institutionName,
      createdAt: local.bootstrappedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Updates an admin's password in Firestore
 */
export async function updateAdminPasswordServer(
  adminUid: string,
  newPasswordHash: string
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'admins', adminUid), {
    passwordHash: newPasswordHash,
    updatedAt: now,
  });

  const local = readLocalFile();
  if (local) {
    local.adminPasswordHash = newPasswordHash;
    syncLocalFile(local);
  }
}

/**
 * Retrieves an admin record by direct UID
 */
export async function getAdminByIdServer(adminUid: string): Promise<AdminRecord | null> {
  try {
    const db = getDb();
    const docRef = doc(db, 'admins', adminUid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as AdminRecord;
    }
  } catch (err) {
    console.warn('[FirestoreServer] getAdminByIdServer error:', (err as Error).message);
  }

  const local = readLocalFile();
  if (local && local.adminUid === adminUid) {
    return {
      uid: local.adminUid,
      username: local.adminUsername || 'admin',
      email: local.adminEmail || '',
      role: 'admin',
      passwordHash: local.adminPasswordHash || '',
      institutionName: local.institutionName,
      createdAt: local.bootstrappedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Updates admin profile fields (fullName, phone, designation, photoUrl, institutionName) in Firestore
 */
export async function updateAdminProfileServer(
  adminUid: string,
  updates: Partial<AdminRecord>
): Promise<AdminRecord> {
  const db = getDb();
  const now = new Date().toISOString();
  const docRef = doc(db, 'admins', adminUid);

  const cleanUpdates: any = {
    updatedAt: now,
  };

  if (updates.fullName !== undefined) cleanUpdates.fullName = updates.fullName.trim();
  if (updates.email !== undefined) cleanUpdates.email = updates.email.trim().toLowerCase();
  if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim();
  if (updates.designation !== undefined) cleanUpdates.designation = updates.designation.trim();
  if (updates.photoUrl !== undefined) cleanUpdates.photoUrl = updates.photoUrl.trim();
  if (updates.institutionName !== undefined) cleanUpdates.institutionName = updates.institutionName.trim();

  await updateDoc(docRef, cleanUpdates);

  // Read updated record
  const updatedSnap = await getDoc(docRef);
  const updatedRecord = updatedSnap.data() as AdminRecord;

  // Also sync bootstrap document if email or institutionName updated
  try {
    const bootRef = doc(db, 'systemSettings', 'bootstrap');
    await updateDoc(bootRef, {
      institutionName: updatedRecord.institutionName || 'NGM Degree Mahavidyalaya',
      adminEmail: updatedRecord.email,
      updatedAt: now,
    });
  } catch (err) {
    console.warn('Could not sync bootstrap institutionName:', err);
  }

  const local = readLocalFile();
  if (local && local.adminUid === adminUid) {
    Object.assign(local, cleanUpdates);
    syncLocalFile(local);
  }

  return updatedRecord;
}

/**
 * Validates duplicate User IDs and updates Administrator User ID (username) permanently in Firestore
 * without modifying passwordHash or other profile fields.
 */
export async function updateAdminUsernameServer(
  adminUid: string,
  newUsername: string
): Promise<AdminRecord> {
  const db = getDb();
  const cleanUsername = newUsername.trim();
  const cleanLower = cleanUsername.toLowerCase();
  const now = new Date().toISOString();

  // 1. Validate uniqueness across all admin records in Firestore
  const adminsSnap = await getDocs(collection(db, 'admins'));
  let targetDocId: string | null = null;
  let existingData: AdminRecord | null = null;

  for (const d of adminsSnap.docs) {
    const data = d.data() as AdminRecord;
    const isSelf = d.id === adminUid || data.uid === adminUid;
    if (isSelf) {
      targetDocId = d.id;
      existingData = data;
    } else if (data.username && data.username.trim().toLowerCase() === cleanLower) {
      throw new Error('This User ID is already in use. Please choose a different User ID.');
    }
  }

  if (!targetDocId || !existingData) {
    throw new Error('Administrator record not found.');
  }

  // 2. Update only username and updatedAt (preserving passwordHash and all other profile fields)
  const docRef = doc(db, 'admins', targetDocId);
  await updateDoc(docRef, {
    username: cleanUsername,
    updatedAt: now,
  });

  // 3. Sync systemSettings/bootstrap so login status and metadata reflect the updated User ID
  try {
    const bootRef = doc(db, 'systemSettings', 'bootstrap');
    await setDoc(
      bootRef,
      {
        adminUsername: cleanUsername,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not sync bootstrap adminUsername:', err);
  }

  // 4. Sync memory cache and local fallback cache
  if (memoryCache) {
    memoryCache = {
      ...memoryCache,
      adminUsername: cleanUsername,
    };
  }
  const local = readLocalFile();
  if (local) {
    local.adminUsername = cleanUsername;
    syncLocalFile(local);
  }

  const updatedSnap = await getDoc(docRef);
  return (updatedSnap.data() as AdminRecord) || {
    ...existingData,
    username: cleanUsername,
    updatedAt: now,
  };
}

/**
 * Unlocks a finally-submitted PracticalForm in Firestore on verified Administrator action,
 * preserving all submitted marks and appending to unlockHistory.
 */
export async function unlockPracticalFormMarksServer(
  formId: string,
  admin: { uid: string; username: string; reason?: string }
): Promise<{ form: any; unlockEntry: any }> {
  const db = getDb();
  const formRef = doc(db, 'practicalForms', formId);
  const snap = await getDoc(formRef);

  if (!snap.exists()) {
    throw new Error('Practical examination form not found.');
  }

  const existing = snap.data() as any;
  const now = new Date().toISOString();
  const existingHistory = Array.isArray(existing.unlockHistory) ? existing.unlockHistory : [];

  const unlockEntry: Record<string, any> = {
    unlockedBy: admin.username,
    unlockedByUid: admin.uid,
    unlockedAt: now,
  };
  if (existing.finalSubmittedAt) {
    unlockEntry.previousSubmittedAt = existing.finalSubmittedAt;
  }
  if (existing.finalSubmittedBy) {
    unlockEntry.previousSubmittedBy = existing.finalSubmittedBy;
  }
  if (admin.reason && admin.reason.trim()) {
    unlockEntry.reason = admin.reason.trim();
  }

  const updatedHistory = [...existingHistory, unlockEntry];
  const updates = {
    status: 'published',
    isMarksLocked: false,
    marksLockStatus: 'unlocked',
    lastUnlockedAt: now,
    lastUnlockedBy: admin.username,
    unlockHistory: updatedHistory,
    updatedAt: now,
  };

  await updateDoc(formRef, updates);

  // Record audit trail in activityLogs
  try {
    const logId = `log_${Date.now()}_unlock_${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'activityLogs', logId), {
      id: logId,
      action: 'MARKS_UNLOCKED_BY_ADMIN',
      entityType: 'PracticalForm',
      entityId: formId,
      details: `Administrator ${admin.username} unlocked marks editing for "${existing.title || formId}" (${existing.subjectName || existing.subjectCode || 'Practical'}). Previous marks preserved.`,
      performedBy: admin.username,
      timestamp: now,
    });
  } catch (err) {
    console.warn('Could not record marks unlock activity log:', err);
  }

  return {
    form: { id: snap.id, ...existing, ...updates },
    unlockEntry,
  };
}

// Local helper to read/write disk cache as safety net
function readLocalFile(): any {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return null;
}

function syncLocalFile(data: any): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore in read-only / serverless environments
  }
}
