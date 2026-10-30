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
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Department,
  Subject,
  PracticalForm,
  Student,
  FormEnrollment,
  MarksRecord,
  ActivityLog,
  CollegeStats,
} from '../types';

// ==================== ACTIVITY LOGGING ====================

export async function logActivity(
  action: string,
  details: string,
  entityType?: string,
  entityId?: string,
  performedBy = 'Administrator'
): Promise<void> {
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const logItem: ActivityLog = {
    id: logId,
    action,
    entityType,
    entityId,
    details,
    performedBy,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'activityLogs', logId), logItem);
  } catch (err) {
    console.warn('Could not record activity log:', err);
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  try {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(150));
    const snap = await getDocs(q);
    const logs: ActivityLog[] = [];
    snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as ActivityLog));
    return logs;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'activityLogs');
  }
}

// ==================== DEPARTMENTS ====================

export async function getDepartments(): Promise<Department[]> {
  try {
    const snap = await getDocs(collection(db, 'departments'));
    const list: Department[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Department));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'departments');
  }
}

export async function createDepartment(data: Omit<Department, 'id' | 'createdAt'>): Promise<Department> {
  const id = `dept_${data.code.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  const dept: Department = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'departments', id), dept);
    await logActivity('DEPARTMENT_CREATED', `Added department ${dept.name} (${dept.code})`, 'Department', id);
    return dept;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'departments');
  }
}

export async function updateDepartment(id: string, updates: Partial<Department>): Promise<void> {
  try {
    await updateDoc(doc(db, 'departments', id), updates);
    await logActivity('DEPARTMENT_UPDATED', `Updated department details for ${id}`, 'Department', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `departments/${id}`);
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'departments', id));
    await logActivity('DEPARTMENT_DELETED', `Deleted department ${id}`, 'Department', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `departments/${id}`);
  }
}

// ==================== SUBJECTS ====================

export async function getSubjects(departmentId?: string): Promise<Subject[]> {
  try {
    const colRef = collection(db, 'subjects');
    const q = departmentId ? query(colRef, where('departmentId', '==', departmentId)) : colRef;
    const snap = await getDocs(q);
    const list: Subject[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Subject));
    return list.sort((a, b) => a.code.localeCompare(b.code));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'subjects');
  }
}

export async function createSubject(data: Omit<Subject, 'id' | 'createdAt'>): Promise<Subject> {
  const id = `subj_${data.code.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  const subj: Subject = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'subjects', id), subj);
    await logActivity('SUBJECT_CREATED', `Added subject ${subj.name} (${subj.code})`, 'Subject', id);
    return subj;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'subjects');
  }
}

export async function updateSubject(id: string, updates: Partial<Subject>): Promise<void> {
  try {
    await updateDoc(doc(db, 'subjects', id), updates);
    await logActivity('SUBJECT_UPDATED', `Updated subject ${id}`, 'Subject', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `subjects/${id}`);
  }
}

export async function deleteSubject(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'subjects', id));
    await logActivity('SUBJECT_DELETED', `Deleted subject ${id}`, 'Subject', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `subjects/${id}`);
  }
}

// ==================== PRACTICAL FORMS ====================

function generateSecureToken(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function getPracticalForms(): Promise<PracticalForm[]> {
  try {
    const snap = await getDocs(collection(db, 'practicalForms'));
    const list: PracticalForm[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PracticalForm));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'practicalForms');
  }
}

