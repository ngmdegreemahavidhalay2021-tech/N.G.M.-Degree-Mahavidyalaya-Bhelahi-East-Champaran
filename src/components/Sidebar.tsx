import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Layers,
  Building2,
  BookOpen,
  Users,
  FileEdit,
  Link2,
  Award,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Palette,
  History,
  User,
  KeyRound,
  LogOut,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export type SidebarModuleKey =
  | 'overview'
  | 'academic-sessions'
  | 'semesters'
  | 'departments'
  | 'subjects'
  | 'students'
  | 'builder'
  | 'links'
  | 'marks'
  | 'reports'
  | 'export'
  | 'settings'
  | 'appearance-settings'
  | 'logs'
  | 'profile'
  | 'change-password';

interface SidebarProps {
  activeModule: SidebarModuleKey;
  onSelectModule: (key: SidebarModuleKey) => void;
  collegeName: string;
  adminUsername?: string;
  onLogout: () => void;
  onOpenDeploymentGuide: () => void;
  onSeedDemoData: () => void;
}

interface MenuGroup {
  id: string;
  title: string;
  icon: React.FC<{ className?: string }>;
  items: Array<{
    key: SidebarModuleKey;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
  }>;
}

const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'dashboard',
    title: 'A. Dashboard',
    icon: LayoutDashboard,
    items: [
      { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    ],
  },
  {
    id: 'academic',
    title: 'B. Academic Management',
    icon: Building2,
    items: [
      { key: 'academic-sessions', label: 'Academic Sessions', icon: Calendar },
      { key: 'semesters', label: 'Semester Management', icon: Layers },
      { key: 'departments', label: 'Department Management', icon: Building2 },
      { key: 'subjects', label: 'Subject Management', icon: BookOpen },
    ],
  },
  {
    id: 'students',
    title: 'C. Student Management',
    icon: Users,
    items: [
      { key: 'students', label: 'Student Directory & Upload', icon: Users },
    ],
  },
  {
    id: 'examination',
    title: 'D. Examination Management',
    icon: FileEdit,
    items: [
      { key: 'builder', label: 'Practical Form Builder', icon: FileEdit },
      { key: 'links', label: 'Examiner Links & Tokens', icon: Link2 },
      { key: 'marks', label: 'Marks Management', icon: Award },
    ],
  },
  {
    id: 'reports',
    title: 'E. Reports & Exports',
    icon: BarChart3,
    items: [
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { key: 'export', label: 'Export Center', icon: FileSpreadsheet },
    ],
  },
  {
    id: 'administration',
    title: 'F. Administration',
    icon: Settings,
    items: [
      { key: 'settings', label: 'Admin Settings', icon: Settings },
      { key: 'appearance-settings', label: 'System Customization', icon: Palette },
      { key: 'logs', label: 'Activity Logs', icon: History },
    ],
  },
  {
    id: 'account',
    title: 'G. My Account',
    icon: User,
    items: [
      { key: 'profile', label: 'My Profile', icon: User },
      { key: 'change-password', label: 'Change Password', icon: KeyRound },
    ],
  },
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
  // Track open state of each group. Default all to true so user sees the organized structure.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Automatically ensure the group containing the active module is expanded
  useEffect(() => {
    const parentGroup = MENU_GROUPS.find((g) =>
      g.items.some((item) => item.key === activeModule)
    );
    if (parentGroup && collapsedGroups[parentGroup.id]) {
      setCollapsedGroups((prev) => ({ ...prev, [parentGroup.id]: false }));
    }
  }, [activeModule]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen select-none">
      {/* College Logo / Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-md shadow-blue-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xs font-bold text-slate-100 truncate" title={collegeName}>
              {collegeName}
            </h1>
            <p className="text-[10px] text-blue-400 font-semibold tracking-wide">
              EXAMINATION ERP
            </p>
          </div>
        </div>
      </div>

      {/* Grouped Navigation List */}
      <nav className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
        {MENU_GROUPS.map((group) => {
          const isCollapsed = !!collapsedGroups[group.id];
          const hasActiveChild = group.items.some((i) => i.key === activeModule);

          return (
            <div key={group.id} className="space-y-1">
              {/* Collapsible Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
                  hasActiveChild
                    ? 'text-blue-400 bg-blue-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{group.title}</span>
                </div>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                )}
              </button>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="space-y-0.5 pl-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => onSelectModule(item.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-white' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Support & Seeding Section */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Quick Actions
          </div>

          <button
            onClick={onOpenDeploymentGuide}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
          >
            <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Vercel Deploy Guide</span>
          </button>

          <button
            onClick={onSeedDemoData}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors text-left"
            title="Seed college sample departments, subjects, and students"
          >
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Seed College Sample</span>
          </button>
        </div>
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <button
            onClick={() => onSelectModule('profile')}
            className="flex items-center gap-2 overflow-hidden text-left hover:opacity-80 transition cursor-pointer"
            title="Open Admin Profile"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 uppercase shrink-0">
              {adminUsername.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{adminUsername}</p>
              <p className="text-[10px] text-emerald-400 font-mono">Permanent Admin</p>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            title="Log out of Admin session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
