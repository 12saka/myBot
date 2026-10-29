'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  History, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HistoryResponse {
  metrics: {
    totalSignals: number;
    activeSignals?: number;
    unfilledSignals?: number;
    evaluatedSignals?: number;
    wins?: number;
    losses?: number;
    breakevens?: number;
    winRate: number | null;
    avgRiskReward: number | null;
    profitFactor: number | null;
    totalPnlR: number;
  };
  signals: any[];
}

export default function GoldHistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WINS' | 'LOSSES' | 'BREAKEVEN' | 'UNFILLED'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | '24H' | '7D' | '30D'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<HistoryResponse>('/api/v2/signals/gold/history');
      setData(res);
    } catch (e) {
      console.error('[GoldHistory] error:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 20000);
    return () => clearInterval(interval);
  }, []);

  const m = data?.metrics;
  const signals = data?.signals || [];

  const filteredSignals = useMemo(() => {
    return signals.filter((sig) => {
      if (directionFilter !== 'ALL' && sig.direction !== directionFilter) return false;

      const state = sig.lifecycleState || (sig.aiReasoning as any)?.status || 'CLOSED';
      const outcome = sig.outcome || (sig.aiReasoning as any)?.outcome || null;
      const isTp = outcome?.includes('TP') || state === 'TP1_HIT' || state === 'TP2_HIT';
      const isSl = outcome === 'SL_HIT' || state === 'SL_HIT';
      const isBe = outcome === 'BREAKEVEN';
      const isUnfilled = !sig.isFilled && ['EXPIRED', 'CANCELLED', 'INVALIDATED'].includes(state);

      if (outcomeFilter === 'WINS' && !isTp) return false;
      if (outcomeFilter === 'LOSSES' && !isSl) return false;
      if (outcomeFilter === 'BREAKEVEN' && !isBe) return false;
      if (outcomeFilter === 'UNFILLED' && !isUnfilled) return false;

      if (timeframeFilter !== 'ALL') {
        const ageMs = Date.now() - new Date(sig.createdAt).getTime();
        if (timeframeFilter === '24H' && ageMs > 24 * 60 * 60 * 1000) return false;
        if (timeframeFilter === '7D' && ageMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeframeFilter === '30D' && ageMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [signals, directionFilter, outcomeFilter, timeframeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSignals.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSignals = filteredSignals.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Verified Institutional Signal History...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <History className="text-amber-400" size={22} />
            Verified Historical Signal Ledger & Performance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable trade ledger tracking realized R-multiples, execution fills, and 90-day retained audit records.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          {refreshing ? 'Syncing...' : 'Live Sync'}
        </button>
      </div>

      {/* Institutional Track Record KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Audited Win Rate</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {m?.winRate !== null && m?.winRate !== undefined ? `${m.winRate}%` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Filled Trades Only</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Profit Factor</div>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1">
            {m?.profitFactor !== null && m?.profitFactor !== undefined ? m.profitFactor : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Gross Gain / Loss</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Average R:R</div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {m?.avgRiskReward !== null && m?.avgRiskReward !== undefined ? `1:${m.avgRiskReward}` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Realized Payoff</div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Net Realized PnL</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {m?.totalPnlR !== undefined ? `${m.totalPnlR >= 0 ? '+' : ''}${m.totalPnlR}R` : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Cumulative Edge</div>
        </div>
      </div>

      {/* Filter Toolbar (Part G & Phase 7) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0B0F17] border border-white/10 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mr-1">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center rounded-xl bg-black/40 border border-white/5 p-1 gap-1">
            {(['ALL', 'BUY', 'SELL'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => { setDirectionFilter(dir); setCurrentPage(1); }}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer",
                  directionFilter === dir
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {dir}
              </button>
            ))}
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center rounded-xl bg-black/40 border border-white/5 p-1 gap-1">
            {(['ALL', 'WINS', 'LOSSES', 'BREAKEVEN', 'UNFILLED'] as const).map((out) => (
              <button
                key={out}
                onClick={() => { setOutcomeFilter(out); setCurrentPage(1); }}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer",
                  outcomeFilter === out
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {out}
              </button>
            ))}
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center rounded-xl bg-black/40 border border-white/5 p-1 gap-1">
            <Calendar size={12} className="text-slate-500 ml-1.5 mr-0.5" />
            {(['ALL', '24H', '7D', '30D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => { setTimeframeFilter(tf); setCurrentPage(1); }}
                className={cn(
                  "px-2 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer",
                  timeframeFilter === tf
                    ? "bg-amber-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Showing {paginatedSignals.length} of {filteredSignals.length} records (50 per page)
        </div>
      </div>

      {/* Historical Signals Table */}
      <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/25 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Historical Trade Ledger
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Retained ≥ 90 Days • Page {safeCurrentPage} of {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Direction & Strategy</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Stop Loss</th>
                <th className="py-3 px-4">Take Profit</th>
                <th className="py-3 px-4">Lifecycle State</th>
                <th className="py-3 px-4 text-right">Realized R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedSignals.length > 0 ? (
                paginatedSignals.map((sig) => {
                  const state = sig.lifecycleState || (sig.aiReasoning as any)?.status || 'CLOSED';
                  const outcome = sig.outcome || (sig.aiReasoning as any)?.outcome || null;
                  const realizedR = sig.realizedR;
                  const isTp = outcome?.includes('TP') || state === 'TP1_HIT' || state === 'TP2_HIT';
                  const isSl = outcome === 'SL_HIT' || state === 'SL_HIT';
                  const isBe = outcome === 'BREAKEVEN';
                  const isUnfilled = !sig.isFilled && ['EXPIRED', 'CANCELLED', 'INVALIDATED'].includes(state);

                  return (
                    <tr key={sig.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(sig.createdAt).toLocaleDateString()} {new Date(sig.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-mono font-bold",
                            sig.direction === 'BUY' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          )}>
                            {sig.direction}
                          </span>
                          <span className="text-[11px] text-slate-300 font-semibold truncate max-w-[150px]">
                            {sig.strategy || (sig.aiReasoning as any)?.strategy || 'Institutional Core'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        ${sig.entryPrice?.toFixed(2)}
                        {sig.fillPrice && sig.fillPrice !== sig.entryPrice && (
                          <span className="text-[10px] text-slate-500 block">Filled: ${sig.fillPrice.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-rose-400">
                        ${sig.stopLoss?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        ${sig.takeProfit1?.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          isTp ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                          isSl ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                          isBe ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" :
                          isUnfilled ? "bg-slate-800 text-slate-400 border border-slate-700" :
                          "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        )}>
                          {outcome ? outcome.replace(/_/g, ' ') : state.replace(/_/g, ' ')}
                        </span>
                        {sig.closeReason && (
                          <span className="text-[9px] text-slate-500 block mt-0.5 font-mono">
                            {sig.closeReason.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {realizedR !== null && realizedR !== undefined ? (
                          <span className={realizedR > 0 ? "text-emerald-400" : realizedR < 0 ? "text-rose-400" : "text-cyan-400"}>
                            {realizedR > 0 ? `+${realizedR}R` : `${realizedR}R`}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-normal">
                            {isUnfilled ? 'Unfilled' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    No signals found matching the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-white/5 bg-black/40 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono text-[11px]">
              Page {safeCurrentPage} of {totalPages} ({filteredSignals.length} total signals)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                  safeCurrentPage <= 1
                    ? "border-white/5 text-slate-600 cursor-not-allowed"
                    : "border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                )}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                  safeCurrentPage >= totalPages
                    ? "border-white/5 text-slate-600 cursor-not-allowed"
                    : "border-white/10 text-slate-300 hover:bg-white/5 cursor-pointer"
                )}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
