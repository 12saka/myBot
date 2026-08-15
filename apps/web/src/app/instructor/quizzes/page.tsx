'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  Award,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorQuizzesPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'QUIZZES' | 'QUESTIONS'>('QUIZZES');

  // Question Modal
  const [questionModal, setQuestionModal] = useState(false);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [qText, setQText] = useState('');
  const [qSkill, setQSkill] = useState('Market Structure');
  const [qAsset, setQAsset] = useState('BTCUSD');
  const [qDiff, setQDiff] = useState('INTERMEDIATE');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState<number>(0);
  const [qExplain, setQExplain] = useState('');

  // Quiz Modal
  const [quizModal, setQuizModal] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizCourseId, setQuizCourseId] = useState('');
  const [quizPassMark, setQuizPassMark] = useState(70);
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [quizXpReward, setQuizXpReward] = useState(100);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [qzData, qData, crsData] = await Promise.all([
        apiFetch<any[]>('/api/v2/instructor/quizzes'),
        apiFetch<any[]>('/api/v2/instructor/question-bank'),
        apiFetch<any[]>('/api/v2/instructor/courses'),
      ]);
      setQuizzes(qzData || []);
      setQuestions(qData || []);
      setCourses(crsData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load quiz data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateQuestion = () => {
    setEditingQId(null);
    setQText('');
    setQSkill('Market Structure');
    setQAsset('BTCUSD');
    setQDiff('INTERMEDIATE');
    setQOptions(['', '', '', '']);
    setQCorrectIdx(0);
    setQExplain('');
    setQuestionModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!qText.trim() || qOptions.some((o) => !o.trim())) {
      toast.error('Question text and all 4 options are required.');
      return;
    }
    try {
      const payload = {
        text: qText.trim(),
        skillTag: qSkill,
        assetTag: qAsset,
        difficulty: qDiff,
        options: qOptions.map((o) => o.trim()),
        correctOptionIndex: qCorrectIdx,
        explanation: qExplain.trim() || 'Correct application of institutional concept.',
      };

      if (editingQId) {
        await apiFetch(`/api/v2/instructor/question-bank/${editingQId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Question updated!');
      } else {
        await apiFetch('/api/v2/instructor/question-bank', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Question added to Question Bank!');
      }
      setQuestionModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save question');
    }
  };

  const handleGenerateAiQuestion = async () => {
    try {
      const res = await apiFetch<any>('/api/v2/admin/academy/generate-question', {
        method: 'POST',
        body: JSON.stringify({ skillTag: 'Market Structure' }),
      });
      if (res) {
        setQText(res.question || res.text || '');
        setQSkill(res.skillTag || 'Market Structure');
        setQAsset(res.assetTag || 'BTCUSD');
        setQDiff(res.difficulty || 'INTERMEDIATE');
        setQOptions(res.options || ['', '', '', '']);
        setQCorrectIdx(res.correctOptionIndex ?? 0);
        setQExplain(res.explanation || '');
        setQuestionModal(true);
        toast.success('AI Question generated from backend service!');
      }
    } catch (err: any) {
      // Fallback: open clean question authoring form
      handleOpenCreateQuestion();
    }
  };

  const handleOpenCreateQuiz = () => {
    setEditingQuizId(null);
    setQuizTitle('');
    setQuizCourseId(courses[0]?.id || '');
    setQuizPassMark(70);
    setQuizTimeLimit(15);
    setQuizXpReward(100);
    setSelectedQIds([]);
    setQuizModal(true);
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) {
      toast.error('Quiz title is required.');
      return;
    }
    try {
      const payload = {
        title: quizTitle.trim(),
        courseId: quizCourseId || undefined,
        passMarkPct: Number(quizPassMark),
        timeLimitMinutes: Number(quizTimeLimit),
        xpReward: Number(quizXpReward),
        questionIds: selectedQIds,
        isPublished: true,
      };

      if (editingQuizId) {
        await apiFetch(`/api/v2/instructor/quizzes/${editingQuizId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Quiz updated!');
      } else {
        await apiFetch('/api/v2/instructor/quizzes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Quiz published!');
      }
      setQuizModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save quiz');
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-outfit">Quizzes & Assessment Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
              EXAM BUILDER
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Author institutional question bank items and assemble automated course quizzes.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGenerateAiQuestion}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500/20 to-indigo-500/20 hover:from-teal-500/30 hover:to-indigo-500/30 text-teal-300 text-xs font-semibold flex items-center gap-1.5 border border-teal-500/30 transition shadow-lg shadow-teal-500/10"
          >
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Generate Question with AI</span>
          </button>
          <button
            onClick={handleOpenCreateQuestion}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>Add Question</span>
          </button>
          <button
            onClick={handleOpenCreateQuiz}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quiz</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-teal-500/20 pb-3">
        <button
          onClick={() => setActiveTab('QUIZZES')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'QUIZZES'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          Active Quizzes ({quizzes.length})
        </button>
        <button
          onClick={() => setActiveTab('QUESTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'QUESTIONS'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          Question Bank ({questions.length})
        </button>
      </div>

      {/* TAB 1: QUIZZES */}
      {activeTab === 'QUIZZES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 font-mono glass-panel rounded-2xl border border-teal-500/20">
              No quizzes published. Click "Create Quiz" to assemble one from the Question Bank.
            </div>
          ) : (
            quizzes.map((qz) => (
              <div key={qz.id} className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {qz.status || 'PUBLISHED'}
                    </span>
                    <span className="text-xs font-mono text-purple-300 font-bold">+{qz.xpReward || 100} XP REWARD</span>
                  </div>

                  <h3 className="text-base font-bold text-white font-outfit">{qz.title}</h3>
                  {qz.course?.title && (
                    <p className="text-xs text-teal-400 font-mono flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Course: {qz.course.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-3 border-t border-white/5">
                  <div className="p-2 rounded bg-white/5 text-center">
                    <span className="text-slate-400 text-[10px] block">Questions</span>
                    <span className="font-bold text-white">{qz.quizQuestions?.length || qz.questionIds?.length || 0}</span>
                  </div>
                  <div className="p-2 rounded bg-white/5 text-center">
                    <span className="text-slate-400 text-[10px] block">Pass Mark</span>
                    <span className="font-bold text-emerald-400">{qz.passMarkPct ?? qz.passMark ?? 70}%</span>
                  </div>
                  <div className="p-2 rounded bg-white/5 text-center">
                    <span className="text-slate-400 text-[10px] block">Time Limit</span>
                    <span className="font-bold text-amber-300">{qz.timeLimitMinutes ?? qz.timeLimit ?? 15} mins</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: QUESTION BANK */}
      {activeTab === 'QUESTIONS' && (
        <div className="glass-panel rounded-2xl border border-teal-500/20 overflow-hidden bg-slate-900/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
              <tr>
                <th className="p-4">Question Text</th>
                <th className="p-4">Skill Tag</th>
                <th className="p-4">Asset Tag</th>
                <th className="p-4">Difficulty</th>
                <th className="p-4">Correct Option</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500 font-mono">
                    Question Bank is empty. Click "Add Question" to populate.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className="hover:bg-white/5 transition">
                    <td className="p-4 font-semibold text-white max-w-xs">{q.question || q.text}</td>
                    <td className="p-4 font-mono">
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                        {q.skillTag || 'Market Structure'}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-teal-400">{q.assetTag || 'BTCUSD'}</td>
                    <td className="p-4 font-mono text-amber-300">{q.difficulty}</td>
                    <td className="p-4 font-mono text-emerald-400 font-bold">
                      Option #{ (q.correctOptionIndex ?? q.correctOption ?? 0) + 1 }: {q.options?.[q.correctOptionIndex ?? q.correctOption ?? 0] || 'Selected'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Question Bank */}
      {questionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Add Question to Question Bank</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Question Prompt</label>
                <input
                  type="text"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. What defines a valid Fair Value Gap (FVG)?"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Skill Tag</label>
                  <input
                    type="text"
                    value={qSkill}
                    onChange={(e) => setQSkill(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Difficulty</label>
                  <select
                    value={qDiff}
                    onChange={(e) => setQDiff(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">4 Options (Select Radio for Correct Choice)</label>
                {qOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctRadio"
                      checked={qCorrectIdx === idx}
                      onChange={() => setQCorrectIdx(idx)}
                      className="accent-teal-500 w-4 h-4"
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...qOptions];
                        copy[idx] = e.target.value;
                        setQOptions(copy);
                      }}
                      placeholder={`Option #${idx + 1}`}
                      className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setQuestionModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveQuestion} className="flex-1 py-2 rounded-xl bg-teal-600 text-xs font-semibold text-white shadow-lg">
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quiz Builder */}
      {quizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 w-full max-w-lg space-y-4 bg-slate-900 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white font-outfit">Configure & Publish Course Quiz</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="e.g. Course Exam: Order Block & FVG Mastery"
                  className="w-full p-2.5 bg-slate-950 border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Associated Course</label>
                <select
                  value={quizCourseId}
                  onChange={(e) => setQuizCourseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-purple-500/20 rounded-xl text-white font-mono"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Pass Mark %</label>
                  <input
                    type="number"
                    value={quizPassMark}
                    onChange={(e) => setQuizPassMark(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-purple-500/20 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Time (mins)</label>
                  <input
                    type="number"
                    value={quizTimeLimit}
                    onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-purple-500/20 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">XP Reward</label>
                  <input
                    type="number"
                    value={quizXpReward}
                    onChange={(e) => setQuizXpReward(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-purple-500/20 rounded-xl text-white font-mono text-purple-300 font-bold"
                  />
                </div>
              </div>

              {/* Question Selection Checklist */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-slate-200 font-semibold block">Select Questions from Question Bank ({selectedQIds.length} selected)</label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-950 border border-purple-500/20">
                  {questions.map((q) => {
                    const isChecked = selectedQIds.includes(q.id);
                    return (
                      <label key={q.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedQIds([...selectedQIds, q.id]);
                            else setSelectedQIds(selectedQIds.filter((id) => id !== q.id));
                          }}
                          className="accent-purple-500 w-4 h-4"
                        />
                        <span className="text-white text-xs line-clamp-1">{q.question || q.text}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setQuizModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveQuiz} className="flex-1 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-lg">
                Publish Quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
