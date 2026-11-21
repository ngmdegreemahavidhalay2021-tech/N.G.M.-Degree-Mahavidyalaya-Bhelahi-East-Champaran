import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  BookCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  Hash,
  Layers,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AdminProfile,
  SubjectUpdateCategory,
  SubjectUpdateDepartment,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
  SubjectUpdateSystemSettings,
  SubjectUpdateSystemState,
} from '../types';
import {
  createSubjectUpdateCategory,
  createSubjectUpdateDepartment,
  createSubjectUpdateItem,
  createSubjectUpdateSemester,
  createSubjectUpdateSession,
  deleteSubjectUpdateCategory,
  deleteSubjectUpdateDepartment,
  deleteSubjectUpdateItem,
  deleteSubjectUpdateSemester,
  deleteSubjectUpdateSession,
  fetchSubjectUpdateSystemState,
  importSubjectUpdateBatch,
  saveSubjectUpdateSystemSettings,
  SubjectPayload,
  updateSubjectUpdateCategory,
  updateSubjectUpdateDepartment,
  updateSubjectUpdateItem,
  updateSubjectUpdateSemester,
  updateSubjectUpdateSession,
} from '../services/subjectUpdateSystemService';

type InternalSection =
  | 'dashboard'
  | 'subjects'
  | 'code-info'
  | 'categories'
  | 'sessions'
  | 'semesters'
  | 'departments'
  | 'import-export'
  | 'settings';

interface SubjectUpdateModuleProps {
  admin: AdminProfile;
}

interface DeleteTarget {
  type: 'subject' | 'session' | 'semester' | 'category' | 'department';
  id: string;
  label: string;
}

