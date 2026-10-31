import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  PracticalExam,
  ExamStudent,
  SystemBootstrapStatus,
  AdminProfile,
} from '../types';

// ==================== AUTH & BOOTSTRAP API ====================

export async function fetchBootstrapStatus(): Promise<SystemBootstrapStatus> {
  // 1. Check server-side endpoint
  try {
    const res = await fetch('/api/bootstrap/status');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.isBootstrapped === 'boolean') {
        return data;
      }
    }
  } catch (err) {
    console.warn('API fetchBootstrapStatus network warning:', err);
  }

  // 2. Resilient Firestore direct check: never falsely show unbootstrapped if Firestore already has bootstrap/admin record
  try {
    const snap = await getDoc(doc(db, 'systemSettings', 'bootstrap'));
    if (snap.exists()) {
      const d = snap.data();
      if (d.isBootstrapped) {
        return {
          isBootstrapped: true,
          institutionName: d.institutionName || 'NGM Degree Mahavidyalaya',
          adminUsername: d.adminUsername || null,
          bootstrappedAt: d.bootstrappedAt || null,
        };
      }
    }

    // Also check admins collection
    const adminSnap = await getDocs(collection(db, 'admins'));
    if (!adminSnap.empty) {
      const firstAdmin = adminSnap.docs[0].data();
      return {
        isBootstrapped: true,
        institutionName: firstAdmin.institutionName || 'NGM Degree Mahavidyalaya',
        adminUsername: firstAdmin.username || null,
        bootstrappedAt: firstAdmin.createdAt || null,
      };
    }
  } catch (err) {
    console.warn('Direct Firestore bootstrap check notice:', err);
  }

  return {
    isBootstrapped: false,
    institutionName: 'NGM Degree Mahavidyalaya',
    adminUsername: null,
  };
}

export async function loginInitialBootstrap(username: string, password: string) {
  const res = await fetch('/api/bootstrap/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Bootstrap login failed');
  }
  return data;
}

export async function completePermanentAdminSetup(payload: {
  setupToken: string;
  newUsername: string;
  newPassword: string;
  confirmPassword: string;
  recoveryEmail: string;
  institutionName: string;
  adminFullName: string;
}) {
  const res = await fetch('/api/bootstrap/complete-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to complete administrator setup');
  }

  // Also verify/set in Firestore client-side for dual-guaranteed synchronization
  try {
    await setDoc(doc(db, 'systemSettings', 'bootstrap'), {
      isBootstrapped: true,
      institutionName: payload.institutionName,
      adminUsername: payload.newUsername,
      adminEmail: payload.recoveryEmail,
      adminUid: data.admin?.uid || `admin_${payload.newUsername.toLowerCase()}`,
      bootstrappedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Direct Firestore bootstrap record sync notice:', err);
  }

  return data;
}

export async function loginAdministrator(username: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Login failed');
  }
  return data;
}

export async function requestAdminRecovery(username: string, recoveryEmail: string) {
  const res = await fetch('/api/auth/request-recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, recoveryEmail }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Recovery request failed');
  }
  return data;
}

export async function resetAdminPasswordWithCode(payload: {
  username: string;
  recoveryEmail: string;
  recoveryCode: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Password reset failed');
  }
  return data;
}

// ==================== FIRESTORE PRACTICAL EXAMS ====================

const EXAMS_PATH = 'practical_exams';

export async function getPracticalExams(): Promise<PracticalExam[]> {
  try {
    const q = query(collection(db, EXAMS_PATH), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const exams: PracticalExam[] = [];
    snapshot.forEach((d) => {
      exams.push({ id: d.id, ...d.data() } as PracticalExam);
    });
    return exams;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, EXAMS_PATH);
  }
}

export async function getPracticalExamById(examId: string): Promise<PracticalExam | null> {
  const path = `${EXAMS_PATH}/${examId}`;
  try {
    const docRef = doc(db, EXAMS_PATH, examId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PracticalExam;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createPracticalExam(exam: Omit<PracticalExam, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const examId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `${EXAMS_PATH}/${examId}`;
  const now = new Date().toISOString();

  const newExam: PracticalExam = {
    ...exam,
    id: examId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, EXAMS_PATH, examId), newExam);
    return examId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePracticalExam(examId: string, updates: Partial<PracticalExam>): Promise<void> {
  const path = `${EXAMS_PATH}/${examId}`;
  try {
    await updateDoc(doc(db, EXAMS_PATH, examId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePracticalExam(examId: string): Promise<void> {
  const path = `${EXAMS_PATH}/${examId}`;
  try {
    await deleteDoc(doc(db, EXAMS_PATH, examId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== FIRESTORE STUDENTS & MARKS ====================

export async function getExamStudents(examId: string): Promise<ExamStudent[]> {
  const path = `${EXAMS_PATH}/${examId}/students`;
  try {
    const q = query(collection(db, path), orderBy('rollNo', 'asc'));
    const snap = await getDocs(q);
    const students: ExamStudent[] = [];
    snap.forEach((d) => {
      students.push({ id: d.id, ...d.data() } as ExamStudent);
    });
    return students;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveStudentEvaluation(
  examId: string,
  studentId: string,
  data: Partial<ExamStudent>
): Promise<void> {
  const path = `${EXAMS_PATH}/${examId}/students/${studentId}`;
  try {
    await setDoc(
      doc(db, EXAMS_PATH, examId, 'students', studentId),
      {
        ...data,
        enteredAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function batchSaveStudents(examId: string, students: ExamStudent[]): Promise<void> {
  const path = `${EXAMS_PATH}/${examId}/students`;
  try {
    const batch = writeBatch(db);
    students.forEach((student) => {
      const studentRef = doc(db, EXAMS_PATH, examId, 'students', student.id);
      batch.set(studentRef, student, { merge: true });
    });
    // Also update studentCount on exam doc
    const examRef = doc(db, EXAMS_PATH, examId);
    batch.update(examRef, {
      studentCount: students.length,
      updatedAt: new Date().toISOString(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
