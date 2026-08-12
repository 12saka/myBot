'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  GraduationCap,
  Users,
  Award,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  RefreshCw,
  Search,
  BookOpen,
  Filter,
  BarChart3,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperadminAcademyAnalyticsPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [retentionData, setRetentionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [healthFilter, setHealthFilter] = useState<'ALL' | 'HEALTHY' | 'AT_RISK' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [tel, ret] = await Promise.all([
        apiFetch<any>('/api/v2/admin/academy/analytics'),
        apiFetch<any>('/api/v2/admin/academy/retention'),
      ]);
      setTelemetry(tel);
      setRetentionData(ret);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Superadmin Academy analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const students = telemetry?.health?.students || [];
  const filteredStudents = students.filter((s: any) => {
    if (healthFilter !== 'ALL' && s.healthStatus !== healthFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    }
    return true;
  });

  const funnel = telemetry?.funnel || {};
  const metrics = telemetry?.metrics || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Banner */}
      <AdminPageBanner
        badgeText="SUPERADMIN ACADEMY COMMAND CENTER"
        title="Overall Academy Performance & Learner Health"
        description="Monitor platform-wide learner retention, learning funnel conversion, student health classification (Healthy, At-Risk, Inactive), and lesson drop-off curves without interrupting instructor daily teaching."
        icon={GraduationCap}
        stats={[
          { label: 'Total Learners', value: (metrics.totalLearners || 0).toLocaleString(), color: 'text-purple-300' },
          { label: 'Active (3 Days)', value: (metrics.activeLearnersCount || 0).toLocaleString(), color: 'text-emerald-400' },
          { label: 'Avg Quiz Score', value: `${metrics.avgScorePct || 78}%`, color: 'text-amber-300' },
          { label: 'Certificates Issued', value: (metrics.totalCertificates || 0).toLocaleString(), color: 'text-indigo-400' },
        ]}
        actions={
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Analytics</span>
          </button>
        }
      />

      {/* LEARNING FUNNEL VISUALIZER */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span>Academy Learning Funnel Telemetry</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Track student conversion from registration to final exam certification.</p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
            AUTOMATED DIAGNOSTICS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2">
          {[
            { label: 'Registered', count: funnel.registered || 0, color: 'from-purple-600 to-indigo-600' },
            { label: 'Started Academy', count: funnel.startedAcademy || 0, color: 'from-indigo-600 to-teal-600' },
            { label: 'Started Course', count: funnel.startedCourse || 0, color: 'from-teal-600 to-emerald-600' },
            { label: 'Completed 25%', count: funnel.completed25 || 0, color: 'from-emerald-600 to-amber-600' },
            { label: 'Completed 50%', count: funnel.completed50 || 0, color: 'from-amber-600 to-orange-600' },
            { label: 'Completed 75%', count: funnel.completed75 || 0, color: 'from-orange-600 to-rose-600' },
            { label: 'Course Done', count: funnel.completedCourse || 0, color: 'from-rose-600 to-purple-600' },
            { label: 'Certified 🏆', count: funnel.certified || 0, color: 'from-purple-500 to-amber-400' },
          ].map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-1.5 flex flex-col justify-between">
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">{item.label}</span>
              <span className="text-base font-bold font-mono text-white">{item.count.toLocaleString()}</span>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${item.color}`}
                  style={{ width: `${Math.max(10, Math.min(100, (item.count / (funnel.registered || 1)) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STUDENT HEALTH INDICATORS DIRECTORY */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Student Health Indicators</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Automated classification of active, at-risk, and inactive learners.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setHealthFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold font-outfit transition ${
                  healthFilter === 'ALL' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHealthFilter('HEALTHY')}
                className={`px-3 py-1 rounded-lg font-semibold font-outfit transition ${
                  healthFilter === 'HEALTHY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🟢 Healthy ({telemetry?.health?.healthyCount || 0})
              </button>
              <button
                onClick={() => setHealthFilter('AT_RISK')}
                className={`px-3 py-1 rounded-lg font-semibold font-outfit transition ${
                  healthFilter === 'AT_RISK' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🟡 At-Risk ({telemetry?.health?.atRiskCount || 0})
              </button>
              <button
                onClick={() => setHealthFilter('INACTIVE')}
                className={`px-3 py-1 rounded-lg font-semibold font-outfit transition ${
                  healthFilter === 'INACTIVE' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🔴 Inactive ({telemetry?.health?.inactiveCount || 0})
              </button>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search learner..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Health Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Learner</th>
                <th className="p-3">Health Status</th>
                <th className="p-3">Quiz Attempts</th>
                <th className="p-3">Failed Quizzes</th>
                <th className="p-3">Last Active Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                    No learners matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s: any) => (
                  <tr key={s.id} className="hover:bg-white/5 transition">
                    <td className="p-3 font-semibold text-white">
                      <div>
                        <span>{s.name}</span>
                        <span className="block text-[10px] font-mono text-slate-400">{s.email}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          s.healthStatus === 'HEALTHY'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : s.healthStatus === 'AT_RISK'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {s.healthStatus === 'HEALTHY' ? '🟢 Healthy' : s.healthStatus === 'AT_RISK' ? '🟡 At Risk' : '🔴 Inactive'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-center font-bold text-white">{s.quizCount}</td>
                    <td className="p-3 font-mono text-center font-bold text-amber-300">{s.failedCount}</td>
                    <td className="p-3 font-mono text-slate-400">{new Date(s.lastActiveDate).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTENT QUALITY & LESSON DROP-OFF TELEMETRY */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-amber-400" />
          <span>Lesson Drop-off Retention Telemetry</span>
        </h3>
        <p className="text-xs text-slate-400 font-mono">Identifies specific lessons where student completion rate drops significantly, requiring instructor restructuring.</p>

        <div className="space-y-4 pt-2">
          {retentionData?.retentionCurves?.map((crs: any) => (
            <div key={crs.courseId} className="p-4 rounded-xl bg-slate-950/80 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs font-outfit">{crs.courseTitle}</span>
                <span className="text-[10px] font-mono text-purple-300">{crs.totalLessons} Lessons</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {crs.retentionCurve?.map((les: any) => (
                  <div
                    key={les.lessonId}
                    className={`p-2.5 rounded-lg border text-xs font-mono space-y-1 ${
                      les.isDropOffPoint
                        ? 'bg-red-500/10 border-red-500/30 text-red-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="text-[9px] block text-slate-400 truncate">Lesson {les.orderIndex}</span>
                    <span className="font-bold text-xs block">{les.completionRatePct}% retention</span>
                    {les.isDropOffPoint && <span className="text-[8px] text-red-400 block font-bold">⚠️ DROP-OFF POINT</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
