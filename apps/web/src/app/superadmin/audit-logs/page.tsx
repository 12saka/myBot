'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileText, ShieldAlert } from 'lucide-react';

export default function SuperadminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/v2/admin/audit-logs');
      setLogs(res?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-outfit font-bold text-white">System Audit Trail Logs</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Complete, immutable log history of all administrative actions, KYC decisions, and security events.
        </p>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Timestamp</th>
              <th className="p-3.5">Action Event</th>
              <th className="p-3.5">Admin / User</th>
              <th className="p-3.5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  Loading audit logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No audit logs recorded.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition">
                  <td className="p-3.5 font-mono text-[11px] text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-purple-300">{log.action}</td>
                  <td className="p-3.5 font-mono text-slate-300">{log.user?.email || log.userId || 'System'}</td>
                  <td className="p-3.5 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                    {JSON.stringify(log.details || {})}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
