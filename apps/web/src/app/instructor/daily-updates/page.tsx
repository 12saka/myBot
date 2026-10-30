'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Sparkles,
  Plus,
  CheckCircle2,
  FileText,
  ExternalLink,
  Bell,
  Eye,
  Link2,
  ListChecks,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';

const NOTE_CATEGORIES = [
  { value: 'STUDY_NOTE', label: '📚 Study Note / Institutional Guide', badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  { value: 'CHART_BREAKDOWN', label: '📊 Chart Breakdown / Case Study', badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  { value: 'SESSION_RECAP', label: '🕒 London / NY Session Recap', badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'TIP', label: '💡 Daily Trading Tip & Rule', badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
];

export default function InstructorDailyUpdatesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [qotd, setQotd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Study Note / Market Breakdown Modal State
  const [activityModal, setActivityModal] = useState(false);
  const [noteTab, setNoteTab] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('STUDY_NOTE');
  const [actContent, setActContent] = useState('');
  const [actTakeaways, setActTakeaways] = useState<string[]>(['']);
  const [actChartUrl, setActChartUrl] = useState('');

  // QOTD Modal State
  const [qotdModal, setQotdModal] = useState(false);
  const [qotdTitle, setQotdTitle] = useState("Today's Institutional Trading Challenge");
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
      toast.error(err.message || 'Failed to load study notes & daily updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNoteModal = () => {
    setNoteTab('WRITE');
    setActTitle('');
    setActType('STUDY_NOTE');
    setActContent('');
    setActTakeaways([
      'Wait for HTF liquidity sweep before dropping to M15/M5 for entry confirmation',
      'Always place invalidation beyond the manipulation wick high/low',
    ]);
    setActChartUrl('');
    setActivityModal(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSaveActivity = async () => {
    if (saving) return;
    if (!actTitle.trim() || !actContent.trim()) {
      toast.error('Study Note title and main body content are required.');
      return;
    }

    const cleanTakeaways = actTakeaways.map((t) => t.trim()).filter(Boolean);
    const compiledContent =
      cleanTakeaways.length > 0
        ? `${actContent.trim()}\n\n### Key Takeaways\n${cleanTakeaways.map((t) => `- ${t}`).join('\n')}`
        : actContent.trim();

    setSaving(true);
    try {
      await apiFetch('/api/v2/instructor/daily-activities', {
        method: 'POST',
        body: JSON.stringify({
          title: actTitle.trim(),
          type: actType,
          content: compiledContent,
          chartUrl: actChartUrl.trim() || undefined,
        }),
      });
      toast.success('Study Note published & all students notified!');
      setActivityModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish study note');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQotd = async () => {
    if (saving) return;
    if (!qotdText.trim() || qotdOptions.some((o) => !o.trim())) {
      toast.error('Question text and all 4 choices are required.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/v2/instructor/qotd', {
        method: 'POST',
        body: JSON.stringify({
          title: qotdTitle.trim(),
          questionText: qotdText.trim(),
          chartUrl: qotdChartUrl.trim() || undefined,
          options: qotdOptions.map((o) => o.trim()),
          correctOptionIndex: Number(qotdCorrectIdx),
          explanation: qotdExplain.trim() || 'Institutional market structure breakdown.',
        }),
      });
      toast.success("Today's Question of the Day published & students notified!");
      setQotdModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish Question of the Day');
    } finally {
      setSaving(false);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-teal-500/25 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white font-outfit">Study Notes, Market Breakdowns & QOTD Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Bell className="w-3 h-3" /> AUTO-NOTIFY ENABLED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Publish structured study notes, annotated chart breakdowns, session recaps, and daily interactive challenges directly to the Student Academy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenNoteModal}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Publish Study Note / Breakdown</span>
          </button>
          <button
            onClick={() => setQotdModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
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
            <span>ACTIVE QUESTION OF THE DAY (+25 XP FOR STUDENTS)</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            {qotd?._count?.responses || 0} Student Responses Today
          </span>
        </div>

        {!qotd ? (
          <p className="text-xs text-slate-400 font-mono">
            No Question of the Day published for today. Click "Publish Question of the Day" above to challenge students.
          </p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-black text-white font-outfit">{qotd.title}</h3>
            <p className="text-xs text-slate-200 leading-relaxed font-semibold bg-slate-950/80 p-3.5 rounded-xl border border-white/5">
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
                  <span>
                    Option #{idx + 1}: {opt}
                  </span>
                  {idx === qotd.correctOptionIndex && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PUBLISHED STUDY NOTES & MARKET BREAKDOWNS */}
      <div className="glass-panel p-6 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span>Published Study Notes, Chart Breakdowns & Session Recaps ({activities.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              All published notes appear in the Student Academy "Study Notes & Market Briefs" hub.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 font-mono rounded-xl bg-slate-950/60 border border-white/5">
              No study notes or market breakdowns published yet.
            </div>
          ) : (
            activities.map((act) => {
              const catMeta = NOTE_CATEGORIES.find((c) => c.value === act.type) || NOTE_CATEGORIES[0];
              const [bodyPart, takeawaysPart] = (act.content || '').split(/###\s+Key Takeaways/i);
              const takeaways = takeawaysPart
                ? takeawaysPart
                    .split('\n')
                    .map((l: string) => l.replace(/^[-*•]\s*/, '').trim())
                    .filter(Boolean)
                : [];

              return (
                <div
                  key={act.id}
                  className="p-5 rounded-2xl bg-slate-950/85 border border-teal-500/20 hover:border-teal-500/40 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border ${catMeta.badgeColor}`}>
                        {act.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(act.publishedAt).toLocaleString()}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white font-outfit">{act.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{(bodyPart || '').trim()}</p>

                    {takeaways.length > 0 && (
                      <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/25 space-y-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold block">
                          Key Takeaways
                        </span>
                        <ul className="space-y-1">
                          {takeaways.map((t: string, i: number) => (
                            <li key={i} className="text-xs text-slate-200 flex items-start gap-1.5">
                              <span className="text-teal-400 font-bold">✓</span>
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {act.chartUrl && (
                    <div className="pt-2 border-t border-white/10">
                      <a
                        href={act.chartUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-teal-400 hover:text-teal-300 flex items-center gap-1.5 underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open Attached TradingView / Chart Snapshot
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Rich Study Note & Market Breakdown Publisher */}
      {activityModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-2xl space-y-5 bg-slate-900 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-outfit">Publish Study Note / Market Breakdown</h3>
                <p className="text-[11px] text-slate-400">
                  Create a clean, structured note for students with optional chart link and bulleted key takeaways.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setNoteTab('WRITE')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    noteTab === 'WRITE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Write Note
                </button>
                <button
                  type="button"
                  onClick={() => setNoteTab('PREVIEW')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    noteTab === 'PREVIEW' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" /> 2. Student View Preview
                </button>
              </div>
            </div>

            {noteTab === 'WRITE' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-slate-300 font-semibold block mb-1">Study Note Title *</label>
                    <input
                      type="text"
                      value={actTitle}
                      onChange={(e) => setActTitle(e.target.value)}
                      placeholder="e.g. XAU/USD NY Open BOS & Order Block Execution Playbook"
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-semibold focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Note Category</label>
                    <select
                      value={actType}
                      onChange={(e) => setActType(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
                    >
                      {NOTE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Detailed Study Note & Market Breakdown *
                  </label>
                  <textarea
                    rows={5}
                    value={actContent}
                    onChange={(e) => setActContent(e.target.value)}
                    placeholder="Write out the institutional market structure explanation, entry triggers, timeframe alignment, and risk rules..."
                    className="w-full p-3 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 leading-relaxed"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-teal-300 font-bold flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" /> Key Takeaways Checklist
                    </label>
                    <button
                      type="button"
                      onClick={() => setActTakeaways((prev) => [...prev, ''])}
                      className="text-[11px] font-bold text-teal-400 hover:text-teal-300 cursor-pointer"
                    >
                      + Add Takeaway
                    </button>
                  </div>
                  <div className="space-y-2">
                    {actTakeaways.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-teal-400 font-mono">•</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) =>
                            setActTakeaways((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                          }
                          placeholder="e.g. Wait for M15 candle body close to confirm BOS..."
                          className="flex-1 p-2 bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-teal-500"
                        />
                        {actTakeaways.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setActTakeaways((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-red-400 px-1.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-teal-400" /> Reference Chart Image / TradingView Snapshot URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={actChartUrl}
                    onChange={(e) => setActChartUrl(e.target.value)}
                    placeholder="https://www.tradingview.com/x/..."
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-4">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 font-bold">
                  {actType.replace('_', ' ')}
                </span>
                <h4 className="text-lg font-bold text-white font-outfit">{actTitle || 'Untitled Study Note'}</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {actContent || 'No note body entered yet.'}
                </p>
                {actTakeaways.filter((t) => t.trim()).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold block">
                      Key Takeaways
                    </span>
                    <ul className="space-y-1">
                      {actTakeaways
                        .filter((t) => t.trim())
                        .map((t, i) => (
                          <li key={i} className="text-xs text-slate-100 flex items-start gap-2">
                            <span className="text-teal-400 font-bold">✓</span>
                            <span>{t}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Broadcasts instant notification to all students
              </span>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setActivityModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveActivity}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-lg shadow-teal-600/20 transition cursor-pointer"
                >
                  Publish Study Note & Notify
                </button>
              </div>
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
                  placeholder="e.g. What confirms a high-probability BOS_PULLBACK_CONTINUATION entry on XAU/USD M15?"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Chart Image URL (Optional)</label>
                <input
                  type="url"
                  value={qotdChartUrl}
                  onChange={(e) => setQotdChartUrl(e.target.value)}
                  placeholder="https://www.tradingview.com/x/..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
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
              <button
                onClick={() => setQotdModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQotd}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 text-xs font-semibold text-white shadow-lg cursor-pointer"
              >
                Publish QOTD & Notify Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
