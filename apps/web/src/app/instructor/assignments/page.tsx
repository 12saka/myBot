'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  FileCheck2,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  ExternalLink,
  Award,
  BookOpen,
  Filter,
  FileText,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorAssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ASSIGNMENTS' | 'SUBMISSIONS'>('SUBMISSIONS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'GRADED'>('SUBMITTED');

  // Assignment Modal
  const [assignModal, setAssignModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [xpReward, setXpReward] = useState(150);

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

  const handleOpenCreateAssignment = () => {
    setEditingId(null);
    setTitle('');
    setCourseId(courses[0]?.id || '');
    setInstructions('');
    setDueDate('');
    setMaxScore(100);
    setXpReward(150);
    setAssignModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!title.trim() || !courseId || !instructions.trim()) {
      toast.error('Title, Course, and Instructions are required.');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        courseId,
        instructions: instructions.trim(),
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
        toast.success('Assignment updated!');
      } else {
        await apiFetch('/api/v2/instructor/assignments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Assignment published to students!');
      }
      setAssignModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save assignment');
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
      toast.success('Grade & feedback submitted to student!');
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
            <h2 className="text-xl font-bold text-white font-outfit">Homework & Grading Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
              EVALUATION QUEUE
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Publish trading homework assignments and grade student submissions with score & feedback.</p>
        </div>

        <button
          onClick={handleOpenCreateAssignment}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Assignment</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-teal-500/20 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('SUBMISSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'SUBMISSIONS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Grading Queue ({submissions.filter((s) => s.status === 'SUBMITTED').length} Pending)
          </button>
          <button
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'ASSIGNMENTS'
                ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Published Assignments ({assignments.length})
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

      {/* TAB 1: SUBMISSIONS GRADING QUEUE */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="glass-panel rounded-2xl border border-teal-500/20 overflow-hidden bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
              <tr>
                <th className="p-4">Student</th>
                <th className="p-4">Assignment / Course</th>
                <th className="p-4">Submission Notes / Link</th>
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
                    <td className="p-4 max-w-xs">
                      {sub.submissionText && <p className="text-slate-300 line-clamp-2">{sub.submissionText}</p>}
                      {sub.linkUrl && (
                        <a
                          href={sub.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-400 hover:underline text-[11px] font-mono flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> View Submitted Asset Link
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
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition"
                      >
                        {sub.status === 'GRADED' ? 'Edit Grade' : 'Grade Submission'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PUBLISHED ASSIGNMENTS LIST */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 font-mono glass-panel rounded-2xl border border-teal-500/20">
              No homework assignments created. Click "Publish Assignment" to create one.
            </div>
          ) : (
            assignments.map((ass) => (
              <div key={ass.id} className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {ass.course?.title || 'Course Homework'}
                    </span>
                    <span className="text-xs font-mono text-purple-300 font-bold">+{ass.xpReward || 150} XP REWARD</span>
                  </div>

                  <h3 className="text-base font-bold text-white font-outfit">{ass.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{ass.instructions}</p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="text-xs font-mono text-slate-400">
                    <span>Max Score: <strong className="text-white">{ass.maxScore} pts</strong></span>
                    <span className="block text-[11px] text-amber-300">Submissions: {ass._count?.submissions || 0}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteAssignment(ass.id, ass.title)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                      title="Delete Assignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Publish Assignment */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Publish Homework Assignment</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Assignment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Homework 1: Chart & Identify 3 Bullish Fair Value Gaps"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Associated Course</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Homework Instructions & Deliverables</label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Detail step-by-step what students should analyze, chart, or submit..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="text-slate-300 font-semibold block mb-1">XP Reward</label>
                  <input
                    type="number"
                    value={xpReward}
                    onChange={(e) => setXpReward(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono text-purple-300 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAssignModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssignment}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
              >
                Publish Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grade Submission */}
      {gradeModal && selectedSub && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Grade Student Submission</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  {selectedSub.user?.profile?.firstName
                    ? `${selectedSub.user.profile.firstName} ${selectedSub.user.profile.lastName || ''}`
                    : selectedSub.user?.email}
                </span>
                <span className="font-mono text-teal-400">{selectedSub.assignment?.title}</span>
              </div>

              {selectedSub.submissionText && (
                <div className="p-2.5 rounded bg-white/5 text-slate-300 font-mono text-[11px] leading-relaxed">
                  "{selectedSub.submissionText}"
                </div>
              )}

              {selectedSub.linkUrl && (
                <a
                  href={selectedSub.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-400 hover:underline text-xs font-mono flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Submitted Deliverable Link
                </a>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Score (0 to {selectedSub.assignment?.maxScore || 100})
                </label>
                <input
                  type="number"
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-950 border border-indigo-500/30 rounded-xl text-white font-mono font-bold text-base focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Instructor Written Feedback</label>
                <textarea
                  rows={3}
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  placeholder="Provide constructive feedback for student learning..."
                  className="w-full p-2.5 bg-slate-950 border border-indigo-500/30 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setGradeModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitGrade}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition"
              >
                Submit Grade & Award XP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
