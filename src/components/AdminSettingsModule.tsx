import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Building2,
  Lock,
  Mail,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { AdminProfile, SystemBootstrapStatus } from '../types';
import { updateAdminUsername } from '../services/collegeService';

interface AdminSettingsModuleProps {
  admin: AdminProfile | null;
  bootstrapStatus: SystemBootstrapStatus | null;
  onUpdateInstitutionName: (name: string) => void;
  onAdminUpdated?: (updated: AdminProfile) => void;
}

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  admin,
  bootstrapStatus,
  onUpdateInstitutionName,
  onAdminUpdated,
}) => {
  const [collegeName, setCollegeName] = useState(bootstrapStatus?.institutionName || 'NGM Degree Mahavidyalaya');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User ID View / Edit state
  const [isEditingUserId, setIsEditingUserId] = useState(false);
  const [newUserId, setNewUserId] = useState(admin?.username || '');
  const [savingUserId, setSavingUserId] = useState(false);
  const [userIdMsg, setUserIdMsg] = useState<string | null>(null);
  const [userIdError, setUserIdError] = useState<string | null>(null);

  // Password Change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveCollegeName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim()) return;
    onUpdateInstitutionName(collegeName.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    // Call server password update
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: admin?.username,
          recoveryEmail: admin?.email,
          recoveryCode: 'CURRENT_SESSION_AUTHENTICATED',
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');

      setPasswordMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Password update failed');
    }
  };

  const handleSaveUserId = async () => {
    setUserIdError(null);
    setUserIdMsg(null);
    const clean = newUserId.trim();

    if (!clean) {
      setUserIdError('User ID cannot be empty.');
      return;
    }
    if (clean.length < 3) {
      setUserIdError('User ID must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(clean)) {
      setUserIdError('User ID can only contain letters, numbers, hyphens, dots, and underscores.');
      return;
    }
    if (clean === admin?.username) {
      setIsEditingUserId(false);
      return;
    }

    const token = localStorage.getItem('admin_session_token');
    if (!token) {
      setUserIdError('Session expired. Please log in again.');
      return;
    }

    try {
      setSavingUserId(true);
      const res = await updateAdminUsername(clean, token);
      if (res.success && res.profile) {
        if (res.newToken) {
          localStorage.setItem('admin_session_token', res.newToken);
        }
        onAdminUpdated?.(res.profile);
        setUserIdMsg(`User ID updated to "${res.profile.username}".`);
        setIsEditingUserId(false);
      } else {
        setUserIdError(res.error || 'Failed to update User ID.');
      }
    } catch (err: any) {
      setUserIdError(err.message || 'Error updating User ID.');
    } finally {
      setSavingUserId(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-slate-100">Administrator & Institution Settings</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Manage institution identity, administrator User ID, and account security settings.
        </p>
      </div>

      {/* College Identity Settings */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          Institution Banner & Identity
        </h3>

        {savedSuccess && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Institution details updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSaveCollegeName} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Official College / University Name
            </label>
            <input
              type="text"
              required
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              placeholder="e.g. NGM Degree Mahavidyalaya"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all"
            >
              Update College Name
            </button>
          </div>
        </form>
      </div>

      {/* Administrator Security Profile */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Active Administrator Identity
        </h3>

        {userIdMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{userIdMsg}</span>
          </div>
        )}

        {userIdError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{userIdError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">User ID</span>
              {!isEditingUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewUserId(admin?.username || '');
                    setIsEditingUserId(true);
                    setUserIdError(null);
                    setUserIdMsg(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveUserId}
                    disabled={savingUserId}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    <span>{savingUserId ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingUserId(false);
                      setNewUserId(admin?.username || '');
                      setUserIdError(null);
                    }}
                    disabled={savingUserId}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-300 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
            {isEditingUserId ? (
              <input
                type="text"
                value={newUserId}
                disabled={savingUserId}
                onChange={(e) => setNewUserId(e.target.value.replace(/\s+/g, ''))}
                className="w-full px-2.5 py-1 bg-slate-900 border border-blue-500 rounded-lg text-sm font-mono text-white focus:outline-none"
                placeholder="Enter new User ID"
              />
            ) : (
              <strong className="text-slate-200 font-mono text-sm block truncate">
                {admin?.username || 'admin'}
              </strong>
            )}
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Registered Recovery Email</span>
            <strong className="text-slate-200 font-mono text-sm truncate block mt-1">{admin?.email || 'N/A'}</strong>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Account Status</span>
            <strong className="text-emerald-400 font-mono text-xs block mt-1.5">Active Administrator</strong>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          Update Administrator Password
        </h3>

        {passwordError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                New Strong Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/25 transition-all"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
