'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  Activity, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldEntryIntelligence, GoldGateAudit } from '@trademind/shared';

interface EntriesResponse {
  symbol: string;
  currentPrice: number;
  entryPlan: GoldEntryIntelligence;
  gateAudit: GoldGateAudit[];
  marketRegime: string;
}

export default function GoldEntriesPage() {
  const [data, setData] = useState<EntriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<EntriesResponse>('/api/v2/signals/gold/entries');
      setData(res);
    } catch (e) {
      console.error('[GoldEntries] error:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Entry Intelligence & Strategy Selector...</p>
      </div>
    );
  }

  const p = data?.currentPrice || 0;
  const plan = data?.entryPlan;
  const isActionable = plan?.orderType !== 'WAIT';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav currentPrice={p} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Target className="text-amber-400" size={22} />
            Institutional Entry Intelligence Desk
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active Strategy Selection (Sweep + CHoCH, BOS Pullback, Range Reclaim) and entry confirmation filters.
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

      {/* Strategy Selector Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Strategy 1: Sweep + CHoCH Reversal */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-xl transition-all",
          plan?.selectedStrategy === 'SWEEP_CHOCH_REVERSAL'
            ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
            : "bg-[#0B0F17] border-white/5 text-slate-400"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase">Sweep + CHoCH Reversal</span>
            {plan?.selectedStrategy === 'SWEEP_CHOCH_REVERSAL' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-80">
            Fades false breakouts beyond Asian/London highs and confirms against 5M change of character.
          </p>
        </div>

        {/* Strategy 2: BOS Pullback Continuation */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-xl transition-all",
          plan?.selectedStrategy === 'BOS_PULLBACK_CONTINUATION'
            ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
            : "bg-[#0B0F17] border-white/5 text-slate-400"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase">BOS Pullback Continuation</span>
            {plan?.selectedStrategy === 'BOS_PULLBACK_CONTINUATION' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-80">
            Enters retests of unmitigated 15M Order Blocks following confirmed 1H structural breaks.
          </p>
        </div>

        {/* Strategy 3: Range Deviation / Reclaim */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-xl transition-all",
          plan?.selectedStrategy === 'RANGE_DEVIATION_RECLAIM'
            ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
            : "bg-[#0B0F17] border-white/5 text-slate-400"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase">Range Deviation & Reclaim</span>
            {plan?.selectedStrategy === 'RANGE_DEVIATION_RECLAIM' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed opacity-80">
            Exploits equilibrium deviations during low ADX compression periods returning inside the Value Area.
          </p>
        </div>
      </div>

      {/* Primary Entry Zone & Orders Setup */}
      <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/25 p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Order Execution Recommendation</div>
            <div className="text-2xl font-black text-white mt-1 flex items-center gap-2">
              <span className={cn(
                "px-3 py-1 rounded-xl text-sm font-bold uppercase border",
                plan?.orderType.includes('BUY') ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                plan?.orderType.includes('SELL') ? "bg-rose-500/20 text-rose-400 border-rose-500/30" :
                "bg-amber-500/20 text-amber-300 border-amber-500/30"
              )}>
                {plan?.orderType.replace(/_/g, ' ') || 'WAIT'}
              </span>
              <span className="font-mono text-xl text-slate-300">
                @ ${plan?.preferredEntry?.toFixed(2) || p.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-black/40 border border-white/5 text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Distance to Entry</div>
              <div className="text-sm font-black font-mono text-amber-400">
                {plan?.currentDistancePips || 0} pips
              </div>
            </div>
          </div>
        </div>

        {/* Confluence Factors */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
            Institutional Confluence Factors
          </h3>
          <div className="space-y-2.5">
            {(plan?.entryConditions || []).map((cond, idx) => (
              <div 
                key={idx}
                className="p-3.5 rounded-xl bg-black/40 border border-amber-500/15 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-200">{cond.detail}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">
                  {cond.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
