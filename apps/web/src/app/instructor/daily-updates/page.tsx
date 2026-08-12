'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Sparkles,
  Plus,
  HelpCircle,
  TrendingUp,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorDailyUpdatesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [qotd, setQotd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Daily Activity Modal State
  const [activityModal, setActivityModal] = useState(false);
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('TIP');
  const [actContent, setActContent] = useState('');
  const [actChartUrl, setActChartUrl] = useState('');

  // QOTD Modal State
  const [qotdModal, setQotdModal] = useState(false);
  const [qotdTitle, setQotdTitle] = useState("Today's Trading Challenge 🧠");
  const [qotdText, setQotdText] = useState('');
  const [qotdChartUrl, setQotdChartUrl] = useState('');
  const [qotdOptions, setQotdOptions] = useState<string[]>(['', '', '', '']);
  const [qotdCorrectIdx, setQotdCorrectIdx] = useState(0);
  const [qotdExplain, setQotdExplain] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actData, qData] = await Promise.all([
        apiFetch<any[]>('/api/v2/instructor/daily-activities'),
        apiFetch<any>('/api/v2/instructor/qotd'),
      ]);
      setActivities(actData || []);
      setQotd(qData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load daily updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveActivity = async () => {
    if (!actTitle.trim() || !actContent.trim()) {
      toast.error('Title and content are required.');
      return;
    }
    try {
      await apiFetch('/api/v2/instructor/daily-activities', {
        method: 'POST',
        body: JSON.stringify({
          title: actTitle.trim(),
          type: actType,
          content: actContent.trim(),
          chartUrl: actChartUrl.trim() || undefined,
        }),
      });
      toast.success('Daily Trading Activity published!');
      setActivityModal(false);
      setActTitle('');
      setActContent('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish activity');
    }
  };

  const handleSaveQotd = async () => {
    if (!qotdText.trim() || qotdOptions.some((o) => !o.trim())) {
      toast.error('Question text and all 4 choices are required.');
      return;
    }
    try {
      await apiFetch('/api/v2/instructor/qotd', {
        method: 'POST',
        body: JSON.stringify({
          title: qotdTitle.trim(),
          questionText: qotdText.trim(),
          chartUrl: qotdChartUrl.trim() || undefined,
          options: qotdOptions.map((o) => o.trim()),
          correctOptionIndex: Number(qotdCorrectIdx),
          explanation: qotdExplain.trim() || 'Institutional market breakdown.',
        }),
      });
      toast.success("Today's Question of the Day published!");
      setQotdModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish Question of the Day');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-outfit">Daily Academy Updates & QOTD Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded">
              LIVING ACADEMY
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Publish trading tips of the day, chart breakdowns, and daily interactive challenges.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivityModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            <span>Publish Trading Tip</span>
          </button>
          <button
            onClick={() => setQotdModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Publish Question of the Day</span>
          </button>
        </div>
      </div>

      {/* TODAY'S QUESTION OF THE DAY BANNER */}
      <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/60 via-slate-900 to-indigo-950/40 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/20 px-2.5 py-0.5 rounded border border-teal-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>ACTIVE QUESTION OF THE DAY</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            {qotd?._count?.responses || 0} Student Answers Today
          </span>
        </div>

        {!qotd ? (
          <p className="text-xs text-slate-400 font-mono">No Question of the Day published for today. Click above to create one.</p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-black text-white font-outfit">{qotd.title}</h3>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold bg-slate-950/80 p-3 rounded-xl border border-white/5">
              {qotd.questionText}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
              {qotd.options?.map((opt: string, idx: number) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    idx === qotd.correctOptionIndex
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                      : 'bg-slate-950/60 border-white/5 text-slate-400'
                  }`}
                >
                  <span>Option #{idx + 1}: {opt}</span>
                  {idx === qotd.correctOptionIndex && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DAILY TRADING TIPS & ANNOUNCEMENTS LIST */}
      <div className="glass-panel p-6 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4">
        <h3 className="text-base font-bold text-white font-outfit">Daily Trading Tips & Market Lessons</h3>

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono rounded-xl bg-slate-950/60 border border-white/5">
              No daily trading tips published yet.
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="p-4 rounded-xl bg-slate-950/80 border border-teal-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                    {act.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{new Date(act.publishedAt).toLocaleString()}</span>
                </div>
                <h4 className="text-sm font-bold text-white font-outfit">{act.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-mono">{act.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Publish Activity */}
      {activityModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Publish Daily Trading Tip / Lesson</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Title</label>
                <input
                  type="text"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="e.g. Today's Trading Lesson: BTCUSD Liquidity Sweep"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Content & Market Advice</label>
                <textarea
                  rows={4}
                  value={actContent}
                  onChange={(e) => setActContent(e.target.value)}
                  placeholder="Detail the key trading insight for students today..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setActivityModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveActivity} className="flex-1 py-2 rounded-xl bg-teal-600 text-xs font-semibold text-white shadow-lg">
                Publish Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish QOTD */}
      {qotdModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white font-outfit">Publish Question of the Day</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Challenge Title</label>
                <input
                  type="text"
                  value={qotdTitle}
                  onChange={(e) => setQotdTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Question Prompt</label>
                <textarea
                  rows={3}
                  value={qotdText}
                  onChange={(e) => setQotdText(e.target.value)}
                  placeholder="e.g. What is happening in this BTCUSD 15m structure?"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">4 Choices (Select Radio for Correct Answer)</label>
                {qotdOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="qotdCorrectRadio"
                      checked={qotdCorrectIdx === idx}
                      onChange={() => setQotdCorrectIdx(idx)}
                      className="accent-teal-500 w-4 h-4"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...qotdOptions];
                        copy[idx] = e.target.value;
                        setQotdOptions(copy);
                      }}
                      placeholder={`Option #${idx + 1}`}
                      className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Instructor Explanation</label>
                <textarea
                  rows={3}
                  value={qotdExplain}
                  onChange={(e) => setQotdExplain(e.target.value)}
                  placeholder="Detailed breakdown explaining why the correct choice is right..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setQotdModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveQotd} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 text-xs font-semibold text-white shadow-lg">
                Publish QOTD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
