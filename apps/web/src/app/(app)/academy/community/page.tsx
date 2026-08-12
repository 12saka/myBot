'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  MessageSquare,
  Plus,
  Send,
  Pin,
  CheckCircle2,
  ThumbsUp,
  Search,
  User,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentCommunityPage() {
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Ask Modal
  const [askModal, setAskModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply Modal
  const [selectedDisc, setSelectedDisc] = useState<any | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/v2/instructor/discussions');
      setDiscussions(data || []);
    } catch (err: any) {
      toast.error('Failed to load Q&A community discussions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  const handleAskQuestion = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Question title and content are required.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/v2/instructor/discussions', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
        }),
      });
      toast.success('Question posted to community forum!');
      setAskModal(false);
      setTitle('');
      setContent('');
      fetchDiscussions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post question');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!selectedDisc || !replyContent.trim()) return;
    try {
      await apiFetch(`/api/v2/instructor/discussions/${selectedDisc.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      toast.success('Reply posted!');
      setReplyContent('');
      setSelectedDisc(null);
      fetchDiscussions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reply');
    }
  };

  const filteredDiscussions = discussions.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-outfit">Student Q&A Community Forum</h1>
            <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
              STUDENT COMMUNITY
            </span>
          </div>
          <p className="text-xs text-slate-300 font-mono mt-0.5">Ask trading questions, view pinned official instructor answers, and learn together.</p>
        </div>

        <button
          onClick={() => setAskModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Ask Question</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trading questions or topics..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
        />
      </div>

      {/* Discussions List */}
      <div className="space-y-4">
        {filteredDiscussions.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500 font-mono rounded-2xl border border-white/10">
            No questions posted matching search. Click "Ask Question" to start a discussion.
          </div>
        ) : (
          filteredDiscussions.map((d) => (
            <div key={d.id} className="glass-card p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white font-outfit">{d.title}</h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    Asked by{' '}
                    <span className="text-purple-300">
                      {d.user?.profile?.firstName
                        ? `${d.user.profile.firstName} ${d.user.profile.lastName || ''}`
                        : d.user?.email}
                    </span>{' '}
                    • {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {d.isSolved && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> SOLVED
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-white/5">
                "{d.content}"
              </p>

              {/* Replies */}
              {d.responses && d.responses.length > 0 && (
                <div className="space-y-2 pt-1">
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
                              INSTRUCTOR ANSWER
                            </span>
                          )}
                        </div>
                        {resp.isPinned && <Pin className="w-3.5 h-3.5 text-teal-400 fill-teal-400" />}
                      </div>
                      <p className="text-slate-300 text-[11px] font-mono leading-relaxed">{resp.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedDisc(d)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Send className="w-3.5 h-3.5" /> Reply to Thread
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Ask Question */}
      {askModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-purple-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Ask Trading Question</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Question Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How do I distinguish Liquidity Sweep from Breakout?"
                  className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Details & Chart Context</label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Detail what asset, timeframe, or concept you are analyzing..."
                  className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setAskModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button
                onClick={handleAskQuestion}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-lg shadow-purple-600/20"
              >
                Post Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reply */}
      {selectedDisc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-purple-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Reply to Discussion</h3>
            <p className="text-xs text-slate-300 font-mono bg-slate-950 p-2.5 rounded-xl border border-white/5">
              "{selectedDisc.title}"
            </p>

            <textarea
              rows={3}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your response to the community..."
              className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none"
            />

            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelectedDisc(null)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleReply} className="flex-1 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-lg">
                Post Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
