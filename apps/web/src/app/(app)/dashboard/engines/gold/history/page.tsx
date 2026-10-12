'use client';

import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HistoryResponse {
  metrics: {
    totalSignals: number;
    winRate: number;
    avgRiskReward: number;
    profitFactor: number;
    totalPnlR: number;
  };
  signals: any[];
}

export default function GoldHistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Verified Institutional Signal History...</p>
      </div>
    );
  }

  const m = data?.metrics;
  const signals = data?.signals || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <History className="text-amber-400" size={22} />
            Verified Historical Signal Ledger & Performance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable trade ledger tracking realized R-multiples, MFE/MAE excursions, and 5-gate audit trails.
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
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Profit Factor</div>
          <div className="text-2xl font-black font-mono text-amber-300 mt-1">
            {m?.profitFactor !== null && m?.profitFactor !== undefined ? m.profitFactor : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Average R:R</div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {m?.avgRiskReward !== null && m?.avgRiskReward !== undefined ? `1:${m.avgRiskReward}` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20 text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Net Realized PnL</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {m?.totalPnlR !== undefined ? `${m.totalPnlR >= 0 ? '+' : ''}${m.totalPnlR}R` : '—'}
          </div>
        </div>
      </div>

      {/* Historical Signals Table */}
      <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/25 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Recent Completed Setups
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {signals.length} recorded events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Stop Loss</th>
                <th className="py-3 px-4">Take Profit</th>
                <th className="py-3 px-4">Status / Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {signals.map((sig) => {
                const status = (sig.aiReasoning as any)?.status || 'CONCLUDED';
                const isTp = status.includes('TP');
                const isSl = status.includes('SL');

                return (
                  <tr key={sig.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {new Date(sig.createdAt).toLocaleDateString()} {new Date(sig.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-mono",
                        sig.direction === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      )}>
                        {sig.direction}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      ${sig.entryPrice?.toFixed(2)}
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
                        "bg-white/5 text-slate-300"
                      )}>
                        {status.replace(/_/g, ' ')}
                      </span>
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
}