export async function getPracticalFormById(id: string): Promise<PracticalForm | null> {
  try {
    const snap = await getDoc(doc(db, 'practicalForms', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PracticalForm;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `practicalForms/${id}`);
  }
}

export async function getPracticalFormByToken(token: string): Promise<PracticalForm | null> {
  try {
    const q = query(collection(db, 'practicalForms'), where('token', '==', token), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docData = snap.docs[0];
    return { id: docData.id, ...docData.data() } as PracticalForm;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `practicalForms/by-token/${token}`);
  }
}

export async function createPracticalForm(data: Omit<PracticalForm, 'id' | 'token' | 'createdAt' | 'updatedAt'>): Promise<PracticalForm> {
  const id = `form_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const token = generateSecureToken();
  const now = new Date().toISOString();

  const form: PracticalForm = {
    ...data,
    id,
    token,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'practicalForms', id), form);
    await logActivity('PRACTICAL_FORM_CREATED', `Created practical examination form "${form.title}" (${form.subjectCode})`, 'PracticalForm', id);
    return form;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'practicalForms');
  }
}

export async function updatePracticalForm(id: string, updates: Partial<PracticalForm>): Promise<void> {
  try {
    await updateDoc(doc(db, 'practicalForms', id), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    await logActivity('PRACTICAL_FORM_UPDATED', `Updated practical form ${id}`, 'PracticalForm', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `practicalForms/${id}`);
  }
}

export async function duplicatePracticalForm(id: string): Promise<PracticalForm> {
  const existing = await getPracticalFormById(id);
  if (!existing) throw new Error('Original practical form not found');

  const newForm = await createPracticalForm({
    ...existing,
    title: `${existing.title} (Copy)`,
    status: 'draft',
    isStudentListLocked: false,
    isActive: true,
  });

  // Also duplicate student enrollments
  const enrollments = await getFormEnrollments(id);
  if (enrollments.length > 0) {
    const batch = writeBatch(db);
    enrollments.forEach((e) => {
      const newEnrollmentId = `enr_${newForm.id}_${e.studentId}`;
      batch.set(doc(db, 'formEnrollments', newEnrollmentId), {
        ...e,
        id: newEnrollmentId,
        practicalFormId: newForm.id,
        enrolledAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }

  await logActivity('PRACTICAL_FORM_DUPLICATED', `Duplicated form ${existing.title} into new form ${newForm.id}`, 'PracticalForm', newForm.id);
  return newForm;
}

export async function deletePracticalForm(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'practicalForms', id));
    await logActivity('PRACTICAL_FORM_DELETED', `Deleted practical examination form ${id}`, 'PracticalForm', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `practicalForms/${id}`);
  }
}

export async function regenerateFormToken(id: string): Promise<string> {
  const newToken = generateSecureToken();
  try {
    await updateDoc(doc(db, 'practicalForms', id), {
      token: newToken,
      updatedAt: new Date().toISOString(),
    });
    await logActivity('FORM_LINK_REGENERATED', `Regenerated public access token for form ${id}`, 'PracticalForm', id);
    return newToken;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `practicalForms/${id}`);
  }
}

// ==================== STUDENTS ====================

export async function getStudents(departmentId?: string): Promise<Student[]> {
  try {
    const colRef = collection(db, 'students');
    const q = departmentId ? query(colRef, where('departmentId', '==', departmentId)) : colRef;
    const snap = await getDocs(q);
    const list: Student[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Student));
    return list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'students');
  }
}

export async function createStudent(data: Omit<Student, 'id' | 'createdAt'>): Promise<Student> {
  const cleanRoll = data.rollNumber.trim().toUpperCase();
  const id = `std_${data.departmentId}_${cleanRoll.replace(/[^A-Z0-9]/g, '_')}`;

  const student: Student = {
    ...data,
    id,
    rollNumber: cleanRoll,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'students', id), student);
    await logActivity('STUDENT_ADDED', `Registered candidate ${student.studentName} (Roll: ${cleanRoll})`, 'Student', id);
    return student;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'students');
  }
}

export async function batchImportStudents(
  studentsList: Array<Omit<Student, 'id' | 'createdAt'>>
): Promise<{ added: number; updated: number }> {
  try {
    const batch = writeBatch(db);
    let count = 0;

    for (const data of studentsList) {
      const cleanRoll = data.rollNumber.trim().toUpperCase();
      const id = `std_${data.departmentId || 'gen'}_${cleanRoll.replace(/[^A-Z0-9]/g, '_')}`;
      const student: Student = {
        ...data,
        id,
        rollNumber: cleanRoll,
        createdAt: new Date().toISOString(),
      };
      batch.set(doc(db, 'students', id), student, { merge: true });
      count++;
    }

    await batch.commit();
    await logActivity('STUDENTS_BATCH_IMPORTED', `Imported / updated ${count} student records via Excel/CSV`, 'Student');
    return { added: count, updated: 0 };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'students/batch');
  }
}

export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  try {
    await updateDoc(doc(db, 'students', id), updates);
    await logActivity('STUDENT_UPDATED', `Updated profile of student ${id}`, 'Student', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${id}`);
  }
}

