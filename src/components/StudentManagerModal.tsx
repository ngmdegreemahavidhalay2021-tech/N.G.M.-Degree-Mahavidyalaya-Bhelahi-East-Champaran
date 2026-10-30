import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  CheckCircle,
  AlertCircle,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { ExamStudent, PracticalExam } from '../types';
import { batchSaveStudents } from '../services/examService';

interface StudentManagerModalProps {
  exam: PracticalExam;
  existingStudents: ExamStudent[];
  onClose: () => void;
  onStudentsUpdated: () => void;
}

export const StudentManagerModal: React.FC<StudentManagerModalProps> = ({
  exam,
  existingStudents,
  onClose,
  onStudentsUpdated,
}) => {
  const [tab, setTab] = useState<'single' | 'bulk'>('bulk');
  // Single student form
  const [rollNo, setRollNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [batch, setBatch] = useState('Batch A');

  // Bulk paste text area
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rollNo.trim() || !studentName.trim()) {
      setError('Roll number and candidate name are required.');
      return;
    }

    const studentId = `std_${rollNo.trim().replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const newStudent: ExamStudent = {
      id: studentId,
      examId: exam.id,
      rollNo: rollNo.trim(),
      regNo: regNo.trim() || undefined,
      studentName: studentName.trim(),
      batch: batch.trim(),
      attendance: 'present',
      criteriaMarks: {},
      totalMarks: 0,
      percentage: 0,
      status: 'pending',
    };

    try {
      setLoading(true);
      await batchSaveStudents(exam.id, [...existingStudents, newStudent]);
      setRollNo('');
      setStudentName('');
      setRegNo('');
      onStudentsUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    setError(null);
    if (!bulkText.trim()) {
      setError('Please paste student records (one per line).');
      return;
    }

    // Format: RollNo, Name, Batch, RegNo OR RollNo \t Name
    const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
    const parsedStudents: ExamStudent[] = [];

    lines.forEach((line, index) => {
      // Split by tab or comma
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.split(',').map((p) => p.trim());

      const rNo = parts[0] || `ROLL_${index + 1}`;
      const name = parts[1] || `Candidate ${index + 1}`;
      const bch = parts[2] || 'Batch A';
      const reg = parts[3] || undefined;

      parsedStudents.push({
        id: `std_${rNo.replace(/[^a-zA-Z0-9]/g, '_')}_${index}`,
        examId: exam.id,
        rollNo: rNo,
        regNo: reg,
        studentName: name,
        batch: bch,
        attendance: 'present',
        criteriaMarks: {},
        totalMarks: 0,
        percentage: 0,
        status: 'pending',
      });
    });

    try {
      setLoading(true);
      await batchSaveStudents(exam.id, [...existingStudents, ...parsedStudents]);
      onStudentsUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save imported student records');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSampleStudents = () => {
    const sampleBatch = [
      '24CS001, Aarav Sharma, Batch A, PRN2024001',
      '24CS002, Priya Patel, Batch A, PRN2024002',
      '24CS003, Rohan Iyer, Batch A, PRN2024003',
      '24CS004, Ananya Roy, Batch A, PRN2024004',
      '24CS005, Vikram Singh, Batch B, PRN2024005',
      '24CS006, Neha Kulkarni, Batch B, PRN2024006',
      '24CS007, Rahul Nair, Batch B, PRN2024007',
      '24CS008, Tanvi Deshmukh, Batch B, PRN2024008',
      '24CS009, Siddharth Gupta, Batch B, PRN2024009',
      '24CS010, Meera Joshi, Batch B, PRN2024010',
    ].join('\n');
    setBulkText(sampleBatch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 my-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Candidate Roster Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enrol students for <strong>{exam.title} ({exam.subjectCode})</strong>.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switch */}
        <div className="flex border-b border-slate-800 mb-4">
          <button
            onClick={() => setTab('bulk')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'bulk'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Batch / CSV Import</span>
          </button>
          <button
            onClick={() => setTab('single')}
            className={`py-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'single'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Single Candidate</span>
          </button>
        </div>

        {tab === 'bulk' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Paste student lines: <code className="text-slate-300 font-mono">RollNo, Name, Batch, PRN</code>
              </span>
              <button
                type="button"
                onClick={handleGenerateSampleStudents}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" /> Load Sample Roster (10 Students)
              </button>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="24CS001, Aarav Sharma, Batch A, PRN2024001&#10;24CS002, Priya Patel, Batch A, PRN2024002"
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Currently enrolled in this exam: <strong className="text-slate-200">{existingStudents.length}</strong></span>
              <span>Lines entered: <strong className="text-indigo-300">{bulkText.split('\n').filter(l => l.trim().length > 0).length}</strong></span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={loading || !bulkText.trim()}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? 'Importing...' : 'Save & Import Candidates'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddSingle} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="24CS011"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Registration / PRN No
                </label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="PRN2024011"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Candidate Name *
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Rishi Kapoor"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Practical Batch / Group
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="Batch A"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Adding...' : 'Add Candidate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
