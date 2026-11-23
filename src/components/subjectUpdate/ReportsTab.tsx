import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BarChart3, Download } from 'lucide-react';
import { SubjectUpdateSystemState } from '../../types';

interface ReportsTabProps {
  state: SubjectUpdateSystemState;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ state, onNotify }) => {
  const [filterSession, setFilterSession] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');

  const scopedSubjects = useMemo(
    () =>
      state.subjects.filter(
        (s) =>
          (filterSession === 'ALL' || s.session === filterSession) &&
          (filterSemester === 'ALL' || s.semester === filterSemester)
      ),
    [state.subjects, filterSession, filterSemester]
  );

  const scopedCombinations = useMemo(
    () =>
      state.combinations.filter(
        (c) =>
          (filterSession === 'ALL' || c.session === filterSession) &&
          (filterSemester === 'ALL' || c.semester === filterSemester)
      ),
    [state.combinations, filterSession, filterSemester]
  );

  const scopedStudents = useMemo(
    () =>
      state.students.filter(
        (s) =>
          (filterSession === 'ALL' || s.session === filterSession) &&
          (filterSemester === 'ALL' || s.semester === filterSemester)
      ),
    [state.students, filterSession, filterSemester]
  );

  const scopedGroups = useMemo(
    () =>
      state.groups.filter(
        (g) =>
          (filterSession === 'ALL' || g.session === filterSession) &&
          (filterSemester === 'ALL' || g.semester === filterSemester)
      ),
    [state.groups, filterSession, filterSemester]
  );

  const scopedAssignments = useMemo(
    () =>
      state.staffAssignments.filter(
        (a) =>
          (filterSession === 'ALL' || a.session === filterSession) &&
          (filterSemester === 'ALL' || a.semester === filterSemester)
      ),
    [state.staffAssignments, filterSession, filterSemester]
  );

  const scopedWork = useMemo(
    () =>
      state.workAllocations.filter(
        (w) =>
          (filterSession === 'ALL' || w.session === filterSession) &&
          (filterSemester === 'ALL' || w.semester === filterSemester)
      ),
    [state.workAllocations, filterSession, filterSemester]
  );

  const coverageMetrics = useMemo(() => {
    const assignedSubjectIds = new Set(
      scopedAssignments.filter((a) => a.targetType === 'SUBJECT' && a.subjectId).map((a) => a.subjectId!)
    );
    const assignedComboIds = new Set(
      scopedAssignments
        .filter((a) => a.targetType === 'COMBINATION' && a.combinationId)
        .map((a) => a.combinationId!)
    );

    const subjectsCovered = scopedSubjects.filter((s) => assignedSubjectIds.has(s.id)).length;
    const combosCovered = scopedCombinations.filter((c) => assignedComboIds.has(c.id)).length;

    const allocatedStudents = scopedStudents.filter((s) => s.allocationStatus === 'ALLOCATED').length;
    const partialStudents = scopedStudents.filter((s) => s.allocationStatus === 'PARTIAL').length;
    const unmatchedStudents = scopedStudents.filter((s) => s.allocationStatus === 'UNMATCHED').length;
    const groupedStudents = scopedStudents.filter((s) => Boolean(s.groupId)).length;

    const workPending = scopedWork.filter((w) => w.progressStatus === 'PENDING').length;
    const workInProgress = scopedWork.filter((w) => w.progressStatus === 'IN_PROGRESS').length;
    const workCompleted = scopedWork.filter((w) => w.progressStatus === 'COMPLETED').length;
    const workOnHold = scopedWork.filter((w) => w.progressStatus === 'ON_HOLD').length;

    return {
      subjectsCovered,
      combosCovered,
      allocatedStudents,
      partialStudents,
      unmatchedStudents,
      groupedStudents,
      workPending,
      workInProgress,
      workCompleted,
      workOnHold,
    };
  }, [scopedSubjects, scopedCombinations, scopedStudents, scopedAssignments, scopedWork]);

  const staffWorkloadRows = useMemo(() => {
    return state.staff.map((member) => {
      const memberAssigns = scopedAssignments.filter(
        (a) => a.inChargeStaffId === member.id || a.staffIds.includes(member.id)
      );
      const subjectAssigns = memberAssigns.filter((a) => a.targetType === 'SUBJECT').length;
      const comboAssigns = memberAssigns.filter((a) => a.targetType === 'COMBINATION').length;
      const groupAssigns = memberAssigns.filter((a) => a.targetType === 'GROUP').length;

      const memberWork = scopedWork.filter(
        (w) => w.inChargeStaffId === member.id || w.staffIds.includes(member.id)
      );
      const completedTasks = memberWork.filter((w) => w.progressStatus === 'COMPLETED').length;

      const inChargeRoles =
        scopedAssignments.filter((a) => a.inChargeStaffId === member.id).length +
        scopedGroups.filter((g) => g.inChargeStaffId === member.id).length +
        scopedWork.filter((w) => w.inChargeStaffId === member.id).length;

      return {
        member,
        subjectAssigns,
        comboAssigns,
        groupAssigns,
        inChargeRoles,
        totalTasks: memberWork.length,
        completedTasks,
      };
    });
  }, [state.staff, scopedAssignments, scopedGroups, scopedWork]);

  const handleExportFullReport = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Metric: 'Filter Session', Value: filterSession },
      { Metric: 'Filter Semester', Value: filterSemester },
      { Metric: 'Total Subjects', Value: scopedSubjects.length },
      { Metric: 'Subjects with Staff Assignment', Value: coverageMetrics.subjectsCovered },
      { Metric: 'Total Combinations', Value: scopedCombinations.length },
      { Metric: 'Combinations with Staff Assignment', Value: coverageMetrics.combosCovered },
      { Metric: 'Total Students', Value: scopedStudents.length },
      { Metric: 'Students Allocated', Value: coverageMetrics.allocatedStudents },
      { Metric: 'Students Partial', Value: coverageMetrics.partialStudents },
      { Metric: 'Students Unmatched', Value: coverageMetrics.unmatchedStudents },
      { Metric: 'Students Linked to Groups', Value: coverageMetrics.groupedStudents },
      { Metric: 'Total Student Groups', Value: scopedGroups.length },
      { Metric: 'Total Staff Profiles', Value: state.staff.length },
      { Metric: 'Total Work Allocations', Value: scopedWork.length },
      { Metric: 'Work Completed', Value: coverageMetrics.workCompleted },
      { Metric: 'Work In Progress', Value: coverageMetrics.workInProgress },
      { Metric: 'Work Pending', Value: coverageMetrics.workPending },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');

    const subjectRows = scopedSubjects.map((s) => ({
      Code: s.subjectCode,
      Name: s.subjectName,
      Category: s.category,
      Session: s.session,
      Semester: s.semester,
      Department: s.departmentName,
      Active: s.isActive ? 'YES' : 'NO',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subjectRows), 'Subjects');

    const comboRows = scopedCombinations.map((c) => ({
      Code: c.combinationCode,
      Name: c.combinationName,
      Session: c.session,
      Semester: c.semester,
      Category: c.category,
      'Subject Count': c.subjectCount,
      Subjects: c.subjectNames.join(', '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comboRows), 'Combinations');

    const studentRows = scopedStudents.map((st) => ({
      'SN.': st.sn,
      'ROLL NO.': st.rollNumber,
      'NAME OF STUDENT': st.studentName,
      'RAW SUBJECT': st.rawSubjectText,
      'MATCHED SUBJECTS': st.matchedSubjectNames.join(', '),
      COMBINATION: st.combinationName || '',
      GROUP: st.groupName || '',
      STATUS: st.allocationStatus,
      Session: st.session,
      Semester: st.semester,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'Students');

    const groupRows = scopedGroups.map((g) => ({
      Code: g.groupCode,
      Name: g.groupName,
      Session: g.session,
      Semester: g.semester,
      Category: g.category,
      Target: g.combinationLabel || g.subjectLabel || 'General',
      Students: g.studentIds.length,
      'In-Charge': g.inChargeStaffName || 'Unassigned',
      Staff: g.assignedStaffNames.join(', '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows), 'Student Groups');

    const staffRows = staffWorkloadRows.map((row) => ({
      'Staff Code': row.member.staffCode,
      Name: row.member.fullName,
      Designation: row.member.designation,
      Department: row.member.departmentName,
      'Subject Assignments': row.subjectAssigns,
      'Combination Assignments': row.comboAssigns,
      'Group Assignments': row.groupAssigns,
      'In-Charge Roles': row.inChargeRoles,
      'Total Work Tasks': row.totalTasks,
      'Completed Tasks': row.completedTasks,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(staffRows),
      'Staff Responsibilities'
    );

    const workRows = scopedWork.map((w) => ({
      Title: w.title,
      Session: w.session,
      Semester: w.semester,
      Category: w.category,
      Subject: w.subjectLabel || '',
      Combination: w.combinationLabel || '',
      Group: w.groupLabel || '',
      'In-Charge': w.inChargeStaffName,
      Team: w.staffNames.join(', '),
      Deadline: w.deadline,
      Priority: w.priority,
      Status: w.progressStatus,
      Instructions: w.instructions,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workRows), 'Work Allocations');

    XLSX.writeFile(
      wb,
      `SUBJECT_UPDATE_Monitoring_Report_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    onNotify('success', 'Exported multi-sheet SUBJECT UPDATE academic monitoring report (.xlsx).');
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Reports &amp; Assignment Monitoring</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor subject &amp; combination staff coverage, student allocation health, staff workload, and work progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterSession}
              onChange={(e) => setFilterSession(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
            >
              <option value="ALL">All Sessions</option>
              {state.sessions.map((s) => (
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
              {state.semesters.map((s) => (
                <option key={s.id} value={s.semesterName}>
                  {s.semesterName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportFullReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Multi-Sheet Report (.xlsx)
            </button>
          </div>
        </div>

        {/* Monitoring KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">Subject Staff Coverage</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100">
              {coverageMetrics.subjectsCovered} / {scopedSubjects.length}
            </div>
            <div className="text-[11px] text-slate-400">
              Combos covered:{' '}
              <span className="font-mono text-blue-300">
                {coverageMetrics.combosCovered} / {scopedCombinations.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">Student Subject Allocation</div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-400">
              {coverageMetrics.allocatedStudents} / {scopedStudents.length}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Partial: {coverageMetrics.partialStudents} · Unmatched:{' '}
              {coverageMetrics.unmatchedStudents}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">Student Groups &amp; Enrollment</div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-100">
              {scopedGroups.length} groups
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Grouped students: {coverageMetrics.groupedStudents} / {scopedStudents.length}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400">Work Progress</div>
            <div className="text-xl font-bold font-mono tabular-nums text-blue-400">
              {coverageMetrics.workCompleted} / {scopedWork.length} done
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Active: {coverageMetrics.workInProgress} · Pending: {coverageMetrics.workPending} · Hold:{' '}
              {coverageMetrics.workOnHold}
            </div>
          </div>
        </div>
      </div>

      {/* Staff Workload & Responsibility Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-bold text-slate-100">
            Staff Workload &amp; Responsibility Matrix ({staffWorkloadRows.length})
          </h4>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Staff Code</th>
                <th className="px-4 py-3">Name &amp; Department</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3">Combos</th>
                <th className="px-4 py-3">Groups</th>
                <th className="px-4 py-3">In-Charge Roles</th>
                <th className="px-4 py-3">Work Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {staffWorkloadRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No staff profiles found to compute workload metrics.
                  </td>
                </tr>
              ) : (
                staffWorkloadRows.map((row) => (
                  <tr key={row.member.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-300">
                      {row.member.staffCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{row.member.fullName}</div>
                      <div className="text-[11px] text-slate-400">
                        {row.member.designation} · {row.member.departmentName}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {row.subjectAssigns}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {row.comboAssigns}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {row.groupAssigns}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-emerald-300">
                      {row.inChargeRoles}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-200">
                      {row.completedTasks} / {row.totalTasks} completed
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Coverage Gap Inspection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-100">
          Subject Assignment Coverage Status ({scopedSubjects.length})
        </h4>
        <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-72">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">Code &amp; Subject</th>
                <th className="px-4 py-2.5">Scope</th>
                <th className="px-4 py-2.5">In-Charge Assigned</th>
                <th className="px-4 py-2.5">Students Matched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {scopedSubjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    No subjects found in current filter.
                  </td>
                </tr>
              ) : (
                scopedSubjects.map((subj) => {
                  const assign = scopedAssignments.find(
                    (a) => a.targetType === 'SUBJECT' && a.subjectId === subj.id
                  );
                  const studentCount = scopedStudents.filter((st) =>
                    st.matchedSubjectIds.includes(subj.id)
                  ).length;
                  return (
                    <tr key={subj.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-blue-300">{subj.subjectCode}</span> ·{' '}
                        <span className="text-slate-100 font-medium">{subj.subjectName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {subj.session} · {subj.semester} · {subj.category}
                      </td>
                      <td className="px-4 py-2.5">
                        {assign ? (
                          <span className="text-emerald-300 font-medium">
                            {assign.inChargeStaffName} ({assign.staffNames.length} staff)
                          </span>
                        ) : (
                          <span className="text-amber-300">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-slate-300">
                        {studentCount}
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
