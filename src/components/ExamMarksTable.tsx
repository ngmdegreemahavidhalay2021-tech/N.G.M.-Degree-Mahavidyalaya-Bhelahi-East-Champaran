import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Save,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { PracticalExam, ExamStudent } from '../types';
import { saveStudentEvaluation, batchSaveStudents, updatePracticalExam } from '../services/examService';
import { exportExamMarksToExcel, exportExamMarksToCSV } from '../lib/excelExport';

interface ExamMarksTableProps {
  exam: PracticalExam;
  students: ExamStudent[];
  isAdmin: boolean;
  onRefresh: () => void;
  onOpenStudentManager: () => void;
}

export const ExamMarksTable: React.FC<ExamMarksTableProps> = ({
  exam,
  students,
  isAdmin,
  onRefresh,
  onOpenStudentManager,
}) => {
  const [localStudents, setLocalStudents] = useState<ExamStudent[]>(students);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  const isLocked = exam.status === 'locked';

  // Calculate live statistics
  let presentCount = 0;
  let passCount = 0;
  let failCount = 0;
  let totalScoreSum = 0;

  localStudents.forEach((s) => {
    if (s.attendance === 'present') {
      presentCount++;
      totalScoreSum += s.totalMarks;
      if (s.status === 'pass') passCount++;
      else if (s.status === 'fail') failCount++;
    }
  });

  const absentCount = localStudents.length - presentCount;
  const avgMarks = presentCount > 0 ? (totalScoreSum / presentCount).toFixed(1) : '0';
  const passRate = presentCount > 0 ? ((passCount / presentCount) * 100).toFixed(1) : '0';

  // Handle criterion mark change
  const handleMarkChange = (
    studentId: string,
    criterionId: string,
    rawValue: string,
    criterionMax: number
  ) => {
    if (isLocked) return;

    let numVal = rawValue === '' ? 0 : Number(rawValue);
    if (isNaN(numVal)) numVal = 0;
    if (numVal < 0) numVal = 0;
    if (numVal > criterionMax) numVal = criterionMax;

    setLocalStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;

        const updatedCriteria = {
          ...(student.criteriaMarks || {}),
          [criterionId]: numVal,
        };

        // Recalculate total
        const newTotal: number = Object.values(updatedCriteria).reduce((a: number, b) => a + Number(b || 0), 0);
        const percentage = exam.maxMarks > 0 ? (newTotal / exam.maxMarks) * 100 : 0;
        const newStatus = newTotal >= exam.passingMarks ? 'pass' : 'fail';

        return {
          ...student,
          criteriaMarks: updatedCriteria,
          totalMarks: newTotal,
          percentage,
          status: newStatus,
        };
      })
    );
  };

  // Toggle Attendance
  const handleAttendanceToggle = (studentId: string) => {
    if (isLocked) return;

    setLocalStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;

        const newAttendance = student.attendance === 'present' ? 'absent' : 'present';
        if (newAttendance === 'absent') {
          return {
            ...student,
            attendance: 'absent',
            totalMarks: 0,
            percentage: 0,
            status: 'absent',
          };
        } else {
          // Recalculate based on existing marks
          const total: number = Object.values(student.criteriaMarks || {}).reduce((a: number, b) => a + Number(b || 0), 0);
          return {
            ...student,
            attendance: 'present',
            totalMarks: total,
            percentage: exam.maxMarks > 0 ? (total / exam.maxMarks) * 100 : 0,
            status: total >= exam.passingMarks ? 'pass' : 'fail',
          };
        }
      })
    );
  };

  // Remarks update
  const handleRemarksChange = (studentId: string, text: string) => {
    if (isLocked) return;
    setLocalStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, remarks: text } : s))
    );
  };

  // Save all marks to Firestore
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError(null);
      await batchSaveStudents(exam.id, localStudents);

      // If exam was in draft or open, ensure marked as submitted if all students evaluated
      if (exam.status === 'open') {
        await updatePracticalExam(exam.id, {
          status: 'submitted',
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Lock / Unlock exam
  const handleToggleLock = async () => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const newStatus = isLocked ? 'open' : 'locked';
      await updatePracticalExam(exam.id, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update lock state');
    } finally {
      setSaving(false);
    }
  };

  // Filter students
  const filteredStudents = localStudents.filter((s) => {
    const matchesSearch =
      s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.regNo && s.regNo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBatch = batchFilter === 'ALL' || s.batch === batchFilter;
    return matchesSearch && matchesBatch;
  });

  const batches = Array.from(new Set(localStudents.map((s) => s.batch || 'Batch A')));

  return (
    <div className="space-y-4">
      {/* Top Banner with Stats & Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                {exam.subjectCode}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">{exam.title}</h2>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                  <Lock className="w-3 h-3" /> Locked & Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <Unlock className="w-3 h-3" /> Entry Open
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400 mt-1">
              <span>{exam.course} • {exam.semester}</span>
              <span>Venue: <strong className="text-slate-300">{exam.venue}</strong></span>
              <span>Date: <strong className="text-slate-300">{exam.examDate}</strong></span>
              <span>Max: <strong className="text-amber-400">{exam.maxMarks}</strong> | Pass: <strong className="text-emerald-400">{exam.passingMarks}</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportExamMarksToExcel(exam, localStudents)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors shadow-sm"
              title="Download official formatted Excel marksheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => exportExamMarksToCSV(exam, localStudents)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Download CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={onOpenStudentManager}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Enrol Candidates</span>
                </button>

                <button
                  onClick={handleToggleLock}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    isLocked
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                  }`}
                  title={isLocked ? 'Unlock exam to permit marks editing' : 'Lock exam to freeze and prevent changes'}
                >
                  {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isLocked ? 'Unlock Marks' : 'Freeze / Lock Marks'}</span>
                </button>
              </>
            )}

            {!isLocked && (
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Marks'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Evaluation Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4 pt-4 border-t border-slate-800 text-center">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-500">Enrolled</span>
            <p className="text-base font-bold text-slate-200">{localStudents.length}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-emerald-400">Present</span>
            <p className="text-base font-bold text-emerald-300">{presentCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-rose-400">Absent</span>
            <p className="text-base font-bold text-rose-300">{absentCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-indigo-400">Passed</span>
            <p className="text-base font-bold text-indigo-300">{passCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-amber-400">Pass Rate</span>
            <p className="text-base font-bold text-amber-300">{passRate}%</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400">Avg Marks</span>
            <p className="text-base font-bold text-slate-200">{avgMarks}</p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Evaluation marks saved successfully to Firestore database.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search roll no or candidate name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {batches.length > 1 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 whitespace-nowrap">Filter Batch:</span>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Marks Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 w-28">Roll No</th>
                <th className="py-3 px-3 min-w-[140px]">Candidate Name</th>
                <th className="py-3 px-3 w-24 text-center">Attendance</th>
                {exam.rubricCriteria.map((c: any) => (
                  <th key={c.id} className="py-3 px-3 text-center min-w-[110px]">
                    <div>{c.name}</div>
                    <span className="text-[10px] font-mono text-indigo-400 normal-case">
                      (Max {c.maxMarks})
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3 w-24 text-center">
                  Total (/{exam.maxMarks})
                </th>
                <th className="py-3 px-3 w-20 text-center">Result</th>
                <th className="py-3 px-3 min-w-[140px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6 + exam.rubricCriteria.length}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="max-w-xs mx-auto space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-sm font-medium">No candidates enrolled yet</p>
                      <p className="text-xs text-slate-500">
                        Add student roll numbers to begin marks evaluation.
                      </p>
                      {isAdmin && (
                        <button
                          onClick={onOpenStudentManager}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" /> Enrol Students Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const isPresent = student.attendance === 'present';
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !isPresent ? 'bg-rose-950/10 opacity-70' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                        {student.rollNo}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200">{student.studentName}</div>
                        {student.regNo && (
                          <div className="text-[10px] font-mono text-slate-500">{student.regNo}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleAttendanceToggle(student.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                            isPresent
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                          } ${isLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {isPresent ? 'P' : 'AB'}
                        </button>
                      </td>

                      {/* Criteria inputs */}
                      {exam.rubricCriteria.map((c: any) => {
                        const markVal = student.criteriaMarks?.[c.id];
                        return (
                          <td key={c.id} className="py-2.5 px-3 text-center">
                            {isPresent ? (
                              <input
                                type="number"
                                min={0}
                                max={c.maxMarks}
                                disabled={isLocked}
                                value={markVal !== undefined && markVal !== null ? markVal : ''}
                                onChange={(e) =>
                                  handleMarkChange(student.id, c.id, e.target.value, c.maxMarks)
                                }
                                placeholder="0"
                                className="w-16 py-1 px-1.5 text-center font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 disabled:bg-slate-900 disabled:text-slate-400"
                              />
                            ) : (
                              <span className="text-rose-400/80 font-mono text-xs font-semibold">
                                AB
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-sm">
                        {isPresent ? (
                          <span className={student.totalMarks >= exam.passingMarks ? 'text-emerald-400' : 'text-rose-400'}>
                            {student.totalMarks}
                          </span>
                        ) : (
                          <span className="text-rose-400">0</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        {isPresent ? (
                          student.status === 'pass' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              PASS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              FAIL
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-rose-400 border border-slate-700">
                            ABSENT
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={student.remarks || ''}
                          onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                          placeholder="e.g. Good viva"
                          className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-900"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
