import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  FormEnrollment,
  PaperStudent,
  PracticalForm,
  SubjectType,
} from '../types';
import {
  getAcademicSemesters,
  getAcademicSessions,
  getPracticalSubjects,
  logActivity,
  normalizeSemester,
} from './collegeService';
import { MemoSheetConfig, MemoSubjectOption } from '../types/memo';

export { getAcademicSessions, getAcademicSemesters };

export function buildMemoConfigId(
  session: string,
  semester: string,
  category: SubjectType,
  subject: string
): string {
  const cSess = session.trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cSem = normalizeSemester(semester).replace(/[^a-zA-Z0-9]/g, '_');
  const cCat = category.trim().toUpperCase();
  const cSubj = subject.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `memo_${cSess}_${cSem}_${cCat}_${cSubj}`;
}

/**
 * Fetches all subjects that have students or configured practical forms/papers
 * for the selected Session + Semester + Category (MJC/MIC/MDC), plus active master subjects.
 * Strictly read-only against existing ERP collections.
 */
export async function fetchMemoSubjectsForSelection(
  session: string,
  semester: string,
  category: SubjectType
): Promise<MemoSubjectOption[]> {
  const normSem = normalizeSemester(semester);
  const normCat = category.trim().toUpperCase() as SubjectType;

  const subjectMap = new Map<
    string,
    { rollSet: Set<string>; paperSet: Set<string> }
  >();

  const ensureSubject = (subjName: string) => {
    const clean = subjName.trim().toUpperCase();
    if (!clean) return null;
    if (!subjectMap.has(clean)) {
      subjectMap.set(clean, { rollSet: new Set<string>(), paperSet: new Set<string>() });
    }
    return subjectMap.get(clean)!;
  };

  try {
    // 1. Query paperStudents for this session (primary student roster source)
    const psQuery = query(
      collection(db, 'paperStudents'),
      where('session', '==', session.trim())
    );
    const psSnap = await getDocs(psQuery);

    psSnap.forEach((d) => {
      const data = d.data() as PaperStudent;
      if (data.status === 'removed') return;
      if (normalizeSemester(data.semester) !== normSem) return;
      if ((data.subjectType || '').trim().toUpperCase() !== normCat) return;
      const subj = (data.subject || '').trim().toUpperCase();
      const roll = String(data.rollNumber ?? '').trim();
      if (!subj) return;

      const entry = ensureSubject(subj);
      if (entry) {
        if (roll) entry.rollSet.add(roll);
        if (data.paperName) entry.paperSet.add(data.paperName.trim());
      }
    });

    // 2. Also inspect practicalForms + formEnrollments for any additional linked rosters
    const pfSnap = await getDocs(collection(db, 'practicalForms'));
    const matchingForms: PracticalForm[] = [];
    pfSnap.forEach((d) => {
      const f = { id: d.id, ...d.data() } as PracticalForm;
      const formSess = (f.session || f.examYear || '').trim();
      const formSem = normalizeSemester(f.semester);
      const formCat = (f.subjectType || 'MJC').trim().toUpperCase();
      if (formSess === session.trim() && formSem === normSem && formCat === normCat) {
        matchingForms.push(f);
      }
    });

    if (matchingForms.length > 0) {
      await Promise.all(
        matchingForms.map(async (form) => {
          const enrSnap = await getDocs(
            query(collection(db, 'formEnrollments'), where('practicalFormId', '==', form.id))
          );
          enrSnap.forEach((d) => {
            const enr = d.data() as FormEnrollment;
            if (enr.status === 'removed') return;
            const subj = (enr.subject || form.subjectName || '').trim().toUpperCase();
            const roll = String(enr.rollNumber ?? '').trim();
            if (!subj) return;
            const entry = ensureSubject(subj);
            if (entry) {
              if (roll) entry.rollSet.add(roll);
              if (form.paperName) entry.paperSet.add(form.paperName.trim());
            }
          });
        })
      );
    }

    // 3. Also include active master practical subjects (with 0 count if no students uploaded yet)
    const masterSubjects = await getPracticalSubjects().catch(() => []);
    masterSubjects.forEach((ms) => {
      if (ms.isActive !== false && ms.name) {
        ensureSubject(ms.name);
      }
    });
  } catch (err) {
    console.warn('Error fetching subjects for Memo Sheet:', err);
  }

  return Array.from(subjectMap.entries())
    .map(([subject, info]) => ({
      subject,
      studentCount: info.rollSet.size,
      papers: Array.from(info.paperSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    }))
    .sort((a, b) => {
      // Put subjects with students first, then alphabetical
      if (a.studentCount > 0 && b.studentCount === 0) return -1;
      if (a.studentCount === 0 && b.studentCount > 0) return 1;
      return a.subject.localeCompare(b.subject);
    });
}

/**
 * Fetches unique Roll Numbers in original database order for the selected
 * Session, Semester, Category (MJC/MIC/MDC), and Subject.
 * Preserves exact string values including leading zeros.
 * Strictly read-only against existing student/enrollment records.
 */
export async function fetchMemoRollNumbers(params: {
  session: string;
  semester: string;
  category: SubjectType;
  subject: string;
  paperFilter?: string;
}): Promise<string[]> {
  const normSession = params.session.trim();
  const normSem = normalizeSemester(params.semester);
  const normCat = params.category.trim().toUpperCase();
  const normSubj = params.subject.trim().toUpperCase();
  const normPaper = params.paperFilter && params.paperFilter !== 'ALL'
    ? params.paperFilter.trim().toUpperCase()
    : null;

  const seenKeys = new Set<string>();
  const collected: Array<{ roll: string; serialNo?: number }> = [];

  const addRollIfUnique = (rawRoll: unknown, serialNo?: number | string) => {
    const exactRoll = String(rawRoll ?? '').trim();
    if (!exactRoll) return;
    const dedupKey = exactRoll.toUpperCase();
    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);

    const parsedSerial =
      serialNo !== undefined && serialNo !== null && String(serialNo).trim() !== ''
        ? Number(serialNo)
        : NaN;

    collected.push({
      roll: exactRoll,
      serialNo: Number.isFinite(parsedSerial) ? parsedSerial : undefined,
    });
  };

  // 1. Primary source: paperStudents collection
  const psQuery = query(
    collection(db, 'paperStudents'),
    where('session', '==', normSession)
  );
  const psSnap = await getDocs(psQuery);

  const matchedPaperDocs: PaperStudent[] = [];
  psSnap.forEach((d) => {
    const data = d.data() as PaperStudent;
    if (data.status === 'removed') return;
    if (normalizeSemester(data.semester) !== normSem) return;
    if ((data.subjectType || '').trim().toUpperCase() !== normCat) return;
    if ((data.subject || '').trim().toUpperCase() !== normSubj) return;
    if (normPaper && (data.paperName || '').trim().toUpperCase() !== normPaper) return;
    matchedPaperDocs.push({ ...data, id: d.id });
  });

  // Sort matched paperStudents preserving original serialNo / roll ordering
  matchedPaperDocs.sort((a, b) => {
    const sA = a.serialNo !== undefined && a.serialNo !== '' ? Number(a.serialNo) : NaN;
    const sB = b.serialNo !== undefined && b.serialNo !== '' ? Number(b.serialNo) : NaN;
    if (Number.isFinite(sA) && Number.isFinite(sB) && sA !== sB) {
      return sA - sB;
    }
    return String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, {
      numeric: true,
    });
  });

  matchedPaperDocs.forEach((docItem) => {
    addRollIfUnique(docItem.rollNumber, docItem.serialNo);
  });

  // 2. Secondary fallback/merge: practicalForms + formEnrollments
  const pfSnap = await getDocs(collection(db, 'practicalForms'));
  const matchingForms: PracticalForm[] = [];
  pfSnap.forEach((d) => {
    const f = { id: d.id, ...d.data() } as PracticalForm;
    const formSess = (f.session || f.examYear || '').trim();
    const formSem = normalizeSemester(f.semester);
    const formCat = (f.subjectType || 'MJC').trim().toUpperCase();
    if (formSess !== normSession || formSem !== normSem || formCat !== normCat) return;
    if (normPaper && (f.paperName || '').trim().toUpperCase() !== normPaper) return;
    matchingForms.push(f);
  });

  if (matchingForms.length > 0) {
    const enrollmentLists = await Promise.all(
      matchingForms.map(async (form) => {
        const enrSnap = await getDocs(
          query(collection(db, 'formEnrollments'), where('practicalFormId', '==', form.id))
        );
        const rows: FormEnrollment[] = [];
        enrSnap.forEach((d) => {
          const enr = d.data() as FormEnrollment;
          if (enr.status === 'removed') return;
          const enrSubj = (enr.subject || form.subjectName || '').trim().toUpperCase();
          if (enrSubj === normSubj) {
            rows.push(enr);
          }
        });
        rows.sort((a, b) =>
          String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, {
            numeric: true,
          })
        );
        return rows;
      })
    );

    enrollmentLists.flat().forEach((enr) => {
      addRollIfUnique(enr.rollNumber);
    });
  }

  return collected
    .map((item) => item.roll)
    .sort((a, b) => {
      const sa = String(a).trim();
      const sb = String(b).trim();
      const aIsNum = /^\d+$/.test(sa);
      const bIsNum = /^\d+$/.test(sb);
      if (aIsNum && bIsNum) {
        const ba = BigInt(sa);
        const bb = BigInt(sb);
        if (ba < bb) return -1;
        if (ba > bb) return 1;
        return sa.localeCompare(sb);
      }
      return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    });
}

