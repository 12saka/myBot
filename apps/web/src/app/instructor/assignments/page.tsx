'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  FileCheck2,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Award,
  BookOpen,
  Filter,
  FileText,
  User,
  Calendar,
  Eye,
  Sparkles,
  ListChecks,
  Link2,
  Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ParsedAssignmentContent {
  summary: string;
  deliverables: string[];
  referenceUrl: string;
  gradingCriteria: string;
}

function serializeAssignmentInstructions(data: ParsedAssignmentContent): string {
  const parts: string[] = [];
  if (data.summary.trim()) {
    parts.push(data.summary.trim());
  }
  const cleanDeliverables = data.deliverables.map((d) => d.trim()).filter(Boolean);
  if (cleanDeliverables.length > 0) {
    parts.push(`### Required Deliverables\n${cleanDeliverables.map((d) => `- ${d}`).join('\n')}`);
  }
  if (data.gradingCriteria.trim()) {
    parts.push(`### Grading Criteria\n${data.gradingCriteria.trim()}`);
  }
  if (data.referenceUrl.trim()) {
    parts.push(`### Reference Chart / Resource\n${data.referenceUrl.trim()}`);
  }
  return parts.join('\n\n');
}

function parseAssignmentInstructions(raw: string = ''): ParsedAssignmentContent {
  if (!raw.includes('### ')) {
    return {
      summary: raw.trim(),
      deliverables: [],
      referenceUrl: '',
      gradingCriteria: '',
    };
  }

  const sections = raw.split(/###\s+/);
  const summary = (sections[0] || '').trim();
  let deliverables: string[] = [];
  let gradingCriteria = '';
  let referenceUrl = '';

  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const lines = sec.split('\n');
    const heading = (lines[0] || '').trim().toLowerCase();
    const body = lines.slice(1).join('\n').trim();

    if (heading.includes('deliverable')) {
      deliverables = body
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
    } else if (heading.includes('grading') || heading.includes('criteria')) {
      gradingCriteria = body;
    } else if (heading.includes('reference') || heading.includes('resource')) {
      referenceUrl = body;
    }
  }

  return { summary, deliverables, referenceUrl, gradingCriteria };
}

const QUICK_TEMPLATES = [
  {
    label: 'SMC Order Block & FVG Markup',
    title: 'Chart Markup: Institutional Order Block & Fair Value Gap Entry',
    summary:
      'Analyze XAU/USD or EUR/USD on the H1 and M15 timeframes. Identify a high-probability institutional Order Block paired with an unmitigated Fair Value Gap (FVG) aligned with Higher-Timeframe bias.',
    deliverables: [
      'Mark the H4/H1 Structural Bias (BOS or CHoCH) on your TradingView chart',
      'Highlight the unmitigated M15 Order Block and Fair Value Gap entry zone',
      'Plot exact Entry Price, Stop Loss (beyond structure), and 1:3+ Take Profit target',
      'Paste your TradingView snapshot link and a 2-3 sentence trade rationale',
    ],
    gradingCriteria: '40% HTF Structure Accuracy • 35% OB/FVG Zone Precision • 25% Risk-to-Reward & Stop Placement',
  },
  {
    label: 'Liquidity Sweep & Session Reversal',
    title: 'London / NY Killzone Liquidity Sweep Breakdown',
    summary:
      'Document a real-market Asian Range high/low liquidity sweep during the London or New York Open session and explain the displacement candle confirmation.',
    deliverables: [
      'Identify Asian Session High and Low liquidity pools',
      'Point out the manipulation sweep wick and subsequent M15/M5 CHoCH',
      'Provide your TradingView chart URL and written execution rules',
    ],
    gradingCriteria: '50% Liquidity Pool Identification • 30% Displacement Confirmation • 20% Execution Clarity',
  },
];

