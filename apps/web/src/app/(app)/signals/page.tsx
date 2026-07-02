'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, BrainCircuit, TrendingUp, TrendingDown,
  Clock, Shield, Filter, ChevronDown, BarChart3
} from 'lucide-react';
import { useAIStore, AISignal } from '@/store/useAIStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { StatCard } from '@/components/ui/StatCard';
import { cn } from '@/lib/utils';

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const ITEM = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

function SignalCard({ signal, index }: { signal: AISignal; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isBuy = signal.direction === 'BUY';

  return (
    <motion.div
      variants={ITEM}
      className={cn(
        'glass-card rounded-2xl p-5 flex flex-col gap-4 border',
        isBuy ? 'border-emerald-500/10 hover:border-emerald-500/25' : 'border-red-500/10 hover:border-red-500/25'
      )}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: isBuy ? 'linear-gradient(90deg, #10b981, transparent)' : 'linear-gradient(90deg, #ef4444, transparent)' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-white text-lg">{signal.symbol}</span>
            <Badge variant={isBuy ? 'buy' : 'sell'}>{signal.direction}</Badge>
            <Badge variant="neutral" size="xs">{signal.type}</Badge>
          </div>
          <span className="text-[10px] text-slate-500">{signal.strategy}</span>
        </div>
        <ProgressRing
          value={signal.confidence}
          size={60}
          strokeWidth={6}
          color={isBuy ? '#10b981' : '#ef4444'}
          label={`${signal.confidence}`}
          sublabel="%"
        />
      </div>

      {/* Price Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-white/5 py-3">
        {[
          { label: 'Entry',      value: signal.entry.toLocaleString(),    color: 'text-slate-200' },
          { label: 'Stop Loss',  value: signal.stopLoss.toLocaleString(), color: 'text-red-400'   },
          { label: 'Target 1',   value: signal.tp1.toLocaleString(),      color: 'text-emerald-400' },
          { label: 'Target 2',   value: signal.tp2.toLocaleString(),      color: 'text-emerald-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-xs">
            <span className="block text-[9px] uppercase tracking-wider text-slate-600 mb-0.5">{label}</span>
            <span className={cn('font-bold', color)}>${value}</span>
          </div>
        ))}
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 text-xs">
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
          className="flex-1 btn-ghost py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          AI Analysis
          <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
        <button className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
          <Zap size={14} /> Execute Signal
        </button>
      </div>

      {/* Expanded Analysis */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white/2 border border-white/6 rounded-xl p-4 space-y-3 text-xs overflow-hidden"
          >
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider border-b border-white/5 pb-2">
              Multi-Factor AI Reasoning
            </div>
            {[
              { label: '📈 Technical Analysis', items: signal.technicals, color: 'text-emerald-400' },
              { label: '🏛️ Fundamental Data',  items: signal.fundamentals, color: 'text-blue-400' },
              { label: '💬 Market Sentiment',  items: signal.sentiment,    color: 'text-purple-400' },
            ].map(({ label, items, color }) => (
              <div key={label}>
                <div className={cn('text-[9px] font-bold uppercase tracking-wider mb-1.5', color)}>{label}</div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  {items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SignalsPage() {
  const { signals } = useAIStore();
  const [activeTab, setActiveTab] = useState<'all'|'crypto'|'stocks'|'forex'>('all');
  const filtered = activeTab === 'all' ? signals : signals.filter(s => s.type === activeTab);

  const buySignals  = signals.filter(s => s.direction === 'BUY');
  const sellSignals = signals.filter(s => s.direction === 'SELL');
  const avgConf     = Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length);

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      <PageHeader
        title="AI Signal Intelligence"
        subtitle="Real-time multi-factor signals generated by ensemble AI models. Updated every 60 seconds."
        icon={Zap}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {signals.length} Active Signals
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Signals"    value={signals.length.toString()}    icon={Zap}         iconColor="#a78bfa" accentColor="rgba(139,92,246,0.5)" />
        <StatCard label="Buy Signals"      value={buySignals.length.toString()}  icon={TrendingUp}  iconColor="#34d399" accentColor="rgba(16,185,129,0.5)" />
        <StatCard label="Sell Signals"     value={sellSignals.length.toString()} icon={TrendingDown} iconColor="#f87171" accentColor="rgba(239,68,68,0.5)" />
        <StatCard label="Avg Confidence"   value={`${avgConf}%`}                 icon={BrainCircuit} iconColor="#818cf8" accentColor="rgba(99,102,241,0.5)" />
      </div>

      {/* Tab Filter */}
      <div className="flex items-center justify-between">
        <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
          {(['all','crypto','stocks','forex'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg capitalize font-semibold transition-all',
                activeTab === tab ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <button className="btn-ghost px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">
          <Filter size={14} /> Filter
        </button>
      </div>

      {/* Signal Cards */}
      <motion.div
        variants={CONTAINER}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {filtered.map((signal, i) => (
          <SignalCard key={signal.id} signal={signal} index={i} />
        ))}
      </motion.div>

      {/* Disclaimer */}
      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-500">
        <Shield size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-400">Risk Disclaimer:</strong> AI signals are generated by algorithmic models analyzing historical patterns and current market data. Past performance does not guarantee future results. All trading carries risk. Always apply your own due diligence and ensure signals align with your risk tolerance and investment objectives.
        </p>
      </div>
    </motion.div>
  );
}
