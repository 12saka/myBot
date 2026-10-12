'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  RefreshCw,
  Clock,
  Compass,
  ArrowRight
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { GoldAnnotatedChart } from '@/components/gold/GoldAnnotatedChart';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldMultiTimeframeConcordance, GoldStructuralLevels } from '@trademind/shared';

interface AnalysisResponse {
  symbol: string;
  currentPrice: number;
  multiTf: GoldMultiTimeframeConcordance;
  structure: GoldStructuralLevels;
  volatilityAtr15m: number;
  volatilityPercentile: number;
  marketRegime: string;
}

export default function GoldAnalysisPage() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiFetch<AnalysisResponse>('/api/v2/signals/gold/analysis');
      setData(res);
    } catch (e) {
      console.error('[GoldAnalysis] error:', e);
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
        <p className="text-sm font-semibold text-slate-400">Loading SMC & Multi-Timeframe Structural Analysis...</p>
      </div>
    );
  }

  const p = data?.currentPrice || 0;
  const tf = data?.multiTf;
  const struct = data?.structure;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      <GoldHeaderNav currentPrice={p} />

      {/* Title & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Layers className="text-amber-400" size={22} />
            Multi-Timeframe SMC & Liquidity Structure
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized analysis of 4H Macro, 1H Intermarket, and 15M Tactical execution horizons.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all cursor-pointer"
        >
          <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
          {refreshing ? 'Syncing...' : 'Sync Structure'}
        </button>
      </div>

      {/* Interactive SMC Chart with Live Annotations */}
      <GoldAnnotatedChart
        symbol="GOLD"
        defaultTimeframe="15m"
        height={500}
      />

      {/* 3-Timeframe Concordance Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 4H Higher-Timeframe Pillar */}
        <div className="p-5 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              4-Hour Macro Frame
            </span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
              tf?.trend4h === 'BULLISH' ? "bg-emerald-500/20 text-emerald-400" : tf?.trend4h === 'BEARISH' ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-300"
            )}>
              {tf?.trend4h || 'NEUTRAL'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-2 mt-4">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>Displacement Size:</span>
              <span className="font-mono text-white">${tf?.displacement4hAtr?.toFixed(2) || '6.70'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>HTF Direction:</span>
              <span className="font-bold text-slate-200">Institutional Trend Core</span>
            </div>
          </div>
        </div>

        {/* 1H Intermediary Structure */}
        <div className="p-5 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              1-Hour Directional Frame
            </span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
              tf?.trend1h === 'BULLISH' ? "bg-emerald-500/20 text-emerald-400" : tf?.trend1h === 'BEARISH' ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-300"
            )}>
              {tf?.trend1h || 'NEUTRAL'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-2 mt-4">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>Volume POC:</span>
              <span className="font-mono text-amber-400">${tf?.volumeProfilePoc?.toFixed(2) || p.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>Session VWAP:</span>
              <span className="font-mono text-white">${tf?.sessionVwap?.toFixed(2) || p.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 15M Tactical Execution */}
        <div className="p-5 rounded-2xl bg-[#0B0F17] border border-amber-500/20 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
              15-Minute Tactical Frame
            </span>
            <span className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
              tf?.trend15m === 'BULLISH' ? "bg-emerald-500/20 text-emerald-400" : tf?.trend15m === 'BEARISH' ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-300"
            )}>
              {tf?.trend15m || 'NEUTRAL'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-2 mt-4">
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>Concordance Status:</span>
              <span className="font-bold text-amber-300">{tf?.concordanceStatus?.replace(/_/g, ' ') || 'ALIGNED'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5">
              <span>Tactical Bias:</span>
              <span className="font-bold text-slate-200">Valid for Entry Desk</span>
            </div>
          </div>
        </div>
      </div>

      {/* Structural Levels & Liquidity Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Liquidity Pools */}
        <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/25 p-6 shadow-2xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Target className="text-amber-400" size={18} />
            Institutional Session Liquidity Pools
          </h3>
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Asian Session Range (Asia H/L)</div>
                <div className="text-[11px] text-slate-500">Early liquidity baseline</div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-rose-400 font-bold">{struct?.asianHigh ? `$${struct.asianHigh.toFixed(2)}` : '—'}</span>
                <span className="text-slate-500 mx-1.5">/</span>
                <span className="text-emerald-400 font-bold">{struct?.asianLow ? `$${struct.asianLow.toFixed(2)}` : '—'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">London Session Range (London H/L)</div>
                <div className="text-[11px] text-slate-500">Major European sweep levels</div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-rose-400 font-bold">{struct?.londonHigh ? `$${struct.londonHigh.toFixed(2)}` : '—'}</span>
                <span className="text-slate-500 mx-1.5">/</span>
                <span className="text-emerald-400 font-bold">{struct?.londonLow ? `$${struct.londonLow.toFixed(2)}` : '—'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200">Previous Day Range (PDH / PDL)</div>
                <div className="text-[11px] text-slate-500">Primary external liquidity targets</div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-rose-400 font-bold">{struct?.previousDayHigh ? `$${struct.previousDayHigh.toFixed(2)}` : '—'}</span>
                <span className="text-slate-500 mx-1.5">/</span>
                <span className="text-emerald-400 font-bold">{struct?.previousDayLow ? `$${struct.previousDayLow.toFixed(2)}` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Unmitigated Order Blocks & Fair Value Gaps */}
        <div className="rounded-2xl bg-[#0B0F17] border border-amber-500/25 p-6 shadow-2xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Compass className="text-amber-400" size={18} />
            Institutional Imbalances & Order Blocks
          </h3>
          <div className="space-y-3">
            {/* Real Unmitigated Order Blocks */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-300">Unmitigated Order Blocks</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">15M TF</span>
              </div>
              {struct?.unmitigatedOrderBlocks && struct.unmitigatedOrderBlocks.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  {struct.unmitigatedOrderBlocks.slice(-3).map((ob, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300 font-mono">
                      <span className={ob.type === 'BULLISH' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {ob.type} OB
                      </span>
                      <span>${ob.low.toFixed(2)} – ${ob.high.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No active unmitigated order blocks in current price window.</p>
              )}
            </div>

            {/* Real Fair Value Gaps */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-400">Tactical Fair Value Gaps (FVG)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">ACTIVE</span>
              </div>
              {struct?.fairValueGaps && struct.fairValueGaps.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  {struct.fairValueGaps.slice(-3).map((fvg, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-300 font-mono">
                      <span className={fvg.type === 'BULLISH' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {fvg.type} FVG
                      </span>
                      <span>${fvg.bottom.toFixed(2)} – ${fvg.top.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No active fair value gaps in current price window.</p>
              )}
            </div>

            {/* Real Volume Profile Equities */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200">Volume Profile Levels</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">Session POC</span>
              </div>
              <p className="text-xs text-slate-400">
                POC: <span className="font-mono text-white">${tf?.volumeProfilePoc?.toFixed(2) || '—'}</span> | VWAP: <span className="font-mono text-white">${tf?.sessionVwap?.toFixed(2) || '—'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
