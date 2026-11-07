import React, { useState, useEffect, useRef } from 'react';
import {
  FileEdit,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  Layers,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  FileCheck,
  Calendar,
  Upload,
  Download,
  UserPlus,
  Users,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  GraduationCap,
  Award,
  BookOpen,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Building,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  PracticalForm,
  PracticalFormSubjectAssignment,
  Department,
  Subject,
  FormEnrollment,
  Student,
  AcademicSession,
  AcademicSemester,
  AcademicPaper,
  PracticalSubject,
  PaperStudent,
  SubjectType,
  SUBJECT_TYPES,
} from '../types';
import {
  createPracticalForm,
  updatePracticalForm,
  duplicatePracticalForm,
  deletePracticalForm,
  deleteAllPracticalForms,
  regenerateFormToken,
  getFormEnrollments,
  enrollStudentsInForm,
  enrollPaperStudentsInForm,
  removeStudentFromForm,
  batchImportStudents,
  generatePermanentStudentId,
  createStudent,
  logActivity,
  getAcademicSessions,
  getAcademicSemesters,
  getAcademicPapersForBuilder,
  getPaperDistinctSubjects,
  getMatchingAllottedStudents,
  getPracticalSubjects,
  normalizeSemester,
  getFormActiveSubjects,
  addSubjectToPracticalForm,
  removeSubjectFromPracticalForm,
} from '../services/collegeService';

interface FormBuilderModuleProps {
  forms: PracticalForm[];
  departments: Department[];
  subjects: Subject[];
  onRefresh: () => void;
  onOpenMarksView: (form: PracticalForm) => void;
  onOpenStudentEnrollment?: (form: PracticalForm) => void;
}

interface ParsedCandidateRow {
  id: string;
  rollNumber: string;
  studentName: string;
  fatherName: string;
  course: string;
  semester: string;
  section: string;
  hasError: boolean;
  errorMessage?: string;
  isDuplicate?: boolean;
}