const INTERNAL_NAV_ITEMS: Array<{
  id: InternalSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'subjects', label: 'Subject Management', icon: BookCheck },
  { id: 'code-info', label: 'Code & Info', icon: Hash },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'sessions', label: 'Session Management', icon: CalendarRange },
  { id: 'semesters', label: 'Semester Management', icon: Layers },
  { id: 'departments', label: 'Departments & Info', icon: Building2 },
  { id: 'import-export', label: 'Import & Export', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const SubjectUpdateModule: React.FC<SubjectUpdateModuleProps> = ({ admin }) => {
  const [activeSection, setActiveSection] = useState<InternalSection>('dashboard');
  const [systemState, setSystemState] = useState<SubjectUpdateSystemState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subject filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Add/Edit Subject Modal
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectUpdateItem | null>(null);
  const [subjectForm, setSubjectForm] = useState<SubjectPayload>({
    subjectCode: '',
    subjectName: '',
    category: 'MJC',
    session: '2024-28',
    semester: 'Semester 1',
    departmentName: 'General',
    paperTitle: '',
    subjectInfo: '',
    isActive: true,
  });

  // Code & Information quick editor
  const [codeInfoSearch, setCodeInfoSearch] = useState('');
  const [selectedCodeInfoId, setSelectedCodeInfoId] = useState<string | null>(null);
  const [codeInfoDraft, setCodeInfoDraft] = useState<{
    subjectCode: string;
    subjectName: string;
    departmentName: string;
    paperTitle: string;
    subjectInfo: string;
    isActive: boolean;
  }>({
    subjectCode: '',
    subjectName: '',
    departmentName: '',
    paperTitle: '',
    subjectInfo: '',
    isActive: true,
  });

  // Category CRUD forms
  const [catForm, setCatForm] = useState({ code: '', label: '', description: '' });
  const [editingCat, setEditingCat] = useState<SubjectUpdateCategory | null>(null);

  // Session CRUD forms
  const [sessForm, setSessForm] = useState({ sessionName: '' });
  const [editingSess, setEditingSess] = useState<SubjectUpdateSession | null>(null);

  // Semester CRUD forms
  const [semForm, setSemForm] = useState({ semesterName: '', order: 1 });
  const [editingSem, setEditingSem] = useState<SubjectUpdateSemester | null>(null);

  // Department CRUD forms
  const [deptForm, setDeptForm] = useState({ code: '', name: '', info: '' });
  const [editingDept, setEditingDept] = useState<SubjectUpdateDepartment | null>(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Import/Export state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<SubjectPayload[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importDuplicateStrategy, setImportDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [importSummary, setImportSummary] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<SubjectUpdateSystemSettings | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setBanner({ type, message });
  }, []);

  const loadState = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const state = await fetchSubjectUpdateSystemState();
      setSystemState(state);
      setSettingsDraft(state.settings);
    } catch (err: any) {
      showToast('error', err?.message || 'Unable to load Subject Update System.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadState(false);
  }, [loadState]);

  const subjects = systemState?.subjects || [];
  const sessions = systemState?.sessions || [];
  const semesters = systemState?.semesters || [];
  const categories = systemState?.categories || [];
  const departments = systemState?.departments || [];
  const settings = systemState?.settings;

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subjects.filter((item) => {
      if (filterSession !== 'ALL' && item.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && item.semester !== filterSemester) return false;
      if (filterCategory !== 'ALL' && item.category !== filterCategory) return false;
      if (filterDepartment !== 'ALL' && item.departmentName !== filterDepartment) return false;
      if (filterStatus === 'ACTIVE' && !item.isActive) return false;
      if (filterStatus === 'INACTIVE' && item.isActive) return false;
      if (!q) return true;
      return (
        item.subjectCode.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        item.departmentName.toLowerCase().includes(q) ||
        (item.paperTitle || '').toLowerCase().includes(q) ||
        (item.subjectInfo || '').toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.session.toLowerCase().includes(q) ||
        item.semester.toLowerCase().includes(q)
      );
    });
  }, [
    subjects,
    searchQuery,
    filterSession,
    filterSemester,
    filterCategory,
    filterDepartment,
    filterStatus,
  ]);

  const uniqueDepartmentNames = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => set.add(d.name));
    subjects.forEach((s) => {
      if (s.departmentName) set.add(s.departmentName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, subjects]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c) => map.set(c.code, 0));
    subjects.forEach((s) => {
      map.set(s.category, (map.get(s.category) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [categories, subjects]);

  const sessionBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => map.set(s.sessionName, 0));
    subjects.forEach((subj) => {
      map.set(subj.session, (map.get(subj.session) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [sessions, subjects]);

  const codeInfoSubjects = useMemo(() => {
    const q = codeInfoSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.subjectCode.toLowerCase().includes(q) ||
        s.subjectName.toLowerCase().includes(q) ||
        s.departmentName.toLowerCase().includes(q) ||
        (s.paperTitle || '').toLowerCase().includes(q)
    );
  }, [subjects, codeInfoSearch]);

  const selectedCodeInfoSubject = useMemo(() => {
    if (!selectedCodeInfoId) return codeInfoSubjects[0] || null;
    return subjects.find((s) => s.id === selectedCodeInfoId) || null;
  }, [selectedCodeInfoId, subjects, codeInfoSubjects]);

  useEffect(() => {
    if (selectedCodeInfoSubject) {
      setCodeInfoDraft({
        subjectCode: selectedCodeInfoSubject.subjectCode,
        subjectName: selectedCodeInfoSubject.subjectName,
        departmentName: selectedCodeInfoSubject.departmentName,
        paperTitle: selectedCodeInfoSubject.paperTitle || '',
        subjectInfo: selectedCodeInfoSubject.subjectInfo || '',
        isActive: selectedCodeInfoSubject.isActive,
      });
    }
  }, [selectedCodeInfoSubject]);

  // --- Handlers: Subject Modal ---
  const openAddSubjectModal = () => {
    setEditingSubject(null);
    setSubjectForm({
      subjectCode: '',
      subjectName: '',
      category:
        settings?.defaultCategory ||
        categories.find((c) => c.isActive)?.code ||
        categories[0]?.code ||
        'MJC',
      session:
        settings?.defaultSession ||
        sessions.find((s) => s.isActive)?.sessionName ||
        sessions[0]?.sessionName ||
        '2024-28',
      semester:
        semesters.find((s) => s.isActive)?.semesterName ||
        semesters[0]?.semesterName ||
        'Semester 1',
      departmentName: departments[0]?.name || 'General',
      paperTitle: '',
      subjectInfo: '',
      isActive: true,
    });
    setSubjectModalOpen(true);
  };

  const openEditSubjectModal = (item: SubjectUpdateItem) => {
    setEditingSubject(item);
    setSubjectForm({
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      category: item.category,
      session: item.session,
      semester: item.semester,
      departmentName: item.departmentName,
      paperTitle: item.paperTitle || '',
      subjectInfo: item.subjectInfo || '',
      isActive: item.isActive,
    });
    setSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('save-subject');
    try {
      if (editingSubject) {
        const updated = await updateSubjectUpdateItem(editingSubject.id, subjectForm);
        showToast('success', `Subject "${updated.subjectCode} - ${updated.subjectName}" updated.`);
      } else {
        const created = await createSubjectUpdateItem(subjectForm);
        showToast('success', `Subject "${created.subjectCode} - ${created.subjectName}" added.`);
      }
      setSubjectModalOpen(false);
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save subject.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleSubjectActive = async (item: SubjectUpdateItem) => {
    setBusyAction(`toggle-subj-${item.id}`);
    try {
      await updateSubjectUpdateItem(item.id, { isActive: !item.isActive });
      await loadState(true);
      showToast(
        'success',
        `Subject "${item.subjectCode}" marked ${!item.isActive ? 'Active' : 'Inactive'}.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Code & Info Quick Save ---
  const handleSaveCodeInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCodeInfoSubject) return;
    setBusyAction('save-code-info');
    try {
      const updated = await updateSubjectUpdateItem(selectedCodeInfoSubject.id, {
        subjectCode: codeInfoDraft.subjectCode,
        subjectName: codeInfoDraft.subjectName,
        departmentName: codeInfoDraft.departmentName,
        paperTitle: codeInfoDraft.paperTitle,
        subjectInfo: codeInfoDraft.subjectInfo,
        isActive: codeInfoDraft.isActive,
      });
      await loadState(true);
      showToast('success', `Code & information saved for "${updated.subjectCode}".`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update subject information.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Categories ---
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('save-cat');
    try {
      if (editingCat) {
        await updateSubjectUpdateCategory(editingCat.id, catForm);
        showToast('success', `Category "${catForm.code.toUpperCase()}" updated.`);
        setEditingCat(null);
      } else {
        await createSubjectUpdateCategory(catForm);
        showToast('success', `Category "${catForm.code.toUpperCase()}" added.`);
      }
      setCatForm({ code: '', label: '', description: '' });
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save category.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Sessions ---
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('save-sess');
    try {
      if (editingSess) {
        await updateSubjectUpdateSession(editingSess.id, { sessionName: sessForm.sessionName });
        showToast('success', `Session "${sessForm.sessionName}" updated.`);
        setEditingSess(null);
      } else {
        await createSubjectUpdateSession({ sessionName: sessForm.sessionName });
        showToast('success', `Session "${sessForm.sessionName}" added.`);
      }
      setSessForm({ sessionName: '' });
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save session.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Semesters ---
  const handleSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('save-sem');
    try {
      if (editingSem) {
        await updateSubjectUpdateSemester(editingSem.id, {
          semesterName: semForm.semesterName,
          order: semForm.order,
        });
        showToast('success', `Semester "${semForm.semesterName}" updated.`);
        setEditingSem(null);
      } else {
        await createSubjectUpdateSemester({
          semesterName: semForm.semesterName,
          order: semForm.order,
        });
        showToast('success', `Semester "${semForm.semesterName}" added.`);
      }
      setSemForm({ semesterName: '', order: semesters.length + 2 });
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save semester.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Departments ---
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('save-dept');
    try {
      if (editingDept) {
        await updateSubjectUpdateDepartment(editingDept.id, deptForm);
        showToast('success', `Department "${deptForm.name}" updated.`);
        setEditingDept(null);
      } else {
        await createSubjectUpdateDepartment(deptForm);
        showToast('success', `Department "${deptForm.name}" added.`);
      }
      setDeptForm({ code: '', name: '', info: '' });
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save department.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handler: Confirm Delete ---
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyAction('delete-confirm');
    try {
      if (deleteTarget.type === 'subject') await deleteSubjectUpdateItem(deleteTarget.id);
      if (deleteTarget.type === 'session') await deleteSubjectUpdateSession(deleteTarget.id);
      if (deleteTarget.type === 'semester') await deleteSubjectUpdateSemester(deleteTarget.id);
      if (deleteTarget.type === 'category') await deleteSubjectUpdateCategory(deleteTarget.id);
      if (deleteTarget.type === 'department') await deleteSubjectUpdateDepartment(deleteTarget.id);

      showToast('success', `Deleted "${deleteTarget.label}".`);
      setDeleteTarget(null);
      await loadState(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete item.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Import & Export ---
  const handleExportExcel = () => {
    const rows = subjects.map((s) => ({
      'Subject Code': s.subjectCode,
      'Subject Name': s.subjectName,
      Category: s.category,
      Session: s.session,
      Semester: s.semester,
      Department: s.departmentName,
      'Paper Title': s.paperTitle || '',
      'Subject Info': s.subjectInfo || '',
      Active: s.isActive ? 'YES' : 'NO',
      'Updated At': s.updatedAt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
    XLSX.writeFile(wb, `SUBJECT_UPDATE_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', `Exported ${subjects.length} subjects to Excel (.xlsx).`);
  };

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'Subject Code': 'PHY-MJC-101',
        'Subject Name': 'Mechanics & Properties of Matter',
        Category: 'MJC',
        Session: '2024-28',
        Semester: 'Semester 1',
        Department: 'Physics',
        'Paper Title': 'Core Practical I',
        'Subject Info': 'UG CBCS Practical / Theory Subject',
        Active: 'YES',
      },
      {
        'Subject Code': 'CHE-MIC-201',
        'Subject Name': 'Inorganic Chemistry Practical',
        Category: 'MIC',
        Session: '2024-28',
        Semester: 'Semester 2',
        Department: 'Chemistry',
        'Paper Title': 'Minor Lab II',
        'Subject Info': 'Volumetric analysis practical',
        Active: 'YES',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'SUBJECT_UPDATE_Import_Template.xlsx');
    showToast('success', 'Downloaded Excel import template.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(systemState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUBJECT_UPDATE_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Exported full Subject Update System JSON snapshot.');
  };

  const normalizeImportedRow = (raw: Record<string, any>): SubjectPayload => {
    const map = new Map<string, any>();
    Object.entries(raw || {}).forEach(([k, v]) => {
      map.set(k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), v);
    });
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const val = map.get(k);
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
      return '';
    };

    const activeRaw = pick('active', 'isactive', 'status').toUpperCase();
    const isActive =
      activeRaw === 'NO' || activeRaw === 'FALSE' || activeRaw === '0' || activeRaw === 'INACTIVE'
        ? false
        : true;

    return {
      subjectCode: pick('subjectcode', 'code', 'subcode'),
      subjectName: pick('subjectname', 'name', 'subject', 'title'),
      category: (pick('category', 'cat', 'course', 'stream') || settings?.defaultCategory || 'MJC').toUpperCase(),
      session: pick('session', 'academicsession') || settings?.defaultSession || '2024-28',
      semester: pick('semester', 'sem') || 'Semester 1',
      departmentName: pick('department', 'departmentname', 'dept') || 'General',
      paperTitle: pick('papertitle', 'paper', 'papername') || '',
      subjectInfo: pick('subjectinfo', 'info', 'notes', 'description') || '',
      isActive,
    };
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportSummary(null);
    setImportFileName(file.name);

    try {
      let rawRecords: any[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rawRecords = parsed;
        } else if (Array.isArray(parsed?.subjects)) {
          rawRecords = parsed.subjects;
        }
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (firstSheet) {
          rawRecords = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
        }
      }

      const normalized = rawRecords
        .map((r) => normalizeImportedRow(r))
        .filter((r) => r.subjectCode || r.subjectName);

      if (normalized.length === 0) {
        showToast('error', 'No valid subject rows detected in the uploaded file.');
        setImportPreviewRows([]);
      } else {
        setImportPreviewRows(normalized);
        showToast('success', `Parsed ${normalized.length} subject rows from "${file.name}". Review & click Import to save.`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to parse uploaded file.');
      setImportPreviewRows([]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (importPreviewRows.length === 0) return;
    setBusyAction('execute-import');
    try {
      const res = await importSubjectUpdateBatch(importPreviewRows, importDuplicateStrategy);
      setImportSummary(res);
      setImportPreviewRows([]);
      await loadState(true);
      showToast(
        'success',
        `Import complete: ${res.createdCount} created, ${res.updatedCount} updated, ${res.skippedCount} skipped.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to import subjects.');
    } finally {
      setBusyAction(null);
    }
  };

  // --- Handlers: Settings ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setBusyAction('save-settings');
    try {
      const saved = await saveSubjectUpdateSystemSettings(settingsDraft);
      setSettingsDraft(saved);
      await loadState(true);
      showToast('success', 'SUBJECT UPDATE system settings saved to Cloud Firestore.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save settings.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !systemState) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
        <p className="text-sm font-medium">Loading SUBJECT UPDATE workspace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Independent System Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-100">
                {settings?.systemTitle || 'SUBJECT UPDATE'}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300">
                Independent System
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {settings?.institutionName || 'NGM Degree Mahavidyalaya'} · Self-contained Subject, Session, Semester, Category & Code management ({admin.username})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadState(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('subjects');
              openAddSubjectModal();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Subject
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {banner && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-xs ${
            banner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-lg hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Self-Contained Internal Navigation + Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Internal Navigation Rail */}
        <aside className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Module Navigation
          </div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {INTERNAL_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.id === 'subjects' && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {subjects.length}
                    </span>
                  )}
                  {item.id === 'categories' && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {categories.length}
                    </span>
                  )}
                  {item.id === 'sessions' && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {sessions.length}
                    </span>
                  )}
                  {item.id === 'semesters' && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {semesters.length}
                    </span>
                  )}
                  {item.id === 'departments' && (
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {departments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="lg:col-span-9 space-y-5 min-w-0">
          {/* 1. DASHBOARD */}
          {activeSection === 'dashboard' && (
            <div className="space-y-5">
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Total Subjects</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {subjects.length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Active Subjects</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    {subjects.filter((s) => s.isActive).length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Sessions</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {sessions.length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Semesters</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {semesters.length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Categories</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {categories.length}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-[11px] text-slate-400">Departments</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {departments.length}
                  </div>
                </div>
              </div>

              {/* Distribution Breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">Subjects by Category</h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('categories')}
                      className="text-xs text-blue-400 hover:underline cursor-pointer"
                    >
                      Manage Categories
                    </button>
                  </div>
                  <div className="space-y-2">
                    {categoryBreakdown.map(([cat, count]) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
                      >
                        <span className="font-mono font-semibold text-slate-200">{cat}</span>
                        <span className="font-mono tabular-nums text-slate-300">{count} subjects</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">Subjects by Session</h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('sessions')}
                      className="text-xs text-blue-400 hover:underline cursor-pointer"
                    >
                      Manage Sessions
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sessionBreakdown.map(([sess, count]) => (
                      <div
                        key={sess}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
                      >
                        <span className="font-mono font-semibold text-slate-200">{sess}</span>
                        <span className="font-mono tabular-nums text-slate-300">{count} subjects</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Subjects */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-100">Quick Actions & Recent Subjects</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('code-info')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      Edit Codes & Info
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('import-export')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      Import / Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('settings')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      System Settings
                    </button>
                  </div>
                </div>

                {subjects.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                    <p className="text-xs text-slate-400">
                      No subjects have been added to SUBJECT UPDATE yet. Add your first subject or import an Excel sheet.
                    </p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={openAddSubjectModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add New Subject
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection('import-export')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import Subjects
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5">Subject Name</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Session · Semester</th>
                          <th className="px-4 py-2.5">Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {[...subjects]
                          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                          .slice(0, 6)
                          .map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 font-mono font-semibold text-blue-300">
                                {s.subjectCode}
                              </td>
                              <td className="px-4 py-2.5 text-slate-100 font-medium">{s.subjectName}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-300">{s.category}</td>
                              <td className="px-4 py-2.5 text-slate-400">
                                {s.session} · {s.semester}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-slate-400">
                                {formatShortDate(s.updatedAt)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. SUBJECT MANAGEMENT */}
          {activeSection === 'subjects' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-100">Subject Management</h3>
                  <p className="text-xs text-slate-400">
                    Add, search, filter, edit, activate/deactivate, or delete subjects independently.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddSubjectModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Subject
                </button>
              </div>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
                <div className="relative xl:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search code, name, paper, info..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={filterSession}
                  onChange={(e) => setFilterSession(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Sessions</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.sessionName}>
                      {s.sessionName}
                    </option>
                  ))}
                </select>

                <select
                  value={filterSemester}
                  onChange={(e) => setFilterSemester(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Semesters</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.semesterName}>
                      {s.semesterName}
                    </option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>
              </div>

              {(searchQuery ||
                filterSession !== 'ALL' ||
                filterSemester !== 'ALL' ||
                filterCategory !== 'ALL' ||
                filterDepartment !== 'ALL' ||
                filterStatus !== 'ALL') && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-blue-400" />
                    Showing <strong className="font-mono text-slate-100">{filteredSubjects.length}</strong> of{' '}
                    <strong className="font-mono text-slate-100">{subjects.length}</strong> subjects
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="ALL">All Departments</option>
                      {uniqueDepartmentNames.map((dn) => (
                        <option key={dn} value={dn}>
                          {dn}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterSession('ALL');
                        setFilterSemester('ALL');
                        setFilterCategory('ALL');
                        setFilterDepartment('ALL');
                        setFilterStatus('ALL');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Subjects Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Subject Code</th>
                      <th className="px-4 py-3">Subject Name & Info</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Session / Semester</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                          No subjects match the current search or filters.
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono font-semibold text-blue-300 whitespace-nowrap">
                            {item.subjectCode}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-100">{item.subjectName}</div>
                            {(item.paperTitle || item.subjectInfo) && (
                              <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                {[item.paperTitle, item.subjectInfo].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-200">
                            {item.category}
                          </td>
                          <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                            <div>{item.session}</div>
                            <div className="text-[11px] text-slate-400">{item.semester}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{item.departmentName}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={busyAction === `toggle-subj-${item.id}`}
                              onClick={() => handleToggleSubjectActive(item)}
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                                item.isActive
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditSubjectModal(item)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                title="Edit Subject"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'subject',
                                    id: item.id,
                                    label: `${item.subjectCode} - ${item.subjectName}`,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                                title="Delete Subject"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. SUBJECT CODE & INFORMATION MANAGEMENT */}
          {activeSection === 'code-info' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Select Subject</h3>
                  <p className="text-[11px] text-slate-400">
                    Pick a subject to edit its Code, Paper Title, Department, and Information.
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={codeInfoSearch}
                    onChange={(e) => setCodeInfoSearch(e.target.value)}
                    placeholder="Filter by code or subject..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                  {codeInfoSubjects.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No subjects found. Add subjects first.
                    </div>
                  ) : (
                    codeInfoSubjects.map((s) => {
                      const active = selectedCodeInfoSubject?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedCodeInfoId(s.id)}
                          className={`w-full text-left p-3 rounded-xl border transition cursor-pointer ${
                            active
                              ? 'bg-blue-600/15 border-blue-500/40 text-white'
                              : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-blue-300">
                              {s.subjectCode}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">{s.category}</span>
                          </div>
                          <div className="text-xs font-medium text-slate-100 mt-0.5 truncate">
                            {s.subjectName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {s.session} · {s.semester}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                {!selectedCodeInfoSubject ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Select a subject on the left (or add one in Subject Management) to edit Subject Code and Subject Information.
                  </div>
                ) : (
                  <form onSubmit={handleSaveCodeInfo} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">
                          Subject Code & Information Editor
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {selectedCodeInfoSubject.category} · {selectedCodeInfoSubject.session} ·{' '}
                          {selectedCodeInfoSubject.semester}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        Updated {formatShortDate(selectedCodeInfoSubject.updatedAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Subject Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={codeInfoDraft.subjectCode}
                          onChange={(e) =>
                            setCodeInfoDraft((prev) => ({ ...prev, subjectCode: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Department / Subject Group
                        </label>
                        <input
                          type="text"
                          list="su-dept-suggestions"
                          value={codeInfoDraft.departmentName}
                          onChange={(e) =>
                            setCodeInfoDraft((prev) => ({ ...prev, departmentName: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Subject Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={codeInfoDraft.subjectName}
                        onChange={(e) =>
                          setCodeInfoDraft((prev) => ({ ...prev, subjectName: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Paper Title / Paper Reference
                      </label>
                      <input
                        type="text"
                        value={codeInfoDraft.paperTitle}
                        onChange={(e) =>
                          setCodeInfoDraft((prev) => ({ ...prev, paperTitle: e.target.value }))
                        }
                        placeholder="e.g. Paper I — Mechanics & Optics Practical"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Subject Information / Academic Notes
                      </label>
                      <textarea
                        rows={4}
                        value={codeInfoDraft.subjectInfo}
                        onChange={(e) =>
                          setCodeInfoDraft((prev) => ({ ...prev, subjectInfo: e.target.value }))
                        }
                        placeholder="Syllabus summary, credits, practical lab requirements, or subject notes..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={codeInfoDraft.isActive}
                        onChange={(e) =>
                          setCodeInfoDraft((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                        className="rounded border-slate-700 bg-slate-950 text-blue-600"
                      />
                      Subject is Active
                    </label>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={busyAction === 'save-code-info'}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        {busyAction === 'save-code-info' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        Save Code & Information
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* 4. SUBJECT CATEGORIES */}
          {activeSection === 'categories' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveCategory}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    {editingCat ? `Edit Category (${editingCat.code})` : 'Add Subject Category'}
                  </h3>
                  {editingCat && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCat(null);
                        setCatForm({ code: '', label: '', description: '' });
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. MJC, SEC)"
                    value={catForm.code}
                    onChange={(e) => setCatForm((p) => ({ ...p, code: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Label (e.g. Major Course)"
                    value={catForm.label}
                    onChange={(e) => setCatForm((p) => ({ ...p, label: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={catForm.description}
                    onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'save-cat'}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {editingCat ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingCat ? 'Update Category' : 'Add Category'}
                  </button>
                </div>
              </form>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Category Label</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Subjects</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-semibold text-blue-300">{cat.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-100">{cat.label}</td>
                        <td className="px-4 py-3 text-slate-400">{cat.description || '—'}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                          {subjects.filter((s) => s.category === cat.code).length}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCat(cat);
                                setCatForm({
                                  code: cat.code,
                                  label: cat.label,
                                  description: cat.description || '',
                                });
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'category',
                                  id: cat.id,
                                  label: `${cat.code} (${cat.label})`,
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. SESSION MANAGEMENT */}
          {activeSection === 'sessions' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveSession}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    {editingSess ? `Edit Session (${editingSess.sessionName})` : 'Add Academic Session'}
                  </h3>
                  {editingSess && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSess(null);
                        setSessForm({ sessionName: '' });
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Session Name (e.g. 2027-31)"
                    value={sessForm.sessionName}
                    onChange={(e) => setSessForm({ sessionName: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'save-sess'}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {editingSess ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingSess ? 'Update Session' : 'Add Session'}
                  </button>
                </div>
              </form>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Academic Session</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned Subjects</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-100">
                          {sess.sessionName}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await updateSubjectUpdateSession(sess.id, { isActive: !sess.isActive });
                              await loadState(true);
                            }}
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                              sess.isActive
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {sess.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                          {subjects.filter((s) => s.session === sess.sessionName).length}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSess(sess);
                                setSessForm({ sessionName: sess.sessionName });
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'session',
                                  id: sess.id,
                                  label: sess.sessionName,
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. SEMESTER MANAGEMENT */}
          {activeSection === 'semesters' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveSemester}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    {editingSem ? `Edit Semester (${editingSem.semesterName})` : 'Add Semester'}
                  </h3>
                  {editingSem && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSem(null);
                        setSemForm({ semesterName: '', order: semesters.length + 1 });
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Semester Name (e.g. Semester 9)"
                    value={semForm.semesterName}
                    onChange={(e) => setSemForm((p) => ({ ...p, semesterName: e.target.value }))}
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Order"
                    value={semForm.order}
                    onChange={(e) =>
                      setSemForm((p) => ({ ...p, order: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'save-sem'}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {editingSem ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingSem ? 'Update Semester' : 'Add Semester'}
                  </button>
                </div>
              </form>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Semester Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned Subjects</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {semesters.map((sem) => (
                      <tr key={sem.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-slate-400">{sem.order}</td>
                        <td className="px-4 py-3 font-semibold text-slate-100">{sem.semesterName}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await updateSubjectUpdateSemester(sem.id, { isActive: !sem.isActive });
                              await loadState(true);
                            }}
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                              sem.isActive
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {sem.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                          {subjects.filter((s) => s.semester === sem.semesterName).length}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSem(sem);
                                setSemForm({ semesterName: sem.semesterName, order: sem.order });
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'semester',
                                  id: sem.id,
                                  label: sem.semesterName,
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. DEPARTMENTS & GROUPS */}
          {activeSection === 'departments' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveDepartment}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    {editingDept
                      ? `Edit Department (${editingDept.name})`
                      : 'Add Department / Subject Group'}
                  </h3>
                  {editingDept && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDept(null);
                        setDeptForm({ code: '', name: '', info: '' });
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Code (e.g. PHY)"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Department Name (e.g. Physics)"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="Info / Notes (optional)"
                    value={deptForm.info}
                    onChange={(e) => setDeptForm((p) => ({ ...p, info: e.target.value }))}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'save-dept'}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {editingDept ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {editingDept ? 'Update Dept' : 'Add Department'}
                  </button>
                </div>
              </form>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Department / Group</th>
                      <th className="px-4 py-3">Information</th>
                      <th className="px-4 py-3">Subjects</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No departments added inside SUBJECT UPDATE yet. Add one above when needed.
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept) => (
                        <tr key={dept.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono font-semibold text-blue-300">
                            {dept.code}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-100">{dept.name}</td>
                          <td className="px-4 py-3 text-slate-400">{dept.info || '—'}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                            {subjects.filter((s) => s.departmentName === dept.name).length}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDept(dept);
                                  setDeptForm({
                                    code: dept.code,
                                    name: dept.name,
                                    info: dept.info || '',
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'department',
                                    id: dept.id,
                                    label: `${dept.name} (${dept.code})`,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. DATA IMPORT & EXPORT */}
          {activeSection === 'import-export' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-100">Export Data</h3>
                  <p className="text-xs text-slate-400">
                    Export SUBJECT UPDATE records as an Excel spreadsheet or full JSON snapshot, or download the import template.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Download Template
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-100">Import Subjects (.xlsx / .csv / .json)</h3>
                  <p className="text-xs text-slate-400">
                    Upload an Excel, CSV, or JSON file to preview and bulk import subjects into SUBJECT UPDATE.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.json"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Choose File to Preview
                    </button>

                    <select
                      value={importDuplicateStrategy}
                      onChange={(e) => setImportDuplicateStrategy(e.target.value as 'skip' | 'update')}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="skip">Duplicates: Skip existing</option>
                      <option value="update">Duplicates: Update existing</option>
                    </select>
                  </div>
                </div>
              </div>

              {importPreviewRows.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100">
                        Import Preview · {importFileName}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {importPreviewRows.length} rows ready for import into Cloud Firestore.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImportPreviewRows([])}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                      >
                        Clear Preview
                      </button>
                      <button
                        type="button"
                        disabled={busyAction === 'execute-import'}
                        onClick={handleExecuteImport}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                      >
                        {busyAction === 'execute-import' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Commit Import ({importPreviewRows.length})
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-72 border border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Subject Name</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Session</th>
                          <th className="px-3 py-2">Semester</th>
                          <th className="px-3 py-2">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {importPreviewRows.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                            <td className="px-3 py-2 font-mono text-blue-300">{r.subjectCode || 'MISSING'}</td>
                            <td className="px-3 py-2 text-slate-100">{r.subjectName || 'MISSING'}</td>
                            <td className="px-3 py-2 font-mono text-slate-300">{r.category}</td>
                            <td className="px-3 py-2 text-slate-300">{r.session}</td>
                            <td className="px-3 py-2 text-slate-300">{r.semester}</td>
                            <td className="px-3 py-2 text-slate-400">{r.departmentName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importSummary && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 text-xs">
                  <div className="font-semibold text-slate-100">Last Import Summary</div>
                  <div className="flex flex-wrap gap-4 font-mono">
                    <span className="text-emerald-400">Created: {importSummary.createdCount}</span>
                    <span className="text-blue-400">Updated: {importSummary.updatedCount}</span>
                    <span className="text-slate-400">Skipped: {importSummary.skippedCount}</span>
                  </div>
                  {importSummary.errors.length > 0 && (
                    <div className="text-rose-300 space-y-1 pt-1">
                      {importSummary.errors.slice(0, 8).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 9. SETTINGS */}
          {activeSection === 'settings' && settingsDraft && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100">SUBJECT UPDATE System Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stored permanently in Cloud Firestore independently from main ERP settings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    System Display Title
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsDraft.systemTitle}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, systemTitle: e.target.value } : p))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsDraft.institutionName}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, institutionName: e.target.value } : p))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Default Academic Session
                  </label>
                  <select
                    value={settingsDraft.defaultSession}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, defaultSession: e.target.value } : p))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.sessionName}>
                        {s.sessionName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Default Subject Category
                  </label>
                  <select
                    value={settingsDraft.defaultCategory}
                    onChange={(e) =>
                      setSettingsDraft((p) => (p ? { ...p, defaultCategory: e.target.value } : p))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.enforceUppercaseCodes}
                    onChange={(e) =>
                      setSettingsDraft((p) =>
                        p ? { ...p, enforceUppercaseCodes: e.target.checked } : p
                      )
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  Automatically normalize Subject Codes to uppercase
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.preventDuplicateCodes}
                    onChange={(e) =>
                      setSettingsDraft((p) =>
                        p ? { ...p, preventDuplicateCodes: e.target.checked } : p
                      )
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  Prevent duplicate Subject Codes within the same Session and Semester
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Administrator Notes
                </label>
                <textarea
                  rows={3}
                  value={settingsDraft.notes}
                  onChange={(e) =>
                    setSettingsDraft((p) => (p ? { ...p, notes: e.target.value } : p))
                  }
                  placeholder="Optional operational instructions or academic curriculum notes..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  Last saved by {settingsDraft.updatedBy} · {formatShortDate(settingsDraft.updatedAt)}
                </span>
                <button
                  type="submit"
                  disabled={busyAction === 'save-settings'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  {busyAction === 'save-settings' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Settings
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Datalist for Department Suggestions */}
      <datalist id="su-dept-suggestions">
        <option value="General" />
        {uniqueDepartmentNames.map((dn) => (
          <option key={dn} value={dn} />
        ))}
      </datalist>

      {/* Add / Edit Subject Modal */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editingSubject ? `Edit Subject (${editingSubject.subjectCode})` : 'Add New Subject'}
              </h3>
              <button
                type="button"
                onClick={() => setSubjectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PHY-MJC-101"
                    value={subjectForm.subjectCode}
                    onChange={(e) =>
                      setSubjectForm((p) => ({ ...p, subjectCode: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={subjectForm.category}
                    onChange={(e) => setSubjectForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mechanics & Properties of Matter"
                  value={subjectForm.subjectName}
                  onChange={(e) =>
                    setSubjectForm((p) => ({ ...p, subjectName: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Academic Session *
                  </label>
                  <select
                    required
                    value={subjectForm.session}
                    onChange={(e) => setSubjectForm((p) => ({ ...p, session: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.sessionName}>
                        {s.sessionName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Semester *
                  </label>
                  <select
                    required
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm((p) => ({ ...p, semester: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.semesterName}>
                        {s.semesterName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Department / Subject Group
                  </label>
                  <input
                    type="text"
                    list="su-dept-suggestions"
                    placeholder="e.g. Physics"
                    value={subjectForm.departmentName || ''}
                    onChange={(e) =>
                      setSubjectForm((p) => ({ ...p, departmentName: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Paper Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Core Practical I"
                    value={subjectForm.paperTitle || ''}
                    onChange={(e) =>
                      setSubjectForm((p) => ({ ...p, paperTitle: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Subject Information / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details about this subject..."
                  value={subjectForm.subjectInfo || ''}
                  onChange={(e) =>
                    setSubjectForm((p) => ({ ...p, subjectInfo: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={subjectForm.isActive ?? true}
                  onChange={(e) =>
                    setSubjectForm((p) => ({ ...p, isActive: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-blue-600"
                />
                Subject is Active
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyAction === 'save-subject'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  {busyAction === 'save-subject' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  {editingSubject ? 'Save Changes' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Confirm Deletion</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-slate-100">{deleteTarget.label}</strong> from SUBJECT UPDATE?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyAction === 'delete-confirm'}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {busyAction === 'delete-confirm' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
