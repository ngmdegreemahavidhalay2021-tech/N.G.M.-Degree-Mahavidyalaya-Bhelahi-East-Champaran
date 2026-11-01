/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Building2,
  BookOpen,
  FileEdit,
  Users,
  Award,
  Link2,
  FileSpreadsheet,
  BarChart3,
  History,
  Settings,
  Sparkles,
  KeyRound,
  ArrowRight,
  LogOut,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sidebar, SidebarModuleKey } from './components/Sidebar';
import { DepartmentModule } from './components/DepartmentModule';
import { SubjectModule } from './components/SubjectModule';
import { FormBuilderModule } from './components/FormBuilderModule';
import { StudentModule } from './components/StudentModule';
import { MarksModule } from './components/MarksModule';
import { LinkManagementModule } from './components/LinkManagementModule';
import { ExportCenterModule } from './components/ExportCenterModule';
import { ReportsModule } from './components/ReportsModule';
import { ActivityLogsModule } from './components/ActivityLogsModule';
import { AdminSettingsModule } from './components/AdminSettingsModule';
import { PublicPracticalForm } from './components/PublicPracticalForm';
import { AdminLoginModal } from './components/AdminLoginModal';
import { BootstrapSetupModal } from './components/BootstrapSetupModal';
import { PasswordRecoveryModal } from './components/PasswordRecoveryModal';
import { DeploymentGuideModal } from './components/DeploymentGuideModal';
import { PortalLoginPage } from './components/PortalLoginPage';
import { ProfileModule } from './components/ProfileModule';
import { AcademicSessionModule } from './components/AcademicSessionModule';
import { SemesterModule } from './components/SemesterModule';
import { SystemSettingsModule } from './components/SystemSettingsModule';
import {
  Department,
  Subject,
  PracticalForm,
  Student,
  AdminProfile,
  SystemBootstrapStatus,
  CollegeStats,
  AppearanceSettings,
} from './types';
import {
  getDepartments,
  getSubjects,
  getPracticalForms,
  getStudents,
  getCollegeStats,
  seedInitialCollegeData,
  logActivity,
  getAppearanceSettings,
} from './services/collegeService';
import { fetchBootstrapStatus } from './services/examService';

