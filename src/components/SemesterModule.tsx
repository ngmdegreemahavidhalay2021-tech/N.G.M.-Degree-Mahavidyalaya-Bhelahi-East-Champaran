import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit2,
  X,
  Database,
  ArrowUpDown,
} from 'lucide-react';
import { AcademicSemester } from '../types';
import {
  getAcademicSemesters,
  createAcademicSemester,
  updateAcademicSemester,
  deleteAcademicSemester,
} from '../services/collegeService';

export const SemesterModule: React.FC = () => {
  const [semesters, setSemesters] = useState<AcademicSemester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newOrder, setNewOrder] = useState<number>(9);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit state
  const [editingSemester, setEditingSemester] = useState<AcademicSemester | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrder, setEditOrder] = useState<number>(1);

  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    try {
      setLoading(true);
      const list = await getAcademicSemesters();
      setSemesters(list || []);
      if (list && list.length > 0) {
        setNewOrder(list.length + 1);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load semesters from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = newSemesterName.trim();
    if (!clean) {
      setErrorMessage('Please enter a semester name.');
      return;
    }

    if (semesters.some((s) => s.semesterName.toLowerCase() === clean.toLowerCase())) {
      setErrorMessage(`Semester "${clean}" already exists.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await createAcademicSemester(clean, Number(newOrder) || semesters.length + 1);
      setSuccessMessage(`Semester "${clean}" successfully added to Firestore!`);
      setNewSemesterName('');
      setShowAddModal(false);
      await loadSemesters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating semester.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (semester: AcademicSemester) => {
    try {
      await updateAcademicSemester(semester.id, { isActive: !semester.isActive });
      setSemesters((prev) =>
        prev.map((s) => (s.id === semester.id ? { ...s, isActive: !s.isActive } : s))
      );
      setSuccessMessage(
        `${semester.semesterName} is now ${!semester.isActive ? 'Active' : 'Inactive'}.`
      );
    } catch (err: any) {
      setErrorMessage('Failed to update semester status.');
    }
  };

  const handleStartEdit = (semester: AcademicSemester) => {
    setEditingSemester(semester);
    setEditName(semester.semesterName);
    setEditOrder(semester.order || 1);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSemester) return;
    const clean = editName.trim();
    if (!clean) return;

    try {
      setIsSubmitting(true);
      await updateAcademicSemester(editingSemester.id, {
        semesterName: clean,
        order: Number(editOrder),
      });
      setSuccessMessage(`Semester updated to "${clean}" successfully.`);
      setEditingSemester(null);
      await loadSemesters();
    } catch (err: any) {
      setErrorMessage('Failed to update semester.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (semester: AcademicSemester) => {
    if (!window.confirm(`Are you sure you want to delete semester "${semester.semesterName}"?`)) {
      return;
    }

    try {
      await deleteAcademicSemester(semester.id);
      setSuccessMessage(`Semester "${semester.semesterName}" deleted.`);
      await loadSemesters();
    } catch (err: any) {
      setErrorMessage('Failed to delete semester.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Academic Semester Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>Firestore Collection</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage 8 standard degree semesters (Semester 1 - Semester 8) and configure additional future academic terms.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Semester / Term</span>
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Semesters Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading academic semesters from Firestore...</p>
        </div>
      ) : semesters.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">No Semesters Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Click below to auto-populate Semester 1 to Semester 8.</p>
          <button
            onClick={loadSemesters}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
          >
            Initialize 8 Semesters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {semesters.map((sem) => (
            <div
              key={sem.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs">
                    {sem.order || '#'}
                  </span>
                  <button
                    onClick={() => handleToggleActive(sem)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition ${
                      sem.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {sem.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{sem.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                <h3 className="text-base font-bold text-white tracking-tight">{sem.semesterName}</h3>
                <p className="text-[11px] text-slate-400 mt-1">Display Order: #{sem.order || 1}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
                  CBCS Term
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(sem)}
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                    title="Edit semester"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(sem)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Delete semester"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Semester Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add Academic Semester</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSemester} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Semester Name
                </label>
                <input
                  type="text"
                  required
                  value={newSemesterName}
                  onChange={(e) => setNewSemesterName(e.target.value)}
                  placeholder="e.g. Semester 9, Supplementary Term"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newOrder}
                  onChange={(e) => setNewOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Firestore...' : 'Create Semester'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Semester Modal */}
      {editingSemester && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Edit Academic Semester</h3>
              <button
                onClick={() => setEditingSemester(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Semester Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editOrder}
                  onChange={(e) => setEditOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSemester(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
