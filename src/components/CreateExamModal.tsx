import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  Building,
  GraduationCap,
  Layers,
  Award,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { PracticalExam, RubricCriterion } from '../types';
import { createPracticalExam } from '../services/examService';

interface CreateExamModalProps {
  onClose: () => void;
  onExamCreated: (newExamId: string) => void;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  onClose,
  onExamCreated,
}) => {
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('B.Sc. Computer Science');
  const [semester, setSemester] = useState('Semester V');
  const [subjectCode, setSubjectCode] = useState('');
  const [academicYear, setAcademicYear] = useState('2024-2025');
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [venue, setVenue] = useState('Advanced Computing Lab 02');
  const [maxMarks, setMaxMarks] = useState(50);
  const [passingMarks, setPassingMarks] = useState(20);
  const [internalExaminerName, setInternalExaminerName] = useState('Prof. A. K. Verma');
  const [externalExaminerName, setExternalExaminerName] = useState('Dr. S. Mukherjee (External)');

  // Dynamic rubric criteria
  const [criteria, setCriteria] = useState<RubricCriterion[]>([
    { id: 'crit_1', name: 'Practical Execution & Output', maxMarks: 25, description: 'Correct program logic and terminal output' },
    { id: 'crit_2', name: 'Viva Voce & Technical Defense', maxMarks: 15, description: 'Concept clarity and defense of solutions' },
    { id: 'crit_3', name: 'Lab Journal & Continuous Record', maxMarks: 10, description: 'Verified record file and attendance' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criteriaTotal = criteria.reduce((sum, c) => sum + Number(c.maxMarks || 0), 0);
  const totalMatches = criteriaTotal === Number(maxMarks);

  const addCriterion = () => {
    const newId = `crit_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setCriteria([...criteria, { id: newId, name: 'New Criterion', maxMarks: 5 }]);
  };

  const removeCriterion = (id: string) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  const updateCriterion = (id: string, field: 'name' | 'maxMarks', value: string | number) => {
    setCriteria(
      criteria.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !subjectCode.trim()) {
      setError('Subject title and course code are required.');
      return;
    }

    if (!totalMatches) {
      setError(`Rubric criteria sum (${criteriaTotal}) must match total Maximum Marks (${maxMarks}).`);
      return;
    }

    if (passingMarks > maxMarks) {
      setError('Passing marks cannot exceed maximum marks.');
      return;
    }

    try {
      setLoading(true);
      // Generate secure unique access key for external examiner portal
      const accessKey = `eval_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;

      const examId = await createPracticalExam({
        title: title.trim(),
        course,
        semester,
        subjectCode: subjectCode.trim().toUpperCase(),
        academicYear,
        examDate,
        venue: venue.trim(),
        maxMarks: Number(maxMarks),
        passingMarks: Number(passingMarks),
        rubricCriteria: criteria,
        status: 'open',
        accessKey,
        internalExaminerName: internalExaminerName.trim(),
        externalExaminerName: externalExaminerName.trim(),
        studentCount: 0,
      });

      onExamCreated(examId);
    } catch (err: any) {
      setError(err.message || 'Failed to create practical examination');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            Create Practical Examination Session
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure examination schedule, syllabus subject code, and evaluation rubric criteria.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Subject Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Practical Exam Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms Lab"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Subject Code
              </label>
              <input
                type="text"
                required
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="CS501P"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono uppercase"
              />
            </div>
          </div>

          {/* Course, Semester, Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Course / Degree
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="B.Sc. Computer Science">B.Sc. Computer Science</option>
                <option value="Bachelor of Computer Applications (BCA)">BCA</option>
                <option value="B.Sc. Information Technology">B.Sc. IT</option>
                <option value="B.Tech Computer Science">B.Tech CSE</option>
                <option value="M.Sc. Computer Science">M.Sc. CS</option>
                <option value="B.Sc. Physics Practical">B.Sc. Physics</option>
                <option value="B.Sc. Chemistry Practical">B.Sc. Chemistry</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Semester I">Semester I</option>
                <option value="Semester II">Semester II</option>
                <option value="Semester III">Semester III</option>
                <option value="Semester IV">Semester IV</option>
                <option value="Semester V">Semester V</option>
                <option value="Semester VI">Semester VI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2024-2025"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Date & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Exam Date
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Lab Venue / Room
              </label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Lab 2, Computer Block"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Examiners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Internal Examiner Name
              </label>
              <input
                type="text"
                value={internalExaminerName}
                onChange={(e) => setInternalExaminerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                External Examiner Name
              </label>
              <input
                type="text"
                value={externalExaminerName}
                onChange={(e) => setExternalExaminerName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Marks & Passing Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Total Maximum Marks
              </label>
              <input
                type="number"
                min={10}
                max={500}
                required
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Minimum Passing Marks
              </label>
              <input
                type="number"
                min={1}
                max={maxMarks}
                required
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Rubric Criteria Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Rubric Evaluation Breakdown Criteria
              </label>
              <button
                type="button"
                onClick={addCriterion}
                className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Criterion
              </button>
            </div>

            <div className="space-y-2">
              {criteria.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800"
                >
                  <span className="text-xs font-mono text-slate-500 w-5 text-center">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    required
                    value={c.name}
                    onChange={(e) => updateCriterion(c.id, 'name', e.target.value)}
                    placeholder="Criterion title"
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Max:</span>
                    <input
                      type="number"
                      min={1}
                      max={maxMarks}
                      required
                      value={c.maxMarks}
                      onChange={(e) =>
                        updateCriterion(c.id, 'maxMarks', Number(e.target.value))
                      }
                      className="w-16 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono text-center focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(c.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Rubric Total Check */}
            <div className="mt-2 flex items-center justify-between text-xs px-2">
              <span className="text-slate-400">
                Criteria Sum: <strong className="font-mono text-slate-200">{criteriaTotal}</strong> / {maxMarks}
              </span>
              {totalMatches ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Criteria total matches max marks
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  Difference: {maxMarks - criteriaTotal > 0 ? `+${maxMarks - criteriaTotal}` : maxMarks - criteriaTotal} marks
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !totalMatches}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Create Examination</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
