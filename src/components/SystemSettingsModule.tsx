import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  Type,
  CheckCircle2,
  Sparkles,
  Save,
  RotateCcw,
  Eye,
  Sliders,
  Layers,
  Award,
  Database,
  Building,
} from 'lucide-react';
import {
  AppearanceSettings,
  AppearanceMode,
  AppearanceFont,
  AppearanceTheme,
} from '../types';
import {
  getAppearanceSettings,
  saveAppearanceSettings,
} from '../services/collegeService';

interface SystemSettingsModuleProps {
  currentSettings: AppearanceSettings;
  onSettingsChanged: (settings: AppearanceSettings) => void;
  collegeName: string;
}

const FONTS: Array<{ id: AppearanceFont; name: string; family: string }> = [
  { id: 'Inter', name: 'Inter (Default Modern)', family: 'Inter, system-ui, sans-serif' },
  { id: 'Roboto', name: 'Roboto (Google Standard)', family: 'Roboto, sans-serif' },
  { id: 'Poppins', name: 'Poppins (Geometric Clean)', family: 'Poppins, sans-serif' },
  { id: 'Open Sans', name: 'Open Sans (Neutral Legible)', family: '"Open Sans", sans-serif' },
  { id: 'Lato', name: 'Lato (Humanist Warm)', family: 'Lato, sans-serif' },
  { id: 'Arial', name: 'Arial (System Classic)', family: 'Arial, sans-serif' },
  { id: 'System Default', name: 'System Default Native', family: 'system-ui, -apple-system, sans-serif' },
];

const THEMES: Array<{
  id: AppearanceTheme;
  name: string;
  colorClass: string;
  bgHex: string;
  previewClass: string;
}> = [
  { id: 'blue', name: 'Royal Blue (Default)', colorClass: 'text-blue-400', bgHex: '#3b82f6', previewClass: 'from-blue-600 to-indigo-600' },
  { id: 'indigo', name: 'Deep Indigo', colorClass: 'text-indigo-400', bgHex: '#6366f1', previewClass: 'from-indigo-600 to-purple-600' },
  { id: 'green', name: 'Emerald Forest', colorClass: 'text-emerald-400', bgHex: '#10b981', previewClass: 'from-emerald-600 to-teal-600' },
  { id: 'purple', name: 'Academic Purple', colorClass: 'text-purple-400', bgHex: '#a855f7', previewClass: 'from-purple-600 to-pink-600' },
  { id: 'teal', name: 'Oceanic Teal', colorClass: 'text-teal-400', bgHex: '#14b8a6', previewClass: 'from-teal-600 to-cyan-600' },
  { id: 'slate', name: 'Graphite Slate', colorClass: 'text-slate-400', bgHex: '#64748b', previewClass: 'from-slate-600 to-zinc-700' },
  { id: 'rose', name: 'Crimson Rose', colorClass: 'text-rose-400', bgHex: '#f43f5e', previewClass: 'from-rose-600 to-red-600' },
];

