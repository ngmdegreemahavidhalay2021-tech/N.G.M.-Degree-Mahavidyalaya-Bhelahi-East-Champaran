import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  User,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { completePermanentAdminSetup } from '../services/examService';
import { AdminProfile } from '../types';

interface BootstrapSetupModalProps {
  setupToken: string;
  defaultInstitution?: string;
  onSuccess: (admin: AdminProfile, token: string) => void;
  onCancel: () => void;
}

export const BootstrapSetupModal: React.FC<BootstrapSetupModalProps> = ({
  setupToken,
  defaultInstitution = 'NGM Degree Mahavidyalaya',
  onSuccess,
  onCancel,
}) => {
  const [institutionName, setInstitutionName] = useState(defaultInstitution);
  const [adminFullName, setAdminFullName] = useState('Principal / Head Examination Officer');
  const [newUsername, setNewUsername] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('ngmdegreemahavidhalay2021@gmail.com');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Strength Indicators
  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isStrong = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newUsername.trim()) {
      setError('Please provide a new Admin Username.');
      return;
    }

    if (newUsername.trim().toUpperCase() === 'ADMIN' && newPassword === '123') {
      setError('You cannot retain the temporary credentials. Choose a personalized permanent username and strong password.');
      return;
    }

    if (!isStrong) {
      setError('Password does not satisfy strong security requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setError('Please enter a valid recovery email address.');
      return;
    }

    try {
      setLoading(true);
      const res = await completePermanentAdminSetup({
        setupToken,
        newUsername: newUsername.trim(),
        newPassword,
        confirmPassword,
        recoveryEmail: recoveryEmail.trim(),
        institutionName: institutionName.trim(),
        adminFullName: adminFullName.trim(),
      });

      // Confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      onSuccess(res.admin, res.token);
    } catch (err: any) {
      setError(err.message || 'Failed to complete permanent setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/10 p-6 sm:p-8 my-8">
        {/* Banner Alert */}
        <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <h4 className="font-semibold text-amber-300">Mandatory First-Time Admin Setup</h4>
            <p className="mt-1 text-slate-300">
              You have authenticated using the temporary <code className="px-1.5 py-0.5 rounded bg-slate-950 font-mono text-amber-300">ADMIN / 123</code> credentials.
              To secure this examination system, you must now establish your permanent administrator credentials.
            </p>
            <p className="mt-2 text-rose-300 font-semibold text-xs">
              ⚠️ The initial temporary ADMIN/123 credentials will be permanently disabled upon completion.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            Permanent Administrator Identity
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure the official institution and administrator credentials.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Institution Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Institution / College Name
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. NGM Degree Mahavidyalaya"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Admin Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Admin Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Dr. R. K. Sharma"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* New Admin Username */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                New Admin Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-indigo-400" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. exam_controller_ngm"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Min 4 chars, letters and numbers.</p>
            </div>
          </div>

          {/* Recovery Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Verified Recovery Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="admin@institution.edu"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used for legitimate administrator password recovery if credentials are ever lost.
            </p>
          </div>

          {/* New Password & Confirmation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                New Strong Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
              {confirmPassword.length > 0 && (
                <div className="mt-1 flex items-center gap-1 text-[11px]">
                  {passwordsMatch ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Password Strength Checklist */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
            <p className="text-xs font-medium text-slate-300 mb-2">Password Strength Requirements:</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> Minimum 8 characters
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> Uppercase letter (A-Z)
              </div>
              <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> Lowercase letter (a-z)
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> Number digit (0-9)
              </div>
              <div className={`flex items-center gap-1.5 col-span-2 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> Special symbol (!@#$%^&*...)
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isStrong || !passwordsMatch || !newUsername.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-emerald-500 hover:from-indigo-600 hover:to-emerald-600 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Configuring Permanent Admin...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Complete Setup & Disable Bootstrap</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
