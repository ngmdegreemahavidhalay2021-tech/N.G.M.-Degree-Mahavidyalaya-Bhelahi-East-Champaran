import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users,
  FileEdit,
  Award,
  BarChart3,
  FileSpreadsheet,
  Settings,
  History,
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Calendar,
  Layers,
  Palette,
  Link2,
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

// Exactly 7 Collapsible Groups in exact order requested in master brief
const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'dashboard',
    title: '1. Dashboard',
    icon: LayoutDashboard,
    items: [
      { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    ],
  },
  {
    id: 'academic',
    title: '2. Academic Management',
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
    title: '3. Student Management',
    icon: Users,
    items: [
      { key: 'students', label: 'Student Directory & Upload', icon: Users },
    ],
  },
  {
    id: 'examination',
    title: '4. Examination Management',
    icon: FileEdit,
    items: [
      { key: 'builder', label: 'Practical Form Builder', icon: FileEdit },
      { key: 'links', label: 'Examiner Links & Tokens', icon: Link2 },
      { key: 'marks', label: 'Marks Management', icon: Award },
    ],
  },
  {
    id: 'reports',
    title: '5. Reports & Exports',
    icon: BarChart3,
    items: [
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { key: 'export', label: 'Export Center', icon: FileSpreadsheet },
    ],
  },
  {
    id: 'administration',
    title: '6. Administration',
    icon: Settings,
    items: [
      { key: 'settings', label: 'Admin Settings', icon: Settings },
      { key: 'appearance-settings', label: 'System Customization', icon: Palette },
      { key: 'logs', label: 'Activity Logs', icon: History },
    ],
  },
  {
    id: 'account',
    title: '7. My Account',
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
}) => {
  // Master requirement: COLLAPSED by default on login with accordion behavior
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const toggleGroup = (groupId: string) => {
    setOpenGroupId((current) => (current === groupId ? null : groupId));
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

      {/* 7 Grouped Navigation List */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
        {MENU_GROUPS.map((group) => {
          const isOpen = openGroupId === group.id;
          const hasActiveChild = group.items.some((i) => i.key === activeModule);

          return (
            <div key={group.id} className="space-y-1">
              {/* Collapsible Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold tracking-wide transition ${
                  hasActiveChild
                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <group.icon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate">{group.title}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-70 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-70 text-slate-400" />
                )}
              </button>

              {/* Group Items (Accordion expanded when open) */}
              {isOpen && (
                <div className="space-y-1 pl-3 pt-1 border-l-2 border-slate-800 ml-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeModule === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSelectModule(item.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? 'text-white' : 'text-slate-500'
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
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <button
            type="button"
            onClick={() => onSelectModule('profile')}
            className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-80 transition cursor-pointer"
            title="View Profile"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0 shadow-sm">
              {adminUsername.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-200 truncate">{adminUsername}</p>
              <p className="text-[10px] text-emerald-400 font-mono leading-none">System Admin</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Sign out of Admin session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