export const SystemSettingsModule: React.FC<SystemSettingsModuleProps> = ({
  currentSettings,
  onSettingsChanged,
  collegeName,
}) => {
  const [mode, setMode] = useState<AppearanceMode>(currentSettings.appearanceMode || 'dark');
  const [font, setFont] = useState<AppearanceFont>(currentSettings.selectedFont || 'Inter');
  const [theme, setTheme] = useState<AppearanceTheme>(currentSettings.selectedTheme || 'blue');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(currentSettings.appearanceMode || 'dark');
    setFont(currentSettings.selectedFont || 'Inter');
    setTheme(currentSettings.selectedTheme || 'blue');
  }, [currentSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await saveAppearanceSettings({
        appearanceMode: mode,
        selectedFont: font,
        selectedTheme: theme,
      });
      onSettingsChanged(updated);
      setSuccessMsg('Appearance preferences permanently stored in Firebase Firestore!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults: AppearanceSettings = {
      appearanceMode: 'dark',
      selectedFont: 'Inter',
      selectedTheme: 'blue',
    };
    setMode('dark');
    setFont('Inter');
    setTheme('blue');

    try {
      setSaving(true);
      const updated = await saveAppearanceSettings(defaults);
      onSettingsChanged(updated);
      setSuccessMsg('Appearance preferences reset to default values.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const selectedThemeObj = THEMES.find((t) => t.id === theme) || THEMES[0];
  const selectedFontObj = FONTS.find((f) => f.id === font) || FONTS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">System Appearance & Customization</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>systemSettings/appearance</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Personalize display theme, color accents, and typography. Settings are saved permanently in Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 border border-slate-700/60 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving to Firestore...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Controls (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Appearance Mode */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>1. Appearance Mode</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Select between Dark, Light, or System-Adaptive visual modes.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark', label: 'Dark Mode', desc: 'Standard high-contrast dark theme', icon: Moon },
                { id: 'light', label: 'Light Mode', desc: 'Clean bright institutional palette', icon: Sun },
                { id: 'system', label: 'System Default', desc: 'Syncs with device appearance', icon: Laptop },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = mode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id as AppearanceMode)}
                    className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{item.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Accent & Brand Theme Colors */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Palette className="w-4 h-4 text-blue-400" />
              <span>2. Theme & Accent Colors</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Choose the accent color applied across navigation, active buttons, and indicators.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEMES.map((th) => {
                const isSelected = theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-slate-800 border-blue-500 ring-2 ring-blue-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-lg shrink-0 shadow"
                      style={{ backgroundColor: th.bgHex }}
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-200 truncate">{th.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{th.id}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Typography & Fonts */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Type className="w-4 h-4 text-emerald-400" />
              <span>3. Font Family Customization</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Select the preferred typeface for academic tables, buttons, and student reports.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FONTS.map((fn) => {
                const isSelected = font === fn.id;
                return (
                  <button
                    key={fn.id}
                    type="button"
                    onClick={() => setFont(fn.id)}
                    className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                    style={{ fontFamily: fn.family }}
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-200">{fn.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Ag 123 – Practical Marks Evaluation
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Live Preview Card */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sticky top-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Visual Preview</h3>
            </div>

            {/* Preview Box Container */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                mode === 'light'
                  ? 'bg-white text-slate-900 border-slate-200 shadow-xl'
                  : 'bg-slate-950 text-slate-100 border-slate-800 shadow-2xl'
              }`}
              style={{ fontFamily: selectedFontObj.family }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow"
                    style={{ backgroundColor: selectedThemeObj.bgHex }}
                  >
                    N
                  </div>
                  <div>
                    <h4 className="text-xs font-bold truncate">{collegeName}</h4>
                    <p className="text-[10px] text-slate-500">Marks Evaluation</p>
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"
                  style={{ backgroundColor: selectedThemeObj.bgHex }}
                >
                  {theme}
                </span>
              </div>

              {/* Sample Table Row */}
              <div className="my-4 space-y-2">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Sample Candidate Record
                </div>
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  mode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
                }`}>
                  <div>
                    <p className="font-bold">24BOT001 – Amit Kumar</p>
                    <p className="text-[11px] text-slate-500">MJC 1 (BOTANY) • 4-Year CBCS</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-500 text-sm">46.5</span>
                    <span className="text-[10px] text-slate-400 block font-semibold">PASS</span>
                  </div>
                </div>
              </div>

              {/* Sample Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-xl text-white font-semibold text-xs shadow flex items-center justify-center gap-2"
                  style={{ backgroundColor: selectedThemeObj.bgHex }}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Primary Theme Action</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="flex-1 py-1.5 px-2 rounded-lg text-center text-[11px] font-medium border border-slate-300 dark:border-slate-700">
                    Secondary Filter
                  </span>
                  <span className="flex-1 py-1.5 px-2 rounded-lg text-center text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Pass: 98%
                  </span>
                </div>
              </div>
            </div>

            {/* Config Summary */}
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Active Mode:</span>
                <span className="font-semibold text-white capitalize">{mode}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Font:</span>
                <span className="font-semibold text-white">{font}</span>
              </div>
              <div className="flex justify-between">
                <span>Accent Color:</span>
                <span className="font-semibold text-white capitalize">{theme}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