export const FormBuilderModule: React.FC<FormBuilderModuleProps> = ({
  forms,
  departments,
  subjects,
  onRefresh,
  onOpenMarksView,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForm, setEditingForm] = useState<PracticalForm | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Authoritative Academic Master Lists from Firestore
  const [academicSessions, setAcademicSessions] = useState<AcademicSession[]>([]);
  const [academicSemesters, setAcademicSemesters] = useState<AcademicSemester[]>([]);
  const [practicalSubjectsList, setPracticalSubjectsList] = useState<PracticalSubject[]>([]);

  // Step-by-Step Dependent Form Builder Selections
  const [selectedSession, setSelectedSession] = useState<string>('2025-29');
  const [selectedSemester, setSelectedSemester] = useState<string>('Semester 2');
  const [selectedSubjectType, setSelectedSubjectType] = useState<SubjectType>('MJC');
  const [availablePapers, setAvailablePapers] = useState<AcademicPaper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [loadingPapers, setLoadingPapers] = useState<boolean>(false);

  // Distinct subjects allotted to the selected paper
  const [paperAllottedSubjects, setPaperAllottedSubjects] = useState<
    Array<{ subject: string; studentCount: number }>
  >([]);

  // Selected Practical Subjects (Multi-select) and Department
  const [selectedPracticalSubjects, setSelectedPracticalSubjects] = useState<string[]>(['GEOGRAPHY']);
  const [allottedStudentsBySubject, setAllottedStudentsBySubject] = useState<Record<string, PaperStudent[]>>({});
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [inchargeName, setInchargeName] = useState<string>('');
  const [examinerName, setExaminerName] = useState<string>('');

  // Automatically fetched allotted students
  const [allottedStudents, setAllottedStudents] = useState<PaperStudent[]>([]);
  const [loadingAllottedStudents, setLoadingAllottedStudents] = useState<boolean>(false);
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewSubjectFilter, setPreviewSubjectFilter] = useState<string>('ALL');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const previewPageSize = 10;

  // Form Configuration Details
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('B.A GEOGRAPHY');
  const [section, setSection] = useState('Section A');
  const [examName, setExamName] = useState('2025-29 2nd Semester Practical Examination');
  const [examYear, setExamYear] = useState('2025-29');
  const [maxMarks, setMaxMarks] = useState(50);
  const [minPassingMarks, setMinPassingMarks] = useState(17);
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowDecimals, setAllowDecimals] = useState(false);
  const [instructions, setInstructions] = useState(
    '1. Verify candidate identity and practical admit card.\n2. Record laboratory experiment score, notebook evaluation, and viva marks.\n3. Save marks before leaving the examination session.'
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'closed'>('published');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate Roster Management Modal State
  const [activeRosterForm, setActiveRosterForm] = useState<PracticalForm | null>(null);
  const [currentEnrollments, setCurrentEnrollments] = useState<FormEnrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [rosterTab, setRosterTab] = useState<'list' | 'upload' | 'manual'>('list');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const rosterPageSize = 25;

  // Upload parsed state
  const [parsedRows, setParsedRows] = useState<ParsedCandidateRow[]>([]);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingRoster, setSavingRoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Candidate Input state
  const [manualRoll, setManualRoll] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualFather, setManualFather] = useState('');
  const [manualCourse, setManualCourse] = useState('');
  const [manualSem, setManualSem] = useState('');
  const [manualSec, setManualSec] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Load Firestore masters on boot
  useEffect(() => {
    loadAcademicMasters();
  }, []);

  const loadAcademicMasters = async () => {
    try {
      const [sessions, semesters, practicalSubjs] = await Promise.all([
        getAcademicSessions(),
        getAcademicSemesters(),
        getPracticalSubjects(),
      ]);

      setAcademicSessions(sessions || []);
      setAcademicSemesters(semesters || []);
      setPracticalSubjectsList(practicalSubjs || []);

      if (sessions && sessions.length > 0) {
        // Prefer 2025-29 if available
        const found2025 = sessions.find((s) => s.sessionName === '2025-29');
        setSelectedSession(found2025 ? found2025.sessionName : sessions[0].sessionName);
      }

      if (semesters && semesters.length > 0) {
        // Prefer Semester 2 if available
        const foundSem2 = semesters.find(
          (s) => s.semesterName === 'Semester 2' || s.order === 2
        );
        setSelectedSemester(foundSem2 ? foundSem2.semesterName : semesters[0].semesterName);
      }
    } catch (err) {
      console.warn('Could not load academic masters:', err);
    }
  };

  // STEP 4 DEPENDENCY: When Session, Semester, or Subject Type changes, fetch Papers from Firestore
  useEffect(() => {
    if (selectedSession && selectedSemester && selectedSubjectType) {
      loadPapersForSelection();
    }
  }, [selectedSession, selectedSemester, selectedSubjectType]);

  const loadPapersForSelection = async () => {
    try {
      setLoadingPapers(true);
      const papersList = await getAcademicPapersForBuilder(
        selectedSession,
        selectedSemester,
        selectedSubjectType
      );
      setAvailablePapers(papersList || []);

      if (papersList && papersList.length > 0) {
        const existing = papersList.find((p) => p.id === selectedPaperId);
        const targetPaper = existing || papersList[0];
        setSelectedPaperId(targetPaper.id);
      } else {
        setSelectedPaperId('');
        setPaperAllottedSubjects([]);
        setAllottedStudents([]);
        setAllottedStudentsBySubject({});
      }
    } catch (err) {
      console.warn('Error loading papers for selection:', err);
    } finally {
      setLoadingPapers(false);
    }
  };

  // STEP 6 DEPENDENCY: When Paper changes, fetch distinct subjects that have allotted students
  useEffect(() => {
    if (selectedPaperId) {
      loadDistinctSubjectsForPaper(selectedPaperId);
    } else {
      setPaperAllottedSubjects([]);
      setAllottedStudents([]);
      setAllottedStudentsBySubject({});
    }
  }, [selectedPaperId]);

  const loadDistinctSubjectsForPaper = async (paperId: string) => {
    try {
      const distinct = await getPaperDistinctSubjects(paperId);
      setPaperAllottedSubjects(distinct || []);

      if (distinct && distinct.length > 0) {
        if (selectedPracticalSubjects.length === 0) {
          const hasGeo = distinct.find((d) => d.subject.toUpperCase() === 'GEOGRAPHY');
          const defaultSubj = hasGeo ? hasGeo.subject : distinct[0].subject;
          setSelectedPracticalSubjects([defaultSubj]);
        }
      } else {
        if (selectedPracticalSubjects.length === 0) {
          setSelectedPracticalSubjects(['GEOGRAPHY']);
        }
      }
    } catch (err) {
      console.warn('Error loading distinct subjects for paper:', err);
    }
  };

  // STEP 7 & 8 DEPENDENCY: When Practical Subjects change, resolve Department, Incharge, and fetch Allotted Students
  useEffect(() => {
    if (selectedPracticalSubjects.length > 0) {
      resolveDepartmentAndIncharge(selectedPracticalSubjects);
      fetchAllottedStudentsForCombination();
    } else {
      setAllottedStudents([]);
      setAllottedStudentsBySubject({});
    }
  }, [
    selectedSession,
    selectedSemester,
    selectedSubjectType,
    selectedPaperId,
    JSON.stringify(selectedPracticalSubjects),
  ]);

  const resolveDepartmentAndIncharge = (subjectsList: string[]) => {
    if (subjectsList.length === 0) return;
    const primarySubj = subjectsList[0].trim().toUpperCase();

    // 1. Find matching Department by name or code
    const matchingDept = departments.find(
      (d) =>
        d.name.trim().toUpperCase() === primarySubj ||
        (d.code && d.code.trim().toUpperCase() === primarySubj) ||
        (primarySubj === 'GEOGRAPHY' && (d.code === 'GEO' || d.name.includes('GEO'))) ||
        (primarySubj === 'BOTANY' && (d.code === 'BOT' || d.name.includes('BOT'))) ||
        (primarySubj === 'ZOOLOGY' && (d.code === 'ZOO' || d.name.includes('ZOO'))) ||
        (primarySubj === 'PSYCHOLOGY' && (d.code === 'PSY' || d.name.includes('PSY'))) ||
        (primarySubj === 'HOME SCIENCE' && (d.code === 'H.SCI' || d.name.includes('HOME')))
    );

    if (matchingDept) {
      setSelectedDepartmentId(matchingDept.id);
      if (!inchargeName && matchingDept.coordinator) {
        setInchargeName(matchingDept.coordinator);
      }
    } else if (!selectedDepartmentId && departments.length > 0) {
      setSelectedDepartmentId(departments[0].id);
      if (!inchargeName && departments[0].coordinator) {
        setInchargeName(departments[0].coordinator);
      }
    }

    // 2. Suggest Title & Course
    const paperObj = availablePapers.find((p) => p.id === selectedPaperId);
    const paperLabel = paperObj ? paperObj.paperName : 'Practical';
    const subjsDisplay = subjectsList.join(' / ');
    setTitle(`${selectedSession} ${selectedSemester} - ${subjsDisplay} (${paperLabel})`);
    setCourse(subjectsList.length === 1 ? `B.A ${subjectsList[0]}` : `B.A / B.Sc (${subjsDisplay})`);
    setExamName(`${selectedSession} ${selectedSemester} Practical Examination`);
    setExamYear(selectedSession);
  };

  const fetchAllottedStudentsForCombination = async () => {
    if (!selectedSession || !selectedSemester || selectedPracticalSubjects.length === 0) {
      setAllottedStudents([]);
      setAllottedStudentsBySubject({});
      return;
    }

    try {
      setLoadingAllottedStudents(true);
      const paperObj = availablePapers.find((p) => p.id === selectedPaperId);
      const bySubj: Record<string, PaperStudent[]> = {};
      const allList: PaperStudent[] = [];

      for (const subj of selectedPracticalSubjects) {
        const found = await getMatchingAllottedStudents({
          session: selectedSession,
          semester: selectedSemester,
          subjectType: selectedSubjectType,
          paperId: selectedPaperId || undefined,
          paperName: paperObj?.paperName,
          subject: subj,
        });
        bySubj[subj.toUpperCase()] = found || [];
        allList.push(...(found || []));
      }

      setAllottedStudentsBySubject(bySubj);
      setAllottedStudents(allList);
      setPreviewPage(1);
    } catch (err) {
      console.warn('Error fetching allotted students:', err);
      setAllottedStudents([]);
      setAllottedStudentsBySubject({});
    } finally {
      setLoadingAllottedStudents(false);
    }
  };

  const handleToggleSubject = (subjName: string) => {
    const norm = subjName.trim().toUpperCase();
    const isSelected = selectedPracticalSubjects.some((s) => s.toUpperCase() === norm);

    if (isSelected) {
      if (selectedPracticalSubjects.length === 1) {
        alert('A Practical Form must have at least one practical subject assigned.');
        return;
      }

      if (editingForm) {
        const activeInForm = (editingForm.subjectAssignments || getFormActiveSubjects(editingForm)).some(
          (s) => s.subjectName.toUpperCase() === norm && s.status === 'active'
        );
        if (activeInForm) {
          const ok = window.confirm(
            `Remove practical subject "${norm}" from this form?\n\nIf marks have been entered, they will remain safely preserved in the database archive.`
          );
          if (!ok) return;
        }
      }

      setSelectedPracticalSubjects((prev) => prev.filter((s) => s.toUpperCase() !== norm));
    } else {
      setSelectedPracticalSubjects((prev) => [...prev, norm]);
    }
  };

  const handleOpenCreate = () => {
    // Reset to defaults
    setSelectedSession('2025-29');
    setSelectedSemester('Semester 2');
    setSelectedSubjectType('MJC');
    setSelectedPracticalSubjects(['GEOGRAPHY']);
    setInchargeName('Kunal Singh');
    setExaminerName('');
    setMaxMarks(50);
    setMinPassingMarks(17);
    setExamDate(new Date().toISOString().slice(0, 10));
    setAllowDecimals(false);
    setStatus('published');
    setError(null);
    setEditingForm(null);
    setShowCreateModal(true);
    loadPapersForSelection();
  };

  const handleOpenEdit = (form: PracticalForm) => {
    setEditingForm(form);
    setTitle(form.title);
    setSelectedSession(form.session || form.examYear || '2025-29');
    setSelectedSemester(form.semester || 'Semester 2');
    setSelectedSubjectType(form.subjectType || 'MJC');
    setSelectedPaperId(form.paperId || '');
    setSelectedDepartmentId(form.departmentId);

    const activeSubjs = getFormActiveSubjects(form);
    const subjs = activeSubjs.map((s) => s.subjectName);
    setSelectedPracticalSubjects(subjs.length > 0 ? subjs : [form.subjectName || 'GEOGRAPHY']);

    setInchargeName(form.inchargeName || '');
    setExaminerName(form.examinerName || '');
    setCourse(form.course);
    setSection(form.section || 'A');
    setExamName(form.examName);
    setExamYear(form.examYear);
    setMaxMarks(form.maxMarks);
    setMinPassingMarks(form.minPassingMarks ?? Math.round(form.maxMarks * 0.33));
    setExamDate(form.examDate);
    setAllowDecimals(form.allowDecimals);
    setInstructions(form.instructions || '');
    setStatus(form.status);
    setError(null);
    setShowCreateModal(true);
  };

  const handleMaxMarksChange = (val: number) => {
    setMaxMarks(val);
    if (minPassingMarks > val || minPassingMarks === 0) {
      setMinPassingMarks(Math.round(val * 0.33));
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Examination title is required.');
      return;
    }

    if (Number(minPassingMarks) > Number(maxMarks)) {
      setError(`Minimum passing marks (${minPassingMarks}) cannot exceed maximum marks (${maxMarks}).`);
      return;
    }

    if (Number(minPassingMarks) < 0 || Number(maxMarks) <= 0) {
      setError('Marks must be positive numbers.');
      return;
    }

    if (selectedPracticalSubjects.length === 0) {
      setError('Please select at least one practical subject for this Incharge.');
      return;
    }

    const currentPaper = availablePapers.find((p) => p.id === selectedPaperId);
    const departmentObj = departments.find((d) => d.id === selectedDepartmentId);

    // Build subject assignments array
    const subjectAssignments: PracticalFormSubjectAssignment[] = selectedPracticalSubjects.map((subj) => {
      const normSubj = subj.trim().toUpperCase();
      const matchingSubjDoc = subjects.find((s) => s.name.trim().toUpperCase() === normSubj);
      const count =
        paperAllottedSubjects.find((p) => p.subject.toUpperCase() === normSubj)?.studentCount ||
        allottedStudentsBySubject[normSubj]?.length ||
        0;

      return {
        subjectId: matchingSubjDoc?.id || `psubj_${normSubj.toLowerCase()}`,
        subjectName: normSubj,
        subjectCode: matchingSubjDoc?.code || normSubj.slice(0, 4).toUpperCase(),
        departmentId: selectedDepartmentId,
        departmentName: departmentObj ? departmentObj.name : normSubj,
        studentCount: count,
        status: 'active' as const,
        addedAt: new Date().toISOString(),
      };
    });

    try {
      setLoading(true);

      if (editingForm) {
        const prevAssignments = editingForm.subjectAssignments || getFormActiveSubjects(editingForm);
        // Archive any previous subjects that were unchecked
        const archived = prevAssignments
          .filter((pa) => !selectedPracticalSubjects.some((s) => s.toUpperCase() === pa.subjectName.toUpperCase()))
          .map((pa) => ({ ...pa, status: 'archived' as const }));

        const combinedAssignments = [...subjectAssignments, ...archived];

        await updatePracticalForm(editingForm.id, {
          title: title.trim(),
          session: selectedSession,
          semester: selectedSemester,
          subjectType: selectedSubjectType,
          paperId: selectedPaperId || editingForm.paperId,
          paperName: currentPaper ? currentPaper.paperName : editingForm.paperName,
          departmentId: selectedDepartmentId,
          departmentName: departmentObj ? departmentObj.name : selectedPracticalSubjects[0],
          subjectId: subjectAssignments[0]?.subjectId || editingForm.subjectId,
          subjectCode: subjectAssignments[0]?.subjectCode || editingForm.subjectCode,
          subjectName: selectedPracticalSubjects[0],
          subjectAssignments: combinedAssignments,
          inchargeName: inchargeName || departmentObj?.coordinator || 'Kunal Singh',
          examinerName: examinerName || '',
          course,
          section,
          examName,
          examYear: selectedSession,
          maxMarks: Number(maxMarks),
          minPassingMarks: Number(minPassingMarks),
          instructions,
          examDate,
          allowDecimals,
          status,
        });

        // Auto enroll candidates for newly added subjects
        for (const subj of selectedPracticalSubjects) {
          const wasActive = prevAssignments.some(
            (pa) => pa.status === 'active' && pa.subjectName.toUpperCase() === subj.toUpperCase()
          );
          const studentsForSubj = allottedStudentsBySubject[subj.toUpperCase()] || [];
          if (!wasActive && studentsForSubj.length > 0) {
            await enrollPaperStudentsInForm(
              { ...editingForm, subjectName: subj },
              studentsForSubj,
              subj
            );
          }
        }

        setEditingForm(null);
        setShowCreateModal(false);
      } else {
        // Validate matching student allocations
        if (allottedStudents.length === 0) {
          const proceed = window.confirm(
            `Notice: No allotted students currently found in Firestore for selected subject(s) under ${currentPaper?.paperName || 'selected paper'}. Do you still wish to create this form?`
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
        }

        await createPracticalForm(
          {
            title: title.trim(),
            session: selectedSession,
            semester: selectedSemester,
            subjectType: selectedSubjectType,
            paperId: selectedPaperId,
            paperName: currentPaper ? currentPaper.paperName : 'Practical',
            departmentId: selectedDepartmentId,
            departmentName: departmentObj ? departmentObj.name : selectedPracticalSubjects[0],
            subjectId: subjectAssignments[0]?.subjectId || `subj_${selectedPracticalSubjects[0].toLowerCase()}`,
            subjectCode: subjectAssignments[0]?.subjectCode || selectedPracticalSubjects[0].slice(0, 4).toUpperCase(),
            subjectName: selectedPracticalSubjects[0],
            subjectAssignments,
            inchargeName: inchargeName || departmentObj?.coordinator || 'Kunal Singh',
            examinerName: examinerName || '',
            course,
            section,
            examName,
            examYear: selectedSession,
            maxMarks: Number(maxMarks),
            minPassingMarks: Number(minPassingMarks),
            instructions,
            examDate,
            allowDecimals,
            status,
            isActive: true,
            isStudentListLocked: true,
          },
          allottedStudents
        );

        setShowCreateModal(false);
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save practical form in Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicatePracticalForm(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate form');
    }
  };

  const handleDelete = async (id: string, titleStr: string) => {
    const ok = window.confirm(`Permanently delete practical form "${titleStr}"?`);
    if (!ok) return;

    try {
      await deletePracticalForm(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete form');
    }
  };

  const handleDeleteAllForms = async () => {
    if (forms.length === 0) return;
    const ok = window.confirm(
      `Permanently delete ALL (${forms.length}) practical examination forms? This will reset Total Forms counter to 0.`
    );
    if (!ok) return;

    try {
      await deleteAllPracticalForms();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete all practical forms');
    }
  };

  const handleRegenerateToken = async (id: string) => {
    const ok = window.confirm(
      'Regenerate public shareable link? The previous link will immediately stop working.'
    );
    if (!ok) return;

    try {
      await regenerateFormToken(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate link');
    }
  };

  const handleToggleStatus = async (
    form: PracticalForm,
    newStatus: 'draft' | 'published' | 'closed'
  ) => {
    try {
      await updatePracticalForm(form.id, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleToggleActive = async (form: PracticalForm) => {
    try {
      await updatePracticalForm(form.id, { isActive: !form.isActive });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle active state');
    }
  };

  const handleToggleLock = async (form: PracticalForm) => {
    const willLock = !form.isStudentListLocked;
    const ok = window.confirm(
      willLock
        ? 'Lock verified candidate list? After locking, examiners can only record marks for enrolled candidates.'
        : 'Unlock candidate list? This allows editing the candidate roster.'
    );
    if (!ok) return;

    try {
      await updatePracticalForm(form.id, { isStudentListLocked: willLock });
      if (activeRosterForm) {
        setActiveRosterForm({ ...activeRosterForm, isStudentListLocked: willLock });
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update roster lock state');
    }
  };

  const handleOpenRosterModal = async (form: PracticalForm) => {
    setActiveRosterForm(form);
    setRosterTab('list');
    setLoadingEnrollments(true);
    setRosterPage(1);
    try {
      const enr = await getFormEnrollments(form.id);
      setCurrentEnrollments(enr || []);
    } catch (err: any) {
      alert(`Error loading candidate roster: ${err.message}`);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Filter forms
  const filteredForms = forms.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.paperName && f.paperName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      f.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchesSession =
      sessionFilter === 'ALL' ||
      f.session === sessionFilter ||
      f.examYear === sessionFilter;
    return matchesSearch && matchesStatus && matchesSession;
  });

  // Filter preview allotted students
  const filteredAllottedStudents = allottedStudents.filter((s) => {
    const q = previewSearch.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      s.subject.toLowerCase().includes(q)
    );
  });

  const totalPreviewPages = Math.ceil(filteredAllottedStudents.length / previewPageSize) || 1;
  const paginatedPreviewStudents = filteredAllottedStudents.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

  // Filter roster enrollments
  const filteredRosterEnrollments = currentEnrollments.filter((e) => {
    const q = rosterSearch.toLowerCase();
    return (
      e.studentName.toLowerCase().includes(q) ||
      e.rollNumber.toLowerCase().includes(q)
    );
  });

  const totalRosterPages = Math.ceil(filteredRosterEnrollments.length / rosterPageSize) || 1;
  const paginatedRosterEnrollments = filteredRosterEnrollments.slice(
    (rosterPage - 1) * rosterPageSize,
    rosterPage * rosterPageSize
  );

  return (
    <div className="space-y-6">
      {/* Module Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <FileEdit className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-100">Dynamic Practical Form Builder</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Database Linked
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Create practical examination evaluation forms linked directly to Academic Sessions, Semesters, Subject Types (MJC/MIC/MDC), Papers, Departments, and Incharges. Pre-allotted students are fetched automatically from Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {forms.length > 0 && (
            <button
              onClick={handleDeleteAllForms}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
              title="Delete all practical forms"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete All Forms</span>
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Practical Form</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search forms by paper, subject, course, title, or code..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Session Filter */}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Sessions</option>
            {academicSessions.map((s) => (
              <option key={s.id} value={s.sessionName}>
                Session: {s.sessionName}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="closed">Closed</option>
          </select>

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh forms from database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Practical Forms List / Grid */}
      {filteredForms.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FileEdit className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">No Practical Examination Forms Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'ALL' || sessionFilter !== 'ALL'
              ? 'No examination forms match the active filters. Try clearing search criteria.'
              : 'Click "Create Practical Form" to configure a practical exam and automatically link allotted candidates.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-md hover:bg-blue-500 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Form</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredForms.map((form) => {
            const isCopied = copiedToken === form.token;
            const sessionVal = form.session || form.examYear || '2025-29';
            const semesterVal = form.semester || 'Semester 2';
            const paperVal = form.paperName || 'MJC-5';
            const inchargeVal = form.inchargeName || 'Kunal Singh';
            const candidateCount = form.studentCount || 0;
            const activeSubjects = form.subjectAssignments && form.subjectAssignments.length > 0
              ? form.subjectAssignments.filter((s) => s.status === 'active')
              : null;

            return (
              <div
                key={form.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/90 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {form.subjectCode || 'GEO'}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {sessionVal}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {semesterVal}
                      </span>
                      {form.subjectType && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {form.subjectType}
                        </span>
                      )}
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Paper: {paperVal}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                          form.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : form.status === 'closed'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {form.status}
                      </span>
                    </div>
                  </div>

                  {/* Form Title & Course */}
                  <h3 className="text-base font-bold text-white tracking-tight">{form.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Course: <span className="text-slate-200 font-medium">{form.course}</span>
                  </p>

                  {/* Assigned Practical Subjects Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400">Allotted Subject(s):</span>
                    {activeSubjects && activeSubjects.length > 0 ? (
                      activeSubjects.map((asgn) => (
                        <span
                          key={asgn.subjectId}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        >
                          <span>{asgn.subjectName}</span>
                          <span className="bg-emerald-950/80 px-1 rounded text-[10px] text-emerald-400">
                            {asgn.studentCount ?? 0}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {form.subjectName} ({candidateCount})
                      </span>
                    )}
                  </div>

                  {/* Complete Examination & Database Relationships Grid */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Parent Department / Group
                      </span>
                      <p className="font-semibold text-slate-200 truncate">
                        {form.departmentName || form.subjectName}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Subject Incharge
                      </span>
                      <p className="font-semibold text-emerald-400 truncate flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>{inchargeVal}</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Marks Criteria
                      </span>
                      <p className="font-mono text-slate-200">
                        Max: <span className="font-bold text-white">{form.maxMarks}</span> | Min Pass:{' '}
                        <span className="font-bold text-amber-400">{form.minPassingMarks}</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                        Allotted Candidates
                      </span>
                      <p className="font-semibold text-cyan-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {candidateCount > 0
                            ? `${candidateCount} Students Allotted`
                            : 'Students Linked (Ready)'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Evaluation Link URL Box */}
                  <div className="mt-3.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                        Public Link:
                      </span>
                      <code className="text-xs text-blue-300 font-mono truncate">
                        {window.location.origin}/?token={form.token}
                      </code>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyLink(form.token)}
                        className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                          isCopied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="Copy public evaluation URL"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={`/?token=${form.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                        title="Open evaluation form in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenRosterModal(form)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>View Candidates ({candidateCount || '209'})</span>
                    </button>

                    <button
                      onClick={() => onOpenMarksView(form)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Marks Entry</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(form)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                      title="Edit examination details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleLock(form)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
                      title={form.isStudentListLocked ? 'Unlock candidate list' : 'Lock candidate list'}
                    >
                      {form.isStudentListLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(form.id, form.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      title="Delete examination form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT PRACTICAL FORM MODAL */}
      {(showCreateModal || editingForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6 max-h-[92vh] flex flex-col justify-between">
            <div className="overflow-y-auto pr-1">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <FileEdit className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-slate-100">
                      {editingForm ? 'Edit Practical Form' : 'Create Database-Linked Practical Examination Form'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Select the Academic Session, Semester, Subject Type, Paper, Department, and Subject. Allotted students are automatically retrieved from Firestore.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingForm(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSaveForm} className="space-y-5">
                {/* 7-STEP DEPENDENT SELECTION MATRIX */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Academic & Subject Allocation Matrix</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">Authoritative Firestore Records</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* STEP 1: Academic Session */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Step 1: Academic Session *
                      </label>
                      <select
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      >
                        {academicSessions.map((sess) => (
                          <option key={sess.id} value={sess.sessionName}>
                            {sess.sessionName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* STEP 2: Semester */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Step 2: Semester *
                      </label>
                      <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {academicSemesters.map((sem) => (
                          <option key={sem.id} value={sem.semesterName}>
                            {sem.semesterName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* STEP 3: Subject Type (MJC / MIC / MDC) */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Step 3: Subject Type *
                      </label>
                      <select
                        value={selectedSubjectType}
                        onChange={(e) => setSelectedSubjectType(e.target.value as SubjectType)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-cyan-400"
                      >
                        {SUBJECT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t} (Major / Minor / Multidisciplinary)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    {/* STEP 4: Paper (from Firestore) */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Step 4: Paper *
                      </label>
                      <select
                        value={selectedPaperId}
                        onChange={(e) => setSelectedPaperId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-amber-300"
                      >
                        {loadingPapers ? (
                          <option value="">Loading papers...</option>
                        ) : availablePapers.length === 0 ? (
                          <option value="">No paper configured for this combination</option>
                        ) : (
                          availablePapers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.paperName} {p.paperName === 'MJC-5' ? '(MJ5)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* STEP 5: Department / Subject Group */}
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Step 5: Parent Department *
                      </label>
                      <select
                        value={selectedDepartmentId}
                        onChange={(e) => {
                          setSelectedDepartmentId(e.target.value);
                          const d = departments.find((dept) => dept.id === e.target.value);
                          if (d?.coordinator) setInchargeName(d.coordinator);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name} ({dept.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* STEP 6: Practical Subject(s) Multi-Select */}
                    <div className="sm:col-span-3 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold uppercase text-slate-300">
                          Step 6: Practical Subject(s) Allotted to this Incharge *
                        </label>
                        <span className="text-[11px] text-blue-400 font-medium">
                          Select one or multiple practical subjects for this Incharge (e.g. GEOGRAPHY, BOTANY, ZOOLOGY)
                        </span>
                      </div>

                      {/* Selectable Subjects Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-3 bg-slate-900 border border-slate-700/80 rounded-xl">
                        {(paperAllottedSubjects.length > 0
                          ? paperAllottedSubjects
                          : practicalSubjectsList.map((ps) => ({ subject: ps.name, studentCount: 0 }))
                        ).map((s) => {
                          const isSelected = selectedPracticalSubjects.some(
                            (sel) => sel.toUpperCase() === s.subject.toUpperCase()
                          );
                          return (
                            <button
                              key={s.subject}
                              type="button"
                              onClick={() => handleToggleSubject(s.subject)}
                              className={`p-2.5 rounded-xl text-left text-xs font-semibold border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600/25 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'border border-slate-600 bg-slate-900'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className="truncate font-bold">{s.subject}</span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 font-bold ${
                                  isSelected
                                    ? 'bg-blue-500/40 text-blue-200 border border-blue-400/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {s.studentCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Summary Pill Badges */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Allotted to this Form ({selectedPracticalSubjects.length}):
                        </span>
                        {selectedPracticalSubjects.map((subj) => {
                          const count = paperAllottedSubjects.find(
                            (p) => p.subject.toUpperCase() === subj.toUpperCase()
                          )?.studentCount || (allottedStudentsBySubject[subj.toUpperCase()]?.length || 0);

                          return (
                            <span
                              key={subj}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                            >
                              <span>{subj}</span>
                              <span className="text-[10px] font-mono text-blue-400">({count})</span>
                              <button
                                type="button"
                                onClick={() => handleToggleSubject(subj)}
                                className="text-blue-300 hover:text-white ml-0.5 p-0.5 rounded hover:bg-blue-500/30 transition-colors"
                                title={`Remove ${subj}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* STEP 7: Incharge and Examiner Assigned */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-850">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-emerald-400 mb-1.5">
                        Step 7: Subject Incharge Name *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={inchargeName}
                          onChange={(e) => setInchargeName(e.target.value)}
                          placeholder="e.g. Kunal Singh"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        All selected subjects above will be evaluated by this Incharge under this single Practical Form.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                        Examiner Name (External / Internal)
                      </label>
                      <input
                        type="text"
                        value={examinerName}
                        onChange={(e) => setExaminerName(e.target.value)}
                        placeholder="e.g. Dr. R. K. Singh (Optional)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 8: ALLOTTED STUDENTS REAL-TIME RETRIEVAL & PREVIEW */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Step 8: Matching Allotted Student Roster
                      </h4>
                      {loadingAllottedStudents ? (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span>Searching Firestore...</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                          {allottedStudents.length} Students Retrieved
                        </span>
                      )}
                    </div>

                    {/* Subject Filter Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewSubjectFilter('ALL');
                          setPreviewPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewSubjectFilter === 'ALL'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        All ({allottedStudents.length})
                      </button>
                      {selectedPracticalSubjects.map((sub) => {
                        const count = allottedStudentsBySubject[sub.toUpperCase()]?.length || 0;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => {
                              setPreviewSubjectFilter(sub);
                              setPreviewPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              previewSubjectFilter.toUpperCase() === sub.toUpperCase()
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                          >
                            {sub} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {allottedStudents.length === 0 && !loadingAllottedStudents ? (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">No Allocated Students Found For Selected Subjects</p>
                        <p className="text-[11px] text-amber-200/80 mt-0.5">
                          There are currently no students in Firestore matching Session {selectedSession}, {selectedSemester}, Subjects [{selectedPracticalSubjects.join(', ')}]. Please verify your selections.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1 max-w-xs">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={previewSearch}
                            onChange={(e) => {
                              setPreviewSearch(e.target.value);
                              setPreviewPage(1);
                            }}
                            placeholder="Search students in preview..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="text-xs text-slate-400">
                          Showing {(previewPage - 1) * previewPageSize + 1} -{' '}
                          {Math.min(previewPage * previewPageSize, filteredAllottedStudents.length)} of{' '}
                          <span className="font-bold text-white">{filteredAllottedStudents.length}</span> students
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                            <tr>
                              <th className="py-2 px-3 w-12 text-center">#</th>
                              <th className="py-2 px-3">Student Name</th>
                              <th className="py-2 px-3 w-36 font-mono">Roll Number</th>
                              <th className="py-2 px-3 w-28">Subject</th>
                              <th className="py-2 px-3 w-24 text-right">Allocation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-sans">
                            {paginatedPreviewStudents.map((std, idx) => (
                              <tr key={std.id} className="hover:bg-slate-800/40">
                                <td className="py-1.5 px-3 text-center font-mono text-slate-500">
                                  {(previewPage - 1) * previewPageSize + idx + 1}
                                </td>
                                <td className="py-1.5 px-3 font-semibold text-slate-200">
                                  {std.studentName}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-cyan-300">
                                  {std.rollNumber}
                                </td>
                                <td className="py-1.5 px-3 text-slate-300">
                                  {std.subject}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Allotted
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPreviewPages > 1 && (
                        <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                          <button
                            type="button"
                            disabled={previewPage === 1}
                            onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                            className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-slate-400">
                            Page {previewPage} of {totalPreviewPages}
                          </span>
                          <button
                            type="button"
                            disabled={previewPage === totalPreviewPages}
                            onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                            className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 disabled:opacity-40"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* FORM TITLE & EXAMINATION METADATA */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                      Practical Form Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 2025-29 Semester 2 - GEOGRAPHY (MJC-5) Practical Exam"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Course / Degree
                      </label>
                      <input
                        type="text"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        placeholder="B.A GEOGRAPHY"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Exam Session Name
                      </label>
                      <input
                        type="text"
                        value={examName}
                        onChange={(e) => setExamName(e.target.value)}
                        placeholder="2025-29 Semester 2 Practical Examination"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Section
                      </label>
                      <input
                        type="text"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        placeholder="Section A"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Marks & Scoring Rules */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Max Marks *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        required
                        value={maxMarks}
                        onChange={(e) => handleMaxMarksChange(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-amber-300 mb-1">
                        Min Passing Marks *
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={maxMarks}
                        required
                        value={minPassingMarks}
                        onChange={(e) => setMinPassingMarks(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-lg text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 font-bold"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Pass threshold</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Allow Decimals
                      </label>
                      <select
                        value={allowDecimals ? 'YES' : 'NO'}
                        onChange={(e) => setAllowDecimals(e.target.value === 'YES')}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="NO">No (Integers Only)</option>
                        <option value="YES">Yes (e.g. 42.5)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Exam Date
                      </label>
                      <input
                        type="date"
                        required
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Instructions & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Examiner Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Publish Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="published">Published (Link Active)</option>
                        <option value="draft">Draft (Restricted)</option>
                        <option value="closed">Closed (Locked)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingForm(null);
                    }}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving to Firestore...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          {editingForm
                            ? 'Update Form'
                            : `Generate Practical Form (${allottedStudents.length} Students Linked)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE ROSTER & VIEW ALLOTTED CANDIDATES MODAL */}
      {activeRosterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6 max-h-[92vh] flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {activeRosterForm.subjectCode}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100">
                      Candidate Roster: {activeRosterForm.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Academic Session: <span className="text-white font-mono">{activeRosterForm.session || activeRosterForm.examYear}</span> • Semester:{' '}
                    <span className="text-white font-medium">{activeRosterForm.semester}</span> • Paper:{' '}
                    <span className="text-amber-400 font-bold">{activeRosterForm.paperName || 'MJC-5'}</span> • Incharge:{' '}
                    <span className="text-emerald-400 font-semibold">{activeRosterForm.inchargeName || 'ANIKET PATEL'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleLock(activeRosterForm)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeRosterForm.isStudentListLocked
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {activeRosterForm.isStudentListLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>{activeRosterForm.isStudentListLocked ? 'Locked (Secure)' : 'Unlocked'}</span>
                  </button>

                  <button
                    onClick={() => setActiveRosterForm(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Authoritative Candidate Enrollment:</strong> Enrolled students are persistently stored in Firestore collection <code>formEnrollments</code>.
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-400 whitespace-nowrap ml-2">
                  {currentEnrollments.length} Enrolled Candidates
                </span>
              </div>

              {/* Search and Navigation */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => {
                      setRosterSearch(e.target.value);
                      setRosterPage(1);
                    }}
                    placeholder="Search candidate by name or roll number..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="text-xs text-slate-400">
                  Showing {(rosterPage - 1) * rosterPageSize + 1} -{' '}
                  {Math.min(rosterPage * rosterPageSize, filteredRosterEnrollments.length)} of{' '}
                  <span className="font-bold text-white">{filteredRosterEnrollments.length}</span> candidates
                </div>
              </div>

              {/* Roster Table */}
              <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-xl">
                {loadingEnrollments ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading candidates from Firestore...</span>
                  </div>
                ) : filteredRosterEnrollments.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No candidates found matching search.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3 w-36 font-mono">Roll Number</th>
                        <th className="py-2.5 px-3 w-32">Subject</th>
                        <th className="py-2.5 px-3 w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {paginatedRosterEnrollments.map((enr, idx) => (
                        <tr key={enr.id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            {(rosterPage - 1) * rosterPageSize + idx + 1}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-100">
                            {enr.studentName}
                          </td>
                          <td className="py-2 px-3 font-mono text-cyan-300">
                            {enr.rollNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {enr.subject || activeRosterForm.subjectName || 'GEOGRAPHY'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Roster Pagination */}
              {totalRosterPages > 1 && (
                <div className="flex items-center justify-between pt-3 text-xs text-slate-400">
                  <span>
                    Total: <strong className="text-white">{filteredRosterEnrollments.length}</strong> candidates
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rosterPage === 1}
                      onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Page {rosterPage} of {totalRosterPages}
                    </span>
                    <button
                      type="button"
                      disabled={rosterPage === totalRosterPages}
                      onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                      className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-4">
              <button
                type="button"
                onClick={() => onOpenMarksView(activeRosterForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Go to Marks Evaluation</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRosterForm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
