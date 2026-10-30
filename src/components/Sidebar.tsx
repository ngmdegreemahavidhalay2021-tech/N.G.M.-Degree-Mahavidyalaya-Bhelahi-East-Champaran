import React from 'react';
import {
  LayoutDashboard,
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
  LogOut,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export type SidebarModuleKey =
  | 'overview'
  | 'departments'
  | 'subjects'
  | 'builder'
  | 'students'
  | 'marks'
  | 'links'
  | 'export'
  | 'reports'
  | 'logs'
  | 'settings';

interface SidebarProps {
  activeModule: SidebarModuleKey;
  onSelectModule: (key: SidebarModuleKey) => void;
  collegeName: string;
  adminUsername?: string;
  onLogout: () => void;
  onOpenDeploymentGuide: () => void;
  onSeedDemoData: () => void;
}

const menuItems: Array<{ key: SidebarModuleKey; label: string; icon: React.FC<{ className?: string }> }> = [
  { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { key: 'departments', label: 'Department Management', icon: Building2 },
  { key: 'subjects', label: 'Subject Management', icon: BookOpen },
  { key: 'builder', label: 'Practical Form Builder', icon: FileEdit },
  { key: 'students', label: 'Student Management', icon: Users },
  { key: 'marks', label: 'Marks Management', icon: Award },
  { key: 'links', label: 'Form Link Management', icon: Link2 },
  { key: 'export', label: 'Export Center', icon: FileSpreadsheet },
  { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { key: 'logs', label: 'Activity Logs', icon: History },
  { key: 'settings', label: 'Admin Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  collegeName,
  adminUsername = 'Administrator',
  onLogout,
  onOpenDeploymentGuide,
  onSeedDemoData,
}) => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* College Logo / Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-md shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-slate-100 truncate" title={collegeName}>
              {collegeName}
            </h1>
            <p className="text-[11px] text-blue-400 font-medium">Exam Administration ERP</p>
          </div>
        </div>
      </div>

      {/* Navigation Modules List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Management Modules
        </div>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelectModule(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-3 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Support & Seeding
        </div>

        <button
          onClick={onOpenDeploymentGuide}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
        >
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Vercel Deploy Guide</span>
        </button>

        <button
          onClick={onSeedDemoData}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
          title="Seed demo departments, subjects and students"
        >
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Seed College Sample</span>
        </button>
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 uppercase">
              {adminUsername.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{adminUsername}</p>
              <p className="text-[10px] text-emerald-400 font-mono">Permanent Admin</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Log out of Admin session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
