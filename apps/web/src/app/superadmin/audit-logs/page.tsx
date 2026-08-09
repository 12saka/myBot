'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  FileText, ShieldAlert, RefreshCw, Search, Clock, ChevronDown, ChevronUp, UserCheck, Activity, ShieldCheck, Database
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/v2/admin/audit-logs');
      setLogs(res?.data || (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      log.action?.toLowerCase().includes(searchLower) ||
      log.user?.email?.toLowerCase().includes(searchLower) ||
      log.userId?.toLowerCase().includes(searchLower);

    const actionUpper = (log.action || '').toUpperCase();
    let matchesCategory = true;
    if (categoryFilter === 'KYC') matchesCategory = actionUpper.includes('KYC');
    else if (categoryFilter === 'SIGNAL') matchesCategory = actionUpper.includes('SIGNAL');
    else if (categoryFilter === 'USER') matchesCategory = actionUpper.includes('USER') || actionUpper.includes('ROLE') || actionUpper.includes('PROFILE');
    else if (categoryFilter === 'SYSTEM') matchesCategory = actionUpper.includes('SYSTEM') || actionUpper.includes('SUPERADMIN') || actionUpper.includes('MASTER');

    return matchesSearch && matchesCategory;
  });

  // KPI Calculations
  const totalLogsCount = logs.length;
  const uniqueUsers = new Set(logs.map((l) => l.user?.email || l.userId)).size;
  const todayCount = logs.filter(
    (l) => new Date(l.timestamp).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Page Banner */}
      <AdminPageBanner
        badgeText="IMMUTABLE AUDIT TRAIL"
        title="System Security & Action Telemetry"
        description="Comprehensive, tamper-proof record of all administrative actions, KYC approvals/rejections, signal override events, and privilege escalations."
        icon={FileText}
        stats={[
          { label: 'Recorded Events', value: totalLogsCount, color: 'text-purple-300' },
          { label: 'Active Admins', value: uniqueUsers, color: 'text-emerald-400' },
          { label: "Today's Events", value: todayCount, color: 'text-amber-300' },
        ]}
        actions={
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Log Stream</span>
          </button>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-white/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wider">Total System Events</p>
            <p className="text-2xl font-extrabold font-outfit text-white mt-1">{totalLogsCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-emerald-400 font-bold tracking-wider">Active Admins & Actors</p>
            <p className="text-2xl font-extrabold font-outfit text-emerald-300 mt-1">{uniqueUsers}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-amber-500/20 bg-amber-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-amber-400 font-bold tracking-wider">Events Today</p>
            <p className="text-2xl font-extrabold font-outfit text-amber-300 mt-1">{todayCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Category Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl border border-white/10">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-white/10 overflow-x-auto w-full lg:w-auto">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'KYC', label: 'KYC Decisions' },
            { id: 'SIGNAL', label: 'Signal Overrides' },
            { id: 'USER', label: 'User Governance' },
            { id: 'SYSTEM', label: 'System Master' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-outfit transition shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search action, user email, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition"
          />
        </div>
      </div>

      {/* Main Audit Trail Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action Event</th>
                <th className="p-4">Admin / Executing User</th>
                <th className="p-4">Event Details Overview</th>
                <th className="p-4 text-right">Inspect Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Fetching audit telemetry stream...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 font-mono">
                    <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No system audit logs found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const detailsObj = log.details || {};

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-white/5 transition">
                        <td className="p-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        <td className="p-4 font-mono font-bold">
                          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px]">
                            {log.action}
                          </span>
                        </td>

                        <td className="p-4 font-mono text-slate-200">
                          {log.user?.email || log.userId || 'System Engine'}
                        </td>

                        <td className="p-4 font-mono text-[11px] text-slate-400 max-w-sm truncate">
                          {typeof detailsObj === 'string'
                            ? detailsObj
                            : JSON.stringify(detailsObj)}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition inline-flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Close' : 'Inspect'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Formatted JSON Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-purple-500/20">
                          <td colSpan={5} className="p-5">
                            <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/30 space-y-2 font-mono text-xs">
                              <div className="flex items-center justify-between text-purple-400 font-bold border-b border-white/10 pb-2">
                                <span>Event Payload Details — ID: {log.id}</span>
                                <span>{new Date(log.timestamp).toISOString()}</span>
                              </div>
                              <pre className="text-emerald-400 text-xs overflow-x-auto whitespace-pre-wrap p-3 rounded-lg bg-black/60 border border-white/5">
                                {JSON.stringify(detailsObj, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