export async function deleteStudent(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', id));
    await logActivity('STUDENT_DELETED', `Deleted student candidate ${id}`, 'Student', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
  }
}

// ==================== FORM ENROLLMENTS ====================

export async function getFormEnrollments(practicalFormId: string): Promise<FormEnrollment[]> {
  try {
    const q = query(collection(db, 'formEnrollments'), where('practicalFormId', '==', practicalFormId));
    const snap = await getDocs(q);
    const list: FormEnrollment[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as FormEnrollment));
    return list.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'formEnrollments');
  }
}

export async function enrollStudentsInForm(
  practicalForm: PracticalForm,
  students: Student[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    students.forEach((s) => {
      const enrollmentId = `enr_${practicalForm.id}_${s.id}`;
      const enrollment: FormEnrollment = {
        id: enrollmentId,
        practicalFormId: practicalForm.id,
        studentId: s.id,
        rollNumber: s.rollNumber,
        studentName: s.studentName,
        departmentId: s.departmentId,
        course: s.course,
        semester: s.semester,
        section: s.section,
        status: 'verified',
        enrolledAt: now,
      };
      batch.set(doc(db, 'formEnrollments', enrollmentId), enrollment, { merge: true });
    });

    await batch.commit();
    await logActivity('STUDENTS_ENROLLED_IN_FORM', `Enrolled ${students.length} students into form ${practicalForm.title}`, 'FormEnrollment', practicalForm.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'formEnrollments');
  }
}

export async function removeStudentFromForm(practicalFormId: string, studentId: string): Promise<void> {
  const enrollmentId = `enr_${practicalFormId}_${studentId}`;
  try {
    await deleteDoc(doc(db, 'formEnrollments', enrollmentId));
    await logActivity('STUDENT_REMOVED_FROM_FORM', `Removed student ${studentId} from form ${practicalFormId}`, 'FormEnrollment');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `formEnrollments/${enrollmentId}`);
  }
}

// ==================== MARKS ====================

export async function getFormMarks(practicalFormId: string): Promise<MarksRecord[]> {
  try {
    const q = query(collection(db, 'marks'), where('practicalFormId', '==', practicalFormId));
    const snap = await getDocs(q);
    const list: MarksRecord[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MarksRecord));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'marks');
  }
}

export async function saveSingleMark(record: Omit<MarksRecord, 'id' | 'updatedAt'>): Promise<void> {
  const id = `mark_${record.practicalFormId}_${record.studentId}`;
  const now = new Date().toISOString();
  const data: MarksRecord = {
    ...record,
    id,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'marks', id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `marks/${id}`);
  }
}

export async function saveBulkMarks(
  practicalFormId: string,
  records: Array<{ studentId: string; rollNumber: string; studentName: string; marksObtained: number | null; isPresent: boolean; remarks?: string }>,
  updatedBy = 'Examiner'
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    records.forEach((r) => {
      const id = `mark_${practicalFormId}_${r.studentId}`;
      const data: MarksRecord = {
        id,
        practicalFormId,
        studentId: r.studentId,
        rollNumber: r.rollNumber,
        studentName: r.studentName,
        marksObtained: r.isPresent ? r.marksObtained : null,
        isPresent: r.isPresent,
        remarks: r.remarks || '',
        updatedAt: now,
        updatedBy,
      };
      batch.set(doc(db, 'marks', id), data, { merge: true });
    });

    await batch.commit();
    await logActivity('MARKS_BULK_SAVED', `Saved evaluation marks for ${records.length} candidates in form ${practicalFormId}`, 'MarksRecord', practicalFormId, updatedBy);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'marks/bulk');
  }
}

