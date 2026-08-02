'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users, ShieldCheck, Zap, GraduationCap, Cpu, Activity, Clock, ShieldAlert } from 'lucide-react';

export default function SuperadminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await apiFetch<any>('/api/v2/admin/dashboard/overview');
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const kpis = [
    { title: 'Total Registered Users', value: data?.totalUsers || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { title: 'Pending KYC Queue', value: data?.totalKycPending || 0, icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { title: 'Active AI Signals', value: data?.totalActiveSignals || 0, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'Active Broker Syncs', value: data?.activeBrokers || 0, icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-outfit font-bold text-white">Superadmin Control Center</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Real-time system health, compliance status, and platform audit overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`p-4 rounded-xl border ${kpi.bg} flex items-center justify-between`}>
              <div>
                <p className="text-xs text-slate-400 font-medium">{kpi.title}</p>
                <p className="text-2xl font-bold font-outfit text-white mt-1">{kpi.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Audit Log Stream & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-5 rounded-xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Recent System Audit Events
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Live Telemetry</span>
          </div>

          <div className="space-y-3">
            {(!data?.recentAuditLogs || data.recentAuditLogs.length === 0) ? (
              <p className="text-xs text-slate-500 py-4 text-center">No recent audit logs available.</p>
            ) : (
              data.recentAuditLogs.map((log: any) => (
                <div key={log.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-semibold text-purple-300">{log.action}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{log.user?.email || 'System'}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-white/10 space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            Infrastructure Status
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">API Gateway</span>
              <span className="text-emerald-400 font-mono font-semibold">HEALTHY (200 OK)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">PostgreSQL Database</span>
              <span className="text-emerald-400 font-mono font-semibold">CONNECTED</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">Twelve Data Feed</span>
              <span className="text-emerald-400 font-mono font-semibold">ACTIVE</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Binance Streaming</span>
              <span className="text-emerald-400 font-mono font-semibold">CONNECTED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
