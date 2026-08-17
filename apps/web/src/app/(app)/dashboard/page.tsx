'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BrainCircuit, Activity, TrendingUp, TrendingDown, Zap, Shield,
  BarChart3, RefreshCw, Newspaper, HelpCircle, Award, CheckCircle2,
  Clock, ArrowRight, GraduationCap, Flame, Sparkles, BookOpen
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
import { QuizModal } from '@/components/academy/QuizModal';
import { SignalPositionTool } from '@/components/charts/SignalPositionTool';
import { apiFetch } from '@/lib/api';

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

  // Quiz Modal & Stats State
  const [quizStats, setQuizStats] = useState<any>({
    totalQuizzes: 0,
    passedCount: 0,
    passRate: 0,
    totalXp: 0,
    skillsMastery: { "Market Structure": 80, "Technical Analysis": 85, "Risk Management": 90 },
    recentAttempts: []
  });
  const [featuredQuiz, setFeaturedQuiz] = useState<any>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const openTrade = (symbol: string, direction: 'BUY' | 'SELL') => {
    setTradeSymbol(symbol);
    setTradeDirection(direction);
    setIsTradeOpen(true);
  };

  // Fetch real portfolio stats
  const [stats, setStats] = useState<any>({ totalTrades: 0, winRate: '0.0%', aiAccuracy: '0.0%', avgConfidence: '0%', portfolioVolatility: '0.0' });
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
      const newsData = await apiFetch<any[]>('/api/v2/markets/news');
      if (Array.isArray(newsData)) {
        setDashboardNews(newsData.slice(0, 5));
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch news:', err);
    } finally {
      setNewsLoading(false);
    }

    // Fetch Academy Quiz Stats & Featured Quiz
    try {
      const [qStats, qList] = await Promise.allSettled([
        apiFetch<any>('/api/v2/academy/quizzes/stats'),
        apiFetch<any[]>('/api/v2/academy/quizzes')
      ]);

      if (qStats.status === 'fulfilled' && qStats.value) {
        setQuizStats(qStats.value);
      }

      if (qList.status === 'fulfilled' && Array.isArray(qList.value) && qList.value.length > 0) {
        // Pick first unpassed quiz or flagship quiz
        const unpassed = qList.value.find((q: any) => !q.userAttempt?.passed);
        setFeaturedQuiz(unpassed || qList.value[0]);
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to load quiz metrics:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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

  const handleLaunchQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setIsQuizModalOpen(true);
  };

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

      {/* Academy Quizzes & Knowledge Mastery Widget on Dashboard */}
      <motion.div variants={ITEM} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Featured Quiz & Active Assessment Challenge */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/10 p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-indigo-950/30 shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <HelpCircle size={16} />
                </span>
                <span className="font-display font-bold text-white text-xs uppercase tracking-wider">
                  Academy Knowledge Check & Strict Assessments
                </span>
              </div>
              <Link
                href="/academy"
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                All Quizzes <ArrowRight size={13} />
              </Link>
            </div>

            {featuredQuiz ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="purple" size="xs">{featuredQuiz.difficulty || 'INTERMEDIATE'}</Badge>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Strict Pass Mark: {featuredQuiz.passMarkPct || 75}%
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock size={11} className="text-purple-400" /> {featuredQuiz.timeLimitMinutes || 15} Mins
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Award size={11} /> +{featuredQuiz.xpReward || 150} XP
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white leading-snug">{featuredQuiz.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mt-1">{featuredQuiz.description}</p>
                </div>

                {featuredQuiz.skillTags && featuredQuiz.skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {featuredQuiz.skillTags.map((t: string) => (
                      <span key={t} className="text-[9px] bg-white/5 text-purple-300 px-2 py-0.5 rounded-md border border-white/5">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Sharpen your trading edge with institutional quizzes and SMC assessments.
              </div>
            )}
          </div>

          <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5 mt-4">
            <div className="flex items-center gap-4 text-xs text-slate-400 w-full sm:w-auto">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Questions</span>
                <span className="font-bold text-white">{featuredQuiz?.questionCount || 5} Questions</span>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Status</span>
                <span className={cn("font-bold text-[11px]", featuredQuiz?.userAttempt?.passed ? "text-emerald-400" : "text-amber-400")}>
                  {featuredQuiz?.userAttempt?.passed ? `Passed (${featuredQuiz.userAttempt.score}%)` : 'Ready to Test'}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleLaunchQuiz(featuredQuiz?.id)}
              disabled={!featuredQuiz}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Zap size={13} />
              {featuredQuiz?.userAttempt?.passed ? 'Retake Strict Quiz' : 'Launch Assessment'}
            </button>
          </div>
        </div>

        {/* Right Col: Learner Mastery & Radar Stats */}
        <div className="glass-panel rounded-2xl border border-white/10 p-5 flex flex-col justify-between gap-4 bg-slate-950/60">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Award size={14} className="text-purple-400" />
                Competency & XP
              </h3>
              <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                <Flame size={12} className="text-amber-400" /> {quizStats.totalXp} XP
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Quizzes Passed</span>
                <span className="text-sm font-bold text-emerald-400">{quizStats.passedCount} / {quizStats.totalQuizzes}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Strict Pass Rate</span>
                <span className="text-sm font-bold text-purple-300">{quizStats.passRate}%</span>
              </div>
            </div>

            {/* Skill Bars */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Domain Mastery</span>
              {Object.entries(quizStats.skillsMastery || {}).slice(0, 3).map(([skill, pct]: [string, any]) => (
                <div key={skill} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">{skill}</span>
                    <span className="text-slate-200 font-bold">{pct}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/academy"
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-[11px] text-center border border-white/5 transition-all flex items-center justify-center gap-1"
          >
            <BookOpen size={12} /> Open Full LMS Academy
          </Link>
        </div>
      </motion.div>

      {/* Market Intelligence Gauges */}
      <motion.div variants={ITEM} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fear & Greed Index</span>
            <Badge variant={fearGreedVariant} size="xs">{fearGreedLabel}</Badge>
          </div>
          <ProgressRing value={fearGreedValue} color="#a78bfa" size={130} strokeWidth={10}>
            <div className="text-center">
              <div className="font-display font-bold text-white text-2xl">{fearGreedValue}</div>
              <div className="text-[10px] text-slate-500">Live RSI Base</div>
            </div>
          </ProgressRing>
          <span className="text-[11px] text-slate-500 text-center">Multi-asset composite sentiment</span>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Confidence Index</span>
            <Badge variant={aiConfidenceVariant} size="xs">{aiConfidenceLabel}</Badge>
          </div>
          <ProgressRing value={aiConfidenceValue} color="#818cf8" size={130} strokeWidth={10}>
            <div className="text-center">
              <div className="font-display font-bold text-white text-2xl">{stats.avgConfidence}</div>
              <div className="text-[10px] text-slate-500">Signal Model</div>
            </div>
          </ProgressRing>
          <span className="text-[11px] text-slate-500 text-center">Neural convergence weight</span>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="flex w-full justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Portfolio Volatility</span>
            <Badge variant={volVariant} size="xs">{volLabel}</Badge>
          </div>
          <ProgressRing value={volPct} color="#34d399" size={130} strokeWidth={10}>
            <div className="text-center">
              <div className="font-display font-bold text-white text-2xl">{stats.portfolioVolatility}</div>
              <div className="text-[10px] text-slate-500">Historical Beta</div>
            </div>
          </ProgressRing>
          <span className="text-[11px] text-slate-500 text-center">Calculated across open orders</span>
        </div>
      </motion.div>

      {/* Market Watchlist & News Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Watchlist */}
        <motion.div variants={ITEM} className="xl:col-span-2">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-white flex items-center gap-2 text-base">
                <Activity size={16} className="text-purple-400" />
                Live Market Watchlist
              </h2>
              <button onClick={fetchDashboardData} className="text-slate-500 hover:text-white transition-colors cursor-pointer"><RefreshCw size={12} /></button>
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
                          data={[
                            ticker.price * (1 - (ticker.changePct24h * 0.008)),
                            ticker.price * (1 - (ticker.changePct24h * 0.005)),
                            ticker.price * (1 - (ticker.changePct24h * 0.003)),
                            ticker.price * (1 - (ticker.changePct24h * 0.001)),
                            ticker.price
                          ]}
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
                  'px-3 py-1.5 rounded-lg capitalize font-semibold transition-all cursor-pointer',
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
                  className="flex-1 btn-ghost py-2 rounded-xl text-xs font-semibold cursor-pointer"
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
                    className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-3 text-xs overflow-hidden"
                  >
                    {/* TradingView Long / Short Position Tool */}
                    {sig.direction !== 'WAIT' && (
                      <SignalPositionTool
                        symbol={sig.symbol}
                        direction={sig.direction}
                        entryPrice={sig.entry}
                        stopLoss={sig.stopLoss}
                        takeProfit={sig.tp1}
                        accountSize={10000}
                        riskPercent={1.0}
                      />
                    )}

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