export async function resetFormMarks(practicalFormId: string): Promise<void> {
  try {
    const existing = await getFormMarks(practicalFormId);
    const batch = writeBatch(db);
    existing.forEach((m) => {
      batch.delete(doc(db, 'marks', m.id));
    });
    await batch.commit();
    await logActivity('FORM_MARKS_RESET', `Reset all marks in form ${practicalFormId}`, 'MarksRecord', practicalFormId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `marks/reset/${practicalFormId}`);
  }
}

// ==================== DASHBOARD STATS ====================

export async function getCollegeStats(): Promise<CollegeStats> {
  try {
    const [depts, subjs, forms, students, marks] = await Promise.all([
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'practicalForms')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'marks')),
    ]);

    let activeLinks = 0;
    let closedForms = 0;

    forms.forEach((f) => {
      const d = f.data();
      if (d.isActive && d.status === 'published') activeLinks++;
      if (d.status === 'closed') closedForms++;
    });

    return {
      totalDepartments: depts.size,
      totalSubjects: subjs.size,
      totalPracticalForms: forms.size,
      totalStudents: students.size,
      totalMarksSubmitted: marks.size,
      pendingMarksEntries: Math.max(0, students.size - marks.size),
      activeFormLinks: activeLinks,
      closedForms,
    };
  } catch (err) {
    console.warn('Could not compute stats:', err);
    return {
      totalDepartments: 0,
      totalSubjects: 0,
      totalPracticalForms: 0,
      totalStudents: 0,
      totalMarksSubmitted: 0,
      pendingMarksEntries: 0,
      activeFormLinks: 0,
      closedForms: 0,
    };
  }
}

// ==================== SEED INITIAL COLLEGE ARCHITECTURE ====================

