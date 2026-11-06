import React from 'react';
import {
  GraduationCap,
  ShieldCheck,
  LogOut,
  FileSpreadsheet,
  BookOpen,
  Lock,
  Layers,
  HelpCircle,
  History,
} from 'lucide-react';
import { AdminProfile, SystemBootstrapStatus } from '../types';

interface NavbarProps {
  admin: AdminProfile | null;
  bootstrapStatus: SystemBootstrapStatus | null;
  onLogout: () => void;
  onOpenDeploymentGuide: () => void;
  onOpenAuditLogs: () => void;
  onOpenAdminProfile: () => void;
  activeView: 'dashboard' | 'examiner' | 'exam_detail';
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  admin,
  bootstrapStatus,
  onLogout,
  onOpenDeploymentGuide,
  onOpenAuditLogs,
  onOpenAdminProfile,
  activeView,
  onNavigateHome,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div
            onClick={onNavigateHome}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 tracking-tight text-base sm:text-lg">
                  {bootstrapStatus?.institutionName || 'NGM Degree Mahavidyalaya'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Practical Exam ERP
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Practical Examination Marks Management & Evaluation System
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Deployment Guide Trigger */}
            <button
              onClick={onOpenDeploymentGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
              title="View GitHub & Vercel deployment walkthrough"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Deployment Guide</span>
            </button>

            {/* Audit Trail Button */}
            {admin && (
              <button
                onClick={onOpenAuditLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                title="System Security Audit Trail"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Audit Trail</span>
              </button>
            )}

            {/* Admin Profile / Auth */}
            {admin ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div
                  onClick={onOpenAdminProfile}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 cursor-pointer border border-slate-700/50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-xs font-bold text-indigo-300 uppercase">
                    {admin.username.charAt(0)}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-semibold text-slate-200 leading-none">
                      {admin.username}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-mono leading-tight mt-0.5">
                      Administrator
                    </p>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Sign out of Admin session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <Lock className="w-3 h-3" />
                  {bootstrapStatus?.isBootstrapped ? 'Staff / Examiner Mode' : 'Initial Bootstrap Mode'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
