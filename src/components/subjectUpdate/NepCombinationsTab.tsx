import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import {
  NEP_CATEGORIES,
  NepCategoryKey,
  NepCategoryRule,
  SubjectUpdateItem,
  SubjectUpdateNepConfig,
  SubjectUpdateSemester,
  SubjectUpdateSession,
} from '../../types';
import { saveSubjectUpdateNepConfig } from '../../services/subjectUpdateSystemService';
import { normalizeNepCat } from './NepSubjectsTab';

interface NepCombinationsTabProps {
  subjects: SubjectUpdateItem[];
  sessions: SubjectUpdateSession[];
  semesters: SubjectUpdateSemester[];
  nepConfigs: SubjectUpdateNepConfig[];
  onRefresh: () => Promise<void>;
  onToast: (type: 'success' | 'error', message: string) => void;
}

const DEFAULT_RULES: Record<NepCategoryKey, NepCategoryRule> = {
  MAJOR: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
  MIC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
  MDC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
  AEC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
  SEC: { subjectIds: [], required: true, minSelect: 1, maxSelect: 1 },
  VAC: { subjectIds: [], required: false, minSelect: 0, maxSelect: 1 },
};

export const NepCombinationsTab: React.FC<NepCombinationsTabProps> = ({
  subjects,
  sessions,
  semesters,
  nepConfigs,
  onRefresh,
  onToast,
}) => {
  const [selectedSession, setSelectedSession] = useState(
    sessions.find((s) => s.sessionName === '2026-30')?.sessionName || sessions[0]?.sessionName || '2026-30'
  );
  const [selectedSemester, setSelectedSemester] = useState(
    semesters[0]?.semesterName || 'Semester 1'
  );

  const [allowedMajorIds, setAllowedMajorIds] = useState<string[]>([]);
  const [majorToMicMap, setMajorToMicMap] = useState<Record<string, string[]>>({});
  const [categoryRules, setCategoryRules] = useState<Record<NepCategoryKey, NepCategoryRule>>(DEFAULT_RULES);
  const [focusedMajorId, setFocusedMajorId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const scopedSubjectsByCat = useMemo(() => {
    const map: Record<NepCategoryKey, SubjectUpdateItem[]> = {
      MAJOR: [],
      MIC: [],
      MDC: [],
      AEC: [],
      SEC: [],
      VAC: [],
    };
    subjects
      .filter((s) => s.session === selectedSession && s.semester === selectedSemester && s.isActive)
      .forEach((s) => {
        const cat = normalizeNepCat(s.category) as NepCategoryKey;
        if (map[cat]) {
          map[cat].push(s);
        }
      });
    return map;
  }, [subjects, selectedSession, selectedSemester]);

  const savedConfig = useMemo(
    () => nepConfigs.find((c) => c.session === selectedSession && c.semester === selectedSemester),
    [nepConfigs, selectedSession, selectedSemester]
  );

  // Hydrate draft whenever session/semester or savedConfig updates
  useEffect(() => {
    if (savedConfig) {
      setAllowedMajorIds(savedConfig.allowedMajorIds || []);
      setMajorToMicMap(savedConfig.majorToMicMap || {});
      setCategoryRules({
        MAJOR: savedConfig.categoryRules?.MAJOR || DEFAULT_RULES.MAJOR,
        MIC: savedConfig.categoryRules?.MIC || DEFAULT_RULES.MIC,
        MDC: savedConfig.categoryRules?.MDC || DEFAULT_RULES.MDC,
        AEC: savedConfig.categoryRules?.AEC || DEFAULT_RULES.AEC,
        SEC: savedConfig.categoryRules?.SEC || DEFAULT_RULES.SEC,
        VAC: savedConfig.categoryRules?.VAC || DEFAULT_RULES.VAC,
      });
      setFocusedMajorId(savedConfig.allowedMajorIds?.[0] || scopedSubjectsByCat.MAJOR[0]?.id || '');
    } else {
      setAllowedMajorIds([]);
      setMajorToMicMap({});
      setCategoryRules(DEFAULT_RULES);
      setFocusedMajorId(scopedSubjectsByCat.MAJOR[0]?.id || '');
    }
  }, [savedConfig, selectedSession, selectedSemester, scopedSubjectsByCat.MAJOR]);

  const toggleMajorAllowed = (majorId: string) => {
    setAllowedMajorIds((prev) => {
      const exists = prev.includes(majorId);
      const next = exists ? prev.filter((id) => id !== majorId) : [...prev, majorId];
      setCategoryRules((rules) => ({
        ...rules,
        MAJOR: { ...rules.MAJOR, subjectIds: next },
      }));
      if (!exists) setFocusedMajorId(majorId);
      return next;
    });
  };

  const toggleMicForMajor = (majorId: string, micId: string) => {
    setMajorToMicMap((prev) => {
      const curr = prev[majorId] || [];
      const nextMics = curr.includes(micId) ? curr.filter((id) => id !== micId) : [...curr, micId];
      return { ...prev, [majorId]: nextMics };
    });
  };

  const toggleCategorySubject = (cat: NepCategoryKey, subjId: string) => {
    setCategoryRules((prev) => {
      const curr = prev[cat].subjectIds;
      const next = curr.includes(subjId) ? curr.filter((id) => id !== subjId) : [...curr, subjId];
      return {
        ...prev,
        [cat]: { ...prev[cat], subjectIds: next },
      };
    });
  };

  const updateRuleMeta = (
    cat: NepCategoryKey,
    patch: Partial<Pick<NepCategoryRule, 'required' | 'minSelect' | 'maxSelect'>>
  ) => {
    setCategoryRules((prev) => {
      const updated = { ...prev[cat], ...patch };
      if (patch.required !== undefined) {
        if (patch.required && updated.minSelect === 0) updated.minSelect = 1;
        if (!patch.required && updated.minSelect > 0) updated.minSelect = 0;
        if (updated.maxSelect < updated.minSelect) updated.maxSelect = Math.max(1, updated.minSelect);
      }
      return { ...prev, [cat]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Also derive MIC rule subjectIds union from majorToMicMap if MIC list was empty
      const unionMic = new Set<string>(categoryRules.MIC.subjectIds);
      Object.values(majorToMicMap).forEach((list) => list.forEach((id) => unionMic.add(id)));

      await saveSubjectUpdateNepConfig({
        session: selectedSession,
        semester: selectedSemester,
        allowedMajorIds,
        majorToMicMap,
        categoryRules: {
          ...categoryRules,
          MAJOR: { ...categoryRules.MAJOR, subjectIds: allowedMajorIds },
          MIC: { ...categoryRules.MIC, subjectIds: Array.from(unionMic) },
        },
      });
      await onRefresh();
      onToast('success', `Saved NEP combinations & rules for ${selectedSession} · ${selectedSemester}.`);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to save NEP combination configuration.');
    } finally {
      setSaving(false);
    }
  };

  const focusedMajorSubject = scopedSubjectsByCat.MAJOR.find((m) => m.id === focusedMajorId);
  const focusedMicList = focusedMajorId ? majorToMicMap[focusedMajorId] || [] : [];

  return (
    <div className="space-y-5">
      {/* Scope Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.sessionName}>
                  {s.sessionName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.semesterName}>
                  {s.semesterName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save NEP Combinations
        </button>
      </div>

      {/* Major -> MIC Dynamic Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">1. Available Major Subjects</h4>
              <p className="text-[11px] text-slate-400">
                Enable Major subjects &amp; click one to configure its allowed MIC options.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const allIds = scopedSubjectsByCat.MAJOR.map((s) => s.id);
                setAllowedMajorIds(allIds);
                setCategoryRules((r) => ({ ...r, MAJOR: { ...r.MAJOR, subjectIds: allIds } }));
                if (allIds[0] && !focusedMajorId) setFocusedMajorId(allIds[0]);
              }}
              className="text-[11px] text-blue-400 hover:underline cursor-pointer"
            >
              Enable All
            </button>
          </div>

          {scopedSubjectsByCat.MAJOR.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              No MAJOR subjects found in {selectedSession} · {selectedSemester}. Add them in Subjects tab first.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {scopedSubjectsByCat.MAJOR.map((m) => {
                const enabled = allowedMajorIds.includes(m.id);
                const isFocused = focusedMajorId === m.id;
                const mappedCount = (majorToMicMap[m.id] || []).length;
                return (
                  <div
                    key={m.id}
                    onClick={() => setFocusedMajorId(m.id)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                      isFocused
                        ? 'bg-blue-600/15 border-blue-500/50 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <label
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleMajorAllowed(m.id)}
                        className="rounded border-slate-700 bg-slate-900 text-blue-600"
                      />
                      <span className="truncate font-medium">
                        <span className="font-mono text-slate-400 mr-1.5">{m.subjectCode}</span>
                        {m.subjectName}
                      </span>
                    </label>
                    <span className="font-mono tabular-nums text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                      {mappedCount} MIC
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                2. Allowed MIC Subjects for{' '}
                <span className="text-blue-400">
                  {focusedMajorSubject
                    ? `${focusedMajorSubject.subjectCode} (${focusedMajorSubject.subjectName})`
                    : 'Selected Major'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                When In-Charge chooses this Major, only these checked MIC subjects appear in the MIC dropdown.
              </p>
            </div>
            {focusedMajorId && scopedSubjectsByCat.MIC.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setMajorToMicMap((prev) => ({
                      ...prev,
                      [focusedMajorId]: scopedSubjectsByCat.MIC.map((s) => s.id),
                    }))
                  }
                  className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                >
                  Select All MIC
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMajorToMicMap((prev) => ({ ...prev, [focusedMajorId]: [] }))
                  }
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {!focusedMajorId ? (
            <p className="text-xs text-slate-500 py-4">Select a Major subject on the left to map MIC subjects.</p>
          ) : scopedSubjectsByCat.MIC.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              No MIC subjects found in {selectedSession} · {selectedSemester}. Add MIC subjects in Subjects tab first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {scopedSubjectsByCat.MIC.map((mic) => {
                const checked = focusedMicList.includes(mic.id);
                return (
                  <label
                    key={mic.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!allowedMajorIds.includes(focusedMajorId)) {
                          toggleMajorAllowed(focusedMajorId);
                        }
                        toggleMicForMajor(focusedMajorId, mic.id);
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                    />
                    <span className="truncate">
                      <span className="font-mono text-slate-400 mr-1">{mic.subjectCode}</span>
                      {mic.subjectName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Pools (MDC, AEC, SEC, VAC) & Min/Max Rules for all 6 NEP Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['MDC', 'AEC', 'SEC', 'VAC'] as NepCategoryKey[]).map((cat) => {
          const list = scopedSubjectsByCat[cat];
          const rule = categoryRules[cat];
          return (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-100">{cat} Subject Options</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryRules((prev) => ({
                        ...prev,
                        [cat]: { ...prev[cat], subjectIds: list.map((s) => s.id) },
                      }))
                    }
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryRules((prev) => ({
                        ...prev,
                        [cat]: { ...prev[cat], subjectIds: [] },
                      }))
                    }
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {list.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No {cat} subjects added for {selectedSession} · {selectedSemester}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {list.map((subj) => {
                    const checked = rule.subjectIds.includes(subj.id);
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => toggleCategorySubject(cat, subj.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                          checked
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-blue-400" />}
                        <span className="font-mono text-[11px]">{subj.subjectCode}</span>
                        <span>{subj.subjectName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Selection Rules Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-slate-100">Compulsory / Optional &amp; Selection Limits</h4>
          <p className="text-[11px] text-slate-400">
            Configure mandatory vs optional status and min/max selections per NEP category.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Requirement</th>
                <th className="px-4 py-2.5">Min Selections</th>
                <th className="px-4 py-2.5">Max Selections</th>
                <th className="px-4 py-2.5">Configured Subjects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {NEP_CATEGORIES.map((cat) => {
                const rule = categoryRules[cat];
                const count =
                  cat === 'MAJOR'
                    ? allowedMajorIds.length
                    : cat === 'MIC'
                      ? new Set(Object.values(majorToMicMap).flat()).size
                      : rule.subjectIds.length;
                return (
                  <tr key={cat}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-200">{cat}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={rule.required ? 'REQUIRED' : 'OPTIONAL'}
                        onChange={(e) =>
                          updateRuleMeta(cat, { required: e.target.value === 'REQUIRED' })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100"
                      >
                        <option value="REQUIRED">Compulsory</option>
                        <option value="OPTIONAL">Optional</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={rule.minSelect}
                        onChange={(e) => updateRuleMeta(cat, { minSelect: Number(e.target.value) })}
                        className="w-20 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-100"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={rule.maxSelect}
                        onChange={(e) => updateRuleMeta(cat, { maxSelect: Number(e.target.value) })}
                        className="w-20 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-100"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-300">
                      {count} mapped
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
