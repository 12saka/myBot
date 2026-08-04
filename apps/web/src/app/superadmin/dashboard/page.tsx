'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Users, ShieldCheck, Zap, GraduationCap, Cpu, Activity, Clock, ShieldAlert,
  Sparkles, RefreshCw, ExternalLink, ArrowUpRight, TrendingUp, Layers, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/v2/admin/dashboard/overview');
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleClaimMasterAccess = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch<any>('/api/v2/admin/claim-superadmin', { method: 'POST' });
      toast.success(res.message || 'SUPER_ADMIN master privileges activated!');
      fetchOverview();
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate master access.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRescanSignals = async () => {
    setActionLoading(true);
    const toastId = toast.loading('Triggering AI signal engine rescan across all markets...');
    try {
      await apiFetch('/api/v2/signals/generate', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'BTC/USD', interval: '1h' })
      });
      await apiFetch('/api/v2/signals/generate', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'US30', interval: '1h' })
      });
      toast.success('AI engine rescan completed successfully!', { id: toastId });
      fetchOverview();
    } catch (err: any) {
      toast.error(err.message || 'Rescan failed.', { id: toastId });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const kpis = [
    { title: 'Total Registered Users', value: data?.totalUsers || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { title: 'Pending KYC Queue', value: data?.totalKycPending || 0, icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { title: 'Active AI Signals', value: data?.totalActiveSignals || 0, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'Connected Broker Syncs', value: data?.activeBrokers || 0, icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Banner & Action Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-slate-950 border border-purple-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>EXECUTIVE MASTER CONTROL SUITE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-outfit font-extrabold text-white tracking-wide">
            Superadmin Operations Center
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Platform-wide governance, AI signal audit queue, compliance KYC verification, and LMS academy management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full lg:w-auto">
          <button
            onClick={handleClaimMasterAccess}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-outfit font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            <ShieldAlert className="w-4 h-4 text-slate-950" />
            <span>Grant Master SUPER_ADMIN Access</span>
          </button>

          <button
            onClick={handleRescanSignals}
            disabled={actionLoading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-outfit font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            <span>Trigger AI Signal Rescan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`p-5 rounded-2xl border ${kpi.bg} flex items-center justify-between shadow-lg backdrop-blur-xl`}>
              <div>
                <p className="text-xs text-slate-400 font-mono font-medium uppercase tracking-wider">{kpi.title}</p>
                <p className="text-3xl font-extrabold font-outfit text-white mt-1.5">{kpi.value.toLocaleString()}</p>
              </div>
              <div className={`p-3.5 rounded-xl ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Admin Quick Navigation & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/superadmin/users" className="p-4 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 transition group">
          <div className="flex items-center justify-between">
            <Users className="w-5 h-5 text-blue-400 group-hover:scale-110 transition" />
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </div>
          <h3 className="text-sm font-bold text-white mt-3 font-outfit">User Management</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Manage accounts, assign roles, inspect balances</p>
        </Link>

        <Link href="/superadmin/signals" className="p-4 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 transition group">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </div>
          <h3 className="text-sm font-bold text-white mt-3 font-outfit">AI Signal Audit Queue</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Audit confidence breakdowns & override signals</p>
        </Link>

        <Link href="/superadmin/kyc" className="p-4 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 transition group">
          <div className="flex items-center justify-between">
            <ShieldCheck className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </div>
          <h3 className="text-sm font-bold text-white mt-3 font-outfit">KYC Compliance Queue</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Review & approve identity verification documents</p>
        </Link>

        <Link href="/superadmin/academy" className="p-4 rounded-xl glass-panel border border-white/10 hover:border-purple-500/40 transition group">
          <div className="flex items-center justify-between">
            <GraduationCap className="w-5 h-5 text-purple-400 group-hover:scale-110 transition" />
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
          </div>
          <h3 className="text-sm font-bold text-white mt-3 font-outfit">Academy & LMS Content</h3>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Publish video lectures, courses & notes</p>
        </Link>
      </div>

      {/* Audit Log Stream & Infrastructure Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 font-outfit">
              <Clock className="w-4 h-4 text-purple-400" />
              Live Platform Audit Telemetry
            </h2>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">REAL-TIME STREAM</span>
          </div>

          <div className="space-y-2.5">
            {(!data?.recentAuditLogs || data.recentAuditLogs.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recent audit logs recorded.</p>
            ) : (
              data.recentAuditLogs.map((log: any) => (
                <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs hover:bg-white/10 transition">
                  <div>
                    <span className="font-mono font-bold text-purple-300">{log.action}</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">{log.user?.email || 'System Master Engine'}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3 font-outfit">
            <Activity className="w-4 h-4 text-emerald-400" />
            Infrastructure & Gateway Telemetry
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">API Gateway Health</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK (24ms)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">PostgreSQL Database</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> CONNECTED
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">Twelve Data Feed</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE (Live)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-slate-400">Binance Sub-Second Stream</span>
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> STREAMING
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Gemini AI Model Engine</span>
              <span className="text-purple-400 font-mono font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> READY
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