export async function seedInitialCollegeData(): Promise<void> {
  try {
    const deptsSnap = await getDocs(collection(db, 'departments'));
    if (!deptsSnap.empty) return; // Already seeded

    console.log('[Seeding] Initializing college architecture...');

    // 1. Departments
    const deptCS = await createDepartment({
      code: 'CS',
      name: 'Department of Computer Science',
      description: 'Computing, Software Engineering & Data Science',
    });

    const deptPhysics = await createDepartment({
      code: 'PHY',
      name: 'Department of Physics',
      description: 'Physical Sciences & Electronics',
    });

    const deptChem = await createDepartment({
      code: 'CHEM',
      name: 'Department of Chemistry',
      description: 'Organic, Analytical & Physical Chemistry',
    });

    const deptBCA = await createDepartment({
      code: 'BCA',
      name: 'Department of Computer Applications',
      description: 'Bachelor of Computer Applications',
    });

    // 2. Subjects
    const subjDSA = await createSubject({
      departmentId: deptCS.id,
      code: 'CS301P',
      name: 'Data Structures & Algorithms Practical',
      course: 'B.Sc. Computer Science',
      semester: 'Semester III',
      section: 'Section A',
    });

    const subjDBMS = await createSubject({
      departmentId: deptBCA.id,
      code: 'BCA402P',
      name: 'Relational Database Management Systems Lab',
      course: 'BCA',
      semester: 'Semester IV',
      section: 'Section B',
    });

    const subjOptics = await createSubject({
      departmentId: deptPhysics.id,
      code: 'PHY201P',
      name: 'Optics & Spectroscopy Practical',
      course: 'B.Sc. Physics',
      semester: 'Semester II',
      section: 'Section A',
    });

    // 3. Students
    const sampleStudents: Array<Omit<Student, 'id' | 'createdAt'>> = [
      { rollNumber: '24CS001', studentName: 'Aarav Sharma', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24CS002', studentName: 'Priya Patel', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24CS003', studentName: 'Rohan Iyer', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24CS004', studentName: 'Ananya Roy', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24CS005', studentName: 'Vikram Singh', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24CS006', studentName: 'Neha Kulkarni', departmentId: deptCS.id, course: 'B.Sc. Computer Science', semester: 'Semester III', section: 'A' },
      { rollNumber: '24BCA101', studentName: 'Siddharth Gupta', departmentId: deptBCA.id, course: 'BCA', semester: 'Semester IV', section: 'B' },
      { rollNumber: '24BCA102', studentName: 'Meera Joshi', departmentId: deptBCA.id, course: 'BCA', semester: 'Semester IV', section: 'B' },
      { rollNumber: '24BCA103', studentName: 'Aditya Rao', departmentId: deptBCA.id, course: 'BCA', semester: 'Semester IV', section: 'B' },
      { rollNumber: '24PHY201', studentName: 'Tanvi Deshmukh', departmentId: deptPhysics.id, course: 'B.Sc. Physics', semester: 'Semester II', section: 'A' },
    ];

    await batchImportStudents(sampleStudents);
    const allStudents = await getStudents();

    // 4. Practical Form
    const csStudents = allStudents.filter((s) => s.departmentId === deptCS.id);

    const practicalForm = await createPracticalForm({
      title: 'Data Structures Lab - End Semester Practical Examination',
      departmentId: deptCS.id,
      course: 'B.Sc. Computer Science',
      semester: 'Semester III',
      section: 'Section A',
      subjectId: subjDSA.id,
      subjectCode: 'CS301P',
      subjectName: 'Data Structures & Algorithms Practical',
      examName: 'Winter 2024 End Semester Practical Evaluation',
      examYear: '2024-2025',
      maxMarks: 50,
      instructions: '1. Verify candidate identity with college admit card.\n2. Record execution output and viva score.\n3. Decimal marks allowed up to 1 decimal place.\n4. Save marks before leaving.',
      examDate: new Date().toISOString().slice(0, 10),
      allowDecimals: true,
      status: 'published',
      isActive: true,
      isStudentListLocked: true,
    });

    // 5. Enroll Students in Form
    await enrollStudentsInForm(practicalForm, csStudents);

    // 6. Seed sample marks for initial testing
    await saveBulkMarks(
      practicalForm.id,
      [
        { studentId: csStudents[0].id, rollNumber: csStudents[0].rollNumber, studentName: csStudents[0].studentName, marksObtained: 46.5, isPresent: true, remarks: 'Excellent binary tree implementation' },
        { studentId: csStudents[1].id, rollNumber: csStudents[1].rollNumber, studentName: csStudents[1].studentName, marksObtained: 42.0, isPresent: true, remarks: 'Good viva performance' },
        { studentId: csStudents[2].id, rollNumber: csStudents[2].rollNumber, studentName: csStudents[2].studentName, marksObtained: 38.5, isPresent: true, remarks: 'Minor logic error in linked list' },
        { studentId: csStudents[3].id, rollNumber: csStudents[3].rollNumber, studentName: csStudents[3].studentName, marksObtained: 49.0, isPresent: true, remarks: 'Outstanding graph traversal' },
        { studentId: csStudents[4].id, rollNumber: csStudents[4].rollNumber, studentName: csStudents[4].studentName, marksObtained: null, isPresent: false, remarks: 'Reported absent' },
      ],
      'Prof. Dr. V. K. Verma (Examiner)'
    );

    console.log('[Seeding] College architecture successfully initialized.');
  } catch (err) {
    console.error('Seeding error:', err);
  }
}
