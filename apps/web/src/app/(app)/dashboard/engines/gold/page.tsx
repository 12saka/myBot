'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Flame, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Target, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Award,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { GoldAnnotatedChart } from '@/components/gold/GoldAnnotatedChart';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldOverviewData } from '@trademind/shared';

export default function GoldOverviewPage() {
  const [data, setData] = useState<GoldOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<GoldOverviewData>('/api/v2/signals/gold/overview');
      setData(res);
      setError(null);
    } catch (err: any) {
      console.error('[GoldOverview] Fetch error:', err);
      setError(err.message || 'Failed to fetch Gold Engine state');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => fetchOverview(), 20000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-12 w-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Loading Gold Engine institutional intelligence...</p>
      </div>
    );
  }

  const p = data?.currentPrice || 0;
  const regime = data?.marketRegime || 'RANGE_BOUND_EQUILIBRIUM';
  const spread = data?.spread || 0.35;
  const session = data?.sessionName || 'Active Session';
  const activeSignal = data?.activeSignal;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Navigation & Global Bullion Header */}
      <GoldHeaderNav 
        currentPrice={p} 
        spread={spread} 
        regime={regime} 
        session={session} 
      />

      {/* Hero Intelligence Cockpit Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Spot & Spread */}
        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Spot XAU/USD</div>
            <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
              ${p.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Broker Spread: <span className="font-mono text-emerald-400 font-bold">${spread.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Flame className="text-amber-400" size={20} />
          </div>
        </div>

        {/* Regime State */}
        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Market Regime</div>
            <div className="text-sm font-extrabold text-white mt-1">
              {regime.replace(/_/g, ' ')}
            </div>
            <div className="text-[10px] text-amber-400 font-mono mt-0.5">
              Vol Percentile: {data?.volatilityPercentile || 50}%
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Activity className="text-purple-400" size={20} />
          </div>
        </div>

        {/* ATR Volatility */}
        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">15M ATR Volatility</div>
            <div className="text-2xl font-black font-mono text-white mt-0.5">
              {data?.volatilityAtr15m ? `$${data.volatilityAtr15m.toFixed(2)}` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Expected intraday range
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Layers className="text-cyan-400" size={20} />
          </div>
        </div>

        {/* Trade Thesis */}
        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Current Setup</div>
            <div className="text-sm font-extrabold text-amber-300 mt-1">
              {activeSignal ? `${activeSignal.direction} LIVE` : `${data?.entryPlan?.orderType || 'WAIT'}`}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
              {data?.entryPlan?.selectedStrategy?.replace(/_/g, ' ') || 'Sweep Setup'}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Target className="text-emerald-400" size={20} />
          </div>
        </div>
      </div>

      {/* Main Interactive Annotated Gold Chart (SMC, Order Blocks, FVGs, BOS/CHoCH, Liquidity, Levels) */}
      <GoldAnnotatedChart
        symbol="GOLD"
        defaultTimeframe="15m"
        height={560}
      />

      {/* Macro Intermarket & Structural Quick Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">US Dollar Index (DXY)</div>
          <div className="text-lg font-bold font-mono text-white mt-1">
            {data?.macro?.dxyPrice ? data.macro.dxyPrice.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Trend: <span className="font-semibold text-amber-300">{data?.macro?.dxyTrend || 'NEUTRAL'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">US 10-Year Yield</div>
          <div className="text-lg font-bold font-mono text-white mt-1">
            {data?.macro?.us10yYield ? `${data.macro.us10yYield.toFixed(2)}%` : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Safe Haven: <span className="font-semibold text-emerald-400">{data?.macro?.safeHavenDemandScore !== undefined ? `${data.macro.safeHavenDemandScore}/100` : '—'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">ForexFactory Event Shield</div>
          <div className="text-lg font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck size={18} />
            {data?.macro?.forexFactoryGate || 'CLEAR'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {data?.macro?.nextHighImpactEvent ? `${data.macro.nextHighImpactEvent.minutesRemaining}m to ${data.macro.nextHighImpactEvent.title}` : 'No immediate high impact event'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">4H/1H/15M Concordance</div>
          <div className="text-lg font-bold text-amber-300 mt-1">
            {data?.multiTf?.concordanceStatus?.replace(/_/g, ' ') || 'FULL ALIGNMENT'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            POC: <span className="font-mono text-white">${data?.multiTf?.volumeProfilePoc?.toFixed(2) || p.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
