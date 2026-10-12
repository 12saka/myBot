'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldAlert, 
  Activity, 
  DollarSign, 
  Percent, 
  RefreshCw,
  AlertTriangle,
  Scale,
  ShieldCheck
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldRiskParameters } from '@trademind/shared';

interface RiskResponse {
  symbol: string;
  currentPrice: number;
  riskPlan: GoldRiskParameters;
  activeSignal: any;
}

export default function GoldRiskPage() {
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic Position Sizing Calculator state
  const [accountEquity, setAccountEquity] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<RiskResponse>('/api/v2/signals/gold/risk');
      setData(res);
    } catch (e) {
      console.error('[GoldRisk] error:', e);
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
        <p className="text-sm font-semibold text-slate-400">Loading Quantitative Risk & Position Sizing Desk...</p>
      </div>
    );
  }

  const p = data?.currentPrice || 0;
  const risk = data?.riskPlan;
  const slDistPips = risk?.stopDistancePips || 45;
  const riskDollarAmount = (accountEquity * riskPercent) / 100;
  // Gold 1 standard lot = 100 oz. $1 price move per lot = $100. 1 pip (0.10) = $10 per lot.
  const calculatedLots = Math.max(0.01, parseFloat((riskDollarAmount / Math.max(1, slDistPips)).toFixed(2)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav currentPrice={p} spread={risk?.spread} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldAlert className="text-amber-400" size={22} />
            Institutional Risk & Execution Controls
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict monetary risk budgeting, dynamic lot-sizing calculator, and spread execution guards.
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

      {/* Dynamic Sizing Desk & Risk Bounds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dynamic Position Sizer */}
        <div className="p-6 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Scale className="text-amber-400" size={18} />
              Dynamic Lot Sizing Simulator
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              100 OZ CONTRACT
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase">Account Equity (USD)</label>
              <input
                type="number"
                value={accountEquity}
                onChange={(e) => setAccountEquity(Number(e.target.value) || 0)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase">Risk Budget (%)</label>
              <input
                type="number"
                step="0.25"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value) || 0)}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Sizing Outputs */}
          <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Allowed Risk ($)</div>
              <div className="text-base font-black font-mono text-rose-400 mt-1">
                ${riskDollarAmount.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">SL Distance</div>
              <div className="text-base font-black font-mono text-white mt-1">
                {slDistPips} pips
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Recommended Size</div>
              <div className="text-base font-black font-mono text-amber-400 mt-1">
                {calculatedLots} lots
              </div>
            </div>
          </div>
        </div>

        {/* Trade Risk Bounds & Trailing Breakeven Monitor */}
        <div className="p-6 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" size={18} />
            Execution Parameters & Breakeven Monitor
          </h3>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Trailing Stop to Breakeven (TP1 Auto-Shift)</div>
                <div className="text-[11px] text-slate-500">Locks trade at entry once +1.5R reached</div>
              </div>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                risk?.trailingStopBeActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-slate-400"
              )}>
                {risk?.trailingStopBeActive ? 'ACTIVE (BE LOCKED)' : 'ARMED'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Spread Guard Threshold</div>
                <div className="text-[11px] text-slate-500">Maximum allowable execution spread: $0.50</div>
              </div>
              <div className="text-right font-mono text-xs font-bold">
                <span className="text-emerald-400">{risk?.spread !== undefined ? `$${risk.spread.toFixed(2)}` : '—'}</span> / $0.50
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Calculated Expected Value (EV)</div>
                <div className="text-[11px] text-slate-500">Long-term mathematical edge per execution</div>
              </div>
              <span className="text-sm font-black font-mono text-amber-300">
                {risk?.expectedValueR !== undefined ? `+${risk.expectedValueR.toFixed(2)}R` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
