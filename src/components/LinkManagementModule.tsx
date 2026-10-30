import React, { useState } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle,
  AlertCircle,
  Eye,
  Share2,
} from 'lucide-react';
import { PracticalForm, Department } from '../types';
import { updatePracticalForm, regenerateFormToken } from '../services/collegeService';

interface LinkManagementModuleProps {
  forms: PracticalForm[];
  departments: Department[];
  onRefresh: () => void;
  onOpenPublicPreview: (token: string) => void;
}

export const LinkManagementModule: React.FC<LinkManagementModuleProps> = ({
  forms,
  departments,
  onRefresh,
  onOpenPublicPreview,
}) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopy = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRegenerate = async (id: string, title: string) => {
    const ok = window.confirm(
      `Regenerate token for "${title}"?\nAny existing links shared with examiners will immediately be invalidated.`
    );
    if (!ok) return;

    try {
      await regenerateFormToken(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate link');
    }
  };

  const handleToggleActive = async (form: PracticalForm) => {
    try {
      await updatePracticalForm(form.id, { isActive: !form.isActive });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update link status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-slate-100">Public Form Link Center</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Manage teacher evaluation links. External & internal examiners access marks entry without requiring an account. Each link carries a cryptographically unique token strictly isolated to that specific subject.
        </p>
      </div>

      {/* Links Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-28">Subject Code</th>
                <th className="py-3.5 px-4">Examination Form</th>
                <th className="py-3.5 px-4">Public Token / Shareable URL</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Active Link</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {forms.map((form) => {
                const url = `${window.location.origin}/?token=${form.token}`;
                return (
                  <tr key={form.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {form.subjectCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{form.title}</div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {form.course} • {form.semester} • Max {form.maxMarks}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 max-w-sm">
                        <code className="px-2 py-1 bg-slate-950 rounded text-[11px] font-mono text-slate-300 border border-slate-800 truncate">
                          ?token={form.token}
                        </code>
                        <button
                          onClick={() => handleCopy(form.token)}
                          className="p-1 text-slate-400 hover:text-blue-300 transition-colors"
                          title="Copy Link"
                        >
                          {copiedToken === form.token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          form.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : form.status === 'closed'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {form.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(form)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          form.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {form.isActive ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onOpenPublicPreview(form.token)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/10 text-blue-300 border border-blue-500/20 hover:bg-blue-600/20 transition-colors"
                          title="Open public examiner form preview"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview</span>
                        </button>

                        <button
                          onClick={() => handleRegenerate(form.id, form.title)}
                          className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Regenerate token (Revokes old link)"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
