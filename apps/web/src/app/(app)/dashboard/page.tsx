'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  BrainCircuit,
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  BarChart3,
  RefreshCw,
  Newspaper,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Sparkles,
  BookOpen,
  FileText,
  FileCheck2,
  Video,
  Layers,
  ExternalLink,
  Cpu,
  Coins,
  ChevronRight,
} from 'lucide-react';
import { useAIStore } from '@/store/useAIStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useMarketStore } from '@/store/useMarketStore';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';
import { QuizModal } from '@/components/academy/QuizModal';
import { apiFetch, mapSignal } from '@/lib/api';

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

function getLiveKillzoneStatus() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const timeStr = `${String(utcHour).padStart(2, '0')}:${String(utcMin).padStart(2, '0')} UTC`;

  if (utcHour >= 12 && utcHour < 16) {
    return {
      session: 'NY AM / London-NY Overlap Killzone',
      window: '12:00 – 16:00 UTC',
      quality: 'PEAK A+ EXECUTION WINDOW',
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      dotColor: 'bg-emerald-400 animate-ping',
      utcTime: timeStr,
    };
  }
  if (utcHour >= 7 && utcHour < 11) {
    return {
      session: 'London Open Killzone',
      window: '07:00 – 11:00 UTC',
      quality: 'HIGH-PROBABILITY SWEEP & BOS WINDOW',
      badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      dotColor: 'bg-teal-400 animate-ping',
      utcTime: timeStr,
    };
  }
  if (utcHour >= 0 && utcHour < 6) {
    return {
      session: 'Asian Liquidity Range Building',
      window: '00:00 – 06:00 UTC',
      quality: 'MAPPING ASIAN HIGH/LOW LIQUIDITY POOLS',
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dotColor: 'bg-amber-400',
      utcTime: timeStr,
    };
  }
  return {
    session: 'Inter-Session Transition',
    window: 'Waiting for next institutional killzone',
    quality: 'STRICT MTF CONFLUENCE FILTER ACTIVE',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    dotColor: 'bg-slate-400',
    utcTime: timeStr,
  };
}