export default function InstructorAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ASSIGNMENTS' | 'SUBMISSIONS'>('ASSIGNMENTS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'GRADED'>('SUBMITTED');

  // Assignment Publisher Modal
  const [assignModal, setAssignModal] = useState(false);
  const [modalMode, setModalMode] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [summary, setSummary] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [gradingCriteria, setGradingCriteria] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [xpReward, setXpReward] = useState(150);
  const [saving, setSaving] = useState(false);

  // Grade Modal
  const [gradeModal, setGradeModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(85);
  const [gradeFeedback, setGradeFeedback] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assData, subData, crsData] = await Promise.all([
        apiFetch<any[]>('/api/v2/instructor/assignments'),
        apiFetch<any[]>('/api/v2/instructor/assignments/submissions'),
        apiFetch<any[]>('/api/v2/instructor/courses'),
      ]);
      setAssignments(assData || []);
      setSubmissions(subData || []);
      setCourses(crsData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const courseLessons: any[] = selectedCourse?.lessons || [];

  const handleOpenCreateAssignment = () => {
    setEditingId(null);
    setModalMode('WRITE');
    setTitle('');
    const defaultCourseId = courses[0]?.id || '';
    setCourseId(defaultCourseId);
    setLessonId('');
    setSummary('');
    setDeliverables([
      'Upload or link your annotated TradingView chart screenshot',
      'Write a clear breakdown of your HTF bias, entry trigger, and invalidation level',
    ]);
    setGradingCriteria('Accuracy of market structure markup, confluence quality, and risk management.');
    setReferenceUrl('');
    setDueDate('');
    setMaxScore(100);
    setXpReward(150);
    setAssignModal(true);
  };

  const handleOpenEditAssignment = (ass: any) => {
    const parsed = parseAssignmentInstructions(ass.instructions || '');
    setEditingId(ass.id);
    setModalMode('WRITE');
    setTitle(ass.title || '');
    setCourseId(ass.courseId || courses[0]?.id || '');
    setLessonId(ass.lessonId || '');
    setSummary(parsed.summary);
    setDeliverables(parsed.deliverables.length > 0 ? parsed.deliverables : ['']);
    setGradingCriteria(parsed.gradingCriteria || '');
    setReferenceUrl(parsed.referenceUrl || '');
    setDueDate(ass.dueDate ? new Date(ass.dueDate).toISOString().slice(0, 10) : '');
    setMaxScore(ass.maxScore ?? 100);
    setXpReward(ass.xpReward ?? 150);
    setAssignModal(true);
  };

  const handleApplyTemplate = (tpl: (typeof QUICK_TEMPLATES)[0]) => {
    setTitle(tpl.title);
    setSummary(tpl.summary);
    setDeliverables([...tpl.deliverables]);
    setGradingCriteria(tpl.gradingCriteria);
    toast.success(`Applied "${tpl.label}" template`);
  };

  const handleDeliverableChange = (index: number, val: string) => {
    setDeliverables((prev) => prev.map((item, i) => (i === index ? val : item)));
  };

  const handleAddDeliverable = () => {
    setDeliverables((prev) => [...prev, '']);
  };

  const handleRemoveDeliverable = (index: number) => {
    setDeliverables((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));
  };

  const handleSaveAssignment = async () => {
    if (!title.trim() || !courseId || !summary.trim()) {
      toast.error('Assignment Title, Course, and Core Objective are required.');
      return;
    }

    const compiledInstructions = serializeAssignmentInstructions({
      summary,
      deliverables,
      referenceUrl,
      gradingCriteria,
    });

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        courseId,
        lessonId: lessonId || null,
        instructions: compiledInstructions,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        maxScore: Number(maxScore),
        xpReward: Number(xpReward),
        isPublished: true,
      };

      if (editingId) {
        await apiFetch(`/api/v2/instructor/assignments/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Assignment updated successfully!');
      } else {
        await apiFetch('/api/v2/instructor/assignments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Assignment published & notification sent to all students!');
      }
      setAssignModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (id: string, titleStr: string) => {
    if (!confirm(`Delete assignment "${titleStr}"?`)) return;
    try {
      await apiFetch(`/api/v2/instructor/assignments/${id}`, { method: 'DELETE' });
      toast.success('Assignment deleted.');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete assignment');
    }
  };

  const handleOpenGradeModal = (sub: any) => {
    setSelectedSub(sub);
    setGradeScore(sub.score ?? sub.assignment?.maxScore ?? 100);
    setGradeFeedback(sub.feedback || '');
    setGradeModal(true);
  };

  const handleSubmitGrade = async () => {
    if (!selectedSub) return;
    try {
      await apiFetch(`/api/v2/instructor/assignments/submissions/${selectedSub.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          score: Number(gradeScore),
          feedback: gradeFeedback.trim(),
          status: 'GRADED',
        }),
      });
      toast.success('Grade & feedback sent to student (+XP credited)!');
      setGradeModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to grade submission');
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  const pendingCount = submissions.filter((s) => s.status === 'SUBMITTED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-teal-500/25 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white font-outfit">Assignment Publisher & Grading Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Bell className="w-3 h-3" /> AUTO-NOTIFY ENABLED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Publish structured chart-markup assignments with clear deliverable checklists, reference charts, and automatic student notifications.
          </p>
        </div>

        <button
          onClick={handleOpenCreateAssignment}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create & Publish Assignment</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-500/20 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'ASSIGNMENTS'
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Published Assignments ({assignments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('SUBMISSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'SUBMISSIONS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Student Submissions</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                {pendingCount} Pending
              </span>
            )}
          </button>
        </div>

        {activeTab === 'SUBMISSIONS' && (
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-teal-500/20 rounded-lg text-xs font-mono text-slate-300 p-1.5"
            >
              <option value="SUBMITTED">Pending Review Only</option>
              <option value="GRADED">Already Graded</option>
              <option value="ALL">All Submissions</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: PUBLISHED ASSIGNMENTS */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {assignments.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-400 glass-panel rounded-2xl border border-teal-500/20 space-y-3">
              <FileCheck2 className="w-10 h-10 text-teal-400 mx-auto opacity-70" />
              <p className="text-sm font-semibold text-white">No Assignments Published Yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Create & Publish Assignment" above to build a structured trading homework brief and notify all students.
              </p>
            </div>
          ) : (
            assignments.map((ass) => {
              const parsed = parseAssignmentInstructions(ass.instructions || '');
              return (
                <div
                  key={ass.id}
                  className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/70 hover:border-teal-500/40 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/15 px-2.5 py-0.5 rounded-md border border-teal-500/30 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {ass.course?.title || 'Academy Course'}
                        </span>
                        {ass.lesson?.title && (
                          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/25">
                            Lesson: {ass.lesson.title}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                        +{ass.xpReward || 150} XP
                      </span>
                    </div>

                    {/* Title & Summary */}
                    <div>
                      <h3 className="text-base font-bold text-white font-outfit">{ass.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1 whitespace-pre-line">{parsed.summary}</p>
                    </div>

                    {/* Structured Deliverables */}
                    {parsed.deliverables.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                          <ListChecks className="w-3.5 h-3.5" /> Required Student Deliverables
                        </span>
                        <ul className="space-y-1">
                          {parsed.deliverables.map((item, idx) => (
                            <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Grading Criteria & Reference Link */}
                    {(parsed.gradingCriteria || parsed.referenceUrl) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                        {parsed.gradingCriteria && (
                          <span className="font-mono text-slate-400">
                            <strong className="text-slate-200">Rubric:</strong> {parsed.gradingCriteria}
                          </span>
                        )}
                        {parsed.referenceUrl && (
                          <a
                            href={parsed.referenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-400 hover:text-teal-300 font-mono flex items-center gap-1 underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Reference Chart
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                      <span>
                        Max: <strong className="text-white">{ass.maxScore} pts</strong>
                      </span>
                      <span className="text-amber-300">
                        Submissions: <strong>{ass._count?.submissions || 0}</strong>
                      </span>
                      {ass.dueDate && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3 h-3 text-teal-400" />
                          Due {new Date(ass.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditAssignment(ass)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 border border-white/10 transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        title="Edit Assignment"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAssignment(ass.id, ass.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                        title="Delete Assignment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: SUBMISSIONS GRADING QUEUE */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel rounded-2xl border border-teal-500/20 overflow-hidden bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Assignment / Course</th>
                <th className="p-4">Submitted Analysis & Chart Link</th>
                <th className="p-4">Status & Score</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500 font-mono">
                    No submissions matching filter status "{statusFilter}".
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/5 transition">
                    <td className="p-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <span>
                            {sub.user?.profile?.firstName
                              ? `${sub.user.profile.firstName} ${sub.user.profile.lastName || ''}`
                              : sub.user?.email}
                          </span>
                          <span className="block text-[10px] font-mono text-slate-400">{sub.user?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium">
                      <span className="text-white font-semibold block">{sub.assignment?.title}</span>
                      <span className="text-[10px] font-mono text-teal-400">{sub.assignment?.course?.title}</span>
                    </td>
                    <td className="p-4 max-w-md">
                      {sub.submissionText && <p className="text-slate-300 line-clamp-2">{sub.submissionText}</p>}
                      {sub.linkUrl && (
                        <a
                          href={sub.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-400 hover:underline text-[11px] font-mono flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Student TradingView / Chart Link
                        </a>
                      )}
                    </td>
                    <td className="p-4 font-mono">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          sub.status === 'GRADED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}
                      >
                        {sub.status}
                      </span>
                      {sub.status === 'GRADED' && (
                        <span className="block text-xs font-bold text-white mt-1">
                          {sub.score} / {sub.assignment?.maxScore || 100} pts
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleOpenGradeModal(sub)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition cursor-pointer"
                      >
                        {sub.status === 'GRADED' ? 'Update Grade' : 'Grade & Award XP'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Rich Assignment Publisher */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-2xl space-y-5 bg-slate-900 my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-outfit">
                  {editingId ? 'Edit Published Assignment' : 'Publish Structured Trading Assignment'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Design a clear, step-by-step homework brief for students. Publishing notifies all active learners immediately.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setModalMode('WRITE')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    modalMode === 'WRITE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Configure
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('PREVIEW')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    modalMode === 'PREVIEW' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" /> 2. Student Preview
                </button>
              </div>
            </div>

            {modalMode === 'WRITE' ? (
              <div className="space-y-4 text-xs">
                {/* Quick Institutional Templates */}
                {!editingId && (
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Quick-Fill Institutional Assignment Templates
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TEMPLATES.map((tpl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-teal-500/20 text-slate-200 hover:text-teal-200 border border-white/10 hover:border-teal-500/30 text-[11px] font-medium transition cursor-pointer"
                        >
                          + {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Assignment Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Module 2 Practical: Mark 3 Bullish Order Blocks & FVG Confluences on XAU/USD"
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                  />
                </div>

                {/* Course & Lesson Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Target Course *</label>
                    <select
                      value={courseId}
                      onChange={(e) => {
                        setCourseId(e.target.value);
                        setLessonId('');
                      }}
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Linked Lesson (Optional)</label>
                    <select
                      value={lessonId}
                      onChange={(e) => setLessonId(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                    >
                      <option value="">Entire Course (General Assignment)</option>
                      {courseLessons.map((l: any, idx: number) => (
                        <option key={l.id} value={l.id}>
                          Module {idx + 1}: {l.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Objective & Context */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Core Objective & Scenario Brief *</label>
                  <textarea
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Explain the market scenario, pair/timeframe to analyze, and what concept the student is proving mastery of..."
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 leading-relaxed"
                  />
                </div>

                {/* Structured Deliverable Checklist Builder */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-teal-300 font-bold flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" /> Student Deliverable Checklist
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDeliverable}
                      className="text-[11px] font-bold text-teal-400 hover:text-teal-300 cursor-pointer"
                    >
                      + Add Checklist Step
                    </button>
                  </div>

                  <div className="space-y-2">
                    {deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleDeliverableChange(idx, e.target.value)}
                          placeholder="e.g. Mark the H1 BOS and highlight the M15 FVG entry zone..."
                          className="flex-1 p-2 bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-teal-500"
                        />
                        {deliverables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDeliverable(idx)}
                            className="text-slate-500 hover:text-red-400 px-1.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grading Rubric & Reference Chart URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Grading Criteria / Rubric</label>
                    <input
                      type="text"
                      value={gradingCriteria}
                      onChange={(e) => setGradingCriteria(e.target.value)}
                      placeholder="e.g. 50% Structure • 30% Entry Zone • 20% Risk Management"
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-teal-400" /> Reference Chart / Example URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={referenceUrl}
                      onChange={(e) => setReferenceUrl(e.target.value)}
                      placeholder="https://www.tradingview.com/x/..."
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Due Date, Max Score & XP */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Due Date (Optional)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Max Score Points</label>
                    <input
                      type="number"
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                      className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Completion XP Reward</label>
                    <input
                      type="number"
                      value={xpReward}
                      onChange={(e) => setXpReward(Number(e.target.value))}
                      className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl font-mono text-purple-300 font-bold"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* STUDENT CARD LIVE PREVIEW */
              <div className="p-5 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 font-bold">
                    {selectedCourse?.title || 'Selected Course'}
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-300">+{xpReward} XP • {maxScore} PTS</span>
                </div>
                <h4 className="text-lg font-bold text-white font-outfit">
                  {title || 'Untitled Trading Assignment'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {summary || 'No assignment objective entered yet.'}
                </p>

                {deliverables.filter((d) => d.trim()).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold block">
                      Required Deliverables Checklist
                    </span>
                    <ul className="space-y-1.5">
                      {deliverables
                        .filter((d) => d.trim())
                        .map((d, i) => (
                          <li key={i} className="text-xs text-slate-200 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                {gradingCriteria && (
                  <div className="text-[11px] font-mono text-slate-400">
                    <strong className="text-white">Grading Rubric:</strong> {gradingCriteria}
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {editingId ? 'Updates live student view immediately' : 'Broadcasts real-time notification to all students'}
              </span>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setAssignModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-teal-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : editingId ? 'Save Changes' : 'Publish & Notify Students'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grade Submission */}
      {gradeModal && selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Grade Student Submission</h3>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  {selectedSub.user?.profile?.firstName
                    ? `${selectedSub.user.profile.firstName} ${selectedSub.user.profile.lastName || ''}`
                    : selectedSub.user?.email}
                </span>
                <span className="font-mono text-teal-400">{selectedSub.assignment?.title}</span>
              </div>

              {selectedSub.submissionText && (
                <div className="p-3 rounded-lg bg-white/5 text-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-line">
                  {selectedSub.submissionText}
                </div>
              )}

              {selectedSub.linkUrl && (
                <a
                  href={selectedSub.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:underline text-xs font-mono flex items-center gap-1.5 pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Submitted Chart / Deliverable Link
                </a>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Score Awarded (0 to {selectedSub.assignment?.maxScore || 100})
                </label>
                <input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-950 border border-indigo-500/30 rounded-xl text-white font-mono font-bold text-base focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Instructor Evaluation & Feedback</label>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Provide specific feedback on their chart structure, entry precision, and risk management..."
                  className="w-full p-2.5 bg-slate-950 border border-indigo-500/30 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setGradeModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitGrade}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                Submit Grade, Notify Student & Award XP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
