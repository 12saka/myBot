'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle, Clock, AlertTriangle, CheckCircle2, XCircle,
  Sparkles, Award, ArrowRight, ArrowLeft, RefreshCw, X,
  BrainCircuit, ShieldAlert, BarChart2, Flame
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface QuizQuestion {
  id: string;
  orderIndex: number;
  question: string;
  options: string[];
  difficulty: string;
  skillTag: string;
  assetTag?: string | null;
}

interface QuizDetails {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  timeLimitMinutes: number;
  passMarkPct: number;
  xpReward: number;
  courseTitle?: string;
  courseImageUrl?: string;
  lessonTitle?: string;
  questions: QuizQuestion[];
  recentAttempts?: any[];
}

interface QuestionReview {
  questionId: string;
  question: string;
  options: string[];
  selectedAnswer: string;
  selectedOptionIndex: number | null;
  correctOptionIndex: number;
  correctAnswer: string;
  explanation: string;
  skillTag: string;
  assetTag?: string;
  isCorrect: boolean;
}

interface SubmissionResult {
  score: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  passMarkPct: number;
  passed: boolean;
  timeSpentSeconds: number;
  xpEarned: number;
  aiInsight: string;
  skillBreakdown: Record<string, number>;
  questionReview: QuestionReview[];
}

interface QuizModalProps {
  quizId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: (result: SubmissionResult) => void;
}

