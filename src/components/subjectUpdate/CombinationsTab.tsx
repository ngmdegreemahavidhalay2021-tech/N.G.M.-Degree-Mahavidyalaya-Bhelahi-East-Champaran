import React, { useMemo, useState } from 'react';
import { Edit3, Layers, Plus, Save, Search, Trash2, X } from 'lucide-react';
import {
  SubjectUpdateCategory,
  SubjectUpdateCombination,
  SubjectUpdateItem,
  SubjectUpdateSemester,
  SubjectUpdateSession,
} from '../../types';
import {
  CombinationPayload,
  createSubjectUpdateCombination,
  updateSubjectUpdateCombination,
} from '../../services/subjectUpdateSystemService';

interface CombinationsTabProps {
  combinations: SubjectUpdateCombination[];
  subjects: SubjectUpdateItem[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  categories: SubjectUpdateCategory[];
  defaultSession: string;
  defaultCategory: string;
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onRequestDelete: (id: string, label: string) => void;
}

export const CombinationsTab: React.FC<CombinationsTabProps> = ({
  combinations,
  subjects,
  sessions,
  semesters,
  categories,
  defaultSession,
  defaultCategory,
  onRefresh,
  onNotify,
  onRequestDelete,
}) => {
  const [search, setSearch] = useState('');
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCount, setFilterCount] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectUpdateCombination | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAllSubjectsInModal, setShowAllSubjectsInModal] = useState(false);

  const [form, setForm] = useState<CombinationPayload>({
    combinationCode: '',
    combinationName: '',
    session: defaultSession || sessions[0]?.sessionName || '2024-28',
    semester: semesters[0]?.semesterName || 'Semester 1',
    category: defaultCategory || categories[0]?.code || 'MJC',
    subjectCount: 3,
    subjectIds: [],
    notes: '',
    isActive: true,
  });

  const filteredCombinations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combinations.filter((c) => {
      if (filterSession !== 'ALL' && c.session !== filterSession) return false;
      if (filterSemester !== 'ALL' && c.semester !== filterSemester) return false;
      if (filterCategory !== 'ALL' && c.category !== filterCategory) return false;
      if (filterCount !== 'ALL') {
        if (filterCount === '5+' && c.subjectCount < 5) return false;
        if (filterCount !== '5+' && c.subjectCount !== Number(filterCount)) return false;
      }
      if (!q) return true;
      return (
        c.combinationCode.toLowerCase().includes(q) ||
        c.combinationName.toLowerCase().includes(q) ||
        c.subjectNames.some((n) => n.toLowerCase().includes(q)) ||
        c.subjectCodes.some((sc) => sc.toLowerCase().includes(q))
      );
    });
  }, [combinations, search, filterSession, filterSemester, filterCategory, filterCount]);

  const modalCandidateSubjects = useMemo(() => {
    if (showAllSubjectsInModal) return subjects;
    const scoped = subjects.filter(
      (s) =>
        s.session === form.session &&
        s.semester === form.semester &&
        s.category === form.category
    );
    return scoped.length > 0 ? scoped : subjects.filter((s) => s.session === form.session);
  }, [subjects, showAllSubjectsInModal, form.session, form.semester, form.category]);

  const openCreateModal = () => {
    setEditing(null);
    setShowAllSubjectsInModal(false);
    setForm({
      combinationCode: '',
      combinationName: '',
      session: defaultSession || sessions[0]?.sessionName || '2024-28',
      semester: semesters[0]?.semesterName || 'Semester 1',
      category: defaultCategory || categories[0]?.code || 'MJC',
      subjectCount: 3,
      subjectIds: [],
      notes: '',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (comb: SubjectUpdateCombination) => {
    setEditing(comb);
    setShowAllSubjectsInModal(false);
    setForm({
      combinationCode: comb.combinationCode,
      combinationName: comb.combinationName,
      session: comb.session,
      semester: comb.semester,
      category: comb.category,
      subjectCount: comb.subjectCount,
      subjectIds: comb.subjectIds || [],
      notes: comb.notes || '',
      isActive: comb.isActive,
    });
    setModalOpen(true);
  };

  const toggleSubjectSelection = (subjectId: string) => {
    setForm((prev) => {
      const exists = prev.subjectIds.includes(subjectId);
      if (exists) {
        return { ...prev, subjectIds: prev.subjectIds.filter((id) => id !== subjectId) };
      }
      if (prev.subjectIds.length >= prev.subjectCount) {
        return prev;
      }
      return { ...prev, subjectIds: [...prev.subjectIds, subjectId] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subjectIds.length !== form.subjectCount) {
      onNotify(
        'error',
        `Please select exact ${form.subjectCount} subject(s) for this combination (currently selected: ${form.subjectIds.length}).`
      );
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSubjectUpdateCombination(editing.id, form);
        onNotify('success', `Updated combination "${updated.combinationCode} · ${updated.combinationName}".`);
      } else {
        const created = await createSubjectUpdateCombination(form);
        onNotify('success', `Created combination "${created.combinationCode} · ${created.combinationName}".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save subject combination.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (comb: SubjectUpdateCombination) => {
    try {
      await updateSubjectUpdateCombination(comb.id, { isActive: !comb.isActive });
      await onRefresh();
      onNotify(
        'success',
        `Combination "${comb.combinationCode}" marked ${!comb.isActive ? 'Active' : 'Inactive'}.`
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update combination status.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Subject Combination Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Group 1, 2, 3, 4, 5 or more subjects together by Academic Session, Semester, and Category.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Combination
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2.5">
          <div className="relative xl:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, combination, or subject..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={filterSession}
            onChange={(e) => setFilterSession(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.sessionName}>
                {s.sessionName}
              </option>
            ))}
          </select>

          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.semesterName}>
                {s.semesterName}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>

          <select
            value={filterCount}
            onChange={(e) => setFilterCount(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="ALL">All Counts</option>
            <option value="1">1 Subject</option>
            <option value="2">2 Subjects</option>
            <option value="3">3 Subjects</option>
            <option value="4">4 Subjects</option>
            <option value="5+">5+ Subjects</option>
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Combination Name & Subjects</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Session · Semester · Cat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCombinations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    {combinations.length === 0
                      ? 'No subject combinations created yet. Add subjects first, then group them into combinations.'
                      : 'No combinations match the current search or filters.'}
                  </td>
                </tr>
              ) : (
                filteredCombinations.map((comb) => (
                  <tr key={comb.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-300 whitespace-nowrap">
                      {comb.combinationCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{comb.combinationName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {comb.subjectNames
                          .map((name, idx) => `${comb.subjectCodes[idx] || ''} ${name}`.trim())
                          .join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {comb.subjectCount}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {comb.session} · {comb.semester} ·{' '}
                      <span className="font-mono text-slate-200">{comb.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(comb)}
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                          comb.isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {comb.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(comb)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                          title="Edit Combination"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestDelete(
                              comb.id,
                              `Combination ${comb.combinationCode} (${comb.combinationName})`
                            )
                          }
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Delete Combination"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Combination Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {editing
                    ? `Edit Subject Combination (${editing.combinationCode})`
                    : 'Create Subject Combination'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Academic Session *
                  </label>
                  <select
                    required
                    value={form.session}
                    onChange={(e) => setForm((p) => ({ ...p, session: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.sessionName}>
                        {s.sessionName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Semester *
                  </label>
                  <select
                    required
                    value={form.semester}
                    onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.semesterName}>
                        {s.semesterName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Combination Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PCM-MJC-S1"
                    value={form.combinationCode}
                    onChange={(e) => setForm((p) => ({ ...p, combinationCode: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Number of Subjects *
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.subjectCount <= 5 ? String(form.subjectCount) : 'CUSTOM'}
                      onChange={(e) => {
                        const val = e.target.value;
                        const nextCount = val === 'CUSTOM' ? 6 : Number(val);
                        setForm((p) => ({
                          ...p,
                          subjectCount: nextCount,
                          subjectIds: p.subjectIds.slice(0, nextCount),
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                    >
                      <option value="1">1 Subject</option>
                      <option value="2">2 Subjects</option>
                      <option value="3">3 Subjects</option>
                      <option value="4">4 Subjects</option>
                      <option value="5">5 Subjects</option>
                      <option value="CUSTOM">6+ Subjects (Custom)</option>
                    </select>
                    {form.subjectCount > 5 && (
                      <input
                        type="number"
                        min={6}
                        max={20}
                        value={form.subjectCount}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            subjectCount: Math.max(1, Number(e.target.value) || 6),
                          }))
                        }
                        className="w-20 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Combination Title
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if left blank"
                    value={form.combinationName}
                    onChange={(e) => setForm((p) => ({ ...p, combinationName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* Subject Selection Picker */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Select Subjects (
                    <span className="font-mono tabular-nums text-blue-400">
                      {form.subjectIds.length} / {form.subjectCount}
                    </span>{' '}
                    required)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllSubjectsInModal((v) => !v)}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    {showAllSubjectsInModal
                      ? 'Filter to matching Session / Sem / Category'
                      : `Show all ${subjects.length} subjects`}
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/70">
                  {modalCandidateSubjects.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No subjects found for {form.session} · {form.semester} · {form.category}. Add subjects in Subject Management or click &quot;Show all subjects&quot;.
                    </div>
                  ) : (
                    modalCandidateSubjects.map((subj) => {
                      const checked = form.subjectIds.includes(subj.id);
                      const disabled = !checked && form.subjectIds.length >= form.subjectCount;
                      return (
                        <label
                          key={subj.id}
                          className={`flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer transition ${
                            checked ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleSubjectSelection(subj.id)}
                              className="rounded border-slate-700 bg-slate-900 text-blue-600"
                            />
                            <span className="font-mono font-semibold text-blue-300 shrink-0">
                              {subj.subjectCode}
                            </span>
                            <span className="text-slate-100 truncate">{subj.subjectName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                            {subj.category} · {subj.session}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Optional combination rules or paper stream notes..."
                  value={form.notes || ''}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  Combination is Active
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Combination'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
