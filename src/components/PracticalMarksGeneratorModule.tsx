import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Trash2,
} from 'lucide-react';
import { AdminProfile, SUBJECT_TYPES, SubjectType } from '../types';
import {
  PracticalCategoryDisplay,
  PracticalMarksFmConfig,
} from '../types/practicalMarksGenerator';
import {
  buildCategoryPracticalMarksPayload,
  createPracticalMarksFmConfig,
  deletePracticalMarksFmConfig,
  extractAvailableDepartments,
  extractAvailableExamTypes,
  extractAvailableSubjects,
  fetchPracticalMarksDatabaseSnapshot,
  fetchPracticalMarksFmConfigs,
  mapCategoryToDisplay,
  PracticalMarksDatabaseSnapshot,
  subscribeToPracticalMarksUpdates,
  updatePracticalMarksFmConfig,
} from '../services/practicalMarksGeneratorService';
import {
  buildPracticalExportFilename,
  buildPracticalSheetHeaders,
  downloadPracticalMarksWorkbook,
  downloadPracticalMarksZip,
  getMainSheetName,
  OFFICIAL_DEFAULT_COLLEGE_NAME,
} from '../lib/practicalMarksExcel';

interface PracticalMarksGeneratorModuleProps {
  admin?: AdminProfile | null;
  onOpenMarksManagement?: () => void;
}

const DEFAULT_FULL_MARKS = 70;

