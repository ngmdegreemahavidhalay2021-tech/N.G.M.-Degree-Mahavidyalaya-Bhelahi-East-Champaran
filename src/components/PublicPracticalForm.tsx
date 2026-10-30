import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Search,
  FileSpreadsheet,
  Send,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PracticalForm, FormEnrollment, MarksRecord } from '../types';
import {
  getPracticalFormByToken,
  getFormEnrollments,
  getFormMarks,
  saveBulkMarks,
  saveSingleMark,
} from '../services/collegeService';
import { exportSingleFormExcel } from '../lib/collegeExport';

interface PublicPracticalFormProps {
  token: string;
  collegeName?: string;
  onExit: () => void;
}

export const PublicPracticalForm: React.FC<PublicPracticalFormProps> = ({
  token,
  collegeName = 'NGM Degree Mahavidyalaya',
  onExit,
}) => {
  const [form, setForm] = useState<PracticalForm | null>(null);
  const [enrollments, setEnrollments] = useState<FormEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry Mode: Bulk vs Individual
  const [mode, setMode] = useState<'bulk' | 'individual'>('bulk');
  const [inputMap, setInputMap] = useState<
    Record<string, { marks: string; isPresent: boolean; remarks: string }>
  >({});

  // Individual mode state
  const [indivSearch, setIndivSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<FormEnrollment | null>(null);
  const [indivMarks, setIndivMarks] = useState('');
  const [indivPresent, setIndivPresent] = useState(true);
  const [indivRemarks, setIndivRemarks] = useState('');

  // Bulk search
  const [tableSearch, setTableSearch] = useState('');
  const [examinerName, setExaminerName] = useState('External Examiner');

  useEffect(() => {
    loadPublicForm();
  }, [token]);

  const loadPublicForm = async () => {
    try {
      setLoading(true);
      setError(null);
      const formData = await getPracticalFormByToken(token);
      if (!formData) {
        setError('Invalid or expired practical examination link.');
        return;
      }

      if (!formData.isActive) {
        setError('This practical examination link is currently deactivated by the Administration.');
        return;
      }

      if (formData.status === 'draft') {
        setError('This practical examination form is currently in Draft status and has not yet been published.');
        return;
      }

      setForm(formData);

      const [enr, mrk] = await Promise.all([
        getFormEnrollments(formData.id),
        getFormMarks(formData.id),
      ]);
      setEnrollments(enr);

      // Pre-fill input map with existing marks
      const marksByStudent = new Map(mrk.map((m) => [m.studentId, m]));
      const map: Record<string, { marks: string; isPresent: boolean; remarks: string }> = {};

      enr.forEach((e) => {
        const saved = marksByStudent.get(e.studentId);
        if (saved) {
          map[e.studentId] = {
            marks: saved.marksObtained !== null && saved.marksObtained !== undefined ? String(saved.marksObtained) : '',
            isPresent: saved.isPresent,
            remarks: saved.remarks || '',
          };
        } else {
          // Empty input boxes initially
          map[e.studentId] = {
            marks: '',
            isPresent: true,
            remarks: '',
          };
        }
      });

      setInputMap(map);
    } catch (err: any) {
      setError(err.message || 'Failed to load examination form');
    } finally {
      setLoading(false);
    }
  };

  const isClosed = form?.status === 'closed';

  // Bulk input handlers
  const handleBulkMarkChange = (studentId: string, val: string) => {
    if (isClosed || !form) return;

    if (!form.allowDecimals && val.includes('.')) {
      alert('This examination is configured for integer marks only.');
      return;
    }

    const num = Number(val);
    if (!isNaN(num) && num > form.maxMarks) {
      alert(`Marks cannot exceed maximum marks (${form.maxMarks}).`);
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
  };

  const handleBulkAttendance = (studentId: string) => {
    if (isClosed) return;
    setInputMap((prev) => {
      const cur = prev[studentId] || { marks: '', isPresent: true, remarks: '' };
      const nextP = !cur.isPresent;
      return {
        ...prev,
        [studentId]: {
          ...cur,
          isPresent: nextP,
          marks: nextP ? cur.marks : '',
        },
      };
    });
  };

  // Submit all marks in Bulk Mode
  const handleSaveBulk = async () => {
    if (!form || isClosed) return;

    try {
      setSaving(true);
      setError(null);

      const records = enrollments.map((enr) => {
        const inp = inputMap[enr.studentId] || { marks: '', isPresent: true, remarks: '' };
        return {
          studentId: enr.studentId,
          rollNumber: enr.rollNumber,
          studentName: enr.studentName,
          marksObtained: inp.isPresent && inp.marks !== '' ? Number(inp.marks) : null,
          isPresent: inp.isPresent,
          remarks: inp.remarks,
        };
      });

      await saveBulkMarks(form.id, records, examinerName || 'Public Examiner');

      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadPublicForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Individual Mode Handlers
  const handleSelectStudentIndiv = (enr: FormEnrollment) => {
    setSelectedStudent(enr);
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

  const handleSaveIndiv = async () => {
    if (!form || !selectedStudent || isClosed) return;
    const num = indivMarks !== '' ? Number(indivMarks) : null;

    if (num !== null) {
      if (num > form.maxMarks) {
        alert(`Marks cannot exceed ${form.maxMarks}`);
        return;
      }
      if (num < 0) {
        alert('Marks cannot be negative.');
        return;
      }
      if (!form.allowDecimals && indivMarks.includes('.')) {
        alert('Decimals are not permitted.');
        return;
      }
    }

    try {
      setSaving(true);
      await saveSingleMark({
        practicalFormId: form.id,
        studentId: selectedStudent.studentId,
        rollNumber: selectedStudent.rollNumber,
        studentName: selectedStudent.studentName,
        marksObtained: indivPresent ? num : null,
        isPresent: indivPresent,
        remarks: indivRemarks,
        updatedBy: examinerName || 'Public Examiner (Individual Mode)',
      });

      setInputMap((prev) => ({
        ...prev,
        [selectedStudent.studentId]: {
          marks: indivMarks,
          isPresent: indivPresent,
          remarks: indivRemarks,
        },
      }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      await loadPublicForm();
    } catch (err: any) {
      alert(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Practical Examination Form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Examination Link Inaccessible</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Go to Administration Portal
          </button>
        </div>
      </div>
    );
  }

  // Stats
  let evaluatedCount = 0;
  let absentCount = 0;
  enrollments.forEach((e) => {
    const inp = inputMap[e.studentId];
    if (inp) {
      if (!inp.isPresent) absentCount++;
      else if (inp.marks !== '') evaluatedCount++;
    }
  });

  const filteredEnrollments = enrollments.filter(
    (e) =>
      e.rollNumber.toLowerCase().includes(tableSearch.toLowerCase()) ||
      e.studentName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-12">
      {/* Top Academic Banner */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {collegeName}
              </h1>
              <p className="text-xs text-blue-600 font-medium">
                Official Practical Examination Marks Entry Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSingleFormExcel(form, enrollments, [])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Sheet</span>
            </button>
            <button
              onClick={onExit}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Admin Login
            </button>
          </div>
        </div>
      </header>

      {/* Main Examination Form Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-5">
        {/* Google Forms Style Header Card */}
        <div className="bg-white border-t-8 border-t-blue-600 border-x border-b border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {form.subjectCode}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">
                Date: <strong>{form.examDate}</strong>
              </span>
              {isClosed ? (
                <span className="text-xs font-bold text-rose-600 px-2.5 py-0.5 rounded bg-rose-50 border border-rose-200">
                  Closed
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                  Open for Evaluation
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">{form.title}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Course: <strong className="text-slate-700">{form.course}</strong> • Semester:{' '}
              <strong className="text-slate-700">{form.semester}</strong>
              {form.section && ` (${form.section})`}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Maximum Marks:</span>
              <strong className="text-base text-blue-700 font-mono">{form.maxMarks}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Marks Format:</span>
              <strong className="text-slate-700">
                {form.allowDecimals ? 'Decimals Allowed' : 'Integers Only'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total Candidates:</span>
              <strong className="text-slate-700 font-mono">{enrollments.length} Verified</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Completed / Absent:</span>
              <strong className="text-emerald-700 font-mono">{evaluatedCount} / {absentCount}</strong>
            </div>
          </div>

          {form.instructions && (
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              <strong className="text-blue-900 block mb-1">Examiner Instructions:</strong>
              {form.instructions}
            </div>
          )}

          {/* Examiner Name Field */}
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Evaluating Examiner:
              </span>
              <input
                type="text"
                disabled={isClosed}
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="Dr. S. K. Mukherjee"
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setMode('bulk')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'bulk'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulk Table Entry
              </button>
              <button
                onClick={() => setMode('individual')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'individual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Individual Candidate Search
              </button>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Practical marks have been securely submitted and saved to the college database!
            </span>
          </div>
        )}

        {isClosed && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">
              This practical examination has been closed by College Administration. Marks entries are in read-only mode.
            </span>
          </div>
        )}

        {/* BULK MODE VIEW */}
        {mode === 'bulk' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter by roll number or candidate name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {!isClosed && (
                <button
                  onClick={handleSaveBulk}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{saving ? 'Submitting...' : 'Save & Submit All Marks'}</span>
                </button>
              )}
            </div>

            {/* Candidate Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 w-32">Roll Number</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3 w-28 text-center">Attendance</th>
                    <th className="py-3 px-3 w-36 text-center">
                      Marks (Max: {form.maxMarks})
                    </th>
                    <th className="py-3 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredEnrollments.map((enr, idx) => {
                    const inp = inputMap[enr.studentId] || { marks: '', isPresent: true, remarks: '' };
                    const isPresent = inp.isPresent;

                    return (
                      <tr key={enr.studentId} className={!isPresent ? 'bg-rose-50/40' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {enr.rollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {enr.studentName}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleBulkAttendance(enr.studentId)}
                            className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {isPresent ? 'PRESENT' : 'ABSENT'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isPresent ? (
                            <input
                              type="number"
                              step={form.allowDecimals ? '0.1' : '1'}
                              min={0}
                              max={form.maxMarks}
                              disabled={isClosed}
                              value={inp.marks}
                              onChange={(e) => handleBulkMarkChange(enr.studentId, e.target.value)}
                              placeholder="Empty Box"
                              className="w-28 py-1.5 px-2 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span className="font-mono text-rose-600 font-bold text-xs">
                              ABSENT
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            disabled={isClosed}
                            value={inp.remarks}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInputMap((prev) => ({
                                ...prev,
                                [enr.studentId]: {
                                  ...(prev[enr.studentId] || { marks: '', isPresent: true }),
                                  remarks: val,
                                },
                              }));
                            }}
                            placeholder="Optional examiner remarks"
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isClosed && (
              <div className="flex justify-end pt-3">
                <button
                  onClick={handleSaveBulk}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{saving ? 'Submitting...' : 'Save & Submit All Marks'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* INDIVIDUAL MODE VIEW */}
        {mode === 'individual' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select Candidate
              </h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={indivSearch}
                  onChange={(e) => setIndivSearch(e.target.value)}
                  placeholder="Search Roll No or Name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
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
                    const isSelected = selectedStudent?.studentId === enr.studentId;
                    const mark = inputMap[enr.studentId]?.marks;
                    return (
                      <button
                        key={enr.studentId}
                        onClick={() => handleSelectStudentIndiv(enr)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-bold">{enr.rollNumber}</div>
                          <div className="truncate max-w-[140px]">{enr.studentName}</div>
                        </div>
                        <span className="font-mono text-[11px] opacity-80">
                          {mark !== '' && mark !== undefined ? `${mark} pts` : 'Empty'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              {selectedStudent ? (
                <div className="space-y-5">
                  <div className="pb-4 border-b border-slate-100">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Roll No: {selectedStudent.rollNumber}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-2">
                      {selectedStudent.studentName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Maximum Marks: <strong className="text-blue-700 font-mono">{form.maxMarks}</strong>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                        Attendance
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIndivPresent(true)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            indivPresent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setIndivPresent(false)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            !indivPresent
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>

                    {indivPresent ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          Marks Obtained (Max {form.maxMarks})
                        </label>
                        <input
                          type="number"
                          step={form.allowDecimals ? '0.1' : '1'}
                          min={0}
                          max={form.maxMarks}
                          disabled={isClosed}
                          value={indivMarks}
                          onChange={(e) => setIndivMarks(e.target.value)}
                          placeholder="Empty Marks Box"
                          className="w-48 py-2 px-3 text-lg font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 text-center"
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                        Candidate marked absent. No marks will be awarded.
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                        Examiner Remarks
                      </label>
                      <input
                        type="text"
                        disabled={isClosed}
                        value={indivRemarks}
                        onChange={(e) => setIndivRemarks(e.target.value)}
                        placeholder="e.g. Completed viva"
                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {!isClosed && (
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleSaveIndiv}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 disabled:opacity-50 transition-all"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save Student Marks'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <Search className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-medium">Select a student on the left to enter marks</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
