import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Building2,
  BookOpen,
  Users,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Department, Subject, PracticalForm, Student } from '../types';
import { getFormEnrollments, getFormMarks } from '../services/collegeService';

interface ReportsModuleProps {
  departments: Department[];
  subjects: Subject[];
  forms: PracticalForm[];
  students: Student[];
  collegeName: string;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  departments,
  subjects,
  forms,
  students,
  collegeName,
}) => {
  const [reportType, setReportType] = useState<
    'department' | 'subject' | 'pending' | 'completion'
  >('department');

  // Stats
  const [loading, setLoading] = useState(false);
  const [formStats, setFormStats] = useState<
    Array<{
      formId: string;
      title: string;
      subjectCode: string;
      deptId: string;
      enrolled: number;
      evaluated: number;
      absent: number;
      pending: number;
      rate: number;
    }>
  >([]);

  useEffect(() => {
    loadStats();
  }, [forms]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const list = await Promise.all(
        forms.map(async (f) => {
          const [enr, mrk] = await Promise.all([
            getFormEnrollments(f.id),
            getFormMarks(f.id),
          ]);
          const enrolled = enr.length;
          let evaluated = 0;
          let absent = 0;
          mrk.forEach((m) => {
            if (!m.isPresent) absent++;
            else if (m.marksObtained !== null && m.marksObtained !== undefined) evaluated++;
          });
          const pending = Math.max(0, enrolled - (evaluated + absent));
          const rate = enrolled > 0 ? ((evaluated + absent) / enrolled) * 100 : 0;
          return {
            formId: f.id,
            title: f.title,
            subjectCode: f.subjectCode,
            deptId: f.departmentId,
            enrolled,
            evaluated,
            absent,
            pending,
            rate,
          };
        })
      );
      setFormStats(list);
    } catch (err) {
      console.error('Error loading report stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export current report table to Excel
  const handleExportCurrentReport = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'department') {
      const rows = [
        [collegeName.toUpperCase()],
        ['DEPARTMENT-WISE PRACTICAL EVALUATION REPORT'],
        [],
        ['Department Name', 'Code', 'Total Subjects', 'Active Forms', 'Total Enrolled', 'Evaluated', 'Pending', 'Completion Rate'],
      ];
      departments.forEach((d) => {
        const dSubjs = subjects.filter((s) => s.departmentId === d.id);
        const dStats = formStats.filter((f) => f.deptId === d.id);
        const enr = dStats.reduce((acc, c) => acc + c.enrolled, 0);
        const evald = dStats.reduce((acc, c) => acc + c.evaluated, 0);
        const pend = dStats.reduce((acc, c) => acc + c.pending, 0);
        const rate = enr > 0 ? ((evald / enr) * 100).toFixed(1) + '%' : '0%';
        rows.push([d.name, d.code, dSubjs.length as any, dStats.length as any, enr as any, evald as any, pend as any, rate as any]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Dept_Report');
      XLSX.writeFile(wb, `Department_Practical_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const rows = [
        [collegeName.toUpperCase()],
        ['SUBJECT AND EXAMINATION COMPLETION REPORT'],
        [],
        ['Subject Code', 'Examination Title', 'Total Enrolled', 'Evaluated', 'Absent', 'Pending Entries', 'Completion Rate'],
      ];
      formStats.forEach((f) => {
        rows.push([
          f.subjectCode,
          f.title,
          f.enrolled as any,
          f.evaluated as any,
          f.absent as any,
          f.pending as any,
          f.rate.toFixed(1) + '%',
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Completion_Report');
      XLSX.writeFile(wb, `Examination_Completion_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  const deptLookup = new Map(departments.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">Reports & Analytics Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Department-wise audits, subject completion rates, pending marks diagnostics, and printable marksheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCurrentReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Report (.xlsx)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-xl bg-slate-800 border border-slate-700"
            title="Print Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Switch Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setReportType('department')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'department'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Department-wise Summary
        </button>
        <button
          onClick={() => setReportType('completion')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'completion'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Form Completion Rates
        </button>
        <button
          onClick={() => setReportType('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            reportType === 'pending'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pending Marks Diagnostics
        </button>
      </div>

      {/* Report Content Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {reportType === 'department' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Code</th>
                  <th className="py-3 px-4 text-center">Total Subjects</th>
                  <th className="py-3 px-4 text-center">Active Forms</th>
                  <th className="py-3 px-4 text-center">Enrolled Candidates</th>
                  <th className="py-3 px-4 text-center">Marks Entered</th>
                  <th className="py-3 px-4 text-center">Pending Entries</th>
                  <th className="py-3 px-4 text-center">Completion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {departments.map((dept) => {
                  const dSubjs = subjects.filter((s) => s.departmentId === dept.id);
                  const dStats = formStats.filter((f) => f.deptId === dept.id);
                  const enr = dStats.reduce((acc, c) => acc + c.enrolled, 0);
                  const evald = dStats.reduce((acc, c) => acc + c.evaluated, 0);
                  const pend = dStats.reduce((acc, c) => acc + c.pending, 0);
                  const rate = enr > 0 ? (evald / enr) * 100 : 0;

                  return (
                    <tr key={dept.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-200">{dept.name}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">{dept.code}</td>
                      <td className="py-3 px-4 text-center font-mono">{dSubjs.length}</td>
                      <td className="py-3 px-4 text-center font-mono">{dStats.length}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">{enr}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400">{evald}</td>
                      <td className="py-3 px-4 text-center font-mono text-amber-400">{pend}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span className={rate >= 80 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-slate-400'}>
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(reportType === 'completion' || reportType === 'pending') && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Subject Code</th>
                  <th className="py-3 px-4">Examination Title</th>
                  <th className="py-3 px-4 text-center">Enrolled</th>
                  <th className="py-3 px-4 text-center">Marks Entered</th>
                  <th className="py-3 px-4 text-center">Absent</th>
                  <th className="py-3 px-4 text-center">Pending Entries</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {formStats
                  .filter((f) => (reportType === 'pending' ? f.pending > 0 : true))
                  .map((f) => (
                    <tr key={f.formId} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{f.subjectCode}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{f.title}</td>
                      <td className="py-3 px-4 text-center font-mono">{f.enrolled}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-400">{f.evaluated}</td>
                      <td className="py-3 px-4 text-center font-mono text-rose-400">{f.absent}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">{f.pending}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            f.pending === 0 && f.enrolled > 0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {f.pending === 0 && f.enrolled > 0 ? 'COMPLETED' : 'IN PROGRESS'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
