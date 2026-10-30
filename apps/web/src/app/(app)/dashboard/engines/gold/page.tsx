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
  const [tradeModalSignal, setTradeModalSignal] = useState<any>(null);

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
  const spread = data?.spread ?? 0;
  const session = data?.sessionName || 'Active Session';
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const activeSignal = data?.activeSignal;
  const activeSignals: any[] = data?.activeSignals && Array.isArray(data.activeSignals) && data.activeSignals.length > 0
    ? data.activeSignals
    : (activeSignal ? [activeSignal] : []);

  // Selected signal takes precedence for chart level inspection, falling back to primary activeSignal
  const displayedSignal = (selectedSignalId ? activeSignals.find(s => s.id === selectedSignalId) : null) || activeSignals[0] || activeSignal;

  const confidenceScore = displayedSignal?.confluenceScore ?? displayedSignal?.winProbability ?? (data?.confluenceScore ?? data?.confidence ?? 0);
  const activeDirection = displayedSignal?.direction ?? (data?.direction || 'WAIT');
  const signalGrade = (displayedSignal?.aiReasoning as any)?.signalGrade ?? (data?.signalGrade || 'WAIT');
  const orderType = (displayedSignal?.aiReasoning as any)?.orderType ?? (data?.entryPlan?.orderType || 'WAIT');

  const preferredEntry = displayedSignal?.entryPrice ? Number(displayedSignal.entryPrice) : (data?.entryPlan?.preferredEntry || 0);
  const stopLoss = displayedSignal?.stopLoss ? Number(displayedSignal.stopLoss) : (data?.riskPlan?.exactStopLoss || 0);
  const tp1 = displayedSignal?.takeProfit1 ? Number(displayedSignal.takeProfit1) : (data?.riskPlan?.takeProfit1 || 0);
  const tp2 = (displayedSignal?.takeProfit2 || (displayedSignal?.aiReasoning as any)?.takeProfit2) ? Number(displayedSignal?.takeProfit2 || (displayedSignal?.aiReasoning as any)?.takeProfit2) : (data?.riskPlan?.takeProfit2 || 0);

  // Real structural levels for Conditional Analytical Scenarios (Properly bounded to intraday structure)
  const struct = data?.structure;
  const atr = Math.max(1, data?.volatilityAtr15m || 6);

  // Bullish Scenario: Demand expansion from nearest bullish demand / discount level
  const bullOb = struct?.unmitigatedOrderBlocks?.find(o => o.type === 'BULLISH' && !o.isMitigated && o.midpoint <= p + atr * 0.5);
  const bullTriggerLow = bullOb?.low || (p > 0 ? p - atr * 0.9 : 0);
  const bullTriggerHigh = bullOb?.high || (bullTriggerLow > 0 ? bullTriggerLow + atr * 0.4 : 0);
  const bullInvalidation = bullTriggerLow > 0 ? bullTriggerLow - Math.max(1.5, atr * 0.5) : 0;
  // Realistic intraday target: 1.5x–2.5x ATR above trigger, or nearest unmitigated resistance
  const nearestBearResistance = struct?.unmitigatedOrderBlocks?.find(o => o.type === 'BEARISH' && !o.isMitigated && o.low > p);
  const bullTarget = nearestBearResistance?.low || (bullTriggerHigh > 0 ? bullTriggerHigh + atr * 2.2 : (p > 0 ? p + atr * 2.0 : 0));

  // Bearish Scenario: Supply rejection from nearest bearish supply / premium level
  const bearOb = struct?.unmitigatedOrderBlocks?.find(o => o.type === 'BEARISH' && !o.isMitigated && o.midpoint >= p - atr * 0.5);
  const bearTriggerHigh = bearOb?.high || (p > 0 ? p + atr * 0.9 : 0);
  const bearTriggerLow = bearOb?.low || (bearTriggerHigh > 0 ? bearTriggerHigh - atr * 0.4 : 0);
  const bearInvalidation = bearTriggerHigh > 0 ? bearTriggerHigh + Math.max(1.5, atr * 0.5) : 0;
  // Realistic intraday target: 1.5x–2.5x ATR below trigger, or nearest unmitigated demand
  const nearestBullSupport = struct?.unmitigatedOrderBlocks?.find(o => o.type === 'BULLISH' && !o.isMitigated && o.high < p);
  const bearTarget = nearestBullSupport?.high || (bearTriggerLow > 0 ? bearTriggerLow - atr * 2.2 : (p > 0 ? p - atr * 2.0 : 0));

  const handleCopySpecificSignal = (sig: any) => {
    const dir = sig.direction || activeDirection;
    const r = sig.aiReasoning || {};
    const ord = r.orderType || (dir === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT');
    const strat = r.strategy || sig.strategy || 'Multi-Timeframe SMC';
    const entry = sig.entryPrice || preferredEntry;
    const sl = sig.stopLoss || stopLoss;
    const tp_1 = sig.takeProfit1 || sig.takeProfit || tp1;
    const tp_2 = sig.takeProfit2 || r.takeProfit2 || tp2;
    const conf = sig.winProbability ?? confidenceScore;

    const text = `TradeMind Institutional Gold Setup:\nAsset: XAU/USD (Gold)\nOrder: ${ord}\nDirection: ${dir}\nStrategy: ${strat}\nEntry: $${Number(entry).toFixed(2)}\nStop Loss: $${Number(sl).toFixed(2)}\nTP1: $${Number(tp_1).toFixed(2)}\nTP2: $${Number(tp_2).toFixed(2)}\nConfluence: ${conf}%`;
    navigator.clipboard.writeText(text);
    toast.success('Gold trade parameters copied to clipboard!');
  };

  const handleExecuteSpecificSignal = (sig: any) => {
    setTradeModalSignal(sig);
    setIsTradeModalOpen(true);
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
              {p > 0 ? `$${p.toFixed(2)}` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Broker Spread: <span className="font-mono text-emerald-400 font-bold">{spread > 0 ? `$${spread.toFixed(2)}` : '—'}</span>
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
              Vol Percentile: {data?.volatilityPercentile !== undefined ? `${data.volatilityPercentile}%` : '—'}
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
              <span>{orderType === 'WAIT' ? 'SCANNING (WAIT)' : orderType.replace(/_/g, ' ')}</span>
            </div>
            <div className="text-[11px] font-mono text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              <span>{confidenceScore}% Confluence</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 font-normal">
                EV: {data?.riskPlan?.expectedValueR !== undefined ? `${data.riskPlan.expectedValueR >= 0 ? '+' : ''}${data.riskPlan.expectedValueR.toFixed(2)}R` : '0.00R'}
              </span>
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
        spotPrice={p}
        externalTradeLevels={{
          entry: preferredEntry || null,
          stopLoss: stopLoss || null,
          takeProfit1: tp1 || null,
          takeProfit2: tp2 || null,
          direction: activeDirection as any,
          orderType: orderType
        }}
      />

      {/* Actionable Institutional Gold Multi-Signal Execution Deck (Up to 3 Concurrent Active Signals) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap size={14} />
            </div>
            <h3 className="text-sm font-extrabold text-white">
              Active Executable Signals ({activeSignals.length}/3)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Multi-Signal Execution Deck • Max 3 Concurrent Setups
          </span>
        </div>

        {activeSignals.length > 0 ? (
          <div className={cn(
            "grid gap-4",
            activeSignals.length === 1 ? "grid-cols-1" : activeSignals.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 xl:grid-cols-3"
          )}>
            {activeSignals.map((sig: any) => {
              const dir = sig.direction || 'BUY';
              const r = sig.aiReasoning || {};
              const sOrderType = r.orderType || (dir === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT');
              const sStatus = r.lifecycleState || r.status || 'ACTIVE';
              const sStrat = r.strategy || sig.strategyKey || 'Smart Money ICT Setup';
              const sGrade = r.signalGrade || 'A';
              const sConf = sig.confluenceScore ?? sig.winProbability ?? confidenceScore;
              const sEntry = Number(sig.entryPrice || 0);
              const sSl = Number(sig.stopLoss || 0);
              const sTp1 = Number(sig.takeProfit1 || sig.takeProfit || 0);
              const sTp2 = Number(sig.takeProfit2 || r.takeProfit2 || sTp1);
              const sEntryZone = Array.isArray(r.entryZone) && r.entryZone.length === 2 ? r.entryZone : [sEntry, sEntry];

              const isCardSelected = displayedSignal?.id === sig.id;

              return (
                <div 
                  key={sig.id} 
                  onClick={() => setSelectedSignalId(sig.id)}
                  className={cn(
                    "p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0B0F17] via-[#0F172A] to-[#0B0F17] shadow-2xl flex flex-col justify-between gap-4 transition-all cursor-pointer relative",
                    isCardSelected
                      ? "border-2 border-amber-400 ring-2 ring-amber-500/20 shadow-amber-500/10"
                      : "border border-amber-500/30 hover:border-amber-500/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-black text-white">
                          Gold {sOrderType.replace(/_/g, ' ')}
                        </span>
                        {isCardSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ON CHART
                          </span>
                        )}
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                          dir === 'BUY'
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        )}>
                          {dir === 'BUY' ? 'BULLISH' : 'BEARISH'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          {sStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                        <span>Strategy: <strong className="text-slate-200">{sStrat}</strong></span>
                        <span>•</span>
                        <span>Grade: <strong className="text-amber-300">{sGrade}</strong></span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{sConf}% Confluence</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopySpecificSignal(sig)}
                        title="Copy Parameters"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all cursor-pointer"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => handleExecuteSpecificSignal(sig)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <Zap size={13} />
                        <span>Execute</span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                      <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block mb-0.5">Entry (Zone)</span>
                      <span className="text-base font-black font-mono text-white">
                        ${sEntry.toFixed(2)}
                      </span>
                      <div className="text-[9px] font-mono text-cyan-300/90 mt-0.5 truncate">
                        [${Number(sEntryZone[0]).toFixed(2)} - ${Number(sEntryZone[1]).toFixed(2)}]
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/25">
                      <span className="text-[9px] font-mono font-bold uppercase text-rose-400 block mb-0.5">Stop Loss</span>
                      <span className="text-base font-black font-mono text-rose-300">
                        ${sSl.toFixed(2)}
                      </span>
                      <div className="text-[9px] font-mono text-rose-400/90 mt-0.5">
                        Risk: {Math.round(Math.abs(sEntry - sSl) * 10)} pips
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25">
                      <span className="text-[9px] font-mono font-bold uppercase text-emerald-400 block mb-0.5">Target 1</span>
                      <span className="text-base font-black font-mono text-emerald-300">
                        ${sTp1.toFixed(2)}
                      </span>
                      <div className="text-[9px] font-mono text-emerald-400/90 mt-0.5">
                        +{Math.round(Math.abs(sTp1 - sEntry) * 10)} pips (1:{sig.riskRewardRatio?.toFixed(1) || '—'})
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/35">
                      <span className="text-[9px] font-mono font-bold uppercase text-emerald-300 block mb-0.5">Target 2</span>
                      <span className="text-base font-black font-mono text-emerald-200">
                        ${sTp2.toFixed(2)}
                      </span>
                      <div className="text-[9px] font-mono text-emerald-300/90 mt-0.5">
                        +{Math.round(Math.abs(sTp2 - sEntry) * 10)} pips (Runner)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-[#0B0F17] border border-amber-500/20 text-center space-y-1">
            <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
              <Target size={14} />
              <span>Pipeline In Vigilant Scanning Mode (Completed Candles Only)</span>
            </span>
            <p className="text-[11px] text-slate-400 max-w-xl mx-auto">
              No active executable signals at this moment. Signals are published strictly when all 5 institutional gates pass on closed candle boundaries.
            </p>
          </div>
        )}
      </div>

      {/* Engine Status & Conditional Analytical Scenarios Panel (Part B & Part F: Non-Executable Candidates) */}
      <div className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Compass size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Engine Status & Conditional Analytical Scenarios</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dual-Scenario Engine
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Top-down scenarios evaluated continuously on completed candles. Executable signals are published only when all 5 gates confirm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Completed-Candle Engine (5M Close Scan)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bullish Conditional Scenario */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/20 via-[#0B0F17] to-slate-900/40 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={16} className="text-emerald-400" />
                <span className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                  Bullish Scenario (Demand Expansion)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                CONDITIONAL • CANDIDATE
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Liquidity sweep below {bullOb ? '15M Bullish Order Block' : 'Asian / Previous Day Low'} followed by 5M/15M CHoCH displacement and discount retest.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Trigger Zone {bullOb ? '(Order Block)' : '(0.9x ATR Projection)'}</span>
                <span className="font-bold text-emerald-300">
                  {bullTriggerLow > 0 ? `$${bullTriggerLow.toFixed(2)} - $${bullTriggerHigh.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Invalidation</span>
                <span className="font-bold text-rose-400">
                  {bullInvalidation > 0 ? `< $${bullInvalidation.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Expansion Target</span>
                <span className="font-bold text-white">
                  {bullTarget > 0 ? `$${bullTarget.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Bearish Conditional Scenario */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/20 via-[#0B0F17] to-slate-900/40 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ArrowDownRight size={16} className="text-rose-400" />
                <span className="text-xs font-black text-rose-300 uppercase tracking-wide">
                  Bearish Scenario (Supply Rejection)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                CONDITIONAL • CANDIDATE
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Buy-side liquidity sweep above {bearOb ? '15M Bearish Order Block' : 'Asian / Previous Day High'} followed by closed 15M candle failure swing.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Trigger Zone {bearOb ? '(Order Block)' : '(0.9x ATR Projection)'}</span>
                <span className="font-bold text-rose-300">
                  {bearTriggerLow > 0 ? `$${bearTriggerLow.toFixed(2)} - $${bearTriggerHigh.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Invalidation</span>
                <span className="font-bold text-rose-400">
                  {bearInvalidation > 0 ? `> $${bearInvalidation.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[9px] text-slate-400 block uppercase">Expansion Target</span>
                <span className="font-bold text-white">
                  {bearTarget > 0 ? `$${bearTarget.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-amber-400" />
            <span><strong>Opposing Thesis Policy:</strong> Prior thesis must formally invalidate before an opposing executable trade is approved.</span>
          </div>
          <span className="font-mono text-slate-500">Duplicate Setup Suppression: Active (1.0 ATR)</span>
        </div>
      </div>

      {/* Macro Intermarket & Structural Quick Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">US Dollar Index (DXY)</div>
          <div className="text-lg font-bold font-mono text-white mt-1">
            {data?.macro?.dxyPrice ? data.macro.dxyPrice.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Trend: <span className="font-semibold text-amber-300">{data?.macro?.dxyTrend || '—'}</span>
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
          <div className={cn(
            "text-lg font-bold mt-1 flex items-center gap-1.5",
            data?.macro?.forexFactoryGate === 'CLEAR'
              ? "text-emerald-400"
              : (data?.macro?.forexFactoryGate === 'BLACKOUT_ACTIVE' || data?.macro?.forexFactoryGate === 'FEED_OFFLINE')
              ? "text-rose-400"
              : "text-amber-400"
          )}>
            <ShieldCheck size={18} />
            {data?.macro?.forexFactoryGate ? data.macro.forexFactoryGate.replace(/_/g, ' ') : 'VERIFYING'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {data?.macro?.forexFactoryGate === 'FEED_OFFLINE'
              ? 'Calendar feed offline — fail-closed halt active'
              : data?.macro?.nextHighImpactEvent
              ? `${data.macro.nextHighImpactEvent.minutesRemaining}m to ${data.macro.nextHighImpactEvent.title}`
              : data?.macro?.forexFactoryGate === 'CLEAR'
              ? 'No immediate high impact event'
              : 'Calendar shield active'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0F17] border border-amber-500/20">
          <div className="text-[10px] font-bold text-slate-400 uppercase">4H/1H/15M Concordance</div>
          <div className="text-lg font-bold text-amber-300 mt-1">
            {data?.multiTf?.concordanceStatus?.replace(/_/g, ' ') || '—'}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            POC: <span className="font-mono text-white">{data?.multiTf?.volumeProfilePoc ? `$${data.multiTf.volumeProfilePoc.toFixed(2)}` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Quick Trade Execution Modal Pre-Filled With Gold Setup */}
      <QuickTradeWidget
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setTradeModalSignal(null);
        }}
        defaultSymbol="GOLD"
        defaultDirection={((tradeModalSignal?.direction || activeDirection) === 'SELL' ? 'SELL' : 'BUY') as any}
        aiSignal={{
          entry: tradeModalSignal?.entryPrice || preferredEntry,
          stopLoss: tradeModalSignal?.stopLoss || stopLoss,
          tp1: tradeModalSignal?.takeProfit1 || tradeModalSignal?.takeProfit || tp1,
          tp2: tradeModalSignal?.takeProfit2 || (tradeModalSignal?.aiReasoning as any)?.takeProfit2 || tp2,
          direction: ((tradeModalSignal?.direction || activeDirection) === 'SELL' ? 'SELL' : 'BUY') as any,
          strategy: (tradeModalSignal?.aiReasoning as any)?.strategy || data?.entryPlan?.selectedStrategy || 'Institutional Gold Confluence',
          confidence: tradeModalSignal?.winProbability || confidenceScore
        }}
      />
    </div>
  );
}
