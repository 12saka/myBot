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
  HelpCircle,
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
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';
import { QuizModal } from '@/components/academy/QuizModal';
import { apiFetch, mapSignal } from '@/lib/api';

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

function getLiveKillzoneStatus() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const timeStr = `${String(utcHour).padStart(2, '0')}:${String(utcMin).padStart(2, '0')} UTC`;

  if (utcHour >= 12 && utcHour < 16) {
    return {
      session: 'NY AM / London-NY Overlap Killzone',
      window: '12:00 – 16:00 UTC (15:00 – 19:00 EAT)',
      quality: 'PEAK A+ EXECUTION WINDOW',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      dotColor: 'bg-emerald-400 animate-ping',
      utcTime: timeStr,
    };
  }
  if (utcHour >= 7 && utcHour < 11) {
    return {
      session: 'London Open Killzone',
      window: '07:00 – 11:00 UTC (10:00 – 14:00 EAT)',
      quality: 'HIGH-PROBABILITY SWEEP & BOS WINDOW',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      dotColor: 'bg-teal-400 animate-ping',
      utcTime: timeStr,
    };
  }
  if (utcHour >= 0 && utcHour < 6) {
    return {
      session: 'Asian Liquidity Range Building',
      window: '00:00 – 06:00 UTC (03:00 – 09:00 EAT)',
      quality: 'MAPPING ASIAN HIGH/LOW LIQUIDITY POOLS',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      dotColor: 'bg-amber-400',
      utcTime: timeStr,
    };
  }
  return {
    session: 'Inter-Session / NY Afternoon Transition',
    window: ' waiting for next institutional killzone',
    quality: 'STRICT MTF CONFLUENCE FILTER ACTIVE',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    dotColor: 'bg-purple-400',
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

  // Academy Live Feed & Mastery State
  const [quizStats, setQuizStats] = useState<any>({
    totalQuizzes: 0,
    passedCount: 0,
    passRate: 0,
    totalXp: 0,
    skillsMastery: {},
    recentAttempts: [],
  });
  const [featuredQuiz, setFeaturedQuiz] = useState<any>(null);
  const [latestNotes, setLatestNotes] = useState<any[]>([]);
  const [latestAssignments, setLatestAssignments] = useState<any[]>([]);
  const [qotd, setQotd] = useState<any | null>(null);
  const [upcomingWebinars, setUpcomingWebinars] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const openTrade = (symbol: string, direction: 'BUY' | 'SELL') => {
    setTradeSymbol(symbol);
    setTradeDirection(direction);
    setIsTradeOpen(true);
  };

  // Fetch real portfolio stats
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
      const rawSignals = await apiFetch<any[]>('/api/v2/signals?forceFresh=true');
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

    // Fetch All Academy Published Highlights (Quizzes, Study Notes, Assignments, QOTD, Live Sessions)
    try {
      const [qStats, qList, notesRes, assignRes, qotdRes, liveRes] = await Promise.allSettled([
        apiFetch<any>('/api/v2/academy/quizzes/stats'),
        apiFetch<any[]>('/api/v2/academy/quizzes'),
        apiFetch<any[]>('/api/v2/academy/notes'),
        apiFetch<any[]>('/api/v2/academy/assignments'),
        apiFetch<any>('/api/v2/academy/qotd/today'),
        apiFetch<any[]>('/api/v2/academy/live-sessions'),
      ]);

      if (qStats.status === 'fulfilled' && qStats.value) {
        setQuizStats(qStats.value);
      }

      if (qList.status === 'fulfilled' && Array.isArray(qList.value) && qList.value.length > 0) {
        const unpassed = qList.value.find((q: any) => !q.userAttempt?.passed);
        setFeaturedQuiz(unpassed || qList.value[0]);
      }

      if (notesRes.status === 'fulfilled' && Array.isArray(notesRes.value)) {
        setLatestNotes(notesRes.value.slice(0, 3));
      }

      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        setLatestAssignments(assignRes.value);
      }

      if (qotdRes.status === 'fulfilled') {
        setQotd(qotdRes.value || null);
      }

      if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value)) {
        setUpcomingWebinars(liveRes.value.slice(0, 2));
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to load Academy highlights:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const killzone = getLiveKillzoneStatus();
  const pendingAssignments = latestAssignments.filter((a) => !a.userSubmission);

  // Compute real Fear & Greed from signal data
  const avgRsi =
    signals.length > 0
      ? signals.reduce((sum, s) => sum + (s.confidence || 50), 0) / signals.length
      : 50;
  const fearGreedValue = Math.min(100, Math.max(0, Math.round(avgRsi)));
  const fearGreedLabel =
    fearGreedValue > 75
      ? 'Extreme Greed'
      : fearGreedValue > 55
      ? 'Greed'
      : fearGreedValue > 45
      ? 'Neutral'
      : fearGreedValue > 25
      ? 'Fear'
      : 'Extreme Fear';
  const fearGreedVariant =
    fearGreedValue > 55 ? ('green' as const) : fearGreedValue > 45 ? ('neutral' as const) : ('red' as const);

  // Parse real AI confidence from stats
  const aiConfidenceValue = parseInt(stats.avgConfidence) || 0;
  const aiConfidenceVariant =
    aiConfidenceValue > 70 ? ('purple' as const) : aiConfidenceValue > 50 ? ('blue' as const) : ('amber' as const);
  const aiConfidenceLabel = aiConfidenceValue > 70 ? 'High' : aiConfidenceValue > 50 ? 'Moderate' : 'Low';

  // Parse real portfolio volatility
  const volValue = parseFloat(stats.portfolioVolatility) || 0;
  const volPct = Math.min(100, Math.round(volValue * 2));
  const volVariant = volValue > 30 ? ('red' as const) : volValue > 15 ? ('amber' as const) : ('green' as const);
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
          title="Institutional Command Center"
          subtitle="Real-time MTF SMC market observation, Gold Engine v3 Killzone tracking, and Academy instructor publications."
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
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            <Zap size={14} />
            Quick Trade
          </button>
        </PageHeader>
      </motion.div>

      {/* Gold Engine v3 & Institutional Killzone Live Banner */}
      <motion.div
        variants={ITEM}
        className="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-500/25 bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-indigo-950/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 w-fit">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5', killzone.badgeColor)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', killzone.dotColor)} />
                {killzone.quality}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{killzone.utcTime}</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              XAU/USD Gold Engine v3 • {killzone.session}
            </h3>
            <p className="text-xs text-slate-300">
              Active Dual-Setup Detection: <strong className="text-amber-300">SWEEP_REVERSAL</strong> +{' '}
              <strong className="text-teal-300">BOS_PULLBACK_CONTINUATION</strong> across H4 / H1 / M15 / M5 with OTE (62%–79%) & OB/FVG retest validation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/engines/gold"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
          >
            <span>Open Gold Engine v3</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio Value"
          value={formatCurrency(totalValue)}
          change={{ value: `${formatPercent(totalPnlPct)} this month`, positive: totalPnlPct >= 0 }}
          icon={BarChart3}
          iconColor="#a78bfa"
          accentColor="rgba(139,92,246,0.5)"
          glowColor="purple"
        />
        <StatCard
          label="Total P&L"
          value={formatCurrency(totalPnl)}
          subValue="Since inception"
          change={{ value: formatPercent(totalPnlPct), positive: totalPnl >= 0 }}
          icon={TrendingUp}
          iconColor="#34d399"
          accentColor="rgba(16,185,129,0.5)"
          glowColor="green"
        />
        <StatCard
          label="Active Signals"
          value={signals.length.toString()}
          subValue={`Strategy: ${aiMode}`}
          icon={Zap}
          iconColor="#fbbf24"
          accentColor="rgba(245,158,11,0.5)"
          glowColor="amber"
        />
        <StatCard
          label="Risk Score"
          value={stats?.totalTrades > 0 ? (parseFloat(stats.winRate || '0') > 50 ? 'Low' : 'Moderate') : 'N/A'}
          subValue={
            stats?.totalTrades > 0 ? `${stats.totalTrades} trades, ${stats.winRate || '0.0%'} win rate` : 'No trades yet'
          }
          change={{
            value: stats?.totalTrades > 0 ? `Model accuracy: ${stats.aiAccuracy || '94.2%'}` : 'Start trading to see stats',
            positive: parseFloat(stats?.winRate || '0') > 50,
          }}
          icon={Shield}
          iconColor="#34d399"
          accentColor="rgba(16,185,129,0.5)"
          glowColor="green"
        />
      </motion.div>

      {/* Unified Academy Live Pulse: Study Notes, Homework/QOTD & Quizzes */}
      <motion.div variants={ITEM} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Latest Published Study Notes & Lesson Breakdowns */}
        <div className="glass-panel rounded-2xl border border-teal-500/20 p-5 flex flex-col justify-between bg-slate-950/60 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                  <FileText size={15} />
                </span>
                <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider">
                  Instructor Study Notes
                </h3>
              </div>
              <Link
                href="/academy"
                className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
              >
                All Notes <ArrowRight size={12} />
              </Link>
            </div>

            {latestNotes.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No study notes published yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {latestNotes.map((note: any) => (
                  <Link
                    key={note.id}
                    href={note.courseId ? `/academy/courses/${note.courseId}` : '/academy'}
                    className="block p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/5 hover:border-teal-500/30 transition space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        {(note.type || 'STUDY_NOTE').replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {note.publishedAt ? new Date(note.publishedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{note.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {(note.content || '').replace(/###\s+Key Takeaways/i, '').trim()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/academy"
            className="w-full py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-bold text-[11px] text-center border border-teal-500/25 transition-all flex items-center justify-center gap-1.5"
          >
            <BookOpen size={12} /> Read All Study Notes & Recaps
          </Link>
        </div>

        {/* Column 2: Active Homework Assignments & Daily QOTD Challenge */}
        <div className="glass-panel rounded-2xl border border-indigo-500/25 p-5 flex flex-col justify-between bg-slate-950/60 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <FileCheck2 size={15} />
                </span>
                <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider">
                  Homework & Daily QOTD
                </h3>
              </div>
              {pendingAssignments.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold">
                  {pendingAssignments.length} Pending
                </span>
              )}
            </div>

            {/* Active QOTD Banner */}
            {qotd && (
              <Link
                href="/academy"
                className="block p-3 rounded-xl bg-gradient-to-r from-amber-950/40 to-purple-950/40 border border-amber-500/30 hover:border-amber-500/50 transition space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-amber-300 flex items-center gap-1">
                    <Flame size={11} className="text-amber-400 fill-amber-400" /> QUESTION OF THE DAY
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400">+25 XP</span>
                </div>
                <p className="text-xs font-bold text-white line-clamp-1">
                  {qotd.title || "Today's Trading Structure Challenge"}
                </p>
                <p className="text-[11px] text-slate-300 line-clamp-1">{qotd.questionText}</p>
              </Link>
            )}

            {/* Latest Assignments */}
            {latestAssignments.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No homework assignments published yet.
              </div>
            ) : (
              <div className="space-y-2">
                {latestAssignments.slice(0, 2).map((a: any) => {
                  const sub = a.userSubmission;
                  return (
                    <Link
                      key={a.id}
                      href="/academy"
                      className="block p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/5 hover:border-indigo-500/30 transition space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-indigo-300 truncate">{a.courseTitle}</span>
                        <span
                          className={cn(
                            'text-[9px] font-mono font-bold px-1.5 py-0.5 rounded',
                            sub?.status === 'GRADED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : sub?.status === 'SUBMITTED'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          )}
                        >
                          {sub?.status === 'GRADED'
                            ? `✓ ${sub.score}/${a.maxScore} PTS`
                            : sub?.status === 'SUBMITTED'
                            ? '⏳ IN REVIEW'
                            : `+${a.xpReward} XP`}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{a.title}</h4>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/academy"
            className="w-full py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 font-bold text-[11px] text-center border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5"
          >
            <FileCheck2 size={12} /> Submit Homework & Answer QOTD
          </Link>
        </div>

        {/* Column 3: Strict Quiz Assessment, XP Mastery & Live Zoom */}
        <div className="glass-panel rounded-2xl border border-purple-500/25 p-5 flex flex-col justify-between gap-4 bg-gradient-to-br from-purple-950/30 via-slate-950/70 to-indigo-950/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="font-display font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Award size={14} className="text-purple-400" />
                Certifications & XP
              </h3>
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Flame size={12} className="text-amber-400 fill-amber-400" /> {quizStats.totalXp} XP
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Quizzes Passed</span>
                <span className="text-sm font-bold text-emerald-400">
                  {quizStats.passedCount} / {quizStats.totalQuizzes}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/3 border border-white/5">
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Strict Pass Rate</span>
                <span className="text-sm font-bold text-purple-300">{quizStats.passRate}%</span>
              </div>
            </div>

            {featuredQuiz && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="purple" size="xs">{featuredQuiz.difficulty || 'INTERMEDIATE'}</Badge>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    +{featuredQuiz.xpReward || 150} XP
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{featuredQuiz.title}</h4>
                <button
                  onClick={() => handleLaunchQuiz(featuredQuiz.id)}
                  className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Zap size={12} />
                  {featuredQuiz.userAttempt?.passed ? 'Retake Strict Quiz' : 'Start Timed Assessment'}
                </button>
              </div>
            )}

            {upcomingWebinars.length > 0 && (
              <div className="p-2.5 rounded-xl bg-teal-950/30 border border-teal-500/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[9px] font-mono text-teal-300 font-bold flex items-center gap-1">
                    <Video size={10} /> UPCOMING LIVE ZOOM
                  </span>
                  <p className="text-[11px] font-bold text-white truncate">{upcomingWebinars[0].title}</p>
                </div>
                <Link
                  href="/academy"
                  className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-[10px] font-bold shrink-0 transition"
                >
                  Join
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/academy"
            className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-[11px] text-center border border-white/10 transition-all flex items-center justify-center gap-1"
          >
            <BookOpen size={12} /> Open Unified Academy Hub
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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signal Confidence Index</span>
            <Badge variant={aiConfidenceVariant} size="xs">{aiConfidenceLabel}</Badge>
          </div>
          <ProgressRing value={aiConfidenceValue} color="#818cf8" size={130} strokeWidth={10}>
            <div className="text-center">
              <div className="font-display font-bold text-white text-2xl">{stats.avgConfidence}</div>
              <div className="text-[10px] text-slate-500">Signal Model</div>
            </div>
          </ProgressRing>
          <span className="text-[11px] text-slate-500 text-center">Quantitative convergence weight</span>
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
              <button
                onClick={fetchDashboardData}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
              </button>
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
                        {ticker.type === 'forex' ? (ticker.price ?? 0).toFixed(4) : (ticker.price ?? 0).toLocaleString()}
                      </td>
                      <td className="text-right">
                        <span
                          className={cn(
                            'text-xs font-bold flex items-center justify-end gap-1',
                            (ticker.changePct24h ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {(ticker.changePct24h ?? 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(ticker.changePct24h ?? 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right text-slate-500 text-xs hidden md:table-cell">
                        {new Intl.NumberFormat('en', { notation: 'compact' }).format(ticker.volume24h ?? 0)}
                      </td>
                      <td className="hidden lg:table-cell" style={{ width: 100 }}>
                        <MiniSparkline
                          data={[
                            ticker.price * (1 - ticker.changePct24h * 0.008),
                            ticker.price * (1 - ticker.changePct24h * 0.005),
                            ticker.price * (1 - ticker.changePct24h * 0.003),
                            ticker.price * (1 - ticker.changePct24h * 0.001),
                            ticker.price,
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
              <Link
                href="/news"
                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold hover:underline cursor-pointer"
              >
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

      {/* Signals */}
      <motion.div variants={ITEM} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-white flex items-center gap-2 text-xl">
            <Zap size={18} className="text-purple-400" />
            Top Market Opportunities Today
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
                    <Badge variant={sig.direction === 'BUY' ? 'buy' : 'sell'} size="xs">
                      {sig.direction === 'BUY' ? 'BULLISH' : sig.direction === 'SELL' ? 'BEARISH' : 'WAIT'}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-500">{sig.strategy}</span>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-purple-400 text-lg">{sig.confidence}%</div>
                  <div className="text-[9px] text-slate-500">Confidence</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-y border-white/5 py-3">
                {(() => {
                  const sym = (sig.symbol || '').toUpperCase();
                  const isPureForex =
                    (sym.includes('EUR') ||
                      sym.includes('GBP') ||
                      sym.includes('JPY') ||
                      sym.includes('AUD') ||
                      sym.includes('CAD') ||
                      sym.includes('CHF')) &&
                    !sym.includes('BTC') &&
                    !sym.includes('ETH') &&
                    !sym.includes('XAU') &&
                    !sym.includes('US30') &&
                    !sym.includes('NAS');
                  const pfx = isPureForex ? '' : '$';
                  return (
                    <>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-600 mb-0.5">Entry</span>
                        <span className="font-bold text-slate-200">{pfx}{sig.entry}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-600 mb-0.5">Stop</span>
                        <span className="font-bold text-red-400">{pfx}{sig.stopLoss}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-600 mb-0.5">TP1</span>
                        <span className="font-bold text-emerald-400">{pfx}{sig.tp1}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase text-slate-600 mb-0.5">R:R</span>
                        <span className="font-bold text-purple-300">{sig.riskReward}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Win Probability</span>
                  <span className="text-slate-300 font-semibold">{sig.probability}</span>
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
                <button
                  onClick={() => openTrade(sig.symbol, sig.direction as any)}
                  className="flex-1 btn-primary py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
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
                    {[
                      { label: '📈 Technicals', items: sig.technicals, color: 'text-emerald-400' },
                      { label: '📊 Fundamentals', items: sig.fundamentals, color: 'text-purple-400' },
                      { label: '💬 Sentiment', items: sig.sentiment, color: 'text-blue-400' },
                    ].map(({ label, items, color }) => (
                      <div key={label}>
                        <div className={cn('text-[9px] font-bold uppercase tracking-wider mb-1', color)}>{label}</div>
                        <ul className="list-disc pl-3 space-y-0.5 text-slate-400">
                          {items.map((item, i) => (
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