export default function DashboardPage() {
  const { signals, autonomousActive, aiMode, setSignals } = useAIStore();
  const { totalValue, totalPnl, totalPnlPct } = usePortfolioStore();
  const { tickers } = useMarketStore();
  const [activeTab, setActiveTab] = useState<'all' | 'crypto' | 'stocks' | 'forex'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState('BTC');
  const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');

  // Academy State (Unified single source)
  const [quizStats, setQuizStats] = useState<any>({
    totalQuizzes: 0,
    passedCount: 0,
    passRate: 0,
    totalXp: 0,
  });
  const [featuredQuiz, setFeaturedQuiz] = useState<any>(null);
  const [latestNotes, setLatestNotes] = useState<any[]>([]);
  const [qotd, setQotd] = useState<any | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const openTrade = (symbol: string, direction: 'BUY' | 'SELL') => {
    setTradeSymbol(symbol);
    setTradeDirection(direction);
    setIsTradeOpen(true);
  };

  // Real portfolio stats
  const [stats, setStats] = useState<any>({
    totalTrades: 0,
    winRate: '0.0%',
    aiAccuracy: '0.0%',
    avgConfidence: '0%',
    portfolioVolatility: '0.0',
  });
  const [dashboardNews, setDashboardNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const statsData = await apiFetch<any>('/api/v2/portfolio/stats');
      if (statsData) setStats(statsData);
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch stats:', err);
    }

    try {
      const rawSignals = await apiFetch<any[]>('/api/v2/signals');
      if (Array.isArray(rawSignals)) {
        setSignals(rawSignals.map(mapSignal));
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch signals:', err);
    }

    try {
      const newsData = await apiFetch<any[]>('/api/v2/markets/news');
      if (Array.isArray(newsData)) {
        setDashboardNews(newsData.slice(0, 5));
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch news:', err);
    } finally {
      setNewsLoading(false);
    }

    // Fetch Academy Highlights
    try {
      const [qStats, qList, notesRes, qotdRes] = await Promise.allSettled([
        apiFetch<any>('/api/v2/academy/quizzes/stats'),
        apiFetch<any[]>('/api/v2/academy/quizzes'),
        apiFetch<any[]>('/api/v2/academy/notes'),
        apiFetch<any>('/api/v2/academy/qotd/today'),
      ]);

      if (qStats.status === 'fulfilled' && qStats.value) {
        setQuizStats(qStats.value);
      }
      if (qList.status === 'fulfilled' && Array.isArray(qList.value) && qList.value.length > 0) {
        const unpassed = qList.value.find((q: any) => !q.userAttempt?.passed);
        setFeaturedQuiz(unpassed || qList.value[0]);
      }
      if (notesRes.status === 'fulfilled' && Array.isArray(notesRes.value)) {
        setLatestNotes(notesRes.value.slice(0, 2));
      }
      if (qotdRes.status === 'fulfilled') {
        setQotd(qotdRes.value || null);
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to load Academy highlights:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const killzone = getLiveKillzoneStatus();

  // Sentiment, confidence, and volatility calculations
  const avgConfidenceNumber =
    signals.length > 0
      ? Math.round(signals.reduce((sum, s) => sum + (s.confidence || 50), 0) / signals.length)
      : 50;
  const fearGreedValue = avgConfidenceNumber;
  const fearGreedLabel =
    fearGreedValue > 70
      ? 'Extreme Greed'
      : fearGreedValue > 55
      ? 'Greed'
      : fearGreedValue > 45
      ? 'Neutral'
      : fearGreedValue > 30
      ? 'Fear'
      : 'Extreme Fear';

  const volValue = parseFloat(stats.portfolioVolatility) || 0;
  const volLabel = volValue > 30 ? 'High' : volValue > 15 ? 'Moderate' : 'Low';

  const filteredSignals = activeTab === 'all' ? signals : signals.filter((s) => s.type === activeTab);
  const topTickers = tickers.slice(0, 6);

  const handleLaunchQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setIsQuizModalOpen(true);
  };

  return (
    <motion.div className="space-y-6" variants={CONTAINER} initial="hidden" animate="show">
      {/* Top Header */}
      <motion.div variants={ITEM}>
        <PageHeader
          title="Institutional Command Center"
          subtitle="Real-time multi-timeframe market analysis, proprietary execution engines, and risk oversight."
          icon={BrainCircuit}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold',
              autonomousActive
                ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300'
                : 'bg-white/5 border border-white/10 text-slate-400'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', autonomousActive ? 'bg-purple-400 animate-ping' : 'bg-slate-600')} />
            {autonomousActive ? 'Autonomous Active' : 'Manual Mode'}
          </div>
          <button
            onClick={() => openTrade('BTC', 'BUY')}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            <Zap size={14} />
            Quick Trade
          </button>
        </PageHeader>
      </motion.div>

      {/* Multi-Engine Selector & Live Session Status Bar */}
      <motion.div
        variants={ITEM}
        className="rounded-2xl p-4 border border-white/10 bg-[#0B0F17] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border flex items-center gap-1.5', killzone.badgeColor)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', killzone.dotColor)} />
              {killzone.session}
            </span>
            <span className="text-[11px] font-mono text-slate-400">{killzone.utcTime}</span>
          </div>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="text-xs text-slate-300 font-medium">
            Status: <span className="text-amber-400 font-semibold">{killzone.quality}</span> ({killzone.window})
          </span>
        </div>

        {/* Engine Quick Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Engines:</span>
          <Link
            href="/dashboard/engines/gold"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition"
          >
            <Coins size={13} className="text-amber-400" />
            <span>MasterGold v3.2</span>
          </Link>
          <Link
            href="/dashboard/engines/nasdaq"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition"
          >
            <Cpu size={13} className="text-purple-400" />
            <span>Am_100 (NQ)</span>
          </Link>
          <Link
            href="/dashboard/engines/btc"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition"
          >
            <Activity size={13} className="text-teal-400" />
            <span>MrCrypto (BTC)</span>
          </Link>
        </div>
      </motion.div>

      {/* Primary KPI Cards */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio Value"
          value={formatCurrency(totalValue)}
          change={{ value: `${formatPercent(totalPnlPct)} this month`, positive: totalPnlPct >= 0 }}
          icon={BarChart3}
          iconColor="#38bdf8"
          accentColor="rgba(56,189,248,0.2)"
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalPnl)}
          subValue="Realized performance"
          change={{ value: formatPercent(totalPnlPct), positive: totalPnl >= 0 }}
          icon={TrendingUp}
          iconColor="#34d399"
          accentColor="rgba(52,211,153,0.2)"
        />
        <StatCard
          label="Active Opportunities"
          value={signals.length.toString()}
          subValue={`Model: ${aiMode}`}
          icon={Zap}
          iconColor="#fbbf24"
          accentColor="rgba(251,191,36,0.2)"
        />
        <StatCard
          label="Win Rate & Risk"
          value={stats?.totalTrades > 0 ? stats.winRate || '0.0%' : 'Ready'}
          subValue={stats?.totalTrades > 0 ? `${stats.totalTrades} closed trades` : 'Scanning live market'}
          change={{
            value: stats?.totalTrades > 0 ? `Model accuracy: ${stats.aiAccuracy || 'Active'}` : 'Institutional guard active',
            positive: parseFloat(stats?.winRate || '0') > 50,
          }}
          icon={Shield}
          iconColor="#a78bfa"
          accentColor="rgba(167,139,250,0.2)"
        />
      </motion.div>

      {/* Sleek Horizontal Market Pulse Bar */}
      <motion.div variants={ITEM} className="rounded-2xl p-4 bg-[#0B0F17] border border-white/10 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Sentiment */}
          <div className="space-y-2 pt-2 md:pt-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">Market Sentiment</span>
              <span className={cn(
                'font-bold font-mono text-[11px] px-2 py-0.5 rounded',
                fearGreedValue > 55 ? 'text-emerald-400 bg-emerald-500/10' : fearGreedValue > 45 ? 'text-slate-300 bg-white/5' : 'text-rose-400 bg-rose-500/10'
              )}>
                {fearGreedLabel} ({fearGreedValue}/100)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${fearGreedValue}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 (Extreme Fear)</span>
              <span>50 (Neutral)</span>
              <span>100 (Extreme Greed)</span>
            </div>
          </div>

          {/* Model Confidence */}
          <div className="space-y-2 pt-4 md:pt-0 md:pl-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">Signal Model Convergence</span>
              <span className="font-bold font-mono text-[11px] px-2 py-0.5 rounded text-amber-400 bg-amber-500/10">
                {stats.avgConfidence || '82%'} Weighted
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: stats.avgConfidence ? `${parseInt(stats.avgConfidence) || 82}%` : '82%' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Threshold: 70%</span>
              <span>Multi-Timeframe Concordance</span>
            </div>
          </div>

          {/* Portfolio Volatility */}
          <div className="space-y-2 pt-4 md:pt-0 md:pl-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-400">Portfolio Volatility</span>
              <span className={cn(
                'font-bold font-mono text-[11px] px-2 py-0.5 rounded',
                volValue > 30 ? 'text-rose-400 bg-rose-500/10' : volValue > 15 ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
              )}>
                {volLabel} ({stats.portfolioVolatility || '12.4'})
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, (volValue || 12) * 2))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>ATR Normalized</span>
              <span>Adaptive Invalidation Buffer</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Trading Workspace: Signals (8 cols) + Watchlist & News (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Top Market Opportunities (8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B0F17] border border-white/10 rounded-2xl p-4">
            <div>
              <h2 className="font-display font-bold text-white flex items-center gap-2 text-base">
                <Zap size={18} className="text-amber-400" />
                Live Institutional Signals
              </h2>
              <p className="text-xs text-slate-400">
                15M confirmed setups adhering to strict 5-Gate risk validation and 1:2.0+ R:R.
              </p>
            </div>

            <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 text-xs self-start sm:self-auto">
              {(['all', 'crypto', 'stocks', 'forex'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1 rounded-lg capitalize font-bold text-xs transition-all cursor-pointer',
                    activeTab === tab ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredSignals.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#0B0F17] p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Clock size={22} />
              </div>
              <h3 className="text-sm font-bold text-white">No Open Signals Under Current Filter</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The engine is monitoring live 15M candle closes. New limit orders and execution candidates will appear once all 5 gates pass.
              </p>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 inline-flex items-center gap-2 transition"
              >
                <RefreshCw size={13} /> Refresh Feed
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 flex flex-col justify-between gap-4 hover:border-amber-500/30 transition shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-display font-black text-white text-base tracking-tight">{sig.symbol}</span>
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded border uppercase',
                            sig.direction === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : sig.direction === 'SELL'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          )}
                        >
                          {sig.orderType ? sig.orderType.replace(/_/g, ' ') : (sig.direction === 'BUY' ? 'BULLISH' : 'BEARISH')}
                        </span>
                        {sig.lifecycleState && (
                          <span className={cn(
                            "text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase",
                            sig.lifecycleState === 'POSITION_OPEN' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            sig.lifecycleState === 'WAITING_FOR_ENTRY' ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
                            "bg-slate-800 text-slate-400 border-slate-700"
                          )}>
                            {sig.lifecycleState.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{sig.strategy || 'SMC_INSTITUTIONAL'}</span>
                    </div>

                    <div className="text-right">
                      <div className="font-display font-extrabold text-amber-400 text-lg leading-none">{sig.confidence}%</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">Confluence</div>
                    </div>
                  </div>

                  {/* 4 Key Institutional Trade Numbers */}
                  <div className="grid grid-cols-4 gap-2 text-xs bg-black/40 border border-white/5 rounded-xl p-3 font-mono">
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500 mb-0.5">Entry</span>
                      <span className="font-bold text-slate-200 truncate block">${sig.entry}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500 mb-0.5">Stop</span>
                      <span className="font-bold text-rose-400 truncate block">${sig.stopLoss}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500 mb-0.5">TP1</span>
                      <span className="font-bold text-emerald-400 truncate block">${sig.tp1}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-slate-500 mb-0.5">R:R</span>
                      <span className="font-bold text-amber-300 truncate block">{sig.riskReward}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Win Probability</span>
                      <span className="text-slate-200 font-mono font-bold">{sig.probability}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                        style={{ width: sig.probability }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
                      className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition border border-white/5 cursor-pointer"
                    >
                      {expanded === sig.id ? 'Hide Details' : 'View Thesis'}
                    </button>
                    <button
                      onClick={() => openTrade(sig.symbol, sig.direction as any)}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <Zap size={13} /> Execute Order
                    </button>
                  </div>

                  <AnimatePresence>
                    {expanded === sig.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-black/50 border border-white/5 rounded-xl p-3.5 space-y-2.5 text-xs overflow-hidden"
                      >
                        {[
                          { label: 'Technicals', items: sig.technicals, color: 'text-emerald-400' },
                          { label: 'Macro & News', items: sig.fundamentals, color: 'text-amber-400' },
                          { label: 'Sentiment & Order Flow', items: sig.sentiment, color: 'text-blue-400' },
                        ].map(({ label, items, color }) => (
                          <div key={label}>
                            <div className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', color)}>
                              {label}
                            </div>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                              {(items || []).map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Watchlist & Real News (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          {/* Live Watchlist */}
          <div className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                <Activity size={14} className="text-amber-400" />
                Live Market Watchlist
              </h3>
              <button
                onClick={fetchDashboardData}
                className="text-slate-400 hover:text-white transition cursor-pointer"
                title="Refresh Tickers"
              >
                <RefreshCw size={12} />
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {topTickers.map((ticker) => (
                <div key={ticker.symbol} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-amber-300 font-mono">
                      {ticker.symbol.replace('/USD', '').slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 text-xs">{ticker.symbol}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[100px]">{ticker.name}</div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-white">
                      {ticker.type === 'forex' ? (ticker.price ?? 0).toFixed(4) : (ticker.price ?? 0).toLocaleString()}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold inline-flex items-center gap-0.5',
                        (ticker.changePct24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {(ticker.changePct24h ?? 0) >= 0 ? '+' : ''}
                      {(ticker.changePct24h ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real News & Sentiment Feed */}
          <div className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-display font-bold text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                <Newspaper size={14} className="text-sky-400" />
                Market Catalyst News
              </h3>
              <Link
                href="/news"
                className="text-[11px] text-sky-400 hover:text-sky-300 font-bold transition flex items-center gap-1"
              >
                All News <ArrowRight size={11} />
              </Link>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {newsLoading ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">Syncing live news...</div>
              ) : dashboardNews.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No active news items.</div>
              ) : (
                dashboardNews.map((n) => (
                  <a
                    key={n.id}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group space-y-1 pb-2.5 border-b border-white/5 last:border-0 last:pb-0 text-left cursor-pointer"
                  >
                    <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase">
                      <span className="font-bold text-slate-400">{n.source}</span>
                      <span>{new Date(n.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h5 className="font-semibold text-xs text-slate-300 group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                      {n.headline}
                    </h5>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Academy & Daily Challenge (Appears ONCE without duplicate blocks) */}
      <motion.div variants={ITEM} className="rounded-2xl bg-[#0B0F17] border border-white/10 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6">
          {/* Question of the Day Focus Banner */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1.5">
                <Flame size={12} className="text-amber-400 fill-amber-400" /> QUESTION OF THE DAY
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-400">+25 XP REWARD</span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white">
                {qotd?.title || 'Daily Market Structure Challenge'}
              </h4>
              <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                {qotd?.questionText || 'Test your understanding of Order Blocks, Liquidity Sweeps, and HTF Concordance.'}
              </p>
            </div>

            <div className="pt-1">
              <Link
                href="/academy"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition shadow-md shadow-amber-500/15"
              >
                <FileCheck2 size={13} /> Answer Today&apos;s Challenge
              </Link>
            </div>
          </div>

          {/* Academy Mastery & Direct Assessment Button */}
          <div className="lg:w-80 lg:border-l lg:border-white/10 lg:pl-6 flex flex-col justify-between gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award size={13} className="text-amber-400" /> Academy Mastery
                </span>
                <span className="text-xs font-mono font-bold text-amber-300">{quizStats.totalXp || 0} XP</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Quizzes Passed</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {quizStats.passedCount || 0} / {quizStats.totalQuizzes || 0}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Pass Rate</div>
                  <div className="text-xs font-bold text-purple-300 mt-0.5">{quizStats.passRate || 0}%</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {featuredQuiz ? (
                <button
                  onClick={() => handleLaunchQuiz(featuredQuiz.id)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Zap size={12} className="text-amber-400" />
                  {featuredQuiz.userAttempt?.passed ? 'Retake Quiz' : 'Timed Quiz'}
                </button>
              ) : null}
              <Link
                href="/academy"
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs text-center transition flex items-center justify-center gap-1"
              >
                <BookOpen size={12} /> Full Academy
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      <QuickTradeWidget
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        defaultSymbol={tradeSymbol}
        defaultDirection={tradeDirection}
      />

      {/* Interactive Strict Timed Quiz Modal */}
      <QuizModal
        quizId={selectedQuizId}
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setSelectedQuizId(null);
        }}
        onCompleted={() => {
          fetchDashboardData();
        }}
      />
    </motion.div>
  );
}
