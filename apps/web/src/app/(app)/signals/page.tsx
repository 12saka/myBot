'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, BrainCircuit, TrendingUp, TrendingDown,
  Clock, Shield, Filter, ChevronDown, BarChart3, X, Trash2, Maximize2, Minimize2, Plus, Eye, Loader2, RefreshCw, Sparkles, AlertTriangle, Trophy, Target, Bell, BellRing
} from 'lucide-react';
import { useAIStore, AISignal } from '@/store/useAIStore';
import { useMarketStore } from '@/store/useMarketStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { StatCard } from '@/components/ui/StatCard';
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
const ITEM = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

interface SignalCardProps {
  signal: AISignal;
  index: number;
  onDelete: (id: string) => void;
  onViewChart: (signal: AISignal) => void;
}

function SignalCard({ signal, index, onDelete, onViewChart }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const isBuy = signal.direction === 'BUY';

  // Real-time Relative Timestamp (Ticks live)
  const [timeAgo, setTimeAgo] = useState('Just now');
  const [waitCountdown, setWaitCountdown] = useState(10);

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

  // Strict 10-Second Wait Signal Auto-Dismissal
  useEffect(() => {
    if (signal.direction !== 'WAIT') return;
    const createdMs = signal.createdAt ? new Date(signal.createdAt).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - createdMs) / 1000);
    const remaining = Math.max(0, 10 - elapsed);
    setWaitCountdown(remaining);

    if (remaining === 0) {
      onDelete(signal.id);
      return;
    }

    const timer = setInterval(() => {
      setWaitCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDelete(signal.id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [signal.id, signal.direction, signal.createdAt, onDelete]);

  return (
    <motion.div
      variants={ITEM}
      className={cn(
        'glass-card rounded-2xl p-5 flex flex-col gap-4 border relative group transition-all duration-300',
        isBuy ? 'border-emerald-500/10 hover:border-emerald-500/25 bg-emerald-950/5' : 'border-red-500/10 hover:border-red-500/25 bg-red-950/5'
      )}
    >
      {/* Top indicator bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: isBuy ? 'linear-gradient(90deg, #10b981, transparent)' : 'linear-gradient(90deg, #ef4444, transparent)' }}
      />

      {/* Delete / Dismiss button in top corner */}
      <button
        onClick={() => onDelete(signal.id)}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 md:bg-white/0 hover:bg-white/10 md:hover:bg-white/5 text-slate-500 hover:text-red-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 cursor-pointer"
        title="Delete Signal"
      >
        <Trash2 size={13} />
      </button>

      {/* Header */}
      <div className="flex items-start justify-between pr-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-display font-bold text-white text-lg">{signal.symbol}</span>
            <Badge variant={isBuy ? 'buy' : 'sell'}>{signal.direction}</Badge>
            <Badge variant="neutral" size="xs">{signal.type}</Badge>
            {(() => {
              const rawGrade = signal.signalGrade || signal.aiReasoning?.signal_grade || signal.aiReasoning?.signalGrade || (signal.confidence >= 88 ? 'A+ Setup' : signal.confidence >= 80 ? 'A Setup' : signal.confidence >= 70 ? 'B+ Setup' : signal.confidence >= 60 ? 'B Setup' : 'C Setup');
              const letter = rawGrade.includes('A+') ? 'A+' : rawGrade.includes('A') ? 'A' : rawGrade.includes('B+') ? 'B+' : rawGrade.includes('B') ? 'B' : 'C';
              const isA = letter.startsWith('A');
              const isB = letter.startsWith('B');
              return (
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-black font-mono flex items-center gap-1 border shadow-sm",
                  isA ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10" :
                  isB ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10" :
                  "bg-amber-500/20 text-amber-300 border-amber-500/40"
                )}>
                  {isA ? '🏆 GRADE' : isB ? '📊 GRADE' : '⚠️ GRADE'} {letter} ({rawGrade.replace(/^(A\+|A|B\+|B|C)\s*/, '') || 'Institutional'})
                </span>
              );
            })()}
            <Badge variant={!signal.aiReasoning?.entry_type || ['MARKET_NOW', 'MARKET'].includes(signal.aiReasoning?.entry_type) ? 'buy' : 'blue'} size="xs">
              {!signal.aiReasoning?.entry_type || ['MARKET_NOW', 'MARKET'].includes(signal.aiReasoning?.entry_type) ? '⚡ Direct Market NOW' : '🎯 Limit Retest Zone'}
            </Badge>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ⏱️ {signal.aiReasoning?.timeframe || '15m'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500">{signal.strategy}</span>
            <span className="text-[10px] text-cyan-300 font-mono flex items-center gap-1 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
              <Clock size={10} className="text-cyan-400" /> Updated: {timeAgo}
            </span>
            {signal.direction === 'WAIT' && (
              <span className="text-[10px] text-amber-300 font-mono font-bold flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 animate-pulse">
                ⏳ Auto-Dismissing in {waitCountdown}s...
              </span>
            )}
          </div>
        </div>
        <ProgressRing
          value={signal.confidence}
          size={54}
          strokeWidth={5}
          color={isBuy ? '#10b981' : '#ef4444'}
          label={`${signal.confidence}`}
          sublabel="%"
        />
      </div>

      {/* Price Grid (Clear, unclipped micro-cards) */}
      <div className={cn("grid gap-2 border-y border-white/5 py-3", signal.tp3 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
        {[
          { 
            label: 'Entry', 
            val: signal.entry, 
            color: 'text-slate-200' 
          },
          { 
            label: 'Stop Loss', 
            val: signal.stopLoss, 
            color: 'text-red-400'   
          },
          { 
            label: 'Target 1', 
            val: signal.tp1, 
            color: 'text-emerald-400' 
          },
          { 
            label: 'Target 2', 
            val: signal.tp2, 
            color: 'text-emerald-300' 
          },
          ...(signal.tp3 ? [{
            label: 'Target 3',
            val: signal.tp3,
            color: 'text-cyan-400'
          }] : [])
        ].map(({ label, val, color }) => {
          const isForex = signal.type === 'forex' || ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'].some(fx => signal.symbol.includes(fx) || signal.symbol.replace('/', '') === fx.replace('/', ''));
          const isJpy = signal.symbol.includes('JPY');
          const maxDecimals = isForex ? (isJpy ? 3 : 4) : 2;
          const formatted = typeof val === 'number' && !isNaN(val) 
            ? val.toLocaleString('en-US', { minimumFractionDigits: isForex ? (isJpy ? 3 : 4) : 2, maximumFractionDigits: maxDecimals }) 
            : '0.00';
          const prefix = isForex ? '' : '$';
          
          return (
            <div key={label} className="p-2 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col justify-center min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold mb-0.5">{label}</span>
              <span className={cn('font-mono font-extrabold text-xs sm:text-sm tracking-tight block whitespace-nowrap overflow-x-auto scrollbar-none', color)}>
                {prefix}{formatted}
              </span>
            </div>
          );
        })}
      </div>

      {/* Small Account & Intraday Risk Management Banner */}
      {(() => {
        const isForex = signal.type === 'forex' || ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'].some(fx => signal.symbol.includes(fx) || signal.symbol.replace('/', '') === fx.replace('/', ''));
        const isJpy = signal.symbol.includes('JPY');
        const isGold = signal.symbol.includes('XAU') || signal.symbol.includes('GOLD');
        const isIndex = ['US30', 'US100', 'SPX500', 'DAX40'].some(idx => signal.symbol.includes(idx));
        const isCrypto = signal.type === 'crypto' || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => signal.symbol.includes(c));
        
        const slDiff = Math.abs(signal.entry - signal.stopLoss);
        let riskLabel = '';
        if (isForex) {
          const pips = isJpy ? (slDiff * 100).toFixed(1) : (slDiff * 10000).toFixed(1);
          riskLabel = `Risk: ${pips} pips (~$${(Number(pips) * 0.1).toFixed(2)} on 0.01 lot)`;
        } else if (isGold) {
          riskLabel = `Risk: $${slDiff.toFixed(2)} (~$${slDiff.toFixed(2)} on 0.01 lot)`;
        } else if (isIndex) {
          riskLabel = `Risk: ${slDiff.toFixed(1)} pts (~$${(slDiff * 0.05).toFixed(2)} on 0.05 lot)`;
        } else if (isCrypto) {
          const pct = ((slDiff / (signal.entry || 1)) * 100).toFixed(2);
          riskLabel = `Risk: ${pct}% ($${slDiff.toFixed(1)})`;
        } else {
          riskLabel = `Risk: $${slDiff.toFixed(2)}`;
        }

        return (
          <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900/60 border border-emerald-500/20 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold text-emerald-400">
                {isIndex
                  ? '⚠️ Index Scalp ($25+ Margin - Suitable for >$50 Accounts)'
                  : '🟢 Micro Account Approved (0.01 Micro-Lot)'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
              <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Lot: <strong className="text-emerald-400">0.01 Micro</strong>
              </span>
              <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                <strong className="text-amber-400">{riskLabel}</strong>
              </span>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-wrap items-center gap-4 text-xs">
        {[
          { label: 'Risk:Reward', value: signal.riskReward, icon: BarChart3 },
          { label: 'Win Prob',    value: signal.probability, icon: Shield },
          { label: 'Duration',   value: signal.duration,   icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon size={12} className="text-slate-500" />
            <span className="text-slate-500">{label}:</span>
            <span className="font-semibold text-slate-200">{value}</span>
          </div>
        ))}
      </div>

      {/* Win probability bar */}
      <div>
        <div className="progress-track h-1.5">
          <div
            className={cn('h-full rounded-full transition-all duration-1000', isBuy ? 'bg-emerald-500' : 'bg-red-500')}
            style={{ width: signal.probability }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 btn-ghost py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          AI Reasoning
          <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
        <button
          onClick={() => onViewChart(signal)}
          className="btn-ghost py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer text-purple-400 border border-purple-500/10 hover:border-purple-500/30"
          title="View Chart"
        >
          <Eye size={12} /> Chart
        </button>
        <button
          onClick={() => setIsTradeOpen(true)}
          className="flex-1 btn-primary py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Zap size={12} /> Execute
        </button>
      </div>

      {/* Actionable Next Steps & Insights Guidance Banner */}
      <div className="bg-slate-900/80 p-3 rounded-xl border border-purple-500/20 text-xs text-slate-300 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase text-[10px] tracking-wider text-purple-400 flex items-center gap-1">
            💡 Pro Trader Actionable Insights
          </span>
          <span className="text-[10px] text-slate-400 font-mono">15m Scalp Protocol</span>
        </div>
        <div className="text-[11px] text-slate-200 font-medium leading-relaxed">
          {(() => {
            const isForex = signal.type === 'forex' || ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'].some(fx => signal.symbol.includes(fx) || signal.symbol.replace('/', '') === fx.replace('/', ''));
            const isJpy = signal.symbol.includes('JPY');
            const dec = isForex ? (isJpy ? 3 : 4) : 2;
            const fmt = (v: any) => typeof v === 'number' && !isNaN(v) ? (isForex ? v.toFixed(dec) : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '0.00';
            
            return isBuy 
              ? `Enter Buy at ${fmt(signal.entry)}. Set Invalidation SL at ${fmt(signal.stopLoss)}. Secure TP1 at ${fmt(signal.tp1)} (trail SL to breakeven), let remainder run to TP2 (${fmt(signal.tp2)}).` 
              : `Enter Sell at ${fmt(signal.entry)}. Set Invalidation SL at ${fmt(signal.stopLoss)}. Secure TP1 at ${fmt(signal.tp1)} (trail SL to breakeven), let remainder run to TP2 (${fmt(signal.tp2)}).`;
          })()}
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => {
              const isForex = signal.type === 'forex' || ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'].some(fx => signal.symbol.includes(fx) || signal.symbol.replace('/', '') === fx.replace('/', ''));
              const isJpy = signal.symbol.includes('JPY');
              const dec = isForex ? (isJpy ? 3 : 4) : 2;
              const fmt = (v: any) => typeof v === 'number' && !isNaN(v) ? (isForex ? v.toFixed(dec) : `$${v.toFixed(2)}`) : '0.00';
              navigator.clipboard.writeText(`Symbol: ${signal.symbol} | ${signal.direction} | Entry: ${fmt(signal.entry)} | SL: ${fmt(signal.stopLoss)} | TP1: ${fmt(signal.tp1)} | TP2: ${fmt(signal.tp2)}`);
              toast.success(`Copied trade parameters for ${signal.symbol} to clipboard! Paste into MT4/MT5.`, {
                icon: '📋',
                duration: 5000
              });
            }}
            className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            📋 Copy MT4/MT5 Levels
          </button>
        </div>
      </div>

      {/* Expanded Analysis */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/2 border border-white/6 rounded-xl p-4 space-y-3.5 text-xs overflow-hidden"
          >
            {/* TradingView Idea Banner */}
            {signal.tradingviewIdea && (
              <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg text-purple-200 text-xs font-medium leading-relaxed">
                <span className="font-bold text-purple-400 block mb-1 uppercase tracking-wider text-[10px]">🎯 PRO TradingView Setup Rationale</span>
                {signal.tradingviewIdea}
              </div>
            )}

            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider border-b border-white/5 pb-1.5">
              Multi-Factor AI Reasoning & Explanation
            </div>

            {/* 12-Layer XAUUSD / Confluence Breakdown */}
            {signal.aiReasoning?.reasons_for && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-white/5 pb-2.5">
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg">
                  <span className="font-bold text-emerald-400 block mb-1 uppercase tracking-wider text-[10px]">🟢 Reasons Supporting Trade (+Score)</span>
                  <ul className="list-disc pl-3.5 space-y-0.5 text-[10px] text-emerald-200">
                    {signal.aiReasoning.reasons_for.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                  </ul>
                </div>
                {signal.aiReasoning?.reasons_against?.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-500/20 p-2.5 rounded-lg">
                    <span className="font-bold text-amber-400 block mb-1 uppercase tracking-wider text-[10px]">⚠️ Risk Flags / Headwinds</span>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-[10px] text-amber-200">
                      {signal.aiReasoning.reasons_against.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {[
              { label: '📈 Technical Analysis & Confluence', items: signal.technicals, color: 'text-emerald-400' },
              { label: '🏛️ Fundamental & News Backdrop',  items: signal.fundamentals, color: 'text-blue-400' },
              { label: '💬 Market Structure & SMC Liquidity',  items: signal.sentiment,    color: 'text-purple-400' },
            ].map(({ label, items, color }) => (
              <div key={label}>
                <div className={cn('text-[9px] font-bold uppercase tracking-wider mb-1', color)}>{label}</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}

            {/* Live Quantitative Metrics & Indicator Verdicts */}
            {signal.evidence && typeof signal.evidence === 'object' && Object.keys(signal.evidence).length > 0 && (
              <div className="border-t border-white/5 pt-2.5 space-y-2">
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  📊 Quantitative Indicators & Confluence Weights
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                  {signal.evidence.ema20 && (
                    <div className="p-2 rounded bg-slate-900/60 border border-white/5">
                      <span className="text-slate-500 block text-[9px]">EMA-20</span>
                      <strong className="text-emerald-400">{typeof signal.evidence.ema20 === 'number' ? signal.evidence.ema20.toFixed(2) : signal.evidence.ema20}</strong>
                    </div>
                  )}
                  {signal.evidence.ema50 && (
                    <div className="p-2 rounded bg-slate-900/60 border border-white/5">
                      <span className="text-slate-500 block text-[9px]">EMA-50</span>
                      <strong className="text-purple-400">{typeof signal.evidence.ema50 === 'number' ? signal.evidence.ema50.toFixed(2) : signal.evidence.ema50}</strong>
                    </div>
                  )}
                  {signal.evidence.rsi && (
                    <div className="p-2 rounded bg-slate-900/60 border border-white/5">
                      <span className="text-slate-500 block text-[9px]">RSI-14</span>
                      <strong className={Number(signal.evidence.rsi) > 50 ? 'text-emerald-400' : 'text-rose-400'}>
                        {typeof signal.evidence.rsi === 'number' ? signal.evidence.rsi.toFixed(1) : signal.evidence.rsi}
                      </strong>
                    </div>
                  )}
                  {signal.evidence.atr && (
                    <div className="p-2 rounded bg-slate-900/60 border border-white/5">
                      <span className="text-slate-500 block text-[9px]">ATR-14 Volatility</span>
                      <strong className="text-amber-400">{typeof signal.evidence.atr === 'number' ? signal.evidence.atr.toFixed(2) : signal.evidence.atr}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Indicator Verdicts Breakdown */}
            {signal.indicatorVerdicts && Object.keys(signal.indicatorVerdicts).length > 0 && (
              <div className="border-t border-white/5 pt-2.5">
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  ⚡ Technical Structure Verdicts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  {Object.entries(signal.indicatorVerdicts).map(([key, verdict]) => (
                    <div key={key} className="bg-slate-900/60 p-2 rounded border border-white/5 text-slate-300">
                      <span className="font-bold uppercase text-slate-400 block mb-0.5">{key}</span>
                      {String(verdict)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-t border-white/5 pt-2 mt-2">
              🧠 Real-Time AI Signal Architecture
            </div>
            <div className="text-[10px] text-slate-400 leading-normal bg-white/2 p-2.5 rounded-lg border border-white/5">
              <span><strong>Quantitative Confluence Pipeline</strong>: Evaluates live EMA dynamic trends, SMC liquidity sweeps, RSI momentum, and ATR risk buffers to output high-probability execution levels.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickTradeWidget
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        defaultSymbol={signal.symbol}
        defaultDirection={signal.direction as any}
        aiSignal={signal}
      />
    </motion.div>
  );
}

const AVAILABLE_MARKETS = [
  { name: 'Bitcoin', symbol: 'BTC/USD', type: 'crypto' },
  { name: 'Ethereum', symbol: 'ETH/USD', type: 'crypto' },
  { name: 'Solana', symbol: 'SOL/USD', type: 'crypto' },
  { name: 'Binance Coin', symbol: 'BNB/USD', type: 'crypto' },
  { name: 'Ripple', symbol: 'XRP/USD', type: 'crypto' },
  { name: 'Apple Inc.', symbol: 'AAPL', type: 'stocks' },
  { name: 'Tesla Inc.', symbol: 'TSLA', type: 'stocks' },
  { name: 'NVIDIA Corp.', symbol: 'NVDA', type: 'stocks' },
  { name: 'Microsoft Corp.', symbol: 'MSFT', type: 'stocks' },
  { name: 'Amazon Inc.', symbol: 'AMZN', type: 'stocks' },
  { name: 'Dow Jones Index', symbol: 'US30', type: 'indices' },
  { name: 'NASDAQ 100', symbol: 'US100', type: 'indices' },
  { name: 'S&P 500', symbol: 'SPX500', type: 'indices' },
  { name: 'DAX 40', symbol: 'DAX40', type: 'indices' },
  { name: 'Gold Spot', symbol: 'XAU/USD', type: 'commodities' },
  { name: 'Crude Oil', symbol: 'OIL', type: 'commodities' },
  { name: 'Euro / USD', symbol: 'EUR/USD', type: 'forex' },
  { name: 'Pound / USD', symbol: 'GBP/USD', type: 'forex' },
  { name: 'USD / Yen', symbol: 'USD/JPY', type: 'forex' },
];

export default function SignalsPage() {
  const { signals, setSignals, autonomousActive, autoGenerate, setAutoGenerate } = useAIStore();
  const { watchlist, tickers } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'all'|'crypto'|'stocks'|'indices'|'forex'|'commodities'>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m'|'3m'|'5m'|'15m'|'30m'|'1h'>('1h');
  
  // Generation & refresh states
  const [generatingSymbol, setGeneratingSymbol] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Chart drawer states
  const [selectedChartSignal, setSelectedChartSignal] = useState<AISignal | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Manual Form States
  const [manualSymbol, setManualSymbol] = useState('BTC/USD');
  const [manualDirection, setManualDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [manualEntry, setManualEntry] = useState('');
  const [manualStopLoss, setManualStopLoss] = useState('');
  const [manualTp1, setManualTp1] = useState('');
  const [manualTp2, setManualTp2] = useState('');
  const [manualConfidence, setManualConfidence] = useState('85');
  const [manualStrategy, setManualStrategy] = useState('Manual Pivot Strategy');
  const [manualExplanation, setManualExplanation] = useState('');

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleNotifications = async () => {
    const granted = await requestDeviceNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      playSignalChime('NEW_SIGNAL');
      sendDeviceNotification('TradeMind AI Alerts Active', {
        body: 'Device notifications activated! You will receive instant push alerts when new trade signals trigger or reach take profit.'
      });
      toast.success('On-device notifications enabled!');
    } else {
      toast.error('Device notification permission was not granted.');
    }
  };

  // Real-time Target Price & TP Monitor (Checks live market prices vs active targets every 2.5s)
  useEffect(() => {
    const checkTargets = async () => {
      const activeList = useAIStore.getState().signals || [];
      if (activeList.length === 0 || !tickers || tickers.length === 0) return;

      for (const sig of activeList) {
        if (sig.direction === 'WAIT' || !sig.entry || !sig.tp1) continue;

        const norm = sig.symbol.replace('/USD', '').toUpperCase();
        const ticker = tickers.find((t) => t.symbol.toUpperCase().replace('/USD', '') === norm || t.symbol.toUpperCase() === norm);
        if (!ticker || !ticker.price) continue;

        const curr = ticker.price;
        const isBuy = sig.direction === 'BUY';
        const hitTP = isBuy ? curr >= sig.tp1 : curr <= sig.tp1;

        if (hitTP) {
          playSignalChime('TP_HIT');
          sendDeviceNotification(`🎯 Take Profit Hit: ${sig.symbol}!`, {
            body: `${sig.direction} target achieved at ${sig.tp1} (+${sig.riskReward} R:R). Generating next fresh signal...`,
          });
          toast.success(`🎉 TARGET HIT on ${sig.symbol} at ${sig.tp1}! Closed in full profit (+${sig.riskReward}). Generating replacement signal...`, {
            duration: 6000,
            icon: '🎯',
          });

          // Auto-dismiss the hit signal
          handleDeleteSignal(sig.id);

          // Immediately generate replacement fresh signal
          setTimeout(() => {
            handleGenerateSignalSilent(sig.symbol);
          }, 1000);
          break;
        }
      }
    };

    const interval = setInterval(checkTargets, 2500);
    return () => clearInterval(interval);
  }, [tickers]);

  const filtered = activeTab === 'all' ? signals : signals.filter(s => s.type === activeTab);
  const buySignals  = signals.filter(s => s.direction === 'BUY');
  const sellSignals = signals.filter(s => s.direction === 'SELL');
  const avgConf     = signals.length > 0 ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length) : 0;

  // Background Auto-Generator loop
  useEffect(() => {
    if (!autoGenerate) return;

    const interval = setInterval(() => {
      const userWatchlist = watchlist || [];
      const sourceList = userWatchlist.length > 0
        ? userWatchlist
        : AVAILABLE_MARKETS.map(m => m.symbol);

      const randSymbol = sourceList[Math.floor(Math.random() * sourceList.length)];
      handleGenerateSignalSilent(randSymbol);
    }, 15000);

    return () => clearInterval(interval);
  }, [autoGenerate, signals, watchlist]);

  // Initial load and continuous live background polling
  useEffect(() => {
    fetchActiveSignalsSilent();
    const pollInterval = setInterval(() => {
      fetchActiveSignalsSilent();
    }, 10000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchActiveSignalsSilent = async () => {
    if (generatingSymbol) return;

    try {
      const raw = await apiFetch<any[]>('/api/v2/signals');
      if (Array.isArray(raw)) {
        const nowMs = Date.now();
        const activeOnly = raw.map(mapSignal).filter(s => {
          // Filter out WAIT signals older than 10s
          if (s.direction === 'WAIT') {
            const ageMs = s.createdAt ? (nowMs - new Date(s.createdAt).getTime()) : 0;
            if (ageMs > 10000) return false;
          }
          if (s.expiresAt && new Date(s.expiresAt).getTime() < nowMs) return false;
          if (s.status === 'EXPIRED' || s.status === 'CLOSED') return false;
          return true;
        });

        const currentSignals = useAIStore.getState().signals || [];
        const recentLocalSignals = currentSignals.filter(s => s.createdAt && (nowMs - new Date(s.createdAt).getTime() < 30000));
        
        const mergedMap = new Map<string, AISignal>();
        activeOnly.forEach(s => {
          const sym = s.symbol;
          mergedMap.set(sym, { ...s, symbol: sym });
        });
        recentLocalSignals.forEach(s => {
          if (!mergedMap.has(s.symbol)) {
            mergedMap.set(s.symbol, s);
          }
        });

        setSignals(Array.from(mergedMap.values()));
      }
    } catch (err) {
      console.warn('Initial signals fetch skipped:', err);
    }
  };

  const fetchActiveSignals = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading('Refreshing AI signals from gateway...');
    try {
      const raw = await apiFetch<any[]>('/api/v2/signals');
      if (Array.isArray(raw)) {
        const nowMs = Date.now();
        const activeOnly = raw.map(mapSignal).filter(s => {
          if (s.direction === 'WAIT') {
            const ageMs = s.createdAt ? (nowMs - new Date(s.createdAt).getTime()) : 0;
            if (ageMs > 10000) return false;
          }
          if (s.expiresAt && new Date(s.expiresAt).getTime() < nowMs) return false;
          if (s.status === 'EXPIRED' || s.status === 'CLOSED') return false;
          return true;
        });
        setSignals(activeOnly);
        toast.success('AI signals list updated successfully!', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync active signals.', { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateSignalSilent = async (symbol: string) => {
    try {
      const rawSignal = await apiFetch<any>('/api/v2/signals/generate', {
        method: 'POST',
        body: JSON.stringify({ symbol, interval: selectedTimeframe })
      });
      const newSignal = mapSignal(rawSignal);
      if (newSignal.direction === 'WAIT') {
        return;
      }
      
      const exists = signals.some(s => s.symbol === newSignal.symbol && s.direction === newSignal.direction);
      setSignals([newSignal, ...signals.filter(s => s.symbol !== newSignal.symbol)]);

      // Trigger Acoustic Chime & Native OS Device Push Alert
      playSignalChime('NEW_SIGNAL');
      sendDeviceNotification(`⚡ New AI Signal: ${newSignal.direction} ${newSignal.symbol}`, {
        body: `Entry: ${newSignal.entry} | Target: ${newSignal.tp1} | R:R: ${newSignal.riskReward}`,
      });

      // Autonomous execution if bot is running
      if (autonomousActive && !exists) {
        let quantity = 1.0;
        if (newSignal.entry > 1000) {
          quantity = parseFloat((100 / newSignal.entry).toFixed(4));
        } else if (newSignal.entry > 100) {
          quantity = parseFloat((50 / newSignal.entry).toFixed(2));
        } else {
          quantity = 10.0;
        }

        try {
          await apiFetch('/api/v2/portfolio/order', {
            method: 'POST',
            body: JSON.stringify({
              symbol: newSignal.symbol,
              direction: newSignal.direction,
              type: 'MARKET',
              quantity
            })
          });
          toast.success(`Autonomous bot automatically executed ${newSignal.direction} order for ${newSignal.symbol}!`);
        } catch (err: any) {
          console.error(`[AUTONOMOUS BOT] Auto-order failed: ${err.message}`);
        }
      }

      // Display dynamic custom visual notification alert toast
      if (!exists) {
        toast.custom((t) => (
          <div
            className={cn(
              "max-w-md w-full bg-slate-950/95 border border-purple-500/25 shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 gap-2.5 backdrop-blur-xl border-l-4 transition-all duration-300",
              newSignal.direction === 'BUY' ? "border-l-emerald-500" : "border-l-red-500",
              t.visible ? 'animate-enter' : 'animate-leave'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Zap size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white">Incoming AI Trade Signal</p>
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ensemble AI models detected a high-probability <span className={cn("font-bold", newSignal.direction === 'BUY' ? "text-emerald-400" : "text-red-400")}>{newSignal.direction}</span> configuration for <span className="text-white font-bold">{newSignal.symbol}</span>.
                </p>
              </div>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ), { duration: 6000 });
      }
    } catch (err) {
      console.warn('Silent signal generate failed:', err);
    }
  };

  const handleGenerateSignal = async (symbol: string) => {
    setGeneratingSymbol(symbol);
    const toastId = toast.loading(`Ensemble AI analyzing price & technical models for ${symbol} (${selectedTimeframe})...`);
    try {
      const rawSignal = await apiFetch<any>('/api/v2/signals/generate', {
        method: 'POST',
        body: JSON.stringify({ symbol, interval: selectedTimeframe })
      });
      const newSignal = mapSignal(rawSignal);
      if (newSignal.direction === 'WAIT') {
        const hasActiveForSymbol = signals.some(s => s.symbol === newSignal.symbol && s.direction !== 'WAIT');
        if (!hasActiveForSymbol) {
          setSignals([newSignal, ...signals.filter(s => s.symbol !== newSignal.symbol)]);
        }
        toast(`No clean setup for ${symbol}: ${newSignal.reasoning || 'market consolidating.'}`, { id: toastId });
        return;
      }
      setSignals([newSignal, ...signals.filter(s => s.symbol !== newSignal.symbol)]);
      
      // Trigger Acoustic Chime & Native OS Device Push Alert
      playSignalChime('NEW_SIGNAL');
      sendDeviceNotification(`⚡ Generated Signal: ${newSignal.direction} ${newSignal.symbol}`, {
        body: `Entry: ${newSignal.entry} | Target: ${newSignal.tp1} | R:R: ${newSignal.riskReward}`,
      });
      
      toast.success(`Generated AI Signal for ${symbol} successfully!`, { id: toastId });

      // Autonomous execution if bot is running
      if (autonomousActive) {
        let quantity = 1.0;
        if (newSignal.entry > 1000) {
          quantity = parseFloat((100 / newSignal.entry).toFixed(4));
        } else if (newSignal.entry > 100) {
          quantity = parseFloat((50 / newSignal.entry).toFixed(2));
        } else {
          quantity = 10.0;
        }

        try {
          await apiFetch('/api/v2/portfolio/order', {
            method: 'POST',
            body: JSON.stringify({
              symbol: newSignal.symbol,
              direction: newSignal.direction,
              type: 'MARKET',
              quantity
            })
          });
          toast.success(`Autonomous bot automatically executed ${newSignal.direction} order for ${newSignal.symbol}!`);
        } catch (err: any) {
          toast.error(`Autonomous execution failed: ${err.message}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || `Failed to generate signal for ${symbol}.`, { id: toastId });
    } finally {
      setGeneratingSymbol(null);
    }
  };

  const handleGenerateAll = async () => {
    setIsBatchGenerating(true);
    const toastId = toast.loading(`Scanning top watchlist markets on ${selectedTimeframe}...`);
    const keySymbols = ['BTC/USD', 'ETH/USD', 'US30', 'US100', 'XAU/USD', 'EUR/USD', 'USD/JPY'];
    let count = 0;
    try {
      for (const sym of keySymbols) {
        try {
          const rawSignal = await apiFetch<any>('/api/v2/signals/generate', {
            method: 'POST',
            body: JSON.stringify({ symbol: sym, interval: selectedTimeframe })
          });
          const newSignal = mapSignal(rawSignal);
          if (newSignal.direction !== 'WAIT') {
            const currentSignals = useAIStore.getState().signals || [];
            setSignals([newSignal, ...currentSignals.filter(s => s.symbol !== newSignal.symbol)]);
            count++;
          }
        } catch (symErr) {}
      }
      playSignalChime('NEW_SIGNAL');
      toast.success(`Watchlist scan complete! Generated ${count} live ${selectedTimeframe} setups.`, { id: toastId });
    } catch (err: any) {
      toast.error('Batch scan encountered an issue.', { id: toastId });
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const handleDeleteSignal = async (id: string) => {
    const toastId = toast.loading('Dismissing active signal...');
    try {
      await apiFetch(`/api/v2/signals/${id}`, {
        method: 'DELETE'
      });
      setSignals(signals.filter(s => s.id !== id));
      toast.success('Signal deleted successfully!', { id: toastId });
    } catch (err: any) {
      setSignals(signals.filter(s => s.id !== id));
      toast.success('Signal dismissed locally.', { id: toastId });
    }
  };

  const handlePublishManualSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEntry || !manualStopLoss || !manualTp1 || !manualTp2) {
      toast.error('Please fill in entry, stop loss, and target values.');
      return;
    }

    const toastId = toast.loading('Publishing manual signal...');
    try {
      const rawSignal = await apiFetch<any>('/api/v2/signals', {
        method: 'POST',
        body: JSON.stringify({
          symbol: manualSymbol,
          direction: manualDirection,
          entryPrice: Number(manualEntry),
          stopLoss: Number(manualStopLoss),
          takeProfit1: Number(manualTp1),
          takeProfit2: Number(manualTp2),
          confidence: Number(manualConfidence),
          strategy: manualStrategy,
          explanation: manualExplanation || 'Manual pivot structure identified by user technical analysis.'
        })
      });

      const newSignal = mapSignal(rawSignal);
      setSignals([newSignal, ...signals.filter(s => s.symbol !== newSignal.symbol)]);
      toast.success(`Manual signal for ${manualSymbol} published successfully!`, { id: toastId });
      setShowManualModal(false);

      setManualEntry('');
      setManualStopLoss('');
      setManualTp1('');
      setManualTp2('');
      setManualExplanation('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish manual signal.', { id: toastId });
    }
  };

  return (
    <motion.div className="space-y-6 pb-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      <PageHeader
        title="AI Signal Intelligence"
        subtitle="Ensemble predictions generated from multi-temporal price sequence vectors and technical crossovers."
        icon={Zap}
      >
        <div className="flex items-center gap-3">
          {/* Native Device Notifications Button */}
          <button
            onClick={handleToggleNotifications}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm",
              notificationsEnabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10"
                : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
            )}
            title={notificationsEnabled ? "Device Push Alerts Active" : "Enable On-Device Push Alerts"}
          >
            {notificationsEnabled ? <BellRing size={14} className="text-emerald-400 animate-bounce" /> : <Bell size={14} />}
            <span>{notificationsEnabled ? "Alerts On" : "Enable Alerts"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchActiveSignals}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Signals List"
          >
            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
          </button>

          {/* Automatic Generation Toggle */}
          <div className="flex items-center gap-2 bg-white/3 border border-white/6 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400 font-semibold">Auto-Generator (Watchlist):</span>
            <button
              onClick={() => {
                setAutoGenerate(!autoGenerate);
                toast.success(autoGenerate ? 'Auto-Generator paused.' : 'Auto-generator targeting watchlist items is running.');
              }}
              className={cn(
                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer",
                autoGenerate ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              )}
            >
              {autoGenerate ? 'Active' : 'Off'}
            </button>
            {autoGenerate && <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />}
          </div>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-purple-500/10"
          >
            <Plus size={14} /> Manual Creator
          </button>
        </div>
      </PageHeader>

      {/* Live Operational Engines & Global Market Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Volatility Protection Engine */}
        <div className="glass-card rounded-2xl p-4 border border-blue-500/20 bg-blue-950/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Clock size={14} /> Volatility & Risk Guard
            </span>
            <Badge variant="green" size="sm">Active Engine</Badge>
          </div>
          <div className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-white/5 text-xs text-slate-300">
            <div>
              <div className="font-bold text-white">Dynamic Volatility Filter (ATR-14)</div>
              <div className="text-[10px] text-slate-400">Risk Boundaries: Active │ Drawdown Guard: Enabled</div>
            </div>
            <div className="text-right font-mono font-bold text-emerald-400 text-xs">
              Optimal
            </div>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Shield size={12} className="text-emerald-400 shrink-0" /> Auto ATR stop-loss buffer active for all direct market setups.
          </div>
        </div>

        {/* Global Trading Sessions Engine */}
        <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 bg-emerald-950/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Global Market Sessions
            </span>
            {(() => {
              const h = new Date().getUTCHours();
              const isOverlap = h >= 13 && h < 17;
              const isLondon = h >= 8 && h < 17;
              const isNY = h >= 13 && h < 22;
              return (
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold font-mono",
                  isOverlap ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse" :
                  isLondon || isNY ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" :
                  "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                )}>
                  {isOverlap ? "🔥 LONDON/NY OVERLAP" : isLondon ? "🟢 LONDON OPEN" : isNY ? "🟢 NEW YORK OPEN" : "🌙 ASIAN GLOBEX"}
                </span>
              );
            })()}
          </div>
          
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
            {(() => {
              const h = new Date().getUTCHours();
              const sessions = [
                { name: 'London', open: h >= 8 && h < 17, hours: '08-17 UTC' },
                { name: 'New York', open: h >= 13 && h < 22, hours: '13-22 UTC' },
                { name: 'Tokyo', open: h >= 0 && h < 9, hours: '00-09 UTC' },
                { name: 'Sydney', open: h >= 22 || h < 7, hours: '22-07 UTC' },
              ];
              return sessions.map(s => (
                <div key={s.name} className={cn("p-1.5 rounded-lg border", s.open ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold" : "bg-white/2 border-white/5 text-slate-500")}>
                  <div>{s.name}</div>
                  <div className="text-[8px] opacity-75">{s.open ? "● OPEN" : "○ CLOSED"}</div>
                </div>
              ));
            })()}
          </div>

          <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Server Time: {new Date().toISOString().substring(11, 16)} UTC</span>
            <span className="text-emerald-400 font-bold">Max Execution Volatility</span>
          </div>
        </div>

        {/* Technical Structure Confluence Engine */}
        <div className="glass-card rounded-2xl p-4 border border-purple-500/20 bg-purple-950/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <BrainCircuit size={14} /> Market Confluence Engine
            </span>
            <Badge variant="purple" size="sm">7-Step Confluence</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Fair Value Gap (FVG)</div>
              <div className="font-bold text-emerald-400 text-[11px]">3-Candle Imbalance</div>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Institutional Block</div>
              <div className="font-bold text-emerald-400 text-[11px]">Liquidity Sweeps</div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 italic">
            Structure: Signals enforce multi-timeframe EMA & RSI momentum confluence.
          </div>
        </div>
      </div>

      {/* Risk Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-300">Trading Risk Disclaimer</p>
          <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
            AI signals are probabilistic tools based on technical analysis — not financial advice. No signal is 100% guaranteed.
            Always use stop losses and risk only capital you can afford to lose. Past performance does not guarantee future results.
          </p>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Signals"    value={signals.length.toString()}    icon={Zap}         iconColor="#a78bfa" accentColor="rgba(139,92,246,0.5)" />
        <StatCard label="Buy Signals"      value={buySignals.length.toString()}  icon={TrendingUp}  iconColor="#34d399" accentColor="rgba(16,185,129,0.5)" />
        <StatCard label="Sell Signals"     value={sellSignals.length.toString()} icon={TrendingDown} iconColor="#f87171" accentColor="rgba(239,68,68,0.5)" />
        <StatCard label="Avg Confidence"   value={`${avgConf}%`}                 icon={BrainCircuit} iconColor="#818cf8" accentColor="rgba(99,102,241,0.5)" />
        <StatCard label="Win Rate"         value={(() => {
          const resolved = signals.filter(s => s.status === 'HIT_TP1' || s.status === 'HIT_TP2' || s.status === 'HIT_SL');
          if (resolved.length === 0) return 'N/A';
          const wins = resolved.filter(s => s.status === 'HIT_TP1' || s.status === 'HIT_TP2').length;
          return `${Math.round((wins / resolved.length) * 100)}%`;
        })()}                                                                     icon={Trophy}      iconColor="#fbbf24" accentColor="rgba(251,191,36,0.5)" />
      </div>

      {/* Market Selector Directory */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <h3 className="font-display font-bold text-white text-sm mb-0.5">Ensemble AI Market Directory</h3>
            <p className="text-[11px] text-slate-400">Select any index, commodity, stock, or coin below to execute predictive models.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleGenerateAll()}
              disabled={generatingSymbol !== null || isBatchGenerating}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isBatchGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Analyze Watchlist ({selectedTimeframe})
            </button>
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
              {(['1m', '3m', '5m', '15m', '30m', '1h'] as const).map(tf => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer",
                    selectedTimeframe === tf 
                      ? "bg-purple-500 text-white shadow-md shadow-purple-500/10" 
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
          {AVAILABLE_MARKETS.map(market => {
            const isGeneratingThis = generatingSymbol === market.symbol;
            return (
              <button
                key={market.symbol}
                onClick={() => handleGenerateSignal(market.symbol)}
                disabled={generatingSymbol !== null}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50",
                  market.type === 'crypto'
                    ? 'border-purple-500/10 hover:border-purple-500/35 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300'
                    : market.type === 'stocks'
                    ? 'border-blue-500/10 hover:border-blue-500/35 bg-blue-500/5 hover:bg-blue-500/10 text-blue-300'
                    : market.type === 'indices'
                    ? 'border-indigo-500/10 hover:border-indigo-500/35 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300'
                    : market.type === 'commodities'
                    ? 'border-amber-500/10 hover:border-amber-500/35 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/10 hover:border-emerald-500/35 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300'
                )}
              >
                {isGeneratingThis ? <Loader2 size={12} className="animate-spin text-purple-400" /> : <BrainCircuit size={12} />}
                {market.name} ({market.symbol})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex items-center justify-between">
        <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs overflow-x-auto max-w-full">
          {(['all', 'crypto', 'stocks', 'indices', 'forex', 'commodities'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg capitalize font-semibold transition-all cursor-pointer whitespace-nowrap',
                activeTab === tab ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Cards */}
      <motion.div
        variants={CONTAINER}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {filtered.map((signal, i) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            index={i}
            onDelete={handleDeleteSignal}
            onViewChart={setSelectedChartSignal}
          />
        ))}
      </motion.div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center border border-white/5">
          <Zap className="mx-auto text-slate-600 mb-3" size={32} />
          <h4 className="font-bold text-white mb-1">No Active Signals</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select a market from the directory above or toggle Auto-Generator ON to produce AI predictive signals.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-500">
        <Shield size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-400">Risk Disclaimer:</strong> AI signals are generated by algorithmic models analyzing historical patterns and current market data. Past performance does not guarantee future results. All trading carries risk. Always apply your own due diligence and ensure signals align with your risk tolerance and investment objectives.
        </p>
      </div>

      {/* TradingView Chart Side Drawer */}
      <AnimatePresence>
        {selectedChartSignal && (
          <div className={cn("fixed inset-0 flex justify-end", isFullscreen ? "z-[60]" : "z-[55]")}>
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedChartSignal(null)}
            />

            {/* Sidebar Panel */}
            <motion.div
              className={cn(
                "relative h-full border-l border-white/10 bg-[#080d1a] shadow-2xl overflow-y-auto flex flex-col transition-all duration-300",
                isFullscreen ? "w-screen max-w-full" : "w-full max-w-3xl"
              )}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-base">{selectedChartSignal.symbol} — Signal Chart & Full Analysis</h3>
                    <p className="text-[10px] text-slate-500">Live TradingView charting feed annotated with AI indicators</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    onClick={() => setSelectedChartSignal(null)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div className={cn("flex-shrink-0 px-2 pt-2 relative transition-all duration-300", isFullscreen ? "h-[80vh]" : "h-[240px] md:h-[450px]")}>
                <TradingViewWidget
                  symbol={selectedChartSignal.symbol}
                  height="100%"
                  entryPrice={selectedChartSignal.entry}
                  stopLoss={selectedChartSignal.stopLoss}
                  tp1={selectedChartSignal.tp1}
                  tp2={selectedChartSignal.tp2}
                />
              </div>

              {/* Mobile Swipe helper notice */}
              <div className="md:hidden text-[9px] text-slate-500 font-bold text-center py-1 bg-white/2 border-b border-white/5 flex items-center justify-center gap-1">
                <span>💡 Touch the margins or swipe outside the chart frame to scroll details</span>
              </div>

              {/* Target Price Labels Overlay */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/60 backdrop-blur-md border-y border-white/5 px-6 py-3.5 flex-shrink-0">
                {[
                  { label: 'AI Entry Price', value: selectedChartSignal.entry.toLocaleString(), color: 'border-purple-500/20 text-purple-300 bg-purple-500/5' },
                  { label: 'Stop Loss (Invalidation)', value: selectedChartSignal.stopLoss.toLocaleString(), color: 'border-red-500/20 text-red-400 bg-red-500/5' },
                  { label: 'Take Profit 1', value: selectedChartSignal.tp1.toLocaleString(), color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' },
                  { label: 'Take Profit 2', value: selectedChartSignal.tp2.toLocaleString(), color: 'border-teal-500/20 text-teal-300 bg-teal-500/5' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={cn("p-2 rounded-xl border flex flex-col gap-0.5", color)}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">{label}</span>
                    <span className="text-sm font-bold">${value}</span>
                  </div>
                ))}
              </div>

              {/* Detailed Multi-Factor AI Analysis Breakdown */}
              {(() => {
                const scores = selectedChartSignal.aiReasoning?.scores || {
                  bullish: selectedChartSignal.direction === 'BUY' ? 82 : (selectedChartSignal.direction === 'SELL' ? 18 : 50),
                  bearish: selectedChartSignal.direction === 'SELL' ? 82 : (selectedChartSignal.direction === 'BUY' ? 18 : 50),
                  momentum: 62,
                  volume: 75,
                  trend: 80,
                  volatility: 60,
                  confidence: selectedChartSignal.confidence
                };
                const status = selectedChartSignal.aiReasoning?.status || 'ACTIVE';
                const technicals = selectedChartSignal.aiReasoning?.technicals || {};
                const structure = selectedChartSignal.aiReasoning?.structure || {};

                return (
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto pb-32 md:pb-12">
                    {/* Signal Lifecycle Timeline */}
                    <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Signal Lifecycle Timeline</h4>
                      <div className="flex items-center justify-between relative px-2">
                        {/* Line connector */}
                        <div className="absolute top-4 left-6 right-6 h-[2px] bg-slate-800 -z-10" />
                        
                        {[
                          { label: 'Detected', active: true },
                          { label: 'AI Analyzed', active: true },
                          { label: 'Active', active: status === 'ACTIVE' || status === 'RUNNING' || status.includes('HIT') },
                          { label: 'Running', active: status === 'RUNNING' || status.includes('HIT') },
                          { label: 'Closed', active: status.includes('HIT') || status === 'CLOSED' },
                        ].map(({ label, active }, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300",
                              active 
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]" 
                                : "bg-slate-900 text-slate-600 border-white/5"
                            )}>
                              {idx + 1}
                            </div>
                            <span className={cn("text-[9px] font-bold uppercase tracking-wider", active ? "text-purple-300" : "text-slate-600")}>
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* AI Diagram Panel / Market Score */}
                      <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Sparkles size={14} className="text-purple-400" />
                          AI Market Score
                        </h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Bullish Score', val: scores.bullish, color: 'bg-emerald-500' },
                            { label: 'Bearish Score', val: scores.bearish, color: 'bg-red-500' },
                            { label: 'Momentum', val: scores.momentum, color: 'bg-blue-500' },
                            { label: 'Volume', val: scores.volume, color: 'bg-indigo-500' },
                            { label: 'Trend Strength', val: scores.trend, color: 'bg-purple-500' },
                            { label: 'Volatility', val: scores.volatility, color: 'bg-amber-500' },
                            { label: 'Model Confidence', val: scores.confidence, color: 'bg-fuchsia-500' },
                          ].map(({ label, val, color }) => (
                            <div key={label} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                                <span>{label}</span>
                                <span className="text-slate-200">{val}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800/85 rounded-full overflow-hidden">
                                <motion.div 
                                  className={cn("h-full rounded-full", color)}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${val}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AI Reasoning Checklist */}
                      <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">AI Reasoning Checklist</h4>
                        <div className="space-y-2.5 text-[11px]">
                          {[
                            { label: `Trend: ${scores.bullish > 50 ? 'Bullish' : 'Bearish'}`, check: scores.bullish > 50 ? scores.bullish > 55 : scores.bearish > 55 },
                            { label: `EMA Alignment: EMA20 ${technicals.ema20 && technicals.ema50 ? (technicals.ema20 > technicals.ema50 ? '>' : '<') : '~'} EMA50 ${technicals.ema50 && technicals.ema200 ? (technicals.ema50 > technicals.ema200 ? '> EMA200' : '< EMA200') : ''}`, check: scores.bullish > 50 ? (technicals.ema20 > technicals.ema50) : (technicals.ema20 < technicals.ema50) },
                            { label: `MACD Crossover ${technicals.macd_hist > 0 ? 'Bullish' : 'Bearish'}`, check: scores.bullish > 50 ? technicals.macd_hist > 0 : technicals.macd_hist < 0 },
                            { label: `RSI: ${technicals.rsi14 ? Math.round(technicals.rsi14) : '—'}`, check: scores.momentum < 75 && scores.momentum > 35 },
                            { label: 'Volume Breakout Confirmed', check: scores.volume > 60 },
                            { label: 'Fair Value Gap Respected', check: !!structure.fvg_detected },
                            { label: 'Order Block Respected', check: !!structure.order_block_detected },
                            { label: 'Liquidity Sweep Completed', check: !!structure.liquidity_sweep },
                          ].map(({ label, check }, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 text-slate-400 bg-white/2 p-2 rounded-xl border border-white/5">
                              <span className={cn(
                                "h-4.5 w-4.5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors",
                                check 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-slate-800 text-slate-600 border-white/5"
                              )}>
                                {check ? "✔" : "—"}
                              </span>
                              <span className="truncate">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Per-Indicator Verdicts */}
                    {selectedChartSignal.aiReasoning?.indicator_verdicts && Object.keys(selectedChartSignal.aiReasoning.indicator_verdicts).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">📊 Indicator-by-Indicator Analysis</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(selectedChartSignal.aiReasoning.indicator_verdicts).map(([key, verdict]) => {
                            const icons: Record<string, string> = { ema: '📈', rsi: '⚡', macd: '🔄', bollinger: '📉', vwap: '🏦', atr: '📏', adx: '💪' };
                            const labels: Record<string, string> = { ema: 'EMA Alignment', rsi: 'RSI Momentum', macd: 'MACD Crossover', bollinger: 'Bollinger Bands', vwap: 'VWAP Analysis', atr: 'ATR Volatility', adx: 'ADX Trend Strength' };
                            return (
                              <div key={key} className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs text-slate-300 leading-relaxed">
                                <div className="font-bold text-white mb-1">{icons[key] || '📌'} {labels[key] || key.toUpperCase()}</div>
                                <p className="text-slate-400">{verdict as string}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Market Structure Analysis */}
                    {selectedChartSignal.aiReasoning?.market_structure_analysis && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">🏗️ Market Structure Analysis</h4>
                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300 leading-relaxed">
                          <p>{selectedChartSignal.aiReasoning.market_structure_analysis}</p>
                        </div>
                      </div>
                    )}

                    {/* TradingView Trade Idea */}
                    {selectedChartSignal.aiReasoning?.tradingview_idea && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">💡 Trade Idea Summary</h4>
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-amber-200 leading-relaxed">
                          <p className="font-medium">{selectedChartSignal.aiReasoning.tradingview_idea}</p>
                        </div>
                      </div>
                    )}

                    {/* Institutional Analysis Upgrade Display */}
                    {(selectedChartSignal.aiReasoning?.macro_context || selectedChartSignal.aiReasoning?.correlation_analysis || selectedChartSignal.aiReasoning?.category_scores) && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">🏛️ Institutional Analysis Layers</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Macroeconomic & News sentiment */}
                          {selectedChartSignal.aiReasoning?.macro_context && (
                            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs leading-relaxed space-y-2">
                              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                                <span>🌍 Macroeconomic & Fundamental Driver</span>
                              </div>
                              <p className="text-slate-400">{selectedChartSignal.aiReasoning.macro_context}</p>
                            </div>
                          )}

                          {/* Cross-Asset Correlation */}
                          {selectedChartSignal.aiReasoning?.correlation_analysis && (
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs leading-relaxed space-y-2">
                              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                                <span>🔗 Cross-Asset Correlation Analysis</span>
                              </div>
                              <p className="text-slate-400">{selectedChartSignal.aiReasoning.correlation_analysis}</p>
                            </div>
                          )}
                        </div>

                        {/* Category Scores breakdown */}
                        {selectedChartSignal.aiReasoning?.category_scores && (
                          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-3">
                            <div className="text-xs font-bold text-purple-300">📊 Multi-Factor Weighted Scoring Model</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {[
                                { name: 'Technical (30%)', val: selectedChartSignal.aiReasoning.category_scores.technical },
                                { name: 'Fundamental (25%)', val: selectedChartSignal.aiReasoning.category_scores.fundamental },
                                { name: 'Sentiment (15%)', val: selectedChartSignal.aiReasoning.category_scores.sentiment },
                                { name: 'Correlation (10%)', val: selectedChartSignal.aiReasoning.category_scores.correlation },
                                { name: 'Volume/Liq (10%)', val: selectedChartSignal.aiReasoning.category_scores.volume },
                                { name: 'On-Chain (10%)', val: selectedChartSignal.aiReasoning.category_scores.on_chain },
                              ].map(({ name, val }) => {
                                const percentage = val ? Math.round(Number(val) * 100) : 50;
                                return (
                                  <div key={name} className="space-y-1 bg-white/2 p-2 rounded-lg border border-white/5">
                                    <div className="flex justify-between text-[9px] font-semibold text-slate-400">
                                      <span>{name}</span>
                                      <span className="text-slate-200">{percentage}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-800/80 rounded-full overflow-hidden">
                                      <div className="h-full bg-purple-500 rounded-full animate-width-fill" style={{ width: `${percentage}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Indicators details list */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Technical Indicators Overlay</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {selectedChartSignal.technicals.map((item, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-white/2 border border-white/5 text-slate-400 flex items-start gap-2">
                            <TrendingUp size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deep AI Analysis & Outlook */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">🧠 AI Analysis & Outlook</h4>
                      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-purple-300 leading-relaxed space-y-3">
                        <div className="flex flex-wrap gap-3 text-[10px] border-b border-white/5 pb-3 mb-2">
                          <span className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-0.5 font-bold">Strategy: {selectedChartSignal.strategy}</span>
                          <span className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-0.5 font-bold">Confidence: {selectedChartSignal.confidence}%</span>
                          <span className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-0.5 font-bold">Win Prob: {selectedChartSignal.probability}</span>
                          <span className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 font-bold">Duration: {selectedChartSignal.duration}</span>
                          <span className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg px-2 py-0.5 font-bold">R:R {selectedChartSignal.riskReward}</span>
                        </div>
                        {selectedChartSignal.reasoning && (
                          <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                            {selectedChartSignal.reasoning}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Actions */}
              <div className="flex gap-3 border-t border-white/5 px-6 py-4 mt-auto">
                <button
                  onClick={() => setSelectedChartSignal(null)}
                  className="px-5 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold cursor-pointer w-full text-center"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Signal Creator Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualModal(false)}
            />

            <motion.div
              className="relative w-full max-w-lg glass-panel bg-slate-950/90 rounded-2xl border border-white/10 p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <h3 className="font-display font-bold text-white text-base">Manual Signal Creator</h3>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handlePublishManualSignal} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Market Symbol</label>
                    <select
                      value={manualSymbol}
                      onChange={(e) => setManualSymbol(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    >
                      {AVAILABLE_MARKETS.map(m => (
                        <option key={m.symbol} value={m.symbol}>{m.name} ({m.symbol})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Direction</label>
                    <div className="flex gap-2 h-10">
                      <button
                        type="button"
                        onClick={() => setManualDirection('BUY')}
                        className={cn(
                          "flex-1 rounded-xl font-bold uppercase transition-all cursor-pointer",
                          manualDirection === 'BUY' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/10'
                        )}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualDirection('SELL')}
                        className={cn(
                          "flex-1 rounded-xl font-bold uppercase transition-all cursor-pointer",
                          manualDirection === 'SELL' ? 'bg-red-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/10'
                        )}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Entry Price</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Target entry level"
                      value={manualEntry}
                      onChange={(e) => setManualEntry(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Stop Loss</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Stop loss boundary"
                      value={manualStopLoss}
                      onChange={(e) => setManualStopLoss(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Take Profit 1</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Target 1 level"
                      value={manualTp1}
                      onChange={(e) => setManualTp1(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Take Profit 2</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Target 2 level"
                      value={manualTp2}
                      onChange={(e) => setManualTp2(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Confidence (%)</label>
                    <input
                      type="number"
                      placeholder="e.g. 85"
                      value={manualConfidence}
                      onChange={(e) => setManualConfidence(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Strategy Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Fibonacci Pivot"
                      value={manualStrategy}
                      onChange={(e) => setManualStrategy(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Explanation</label>
                  <textarea
                    rows={2}
                    placeholder="Provide technical support reasonings..."
                    value={manualExplanation}
                    onChange={(e) => setManualExplanation(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white font-semibold outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary py-2.5 rounded-xl font-bold cursor-pointer"
                  >
                    Publish Signal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