export default function App() {
  // Navigation & View State
  const [activeModule, setActiveModule] = useState<SidebarModuleKey>('overview');
  const [selectedFormForMarks, setSelectedFormForMarks] = useState<string | undefined>();
  const [publicFormToken, setPublicFormToken] = useState<string | null>(null);

  // College Data Models
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [forms, setForms] = useState<PracticalForm[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<CollegeStats>({
    totalDepartments: 0,
    totalSubjects: 0,
    totalPracticalForms: 0,
    totalStudents: 0,
    totalMarksSubmitted: 0,
    pendingMarksEntries: 0,
    activeFormLinks: 0,
    closedForms: 0,
  });

  // Auth & Bootstrap
  const [bootstrapStatus, setBootstrapStatus] = useState<SystemBootstrapStatus | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [collegeName, setCollegeName] = useState('NGM Degree Mahavidyalaya');
  const [loading, setLoading] = useState(true);

  // Appearance Customization State
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    appearanceMode: 'dark',
    selectedFont: 'Inter',
    selectedTheme: 'blue',
  });

  // Modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showDeploymentGuide, setShowDeploymentGuide] = useState(false);

  // Apply Appearance Theme & Typography to Document
  const applyAppearance = (settings: AppearanceSettings) => {
    // 1. Dark/Light Mode
    const root = document.documentElement;
    if (settings.appearanceMode === 'light') {
      root.classList.remove('dark');
    } else if (settings.appearanceMode === 'dark') {
      root.classList.add('dark');
    } else {
      // System default
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // 2. Font Family
    const FONT_MAP: Record<string, string> = {
      Inter: 'Inter, system-ui, sans-serif',
      Roboto: 'Roboto, sans-serif',
      Poppins: 'Poppins, sans-serif',
      'Open Sans': '"Open Sans", sans-serif',
      Lato: 'Lato, sans-serif',
      Arial: 'Arial, sans-serif',
      'System Default': 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    };
    const targetFont = FONT_MAP[settings.selectedFont] || 'Inter, system-ui, sans-serif';
    document.body.style.fontFamily = targetFont;

    // 3. Theme Attribute
    root.setAttribute('data-theme', settings.selectedTheme || 'blue');
  };

  const handleAppearanceChanged = (newSettings: AppearanceSettings) => {
    setAppearanceSettings(newSettings);
    applyAppearance(newSettings);
  };

  // Read URL query params on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('key');
    if (token) {
      setPublicFormToken(token);
    }

    initSystem();
  }, []);

  const initSystem = async () => {
    try {
      setLoading(true);
      const [bStatus, appSettings] = await Promise.all([
        fetchBootstrapStatus(),
        getAppearanceSettings().catch(() => ({
          appearanceMode: 'dark' as const,
          selectedFont: 'Inter' as const,
          selectedTheme: 'blue' as const,
        })),
      ]);

      setBootstrapStatus(bStatus);
      if (bStatus.institutionName) {
        setCollegeName(bStatus.institutionName);
      }

      if (appSettings) {
        setAppearanceSettings(appSettings);
        applyAppearance(appSettings);
      }

      // Check saved session
      const savedToken = localStorage.getItem('admin_session_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/auth/verify-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${savedToken}`,
            },
            body: JSON.stringify({ token: savedToken }),
          });
          const data = await res.json();
          if (data.valid && data.admin) {
            setAdmin(data.admin);
          } else {
            localStorage.removeItem('admin_session_token');
          }
        } catch {
          // Token verification failed
        }
      }

      await loadCollegeDatabase();
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCollegeDatabase = async () => {
    try {
      const [d, s, f, st, stt] = await Promise.all([
        getDepartments().catch((err) => {
          console.warn('Departments fetch warning:', err);
          return [];
        }),
        getSubjects().catch((err) => {
          console.warn('Subjects fetch warning:', err);
          return [];
        }),
        getPracticalForms().catch((err) => {
          console.warn('Practical forms fetch warning:', err);
          return [];
        }),
        getStudents().catch((err) => {
          console.warn('Students fetch warning:', err);
          return [];
        }),
        getCollegeStats().catch((err) => {
          console.warn('Stats fetch warning:', err);
          return null;
        }),
      ]);
      setDepartments(d || []);
      setSubjects(s || []);
      setForms(f || []);
      setStudents(st || []);
      if (stt) {
        setStats(stt);
      }
    } catch (err) {
      console.warn('Could not load college database collections:', err);
    }
  };

  const handleSeedDemoData = async () => {
    try {
      setLoading(true);
      await seedInitialCollegeData();
      await loadCollegeDatabase();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error('Seeding error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auth Handlers
  const handleLoginSuccess = (adminProfile: AdminProfile, sessionToken: string) => {
    setAdmin(adminProfile);
    localStorage.setItem('admin_session_token', sessionToken);
    setShowLoginModal(false);
    setShowBootstrapModal(false);
    loadCollegeDatabase();
  };

  const handleRequireSetup = (tokenStr: string) => {
    setSetupToken(tokenStr);
    setShowLoginModal(false);
    setShowBootstrapModal(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    localStorage.removeItem('admin_session_token');
    setAdmin(null);
  };

  // Loading screen with institutional seal
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-2xl shadow-blue-500/30 mb-5 animate-pulse">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-blue-400" />
          </div>
        </div>
        <h2 className="text-base font-bold text-white tracking-tight">{collegeName}</h2>
        <p className="text-xs text-blue-400 font-medium mt-1">Practical Examination Marks Administration ERP</p>
        <div className="mt-6 flex items-center gap-2.5 text-xs text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span>Connecting to Firebase Firestore...</span>
        </div>
      </div>
    );
  }

  // Public Teacher / Examiner Form Route
  if (publicFormToken) {
    return (
      <PublicPracticalForm
        token={publicFormToken}
        collegeName={collegeName}
        onExit={() => {
          setPublicFormToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  // UN-AUTHENTICATED PORTAL ACCESS GATE
  // Portal link must open login first; never allow unauthenticated users to view the Dashboard
  if (!admin) {
    return (
      <>
        <PortalLoginPage
          collegeName={collegeName}
          onLoginSuccess={handleLoginSuccess}
          onRequireSetup={handleRequireSetup}
          onOpenRecovery={() => setShowRecoveryModal(true)}
          onOpenDeployGuide={() => setShowDeploymentGuide(true)}
        />

        {showBootstrapModal && setupToken && (
          <BootstrapSetupModal
            setupToken={setupToken}
            defaultInstitution={collegeName}
            onSuccess={(newAdmin, newToken) => {
              setAdmin(newAdmin);
              localStorage.setItem('admin_session_token', newToken);
              setShowBootstrapModal(false);
              setSetupToken(null);
              initSystem();
            }}
            onCancel={() => {
              setShowBootstrapModal(false);
              setSetupToken(null);
            }}
          />
        )}

        {showRecoveryModal && (
          <PasswordRecoveryModal
            onClose={() => setShowRecoveryModal(false)}
            onSuccess={() => {
              setShowRecoveryModal(false);
            }}
          />
        )}

        {showDeploymentGuide && (
          <DeploymentGuideModal onClose={() => setShowDeploymentGuide(false)} />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex antialiased">
      {/* 7 Group Collapsible Sidebar */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        collegeName={collegeName}
        adminUsername={admin?.username}
        onLogout={handleLogout}
        onOpenDeploymentGuide={() => setShowDeploymentGuide(true)}
        onSeedDemoData={handleSeedDemoData}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-100 text-sm sm:text-base">
              {collegeName}
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Practical Examination Marks ERP
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeploymentGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deployment Guide</span>
            </button>

            {admin ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <span className="text-xs text-slate-300 font-semibold font-mono hidden md:inline">
                  {admin.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Bootstrap Notice Banner (if system is pending first-time admin setup) */}
          {!loading && !bootstrapStatus?.isBootstrapped && !admin && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-emerald-500/10 border border-amber-500/30 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-amber-300">
                      System Ready for First-Time Administrator Bootstrap
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400 text-slate-950 uppercase">
                      Setup Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    First-time setup mode is active. Log in with initial credentials:{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono">
                      Username: ADMIN
                    </code>{' '}
                    &{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono">
                      Password: 123
                    </code>{' '}
                    to configure your permanent identity.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 whitespace-nowrap transition-all"
              >
                <KeyRound className="w-4 h-4" />
                <span>Initialize Admin</span>
              </button>
            </div>
          )}

          {/* MODULE 1: DASHBOARD OVERVIEW */}
          {activeModule === 'overview' && (
            <div className="space-y-6">
              {/* College Hero Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>College Examination Management ERP</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                    {collegeName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Centralized platform for unlimited departments, subjects, practical examination form builders, verified student rosters, and teacher evaluation links.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setActiveModule('builder')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all"
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>Build Practical Form</span>
                  </button>

                  {departments.length === 0 && (
                    <button
                      onClick={handleSeedDemoData}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Seed Sample Architecture</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 8 Statistics Cards (from Section 3) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveModule('departments')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Departments
                  </span>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{departments.length}</p>
                  <span className="text-[11px] text-blue-400 mt-0.5 block">View faculty depts</span>
                </div>

                <div
                  onClick={() => setActiveModule('subjects')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Subjects
                  </span>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{subjects.length}</p>
                  <span className="text-[11px] text-blue-400 mt-0.5 block">Curriculum subjects</span>
                </div>

                <div
                  onClick={() => setActiveModule('builder')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Practical Forms & Papers
                  </span>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{stats.totalPracticalForms || forms.length}</p>
                  <span className="text-[11px] text-blue-400 mt-0.5 block">Examination forms & papers</span>
                </div>

                <div
                  onClick={() => setActiveModule('students')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Total Students
                  </span>
                  <p className="text-2xl font-bold text-slate-100 mt-1">{stats.totalStudents || students.length}</p>
                  <span className="text-[11px] text-blue-400 mt-0.5 block">Permanent student IDs</span>
                </div>

                <div
                  onClick={() => setActiveModule('marks')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                    Marks Submitted
                  </span>
                  <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.totalMarksSubmitted}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Evaluated candidates</span>
                </div>

                <div
                  onClick={() => setActiveModule('marks')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                    Pending Marks Entries
                  </span>
                  <p className="text-2xl font-bold text-amber-300 mt-1">{stats.pendingMarksEntries}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Awaiting evaluation</span>
                </div>

                <div
                  onClick={() => setActiveModule('links')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block">
                    Active Form Links
                  </span>
                  <p className="text-2xl font-bold text-cyan-300 mt-1">{stats.activeFormLinks}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Public tokens live</span>
                </div>

                <div
                  onClick={() => setActiveModule('builder')}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-rose-500/40 rounded-2xl shadow-sm cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
                    Closed Forms
                  </span>
                  <p className="text-2xl font-bold text-rose-300 mt-1">{stats.closedForms}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Locked archives</span>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div
                  onClick={() => setActiveModule('builder')}
                  className="p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl shadow-md cursor-pointer transition-all space-y-2 group"
                >
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 w-fit">
                    <FileEdit className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm group-hover:text-blue-300 transition-colors">
                    Build New Practical Examination
                  </h3>
                  <p className="text-xs text-slate-400">
                    Create Google Forms-style practical evaluation forms with isolated access tokens.
                  </p>
                </div>

                <div
                  onClick={() => setActiveModule('export')}
                  className="p-5 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl shadow-md cursor-pointer transition-all space-y-2 group"
                >
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm group-hover:text-emerald-300 transition-colors">
                    Advanced College Export Center
                  </h3>
                  <p className="text-xs text-slate-400">
                    Export entire college marks, multi-sheet workbooks, or department ZIP archives.
                  </p>
                </div>

                <div
                  onClick={() => setActiveModule('links')}
                  className="p-5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-2xl shadow-md cursor-pointer transition-all space-y-2 group"
                >
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm group-hover:text-cyan-300 transition-colors">
                    Form Link Management
                  </h3>
                  <p className="text-xs text-slate-400">
                    Shareable public subject URLs for external examiners (no login needed).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ACADEMIC SESSIONS MANAGEMENT */}
          {activeModule === 'academic-sessions' && <AcademicSessionModule />}

          {/* ACADEMIC SEMESTER MANAGEMENT */}
          {activeModule === 'semesters' && <SemesterModule />}

          {/* MODULE 2: DEPARTMENT MANAGEMENT */}
          {activeModule === 'departments' && (
            <DepartmentModule
              departments={departments}
              subjects={subjects}
              forms={forms}
              students={students}
              onRefresh={loadCollegeDatabase}
            />
          )}

          {/* MODULE 3: SUBJECT MANAGEMENT */}
          {activeModule === 'subjects' && (
            <SubjectModule
              subjects={subjects}
              departments={departments}
              forms={forms}
              onRefresh={loadCollegeDatabase}
              onCreateFormForSubject={(subj) => {
                setActiveModule('builder');
              }}
            />
          )}

          {/* MODULE 4: PRACTICAL FORM BUILDER */}
          {activeModule === 'builder' && (
            <FormBuilderModule
              forms={forms}
              departments={departments}
              subjects={subjects}
              onRefresh={loadCollegeDatabase}
              onOpenMarksView={(form) => {
                setSelectedFormForMarks(form.id);
                setActiveModule('marks');
              }}
              onOpenStudentEnrollment={(form) => {
                setSelectedFormForMarks(form.id);
                setActiveModule('marks');
              }}
            />
          )}

          {/* MODULE 5: STUDENT MANAGEMENT */}
          {activeModule === 'students' && (
            <StudentModule
              students={students}
              departments={departments}
              onRefresh={loadCollegeDatabase}
            />
          )}

          {/* MODULE 6: MARKS MANAGEMENT */}
          {activeModule === 'marks' && (
            <MarksModule
              forms={forms}
              departments={departments}
              selectedFormId={selectedFormForMarks}
              onRefresh={loadCollegeDatabase}
            />
          )}

          {/* MODULE 7: FORM LINK MANAGEMENT */}
          {activeModule === 'links' && (
            <LinkManagementModule
              forms={forms}
              departments={departments}
              onRefresh={loadCollegeDatabase}
              onOpenPublicPreview={(token) => setPublicFormToken(token)}
            />
          )}

          {/* MODULE 8: EXPORT CENTER */}
          {activeModule === 'export' && (
            <ExportCenterModule
              departments={departments}
              subjects={subjects}
              forms={forms}
              collegeName={collegeName}
            />
          )}

          {/* MODULE 9: REPORTS */}
          {activeModule === 'reports' && (
            <ReportsModule
              departments={departments}
              subjects={subjects}
              forms={forms}
              students={students}
              collegeName={collegeName}
            />
          )}

          {/* MODULE 10: ACTIVITY LOGS */}
          {activeModule === 'logs' && <ActivityLogsModule />}

          {/* MODULE 11: ADMIN SETTINGS */}
          {activeModule === 'settings' && (
            <AdminSettingsModule
              admin={admin}
              bootstrapStatus={bootstrapStatus}
              onUpdateInstitutionName={(name) => {
                setCollegeName(name);
                logActivity('INSTITUTION_NAME_UPDATED', `Updated college identity to ${name}`);
              }}
            />
          )}

          {/* SYSTEM SETTINGS & APPEARANCE CUSTOMIZATION */}
          {activeModule === 'appearance-settings' && (
            <SystemSettingsModule
              currentSettings={appearanceSettings}
              onSettingsChanged={handleAppearanceChanged}
              collegeName={collegeName}
            />
          )}

          {/* MY PROFILE */}
          {activeModule === 'profile' && admin && (
            <ProfileModule
              admin={admin}
              onProfileUpdated={(updated) => setAdmin(updated)}
              initialTab="profile"
            />
          )}

          {/* CHANGE PASSWORD */}
          {activeModule === 'change-password' && admin && (
            <ProfileModule
              admin={admin}
              onProfileUpdated={(updated) => setAdmin(updated)}
              initialTab="password"
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      {showLoginModal && (
        <AdminLoginModal
          bootstrapStatus={bootstrapStatus}
          onLoginSuccess={handleLoginSuccess}
          onRequireSetup={handleRequireSetup}
          onOpenRecovery={() => {
            setShowLoginModal(false);
            setShowRecoveryModal(true);
          }}
          onOpenDeploymentGuide={() => {
            setShowLoginModal(false);
            setShowDeploymentGuide(true);
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {showBootstrapModal && setupToken && (
        <BootstrapSetupModal
          setupToken={setupToken}
          defaultInstitution={collegeName}
          onSuccess={(newAdmin, newToken) => {
            setAdmin(newAdmin);
            localStorage.setItem('admin_session_token', newToken);
            setShowBootstrapModal(false);
            setSetupToken(null);
            initSystem();
          }}
          onCancel={() => {
            setShowBootstrapModal(false);
            setSetupToken(null);
          }}
        />
      )}

      {showRecoveryModal && (
        <PasswordRecoveryModal
          onClose={() => setShowRecoveryModal(false)}
          onSuccess={() => {
            setShowRecoveryModal(false);
            setShowLoginModal(true);
          }}
        />
      )}

      {showDeploymentGuide && (
        <DeploymentGuideModal onClose={() => setShowDeploymentGuide(false)} />
      )}
    </div>
  );
}