export const PracticalMarksGeneratorModule: React.FC<PracticalMarksGeneratorModuleProps> = ({
  onOpenMarksManagement,
}) => {
  // Live database snapshot state (strictly read-only)
  const [snapshot, setSnapshot] = useState<PracticalMarksDatabaseSnapshot | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [refreshingDb, setRefreshingDb] = useState(false);

  // Selection state
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SubjectType>('MJC');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedPaperFilter, setSelectedPaperFilter] = useState<string>('ALL');
  const [fullMarksInput, setFullMarksInput] = useState<string>(String(DEFAULT_FULL_MARKS));

  // Admin FM Preferences state
  const [fmConfigs, setFmConfigs] = useState<PracticalMarksFmConfig[]>([]);
  const [loadingFmConfigs, setLoadingFmConfigs] = useState(false);
  const [showFmForm, setShowFmForm] = useState(false);
  const [editingFmId, setEditingFmId] = useState<string | null>(null);
  const [fmFormLabel, setFmFormLabel] = useState('');
  const [fmFormValue, setFmFormValue] = useState(String(DEFAULT_FULL_MARKS));
  const [fmFormCategory, setFmFormCategory] = useState<'ALL' | SubjectType>('ALL');
  const [fmFormIsDefault, setFmFormIsDefault] = useState(false);
  const [fmFormNotes, setFmFormNotes] = useState('');
  const [savingFmConfig, setSavingFmConfig] = useState(false);

  // Preview & Validation UI state
  const [showPreview, setShowPreview] = useState(true);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewStatusFilter, setPreviewStatusFilter] = useState<
    'ALL' | 'AVAILABLE' | 'MISSING' | 'EXCEEDS_FM'
  >('ALL');
  const [acknowledgeExceedsFm, setAcknowledgeExceedsFm] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const parsedFullMarks = useMemo(() => {
    const n = Number(fullMarksInput);
    if (!fullMarksInput.trim() || !Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [fullMarksInput]);

  const effectiveFullMarks = parsedFullMarks ?? DEFAULT_FULL_MARKS;

  const loadSnapshot = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoadingDb(true);
      else setRefreshingDb(true);

      const snap = await fetchPracticalMarksDatabaseSnapshot();
      setSnapshot(snap);

      if (isInitial && snap.sessions.length > 0) {
        const activeSess = snap.sessions.filter((s) => s.isActive !== false);
        const prefSess =
          activeSess.find((s) => s.sessionName === '2025-29') || activeSess[0] || snap.sessions[0];
        setSelectedSession((prev) => prev || prefSess.sessionName);
      }

      if (isInitial && snap.semesters.length > 0) {
        const activeSems = snap.semesters.filter((s) => s.isActive !== false);
        const prefSem =
          activeSems.find((s) => s.semesterName === 'Semester 2' || s.order === 2) ||
          activeSems[0] ||
          snap.semesters[0];
        setSelectedSemester((prev) => prev || prefSem.semesterName);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to load practical marks data from database.',
      });
    } finally {
      setLoadingDb(false);
      setRefreshingDb(false);
    }
  }, []);

  const loadFmConfigs = useCallback(async (applyDefaultOnBoot = false) => {
    try {
      setLoadingFmConfigs(true);
      const list = await fetchPracticalMarksFmConfigs();
      setFmConfigs(list);
      if (applyDefaultOnBoot) {
        const defaultCfg = list.find((c) => c.isDefault);
        if (defaultCfg && defaultCfg.fullMarks > 0) {
          setFullMarksInput(String(defaultCfg.fullMarks));
        }
      }
    } catch {
      // Non-fatal if no configs saved yet
    } finally {
      setLoadingFmConfigs(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot(true);
    loadFmConfigs(true);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeToPracticalMarksUpdates(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadSnapshot(false);
      }, 600);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
    };
  }, [loadSnapshot, loadFmConfigs]);

  // Dynamic Examination Types from actual saved Practical Marks records (no hardcoded options)
  const availableExamTypes = useMemo(() => {
    if (!snapshot || !selectedSession || !selectedSemester) return [];
    return extractAvailableExamTypes(snapshot, selectedSession, selectedSemester);
  }, [snapshot, selectedSession, selectedSemester]);

  useEffect(() => {
    if (availableExamTypes.length === 0) {
      setSelectedExamType('');
      return;
    }
    const stillValid = availableExamTypes.some((e) => e.examType === selectedExamType);
    if (!stillValid) {
      setSelectedExamType(availableExamTypes[0].examType);
    }
  }, [availableExamTypes, selectedExamType]);

  // Available categories present for selected exam type (always keep MJC/MIC/MDC buttons clear, highlighting which have marks)
  const activeExamMeta = useMemo(
    () => availableExamTypes.find((e) => e.examType === selectedExamType) || null,
    [availableExamTypes, selectedExamType]
  );

  // Departments available for active Session + Semester + ExamType + Category
  const availableDepartments = useMemo(() => {
    if (!snapshot || !selectedSession || !selectedSemester || !selectedExamType) return [];
    return extractAvailableDepartments(snapshot, {
      session: selectedSession,
      semester: selectedSemester,
      examType: selectedExamType,
      category: selectedCategory,
    });
  }, [snapshot, selectedSession, selectedSemester, selectedExamType, selectedCategory]);

  useEffect(() => {
    if (selectedDepartmentId === 'ALL') return;
    if (!availableDepartments.some((d) => d.departmentId === selectedDepartmentId)) {
      setSelectedDepartmentId('ALL');
    }
  }, [availableDepartments, selectedDepartmentId]);

  // Subjects available for active filters
  const availableSubjects = useMemo(() => {
    if (!snapshot || !selectedSession || !selectedSemester || !selectedExamType) return [];
    return extractAvailableSubjects(snapshot, {
      session: selectedSession,
      semester: selectedSemester,
      examType: selectedExamType,
      category: selectedCategory,
      departmentId: selectedDepartmentId,
    });
  }, [
    snapshot,
    selectedSession,
    selectedSemester,
    selectedExamType,
    selectedCategory,
    selectedDepartmentId,
  ]);

  useEffect(() => {
    if (selectedSubject === 'ALL') return;
    if (!availableSubjects.some((s) => s.subject === selectedSubject)) {
      setSelectedSubject('ALL');
      setSelectedPaperFilter('ALL');
    }
  }, [availableSubjects, selectedSubject]);

  const activeSubjectMeta = useMemo(
    () => availableSubjects.find((s) => s.subject === selectedSubject) || null,
    [availableSubjects, selectedSubject]
  );

  useEffect(() => {
    if (!activeSubjectMeta || activeSubjectMeta.papers.length <= 1) {
      setSelectedPaperFilter('ALL');
    } else if (
      selectedPaperFilter !== 'ALL' &&
      !activeSubjectMeta.papers.includes(selectedPaperFilter)
    ) {
      setSelectedPaperFilter('ALL');
    }
  }, [activeSubjectMeta, selectedPaperFilter]);

  // Reset exceeds-FM acknowledgment whenever selection or FM changes
  useEffect(() => {
    setAcknowledgeExceedsFm(false);
  }, [
    selectedSession,
    selectedSemester,
    selectedExamType,
    selectedCategory,
    selectedDepartmentId,
    selectedSubject,
    selectedPaperFilter,
    fullMarksInput,
  ]);

  // Active filtered payload for the selected Category/Department/Subject/Paper
  const selectedPayload = useMemo(() => {
    if (!snapshot || !selectedSession || !selectedSemester || !selectedExamType) return null;
    return buildCategoryPracticalMarksPayload(snapshot, {
      session: selectedSession,
      semester: selectedSemester,
      examType: selectedExamType,
      category: selectedCategory,
      departmentId: selectedDepartmentId,
      subject: selectedSubject,
      paperFilter: selectedPaperFilter,
      fullMarks: effectiveFullMarks,
      collegeName: OFFICIAL_DEFAULT_COLLEGE_NAME,
    });
  }, [
    snapshot,
    selectedSession,
    selectedSemester,
    selectedExamType,
    selectedCategory,
    selectedDepartmentId,
    selectedSubject,
    selectedPaperFilter,
    effectiveFullMarks,
  ]);

  // Category-wide payloads (for Major / Minor / MDC / Combined / Response / ZIP buttons)
  const categoryPayloads = useMemo(() => {
    if (!snapshot || !selectedSession || !selectedSemester || !selectedExamType) {
      return { MJC: null, MIC: null, MDC: null };
    }
    return {
      MJC: buildCategoryPracticalMarksPayload(snapshot, {
        session: selectedSession,
        semester: selectedSemester,
        examType: selectedExamType,
        category: 'MJC',
        fullMarks: effectiveFullMarks,
        collegeName: OFFICIAL_DEFAULT_COLLEGE_NAME,
      }),
      MIC: buildCategoryPracticalMarksPayload(snapshot, {
        session: selectedSession,
        semester: selectedSemester,
        examType: selectedExamType,
        category: 'MIC',
        fullMarks: effectiveFullMarks,
        collegeName: OFFICIAL_DEFAULT_COLLEGE_NAME,
      }),
      MDC: buildCategoryPracticalMarksPayload(snapshot, {
        session: selectedSession,
        semester: selectedSemester,
        examType: selectedExamType,
        category: 'MDC',
        fullMarks: effectiveFullMarks,
        collegeName: OFFICIAL_DEFAULT_COLLEGE_NAME,
      }),
    };
  }, [snapshot, selectedSession, selectedSemester, selectedExamType, effectiveFullMarks]);

  const nonEmptyCategoryPayloads = useMemo(
    () =>
      [categoryPayloads.MJC, categoryPayloads.MIC, categoryPayloads.MDC].filter(
        (p): p is NonNullable<typeof p> => Boolean(p && p.rows.length > 0)
      ),
    [categoryPayloads]
  );

  // Check if any category in combined export has validation issues
  const allCombinedExceedsFm = useMemo(
    () => nonEmptyCategoryPayloads.flatMap((p) => p.summary.exceedsFmStudents),
    [nonEmptyCategoryPayloads]
  );
  const allCombinedInvalid = useMemo(
    () => nonEmptyCategoryPayloads.flatMap((p) => p.summary.invalidMarksStudents),
    [nonEmptyCategoryPayloads]
  );

  // Preview rows filtered by search + status
  const filteredPreviewRows = useMemo(() => {
    if (!selectedPayload) return [];
    const q = previewSearch.trim().toLowerCase();
    return selectedPayload.rows.filter((row) => {
      if (previewStatusFilter === 'AVAILABLE' && row.status === 'MISSING') return false;
      if (previewStatusFilter === 'MISSING' && row.status !== 'MISSING') return false;
      if (previewStatusFilter === 'EXCEEDS_FM' && !row.exceedsFm && !row.isInvalid) return false;
      if (!q) return true;
      return (
        row.rollNumber.toLowerCase().includes(q) ||
        row.studentName.toLowerCase().includes(q) ||
        row.subject.toLowerCase().includes(q)
      );
    });
  }, [selectedPayload, previewSearch, previewStatusFilter]);

  const previewHeaders = useMemo(
    () => (selectedPayload ? buildPracticalSheetHeaders(selectedPayload) : null),
    [selectedPayload]
  );

  // Guard checks before downloading
  const canProceedExport = (
    payloads: NonNullable<typeof selectedPayload>[]
  ): boolean => {
    if (!parsedFullMarks) {
      setStatusMessage({
        type: 'error',
        text: 'Enter a valid positive Full Marks (FM) value greater than 0 before downloading.',
      });
      return false;
    }

    const validPayloads = payloads.filter((p) => p.rows.length > 0);
    if (validPayloads.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'No practical marks records are available for the selected filters.',
      });
      return false;
    }

    const invalidRows = validPayloads.flatMap((p) => p.summary.invalidMarksStudents);
    if (invalidRows.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `${invalidRows.length} student record(s) contain negative or non-numeric marks. Please review and correct them in Marks Management before exporting.`,
      });
      return false;
    }

    const exceedsRows = validPayloads.flatMap((p) => p.summary.exceedsFmStudents);
    if (exceedsRows.length > 0 && !acknowledgeExceedsFm) {
      setStatusMessage({
        type: 'error',
        text: `${exceedsRows.length} student mark(s) exceed Full Marks (${parsedFullMarks}). Adjust Full Marks, fix marks in Marks Management, or check the acknowledgment box to proceed.`,
      });
      return false;
    }

    return true;
  };

  const handleExportSelected = async () => {
    if (!selectedPayload) return;
    if (!canProceedExport([selectedPayload])) return;

    try {
      setExportingKey('selected');
      setStatusMessage(null);
      const filename = buildPracticalExportFilename({
        kind: 'SINGLE_CATEGORY',
        category: selectedPayload.category,
        session: selectedPayload.session,
        semester: selectedPayload.semester,
      });
      await downloadPracticalMarksWorkbook([selectedPayload], filename);
      setStatusMessage({
        type: 'success',
        text: `Downloaded ${filename} (${selectedPayload.rows.length} rows, F.M.-${effectiveFullMarks}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate Excel file.',
      });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportCategory = async (cat: SubjectType) => {
    const payload = categoryPayloads[cat];
    if (!payload) return;
    if (!canProceedExport([payload])) return;

    try {
      setExportingKey(`cat_${cat}`);
      setStatusMessage(null);
      const filename = buildPracticalExportFilename({
        kind: 'SINGLE_CATEGORY',
        category: cat,
        session: payload.session,
        semester: payload.semester,
      });
      await downloadPracticalMarksWorkbook([payload], filename);
      setStatusMessage({
        type: 'success',
        text: `Downloaded ${filename} (${payload.rows.length} students, F.M.-${effectiveFullMarks}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || `Failed to generate ${mapCategoryToDisplay(cat)} file.`,
      });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportAllCombined = async () => {
    if (!canProceedExport(nonEmptyCategoryPayloads)) return;
    try {
      setExportingKey('all_combined');
      setStatusMessage(null);
      const filename = buildPracticalExportFilename({
        kind: 'ALL_COMBINED',
        session: selectedSession,
        semester: selectedSemester,
      });
      await downloadPracticalMarksWorkbook(nonEmptyCategoryPayloads, filename);
      setStatusMessage({
        type: 'success',
        text: `Downloaded ${filename} with ${nonEmptyCategoryPayloads.length} active practical category worksheet(s).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate combined Excel workbook.',
      });
    } finally {
      setExportingKey(null);
    }
  };

  const handleExportZip = async () => {
    if (!canProceedExport(nonEmptyCategoryPayloads)) return;
    try {
      setExportingKey('zip');
      setStatusMessage(null);
      await downloadPracticalMarksZip(
        nonEmptyCategoryPayloads,
        selectedSession,
        selectedSemester
      );
      setStatusMessage({
        type: 'success',
        text: `Downloaded ZIP archive containing ${nonEmptyCategoryPayloads.length} category Practical Marks Excel file(s).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate ZIP archive.',
      });
    } finally {
      setExportingKey(null);
    }
  };

  // FM Preferences CRUD Handlers
  const openCreateFmForm = () => {
    setEditingFmId(null);
    setFmFormLabel(`Practical FM ${effectiveFullMarks}`);
    setFmFormValue(String(effectiveFullMarks));
    setFmFormCategory('ALL');
    setFmFormIsDefault(fmConfigs.length === 0);
    setFmFormNotes('');
    setShowFmForm(true);
  };

  const openEditFmForm = (cfg: PracticalMarksFmConfig) => {
    setEditingFmId(cfg.id);
    setFmFormLabel(cfg.label);
    setFmFormValue(String(cfg.fullMarks));
    setFmFormCategory(cfg.category || 'ALL');
    setFmFormIsDefault(Boolean(cfg.isDefault));
    setFmFormNotes(cfg.notes || '');
    setShowFmForm(true);
  };

  const handleSaveFmConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const numFm = Number(fmFormValue);
    if (!fmFormLabel.trim() || !Number.isFinite(numFm) || numFm <= 0) {
      setStatusMessage({
        type: 'error',
        text: 'Provide a configuration label and a valid positive Full Marks number.',
      });
      return;
    }

    try {
      setSavingFmConfig(true);
      setStatusMessage(null);
      if (editingFmId) {
        await updatePracticalMarksFmConfig(editingFmId, {
          label: fmFormLabel.trim(),
          fullMarks: numFm,
          category: fmFormCategory,
          session: selectedSession || undefined,
          semester: selectedSemester || undefined,
          isDefault: fmFormIsDefault,
          notes: fmFormNotes.trim() || undefined,
        });
        setStatusMessage({
          type: 'success',
          text: `Updated Full Marks preference "${fmFormLabel.trim()}" (FM ${numFm}).`,
        });
      } else {
        await createPracticalMarksFmConfig({
          label: fmFormLabel.trim(),
          fullMarks: numFm,
          category: fmFormCategory,
          session: selectedSession || undefined,
          semester: selectedSemester || undefined,
          isDefault: fmFormIsDefault,
          notes: fmFormNotes.trim() || undefined,
        });
        setStatusMessage({
          type: 'success',
          text: `Saved Full Marks preference "${fmFormLabel.trim()}" (FM ${numFm}).`,
        });
      }
      setFullMarksInput(String(numFm));
      setShowFmForm(false);
      setEditingFmId(null);
      await loadFmConfigs(false);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Could not save Full Marks preference.',
      });
    } finally {
      setSavingFmConfig(false);
    }
  };

  const handleDeleteFmConfig = async (cfg: PracticalMarksFmConfig) => {
    try {
      await deletePracticalMarksFmConfig(cfg.id);
      await loadFmConfigs(false);
      setStatusMessage({
        type: 'success',
        text: `Deleted saved Full Marks preference "${cfg.label}".`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to delete saved Full Marks preference.',
      });
    }
  };

  const activeCategoryDisplay: PracticalCategoryDisplay = mapCategoryToDisplay(selectedCategory);

  const selectedDeptLabel = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return 'All Departments';
    return (
      availableDepartments.find((d) => d.departmentId === selectedDepartmentId)?.departmentName ||
      selectedDepartmentId
    );
  }, [selectedDepartmentId, availableDepartments]);

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-100">Practical Marks File Generator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official BRABU &amp; college-format MAJOR, MINOR, and MDC Practical Marks Excel sheets generated directly from saved ERP Practical Marks (strictly excluding CIA).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-950 rounded-xl border border-slate-800 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Active Sheet F.M.
            </span>
            <strong className="text-base font-bold text-emerald-400 font-mono">
              {parsedFullMarks ? `F.M.-${parsedFullMarks}` : 'Invalid FM'}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => loadSnapshot(false)}
            disabled={loadingDb || refreshingDb}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingDb ? 'animate-spin' : ''}`} />
            <span>Refresh DB</span>
          </button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'info'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Selection + Validation / Exports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Filters & Full Marks Control */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              1. Practical Examination Selection &amp; Full Marks Control
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              {snapshot?.loadedAt ? 'Live Synced' : 'Loading...'}
            </span>
          </div>

          {loadingDb ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Scanning practical marks records in database...</span>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Row 1: Academic Session, Semester, Examination Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Academic Session *
                  </label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Session</option>
                    {(snapshot?.sessions || [])
                      .filter((s) => s.isActive !== false)
                      .map((s) => (
                        <option key={s.id} value={s.sessionName}>
                          {s.sessionName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Semester *
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Semester</option>
                    {(snapshot?.semesters || [])
                      .filter((s) => s.isActive !== false)
                      .map((s) => (
                        <option key={s.id} value={s.semesterName}>
                          {s.semesterName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Examination Type (Live DB) *
                  </label>
                  <select
                    value={selectedExamType}
                    onChange={(e) => setSelectedExamType(e.target.value)}
                    disabled={availableExamTypes.length === 0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    {availableExamTypes.length === 0 ? (
                      <option value="">No Practical Marks Found</option>
                    ) : (
                      availableExamTypes.map((opt) => (
                        <option key={opt.examType} value={opt.examType}>
                          {opt.examType} ({opt.actualMarksCount} marks)
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {availableExamTypes.length === 0 && selectedSession && selectedSemester && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong>No saved Practical Marks found</strong> for{' '}
                    <span className="font-semibold">{selectedSession} / {selectedSemester}</span>.
                    Only examinations with actual saved non-CIA Practical Marks records appear in the Examination Type selector automatically.
                  </div>
                </div>
              )}

              {/* Row 2: Subject Category, Department, Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Subject Category *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                    {SUBJECT_TYPES.map((cat) => {
                      const label = mapCategoryToDisplay(cat);
                      const hasMarks = activeExamMeta?.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-blue-600 text-white shadow-sm'
                              : hasMarks
                                ? 'text-slate-200 hover:bg-slate-800/70'
                                : 'text-slate-500 hover:bg-slate-800/40'
                          }`}
                          title={`${label} (${cat})`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Department
                  </label>
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    disabled={availableDepartments.length === 0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="ALL">All Departments</option>
                    {availableDepartments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.departmentName} ({d.actualMarksCount} marks)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Subject Scope
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedPaperFilter('ALL');
                    }}
                    disabled={availableSubjects.length === 0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="ALL">All {activeCategoryDisplay} Subjects</option>
                    {availableSubjects.map((s) => (
                      <option key={s.subject} value={s.subject}>
                        {s.subject} ({s.actualMarksCount}/{s.totalStudents})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Paper Filter if > 1 paper exists under selected subject */}
              {activeSubjectMeta && activeSubjectMeta.papers.length > 1 && (
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Paper Filter (Optional)
                  </label>
                  <select
                    value={selectedPaperFilter}
                    onChange={(e) => setSelectedPaperFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">
                      All Papers Combined ({activeSubjectMeta.papers.join(', ')})
                    </option>
                    {activeSubjectMeta.papers.map((paper) => (
                      <option key={paper} value={paper}>
                        {paper}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Row 3: Admin-Controlled Full Marks (FM) */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Full Marks (FM) *</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    Default: 70 &bull; Read-Only on Saved Marks
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step="any"
                    value={fullMarksInput}
                    onChange={(e) => setFullMarksInput(e.target.value)}
                    placeholder="70"
                    className="w-28 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[50, 60, 70, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFullMarksInput(String(preset))}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                          Number(fullMarksInput) === preset
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Excel column heading:{' '}
                  <code className="text-blue-400 font-mono">
                    Marks Obtained (F.M.-{effectiveFullMarks})
                  </code>{' '}
                  &bull; Worksheet:{' '}
                  <code className="text-emerald-400 font-mono">
                    {getMainSheetName(selectedCategory, effectiveFullMarks)}
                  </code>
                </p>
              </div>

              {/* Saved Admin Full Marks Preferences */}
              <div className="border-t border-slate-800 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                    Saved Full Marks Preferences
                  </span>
                  <button
                    type="button"
                    onClick={openCreateFmForm}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Save Current FM</span>
                  </button>
                </div>

                {showFmForm && (
                  <form
                    onSubmit={handleSaveFmConfig}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-700 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                          Preference Name *
                        </label>
                        <input
                          type="text"
                          value={fmFormLabel}
                          onChange={(e) => setFmFormLabel(e.target.value)}
                          placeholder="e.g. Standard Practical FM 70"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                          Full Marks *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          step="any"
                          value={fmFormValue}
                          onChange={(e) => setFmFormValue(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1 font-semibold">
                          Category Scope
                        </label>
                        <select
                          value={fmFormCategory}
                          onChange={(e) =>
                            setFmFormCategory(e.target.value as 'ALL' | SubjectType)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs"
                        >
                          <option value="ALL">All Categories</option>
                          <option value="MJC">MAJOR (MJC)</option>
                          <option value="MIC">MINOR (MIC)</option>
                          <option value="MDC">MDC</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-slate-300 pt-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fmFormIsDefault}
                          onChange={(e) => setFmFormIsDefault(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500"
                        />
                        <span>Set as Default Full Marks</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowFmForm(false);
                          setEditingFmId(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingFmConfig}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50"
                      >
                        {savingFmConfig ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>{editingFmId ? 'Update' : 'Save'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {loadingFmConfigs ? (
                  <p className="text-[11px] text-slate-500">Loading saved preferences...</p>
                ) : fmConfigs.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No saved FM preferences yet. Using default FM = 70 (click &ldquo;Save Current FM&rdquo; to store reusable presets).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fmConfigs.map((cfg) => (
                      <div
                        key={cfg.id}
                        className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] ${
                          Number(fullMarksInput) === cfg.fullMarks
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFullMarksInput(String(cfg.fullMarks))}
                          className="font-semibold hover:underline cursor-pointer"
                          title={`Apply FM ${cfg.fullMarks}`}
                        >
                          {cfg.label} (FM {cfg.fullMarks})
                          {cfg.isDefault ? ' • Default' : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditFmForm(cfg)}
                          className="text-slate-400 hover:text-blue-400 cursor-pointer"
                          title="Edit preference"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFmConfig(cfg)}
                          className="text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Delete preference"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Validation Summary & Export Controls */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                2. Pre-Download Validation &amp; Summary
              </h3>
              <span className="text-[11px] font-mono text-blue-400">
                {activeCategoryDisplay} ({selectedCategory})
              </span>
            </div>

            {selectedPayload ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">
                      Total Students
                    </span>
                    <strong className="text-base font-bold text-slate-100 font-mono">
                      {selectedPayload.summary.totalStudents}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">
                      Marks Available
                    </span>
                    <strong className="text-base font-bold text-emerald-400 font-mono">
                      {selectedPayload.summary.marksAvailable}
                    </strong>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({selectedPayload.summary.absentCount} Absent)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">
                      Missing Marks
                    </span>
                    <strong
                      className={`text-base font-bold font-mono ${
                        selectedPayload.summary.missingMarksCount > 0
                          ? 'text-amber-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {selectedPayload.summary.missingMarksCount}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">
                      Exceeds FM ({effectiveFullMarks})
                    </span>
                    <strong
                      className={`text-base font-bold font-mono ${
                        selectedPayload.summary.exceedsFmStudents.length > 0
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {selectedPayload.summary.exceedsFmStudents.length}
                    </strong>
                  </div>
                </div>

                {/* Metadata summary */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] space-y-1 text-slate-300">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Session / Semester:</span>
                    <span className="font-semibold">
                      {selectedSession} &bull; {selectedSemester}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Examination Type:</span>
                    <span className="font-semibold text-right truncate max-w-[210px]">
                      {selectedExamType}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Department / Subject:</span>
                    <span className="font-semibold text-right truncate max-w-[210px]">
                      {selectedDeptLabel} /{' '}
                      {selectedSubject === 'ALL' ? `All ${activeCategoryDisplay}` : selectedSubject}
                    </span>
                  </div>
                </div>

                {/* Validation Alerts: Exceeds FM or Invalid Marks */}
                {(selectedPayload.summary.exceedsFmStudents.length > 0 ||
                  selectedPayload.summary.invalidMarksStudents.length > 0 ||
                  allCombinedExceedsFm.length > 0 ||
                  allCombinedInvalid.length > 0) && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-2">
                    <div className="flex items-start gap-2 text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <strong>Full Marks Validation Warning:</strong>{' '}
                        {selectedPayload.summary.exceedsFmStudents.length > 0
                          ? `${selectedPayload.summary.exceedsFmStudents.length} student(s) in ${activeCategoryDisplay} have stored marks exceeding FM (${effectiveFullMarks}).`
                          : `${allCombinedExceedsFm.length} student(s) across categories exceed FM (${effectiveFullMarks}).`}
                      </div>
                    </div>

                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-[11px]">
                      {(selectedPayload.summary.exceedsFmStudents.length > 0
                        ? selectedPayload.summary.exceedsFmStudents
                        : allCombinedExceedsFm
                      )
                        .slice(0, 15)
                        .map((st) => (
                          <div
                            key={st.rowKey}
                            className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/80 border border-rose-500/20 text-rose-200"
                          >
                            <span className="font-mono truncate">
                              {st.rollNumber} ({st.subject}) &bull; {st.studentName}
                            </span>
                            <strong className="font-mono text-rose-400 shrink-0 ml-2">
                              {st.displayMarks} &gt; {effectiveFullMarks}
                            </strong>
                          </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <label className="flex items-center gap-1.5 text-[11px] text-rose-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acknowledgeExceedsFm}
                          onChange={(e) => setAcknowledgeExceedsFm(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-rose-500 bg-slate-950 text-rose-500"
                        />
                        <span>Acknowledge warning to export</span>
                      </label>

                      {onOpenMarksManagement && (
                        <button
                          type="button"
                          onClick={onOpenMarksManagement}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                        >
                          <span>Fix in Marks Management</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Missing Marks Notice */}
                {selectedPayload.summary.missingMarksCount > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between gap-2">
                    <span>
                      <strong>{selectedPayload.summary.missingMarksCount}</strong> missing mark cell(s) will stay blank (never converted to 0).
                    </span>
                    {onOpenMarksManagement && (
                      <button
                        type="button"
                        onClick={onOpenMarksManagement}
                        className="shrink-0 underline font-semibold hover:text-amber-200 cursor-pointer"
                      >
                        Enter Marks
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                Select a Session, Semester, and available Examination Type to validate practical marks.
              </div>
            )}
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleExportSelected}
              disabled={
                exportingKey !== null ||
                !selectedPayload ||
                selectedPayload.rows.length === 0 ||
                !parsedFullMarks
              }
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-45 transition-all cursor-pointer"
            >
              {exportingKey === 'selected' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Generate Selected Practical Marks File</span>
            </button>

            <div className="grid grid-cols-3 gap-2">
              {SUBJECT_TYPES.map((cat) => {
                const payload = categoryPayloads[cat];
                const label = mapCategoryToDisplay(cat);
                const count = payload?.rows.length || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleExportCategory(cat)}
                    disabled={exportingKey !== null || count === 0 || !parsedFullMarks}
                    className="inline-flex flex-col items-center justify-center px-2 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <span>{label} File</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {count} rows
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportAllCombined}
                disabled={
                  exportingKey !== null ||
                  nonEmptyCategoryPayloads.length === 0 ||
                  !parsedFullMarks
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-45 transition-all cursor-pointer"
              >
                {exportingKey === 'all_combined' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>All Available (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportZip}
                disabled={
                  exportingKey !== null ||
                  nonEmptyCategoryPayloads.length === 0 ||
                  !parsedFullMarks
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-45 transition-all cursor-pointer"
              >
                {exportingKey === 'zip' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                <span>Download ZIP Archive</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Pre-Download Excel Sheet Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Preview Before Download:{' '}
              {getMainSheetName(selectedCategory, effectiveFullMarks)}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="Search roll no / subject..."
                className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={previewStatusFilter}
                onChange={(e) =>
                  setPreviewStatusFilter(
                    e.target.value as 'ALL' | 'AVAILABLE' | 'MISSING' | 'EXCEEDS_FM'
                  )
                }
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100"
              >
                <option value="ALL">All Rows</option>
                <option value="AVAILABLE">Entered Only</option>
                <option value="MISSING">Missing Only</option>
                <option value="EXCEEDS_FM">Exceeds FM / Invalid</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? 'Hide' : 'Show'}</span>
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="p-4 sm:p-6 bg-slate-950/60 overflow-x-auto">
            {!selectedPayload || !previewHeaders ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Select an available Examination Type above to preview Practical Marks.
              </div>
            ) : selectedPayload.rows.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No Practical Marks records match the current Category / Department / Subject filter.
              </div>
            ) : (
              <div className="memo-paper-preview bg-white text-black max-w-[820px] mx-auto p-5 sm:p-7 rounded-lg shadow-2xl border border-slate-300 font-sans">
                <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                    <tr>
                      <th
                        colSpan={3}
                        className="border border-black px-3 py-1.5 text-center font-bold text-[13px]"
                      >
                        {previewHeaders.row1}
                      </th>
                    </tr>
                    <tr>
                      <th
                        colSpan={3}
                        className="border border-black px-3 py-1 text-center font-bold text-[11.5px]"
                      >
                        {previewHeaders.row2}
                      </th>
                    </tr>
                    <tr>
                      <th
                        colSpan={3}
                        className="border border-black px-3 py-1 text-center font-bold text-[11.5px]"
                      >
                        {previewHeaders.row3}
                      </th>
                    </tr>
                    <tr>
                      <th
                        colSpan={3}
                        className="border border-black px-3 py-1 text-center font-bold text-[12px]"
                      >
                        {previewHeaders.row4}
                      </th>
                    </tr>
                    <tr className="bg-slate-100">
                      <th className="border border-black px-3 py-1.5 text-center font-bold w-[34%]">
                        {previewHeaders.col1Header}
                      </th>
                      <th className="border border-black px-3 py-1.5 text-center font-bold w-[30%]">
                        {previewHeaders.col2Header}
                      </th>
                      <th className="border border-black px-3 py-1.5 text-center font-bold w-[36%]">
                        {previewHeaders.col3Header}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewRows.slice(0, 250).map((row) => (
                      <tr
                        key={row.rowKey}
                        className={
                          row.exceedsFm || row.isInvalid
                            ? 'bg-rose-50'
                            : row.status === 'MISSING'
                              ? 'bg-amber-50/70'
                              : ''
                        }
                      >
                        <td className="border border-black px-3 py-1 text-left font-medium">
                          {row.subject}
                        </td>
                        <td className="border border-black px-3 py-1 text-center font-mono">
                          {row.rollNumber}
                        </td>
                        <td className="border border-black px-3 py-1 text-center font-mono font-semibold">
                          {row.status === 'MISSING' ? (
                            <span className="text-amber-700 text-[10px] font-bold">
                              MISSING (Blank in Excel)
                            </span>
                          ) : row.exceedsFm || row.isInvalid ? (
                            <span className="text-rose-700 font-bold">
                              {row.displayMarks} (Exceeds {effectiveFullMarks})
                            </span>
                          ) : (
                            row.displayMarks
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredPreviewRows.length > 250 && (
                  <p className="text-[11px] text-slate-600 mt-2 text-center font-medium">
                    Showing first 250 of {filteredPreviewRows.length} rows in preview. Downloaded Excel file includes all {filteredPreviewRows.length} rows.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
