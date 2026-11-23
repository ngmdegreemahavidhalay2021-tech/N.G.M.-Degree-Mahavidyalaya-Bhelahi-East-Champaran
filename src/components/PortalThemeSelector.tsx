import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { AppearanceMode } from '../types';
import { PortalScope, usePortalTheme } from '../lib/themeManager';

interface PortalThemeSelectorProps {
  scope: PortalScope;
  compact?: boolean;
  value?: AppearanceMode;
  onChange?: (mode: AppearanceMode) => void;
}

const OPTIONS: Array<{
  id: AppearanceMode;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'light', label: 'Light Mode', shortLabel: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark Mode', shortLabel: 'Dark', icon: Moon },
  { id: 'system', label: 'System Default', shortLabel: 'System', icon: Laptop },
];

export const PortalThemeSelector: React.FC<PortalThemeSelectorProps> = ({
  scope,
  compact = true,
  value,
  onChange,
}) => {
  const { mode: hookMode, setMode: hookSetMode } = usePortalTheme(scope);
  const activeMode = value ?? hookMode;

  const handleSelect = (nextMode: AppearanceMode) => {
    hookSetMode(nextMode);
    onChange?.(nextMode);
  };

  if (compact) {
    return (
      <div
        role="group"
        aria-label="Theme Preference"
        data-theme-selector={scope}
        className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-700/80 shadow-sm shrink-0"
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = activeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              title={opt.label}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Interface Theme"
      data-theme-selector={scope}
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSelected = activeMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleSelect(opt.id)}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/30 text-slate-900 dark:text-slate-100'
                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{opt.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {opt.id === 'light'
                  ? 'Bright institutional palette'
                  : opt.id === 'dark'
                    ? 'Low-glare dark workspace'
                    : 'Follows device preference'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
