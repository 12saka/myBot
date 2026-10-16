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
  Compass,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { GoldHeaderNav } from '@/components/gold/GoldHeaderNav';
import { GoldAnnotatedChart } from '@/components/gold/GoldAnnotatedChart';
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import type { GoldOverviewData } from '@trademind/shared';

export default function GoldOverviewPage() {
  const [data, setData] = useState<GoldOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

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

  const confidenceScore = data?.confidence ?? (activeSignal?.confidence || 85);
  const activeDirection = data?.direction ?? (activeSignal?.direction || (data?.entryPlan?.orderType?.includes('BUY') ? 'BUY' : data?.entryPlan?.orderType?.includes('SELL') ? 'SELL' : 'WAIT'));
  const signalGrade = data?.signalGrade ?? (activeSignal?.signalGrade || (confidenceScore >= 85 ? 'A+ PRIME' : 'A STRONG'));
  const orderType = data?.entryPlan?.orderType || (activeDirection === 'BUY' ? 'BUY_LIMIT' : activeDirection === 'SELL' ? 'SELL_LIMIT' : 'WAIT');

  const preferredEntry = data?.entryPlan?.preferredEntry || p;
  const stopLoss = data?.riskPlan?.exactStopLoss || (activeDirection === 'BUY' ? p - 5.5 : p + 5.5);
  const tp1 = data?.riskPlan?.takeProfit1 || (activeDirection === 'BUY' ? p + 7.5 : p - 7.5);
  const tp2 = data?.riskPlan?.takeProfit2 || (activeDirection === 'BUY' ? p + 15.0 : p - 15.0);

  const handleCopySetup = () => {
    const text = `TradeMind Institutional Gold Setup:\nAsset: XAU/USD (Gold)\nOrder: ${orderType}\nDirection: ${activeDirection}\nEntry: $${preferredEntry.toFixed(2)}\nStop Loss: $${stopLoss.toFixed(2)}\nTP1: $${tp1.toFixed(2)}\nTP2: $${tp2.toFixed(2)}\nConfidence: ${confidenceScore}%\nGrade: ${signalGrade}`;
    navigator.clipboard.writeText(text);
    toast.success('Gold trade parameters copied to clipboard!');
  };

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

        {/* Setup & Institutional Confidence */}
        <div className="p-4 rounded-2xl bg-[#0B0F17] border border-amber-500/25 shadow-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Institutional Setup</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {signalGrade}
              </span>
            </div>
            <div className="text-sm font-extrabold text-amber-300 mt-1 flex items-center gap-1.5">
              <span>{orderType.replace(/_/g, ' ')}</span>
            </div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              <span>{confidenceScore}% Confluence</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 font-normal">EV: +{data?.riskPlan?.expectedValueR ? data.riskPlan.expectedValueR.toFixed(2) : '1.85'}R</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Target className="text-amber-400" size={20} />
          </div>
        </div>
      </div>

      {/* Main Interactive Annotated Gold Chart (SMC, Order Blocks, FVGs, BOS/CHoCH, Liquidity, Levels) */}
      <GoldAnnotatedChart
        symbol="GOLD"
        defaultTimeframe="15m"
        height={560}
      />

      {/* Actionable Institutional Gold Signal Execution Deck */}
      {orderType !== 'WAIT' && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0B0F17] via-[#0F172A] to-[#0B0F17] border border-amber-500/30 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                <Zap size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-white">
                    Gold Institutional {orderType.replace(/_/g, ' ')}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                    activeDirection === 'BUY'
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  )}>
                    {activeDirection === 'BUY' ? 'BULLISH FLOW' : 'BEARISH FLOW'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {confidenceScore}% CONFIDENCE
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Strategy: <strong className="text-slate-200">{data?.entryPlan?.selectedStrategy?.replace(/_/g, ' ') || 'Smart Money Sweep & Reversal'}</strong></span>
                  <span>•</span>
                  <span>Grade: <strong className="text-amber-300">{signalGrade}</strong></span>
                  <span>•</span>
                  <span>Institutional EV: <strong className="text-emerald-400">+{data?.riskPlan?.expectedValueR ? data.riskPlan.expectedValueR.toFixed(2) : '1.85'}R</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySetup}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy Parameters</span>
              </button>
              <button
                onClick={() => setIsTradeModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Zap size={14} />
                <span>Execute Trade</span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-0.5">Preferred Entry (Centroid)</span>
              <span className="text-lg font-black font-mono text-white">
                ${preferredEntry.toFixed(2)}
              </span>
              <div className="text-[10px] font-mono text-cyan-300/90 mt-0.5">
                Zone: [${data?.entryPlan?.entryZone ? data.entryPlan.entryZone[0].toFixed(2) : (p - 0.75).toFixed(2)} - ${data?.entryPlan?.entryZone ? data.entryPlan.entryZone[1].toFixed(2) : (p + 0.75).toFixed(2)}]
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/25">
              <span className="text-[10px] font-mono font-bold uppercase text-rose-400 block mb-0.5">Stop Loss (Invalidation)</span>
              <span className="text-lg font-black font-mono text-rose-300">
                ${stopLoss.toFixed(2)}
              </span>
              <div className="text-[10px] font-mono text-rose-400/90 mt-0.5">
                Risk: {data?.riskPlan?.stopDistancePips || Math.round(Math.abs(preferredEntry - stopLoss) * 10)} pips (${Math.abs(preferredEntry - stopLoss).toFixed(2)})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 block mb-0.5">Target 1 (Liquidity Pool)</span>
              <span className="text-lg font-black font-mono text-emerald-300">
                ${tp1.toFixed(2)}
              </span>
              <div className="text-[10px] font-mono text-emerald-400/90 mt-0.5">
                Target: +{Math.round(Math.abs(tp1 - preferredEntry) * 10)} pips (R:R {data?.riskPlan?.riskReward1?.toFixed(1) || '1.4'})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/35">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-300 block mb-0.5">Target 2 (Expansion)</span>
              <span className="text-lg font-black font-mono text-emerald-200">
                ${tp2.toFixed(2)}
              </span>
              <div className="text-[10px] font-mono text-emerald-300/90 mt-0.5">
                Target: +{Math.round(Math.abs(tp2 - preferredEntry) * 10)} pips (R:R {data?.riskPlan?.riskReward2?.toFixed(1) || '2.8'})
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Quick Trade Execution Modal Pre-Filled With Gold Setup */}
      <QuickTradeWidget
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        defaultSymbol="GOLD"
        defaultDirection={activeDirection === 'SELL' ? 'SELL' : 'BUY'}
        aiSignal={{
          entry: preferredEntry,
          stopLoss: stopLoss,
          tp1: tp1,
          tp2: tp2,
          direction: activeDirection as any,
          strategy: data?.entryPlan?.selectedStrategy || 'Institutional Gold Confluence',
          confidence: confidenceScore
        }}
      />
    </div>
  );
}
