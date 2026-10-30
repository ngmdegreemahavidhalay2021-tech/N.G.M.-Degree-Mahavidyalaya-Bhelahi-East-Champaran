import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  X,
  FileDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Department } from '../types';
import {
  createStudent,
  updateStudent,
  deleteStudent,
  batchImportStudents,
} from '../services/collegeService';

interface StudentModuleProps {
  students: Student[];
  departments: Department[];
  onRefresh: () => void;
}

export const StudentModule: React.FC<StudentModuleProps> = ({
  students,
  departments,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Single Student State
  const [rollNumber, setRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [course, setCourse] = useState('B.Sc. Computer Science');
  const [semester, setSemester] = useState('Semester III');
  const [section, setSection] = useState('Section A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Excel Upload Preview State
  const [parsedRows, setParsedRows] = useState<
    Array<{ rollNumber: string; studentName: string; isValid: boolean; error?: string }>
  >([]);
  const [uploadDeptId, setUploadDeptId] = useState(departments[0]?.id || '');
  const [uploadCourse, setUploadCourse] = useState('B.Sc. Computer Science');
  const [uploadSemester, setUploadSemester] = useState('Semester III');
  const [uploadSection, setUploadSection] = useState('Section A');
  const [uploadLoading, setUploadLoading] = useState(false);

  const handleOpenAdd = () => {
    setRollNumber('');
    setStudentName('');
    setDepartmentId(departments[0]?.id || '');
    setCourse('B.Sc. Computer Science');
    setSemester('Semester III');
    setSection('Section A');
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (s: Student) => {
    setEditingStudent(s);
    setRollNumber(s.rollNumber);
    setStudentName(s.studentName);
    setDepartmentId(s.departmentId);
    setCourse(s.course);
    setSemester(s.semester);
    setSection(s.section || '');
    setError(null);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !studentName.trim() || !departmentId) {
      setError('Roll number, student name and department are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          rollNumber: rollNumber.trim().toUpperCase(),
          studentName: studentName.trim(),
          departmentId,
          course,
          semester,
          section,
        });
        setEditingStudent(null);
      } else {
        await createStudent({
          rollNumber: rollNumber.trim().toUpperCase(),
          studentName: studentName.trim(),
          departmentId,
          course,
          semester,
          section,
        });
        setShowAddModal(false);
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nameStr: string, roll: string) => {
    const ok = window.confirm(
      `Delete student record for ${nameStr} (${roll})?\nHistorical marks in past practical forms will remain intact.`
    );
    if (!ok) return;

    try {
      await deleteStudent(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete student');
    }
  };

  // Excel / CSV File Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length < 2) {
          alert('Spreadsheet is empty or missing data rows.');
          return;
        }

        const rows: Array<{ rollNumber: string; studentName: string; isValid: boolean; error?: string }> = [];
        const seenRolls = new Set<string>();

        // Find header row or use row index 0
        const startRow = 1;

        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const rawRoll = String(row[0] || '').trim().toUpperCase();
          const rawName = String(row[1] || '').trim();

          if (!rawRoll && !rawName) continue;

          let isValid = true;
          let rowError = '';

          if (!rawRoll) {
            isValid = false;
            rowError = 'Missing roll number';
          } else if (!rawName) {
            isValid = false;
            rowError = 'Missing student name';
          } else if (seenRolls.has(rawRoll)) {
            isValid = false;
            rowError = 'Duplicate roll number in this file';
          } else if (students.some((s) => s.rollNumber.toUpperCase() === rawRoll)) {
            // Note: will update or warn
            rowError = 'Existing student (will update)';
          }

          if (rawRoll) seenRolls.add(rawRoll);

          rows.push({
            rollNumber: rawRoll,
            studentName: rawName,
            isValid,
            error: rowError,
          });
        }

        setParsedRows(rows);
      } catch (err: any) {
        alert('Could not parse file. Please upload a valid .xlsx, .xls or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Commit Excel Import to Firestore
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert('No valid student rows to import.');
      return;
    }

    try {
      setUploadLoading(true);
      await batchImportStudents(
        validRows.map((r) => ({
          rollNumber: r.rollNumber,
          studentName: r.studentName,
          departmentId: uploadDeptId,
          course: uploadCourse,
          semester: uploadSemester,
          section: uploadSection,
        }))
      );

      setShowUploadModal(false);
      setParsedRows([]);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Batch import failed');
    } finally {
      setUploadLoading(false);
    }
  };

  // Download Sample Template
  const handleDownloadSampleTemplate = () => {
    const rows = [
      ['Roll Number', 'Student Name'],
      ['24CS001', 'Aarav Sharma'],
      ['24CS002', 'Priya Patel'],
      ['24CS003', 'Rohan Iyer'],
      ['24CS004', 'Ananya Roy'],
      ['24CS005', 'Vikram Singh'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Template');
    XLSX.writeFile(wb, 'Student_Import_Sample_Template.xlsx');
  };

  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.course.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'ALL' || s.departmentId === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">Student Candidate Management</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Maintain permanent student identities (permanent <code className="text-blue-400 font-mono">studentId</code>), roll numbers, department enrollments, and bulk spreadsheet imports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setParsedRows([]);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Excel / CSV Import</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by roll number or candidate name..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Filter Dept:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Total: <strong className="text-slate-200">{students.length}</strong>
          </span>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-28">Roll No</th>
                <th className="py-3 px-4">Candidate Full Name</th>
                <th className="py-3 px-4">Permanent ID</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Course & Semester</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-medium">No student records found</p>
                    <p className="text-xs text-slate-500">
                      Add students manually or import via Excel.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const dept = deptMap.get(student.departmentId);
                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">
                        {student.rollNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        {student.studentName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {student.id}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {dept ? `${dept.name} (${dept.code})` : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {student.course} • {student.semester} {student.section ? `(${student.section})` : ''}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(student)}
                            className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Edit student"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(student.id, student.studentName, student.rollNumber)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Delete student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Add / Edit Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingStudent(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-4">
              {editingStudent ? 'Edit Student Record' : 'Manual Student Entry'}
            </h3>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveSingle} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="24CS001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Department *
                  </label>
                  <select
                    required
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Full Candidate Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Rahul Kumar Sharma"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Course
                  </label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="B.Sc. CS"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="Semester III"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="Section A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : editingStudent ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel / CSV Bulk Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 my-6">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setParsedRows([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Excel / CSV Candidate Upload
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload .xlsx, .xls or .csv file. Columns required: <code className="text-emerald-400 font-mono">Roll Number | Student Name</code>
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sample Template</span>
              </button>
            </div>

            {/* Department & Batch defaults */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 mb-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Department</label>
                <select
                  value={uploadDeptId}
                  onChange={(e) => setUploadDeptId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Course</label>
                <input
                  type="text"
                  value={uploadCourse}
                  onChange={(e) => setUploadCourse(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Semester</label>
                <input
                  type="text"
                  value={uploadSemester}
                  onChange={(e) => setUploadSemester(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Section</label>
                <input
                  type="text"
                  value={uploadSection}
                  onChange={(e) => setUploadSection(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                />
              </div>
            </div>

            {/* File Drop Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-colors">
              <Upload className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <p className="text-xs font-semibold text-slate-200">
                Click to browse or drop candidate spreadsheet here
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Supports .xlsx, .xls and .csv</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="mt-3 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
              />
            </div>

            {/* Preview Section */}
            {parsedRows.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Parsed Rows ({parsedRows.length}):{' '}
                    <strong className="text-emerald-400">
                      {parsedRows.filter((r) => r.isValid).length} Valid
                    </strong>
                    {parsedRows.some((r) => !r.isValid) && (
                      <span className="text-rose-400 ml-2">
                        • {parsedRows.filter((r) => !r.isValid).length} Invalid
                      </span>
                    )}
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Roll No</th>
                        <th className="py-2 px-3">Student Name</th>
                        <th className="py-2 px-3 text-right">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={row.isValid ? '' : 'bg-rose-950/20'}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-200">{row.rollNumber}</td>
                          <td className="py-2 px-3 text-slate-300">{row.studentName}</td>
                          <td className="py-2 px-3 text-right">
                            {row.isValid ? (
                              <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-end gap-1">
                                <CheckCircle className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-400 font-semibold flex items-center justify-end gap-1">
                                <AlertTriangle className="w-3 h-3" /> {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800 mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setParsedRows([]);
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={uploadLoading || parsedRows.filter((r) => r.isValid).length === 0}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {uploadLoading ? (
                  'Importing to Database...'
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Import {parsedRows.filter((r) => r.isValid).length} Candidates</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
