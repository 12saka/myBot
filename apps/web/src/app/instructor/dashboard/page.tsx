'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  Users,
  FileCheck2,
  FileText,
  Video,
  Award,
  Plus,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Flame,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/v2/instructor/dashboard/stats');
      setStats(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load instructor metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-950/90 via-slate-900 to-indigo-950/80 p-6 border border-teal-500/30 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-mono font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>INSTRUCTOR PUBLISHING & GRADING COMMAND CENTER</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white font-outfit">
              Academy Teaching & Market Research Studio
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Every course, lesson study note, market breakdown, homework assignment, quiz, QOTD challenge, and Zoom webinar you publish appears immediately on the student Academy hub and triggers instant notifications.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/instructor/courses"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Course & Lesson Notes</span>
            </Link>
            <Link
              href="/instructor/daily-updates"
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Publish Study Note / QOTD</span>
            </Link>
            <Link
              href="/instructor/assignments"
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Assignments ({stats?.pendingGradingCount || 0} Pending)</span>
            </Link>
            <Link
              href="/academy"
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 text-xs font-bold flex items-center gap-1.5 border border-teal-500/30 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Student Academy</span>
            </Link>
            <button
              onClick={fetchStats}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition cursor-pointer"
              title="Refresh Studio Metrics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-teal-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Courses</span>
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.totalCourses || 0}</span>
            <span className="text-[10px] font-mono text-teal-400">Published</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-teal-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Study Notes</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.totalStudyNotes || 0}</span>
            <span className="text-[10px] font-mono text-cyan-300">
              {stats?.totalLessonsWithNotes || 0} Lesson • {stats?.totalDailyNotes || 0} Briefs
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/25 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Homework Queue</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-300">{stats?.pendingGradingCount || 0}</span>
            <span className="text-[10px] font-mono text-slate-400">
              Pending ({stats?.totalGradedCount || 0} Graded)
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-pink-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Student Q&A</span>
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-pink-300">
              {stats?.unresolvedDiscussionsCount || 0}
            </span>
            <span className="text-[10px] font-mono text-slate-400">Awaiting Reply</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-purple-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Quizzes & Pass</span>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.totalQuizzes || 0}</span>
            <span className="text-[10px] font-mono text-purple-300">{stats?.avgPassRate || 85}% Avg Pass</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 font-semibold uppercase">Enrolled Traders</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {(stats?.totalEnrolledStudents || 0).toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {stats?.upcomingWebinarsCount || 0} Live Zoom
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Homework Submissions Queue + Student Q&A Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Homework Submissions Queue */}
          <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-teal-400" />
                  <span>Student Homework Submissions Queue</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Grade chart markups and award XP rewards. Students receive an instant notification when graded.
                </p>
              </div>
              <Link
                href="/instructor/assignments"
                className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 transition"
              >
                <span>Open Grading Studio</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Assignment & Course</th>
                    <th className="p-3">Submitted</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {!stats?.recentSubmissions || stats.recentSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 font-mono">
                        No assignment submissions yet. Publish a homework assignment to start receiving student work.
                      </td>
                    </tr>
                  ) : (
                    stats.recentSubmissions.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-white/5 transition">
                        <td className="p-3 font-semibold text-white">
                          {sub.user?.profile?.firstName
                            ? `${sub.user.profile.firstName} ${sub.user.profile.lastName || ''}`
                            : sub.user?.email || 'Student'}
                        </td>
                        <td className="p-3 font-medium text-slate-200">
                          {sub.assignment?.title}
                          <span className="block text-[10px] font-mono text-teal-400/80">
                            {sub.assignment?.course?.title}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              sub.status === 'GRADED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            href="/instructor/assignments"
                            className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold transition text-[11px]"
                          >
                            {sub.status === 'GRADED' ? 'Review' : 'Grade Now'}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Community Q&A Threads Queue */}
          <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  <span>Recent Student Q&A Questions</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Questions posted by students on the Academy hub. Official replies notify the student immediately.
                </p>
              </div>
              <Link
                href="/instructor/discussions"
                className="text-xs font-semibold text-pink-300 hover:text-pink-200 flex items-center gap-1 bg-pink-500/10 px-3 py-1.5 rounded-lg border border-pink-500/20 transition"
              >
                <span>Open Q&A Forum</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {!stats?.recentDiscussions || stats.recentDiscussions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  No student Q&A threads posted yet.
                </div>
              ) : (
                stats.recentDiscussions.map((disc: any) => {
                  const hasInstructorReply = disc.replies?.some((r: any) => r.isInstructorReply);
                  const authorName = disc.user?.profile?.firstName
                    ? `${disc.user.profile.firstName} ${disc.user.profile.lastName || ''}`
                    : disc.user?.email || 'Trader';

                  return (
                    <div
                      key={disc.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              disc.isResolved || hasInstructorReply
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {disc.isResolved ? '✓ RESOLVED' : hasInstructorReply ? '✓ ANSWERED' : '⏳ NEEDS ANSWER'}
                          </span>
                          <span className="text-xs font-bold text-white">{disc.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Asked by <strong className="text-slate-200">{authorName}</strong> •{' '}
                          {disc.replies?.length || 0} replies • {new Date(disc.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <Link
                        href="/instructor/discussions"
                        className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition shrink-0 text-center"
                      >
                        Answer Thread
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Publishing Studios & Live Zoom Control */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-teal-500/25 bg-slate-900/60 space-y-3">
            <h3 className="text-sm font-bold text-white font-outfit uppercase tracking-wider text-teal-300">
              Publishing Studios
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Publish directly to the student <code className="text-teal-300">/academy</code> page and broadcast real-time bell notifications:
            </p>
            <div className="space-y-2 text-xs">
              <Link
                href="/instructor/courses"
                className="p-3 rounded-xl bg-white/5 hover:bg-teal-500/15 text-white flex items-center justify-between border border-white/5 hover:border-teal-500/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-teal-400" />
                  <div>
                    <span className="font-bold block">Courses & Lesson Study Notes</span>
                    <span className="text-[10px] text-slate-400">Modules, video links, written notes & takeaways</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>

              <Link
                href="/instructor/daily-updates"
                className="p-3 rounded-xl bg-white/5 hover:bg-amber-500/15 text-white flex items-center justify-between border border-white/5 hover:border-amber-500/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="font-bold block">Study Notes, Breakdowns & QOTD</span>
                    <span className="text-[10px] text-slate-400">Daily market notes, session recaps & +25 XP QOTD</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>

              <Link
                href="/instructor/assignments"
                className="p-3 rounded-xl bg-white/5 hover:bg-indigo-500/15 text-white flex items-center justify-between border border-white/5 hover:border-indigo-500/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="font-bold block">Assignments & Grading Studio</span>
                    <span className="text-[10px] text-slate-400">Deliverable checklists, rubrics & XP grading</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>

              <Link
                href="/instructor/quizzes"
                className="p-3 rounded-xl bg-white/5 hover:bg-purple-500/15 text-white flex items-center justify-between border border-white/5 hover:border-purple-500/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="font-bold block">Quizzes & Certification Bank</span>
                    <span className="text-[10px] text-slate-400">Strict timed assessments & explanations</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>

              <Link
                href="/instructor/discussions"
                className="p-3 rounded-xl bg-white/5 hover:bg-pink-500/15 text-white flex items-center justify-between border border-white/5 hover:border-pink-500/30 transition"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  <div>
                    <span className="font-bold block">Community Q&A Moderation</span>
                    <span className="text-[10px] text-slate-400">Pin threads, post official answers & resolve</span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Link>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-3">
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <Video className="w-4 h-4 text-teal-400" />
              <span>Zoom Live Webinar Studio</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Schedule live trading rooms and masterclasses. Meeting links and passcodes appear in the student Academy sidebar.
            </p>
            <Link
              href="/instructor/webinars"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Zoom Webinar</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
