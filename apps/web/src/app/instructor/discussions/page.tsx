'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  MessageSquare,
  CheckCircle2,
  Pin,
  Send,
  User,
  Sparkles,
  Filter,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorDiscussionsPage() {
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSolved, setFilterSolved] = useState<'ALL' | 'UNSOLVED' | 'SOLVED'>('UNSOLVED');

  // Reply Modal State
  const [selectedDisc, setSelectedDisc] = useState<any | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isPinned, setIsPinned] = useState(true);
  const [markSolved, setMarkSolved] = useState(true);

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const isSolvedParam = filterSolved === 'SOLVED' ? 'true' : filterSolved === 'UNSOLVED' ? 'false' : '';
      const data = await apiFetch<any[]>(`/api/v2/instructor/discussions${isSolvedParam ? `?isSolved=${isSolvedParam}` : ''}`);
      setDiscussions(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load community Q&A discussions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, [filterSolved]);

  const handleSendReply = async () => {
    if (!selectedDisc || !replyContent.trim()) {
      toast.error('Please enter a response.');
      return;
    }
    try {
      await apiFetch(`/api/v2/instructor/discussions/${selectedDisc.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          content: replyContent.trim(),
          isPinned,
          markSolved,
        }),
      });
      toast.success('Official Instructor response posted!');
      setReplyContent('');
      setSelectedDisc(null);
      fetchDiscussions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post reply');
    }
  };

  const unsolvedCount = discussions.filter((d) => !d.isSolved).length;

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
            <h2 className="text-xl font-bold text-white font-outfit">Community Q&A & Discussions Hub</h2>
            <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
              {unsolvedCount} UNANSWERED QUESTIONS
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Answer student trading questions, pin official explanations, and mark questions as solved.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-teal-500/20 text-xs">
            <button
              onClick={() => setFilterSolved('UNSOLVED')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterSolved === 'UNSOLVED' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Unanswered ({unsolvedCount})
            </button>
            <button
              onClick={() => setFilterSolved('SOLVED')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterSolved === 'SOLVED' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Solved
            </button>
            <button
              onClick={() => setFilterSolved('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterSolved === 'ALL' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Threads
            </button>
          </div>
        </div>
      </div>

      {/* Threads List */}
      <div className="space-y-4">
        {discussions.length === 0 ? (
          <div className="glass-panel p-12 text-center text-slate-500 font-mono rounded-2xl border border-teal-500/20">
            No Q&A discussion threads matching current filter.
          </div>
        ) : (
          discussions.map((d) => (
            <div
              key={d.id}
              className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4 hover:border-teal-500/40 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold font-mono">
                    {d.user?.profile?.firstName ? d.user.profile.firstName.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-outfit">{d.title}</h3>
                    <p className="text-[11px] font-mono text-slate-400">
                      Posted by{' '}
                      <span className="text-teal-400 font-semibold">
                        {d.user?.profile?.firstName
                          ? `${d.user.profile.firstName} ${d.user.profile.lastName || ''}`
                          : d.user?.email}
                      </span>{' '}
                      • {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold border font-mono ${
                    d.isSolved
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                  }`}
                >
                  {d.isSolved ? 'SOLVED' : 'UNANSWERED'}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-white/5 font-mono">
                "{d.content}"
              </p>

              {/* Existing Responses */}
              {d.responses && d.responses.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                    Replies ({d.responses.length})
                  </span>
                  {d.responses.map((resp: any) => (
                    <div
                      key={resp.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        resp.isInstructorReply
                          ? 'bg-gradient-to-r from-teal-950/40 to-indigo-950/30 border-teal-500/40'
                          : 'bg-slate-950/60 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            {resp.user?.profile?.firstName
                              ? `${resp.user.profile.firstName} ${resp.user.profile.lastName || ''}`
                              : resp.user?.email}
                          </span>
                          {resp.isInstructorReply && (
                            <span className="text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.2 rounded">
                              INSTRUCTOR RESPONSE
                            </span>
                          )}
                        </div>
                        {resp.isPinned && <Pin className="w-3.5 h-3.5 text-teal-400 fill-teal-400" />}
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{resp.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setSelectedDisc(d)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Official Answer</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Modal */}
      {selectedDisc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Post Official Instructor Response</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-300">
              <span className="font-bold text-teal-400 block mb-1">{selectedDisc.title}</span>
              <p className="font-mono text-[11px]">"{selectedDisc.content}"</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Your Explanation & Guidance</label>
                <textarea
                  rows={4}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Provide clear step-by-step trading guidance..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <span>Pin as Official Instructor Answer</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={markSolved}
                    onChange={(e) => setMarkSolved(e.target.checked)}
                    className="accent-teal-500 w-4 h-4"
                  />
                  <span>Mark Thread as Solved</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedDisc(null)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition"
              >
                Post Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
