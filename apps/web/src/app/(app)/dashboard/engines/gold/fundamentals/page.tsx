'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe2, 
  Activity, 
  ShieldCheck, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldMacroBarometer } from '@trademind/shared';

interface FundamentalsResponse {
  symbol: string;
  macro: GoldMacroBarometer;
  sessionName: string;
}

export default function GoldFundamentalsPage() {
  const [data, setData] = useState<FundamentalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<FundamentalsResponse>('/api/v2/signals/gold/fundamentals');
      setData(res);
    } catch (e) {
      console.error('[GoldFundamentals] error:', e);
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
        <p className="text-sm font-semibold text-slate-400">Loading Intermarket Macro & ForexFactory Shield...</p>
      </div>
    );
  }

  const macro = data?.macro;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Globe2 className="text-amber-400" size={22} />
            Macro Intermarket & News Impact Shield
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            US Dollar Index (DXY), 10-Year Treasury Yields (^TNX), Real Yield Proxies, and ForexFactory Blackout Shield.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          {refreshing ? 'Syncing...' : 'Sync Macro'}
        </button>
      </div>

      {/* Macro Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* DXY */}
        <div className="p-6 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">US Dollar Index</span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              DX-Y.NYB
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white">
            {macro?.dxyPrice ? macro.dxyPrice.toFixed(2) : '—'}
          </div>
          <div className="space-y-2 pt-2 border-t border-white/5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Hourly Drift:</span>
              <span className={cn(
                "font-mono font-bold",
                (macro?.dxyChange1h || 0) > 0 ? "text-rose-400" : "text-emerald-400"
              )}>
                {macro?.dxyChange1h !== undefined ? `${macro.dxyChange1h > 0 ? '+' : ''}${macro.dxyChange1h}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Macro Pressure on Gold:</span>
              <span className="font-bold text-slate-200">
                {(macro?.dxyChange1h || 0) > 0.08 ? 'Bearish Headwind' : (macro?.dxyChange1h || 0) < -0.08 ? 'Bullish Tail-flow' : 'Neutral Drift'}
              </span>
            </div>
          </div>
        </div>

        {/* US 10Y Yields */}
        <div className="p-6 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">10-Year Treasury Yield</span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              ^TNX
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white">
            {macro?.us10yYield ? `${macro.us10yYield.toFixed(2)}%` : '—'}
          </div>
          <div className="space-y-2 pt-2 border-t border-white/5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Real Yield Proxy:</span>
              <span className="font-mono text-white">
                {macro?.realYieldProxy ? `${macro.realYieldProxy.toFixed(2)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Safe-Haven Appetite:</span>
              <span className="font-bold text-amber-300">
                {macro?.safeHavenDemandScore !== undefined ? `${macro.safeHavenDemandScore}/100` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ForexFactory Shield Gate */}
        <div className="p-6 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">ForexFactory Event Shield</span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
              macro?.forexFactoryGate === 'CLEAR' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
            )}>
              {macro?.forexFactoryGate || 'CLEAR'}
            </span>
          </div>
          <div className="text-2xl font-black text-white flex items-center gap-2">
            {macro?.forexFactoryGate === 'CLEAR' ? (
              <ShieldCheck className="text-emerald-400" size={28} />
            ) : (
              <ShieldAlert className="text-rose-400" size={28} />
            )}
            <span>{macro?.forexFactoryGate === 'CLEAR' ? 'Clear to Execute' : 'Blackout Protected'}</span>
          </div>
          <div className="pt-2 border-t border-white/5 text-xs text-slate-400">
            {macro?.nextHighImpactEvent ? (
              <div>
                <span className="font-bold text-slate-200">{macro.nextHighImpactEvent.title}</span>
                <div className="text-[11px] text-amber-300 mt-0.5">
                  In ~{macro.nextHighImpactEvent.minutesRemaining} minutes (USD Impact)
                </div>
              </div>
            ) : (
              <span>No imminent high-impact tier events in next 60 minutes.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