export function QuizModal({ quizId, isOpen, onClose, onCompleted }: QuizModalProps) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<QuizDetails | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // Strict Timer State
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  // Fetch Quiz Data
  useEffect(() => {
    if (!isOpen || !quizId) {
      setQuiz(null);
      setResult(null);
      setAnswers({});
      setCurrentIdx(0);
      setTimerActive(false);
      return;
    }

    const loadQuiz = async () => {
      setLoading(true);
      setResult(null);
      setAnswers({});
      setCurrentIdx(0);
      try {
        const data = await apiFetch<QuizDetails>(`/api/v2/academy/quizzes/${quizId}`);
        setQuiz(data);
        const totalSeconds = (data.timeLimitMinutes || 15) * 60;
        setTimeLeftSeconds(totalSeconds);
        startTimeRef.current = Date.now();
        setTimerActive(true);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load quiz');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [isOpen, quizId]);

  // Strict Timer Countdown
  useEffect(() => {
    if (!timerActive || !quiz || result) return;

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          toast.error('⏰ Time is up! Auto-submitting assessment under strict time enforcement.');
          handleStrictSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, quiz, result, answers]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleStrictSubmit = async (isAuto = false) => {
    if (!quiz) return;

    const answeredCount = Object.keys(answers).length;
    const totalCount = quiz.questions.length;

    if (!isAuto && answeredCount < totalCount) {
      const confirmIncomplete = window.confirm(
        `Strict Warning: You have only answered ${answeredCount} of ${totalCount} questions. Unanswered questions will receive 0 points. Do you want to submit anyway?`
      );
      if (!confirmIncomplete) return;
    }

    setSubmitting(true);
    const timeSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    try {
      const res = await apiFetch<SubmissionResult>(`/api/v2/academy/quizzes/${quiz.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          timeSpentSeconds: timeSpent,
        }),
      });

      setResult(res);
      setTimerActive(false);
      if (res.passed) {
        toast.success(`🎉 Passed with ${res.score}%! (+${res.xpEarned} XP)`);
      } else {
        toast.error(`Strict Requirement Not Met: ${res.score}%. Minimum ${res.passMarkPct}% required to pass.`);
      }
      if (onCompleted) onCompleted(res);
    } catch (err: any) {
      toast.error(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    if (!quiz) return;
    setResult(null);
    setAnswers({});
    setCurrentIdx(0);
    setTimeLeftSeconds((quiz.timeLimitMinutes || 15) * 60);
    startTimeRef.current = Date.now();
    setTimerActive(true);
  };

  if (!isOpen) return null;

  const currentQuestion = quiz?.questions[currentIdx];
  const isTimeLow = timeLeftSeconds < 120; // Under 2 minutes
  const totalQuestions = quiz?.questions.length || 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-3xl glass-card rounded-2xl border border-white/10 p-6 md:p-8 bg-slate-950/95 shadow-2xl space-y-6 my-8"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-white/5 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <HelpCircle size={16} />
              </span>
              <Badge variant="purple" size="xs">{quiz?.difficulty || 'STRICT'}</Badge>
              {quiz?.passMarkPct && (
                <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Strict Pass: {quiz.passMarkPct}%
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white font-display">{quiz?.title || 'Academy Assessment'}</h2>
            {quiz?.courseTitle && (
              <p className="text-xs text-slate-400">Curriculum: {quiz.courseTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Live Strict Countdown Timer */}
            {!result && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all",
                  isTimeLow
                    ? "bg-red-500/20 border-red-500/50 text-red-300 animate-pulse"
                    : "bg-white/5 border-white/10 text-slate-200"
                )}
              >
                <Clock size={14} className={isTimeLow ? "text-red-400" : "text-purple-400"} />
                <span>{formatTimer(timeLeftSeconds)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-purple-400 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">Preparing Strict Assessment Environment...</p>
          </div>
        )}

        {/* Active Quiz Question Runner */}
        {!loading && quiz && !result && currentQuestion && (
          <div className="space-y-6">
            {/* Question Progress & Navigation Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Question {currentIdx + 1} of {totalQuestions}</span>
                <span className="font-semibold text-purple-300">{answeredCount} of {totalQuestions} answered</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Question quick selector pills */}
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                {quiz.questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isCurrent = currentIdx === idx;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center border",
                        isCurrent
                          ? "bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/30"
                          : isAnswered
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                          : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Question Card */}
            <div className="p-5 rounded-2xl bg-white/2 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="blue" size="xs">{currentQuestion.skillTag}</Badge>
                {currentQuestion.assetTag && (
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    Pair: {currentQuestion.assetTag}
                  </span>
                )}
              </div>

              <h3 className="text-sm md:text-base font-semibold text-slate-100 leading-relaxed">
                {currentIdx + 1}. {currentQuestion.question}
              </h3>

              {/* Options */}
              <div className="space-y-2.5 pt-2">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = answers[currentQuestion.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(currentQuestion.id, optIdx)}
                      className={cn(
                        "w-full p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-start gap-3",
                        isSelected
                          ? "bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10"
                          : "bg-white/2 border-white/5 text-slate-300 hover:border-white/20 hover:bg-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border",
                          isSelected
                            ? "bg-purple-500 border-purple-400 text-white"
                            : "bg-white/5 border-white/10 text-slate-400"
                        )}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="leading-relaxed flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="btn-ghost text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
              >
                <ArrowLeft size={14} /> Previous
              </button>

              <div className="flex items-center gap-3">
                {currentIdx < totalQuestions - 1 ? (
                  <button
                    onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="btn-primary text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStrictSubmit(false)}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Submit for Strict Grading
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Screen */}
        {!loading && result && (
          <div className="space-y-6">
            {/* Header Performance Banner */}
            <div
              className={cn(
                "p-6 rounded-2xl border text-center space-y-3",
                result.passed
                  ? "bg-emerald-950/20 border-emerald-500/30"
                  : "bg-red-950/20 border-red-500/30"
              )}
            >
              <div className="inline-flex p-3 rounded-2xl bg-white/5 border border-white/10 mx-auto">
                {result.passed ? (
                  <CheckCircle2 size={36} className="text-emerald-400" />
                ) : (
                  <ShieldAlert size={36} className="text-red-400" />
                )}
              </div>

              <h3 className="text-xl font-bold font-display text-white">
                {result.passed ? 'Assessment Passed! Mastery Verified' : 'Strict Passing Mark Not Achieved'}
              </h3>

              <div className="flex justify-center items-center gap-4 text-xs font-semibold">
                <span className="text-slate-300">Score: <strong className="text-white text-sm">{result.score}%</strong></span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Required: <strong className="text-amber-400">{result.passMarkPct}%</strong></span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Correct: <strong className="text-emerald-400">{result.correctCount} / {result.totalQuestions}</strong></span>
                {result.passed && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-purple-300 flex items-center gap-1 font-bold">
                      <Award size={13} /> +{result.xpEarned} XP
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* AI Learning Diagnostic */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold">
                <BrainCircuit size={16} />
                <span>AI Trading Diagnostic & Coaching</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{result.aiInsight}</p>
            </div>

            {/* Skill Radar / Breakdown */}
            {result.skillBreakdown && Object.keys(result.skillBreakdown).length > 0 && (
              <div className="space-y-3 p-4 rounded-xl glass-card border border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-purple-400" />
                  Skill Competency Breakdown
                </h4>
                <div className="space-y-2.5">
                  {Object.entries(result.skillBreakdown).map(([skill, pct]) => (
                    <div key={skill} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{skill}</span>
                        <span className={cn("font-bold", pct >= 75 ? "text-emerald-400" : "text-amber-400")}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all duration-500", pct >= 75 ? "bg-emerald-500" : "bg-amber-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Question Review Accordion */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Question-by-Question Audit</h4>
              {result.questionReview.map((q, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3.5 rounded-xl border space-y-2 text-xs",
                    q.isCorrect
                      ? "bg-emerald-950/10 border-emerald-500/20"
                      : "bg-red-950/10 border-red-500/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-200">{idx + 1}. {q.question}</p>
                    {q.isCorrect ? (
                      <span className="text-emerald-400 flex items-center gap-1 shrink-0 font-bold text-[10px]">
                        <CheckCircle2 size={12} /> Correct
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 shrink-0 font-bold text-[10px]">
                        <XCircle size={12} /> Incorrect
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 rounded bg-white/2 border border-white/5">
                      <span className="text-slate-500 block text-[10px]">Your Answer</span>
                      <span className={q.isCorrect ? "text-emerald-300 font-medium" : "text-red-300 font-medium"}>
                        {q.selectedAnswer}
                      </span>
                    </div>
                    {!q.isCorrect && (
                      <div className="p-2 rounded bg-white/2 border border-emerald-500/20">
                        <span className="text-slate-500 block text-[10px]">Correct Answer</span>
                        <span className="text-emerald-300 font-medium">{q.correctAnswer}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 italic bg-white/2 p-2 rounded border border-white/5">
                    💡 <strong>Explanation:</strong> {q.explanation}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleRetake}
                className="btn-ghost text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={12} /> Retake Assessment
              </button>

              <button
                onClick={onClose}
                className="btn-primary text-xs px-6 py-2.5 rounded-xl cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
