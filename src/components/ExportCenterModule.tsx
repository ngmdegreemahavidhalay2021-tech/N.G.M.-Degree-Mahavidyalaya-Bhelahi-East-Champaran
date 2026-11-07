import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle,
  Archive,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  Department,
  Subject,
  PracticalForm,
  FormEnrollment,
  MarksRecord,
} from '../types';
import {
  getFormEnrollments,
  getFormMarks,
} from '../services/collegeService';
import {
  generateExportRecords,
  exportMasterCollegeWorkbook,
  exportZipDepartmentSheets,
  UnifiedExportRecord,
} from '../lib/collegeExport';

interface ExportCenterModuleProps {
  departments: Department[];
  subjects: Subject[];
  forms: PracticalForm[];
  collegeName: string;
}

export const ExportCenterModule: React.FC<ExportCenterModuleProps> = ({
  departments,
  subjects,
  forms,
  collegeName,
}) => {
  // Filter States
  const [selectedSession, setSelectedSession] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [selectedPracticalSubject, setSelectedPracticalSubject] = useState('ALL');
  const [selectedIncharge, setSelectedIncharge] = useState('ALL');
  const [selectedSubjectType, setSelectedSubjectType] = useState('ALL');
  const [selectedFormId, setSelectedFormId] = useState('ALL');
  const [marksStatus, setMarksStatus] = useState<'ALL' | 'ENTERED' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded database snapshots
  const [enrollmentsMap, setEnrollmentsMap] = useState<Record<string, FormEnrollment[]>>({});
  const [marksMap, setMarksMap] = useState<Record<string, MarksRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadAllRecords();
  }, [forms]);

  const loadAllRecords = async () => {
    try {
      setLoading(true);
      const enrMap: Record<string, FormEnrollment[]> = {};
      const mrkMap: Record<string, MarksRecord[]> = {};

      await Promise.all(
        forms.map(async (f) => {
          const [enr, mrk] = await Promise.all([
            getFormEnrollments(f.id),
            getFormMarks(f.id),
          ]);
          enrMap[f.id] = enr;
          mrkMap[f.id] = mrk;
        })
      );

      setEnrollmentsMap(enrMap);
      setMarksMap(mrkMap);
    } catch (err) {
      console.error('Error loading export data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Base records across all forms without filters
  const allGeneratedRecords = React.useMemo(() => {
    return generateExportRecords(
      forms,
      departments,
      subjects,
      enrollmentsMap,
      marksMap,
      {}
    );
  }, [forms, departments, subjects, enrollmentsMap, marksMap]);

  // Extract distinct filter options
  const sessions = Array.from(new Set(allGeneratedRecords.map((r) => r.session).filter(Boolean)));
  const semesters = Array.from(new Set(allGeneratedRecords.map((r) => r.semester).filter(Boolean)));
  const practicalSubjectOptions = Array.from(new Set(allGeneratedRecords.map((r) => r.practicalSubject).filter(Boolean))).sort();
  const inchargeOptions = Array.from(new Set(allGeneratedRecords.map((r) => r.inchargeName).filter(Boolean))).sort();
  const subjectTypeOptions = Array.from(new Set(allGeneratedRecords.map((r) => r.subjectType).filter(Boolean))).sort();

  // Filtered dataset for export and preview
  const filteredRecords = React.useMemo(() => {
    return generateExportRecords(
      forms,
      departments,
      subjects,
      enrollmentsMap,
      marksMap,
      {
        session: selectedSession,
        semester: selectedSemester,
        departmentId: selectedDeptId,
        practicalSubject: selectedPracticalSubject,
        inchargeName: selectedIncharge,
        subjectType: selectedSubjectType,
        practicalFormId: selectedFormId,
        marksStatus,
        searchQuery,
      }
    );
  }, [
    forms,
    departments,
    subjects,
    enrollmentsMap,
    marksMap,
    selectedSession,
    selectedSemester,
    selectedDeptId,
    selectedPracticalSubject,
    selectedIncharge,
    selectedSubjectType,
    selectedFormId,
    marksStatus,
    searchQuery,
  ]);

  // Master Excel Download (15 Columns)
  const handleDownloadMasterExcel = () => {
    if (filteredRecords.length === 0) {
      alert('No records match the selected filters.');
      return;
    }
    setDownloading(true);
    setTimeout(() => {
      exportMasterCollegeWorkbook(filteredRecords, collegeName);
      setDownloading(false);
    }, 100);
  };

  // ZIP Archive of separate department workbooks
  const handleDownloadZipArchive = async () => {
    if (filteredRecords.length === 0) {
      alert('No records match the selected filters.');
      return;
    }
    try {
      setDownloading(true);
      await exportZipDepartmentSheets(filteredRecords, collegeName);
    } catch (err: any) {
      alert(err.message || 'Failed to generate ZIP archive');
    } finally {
      setDownloading(false);
    }
  };

  // Browser Print Preview
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-100">Advanced Admin Export Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Export comprehensive college practical examination datasets, multi-sheet workbooks, separate department ZIP archives, and printable marksheets.
          </p>
        </div>

        {/* Live Filter Counter */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Matched Records</span>
            <strong className="text-base font-bold text-emerald-400 font-mono">
              {filteredRecords.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter Control Dashboard */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-blue-400" />
          Multi-Level Filter Engine
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Session Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Academic Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Academic Sessions</option>
              {sessions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Semesters</option>
              {semesters.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Department</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Practical Subject Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Practical Subject</label>
            <select
              value={selectedPracticalSubject}
              onChange={(e) => setSelectedPracticalSubject(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Practical Subjects</option>
              {practicalSubjectOptions.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Incharge Name Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Incharge / Examiner</label>
            <select
              value={selectedIncharge}
              onChange={(e) => setSelectedIncharge(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Incharges</option>
              {inchargeOptions.map((inc) => (
                <option key={inc} value={inc}>{inc}</option>
              ))}
            </select>
          </div>

          {/* Subject Type Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Subject Type</label>
            <select
              value={selectedSubjectType}
              onChange={(e) => setSelectedSubjectType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Subject Types</option>
              {subjectTypeOptions.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Practical Form Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Practical Examination Form</label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Examination Forms</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.subjectCode}: {f.title} ({f.inchargeName || 'Incharge'})
                </option>
              ))}
            </select>
          </div>

          {/* Marks Status Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Marks Status</label>
            <select
              value={marksStatus}
              onChange={(e) => setMarksStatus(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ENTERED">Only Evaluated / Marks Entered</option>
              <option value="PENDING">Only Pending Marks</option>
            </select>
          </div>

          {/* Roll No / Name Search */}
          <div className="sm:col-span-2 md:col-span-4">
            <label className="block text-slate-400 mb-1 font-semibold">Search Candidate (Roll Number or Name)</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type Roll No or Student Name..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Export Buttons Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Filtered dataset: <strong className="text-emerald-400 font-mono font-bold">{filteredRecords.length} student records</strong> ready for 15-column export.
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadMasterExcel}
              disabled={downloading || filteredRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Master Excel (15 Columns)</span>
            </button>

            <button
              onClick={handleDownloadZipArchive}
              disabled={downloading || filteredRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Download Department ZIP Archive</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Preview Table — EXACT 15 COLUMNS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Official 15-Column Export Preview
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing {Math.min(50, filteredRecords.length)} of {filteredRecords.length} records
          </span>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800 z-10">
              <tr>
                <th className="py-2.5 px-3 text-center">1. SN.</th>
                <th className="py-2.5 px-3">2. Session</th>
                <th className="py-2.5 px-3">3. Semester</th>
                <th className="py-2.5 px-3">4. Department</th>
                <th className="py-2.5 px-3">5. Incharge Name</th>
                <th className="py-2.5 px-3">6. Practical Subject</th>
                <th className="py-2.5 px-3 text-center">7. Subject Type</th>
                <th className="py-2.5 px-3 text-center">8. Paper</th>
                <th className="py-2.5 px-3">9. Roll Number</th>
                <th className="py-2.5 px-3">10. Student Name</th>
                <th className="py-2.5 px-3">11. Father's Name</th>
                <th className="py-2.5 px-3 text-center">12. Max Marks</th>
                <th className="py-2.5 px-3 text-center">13. Min Marks</th>
                <th className="py-2.5 px-3 text-center">14. Obtained Marks</th>
                <th className="py-2.5 px-3 text-center">15. Marks Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredRecords.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-2 px-3 font-mono text-slate-300">{r.session}</td>
                  <td className="py-2 px-3 text-slate-300">{r.semester}</td>
                  <td className="py-2 px-3 text-slate-300">{r.departmentName}</td>
                  <td className="py-2 px-3 text-slate-200 font-semibold">{r.inchargeName}</td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {r.practicalSubject}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-slate-400">{r.subjectType}</td>
                  <td className="py-2 px-3 text-center font-mono text-slate-300">{r.paper}</td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-100">{r.rollNumber}</td>
                  <td className="py-2 px-3 text-slate-100 font-medium">{r.studentName}</td>
                  <td className="py-2 px-3 text-slate-400">{r.fatherName}</td>
                  <td className="py-2 px-3 text-center font-mono text-slate-400">{r.maxMarks}</td>
                  <td className="py-2 px-3 text-center font-mono text-slate-400">{r.minPassingMarks}</td>
                  <td className="py-2 px-3 text-center font-mono font-bold text-emerald-400 text-sm">
                    {r.marksObtained}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        r.marksStatus === 'PRESENT'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.marksStatus === 'ABSENT'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {r.marksStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
