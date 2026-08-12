'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  HelpCircle,
  ArrowRight,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentQotdPage() {
  const [qotd, setQotd] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchQotd = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/v2/instructor/qotd');
      setQotd(data);
    } catch (err: any) {
      toast.error('Failed to load Question of the Day.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQotd();
  }, []);

  const handleSubmitAnswer = async () => {
    if (selectedIdx === null || !qotd) {
      toast.error('Please select an answer option.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<any>(`/api/v2/instructor/qotd/${qotd.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ selectedOptionIndex: selectedIdx }),
      });
      setResult(res);
      setSubmitted(true);
      if (res.isCorrect) {
        toast.success(`Correct! +${res.xpEarned || 50} XP earned! 🎉`);
      } else {
        toast.error('Incorrect. Review the instructor explanation below.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>DAILY TRADING CHALLENGE</span>
          </span>
          <span className="text-xs font-mono text-purple-300 font-bold">+50 XP REWARD</span>
        </div>

        <h1 className="text-xl md:text-2xl font-black text-white font-outfit">{qotd?.title || "Today's Challenge 🧠"}</h1>
        <p className="text-xs text-slate-300 leading-relaxed font-mono">
          Test your market structure analysis daily, earn XP, and read official instructor breakdowns.
        </p>
      </div>

      {!qotd ? (
        <div className="glass-card p-12 text-center text-slate-400 font-mono rounded-2xl border border-white/10">
          No active Question of the Day right now. Check back tomorrow!
        </div>
      ) : (
        <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-5">
          <p className="text-sm font-semibold text-white bg-slate-950/80 p-4 rounded-xl border border-white/5 leading-relaxed">
            {qotd.questionText}
          </p>

          {/* Options List */}
          <div className="space-y-2.5">
            {qotd.options?.map((opt: string, idx: number) => {
              const isSelected = selectedIdx === idx;
              const isCorrectOpt = submitted && result?.correctOptionIndex === idx;
              const isUserWrongOpt = submitted && isSelected && !result?.isCorrect;

              return (
                <button
                  key={idx}
                  disabled={submitted}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full p-4 rounded-xl border text-left text-xs font-mono transition-all flex items-center justify-between ${
                    isCorrectOpt
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold shadow-lg shadow-emerald-500/10'
                      : isUserWrongOpt
                      ? 'bg-red-500/20 border-red-500 text-red-200 font-bold'
                      : isSelected
                      ? 'bg-purple-500/20 border-purple-500 text-white shadow'
                      : 'bg-slate-950/80 border-white/5 text-slate-300 hover:border-purple-500/40 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[11px] ${
                        isSelected ? 'border-purple-400 bg-purple-500/30 text-purple-300' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span>{opt}</span>
                  </div>

                  {isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {isUserWrongOpt && <XCircle className="w-5 h-5 text-red-400" />}
                </button>
              );
            })}
          </div>

          {!submitted ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedIdx === null || submitting}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Submit Answer & Reveal Explanation</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white uppercase tracking-wider">Instructor Explanation</span>
              </div>
              <p className="text-slate-300 font-mono leading-relaxed">{result?.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
