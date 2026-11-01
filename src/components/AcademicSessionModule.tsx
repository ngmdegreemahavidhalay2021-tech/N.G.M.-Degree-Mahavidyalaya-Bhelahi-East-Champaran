import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit2,
  Save,
  X,
  Database,
} from 'lucide-react';
import { AcademicSession } from '../types';
import {
  getAcademicSessions,
  createAcademicSession,
  updateAcademicSession,
  deleteAcademicSession,
} from '../services/collegeService';

export const AcademicSessionModule: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit modal
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const list = await getAcademicSessions();
      setSessions(list || []);
    } catch (err: any) {
      setErrorMessage('Failed to load academic sessions from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const clean = newSessionName.trim();
    if (!clean) {
      setErrorMessage('Please enter an academic session name.');
      return;
    }

    // Check duplicate
    if (sessions.some((s) => s.sessionName.toLowerCase() === clean.toLowerCase())) {
      setErrorMessage(`Academic session "${clean}" already exists.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createAcademicSession(clean);
      setSuccessMessage(`Academic session "${clean}" created and saved to Firestore!`);
      setNewSessionName('');
      setShowAddModal(false);
      await loadSessions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating academic session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (session: AcademicSession) => {
    try {
      await updateAcademicSession(session.id, { isActive: !session.isActive });
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, isActive: !s.isActive } : s))
      );
      setSuccessMessage(
        `Session ${session.sessionName} is now ${!session.isActive ? 'Active' : 'Inactive'}.`
      );
    } catch (err: any) {
      setErrorMessage('Failed to update session status.');
    }
  };

  const handleStartEdit = (session: AcademicSession) => {
    setEditingSession(session);
    setEditName(session.sessionName);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    const clean = editName.trim();
    if (!clean) return;

    try {
      setIsSubmitting(true);
      await updateAcademicSession(editingSession.id, { sessionName: clean });
      setSuccessMessage(`Session renamed to "${clean}" successfully in Firestore.`);
      setEditingSession(null);
      await loadSessions();
    } catch (err: any) {
      setErrorMessage('Failed to rename session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (session: AcademicSession) => {
    // Initial 4 sessions protection
    const initialFour = ['2023-27', '2024-28', '2025-29', '2026-30'];
    if (initialFour.includes(session.sessionName)) {
      if (!window.confirm(`Warning: "${session.sessionName}" is a primary foundational session. Are you sure you wish to delete it?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete session "${session.sessionName}"?`)) {
        return;
      }
    }

    try {
      await deleteAcademicSession(session.id);
      setSuccessMessage(`Session "${session.sessionName}" deleted.`);
      await loadSessions();
    } catch (err: any) {
      setErrorMessage('Failed to delete session.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Academic Session Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>Authoritative Firestore</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure current and future 4-year degree academic sessions (e.g. 2023-27, 2024-28, 2025-29, 2026-30, and future batches).
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
          <span>Add Academic Session</span>
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

      {/* Sessions Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Loading academic sessions from Firestore...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">No Academic Sessions Found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Click below to initialize foundational sessions.</p>
          <button
            onClick={loadSessions}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
          >
            Initialize Sessions
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sessions.map((sess) => {
            const isInitial = ['2023-27', '2024-28', '2025-29', '2026-30'].includes(sess.sessionName);
            return (
              <div
                key={sess.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Calendar className="w-5 h-5" />
                    </span>
                    <button
                      onClick={() => handleToggleActive(sess)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition ${
                        sess.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Click to toggle session active/inactive status"
                    >
                      {sess.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span>{sess.isActive ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white font-mono">{sess.sessionName}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Degree Batch: 4-Year CBCS</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {isInitial ? (
                    <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                      Preserved
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      Future
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(sess)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                      title="Edit session name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sess)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Add Future Academic Session</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSession} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Session Name / Academic Span
                </label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. 2027-31, 2028-32"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Standard format is <span className="font-mono text-blue-400">YYYY-YY</span> (e.g., 2027-31 for 4-year degree course).
                </p>
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
                  {isSubmitting ? 'Saving to Firestore...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Edit Academic Session</h3>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  autoFocus
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
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
