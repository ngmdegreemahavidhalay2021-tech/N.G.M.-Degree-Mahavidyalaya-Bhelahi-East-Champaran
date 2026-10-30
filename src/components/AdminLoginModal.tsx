import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { loginAdministrator, loginInitialBootstrap } from '../services/examService';
import { AdminProfile, SystemBootstrapStatus } from '../types';

interface AdminLoginModalProps {
  bootstrapStatus: SystemBootstrapStatus | null;
  onLoginSuccess: (admin: AdminProfile, token: string) => void;
  onRequireSetup: (setupToken: string) => void;
  onOpenRecovery: () => void;
  onOpenDeploymentGuide: () => void;
  onClose?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  bootstrapStatus,
  onLoginSuccess,
  onRequireSetup,
  onOpenRecovery,
  onOpenDeploymentGuide,
  onClose,
}) => {
  const [username, setUsername] = useState(
    bootstrapStatus?.isBootstrapped ? (bootstrapStatus.adminUsername || '') : 'ADMIN'
  );
  const [password, setPassword] = useState(bootstrapStatus?.isBootstrapped ? '' : '123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInitialState = !bootstrapStatus?.isBootstrapped;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    try {
      setLoading(true);

      // Call unified backend login
      const res = await loginAdministrator(username.trim(), password);

      if (res.requireSetup) {
        // Redirect immediately to mandatory first-time setup
        onRequireSetup(res.setupToken);
        return;
      }

      if (res.success && res.admin && res.token) {
        onLoginSuccess(res.admin, res.token);
      }
    } catch (err: any) {
      // If error indicates bootstrap is required or credentials mismatch
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoInitial = () => {
    setUsername('ADMIN');
    setPassword('123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-3 shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Administrator Portal
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {bootstrapStatus?.institutionName || 'NGM Degree Mahavidyalaya'}
          </p>
        </div>

        {/* State Notice Card */}
        {isInitialState ? (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Initial Admin Bootstrap
              </span>
              <button
                type="button"
                onClick={handleFillDemoInitial}
                className="text-[11px] underline text-amber-400 hover:text-amber-200"
              >
                Auto-fill initial
              </button>
            </div>
            <p className="text-slate-300">
              The system is in initial setup mode. Use the temporary credentials to proceed to the First-Time Admin Setup page:
            </p>
            <div className="mt-2 flex items-center gap-2 font-mono text-[11px] bg-slate-950/60 p-2 rounded border border-slate-800">
              <span>Username: <strong className="text-amber-300">ADMIN</strong></span>
              <span className="text-slate-600">|</span>
              <span>Password: <strong className="text-amber-300">123</strong></span>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Permanent administrator account active. Sign in with your configured credentials.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Admin Username or Recovery Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isInitialState ? 'ADMIN' : 'Username or Email'}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              {!isInitialState && (
                <button
                  type="button"
                  onClick={onOpenRecovery}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>{isInitialState ? 'Begin Admin Setup' : 'Sign In as Administrator'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={onOpenDeploymentGuide}
            className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>View GitHub & Vercel Deployment Documentation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
