'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  Users,
  FileCheck2,
  Video,
  Award,
  Plus,
  ArrowUpRight,
  Clock,
  Sparkles,
  CheckCircle2,
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-950/80 via-slate-900 to-indigo-950/60 p-6 border border-teal-500/30 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-mono font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>INSTRUCTOR COMMAND CENTER</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white font-outfit">Academy Teaching Studio</h2>
            <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
              Manage curriculum, publish homework assignments, review student submissions, and host live Zoom webinars.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/instructor/courses"
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Course</span>
            </Link>
            <Link
              href="/instructor/assignments"
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Grading Queue ({stats?.pendingGradingCount || 0})</span>
            </Link>
            <Link
              href="/instructor/webinars"
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
            >
              <Video className="w-4 h-4 text-teal-400" />
              <span>Schedule Zoom</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">My Courses</span>
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.totalCourses || 0}</span>
            <span className="text-[10px] font-mono text-teal-400">Active Curriculum</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">Pending Homework</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-300">{stats?.pendingGradingCount || 0}</span>
            <span className="text-[10px] font-mono text-slate-400">Needs Review</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">Live Zoom Classes</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{stats?.upcomingWebinarsCount || 0}</span>
            <span className="text-[10px] font-mono text-indigo-400">Scheduled Webinars</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 font-semibold uppercase">Enrolled Students</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{(stats?.totalEnrolledStudents || 0).toLocaleString()}</span>
            <span className="text-[10px] font-mono text-emerald-400">Active Traders</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Submissions Queue */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-outfit">Student Homework Submissions Queue</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Recent assignment submissions waiting for score & feedback.</p>
            </div>
            <Link
              href="/instructor/assignments"
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 transition"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
                <tr>
                  <th className="p-3">Student</th>
                  <th className="p-3">Assignment</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {!stats?.recentSubmissions || stats.recentSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500 font-mono">
                      No pending assignment submissions right now.
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
                        <span className="block text-[10px] font-mono text-teal-400/80">{sub.assignment?.course?.title}</span>
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
                          Grade Now
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Instructor Navigation & Zoom Banner */}
        <div className="space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-3">
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <Video className="w-4 h-4 text-teal-400" />
              <span>Zoom Live Webinar Studio</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Schedule interactive Zoom live streams, masterclasses, and Q&A sessions for enrolled academy students.
            </p>
            <Link
              href="/instructor/webinars"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Zoom Webinar</span>
            </Link>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-3">
            <h3 className="text-sm font-bold text-white font-outfit">Instructor Actions</h3>
            <div className="space-y-2 text-xs">
              <Link
                href="/instructor/courses"
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-between border border-white/5 transition"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-teal-400" />
                  <span>Manage Courses & Lessons</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link
                href="/instructor/assignments"
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-between border border-white/5 transition"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-indigo-400" />
                  <span>Homework & Submissions</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link
                href="/instructor/quizzes"
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-between border border-white/5 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-purple-400" />
                  <span>Quizzes & Question Bank</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
