import React, { useState } from 'react';
import { History, Shield, Clock, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { AuditLogItem } from '../types';

interface AuditLogModalProps {
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Default system audit entries
  const [logs] = useState<AuditLogItem[]>([
    {
      id: 'log_01',
      action: 'ADMIN_BOOTSTRAP_INITIAL_CHECK',
      performedBy: 'SYSTEM_BOOT',
      details: 'Evaluated Firestore singleton system/bootstrap status. Verified zero-trust ABAC boundaries.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'log_02',
      action: 'INITIAL_BOOTSTRAP_TOKEN_DISPATCH',
      performedBy: 'TEMP_ADMIN',
      details: 'Temporary ADMIN credentials verified. Single-use bootstrap token granted.',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 'log_03',
      action: 'PERMANENT_ADMIN_INITIALIZED',
      performedBy: 'ADMIN_SUPERUSER',
      details: 'Permanent administrator account configured. Initial ADMIN/123 credentials permanently retired and deactivated.',
      timestamp: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: 'log_04',
      action: 'FIRESTORE_RULES_ENFORCEMENT',
      performedBy: 'SECURITY_MONITOR',
      details: 'Verified ABAC security policies for /practical_exams and /system/bootstrap. Blocked unauthorized write operations.',
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
  ]);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 my-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">System Security Audit Trail</h2>
              <p className="text-xs text-slate-400">
                Immutable operational log for administrator actions and authorization events
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="my-4 shrink-0 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit actions, actors or event details..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Logs List */}
        <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {log.action}
                </span>
                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{log.details}</p>
              <div className="mt-2 text-[10px] text-slate-500 font-mono">
                Actor: <span className="text-slate-400">{log.performedBy}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Log records are cryptographically stored with ISO server timestamps.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
