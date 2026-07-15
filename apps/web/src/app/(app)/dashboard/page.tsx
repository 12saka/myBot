'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BrainCircuit, Activity, TrendingUp, TrendingDown, Zap, Shield,
  BarChart3, RefreshCw, Newspaper
} from 'lucide-react';
import { useAIStore } from '@/store/useAIStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useMarketStore } from '@/store/useMarketStore';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MiniSparkline } from '@/components/charts/MiniSparkline';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';

const btcData = [61200, 62400, 63100, 62800, 64318];
const ethData = [3050, 3120, 3090, 3200, 3182];

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function DashboardPage() {
  const { signals, autonomousActive, aiMode } = useAIStore();
  const { totalValue, totalPnl, totalPnlPct } = usePortfolioStore();
  const { tickers } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'all' | 'crypto' | 'stocks' | 'forex'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState('BTC');
  const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');

  const openTrade = (symbol: string, direction: 'BUY' | 'SELL') => {
    setTradeSymbol(symbol);
    setTradeDirection(direction);
    setIsTradeOpen(true);
  };

  // Fetch real portfolio stats
  const [stats, setStats] = useState<any>({ totalTrades: 0, winRate: '0.0%', aiAccuracy: '0.0%', avgConfidence: '0%', portfolioVolatility: '0.0' });
  const [dashboardNews, setDashboardNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
    fetch('/api/v2/portfolio/stats', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});

    // Fetch dashboard news
    fetch('/api/v2/markets/news')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data)) {
          setDashboardNews(data.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, []);

  // Compute real Fear & Greed from signal data
  const avgRsi = signals.length > 0
    ? signals.reduce((sum, s) => sum + (s.confidence || 50), 0) / signals.length
    : 50;
  const fearGreedValue = Math.min(100, Math.max(0, Math.round(avgRsi)));
  const fearGreedLabel = fearGreedValue > 75 ? 'Extreme Greed' : fearGreedValue > 55 ? 'Greed' : fearGreedValue > 45 ? 'Neutral' : fearGreedValue > 25 ? 'Fear' : 'Extreme Fear';
  const fearGreedVariant = fearGreedValue > 55 ? 'green' as const : fearGreedValue > 45 ? 'neutral' as const : 'red' as const;

  // Parse real AI confidence from stats
  const aiConfidenceValue = parseInt(stats.avgConfidence) || 0;
  const aiConfidenceVariant = aiConfidenceValue > 70 ? 'purple' as const : aiConfidenceValue > 50 ? 'blue' as const : 'amber' as const;
  const aiConfidenceLabel = aiConfidenceValue > 70 ? 'High' : aiConfidenceValue > 50 ? 'Moderate' : 'Low';

  // Parse real portfolio volatility
  const volValue = parseFloat(stats.portfolioVolatility) || 0;
  const volPct = Math.min(100, Math.round(volValue * 2));
  const volVariant = volValue > 30 ? 'red' as const : volValue > 15 ? 'amber' as const : 'green' as const;
  const volLabel = volValue > 30 ? 'High' : volValue > 15 ? 'Moderate' : 'Low';

  const filteredSignals = activeTab === 'all' ? signals : signals.filter((s) => s.type === activeTab);
  const topTickers = tickers.slice(0, 6);

  return (
    <motion.div className="space-y-6" variants={CONTAINER} initial="hidden" animate="show">

      {/* Header */}
      <motion.div variants={ITEM}>
        <PageHeader
          title="AI Command Center"
          subtitle="Real-time multi-agent market observation. All automated risk limits are active."
          icon={BrainCircuit}
        >
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold',
            autonomousActive
              ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
              : 'bg-white/5 border border-white/10 text-slate-400'
          )}>
            <span className={cn('h-2 w-2 rounded-full', autonomousActive ? 'bg-purple-400 animate-ping' : 'bg-slate-600')} />
            {autonomousActive ? 'Autonomous Active' : 'Manual Mode'}
          </div>
          <button onClick={() => openTrade('BTC', 'BUY')} className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs cursor-pointer">
            <Zap size={14} />
            Quick Trade
          </button>
        </PageHeader>
      </motion.div>

      {/* Stats */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio Value"
          value={formatCurrency(totalValue)}
          change={{ value: `${formatPercent(totalPnlPct)} this month`, positive: totalPnlPct >= 0 }}
          icon={BarChart3} iconColor="#a78bfa" accentColor="rgba(139,92,246,0.5)" glowColor="purple"
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalPnl)}
          subValue="Since inception"
          change={{ value: formatPercent(totalPnlPct), positive: totalPnl >= 0 }}
          icon={TrendingUp} iconColor="#34d399" accentColor="rgba(16,185,129,0.5)" glowColor="green"
        />
        <StatCard
          label="Active AI Signals"
          value={signals.length.toString()}
          subValue={`Mode: ${aiMode}`}
          icon={Zap} iconColor="#fbbf24" accentColor="rgba(245,158,11,0.5)" glowColor="amber"
        />
        <StatCard
          label="Risk Score"
          value={stats.totalTrades > 0 ? (parseFloat(stats.winRate) > 50 ? 'Low' : 'Moderate') : 'N/A'}
          subValue={stats.totalTrades > 0 ? `${stats.totalTrades} trades, ${stats.winRate} win rate` : 'No trades yet'}
          change={{ value: stats.totalTrades > 0 ? `AI accuracy: ${stats.aiAccuracy}` : 'Start trading to see stats', positive: parseFloat(stats.winRate) > 50 }}
          icon={Shield} iconColor="#34d399" accentColor="rgba(16,185,129,0.5)" glowColor="green"
        />
      </motion.div>

      {/* Market Intelligence Gauges */}
      <motion.div variants={ITEM} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fear & Greed</span>
            <Badge variant={fearGreedVariant} size="sm">{fearGreedLabel}</Badge>
          </div>
          <ProgressRing value={fearGreedValue} size={140} color={fearGreedValue > 55 ? '#10b981' : fearGreedValue > 45 ? '#64748b' : '#ef4444'} label={String(fearGreedValue)} sublabel="/ 100" />
          <div className="w-full flex justify-between text-[10px] text-slate-600">
            <span>Fear</span><span>Neutral</span><span>Greed</span><span>Extreme</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Portfolio Volatility</span>
            <Badge variant={volVariant} size="sm">{volLabel}</Badge>
          </div>
          <ProgressRing value={volPct} size={140} color={volValue > 30 ? '#ef4444' : volValue > 15 ? '#f59e0b' : '#10b981'} label={`${volValue.toFixed(1)}%`} sublabel="ann." />
          <p className="text-xs text-slate-500 text-center">{volValue > 30 ? 'High volatility — consider hedging' : volValue > 15 ? 'Moderate volatility — ideal for trend strategies' : 'Low volatility — stable portfolio'}</p>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Confidence</span>
            <Badge variant={aiConfidenceVariant} size="sm">{aiConfidenceLabel}</Badge>
          </div>
          <ProgressRing value={aiConfidenceValue} size={140} color={aiConfidenceValue > 70 ? '#8b5cf6' : '#3b82f6'} label={`${aiConfidenceValue}%`} sublabel="avg" />
          <p className="text-xs text-slate-500 text-center">Average confidence across {signals.length} active signals</p>
        </div>
      </motion.div>

      {/* Split Snapshot & News Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Market Snapshot */}
        <motion.div variants={ITEM} className="lg:col-span-2 glass-card rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="font-display font-bold text-white flex items-center gap-2 text-sm">
                <Activity size={15} className="text-purple-400" />
                Live Market Snapshot
              </h2>
              <button className="text-slate-500 hover:text-white transition-colors"><RefreshCw size={12} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left text-[10px]">Asset</th>
                    <th className="text-right text-[10px]">Price</th>
                    <th className="text-right text-[10px]">24h Change</th>
                    <th className="text-right text-[10px] hidden md:table-cell">Volume</th>
                    <th className="text-right text-[10px] hidden lg:table-cell">7D Chart</th>
                  </tr>
                </thead>
                <tbody>
                  {topTickers.map((ticker) => (
                    <tr key={ticker.symbol}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/15 flex items-center justify-center text-[10px] font-bold text-purple-300">
                            {ticker.symbol.replace('/USD', '').slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 text-sm">{ticker.symbol}</div>
                            <div className="text-[10px] text-slate-500">{ticker.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right font-mono font-semibold text-slate-200">
                        {ticker.type === 'forex' ? ticker.price.toFixed(4) : ticker.price.toLocaleString()}
                      </td>
                      <td className="text-right">
                        <span className={cn(
                          'text-xs font-bold flex items-center justify-end gap-1',
                          ticker.changePct24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {ticker.changePct24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(ticker.changePct24h).toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right text-slate-500 text-xs hidden md:table-cell">
                        {new Intl.NumberFormat('en', { notation: 'compact' }).format(ticker.volume24h)}
                      </td>
                      <td className="hidden lg:table-cell" style={{ width: 100 }}>
                        <MiniSparkline
                          data={ticker.symbol.startsWith('ETH') ? ethData : btcData}
                          color={ticker.changePct24h >= 0 ? '#10b981' : '#ef4444'}
                          height={36}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Real-time Sentiment & News Widget */}
        <motion.div variants={ITEM} className="glass-panel rounded-2xl border border-white/5 p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
              <h2 className="font-display font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                <Newspaper size={14} className="text-purple-400" />
                Latest News & Sentiment
              </h2>
              <Link href="/news" className="text-[10px] text-purple-400 hover:text-purple-300 font-bold hover:underline cursor-pointer">
                View All
              </Link>
            </div>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {newsLoading ? (
                <div className="py-12 text-center text-[11px] text-slate-500 font-bold">Syncing market news...</div>
              ) : dashboardNews.length === 0 ? (
                <div className="py-12 text-center text-[11px] text-slate-500">No news digests available.</div>
              ) : (
                dashboardNews.map((n) => (
                  <a 
                    key={n.id}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group space-y-1 pb-3 border-b border-white/5 last:border-0 last:pb-0 text-left cursor-pointer"
                  >
                    <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase">
                      <span>{n.source}</span>
                      <span>{new Date(n.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h5 className="font-bold text-[11px] text-slate-300 group-hover:text-purple-300 transition-colors line-clamp-2 leading-snug">
                      {n.headline}
                    </h5>
                  </a>
                ))
              )}
            </div>
          </div>
        </motion.div>

      </div>

      {/* AI Signals */}
      <motion.div variants={ITEM} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-white flex items-center gap-2 text-xl">
            <Zap size={18} className="text-purple-400" />
            Top AI Opportunities Today
          </h2>
          <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
            {(['all', 'crypto', 'stocks', 'forex'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-lg capitalize font-semibold transition-all',
                  activeTab === tab ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredSignals.map((sig) => (
            <div key={sig.id} className="glass-card rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display font-bold text-white">{sig.symbol}</span>
                    <Badge variant={sig.direction === 'BUY' ? 'buy' : 'sell'} size="xs">{sig.direction}</Badge>
                  </div>
                  <span className="text-[10px] text-slate-500">{sig.strategy}</span>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-purple-400 text-lg">{sig.confidence}%</div>
                  <div className="text-[9px] text-slate-500">Confidence</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-y border-white/5 py-3">
                <div><span className="block text-[9px] uppercase text-slate-600 mb-0.5">Entry</span><span className="font-bold text-slate-200">${sig.entry}</span></div>
                <div><span className="block text-[9px] uppercase text-slate-600 mb-0.5">Stop</span><span className="font-bold text-red-400">${sig.stopLoss}</span></div>
                <div><span className="block text-[9px] uppercase text-slate-600 mb-0.5">TP1</span><span className="font-bold text-emerald-400">${sig.tp1}</span></div>
                <div><span className="block text-[9px] uppercase text-slate-600 mb-0.5">R:R</span><span className="font-bold text-purple-300">{sig.riskReward}</span></div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Win Probability</span><span className="text-slate-300 font-semibold">{sig.probability}</span>
                </div>
                <div className="progress-track h-1.5">
                  <div className="progress-fill-purple h-full" style={{ width: sig.probability }} />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
                  className="flex-1 btn-ghost py-2 rounded-xl text-xs font-semibold"
                >
                  {expanded === sig.id ? 'Less' : 'Analysis'}
                </button>
                <button onClick={() => openTrade(sig.symbol, sig.direction as any)} className="flex-1 btn-primary py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <Zap size={12} /> Execute
                </button>
              </div>

              <AnimatePresence>
                {expanded === sig.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-2 text-xs overflow-hidden"
                  >
                    {[
                      { label: '📈 Technicals', items: sig.technicals, color: 'text-emerald-400' },
                      { label: '📊 Fundamentals', items: sig.fundamentals, color: 'text-purple-400' },
                      { label: '💬 Sentiment', items: sig.sentiment, color: 'text-blue-400' },
                    ].map(({ label, items, color }) => (
                      <div key={label}>
                        <div className={cn('text-[9px] font-bold uppercase tracking-wider mb-1', color)}>{label}</div>
                        <ul className="list-disc pl-3 space-y-0.5 text-slate-400">
                          {items.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      <QuickTradeWidget
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        defaultSymbol={tradeSymbol}
        defaultDirection={tradeDirection}
      />
    </motion.div>
  );
}
