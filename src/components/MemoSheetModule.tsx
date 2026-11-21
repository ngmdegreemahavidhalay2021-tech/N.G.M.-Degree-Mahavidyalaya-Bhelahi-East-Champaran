import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Columns,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AcademicSemester,
  AcademicSession,
  SUBJECT_TYPES,
  SubjectType,
} from '../types';
import { MemoSheetConfig, MemoSheetData, MemoSubjectOption } from '../types/memo';
import {
  fetchMemoRollNumbers,
  fetchMemoSubjectsForSelection,
  getAcademicSemesters,
  getAcademicSessions,
  getMemoSheetConfig,
  saveMemoSheetConfig,
} from '../services/memoService';
import {
  buildMemoHeaderLines,
  buildRollNumberGrid,
  exportMemoSheetsToExcel,
  exportMemoSheetsToPDF,
  printMemoSheets,
} from '../lib/memoExport';

interface MemoSheetModuleProps {
  collegeName?: string;
}

const DEFAULT_COLLEGE_CENTRE = 'NGM DEGREE COLLEGE, BHELAHI';

export const MemoSheetModule: React.FC<MemoSheetModuleProps> = ({ collegeName }) => {
  // Master academic dropdown lists
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [semesters, setSemesters] = useState<AcademicSemester[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Selection state
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SubjectType>('MJC');
  const [availableSubjects, setAvailableSubjects] = useState<MemoSubjectOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedPaperFilter, setSelectedPaperFilter] = useState<string>('ALL');

  // Student roster state
  const [rollNumbers, setRollNumbers] = useState<string[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Examination & Professor details (editable per subject)
  const [examYear, setExamYear] = useState<string>(String(new Date().getFullYear()));
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [collegeCentre, setCollegeCentre] = useState<string>(DEFAULT_COLLEGE_CENTRE);
  const [professor1Name, setProfessor1Name] = useState<string>('');
  const [professor1College, setProfessor1College] = useState<string>('');
  const [professor2Name, setProfessor2Name] = useState<string>('');
  const [professor2College, setProfessor2College] = useState<string>('');
  const [columnCount, setColumnCount] = useState<4 | 5>(5);

  // Batch multi-subject selection & saved config cache
  const [batchSelectedSubjects, setBatchSelectedSubjects] = useState<string[]>([]);
  const [savedConfigsMap, setSavedConfigsMap] = useState<Record<string, MemoSheetConfig | null>>({});

  // UI feedback states
  const [savingConfig, setSavingConfig] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'print' | 'batch-excel' | 'batch-pdf' | 'batch-print' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(true);

  // Load academic sessions and semesters dynamically on mount
  useEffect(() => {
    let mounted = true;
    const loadMasters = async () => {
      try {
        setLoadingMasters(true);
        const [sessList, semList] = await Promise.all([
          getAcademicSessions(),
          getAcademicSemesters(),
        ]);
        if (!mounted) return;
        const activeSessions = sessList.filter((s) => s.isActive !== false);
        const activeSemesters = semList.filter((s) => s.isActive !== false);
        setSessions(activeSessions);
        setSemesters(activeSemesters);

        if (activeSessions.length > 0) {
          const pref = activeSessions.find((s) => s.sessionName === '2025-29') || activeSessions[0];
          setSelectedSession(pref.sessionName);
        }
        if (activeSemesters.length > 0) {
          const prefSem =
            activeSemesters.find((s) => s.semesterName === 'Semester 2' || s.order === 2) ||
            activeSemesters[0];
          setSelectedSemester(prefSem.semesterName);
        }
      } catch (err) {
        console.error('Failed to load academic masters for Memo Sheet:', err);
      } finally {
        if (mounted) setLoadingMasters(false);
      }
    };
    loadMasters();
    return () => {
      mounted = false;
    };
  }, []);

  // Load available subjects when Session, Semester, or Category changes
  useEffect(() => {
    if (!selectedSession || !selectedSemester || !selectedCategory) return;
    let mounted = true;

    const loadSubjects = async () => {
      try {
        setLoadingSubjects(true);
        setStatusMessage(null);
        const list = await fetchMemoSubjectsForSelection(
          selectedSession,
          selectedSemester,
          selectedCategory
        );
        if (!mounted) return;
        setAvailableSubjects(list);

        // Preserve subject selection if still present, else choose first with students
        const currentStillExists = list.some((s) => s.subject === selectedSubject);
        const nextSubject = currentStillExists
          ? selectedSubject
          : (list.find((s) => s.studentCount > 0)?.subject || list[0]?.subject || '');
        setSelectedSubject(nextSubject);
        setSelectedPaperFilter('ALL');

        // Default batch selection to all subjects with students
        const subjectsWithStudents = list.filter((s) => s.studentCount > 0).map((s) => s.subject);
        setBatchSelectedSubjects(subjectsWithStudents);

        // Preload saved configs for subjects with students so readiness badges are accurate
        const configEntries = await Promise.all(
          subjectsWithStudents.map(async (subj) => {
            const cfg = await getMemoSheetConfig(
              selectedSession,
              selectedSemester,
              selectedCategory,
              subj
            );
            return [subj, cfg] as const;
          })
        );
        if (!mounted) return;
        const nextMap: Record<string, MemoSheetConfig | null> = {};
        configEntries.forEach(([subj, cfg]) => {
          nextMap[subj] = cfg;
        });
        setSavedConfigsMap(nextMap);
      } catch (err) {
        console.error('Error loading subjects for Memo Sheet:', err);
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    };

    loadSubjects();
    return () => {
      mounted = false;
    };
  }, [selectedSession, selectedSemester, selectedCategory]);

  // Load Roll Numbers & saved config when Subject or Paper filter changes
  useEffect(() => {
    if (!selectedSession || !selectedSemester || !selectedCategory || !selectedSubject) {
      setRollNumbers([]);
      return;
    }
    let mounted = true;

    const loadSubjectDetails = async () => {
      try {
        setLoadingRoster(true);
        const [rolls, savedCfg] = await Promise.all([
          fetchMemoRollNumbers({
            session: selectedSession,
            semester: selectedSemester,
            category: selectedCategory,
            subject: selectedSubject,
            paperFilter: selectedPaperFilter,
          }),
          getMemoSheetConfig(
            selectedSession,
            selectedSemester,
            selectedCategory,
            selectedSubject
          ),
        ]);
        if (!mounted) return;
        setRollNumbers(rolls);

        // Populate subject-specific saved examination & professor details (or reset professor names when switching subjects without saved config)
        if (savedCfg) {
          setExamYear(savedCfg.examYear || String(new Date().getFullYear()));
          setExamDate(savedCfg.examDate || new Date().toISOString().slice(0, 10));
          setCollegeCentre(savedCfg.collegeCentre || DEFAULT_COLLEGE_CENTRE);
          setProfessor1Name(savedCfg.professor1Name || '');
          setProfessor1College(savedCfg.professor1College || '');
          setProfessor2Name(savedCfg.professor2Name || '');
          setProfessor2College(savedCfg.professor2College || '');
          setColumnCount(savedCfg.columnCount === 4 ? 4 : 5);
          setSavedConfigsMap((prev) => ({ ...prev, [selectedSubject]: savedCfg }));
        } else {
          // Clear professor fields when switching to a subject with no saved config
          // so we never accidentally assume two subjects share the same professors
          setProfessor1Name('');
          setProfessor1College('');
          setProfessor2Name('');
          setProfessor2College('');
        }
      } catch (err) {
        console.error('Error loading Memo Sheet subject roster:', err);
      } finally {
        if (mounted) setLoadingRoster(false);
      }
    };

    loadSubjectDetails();
    return () => {
      mounted = false;
    };
  }, [selectedSession, selectedSemester, selectedCategory, selectedSubject, selectedPaperFilter]);

  const currentSubjectMeta = useMemo(
    () => availableSubjects.find((s) => s.subject === selectedSubject) || null,
    [availableSubjects, selectedSubject]
  );

  // Validate required inputs for active Memo Sheet
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!selectedSession) errors.push('Select an Academic Session.');
    if (!selectedSemester) errors.push('Select a Semester.');
    if (!selectedCategory) errors.push('Select a Subject Category (MJC / MIC / MDC).');
    if (!selectedSubject) errors.push('Select a Subject.');
    if (!examYear.trim()) errors.push('Enter the Examination Year.');
    if (!examDate.trim()) errors.push('Select or enter the Examination Date.');
    if (!collegeCentre.trim()) errors.push('Enter the College + Centre.');
    if (!professor1Name.trim()) errors.push('Enter Professor 1 Name.');
    if (!professor1College.trim()) errors.push('Enter Professor 1 College Name.');
    if (!professor2Name.trim()) errors.push('Enter Professor 2 Name.');
    if (!professor2College.trim()) errors.push('Enter Professor 2 College Name.');
    if (selectedSubject && !loadingRoster && rollNumbers.length === 0) {
      errors.push(`No eligible students found in the database for ${selectedSubject} (${selectedCategory}).`);
    }
    return errors;
  }, [
    selectedSession,
    selectedSemester,
    selectedCategory,
    selectedSubject,
    examYear,
    examDate,
    collegeCentre,
    professor1Name,
    professor1College,
    professor2Name,
    professor2College,
    loadingRoster,
    rollNumbers.length,
  ]);

  const activeSheetData: MemoSheetData = useMemo(
    () => ({
      session: selectedSession,
      semester: selectedSemester,
      category: selectedCategory,
      subject: selectedSubject,
      examYear: examYear.trim(),
      examDate: examDate.trim(),
      collegeCentre: collegeCentre.trim(),
      professor1Name: professor1Name.trim(),
      professor1College: professor1College.trim(),
      professor2Name: professor2Name.trim(),
      professor2College: professor2College.trim(),
      columnCount,
      rollNumbers,
      totalStudents: rollNumbers.length,
    }),
    [
      selectedSession,
      selectedSemester,
      selectedCategory,
      selectedSubject,
      examYear,
      examDate,
      collegeCentre,
      professor1Name,
      professor1College,
      professor2Name,
      professor2College,
      columnCount,
      rollNumbers,
    ]
  );

  const previewHeader = useMemo(
    () => buildMemoHeaderLines(activeSheetData),
    [activeSheetData]
  );

  const previewGrid = useMemo(
    () => buildRollNumberGrid(rollNumbers, columnCount),
    [rollNumbers, columnCount]
  );

  const isConfigComplete = (cfg: {
    examYear?: string;
    examDate?: string;
    collegeCentre?: string;
    professor1Name?: string;
    professor1College?: string;
    professor2Name?: string;
    professor2College?: string;
  } | null) => {
    if (!cfg) return false;
    return Boolean(
      cfg.examYear?.trim() &&
        cfg.examDate?.trim() &&
        cfg.collegeCentre?.trim() &&
        cfg.professor1Name?.trim() &&
        cfg.professor1College?.trim() &&
        cfg.professor2Name?.trim() &&
        cfg.professor2College?.trim()
    );
  };

  const handleSaveConfig = async (): Promise<boolean> => {
    if (!selectedSession || !selectedSemester || !selectedCategory || !selectedSubject) {
      setStatusMessage({
        type: 'error',
        text: 'Please select Session, Semester, Category, and Subject before saving.',
      });
      return false;
    }

    const detailErrors: string[] = [];
    if (!examYear.trim()) detailErrors.push('Examination Year');
    if (!examDate.trim()) detailErrors.push('Examination Date');
    if (!collegeCentre.trim()) detailErrors.push('College + Centre');
    if (!professor1Name.trim()) detailErrors.push('Professor 1 Name');
    if (!professor1College.trim()) detailErrors.push('Professor 1 College');
    if (!professor2Name.trim()) detailErrors.push('Professor 2 Name');
    if (!professor2College.trim()) detailErrors.push('Professor 2 College');

    if (detailErrors.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `Please enter required fields before saving: ${detailErrors.join(', ')}.`,
      });
      return false;
    }

    try {
      setSavingConfig(true);
      setStatusMessage(null);
      const saved = await saveMemoSheetConfig({
        session: selectedSession,
        semester: selectedSemester,
        category: selectedCategory,
        subject: selectedSubject,
        examYear: examYear.trim(),
        examDate: examDate.trim(),
        collegeCentre: collegeCentre.trim(),
        professor1Name: professor1Name.trim(),
        professor1College: professor1College.trim(),
        professor2Name: professor2Name.trim(),
        professor2College: professor2College.trim(),
        columnCount,
      });
      setSavedConfigsMap((prev) => ({ ...prev, [selectedSubject]: saved }));
      setStatusMessage({
        type: 'success',
        text: `Saved examination & professor details for ${selectedSubject} (${selectedCategory}).`,
      });
      return true;
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to save Memo Sheet examination details.',
      });
      return false;
    } finally {
      setSavingConfig(false);
    }
  };

  const ensureSingleReady = (): boolean => {
    if (validationErrors.length > 0) {
      setStatusMessage({
        type: 'error',
        text: validationErrors[0],
      });
      return false;
    }
    setStatusMessage(null);
    return true;
  };

  const handleSingleExcelExport = async () => {
    if (!ensureSingleReady()) return;
    try {
      setExporting('excel');
      await exportMemoSheetsToExcel([activeSheetData]);
      setStatusMessage({
        type: 'success',
        text: `Downloaded Excel Memo Sheet for ${selectedSubject} (${selectedCategory}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate Excel Memo Sheet.',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleSinglePDFExport = () => {
    if (!ensureSingleReady()) return;
    try {
      setExporting('pdf');
      exportMemoSheetsToPDF([activeSheetData]);
      setStatusMessage({
        type: 'success',
        text: `Downloaded PDF Memo Sheet for ${selectedSubject} (${selectedCategory}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate PDF Memo Sheet.',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleSinglePrint = () => {
    if (!ensureSingleReady()) return;
    setExporting('print');
    try {
      printMemoSheets([activeSheetData]);
    } finally {
      setExporting(null);
    }
  };

  const buildBatchSheets = async (): Promise<MemoSheetData[] | null> => {
    if (!selectedSession || !selectedSemester || !selectedCategory) {
      setStatusMessage({
        type: 'error',
        text: 'Select Session, Semester, and Subject Category first.',
      });
      return null;
    }

    if (batchSelectedSubjects.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Select at least one subject in the Multi-Subject list for batch export/print.',
      });
      return null;
    }

    const sheets: MemoSheetData[] = [];
    const incompleteSubjects: string[] = [];
    const emptySubjects: string[] = [];

    for (const subj of batchSelectedSubjects) {
      const isCurrent = subj === selectedSubject;
      const cfg = isCurrent
        ? {
            examYear: examYear.trim(),
            examDate: examDate.trim(),
            collegeCentre: collegeCentre.trim(),
            professor1Name: professor1Name.trim(),
            professor1College: professor1College.trim(),
            professor2Name: professor2Name.trim(),
            professor2College: professor2College.trim(),
            columnCount,
          }
        : savedConfigsMap[subj] ??
          (await getMemoSheetConfig(selectedSession, selectedSemester, selectedCategory, subj));

      if (!isConfigComplete(cfg)) {
        incompleteSubjects.push(subj);
        continue;
      }

      const rolls = isCurrent
        ? rollNumbers
        : await fetchMemoRollNumbers({
            session: selectedSession,
            semester: selectedSemester,
            category: selectedCategory,
            subject: subj,
          });

      if (rolls.length === 0) {
        emptySubjects.push(subj);
        continue;
      }

      sheets.push({
        session: selectedSession,
        semester: selectedSemester,
        category: selectedCategory,
        subject: subj,
        examYear: cfg!.examYear.trim(),
        examDate: cfg!.examDate.trim(),
        collegeCentre: cfg!.collegeCentre.trim(),
        professor1Name: cfg!.professor1Name.trim(),
        professor1College: cfg!.professor1College.trim(),
        professor2Name: cfg!.professor2Name.trim(),
        professor2College: cfg!.professor2College.trim(),
        columnCount: cfg!.columnCount === 4 ? 4 : 5,
        rollNumbers: rolls,
        totalStudents: rolls.length,
      });
    }

    if (incompleteSubjects.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `Please select and save Examination & Professor details for: ${incompleteSubjects.join(', ')} before generating all subject Memo Sheets.`,
      });
      return null;
    }

    if (emptySubjects.length > 0 && sheets.length === 0) {
      setStatusMessage({
        type: 'error',
        text: `No eligible students found for selected subjects: ${emptySubjects.join(', ')}.`,
      });
      return null;
    }

    if (sheets.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'No valid subject Memo Sheets available to export.',
      });
      return null;
    }

    setStatusMessage(null);
    return sheets;
  };

  const handleBatchExcelExport = async () => {
    try {
      setExporting('batch-excel');
      const sheets = await buildBatchSheets();
      if (!sheets) return;
      await exportMemoSheetsToExcel(sheets);
      setStatusMessage({
        type: 'success',
        text: `Downloaded Excel workbook with ${sheets.length} separate subject worksheet${sheets.length > 1 ? 's' : ''}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate multi-subject Excel workbook.',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleBatchPDFExport = async () => {
    try {
      setExporting('batch-pdf');
      const sheets = await buildBatchSheets();
      if (!sheets) return;
      exportMemoSheetsToPDF(sheets);
      setStatusMessage({
        type: 'success',
        text: `Downloaded combined PDF for ${sheets.length} subject${sheets.length > 1 ? 's' : ''}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to generate multi-subject PDF.',
      });
    } finally {
      setExporting(null);
    }
  };

  const handleBatchPrint = async () => {
    try {
      setExporting('batch-print');
      const sheets = await buildBatchSheets();
      if (!sheets) return;
      printMemoSheets(sheets);
    } finally {
      setExporting(null);
    }
  };

  const toggleBatchSubject = (subj: string) => {
    setBatchSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  };

  const subjectsWithStudents = useMemo(
    () => availableSubjects.filter((s) => s.studentCount > 0),
    [availableSubjects]
  );

  const handleRefreshRoster = async () => {
    if (!selectedSession || !selectedSemester || !selectedCategory) return;
    setLoadingSubjects(true);
    try {
      const list = await fetchMemoSubjectsForSelection(
        selectedSession,
        selectedSemester,
        selectedCategory
      );
      setAvailableSubjects(list);
      if (selectedSubject) {
        const rolls = await fetchMemoRollNumbers({
          session: selectedSession,
          semester: selectedSemester,
          category: selectedCategory,
          subject: selectedSubject,
          paperFilter: selectedPaperFilter,
        });
        setRollNumbers(rolls);
      }
      setStatusMessage({
        type: 'success',
        text: 'Refreshed student roster from database.',
      });
    } finally {
      setLoadingSubjects(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-slate-100">Memo Sheet Generator</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generate official practical examination Roll Number Memo Sheets from live ERP records with subject-wise Excel, PDF, and Print output.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-slate-950 rounded-xl border border-slate-800 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Active Subject Roster
            </span>
            <strong className="text-base font-bold text-emerald-400 font-mono">
              {loadingRoster ? '...' : `${rollNumbers.length} Students`}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleRefreshRoster}
            disabled={loadingSubjects || loadingRoster}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh records from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSubjects || loadingRoster ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
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

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Academic Selections & Examination/Professor Details */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              1. Academic Selection & Examination Details
            </h3>
            {collegeName && (
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                {collegeName}
              </span>
            )}
          </div>

          {loadingMasters ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading academic sessions & semesters...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Row 1: Session, Semester, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
                    {sessions.map((s) => (
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
                    {semesters.map((s) => (
                      <option key={s.id} value={s.semesterName}>
                        {s.semesterName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Subject Category *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                    {SUBJECT_TYPES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Subject, Optional Paper, Column Count */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Practical Subject *
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedPaperFilter('ALL');
                    }}
                    disabled={loadingSubjects}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="">
                      {loadingSubjects ? 'Loading subjects...' : 'Select Subject'}
                    </option>
                    {availableSubjects.map((opt) => (
                      <option key={opt.subject} value={opt.subject}>
                        {opt.subject} ({opt.studentCount} Students)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
                    <Columns className="w-3.5 h-3.5 text-slate-400" />
                    Roll No. Columns
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
                    {([4, 5] as const).map((cols) => (
                      <button
                        key={cols}
                        type="button"
                        onClick={() => setColumnCount(cols)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          columnCount === cols
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {cols} Cols
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional Paper Filter if multiple papers exist for selected subject */}
              {currentSubjectMeta && currentSubjectMeta.papers.length > 1 && (
                <div className="text-xs">
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Paper Filter (Optional)
                  </label>
                  <select
                    value={selectedPaperFilter}
                    onChange={(e) => setSelectedPaperFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">
                      All Papers Combined ({currentSubjectMeta.papers.join(', ')})
                    </option>
                    {currentSubjectMeta.papers.map((paper) => (
                      <option key={paper} value={paper}>
                        {paper}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-slate-800 pt-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      Examination Year *
                    </label>
                    <input
                      type="text"
                      value={examYear}
                      onChange={(e) => setExamYear(e.target.value)}
                      placeholder="e.g. 2026"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      Examination Date *
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      College + Centre *
                    </label>
                    <input
                      type="text"
                      value={collegeCentre}
                      onChange={(e) => setCollegeCentre(e.target.value)}
                      placeholder="NGM DEGREE COLLEGE, BHELAHI"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Professor 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Professor 1 Name *
                    </label>
                    <input
                      type="text"
                      value={professor1Name}
                      onChange={(e) => setProfessor1Name(e.target.value)}
                      placeholder="Enter Professor 1 Name"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Professor 1 College Name *
                    </label>
                    <input
                      type="text"
                      value={professor1College}
                      onChange={(e) => setProfessor1College(e.target.value)}
                      placeholder="Enter Professor 1 College"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Professor 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Professor 2 Name *
                    </label>
                    <input
                      type="text"
                      value={professor2Name}
                      onChange={(e) => setProfessor2Name(e.target.value)}
                      placeholder="Enter Professor 2 Name"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      Professor 2 College Name *
                    </label>
                    <input
                      type="text"
                      value={professor2College}
                      onChange={(e) => setProfessor2College(e.target.value)}
                      placeholder="Enter Professor 2 College"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-slate-400">
                    Professor &amp; exam details are saved per subject without altering any student or marks records.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig || !selectedSubject}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {savingConfig ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Details for {selectedSubject || 'Subject'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Subject-Wise Batch Selection & Export Controls */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                2. Subject-Wise Sheets ({selectedCategory})
              </h3>
              {subjectsWithStudents.length > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setBatchSelectedSubjects(subjectsWithStudents.map((s) => s.subject))
                    }
                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setBatchSelectedSubjects([])}
                    className="text-slate-400 hover:text-slate-300 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {loadingSubjects ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Checking subject rosters...</span>
              </div>
            ) : subjectsWithStudents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                No enrolled student rosters found for{' '}
                <strong className="text-slate-200">
                  {selectedSession} / {selectedSemester} / {selectedCategory}
                </strong>
                . Upload or verify students in Student Management first.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {subjectsWithStudents.map((item) => {
                  const isActive = item.subject === selectedSubject;
                  const isChecked = batchSelectedSubjects.includes(item.subject);
                  const isReady = isActive
                    ? validationErrors.length === 0
                    : isConfigComplete(savedConfigsMap[item.subject] || null);

                  return (
                    <div
                      key={item.subject}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-colors ${
                        isActive
                          ? 'bg-blue-600/10 border-blue-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBatchSubject(item.subject)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer"
                          title={`Include ${item.subject} in Multi-Subject export/print`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubject(item.subject);
                            setSelectedPaperFilter('ALL');
                          }}
                          className="text-left min-w-0 cursor-pointer"
                        >
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {item.subject} ({selectedCategory})
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.studentCount} Students
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {isReady ? 'Ready' : 'Needs Details'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export & Print Actions */}
          <div className="border-t border-slate-800 pt-4 space-y-3">
            {/* Validation Checklist Summary */}
            {validationErrors.length > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Complete required fields to export {selectedSubject || 'Memo Sheet'}:</span>
                </div>
                <p className="text-amber-200/90 pl-5">
                  {validationErrors[0]}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Current Subject ({selectedSubject || 'None'})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleSingleExcelExport}
                  disabled={exporting !== null || validationErrors.length > 0}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 disabled:opacity-45 transition-all cursor-pointer"
                >
                  {exporting === 'excel' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSinglePDFExport}
                  disabled={exporting !== null || validationErrors.length > 0}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 disabled:opacity-45 transition-all cursor-pointer"
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleSinglePrint}
                  disabled={exporting !== null || validationErrors.length > 0}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 disabled:opacity-45 transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Memo Sheet</span>
                </button>
              </div>
            </div>

            {subjectsWithStudents.length > 1 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Selected Subjects Batch ({batchSelectedSubjects.length} Selected)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleBatchExcelExport}
                    disabled={exporting !== null || batchSelectedSubjects.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-45 transition-all cursor-pointer"
                  >
                    {exporting === 'batch-excel' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    <span>All Subjects Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBatchPDFExport}
                    disabled={exporting !== null || batchSelectedSubjects.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-45 transition-all cursor-pointer"
                  >
                    {exporting === 'batch-pdf' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    <span>All Subjects PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBatchPrint}
                    disabled={exporting !== null || batchSelectedSubjects.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 disabled:opacity-45 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print All Subject Memo Sheets</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Print-Accurate Memo Sheet Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Memo Sheet Preview ({selectedSubject ? `${selectedSubject} - ${selectedCategory}` : 'No Subject Selected'})
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-mono">
              TOTAL: <strong className="text-emerald-400">{rollNumbers.length}</strong> | Columns:{' '}
              <strong className="text-slate-200">{columnCount}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPreviewConfirmed((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
            >
              {previewConfirmed ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
        </div>

        {previewConfirmed && (
          <div className="p-4 sm:p-6 bg-slate-950/60 overflow-x-auto">
            {loadingRoster ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span>Fetching student roll numbers from database...</span>
              </div>
            ) : !selectedSubject ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Select a Session, Semester, Category, and Subject above to preview the Memo Sheet.
              </div>
            ) : rollNumbers.length === 0 ? (
              <div className="max-w-lg mx-auto my-8 p-6 rounded-2xl bg-slate-900 border border-amber-500/30 text-center space-y-2">
                <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
                <h5 className="text-sm font-bold text-slate-100">
                  No Students Found for {selectedSubject} ({selectedCategory})
                </h5>
                <p className="text-xs text-slate-400">
                  No active student roll numbers exist in the database for{' '}
                  <span className="text-slate-200 font-semibold">{selectedSession}</span> &bull;{' '}
                  <span className="text-slate-200 font-semibold">{selectedSemester}</span> &bull;{' '}
                  <span className="text-slate-200 font-semibold">{selectedCategory}</span> &bull;{' '}
                  <span className="text-slate-200 font-semibold">{selectedSubject}</span>.
                </p>
              </div>
            ) : (
              /* Traditional White Paper Examination Memo Sheet Preview */
              <div className="bg-white text-black max-w-[820px] mx-auto p-6 sm:p-8 rounded-lg shadow-2xl border border-slate-300 font-sans">
                {/* 5-Line Header Block */}
                <table className="w-full border-collapse border border-black text-[12px] font-bold">
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-2 text-center text-[13px] tracking-wide">
                        {previewHeader.line1}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1.5 text-left">
                        {previewHeader.line2}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1.5 text-left">
                        {previewHeader.line3}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1.5 text-left">
                        {previewHeader.line4}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1.5 text-left">
                        {previewHeader.line5}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Vertical Roll Number Columns Grid */}
                <table className="w-full border-collapse border border-black mt-3 table-fixed text-[12px]">
                  <tbody>
                    {previewGrid.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="border border-black px-2 py-1.5 text-center font-mono font-medium h-8 break-words"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* TOTAL Students */}
                <div className="border border-black px-3 py-1.5 mt-3 text-[13px] font-bold text-left">
                  TOTAL - {rollNumbers.length}
                </div>

                {/* Signature Section: TAB - 1 | TAB - 2 | C.S. */}
                <div className="flex items-end justify-between px-6 sm:px-10 pt-14 pb-2 text-[13px] font-bold">
                  <div className="text-center min-w-[80px]">TAB - 1</div>
                  <div className="text-center min-w-[80px]">TAB - 2</div>
                  <div className="text-center min-w-[80px]">C.S.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
