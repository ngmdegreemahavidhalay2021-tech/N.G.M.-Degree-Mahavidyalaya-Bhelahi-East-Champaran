import React, { useState, useEffect } from 'react';
import {
  Award,
  Save,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  SlidersHorizontal,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  PracticalForm,
  FormEnrollment,
  MarksRecord,
  Student,
  Department,
} from '../types';
import {
  getFormEnrollments,
  getFormMarks,
  saveSingleMark,
  saveBulkMarks,
  resetFormMarks,
  enrollStudentsInForm,
  removeStudentFromForm,
  updatePracticalForm,
  getStudents,
} from '../services/collegeService';
import { exportSingleFormExcel } from '../lib/collegeExport';

interface MarksModuleProps {
  forms: PracticalForm[];
  departments: Department[];
  selectedFormId?: string;
  onRefresh: () => void;
}

export const MarksModule: React.FC<MarksModuleProps> = ({
  forms,
  departments,
  selectedFormId,
  onRefresh,
}) => {
  const [activeFormId, setActiveFormId] = useState(selectedFormId || forms[0]?.id || '');
  const [mode, setMode] = useState<'bulk' | 'individual' | 'enrollment'>('bulk');
  const [enrollments, setEnrollments] = useState<FormEnrollment[]>([]);
  const [marksList, setMarksList] = useState<MarksRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Bulk input state map: studentId -> { marks: string; isPresent: boolean; remarks: string }
  const [inputMap, setInputMap] = useState<
    Record<string, { marks: string; isPresent: boolean; remarks: string }>
  >({});

  // Individual entry search
  const [indivSearch, setIndivSearch] = useState('');
  const [selectedIndivStudent, setSelectedIndivStudent] = useState<FormEnrollment | null>(null);
  const [indivMarks, setIndivMarks] = useState('');
  const [indivPresent, setIndivPresent] = useState(true);
  const [indivRemarks, setIndivRemarks] = useState('');

  // Bulk filtering and pagination
  const [tableSearch, setTableSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'PENDING'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Student Enrollment Manager state
  const [allCollegeStudents, setAllCollegeStudents] = useState<Student[]>([]);
  const [enrolSearch, setEnrolSearch] = useState('');
  const [selectedToEnrol, setSelectedToEnrol] = useState<Set<string>>(new Set());

  const currentForm = forms.find((f) => f.id === activeFormId);

  useEffect(() => {
    if (activeFormId) {
      loadFormData(activeFormId);
    }
  }, [activeFormId]);

  const loadFormData = async (formId: string) => {
    try {
      setLoading(true);
      const [enr, mrk] = await Promise.all([
        getFormEnrollments(formId),
        getFormMarks(formId),
      ]);
      setEnrollments(enr);
      setMarksList(mrk);

      // Populate input map from saved marks
      const map: Record<string, { marks: string; isPresent: boolean; remarks: string }> = {};
      const savedByStudent = new Map(mrk.map((m) => [m.studentId, m]));

      enr.forEach((e) => {
        const saved = savedByStudent.get(e.studentId);
        if (saved) {
          map[e.studentId] = {
            marks: saved.marksObtained !== null && saved.marksObtained !== undefined ? String(saved.marksObtained) : '',
            isPresent: saved.isPresent,
            remarks: saved.remarks || '',
          };
        } else {
          // Empty initial boxes as requested
          map[e.studentId] = {
            marks: '',
            isPresent: true,
            remarks: '',
          };
        }
      });

      setInputMap(map);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error loading form data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Mark Input Change with validation
  const handleBulkMarkChange = (studentId: string, val: string) => {
    if (!currentForm) return;

    // Check decimal configuration
    if (!currentForm.allowDecimals && val.includes('.')) {
      alert('This examination is configured for integer marks only.');
      return;
    }

    const num = Number(val);
    if (!isNaN(num) && num > currentForm.maxMarks) {
      alert(`Marks cannot exceed maximum marks (${currentForm.maxMarks}).`);
      return;
    }
    if (!isNaN(num) && num < 0) {
      alert('Marks cannot be negative.');
      return;
    }

    setInputMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { isPresent: true, remarks: '' }),
        marks: val,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleBulkAttendanceToggle = (studentId: string) => {
    setInputMap((prev) => {
      const current = prev[studentId] || { marks: '', isPresent: true, remarks: '' };
      const nextPresent = !current.isPresent;
      return {
        ...prev,
        [studentId]: {
          ...current,
          isPresent: nextPresent,
          marks: nextPresent ? current.marks : '',
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleBulkRemarksChange = (studentId: string, remarks: string) => {
    setInputMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { marks: '', isPresent: true }),
        remarks,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // Save All Bulk Marks
  const handleSaveBulk = async () => {
    if (!currentForm) return;

    try {
      setSaving(true);
      const recordsToSave = enrollments.map((enr) => {
        const input = inputMap[enr.studentId] || { marks: '', isPresent: true, remarks: '' };
        const numMarks = input.marks !== '' ? Number(input.marks) : null;

        return {
          studentId: enr.studentId,
          rollNumber: enr.rollNumber,
          studentName: enr.studentName,
          marksObtained: input.isPresent ? numMarks : null,
          isPresent: input.isPresent,
          remarks: input.remarks,
        };
      });

      await saveBulkMarks(currentForm.id, recordsToSave, 'Administrator');
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadFormData(currentForm.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Individual Mode Handlers
  const handleSelectIndivStudent = (enr: FormEnrollment) => {
    setSelectedIndivStudent(enr);
    const existing = inputMap[enr.studentId];
    if (existing) {
      setIndivMarks(existing.marks);
      setIndivPresent(existing.isPresent);
      setIndivRemarks(existing.remarks);
    } else {
      setIndivMarks('');
      setIndivPresent(true);
      setIndivRemarks('');
    }
  };

  const handleSaveIndividual = async () => {
    if (!currentForm || !selectedIndivStudent) return;

    const numMarks = indivMarks !== '' ? Number(indivMarks) : null;

    if (numMarks !== null) {
      if (numMarks > currentForm.maxMarks) {
        alert(`Marks cannot exceed ${currentForm.maxMarks}`);
        return;
      }
      if (numMarks < 0) {
        alert('Marks cannot be negative.');
        return;
      }
      if (!currentForm.allowDecimals && indivMarks.includes('.')) {
        alert('Decimals are not permitted.');
        return;
      }
    }

    try {
      setSaving(true);
      await saveSingleMark({
        practicalFormId: currentForm.id,
        studentId: selectedIndivStudent.studentId,
        rollNumber: selectedIndivStudent.rollNumber,
        studentName: selectedIndivStudent.studentName,
        marksObtained: indivPresent ? numMarks : null,
        isPresent: indivPresent,
        remarks: indivRemarks,
        updatedBy: 'Administrator (Individual Mode)',
      });

      // Synchronize in inputMap immediately
      setInputMap((prev) => ({
        ...prev,
        [selectedIndivStudent.studentId]: {
          marks: indivMarks,
          isPresent: indivPresent,
          remarks: indivRemarks,
        },
      }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      await loadFormData(currentForm.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Reset All Marks in Form
  const handleResetMarks = async () => {
    if (!currentForm) return;
    const ok = window.confirm(
      `Reset all marks in "${currentForm.title}"?\nAll entered scores will be cleared. This action cannot be undone.`
    );
    if (!ok) return;

    try {
      await resetFormMarks(currentForm.id);
      await loadFormData(currentForm.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reset marks');
    }
  };

  // Lock / Unlock Student List
  const handleToggleLock = async () => {
    if (!currentForm) return;
    const nextLocked = !currentForm.isStudentListLocked;
    try {
      await updatePracticalForm(currentForm.id, { isStudentListLocked: nextLocked });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update lock state');
    }
  };

  // Open Enrollment Selector
  const handleOpenEnrollmentManager = async () => {
    setMode('enrollment');
    try {
      const all = await getStudents(currentForm?.departmentId);
      setAllCollegeStudents(all);
      // Pre-select already enrolled
      const enrolledIds = new Set(enrollments.map((e) => e.studentId));
      setSelectedToEnrol(enrolledIds);
    } catch (err) {
      console.error('Error fetching students for enrollment:', err);
    }
  };

  const handleToggleEnrolSelect = (studentId: string) => {
    setSelectedToEnrol((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleSelectAllEligible = () => {
    const allIds = new Set(allCollegeStudents.map((s) => s.id));
    setSelectedToEnrol(allIds);
  };

  const handleSaveEnrollments = async () => {
    if (!currentForm) return;
    try {
      setSaving(true);
      const selectedList = allCollegeStudents.filter((s) => selectedToEnrol.has(s.id));
      await enrollStudentsInForm(currentForm, selectedList);
      setMode('bulk');
      await loadFormData(currentForm.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save enrollments');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Table rows
  const filteredEnrollments = enrollments.filter((e) => {
    const matchesSearch =
      e.rollNumber.toLowerCase().includes(tableSearch.toLowerCase()) ||
      e.studentName.toLowerCase().includes(tableSearch.toLowerCase());

    const input = inputMap[e.studentId];
    let matchesAttendance = true;
    if (attendanceFilter === 'PRESENT') matchesAttendance = input?.isPresent === true && input.marks !== '';
    if (attendanceFilter === 'ABSENT') matchesAttendance = input?.isPresent === false;
    if (attendanceFilter === 'PENDING') matchesAttendance = input?.isPresent === true && input.marks === '';

    return matchesSearch && matchesAttendance;
  });

  const totalPages = Math.ceil(filteredEnrollments.length / pageSize) || 1;
  const paginatedRows = filteredEnrollments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Compute live statistics
  let evaluatedCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  enrollments.forEach((e) => {
    const inp = inputMap[e.studentId];
    if (!inp) pendingCount++;
    else if (!inp.isPresent) absentCount++;
    else if (inp.marks !== '') evaluatedCount++;
    else pendingCount++;
  });

  return (
    <div className="space-y-6">
      {/* Top Form Selector & Controls */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="w-full lg:w-auto">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Active Practical Examination Form:
          </label>
          <select
            value={activeFormId}
            onChange={(e) => setActiveFormId(e.target.value)}
            className="w-full lg:w-96 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.subjectCode} — {f.title} ({f.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMode('bulk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'bulk'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mode B: Bulk Entry
            </button>
            <button
              onClick={() => setMode('individual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'individual'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mode A: Individual Search
            </button>
            <button
              onClick={handleOpenEnrollmentManager}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === 'enrollment'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Student Roster ({enrollments.length})
            </button>
          </div>

          {currentForm && (
            <button
              onClick={() => exportSingleFormExcel(currentForm, enrollments, marksList)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
              title="Export Form Marksheet to Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Enrolled Candidates</span>
          <strong className="text-base font-bold text-slate-100 font-mono">{enrollments.length}</strong>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Marks Recorded</span>
          <strong className="text-base font-bold text-emerald-300 font-mono">{evaluatedCount}</strong>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-rose-400 block">Marked Absent</span>
          <strong className="text-base font-bold text-rose-300 font-mono">{absentCount}</strong>
        </div>
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] uppercase font-bold text-amber-400 block">Pending Entries</span>
          <strong className="text-base font-bold text-amber-300 font-mono">{pendingCount}</strong>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Evaluation marks saved and synchronized across both modes in Firestore.</span>
        </div>
      )}

      {/* MODE B: BULK MARKS ENTRY */}
      {mode === 'bulk' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search candidates in this form..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={attendanceFilter}
                onChange={(e) => {
                  setAttendanceFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value="PRESENT">Present (Marks Entered)</option>
                <option value="ABSENT">Absent</option>
                <option value="PENDING">Pending Entry</option>
              </select>

              <button
                onClick={handleSaveBulk}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all ${
                  hasUnsavedChanges
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25 animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : hasUnsavedChanges ? 'Save Unsaved Changes' : 'Save All Marks'}</span>
              </button>

              <button
                onClick={handleResetMarks}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 border border-slate-800"
                title="Reset all marks in this form"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bulk Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 w-32">Roll Number</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3 w-28 text-center">Attendance</th>
                    <th className="py-3 px-3 w-36 text-center">
                      Marks (Max: {currentForm?.maxMarks || 50})
                    </th>
                    <th className="py-3 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                        <p className="text-sm font-medium">No candidates in this form</p>
                        <p className="text-xs text-slate-500">
                          Click "Student Roster" to verify and enroll candidates.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((enr, idx) => {
                      const input = inputMap[enr.studentId] || { marks: '', isPresent: true, remarks: '' };
                      const isPresent = input.isPresent;

                      return (
                        <tr
                          key={enr.studentId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            !isPresent ? 'bg-rose-950/15' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                            {enr.rollNumber}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            {enr.studentName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleBulkAttendanceToggle(enr.studentId)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                                isPresent
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {isPresent ? 'PRESENT' : 'ABSENT'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isPresent ? (
                              <input
                                type="number"
                                step={currentForm?.allowDecimals ? '0.1' : '1'}
                                min={0}
                                max={currentForm?.maxMarks}
                                value={input.marks}
                                onChange={(e) => handleBulkMarkChange(enr.studentId, e.target.value)}
                                placeholder="Empty Box"
                                className="w-28 py-1 px-2 text-center font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                              />
                            ) : (
                              <span className="font-mono text-rose-400 font-semibold text-xs">
                                ABSENT
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={input.remarks}
                              onChange={(e) => handleBulkRemarksChange(enr.studentId, e.target.value)}
                              placeholder="Remarks"
                              className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredEnrollments.length)} of {filteredEnrollments.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE A: INDIVIDUAL MARKS ENTRY */}
      {mode === 'individual' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Candidate Search & Selector List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Candidate
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={indivSearch}
                onChange={(e) => setIndivSearch(e.target.value)}
                placeholder="Search Roll No or Name..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
              {enrollments
                .filter(
                  (e) =>
                    e.rollNumber.toLowerCase().includes(indivSearch.toLowerCase()) ||
                    e.studentName.toLowerCase().includes(indivSearch.toLowerCase())
                )
                .map((enr) => {
                  const isSelected = selectedIndivStudent?.studentId === enr.studentId;
                  const currentMark = inputMap[enr.studentId]?.marks;
                  return (
                    <button
                      key={enr.studentId}
                      onClick={() => handleSelectIndivStudent(enr)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold">{enr.rollNumber}</div>
                        <div className="truncate max-w-[150px]">{enr.studentName}</div>
                      </div>
                      <span className="font-mono text-[11px] opacity-80">
                        {currentMark !== '' && currentMark !== undefined ? `${currentMark} pts` : 'Empty'}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Individual Entry Card */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            {selectedIndivStudent ? (
              <div className="space-y-5">
                <div className="pb-4 border-b border-slate-800">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Roll No: {selectedIndivStudent.rollNumber}
                  </span>
                  <h3 className="text-xl font-bold text-slate-100 mt-2">
                    {selectedIndivStudent.studentName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentForm?.subjectCode} — {currentForm?.subjectName} | Maximum Marks: <strong className="text-amber-400">{currentForm?.maxMarks}</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Candidate Attendance Status
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIndivPresent(true)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          indivPresent
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-slate-950 border border-slate-700 text-slate-400'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => setIndivPresent(false)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          !indivPresent
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-950 border border-slate-700 text-slate-400'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>

                  {indivPresent ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Marks Obtained (Max {currentForm?.maxMarks})
                      </label>
                      <input
                        type="number"
                        step={currentForm?.allowDecimals ? '0.1' : '1'}
                        min={0}
                        max={currentForm?.maxMarks}
                        value={indivMarks}
                        onChange={(e) => setIndivMarks(e.target.value)}
                        placeholder="Enter Marks"
                        className="w-48 py-2 px-3 text-lg font-mono font-bold bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                      Candidate marked absent. No marks will be awarded.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Examiner Remarks
                    </label>
                    <input
                      type="text"
                      value={indivRemarks}
                      onChange={(e) => setIndivRemarks(e.target.value)}
                      placeholder="e.g. Completed viva, neat record"
                      className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSaveIndividual}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Student Marks'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <Search className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-medium">Select a student candidate on the left to enter marks</p>
                <p className="text-xs">Or search by Roll Number / Name.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STUDENT ENROLLMENT & VERIFICATION VIEW */}
      {mode === 'enrollment' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                Student Candidate Selection & Verification
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Only selected and verified students can receive marks in this practical form. Public link holders cannot add or delete candidates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleLock}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  currentForm?.isStudentListLocked
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {currentForm?.isStudentListLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{currentForm?.isStudentListLocked ? 'Student List Locked' : 'Student List Open'}</span>
              </button>

              <button
                onClick={handleSelectAllEligible}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                Select All Eligible
              </button>

              <button
                onClick={handleSaveEnrollments}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25"
              >
                {saving ? 'Saving...' : `Save Roster (${selectedToEnrol.size})`}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={enrolSearch}
              onChange={(e) => setEnrolSearch(e.target.value)}
              placeholder="Filter master students by roll number or candidate name..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Selection Table */}
          <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">Enrol</th>
                  <th className="py-2.5 px-3 w-28">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Permanent ID</th>
                  <th className="py-2.5 px-3">Course</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allCollegeStudents
                  .filter(
                    (s) =>
                      s.rollNumber.toLowerCase().includes(enrolSearch.toLowerCase()) ||
                      s.studentName.toLowerCase().includes(enrolSearch.toLowerCase())
                  )
                  .map((s) => {
                    const isChecked = selectedToEnrol.has(s.id);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => handleToggleEnrolSelect(s.id)}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? 'bg-blue-950/20' : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by row click
                            className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                          {s.rollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">
                          {s.studentName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {s.id}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.course} • {s.semester}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
