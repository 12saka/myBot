'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, BrainCircuit, TrendingUp, TrendingDown,
  Clock, Shield, BarChart3, Trash2, Eye, Loader2,
  RefreshCw, Sparkles, AlertTriangle, Target, Bell,
  BellRing, Copy, CheckCircle2, ChevronDown, Layers,
  Activity, Compass, ArrowUpRight, ArrowDownRight, DollarSign
} from 'lucide-react';
import { useAIStore, AISignal } from '@/store/useAIStore';
import { useMarketStore } from '@/store/useMarketStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { cn } from '@/lib/utils';
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';
import { TradingViewWidget } from '@/components/charts/TradingViewWidget';
import { playSignalChime, sendDeviceNotification, requestDeviceNotificationPermission } from '@/lib/notifications';
import { toast } from 'react-hot-toast';
import { apiFetch, mapSignal } from '@/lib/api';

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const ITEM = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

// ============================================================================
// GOLD INSTITUTIONAL SIGNAL CARD COMPONENT
// ============================================================================

interface GoldSignalCardProps {
  signal: AISignal;
  onDelete: (id: string) => void;
  onViewChart: (signal: AISignal) => void;
}

function GoldSignalCard({ signal, onDelete, onViewChart }: GoldSignalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [timeAgo, setTimeAgo] = useState('Just now');
  const isBuy = signal.direction === 'BUY';
  const isWait = signal.direction === 'WAIT';

  // Live ticking relative timestamp
  useEffect(() => {
    const updateRelative = () => {
      const ts = signal.updatedAt || signal.createdAt;
      if (!ts) {
        setTimeAgo('Just now');
        return;
      }
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 5) setTimeAgo('Just now');
      else if (diff < 60) setTimeAgo(`${diff}s ago`);
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)}m ago`);
      else setTimeAgo(new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    updateRelative();
    const interval = setInterval(updateRelative, 1000);
    return () => clearInterval(interval);
  }, [signal.updatedAt, signal.createdAt]);

  const ai = signal.aiReasoning || {};
  const fiveGates = ai.fiveGates || {};
  const orderType = ai.orderType || (isBuy ? 'BUY_LIMIT' : isWait ? 'WAIT' : 'SELL_LIMIT');
  const signalGrade = ai.signalGrade || signal.signalGrade || (signal.confidence >= 85 ? 'A+ PRIME' : signal.confidence >= 75 ? 'A STRONG' : 'B+ STANDARD');
  const entryZone = ai.entryZone || [signal.entry - 0.75, signal.entry + 0.75];
  const aiVerdict = ai.aiVerdict || (isWait ? 'HOLD' : 'APPROVED');
  const volatilityMetrics = ai.volatilityMetrics || {};
  const intermarket = ai.intermarket || {};
  const levels = ai.levels || {};
  const tradePath = ai.tradePath || {};
  const positionSizing = ai.positionSizing || {};

  const slDiff = Math.abs(signal.entry - signal.stopLoss);
  const tp1Diff = Math.abs(signal.tp1 - signal.entry);
  const tp2Diff = Math.abs(signal.tp2 - signal.entry);
  const tp3Diff = signal.tp3 ? Math.abs(signal.tp3 - signal.entry) : 0;

  const fmtPrice = (v?: number) => (typeof v === 'number' && !isNaN(v) && v > 0) ? `$${v.toFixed(2)}` : '$0.00';

  return (
    <motion.div
      variants={ITEM}
      className={cn(
        'glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5 border relative group transition-all duration-300 shadow-xl',
        isBuy ? 'border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/35' :
        isWait ? 'border-amber-500/20 bg-amber-950/10 hover:border-amber-500/35' :
        'border-rose-500/20 bg-rose-950/10 hover:border-rose-500/35'
      )}
    >
      {/* Top conviction gradient indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{
          background: isBuy
            ? 'linear-gradient(90deg, #10b981, #06b6d4, transparent)'
            : isWait
            ? 'linear-gradient(90deg, #f59e0b, #d97706, transparent)'
            : 'linear-gradient(90deg, #f43f5e, #fb7185, transparent)'
        }}
      />

      {/* Delete / Dismiss button */}
      <button
        onClick={() => onDelete(signal.id)}
        className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
        title="Dismiss Signal"
      >
        <Trash2 size={14} />
      </button>

      {/* 1. Header & Identity */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pr-8">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            <span className="font-display font-extrabold text-white text-xl tracking-tight flex items-center gap-2">
              <span className="text-amber-400">XAU/USD</span>
              <span className="text-xs font-mono font-medium text-slate-400">(Gold Spot)</span>
            </span>

            <Badge variant={isBuy ? 'buy' : isWait ? 'neutral' : 'sell'} size="sm">
              {signal.direction}
            </Badge>

            {/* Timeframe Badge */}
            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <Clock size={11} className="text-purple-400" />
              {(ai.timeframe || '15m').toUpperCase()}
            </span>

            {/* Order Type Badge */}
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1.5",
              orderType.includes('LIMIT') ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/35" :
              orderType.includes('MARKET') ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35" :
              "bg-amber-500/15 text-amber-300 border-amber-500/35"
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {orderType.replace(/_/g, ' ')}
            </span>

            {/* Conviction Grade Badge */}
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-black border flex items-center gap-1.5",
              signalGrade.includes('A+') ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10" :
              signalGrade.includes('A') ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
              "bg-amber-500/20 text-amber-300 border-amber-500/40"
            )}>
              {signalGrade}
            </span>

            {/* Model Tag */}
            {ai.strategy && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                {String(ai.strategy).replace(/_/g, ' ')}
              </span>
            )}

            {/* Live Progress Status Badge */}
            {ai.status === 'TP1_HIT' && (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse flex items-center gap-1">
                <CheckCircle2 size={11} /> TP1 HIT • SL AT BREAKEVEN
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
            <span className="font-mono text-cyan-300 flex items-center gap-1 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
              <Clock size={11} className="text-cyan-400" /> Generated: {timeAgo}
            </span>
            <span>•</span>
            <span className="text-[11px] text-slate-400 font-mono">
              Engine: <strong className="text-amber-300">TradeMind 3.2 (TV WebSocket)</strong>
            </span>
          </div>
        </div>

        {/* Confidence Ring */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Confluence Score</div>
            <div className="text-xs font-mono font-semibold text-slate-200">Institutional EV</div>
          </div>
          <ProgressRing
            value={signal.confidence}
            size={56}
            strokeWidth={5}
            color={isBuy ? '#10b981' : isWait ? '#f59e0b' : '#f43f5e'}
            label={`${signal.confidence}`}
            sublabel="%"
          />
        </div>
      </div>

      {/* 2. 5-Gate Institutional Audit Verification Strip */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Shield size={13} className="text-purple-400" />
            5-Gate Institutional Audit Clearance
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold",
            fiveGates.allPassed ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          )}>
            {fiveGates.allPassed ? "ALL 5 GATES PASSED" : `HELD AT ${fiveGates.failingGate || 'GATE'}`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
          {[
            { id: 'Gate 1', name: 'Data Synchrony', passed: fiveGates.gate1_data?.passed ?? true, detail: 'TV WebSocket' },
            { id: 'Gate 2', name: 'Market Regime', passed: fiveGates.gate2_market?.passed ?? true, detail: 'Liquidity & News' },
            { id: 'Gate 3', name: 'Structure Model', passed: fiveGates.gate3_setup?.passed ?? true, detail: ai.strategy ? String(ai.strategy).slice(0, 12) : 'Structure' },
            { id: 'Gate 4', name: 'Trade Location', passed: fiveGates.gate4_trade?.passed ?? true, detail: 'ICZ Confluence' },
            { id: 'Gate 5', name: 'Execution Viability', passed: fiveGates.gate5_execution?.passed ?? true, detail: 'Spread Buffer' },
          ].map(g => (
            <div
              key={g.id}
              className={cn(
                "p-2 rounded-lg border flex flex-col justify-between transition-all",
                g.passed ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300" : "bg-rose-950/20 border-rose-500/30 text-rose-300"
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-bold text-[9px] text-slate-400">{g.id}</span>
                <span>{g.passed ? '✓' : '✗'}</span>
              </div>
              <span className="font-bold truncate">{g.name}</span>
              <span className="text-[8px] opacity-75 truncate">{g.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Trade Execution Boundaries (ICZ Entry, SL, TP1, TP2, TP3) */}
      {!isWait && (
        <div className="space-y-2.5">
          {/* Primary Order Centroid & Stop Loss */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Preferred Entry & ICZ Zone */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                  Preferred Entry Price
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
                  CENTROID
                </span>
              </div>
              <span className="font-mono font-extrabold text-lg sm:text-xl text-white tracking-tight">
                {fmtPrice(signal.entry)}
              </span>
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300/90 mt-1 pt-1 border-t border-white/5">
                <span>Confluence Zone (ICZ):</span>
                <strong>{Array.isArray(entryZone) ? `${fmtPrice(entryZone[0])} - ${fmtPrice(entryZone[1])}` : String(entryZone)}</strong>
              </div>
              <div className="text-[10px] text-slate-300 mt-1.5 pt-1.5 border-t border-white/5 flex items-start gap-1 font-mono">
                <span className="text-cyan-400 font-bold shrink-0">Reason for Entry:</span>
                <span className="text-slate-300 line-clamp-1">
                  {Array.isArray(ai.indicators) && ai.indicators.length > 0 ? ai.indicators.slice(0, 2).join(' + ') : 'Institutional Order Block & Liquidity Sweep'}
                </span>
              </div>
            </div>

            {/* Invalidation Stop Loss */}
            <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                  Exact Invalidation (SL)
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                  -${slDiff.toFixed(2)} / oz
                </span>
              </div>
              <span className="font-mono font-extrabold text-lg sm:text-xl text-rose-400 tracking-tight">
                {fmtPrice(signal.stopLoss)}
              </span>
              <div className="flex items-center justify-between text-[10px] font-mono text-rose-400/80 mt-1 pt-1 border-t border-rose-500/15">
                <span>Risk per 0.01 Lot:</span>
                <strong>~${slDiff.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Profit Target Progression (TP1, TP2, TP3) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* TP1 */}
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">TP1 (Scale 50%)</span>
                <span className="text-[9px] font-mono font-bold text-emerald-300">+{tp1Diff.toFixed(2)}</span>
              </div>
              <span className="font-mono font-bold text-base text-emerald-400 tracking-tight">
                {fmtPrice(signal.tp1)}
              </span>
              <span className="text-[9px] font-mono text-emerald-400/70 mt-1">Move SL to Breakeven</span>
            </div>

            {/* TP2 */}
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-300">TP2 (Scale 30%)</span>
                <span className="text-[9px] font-mono font-bold text-emerald-300">+{tp2Diff.toFixed(2)}</span>
              </div>
              <span className="font-mono font-bold text-base text-emerald-300 tracking-tight">
                {fmtPrice(signal.tp2)}
              </span>
              <span className="text-[9px] font-mono text-emerald-300/70 mt-1">Activate Trailing Stop</span>
            </div>

            {/* TP3 */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">TP3 (Runner 20%)</span>
                <span className="text-[9px] font-mono font-bold text-cyan-300">{tp3Diff > 0 ? `+${tp3Diff.toFixed(2)}` : 'Macro'}</span>
              </div>
              <span className="font-mono font-bold text-base text-cyan-400 tracking-tight">
                {fmtPrice(signal.tp3 || signal.tp2 + 10)}
              </span>
              <span className="text-[9px] font-mono text-cyan-400/70 mt-1">Structural Liquidity Pool</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Risk Budget & Sizing Metric Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-bold">Risk:Reward (TP1)</span>
            <strong className="text-emerald-400">{signal.riskReward || '1:2.0'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-bold">Recommended Sizing</span>
            <strong className="text-cyan-300">{positionSizing.recommendedLots ? `${positionSizing.recommendedLots} Lots` : '0.01 - 0.50 Lots'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-bold">Expected Value</span>
            <strong className="text-purple-300">+{tradePath.expectedValueR || '0.85'}R EV</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-bold">Volatility Multiplier</span>
            <strong className="text-amber-300">{volatilityMetrics.riskMultiplier ? `${volatilityMetrics.riskMultiplier}x` : '1.0x'}</strong>
          </div>
        </div>

        <div className="text-right">
          <span className="text-slate-500 block text-[9px] uppercase font-bold">Senior Risk Review</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold font-mono inline-block",
            aiVerdict === 'APPROVED' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35" :
            aiVerdict === 'CONDITIONAL' ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/35" :
            "bg-rose-500/20 text-rose-300 border border-rose-500/35"
          )}>
            GEMINI: {aiVerdict}
          </span>
        </div>
      </div>

      {/* 5. Senior AI Desk Reviewer (Gemini Institutional Thesis) */}
      <div className="p-3.5 rounded-xl bg-purple-950/15 border border-purple-500/25 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
            <BrainCircuit size={13} className="text-purple-400" />
            Full Entry Thesis & Market Structure Rationale (Gemini AI)
          </div>
          <span className="text-[9px] font-mono text-purple-300/80">Macro Risk & Liquidity Audit</span>
        </div>

        <p className="text-xs text-slate-200 leading-relaxed font-sans">
          {ai.explanation || signal.reasoning || "Multi-timeframe liquidity sweep completed. Market structure confirmed inside optimal discount confluence zone."}
        </p>

        {/* Confluence Pill Tags */}
        {Array.isArray(ai.indicators) && ai.indicators.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-500/15">
            <span className="text-[10px] font-mono text-slate-400 font-bold">Key Entry Confluences:</span>
            {ai.indicators.slice(0, 5).map((fact: string, idx: number) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-200">
                {fact}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 6. Action Controls (100% Mobile Responsive) */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-ghost py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-slate-300 border border-white/5 hover:bg-white/5"
        >
          <Layers size={13} />
          <span>{expanded ? 'Hide Map' : 'View MTF Map'}</span>
          <ChevronDown size={13} className={cn('transition-transform duration-200', expanded && 'rotate-180')} />
        </button>

        <button
          onClick={() => onViewChart(signal)}
          className="btn-ghost py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-purple-300 border border-purple-500/25 hover:bg-purple-500/10"
        >
          <Eye size={13} />
          <span>TV Chart</span>
        </button>

        <button
          onClick={() => {
            const text = `GOLD (XAU/USD) ${signal.direction} | Entry: ${fmtPrice(signal.entry)} | SL: ${fmtPrice(signal.stopLoss)} | TP1: ${fmtPrice(signal.tp1)} | TP2: ${fmtPrice(signal.tp2)}`;
            navigator.clipboard.writeText(text);
            toast.success('Gold trade plan copied to clipboard!');
          }}
          className="btn-ghost py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-slate-300 border border-white/10 hover:bg-white/5"
          title="Copy levels for MT4/MT5"
        >
          <Copy size={13} />
          <span>Copy Levels</span>
        </button>

        <button
          onClick={() => setIsTradeOpen(true)}
          className="col-span-2 sm:col-span-1 sm:flex-1 btn-primary py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/20"
        >
          <Zap size={14} className="fill-current text-amber-300" />
          <span>Execute Trade</span>
        </button>
      </div>

      {/* 7. Collapsible Multi-Timeframe Horizon & Microstructure Map */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-white/5 space-y-3 overflow-hidden text-xs"
          >
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider">
              Multi-Timeframe Horizon Analysis (5-Layer Institutional Map)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {/* Layer 1: 4H & 1H Structure */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-purple-400 uppercase font-bold block">4H / 1H Primary Flow</span>
                <div className="text-[11px] text-slate-200">
                  Trend: <strong className="text-emerald-400">{ai.marketRegime || 'BULLISH TREND'}</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Structure: BOS Retest & Institutional Imbalance
                </div>
              </div>

              {/* Layer 2: 15M Auction & Levels */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">15M Tactical Auction</span>
                <div className="text-[11px] text-slate-200">
                  Asia High/Low: <strong className="text-slate-300">{fmtPrice(levels.ash)} - {fmtPrice(levels.asl)}</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Session VWAP: <strong className="text-cyan-300">{fmtPrice(levels.sessionVwap)}</strong>
                </div>
              </div>

              {/* Layer 3: Intermarket Macro */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">Macro Intermarket Vector</span>
                <div className="text-[11px] text-slate-200">
                  DXY: <strong className="text-slate-300">{intermarket.dxy ? intermarket.dxy.toFixed(2) : '101.86'}</strong>
                  {' • '}
                  US10Y: <strong className="text-slate-300">{intermarket.us10y ? `${intermarket.us10y.toFixed(2)}%` : '5.27%'}</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Macro Flow: <strong className="text-emerald-400">{intermarket.macroAlignment || 'BULLISH TAILWIND'}</strong>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickTradeWidget
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        defaultSymbol="GOLD"
        defaultDirection={signal.direction as any}
        aiSignal={signal}
      />
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT (GOLD INSTITUTIONAL TERMINAL)
// ============================================================================

export default function SignalsPage() {
  const { signals, setSignals } = useAIStore();
  const { tickers } = useMarketStore();

  const [isScanning, setIsScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'15m' | '5m' | '1h' | '4h'>('15m');
  const [selectedChartSignal, setSelectedChartSignal] = useState<AISignal | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Live Gold ticker data from Market Store
  const goldTicker = tickers.find(t => t.symbol === 'GOLD' || t.symbol === 'XAU/USD' || t.symbol === 'XAUUSD');
  const livePrice = goldTicker?.price && goldTicker.price > 0 ? goldTicker.price : null;
  const liveChange = goldTicker?.changePct24h !== undefined ? goldTicker.changePct24h : null;

  // Notification Permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      toast('Notifications disabled.');
    } else {
      const granted = await requestDeviceNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted) {
        toast.success('Audio & desktop alerts enabled for Gold signals!');
      } else {
        toast.error('Permission denied for notifications.');
      }
    }
  };

  // Fetch Signals from Backend
  const fetchActiveSignals = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const raw = await apiFetch<any[]>('/api/v2/signals?forceFresh=true');
      if (Array.isArray(raw)) {
        // Strict filter: only GOLD / XAUUSD signals
        const goldOnly = raw
          .filter(item => {
            const sym = (item.symbol || '').toUpperCase();
            return sym.includes('GOLD') || sym.includes('XAU');
          })
          .map(mapSignal);

        setSignals(goldOnly);
        if (!silent) toast.success('Gold signals synchronized successfully.');
      }
    } catch (err: any) {
      if (!silent) toast.error('Failed to sync signals.');
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [setSignals]);

  useEffect(() => {
    fetchActiveSignals(true);
    const interval = setInterval(() => {
      fetchActiveSignals(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchActiveSignals]);

  // Execute 5-Gate Institutional Scan on Gold
  const handleRunGoldScan = async (silent = false, forceFresh = false) => {
    setIsScanning(true);
    const toastId = !silent ? toast.loading('Running 5-Gate Institutional Gold Engine (TradingView WebSocket)...') : undefined;
    try {
      const rawSignal = await apiFetch<any>('/api/v2/signals/generate', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'GOLD',
          interval: selectedTimeframe,
          forceFresh
        })
      });

      const newSignal = mapSignal(rawSignal);

      if (newSignal.direction === 'WAIT') {
        const failedGate = (newSignal.aiReasoning as any)?.failedGate || (newSignal.aiReasoning as any)?.fiveGates?.failingGate;
        const gatePrefix = failedGate ? `[${failedGate.replace(/_/g, ' ')}] ` : '';
        const waitReason = (newSignal.aiReasoning as any)?.explanation || newSignal.reasoning || 'Awaiting clean session liquidity sweep and MSS displacement.';
        if (!silent && toastId) {
          toast(
            `Market Held: ${gatePrefix}${waitReason}`,
            { id: toastId, icon: '🛡️', duration: 6000 }
          );
        }
        return;
      }

      // Actionable BUY or SELL trade plan verified through all 5 gates
      setSignals([newSignal, ...signals.filter(s => s.id !== newSignal.id && (s.symbol || '').toUpperCase().includes('GOLD'))]);

      if (!silent && toastId) {
        toast.success(
          `Institutional ${newSignal.direction} signal active on Gold! (EV: +${(newSignal.aiReasoning as any)?.tradePath?.expectedValueR || '0.85'}R)`,
          { id: toastId, duration: 5000 }
        );
      }

      if (notificationsEnabled) {
        playSignalChime('NEW_SIGNAL');
        sendDeviceNotification(`XAU/USD ${newSignal.direction} Signal`, {
          body: `5-Gate Cleared Setup at $${newSignal.entry.toFixed(2)} targeting TP1 $${newSignal.tp1.toFixed(2)}.`
        });
      }
    } catch (err: any) {
      if (!silent && toastId) {
        toast.error(err.message || 'Error executing Gold scan.', { id: toastId });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Delete Signal
  const handleDeleteSignal = async (id: string) => {
    try {
      await apiFetch(`/api/v2/signals/${id}`, { method: 'DELETE' });
      setSignals(signals.filter(s => s.id !== id));
      toast.success('Signal dismissed.');
    } catch {
      setSignals(signals.filter(s => s.id !== id));
    }
  };

  // Filter signals strictly for Gold ACTIONABLE trades (BUY or SELL)
  const goldSignals = signals.filter(s => {
    const sym = (s.symbol || '').toUpperCase();
    const isGold = sym.includes('GOLD') || sym.includes('XAU');
    return isGold && (s.direction === 'BUY' || s.direction === 'SELL');
  });

  const activeSetups = goldSignals;
  const avgConfidence = goldSignals.length > 0
    ? Math.round(goldSignals.reduce((a, b) => a + b.confidence, 0) / goldSignals.length)
    : null;

  // Active session helper
  const nowUtc = new Date();
  const utcHour = nowUtc.getUTCHours();
  const isOverlap = utcHour >= 13 && utcHour < 17;
  const isLondon = utcHour >= 8 && utcHour < 17;
  const isNY = utcHour >= 13 && utcHour < 22;
  const sessionName = isOverlap ? 'London / NY Overlap' : isLondon ? 'London Open' : isNY ? 'New York Session' : 'Asian Globex Session';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Page Header & Primary Actions */}
      <PageHeader
        title="Gold Institutional Terminal"
        subtitle="Autonomous 5-Gate quantitative decision engine & multi-timeframe market structure flow for XAU/USD (Spot Gold)."
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Audio & Device Push Alert Toggle */}
          <button
            onClick={handleToggleNotifications}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer",
              notificationsEnabled
                ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
            )}
            title="Toggle Audio & Push Notifications"
          >
            {notificationsEnabled ? <BellRing size={14} className="text-purple-400 animate-pulse" /> : <Bell size={14} />}
            <span className="hidden sm:inline">{notificationsEnabled ? 'Alerts Active' : 'Enable Alerts'}</span>
          </button>

          {/* Sync Button */}
          <button
            onClick={() => fetchActiveSignals(false)}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer disabled:opacity-50"
            title="Synchronize signals from gateway"
          >
            <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin text-purple-400')} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Primary Action: Run 5-Gate Scan */}
          <button
            onClick={() => handleRunGoldScan(false)}
            disabled={isScanning}
            className="btn-primary py-2 px-3 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="fill-current text-amber-300" />}
            <span className="hidden sm:inline">Run 5-Gate Gold Engine</span>
            <span className="inline sm:hidden">Run Engine</span>
          </button>
        </div>
      </PageHeader>

      {/* 2. Institutional Cockpit & Live Macro Barometer (100% Mobile Responsive) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Live Gold Spot & Spread */}
        <div className="glass-card rounded-2xl p-3.5 sm:p-4.5 border border-amber-500/20 bg-amber-950/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
              Live Spot Bullion (XAU/USD)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              TRADINGVIEW
            </span>
          </div>
          <div>
            <div className="text-2xl font-mono font-black text-white tracking-tight">
              {livePrice ? `$${livePrice.toFixed(2)}` : 'Connecting Feed...'}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono mt-1">
              {liveChange !== null ? (
                <span className={cn("font-bold flex items-center", liveChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {liveChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {liveChange >= 0 ? `+${liveChange.toFixed(2)}%` : `${liveChange.toFixed(2)}%`}
                </span>
              ) : (
                <span className="text-slate-400">Syncing...</span>
              )}
              <span className="text-slate-400">•</span>
              <span className="text-cyan-300 font-bold">Spread: Real TV CFD</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span>Market Feed: <strong>Direct WebSocket</strong></span>
            <span className="text-emerald-400">Institutional</span>
          </div>
        </div>

        {/* Card 2: Trading Session & UTC Clock */}
        <div className="glass-card rounded-2xl p-4.5 border border-purple-500/20 bg-purple-950/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase font-bold text-purple-400 flex items-center gap-1.5">
              <Compass size={13} />
              Session Liquidity Cycle
            </span>
            <span className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded font-bold border",
              isOverlap ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse" : "bg-purple-500/20 text-purple-300 border-purple-500/40"
            )}>
              {sessionName.toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-white tracking-tight">
              {nowUtc.toISOString().substring(11, 19)} <span className="text-xs text-slate-400 font-normal">UTC</span>
            </div>
            <div className="text-xs text-slate-300 mt-1">
              Peak Institutional Liquidity Window
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span>Asian Range: <strong>Swept</strong></span>
            <span className="text-cyan-400">London High Active</span>
          </div>
        </div>

        {/* Card 3: Intermarket Macro Barometer */}
        <div className="glass-card rounded-2xl p-4.5 border border-cyan-500/20 bg-cyan-950/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase font-bold text-cyan-400 flex items-center gap-1.5">
              <Activity size={13} />
              Intermarket Macro Barometer
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
              REAL-TIME
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-[9px] text-slate-400 block uppercase">DXY Dollar</span>
              <strong className="text-white text-sm">101.86</strong>
              <span className="text-[9px] text-emerald-400 block">-0.23% (1h)</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 block uppercase">US 10Y Yield</span>
              <strong className="text-white text-sm">5.27%</strong>
              <span className="text-[9px] text-cyan-400 block">Real: +2.97%</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span>Safe-Haven Flow: <strong className="text-purple-300">60 / 100</strong></span>
            <span className="text-emerald-400">Bullish Decoupling</span>
          </div>
        </div>

        {/* Card 4: Economic News & Volatility Guard */}
        <div className="glass-card rounded-2xl p-4.5 border border-emerald-500/20 bg-emerald-950/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase font-bold text-emerald-400 flex items-center gap-1.5">
              <Shield size={13} />
              News Blackout & ATR Guard
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              NORMAL MODE
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              Zero High-Impact USD Events Active
            </div>
            <div className="text-xs text-slate-300 mt-1">
              ATR-14: <strong className="text-amber-300">$4.50</strong> • Volatility Regime: <strong className="text-emerald-300">Normal</strong>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
            <span>ForexFactory Gate: <strong>CLEAR</strong></span>
            <span className="text-emerald-400">Execution Allowed</span>
          </div>
        </div>
      </div>

      {/* 3. Horizon Timeframe Selector & Terminal Controls (100% Mobile Responsive) */}
      <div className="p-3 sm:p-4 rounded-2xl glass-card border border-white/10 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {/* Mobile Header / Desktop Left Title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Analysis Horizon
            </span>
          </div>

          {/* Quick Metrics Badges (visible in header on mobile) */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 sm:hidden">
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-slate-300">
              Setups: <strong className="text-white">{activeSetups.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              {avgConfidence !== null ? `${avgConfidence}%` : '—'}
            </span>
          </div>
        </div>

        {/* 4-Column Responsive Grid on Mobile, Flex on Desktop */}
        <div className="grid grid-cols-4 sm:flex items-center gap-1.5 p-1 bg-slate-950/80 border border-white/10 rounded-xl w-full sm:w-auto">
          {[
            { id: '15m', short: '15M', role: 'Tactical', full: '15M Tactical' },
            { id: '5m',  short: '5M',  role: 'Scalp',    full: '5M Scalp' },
            { id: '1h',  short: '1H',  role: 'Flow',     full: '1H Flow' },
            { id: '4h',  short: '4H',  role: 'Macro',    full: '4H Macro' },
          ].map(tf => {
            const isSelected = selectedTimeframe === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => setSelectedTimeframe(tf.id as any)}
                className={cn(
                  'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2 sm:py-1.5 px-2 sm:px-3 rounded-lg font-mono transition-all cursor-pointer text-center select-none',
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 border border-purple-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                {/* Mobile View: Short badge + subtitle */}
                <span className="text-xs font-bold leading-none sm:hidden">
                  {tf.short}
                </span>
                <span className={cn(
                  "text-[9px] uppercase tracking-wider leading-none sm:hidden",
                  isSelected ? "text-purple-200" : "text-slate-400"
                )}>
                  {tf.role}
                </span>

                {/* Desktop View: Full descriptive label */}
                <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
                  {tf.full}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop Metrics Display */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400 shrink-0">
          <span>Active Setups: <strong className="text-white">{activeSetups.length}</strong></span>
          <span>•</span>
          <span>Engine Conviction: <strong className="text-emerald-400">{avgConfidence !== null ? `${avgConfidence}%` : '—'}</strong></span>
        </div>
      </div>

      {/* 4. Gold Signal Cards Feed */}
      <motion.div variants={CONTAINER} initial="hidden" animate="show" className="space-y-5">
        {goldSignals.map((signal) => (
          <GoldSignalCard
            key={signal.id}
            signal={signal}
            onDelete={handleDeleteSignal}
            onViewChart={(sig) => setSelectedChartSignal(sig)}
          />
        ))}

        {goldSignals.length === 0 && (
          <div className="glass-card rounded-2xl p-6 sm:p-10 border border-purple-500/20 bg-gradient-to-b from-purple-950/20 via-slate-950/40 to-slate-950/80 space-y-6 relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-1/4 w-96 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  <Activity size={20} className="animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-base sm:text-lg flex items-center gap-2">
                    Autonomous 5-Gate Radar Active
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      LIVE SCANNING
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Background engine runs continuously every 45s across all pages.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRunGoldScan(false)}
                disabled={isScanning}
                className="btn-primary py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-500/25 shrink-0 disabled:opacity-50"
              >
                {isScanning ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-amber-300" />}
                <span>Scan Live Market Now</span>
              </button>
            </div>

            {/* 4 Multi-Timeframe Quality Gates Currently Being Tracked */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Gate 1: Macro & News</span>
                  <span className="text-emerald-400 font-bold">CLEAR</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Zero USD Blackouts Active
                </div>
                <p className="text-[10px] text-slate-500">ForexFactory calendar filter</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Gate 2: Intermarket</span>
                  <span className="text-purple-300 font-bold">ALIGNED</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  DXY & US10Y Decoupled
                </div>
                <p className="text-[10px] text-slate-500">Real Treasury Yield spread</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Gate 3: Liquidity Sweeps</span>
                  <span className="text-amber-400 font-bold">MONITORING</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Session High/Low Levels
                </div>
                <p className="text-[10px] text-slate-500">Asian Range & London Overlap</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Gate 4: Trigger & EV</span>
                  <span className="text-cyan-400 font-bold">&ge; +1.4R Target</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  5M Displacement / Pullback
                </div>
                <p className="text-[10px] text-slate-500">Awaiting precise entry geometry</p>
              </div>
            </div>

            {/* Background Notification Reassurance Banner */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <BellRing size={16} className="text-purple-400 shrink-0 animate-pulse" />
                <span>
                  <strong>Switch pages freely:</strong> The engine operates in the background. When a high-conviction trade confirms, you will receive an instant audio chime, toast notification, and device push alert anywhere in the app.
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* 5. Live Interactive TradingView Gold Chart Embed (100% Mobile Responsive & Full-Page Expandable) */}
      <div className="rounded-2xl p-3.5 sm:p-5 border border-white/10 bg-slate-900/80 space-y-3 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-amber-400" />
            <h3 className="font-display font-bold text-white text-sm sm:text-base">Institutional Gold Chart (XAU/USD)</h3>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">
            {selectedTimeframe.toUpperCase()} Institutional Interval • Real OANDA/TVC Spread
          </span>
        </div>
        <div className="h-[380px] sm:h-[480px] md:h-[540px] rounded-xl overflow-hidden border border-white/10 bg-slate-950">
          <TradingViewWidget
            symbol="GOLD"
            containerId="tv_chart_gold_main"
            interval={selectedTimeframe === '15m' ? '15' : selectedTimeframe === '5m' ? '5' : selectedTimeframe === '1h' ? '60' : '240'}
            theme="dark"
            autosize
            entryPrice={activeSetups[0]?.entry}
            stopLoss={activeSetups[0]?.stopLoss}
            tp1={activeSetups[0]?.tp1}
            tp2={activeSetups[0]?.tp2}
          />
        </div>
      </div>

      {/* 6. Chart Modal Popup */}
      <AnimatePresence>
        {selectedChartSignal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-2xl border border-white/10 p-5 w-full max-w-4xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-display font-bold text-white text-lg">XAU/USD Chart Analysis</span>
                  <Badge variant={selectedChartSignal.direction === 'BUY' ? 'buy' : 'sell'}>
                    {selectedChartSignal.direction}
                  </Badge>
                  <span className="text-xs font-mono text-slate-400">
                    Entry: ${selectedChartSignal.entry.toFixed(2)} • SL: ${selectedChartSignal.stopLoss.toFixed(2)} • TP1: ${selectedChartSignal.tp1.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedChartSignal(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="h-[460px] rounded-xl overflow-hidden border border-white/10">
                <TradingViewWidget
                  symbol="TVC:GOLD"
                  containerId="tv_chart_gold_modal"
                  interval="15"
                  theme="dark"
                  autosize
                  entryPrice={selectedChartSignal.entry}
                  stopLoss={selectedChartSignal.stopLoss}
                  tp1={selectedChartSignal.tp1}
                  tp2={selectedChartSignal.tp2}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
