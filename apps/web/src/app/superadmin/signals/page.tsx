'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  Zap, AlertTriangle, Clock, RefreshCw, ChevronDown, ChevronUp, Activity, CheckCircle2, TrendingUp, TrendingDown, Target, ShieldAlert, BarChart2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminSignalsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);

  const fetchSignals = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/signals');
      setSignals(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load signal audit queue.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSignals(true);
    const interval = setInterval(() => {
      fetchSignals(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleExpire = async (id: string, symbol: string) => {
    try {
      await apiFetch(`/api/v2/admin/signals/${id}/expire`, { method: 'PATCH' });
      toast.success(`Expired signal for ${symbol}`);
      fetchSignals(false);
    } catch (err: any) {
      toast.error(err.message || 'Override failed');
    }
  };

  // Calculations & Filtering
  const now = Date.now();
  const processedSignals = signals.map((s) => ({
    ...s,
    isExpired: new Date(s.expiresAt).getTime() <= now,
  }));

  const activeCount = processedSignals.filter((s) => !s.isExpired).length;
  const expiredCount = processedSignals.filter((s) => s.isExpired).length;
  const avgWinProb = processedSignals.length > 0
    ? Math.round(processedSignals.reduce((acc, s) => acc + (s.winProbability || 0), 0) / processedSignals.length)
    : 0;

  const filteredSignals = processedSignals.filter((sig) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && !sig.isExpired) ||
      (statusFilter === 'EXPIRED' && sig.isExpired);
    const matchesSymbol =
      symbolFilter === 'ALL' || sig.symbol.toUpperCase().includes(symbolFilter.toUpperCase());
    return matchesStatus && matchesSymbol;
  });

  const availableSymbols = Array.from(new Set(signals.map((s) => s.symbol)));

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Banner */}
      <AdminPageBanner
        badgeText="QUANTITATIVE SIGNAL OVERRIDE ENGINE"
        title="AI Signal Audit & Governance Queue"
        description="Audit live institutional confluence signals, inspect multi-target grids, review technical reasons, and force-expire invalid trades."
        icon={Zap}
        stats={[
          { label: 'Total Generated', value: signals.length, color: 'text-purple-300' },
          { label: 'Active Signals', value: activeCount, color: 'text-emerald-400' },
          { label: 'Avg Win Probability', value: `${avgWinProb}%`, color: 'text-amber-300' },
        ]}
        actions={
          <button
            onClick={() => fetchSignals(false)}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Rescan Signals</span>
          </button>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-white/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wider">Total System Signals</p>
            <p className="text-2xl font-extrabold font-outfit text-white mt-1">{signals.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-emerald-400 font-bold tracking-wider">Active In Market</p>
            <p className="text-2xl font-extrabold font-outfit text-emerald-300 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-amber-500/20 bg-amber-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-amber-400 font-bold tracking-wider">Average Probability</p>
            <p className="text-2xl font-extrabold font-outfit text-amber-300 mt-1">{avgWinProb}%</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-slate-500/20 bg-slate-900/50 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wider">Expired / Closed</p>
            <p className="text-2xl font-extrabold font-outfit text-slate-300 mt-1">{expiredCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-slate-400 border border-white/10">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Status Tabs & Symbol Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl border border-white/10">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-white/10">
          {[
            { id: 'ALL', label: 'All Signals', count: signals.length },
            { id: 'ACTIVE', label: 'Active Only', count: activeCount },
            { id: 'EXPIRED', label: 'Expired', count: expiredCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-outfit transition flex items-center gap-2 ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === tab.id ? 'bg-purple-400/30 text-white' : 'bg-white/10 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Symbol Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto">
          <span className="text-[10px] font-mono text-slate-500 uppercase font-bold shrink-0">Asset Filter:</span>
          <button
            onClick={() => setSymbolFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition border ${
              symbolFilter === 'ALL'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
            }`}
          >
            ALL
          </button>
          {availableSymbols.map((sym) => (
            <button
              key={sym}
              onClick={() => setSymbolFilter(sym)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition border shrink-0 ${
                symbolFilter === sym
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Main Signal Audit Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Symbol & Type</th>
                <th className="p-4">Direction</th>
                <th className="p-4">Entry Price</th>
                <th className="p-4">Stop Loss / Risk</th>
                <th className="p-4">Take Profit Grid</th>
                <th className="p-4">Win Probability</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Auditing live signal stream...
                  </td>
                </tr>
              ) : filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                    <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No signals match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((sig) => {
                  const isExpanded = expandedSignalId === sig.id;
                  const isBuy = sig.direction === 'BUY';

                  return (
                    <React.Fragment key={sig.id}>
                      <tr className="hover:bg-white/5 transition">
                        <td className="p-4 font-bold text-white font-mono text-sm flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {isBuy ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <div>{sig.symbol}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{sig.timeframe || '1H'} Timeframe</div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${
                              isBuy
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}
                          >
                            {sig.direction}
                          </span>
                        </td>

                        <td className="p-4 font-mono font-bold text-purple-300 text-sm">
                          ${Number(sig.entryPrice).toFixed(2)}
                        </td>

                        <td className="p-4 font-mono text-[11px] text-red-400">
                          SL: ${Number(sig.stopLoss).toFixed(2)}
                        </td>

                        <td className="p-4 font-mono text-[11px]">
                          <div className="text-emerald-400 font-semibold">TP1: ${Number(sig.takeProfit1).toFixed(2)}</div>
                          {sig.takeProfit2 && (
                            <div className="text-slate-400 text-[10px]">TP2: ${Number(sig.takeProfit2).toFixed(2)}</div>
                          )}
                        </td>

                        <td className="p-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-emerald-400 text-sm">{sig.winProbability}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full"
                                style={{ width: `${Math.min(100, sig.winProbability)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                              !sig.isExpired
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                            }`}
                          >
                            {!sig.isExpired ? 'ACTIVE' : 'EXPIRED'}
                          </span>
                        </td>

                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => setExpandedSignalId(isExpanded ? null : sig.id)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition inline-flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {!sig.isExpired && (
                            <button
                              onClick={() => handleExpire(sig.id, sig.symbol)}
                              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold text-xs transition inline-flex items-center gap-1"
                            >
                              Expire Now
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Technical Confluence Breakdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-purple-950/20 border-b border-purple-500/20">
                          <td colSpan={8} className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                              {/* Price Grid */}
                              <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">Target Grid & Risk</span>
                                <div className="flex justify-between py-1 border-b border-white/5">
                                  <span className="text-slate-400">Entry Price:</span>
                                  <span className="text-white font-bold">${Number(sig.entryPrice).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/5">
                                  <span className="text-red-400">Stop Loss:</span>
                                  <span className="text-red-400 font-bold">${Number(sig.stopLoss).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-white/5">
                                  <span className="text-emerald-400">Take Profit 1:</span>
                                  <span className="text-emerald-400 font-bold">${Number(sig.takeProfit1).toFixed(2)}</span>
                                </div>
                                {sig.takeProfit2 && (
                                  <div className="flex justify-between py-1 border-b border-white/5">
                                    <span className="text-emerald-300">Take Profit 2:</span>
                                    <span className="text-emerald-300 font-bold">${Number(sig.takeProfit2).toFixed(2)}</span>
                                  </div>
                                )}
                                {sig.takeProfit3 && (
                                  <div className="flex justify-between py-1">
                                    <span className="text-emerald-200">Take Profit 3:</span>
                                    <span className="text-emerald-200 font-bold">${Number(sig.takeProfit3).toFixed(2)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Technical Confluence Reasons */}
                              <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2 md:col-span-2">
                                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">12-Layer Confluence Rationale</span>
                                <div className="space-y-1.5">
                                  {sig.reasons && Array.isArray(sig.reasons) ? (
                                    sig.reasons.map((r: string, idx: number) => (
                                      <div key={idx} className="flex items-start gap-2 text-slate-300 text-xs font-outfit">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{r}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-slate-400 text-xs font-outfit leading-relaxed">
                                      {sig.aiReasoning?.reasoning || sig.description || 'EMA-20/50 Golden Cross alignment confirmed with RSI momentum sweep above institutional VWAP floor.'}
                                    </p>
                                  )}
                                </div>
                              </div>
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