/**
 * Loads previously saved Memo Sheet examination & professor config for a subject
 * from the additive `memoSheetConfigs` collection.
 */
export async function getMemoSheetConfig(
  session: string,
  semester: string,
  category: SubjectType,
  subject: string
): Promise<MemoSheetConfig | null> {
  try {
    const id = buildMemoConfigId(session, semester, category, subject);
    const snap = await getDoc(doc(db, 'memoSheetConfigs', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as MemoSheetConfig;
  } catch (err) {
    console.warn('Could not fetch memo sheet config:', err);
    return null;
  }
}

/**
 * Saves Memo Sheet examination & professor details to the additive `memoSheetConfigs` collection.
 * Does NOT touch any existing student, subject, form, or marks records.
 */
export async function saveMemoSheetConfig(
  config: Omit<MemoSheetConfig, 'id' | 'updatedAt'>
): Promise<MemoSheetConfig> {
  const id = buildMemoConfigId(
    config.session,
    config.semester,
    config.category,
    config.subject
  );
  const payload: MemoSheetConfig = {
    ...config,
    id,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'memoSheetConfigs', id), payload, { merge: true });
  await logActivity(
    'MEMO_CONFIG_SAVED',
    `Saved Memo Sheet details for ${config.subject} (${config.category}) - ${config.session} / ${config.semester}`,
    'MemoSheetConfig',
    id
  );
  return payload;
}
