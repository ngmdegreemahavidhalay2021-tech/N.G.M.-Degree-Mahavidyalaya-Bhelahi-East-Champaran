import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  GraduationCap,
  Award,
  AlertCircle,
  Clock,
  Send,
  Download,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PracticalExam, ExamStudent } from '../types';
import { getPracticalExamById, getExamStudents, batchSaveStudents, updatePracticalExam } from '../services/examService';
import { exportExamMarksToExcel } from '../lib/excelExport';

interface ExaminerPortalProps {
  examId: string;
  accessKey?: string;
  onExit: () => void;
}

export const ExaminerPortal: React.FC<ExaminerPortalProps> = ({
  examId,
  accessKey,
  onExit,
}) => {
  const [exam, setExam] = useState<PracticalExam | null>(null);
  const [students, setStudents] = useState<ExamStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExamData();
  }, [examId]);

  const loadExamData = async () => {
    try {
      setLoading(true);
      setError(null);
      const examData = await getPracticalExamById(examId);
      if (!examData) {
        setError('Practical Examination record not found.');
        return;
      }

      // Check key match if key was provided
      if (accessKey && examData.accessKey && examData.accessKey !== accessKey) {
        setError('Invalid or expired examiner evaluation link.');
        return;
      }

      setExam(examData);
      const studentList = await getExamStudents(examId);
      setStudents(studentList);
    } catch (err: any) {
      setError(err.message || 'Failed to load evaluation portal');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = exam?.status === 'locked';

  const handleMarkChange = (
    studentId: string,
    criterionId: string,
    rawValue: string,
    maxVal: number
  ) => {
    if (isLocked) return;
    let num = rawValue === '' ? 0 : Number(rawValue);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > maxVal) num = maxVal;

    setStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;
        const newCriteria = {
          ...(student.criteriaMarks || {}),
          [criterionId]: num,
        };
        const total: number = Object.values(newCriteria).reduce((a: number, b) => a + Number(b || 0), 0);
        const percentage = exam && exam.maxMarks > 0 ? (total / exam.maxMarks) * 100 : 0;
        const status = exam && total >= exam.passingMarks ? 'pass' : 'fail';
        return {
          ...student,
          criteriaMarks: newCriteria,
          totalMarks: total,
          percentage,
          status,
        };
      })
    );
  };

  const handleAttendance = (studentId: string) => {
    if (isLocked) return;
    setStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;
        const nextAtt = student.attendance === 'present' ? 'absent' : 'present';
        if (nextAtt === 'absent') {
          return {
            ...student,
            attendance: 'absent',
            totalMarks: 0,
            percentage: 0,
            status: 'absent',
          };
        } else {
          const total: number = Object.values(student.criteriaMarks || {}).reduce((a: number, b) => a + Number(b || 0), 0);
          return {
            ...student,
            attendance: 'present',
            totalMarks: total,
            percentage: exam && exam.maxMarks > 0 ? (total / exam.maxMarks) * 100 : 0,
            status: exam && total >= exam.passingMarks ? 'pass' : 'fail',
          };
        }
      })
    );
  };

  const handleSubmitEvaluation = async () => {
    if (!exam) return;
    try {
      setSubmitting(true);
      setError(null);
      await batchSaveStudents(exam.id, students);
      await updatePracticalExam(exam.id, {
        status: 'submitted',
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSubmittedSuccess(true);
      await loadExamData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit marks evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading Examiner Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-100">Unable to Access Portal</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {error || 'This evaluation link may have expired or the examination ID is invalid.'}
        </p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Live stats
  let presentCount = 0;
  let passCount = 0;
  students.forEach((s) => {
    if (s.attendance === 'present') {
      presentCount++;
      if (s.status === 'pass') passCount++;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {exam.subjectCode}
                </span>
                <span className="text-xs text-slate-400">
                  Official Examiner Evaluation Form
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5">
                {exam.title}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {exam.course} • {exam.semester} • Venue: {exam.venue} • Date: {exam.examDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportExamMarksToExcel(exam, students)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            {!isLocked && (
              <button
                onClick={handleSubmitEvaluation}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit Final Marks'}</span>
              </button>
            )}

            <button
              onClick={onExit}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-500">Max Marks:</span>{' '}
            <strong className="text-slate-200 font-mono">{exam.maxMarks}</strong>
          </div>
          <div>
            <span className="text-slate-500">Passing Threshold:</span>{' '}
            <strong className="text-emerald-400 font-mono">{exam.passingMarks}</strong>
          </div>
          <div>
            <span className="text-slate-500">Candidates Present:</span>{' '}
            <strong className="text-slate-200 font-mono">{presentCount} / {students.length}</strong>
          </div>
          <div>
            <span className="text-slate-500">Evaluation State:</span>{' '}
            <strong className={isLocked ? 'text-rose-400' : 'text-emerald-400'}>
              {isLocked ? 'LOCKED / VERIFIED' : exam.status.toUpperCase()}
            </strong>
          </div>
        </div>
      </div>

      {submittedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Marks successfully submitted to examination records!</span>
          </div>
          <button
            onClick={() => exportExamMarksToExcel(exam, students)}
            className="underline font-semibold text-emerald-200 hover:text-emerald-100"
          >
            Download Signed Copy (.xlsx)
          </button>
        </div>
      )}

      {/* Roster & Marks Evaluation Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Candidate Marks Evaluation & Rubric Scores
          </h3>
          <span className="text-xs text-slate-400">
            {students.length} Enrolled Candidates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 w-28">Roll No</th>
                <th className="py-3 px-3">Candidate Name</th>
                <th className="py-3 px-3 w-24 text-center">Attendance</th>
                {exam.rubricCriteria.map((c: any) => (
                  <th key={c.id} className="py-3 px-3 text-center min-w-[110px]">
                    <div>{c.name}</div>
                    <span className="text-[10px] font-mono text-emerald-400 normal-case">
                      (Max {c.maxMarks})
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3 w-24 text-center">Total (/{exam.maxMarks})</th>
                <th className="py-3 px-3 w-20 text-center">Result</th>
                <th className="py-3 px-3 min-w-[140px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {students.map((student, idx) => {
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
                        onClick={() => handleAttendance(student.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                          isPresent
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isPresent ? 'P' : 'AB'}
                      </button>
                    </td>

                    {/* Rubric criteria */}
                    {exam.rubricCriteria.map((c: any) => {
                      const mark = student.criteriaMarks?.[c.id];
                      return (
                        <td key={c.id} className="py-2.5 px-3 text-center">
                          {isPresent ? (
                            <input
                              type="number"
                              min={0}
                              max={c.maxMarks}
                              disabled={isLocked}
                              value={mark !== undefined && mark !== null ? mark : ''}
                              onChange={(e) =>
                                handleMarkChange(student.id, c.id, e.target.value, c.maxMarks)
                              }
                              placeholder="0"
                              className="w-16 py-1 px-1.5 text-center font-mono text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <span className="font-mono text-rose-400 font-semibold">AB</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 text-center font-mono font-bold text-sm">
                      {isPresent ? (
                        <span className={student.totalMarks >= exam.passingMarks ? 'text-emerald-400' : 'text-rose-400'}>
                          {student.totalMarks}
                        </span>
                      ) : (
                        <span className="text-rose-400">0</span>
                      )}
                    </td>

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

                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={student.remarks || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStudents((prev) =>
                            prev.map((s) => (s.id === student.id ? { ...s, remarks: val } : s))
                          );
                        }}
                        placeholder="Remarks"
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
