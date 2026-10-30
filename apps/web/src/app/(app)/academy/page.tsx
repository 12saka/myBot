'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Award,
  GraduationCap,
  Video,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Flame,
  Zap,
  FileText,
  FileCheck2,
  MessageSquare,
  ExternalLink,
  ListChecks,
  Send,
  Loader2,
  Sparkles,
  Pin,
  Plus,
  Layers,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { QuizModal } from '@/components/academy/QuizModal';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type MainTab = 'ALL' | 'COURSES' | 'NOTES' | 'ASSIGNMENTS' | 'QUIZZES' | 'COMMUNITY';

interface CourseItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category?: string;
  imageUrl?: string | null;
  instructorName?: string;
  totalLessons: number;
  totalAssignments?: number;
  completedLessons: number;
  progressPercent: number;
  hasCertificate: boolean;
}

interface QuizItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  timeLimitMinutes: number;
  passMarkPct: number;
  xpReward: number;
  questionCount: number;
  courseTitle?: string;
  courseImageUrl?: string;
  lessonTitle?: string;
  skillTags: string[];
  userAttempt?: {
    score: number;
    percentage: number;
    passed: boolean;
    completedAt: string;
  } | null;
}

interface LiveSession {
  id: string;
  title: string;
  description?: string;
  instructor: string;
  startTime: string;
  durationMinutes: number;
  registeredCount: number;
  category: string;
  joinUrl?: string;
  meetingUrl?: string;
  recordingUrl?: string;
  zoomMeetingId?: string;
  passcode?: string;
}

interface UserProgress {
  totalCourses: number;
  totalLessons: number;
  completedLessons: number;
  certificatesEarned: number;
  progressPercent: number;
}

function parseAssignmentBrief(raw: string = '') {
  if (!raw.includes('### ')) {
    return { summary: raw.trim(), deliverables: [] as string[], gradingCriteria: '', referenceUrl: '' };
  }
  const sections = raw.split(/###\s+/);
  const summary = (sections[0] || '').trim();
  let deliverables: string[] = [];
  let gradingCriteria = '';
  let referenceUrl = '';

  for (let i = 1; i < sections.length; i++) {
    const lines = sections[i].split('\n');
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
  return { summary, deliverables, gradingCriteria, referenceUrl };
}

export default function AcademyPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('ALL');

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [studyNotes, setStudyNotes] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [qotd, setQotd] = useState<any | null>(null);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    totalCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    certificatesEarned: 0,
    progressPercent: 0,
  });

  // QOTD Interactive State
  const [qotdSelectedIdx, setQotdSelectedIdx] = useState<number | null>(null);
  const [qotdSubmitted, setQotdSubmitted] = useState(false);
  const [qotdResult, setQotdResult] = useState<any | null>(null);
  const [qotdSubmitting, setQotdSubmitting] = useState(false);

  // Homework Submission Drafts
  const [homeworkDrafts, setHomeworkDrafts] = useState<Record<string, { text: string; link: string }>>({});
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);

  // Community Q&A Inline State
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askTitle, setAskTitle] = useState('');
  const [askContent, setAskContent] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  // Quiz Modal State
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const [activeLevel, setActiveLevel] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [search, setSearch] = useState('');

  const fetchAcademyData = async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      const [
        coursesRes,
        progressRes,
        liveRes,
        quizzesRes,
        notesRes,
        assignRes,
        qotdRes,
        discRes,
      ] = await Promise.allSettled([
        apiFetch<CourseItem[]>('/api/v2/academy/courses'),
        apiFetch<UserProgress>('/api/v2/academy/progress'),
        apiFetch<LiveSession[]>('/api/v2/academy/live-sessions'),
        apiFetch<QuizItem[]>('/api/v2/academy/quizzes'),
        apiFetch<any[]>('/api/v2/academy/notes'),
        apiFetch<any[]>('/api/v2/academy/assignments'),
        apiFetch<any>('/api/v2/academy/qotd/today'),
        apiFetch<any[]>('/api/v2/academy/community/discussions'),
      ]);

      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)) {
        setCourses(coursesRes.value);
      }

      if (progressRes.status === 'fulfilled' && progressRes.value) {
        setProgress(progressRes.value);
      }

      if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value)) {
        setLiveSessions(liveRes.value);
      }

      if (quizzesRes.status === 'fulfilled' && Array.isArray(quizzesRes.value)) {
        setQuizzes(quizzesRes.value);
      }

      if (notesRes.status === 'fulfilled' && Array.isArray(notesRes.value)) {
        setStudyNotes(notesRes.value);
      }

      if (assignRes.status === 'fulfilled' && Array.isArray(assignRes.value)) {
        const list = assignRes.value;
        setAssignments(list);
        const drafts: Record<string, { text: string; link: string }> = {};
        list.forEach((a: any) => {
          drafts[a.id] = {
            text: a.userSubmission?.submissionText || '',
            link: a.userSubmission?.linkUrl || '',
          };
        });
        setHomeworkDrafts(drafts);
      }

      if (qotdRes.status === 'fulfilled') {
        setQotd(qotdRes.value || null);
      }

      if (discRes.status === 'fulfilled' && Array.isArray(discRes.value)) {
        setDiscussions(discRes.value);
      }

      setLoadState('ready');
    } catch (err: any) {
      console.warn('[Academy] API load notice:', err);
      setErrorMessage(err.message || 'Cannot reach API Gateway');
      setLoadState('error');
    }
  };

  useEffect(() => {
    fetchAcademyData();
  }, []);

  const filteredCourses = courses.filter((course) => {
    const matchLevel = activeLevel === 'All' || course.difficulty.toLowerCase() === activeLevel.toLowerCase();
    const matchSearch =
      course.title.toLowerCase().includes(search.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(search.toLowerCase()));
    return matchLevel && matchSearch;
  });

  const filteredNotes = studyNotes.filter((note) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      note.title?.toLowerCase().includes(q) ||
      note.content?.toLowerCase().includes(q) ||
      note.courseTitle?.toLowerCase().includes(q) ||
      note.type?.toLowerCase().includes(q)
    );
  });

  const filteredAssignments = assignments.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.instructions?.toLowerCase().includes(q) ||
      a.courseTitle?.toLowerCase().includes(q)
    );
  });

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchLevel = activeLevel === 'All' || quiz.difficulty.toLowerCase() === activeLevel.toLowerCase();
    const matchSearch =
      quiz.title.toLowerCase().includes(search.toLowerCase()) ||
      (quiz.description && quiz.description.toLowerCase().includes(search.toLowerCase()));
    return matchLevel && matchSearch;
  });

  const filteredDiscussions = discussions.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q);
  });

  const handleRegisterLive = async (session: LiveSession) => {
    const toastId = toast.loading(`Registering for "${session.title}"...`);
    try {
      await apiFetch(`/api/v2/academy/live-sessions/${session.id}/register`, { method: 'POST' });
      toast.success(`Successfully registered for ${session.title}!`, { id: toastId });
      fetchAcademyData();
    } catch (err: any) {
      toast.error(err.message || `Failed to register for live webinar "${session.title}".`, { id: toastId });
    }
  };

  const handleStartQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setIsQuizModalOpen(true);
  };

  const handleAnswerQotd = async () => {
    if (qotdSelectedIdx === null || !qotd) {
      toast.error('Please select an answer option first.');
      return;
    }
    setQotdSubmitting(true);
    try {
      const res = await apiFetch<any>(`/api/v2/academy/qotd/${qotd.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ selectedOptionIndex: qotdSelectedIdx }),
      });
      setQotdResult(res);
      setQotdSubmitted(true);
      if (res.isCorrect) {
        toast.success(`Correct! +${res.xpEarned || 25} XP earned! 🎉`);
      } else {
        toast.error('Incorrect. Review the instructor explanation below.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit answer');
    } finally {
      setQotdSubmitting(false);
    }
  };

  const updateHomeworkDraft = (assignmentId: string, field: 'text' | 'link', value: string) => {
    setHomeworkDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        text: prev[assignmentId]?.text || '',
        link: prev[assignmentId]?.link || '',
        [field]: value,
      },
    }));
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    const draft = homeworkDrafts[assignmentId] || { text: '', link: '' };
    if (!draft.text.trim() && !draft.link.trim()) {
      toast.error('Please enter your written analysis or paste your chart link.');
      return;
    }
    setSubmittingAssignmentId(assignmentId);
    try {
      await apiFetch(`/api/v2/academy/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          submissionText: draft.text.trim(),
          linkUrl: draft.link.trim() || undefined,
        }),
      });
      toast.success('Assignment submitted! Your instructor has been notified.');
      await fetchAcademyData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit assignment');
    } finally {
      setSubmittingAssignmentId(null);
    }
  };

  const handleAskQuestion = async () => {
    if (!askTitle.trim() || !askContent.trim()) {
      toast.error('Please enter both a question title and details.');
      return;
    }
    setAskingQuestion(true);
    try {
      await apiFetch('/api/v2/academy/community/discussions', {
        method: 'POST',
        body: JSON.stringify({
          title: askTitle.trim(),
          content: askContent.trim(),
        }),
      });
      toast.success('Question published! Instructors have been notified.');
      setAskModalOpen(false);
      setAskTitle('');
      setAskContent('');
      await fetchAcademyData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish question');
    } finally {
      setAskingQuestion(false);
    }
  };

  const handleReplyDiscussion = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setPostingReply(true);
    try {
      await apiFetch(`/api/v2/academy/community/discussions/${replyTarget.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
      });
      toast.success('Reply published!');
      setReplyText('');
      setReplyTarget(null);
      await fetchAcademyData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to post reply');
    } finally {
      setPostingReply(false);
    }
  };

  const pendingAssignmentsCount = assignments.filter((a) => !a.userSubmission).length;
  const totalPublishedCount =
    courses.length +
    studyNotes.length +
    assignments.length +
    quizzes.length +
    liveSessions.length +
    discussions.length +
    (qotd ? 1 : 0);

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Academy LMS & Mastery Hub"
        subtitle="All published instructor courses, study notes, market breakdowns, homework assignments, quizzes, daily challenges, and live webinars in one unified hub."
        icon={BookOpen}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAskModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus size={14} className="text-purple-400" />
            <span>Ask Instructor a Question</span>
          </button>
          <button
            onClick={() => router.push('/academy/qotd')}
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Flame size={14} className="text-amber-400" />
            <span>Daily Challenge (+25 XP)</span>
          </button>
        </div>
      </PageHeader>

      {/* Unified Tab Switcher */}
      <div className="flex flex-wrap border-b border-white/10 pb-2 gap-2 sm:gap-4">
        <button
          onClick={() => setMainTab('ALL')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'ALL'
              ? 'border-emerald-400 text-emerald-300'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <Layers size={15} /> All Published ({totalPublishedCount})
        </button>

        <button
          onClick={() => setMainTab('COURSES')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'COURSES'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <GraduationCap size={15} /> Courses ({courses.length})
        </button>

        <button
          onClick={() => setMainTab('NOTES')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'NOTES'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <FileText size={15} /> Study Notes & Breakdowns ({studyNotes.length})
        </button>

        <button
          onClick={() => setMainTab('ASSIGNMENTS')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'ASSIGNMENTS'
              ? 'border-indigo-400 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <FileCheck2 size={15} />
          <span>Assignments ({assignments.length})</span>
          {pendingAssignmentsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold">
              {pendingAssignmentsCount} New
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('QUIZZES')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'QUIZZES'
              ? 'border-purple-500 text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <HelpCircle size={15} /> Quizzes ({quizzes.length})
        </button>

        <button
          onClick={() => setMainTab('COMMUNITY')}
          className={cn(
            'flex items-center gap-2 pb-2 px-2.5 text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer',
            mainTab === 'COMMUNITY'
              ? 'border-pink-400 text-pink-300'
              : 'border-transparent text-slate-400 hover:text-white'
          )}
        >
          <MessageSquare size={15} /> Q&A Forum ({discussions.length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-8">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {(mainTab === 'ALL' || mainTab === 'COURSES' || mainTab === 'QUIZZES') ? (
              <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
                {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setActiveLevel(lvl)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer',
                      activeLevel === lvl ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-400" />
                <span>
                  {mainTab === 'NOTES'
                    ? 'Official instructor study notes, course lesson notes & chart breakdowns'
                    : mainTab === 'ASSIGNMENTS'
                    ? 'Submit practical chart markups for instructor grading & XP rewards'
                    : 'Ask instructors questions & review pinned answers'}
                </span>
              </div>
            )}

            <div className="relative flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search all published content..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-glass pl-8 pr-4 py-2 rounded-xl text-xs w-full sm:w-52 md:w-64"
                />
              </div>
              <button
                onClick={fetchAcademyData}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh Published Content"
              >
                <RefreshCw size={14} className={cn(loadState === 'loading' && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loadState === 'loading' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-5 h-56 animate-pulse flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                    <div className="h-6 bg-white/10 rounded w-3/4" />
                    <div className="h-10 bg-white/5 rounded w-full" />
                  </div>
                  <div className="h-8 bg-white/10 rounded w-full" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {loadState === 'error' && (
            <div className="glass-card rounded-2xl p-8 border border-red-500/20 bg-red-950/10 text-center space-y-3">
              <AlertTriangle size={32} className="text-red-400 mx-auto" />
              <h3 className="font-bold text-white text-base">Cannot Reach Gateway API</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">{errorMessage}</p>
              <button
                onClick={fetchAcademyData}
                className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Retry Connection
              </button>
            </div>
          )}

          {/* SECTION 0: PUBLISHED QUESTION OF THE DAY (Visible on ALL tab) */}
          {loadState === 'ready' && mainTab === 'ALL' && qotd && (
            <div className="glass-card p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-950/80 to-purple-950/20 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>QUESTION OF THE DAY • PUBLISHED BY INSTRUCTOR</span>
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">+25 XP REWARD</span>
              </div>

              <h3 className="text-base font-bold text-white font-outfit">
                {qotd.title || "Today's Institutional Trading Challenge"}
              </h3>
              <p className="text-xs text-slate-200 bg-slate-900/80 p-3.5 rounded-xl border border-white/5 leading-relaxed">
                {qotd.questionText}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {qotd.options?.map((opt: string, idx: number) => {
                  const isSelected = qotdSelectedIdx === idx;
                  const isCorrectOpt = qotdSubmitted && qotdResult?.correctOptionIndex === idx;
                  const isUserWrongOpt = qotdSubmitted && isSelected && !qotdResult?.isCorrect;

                  return (
                    <button
                      key={idx}
                      disabled={qotdSubmitted}
                      onClick={() => setQotdSelectedIdx(idx)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border text-xs font-mono transition flex items-center justify-between gap-2 cursor-pointer',
                        isCorrectOpt
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200 font-bold'
                          : isUserWrongOpt
                          ? 'bg-red-950/40 border-red-500 text-red-200'
                          : isSelected
                          ? 'bg-purple-600/25 border-purple-500 text-white font-bold'
                          : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25'
                      )}
                    >
                      <span>
                        <strong className="mr-1.5 text-purple-400">{String.fromCharCode(65 + idx)}.</strong>
                        {opt}
                      </span>
                      {isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      {isUserWrongOpt && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {!qotdSubmitted ? (
                <div className="flex justify-end">
                  <button
                    onClick={handleAnswerQotd}
                    disabled={qotdSubmitting || qotdSelectedIdx === null}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {qotdSubmitting ? 'Checking Answer...' : 'Submit Daily Challenge Answer'}
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    'p-4 rounded-xl border space-y-1.5 text-xs',
                    qotdResult?.isCorrect
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                  )}
                >
                  <div className="font-bold">
                    {qotdResult?.isCorrect
                      ? `🎉 Correct! +${qotdResult?.xpEarned || 25} XP Credited`
                      : '💡 Official Instructor Explanation'}
                  </div>
                  <p className="text-slate-300 font-mono leading-relaxed">
                    {qotdResult?.explanation || 'Review the institutional structure concept above.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SECTION 1: COURSES & MODULES */}
          {loadState === 'ready' && (mainTab === 'ALL' || mainTab === 'COURSES') && (
            <div className="space-y-4">
              {mainTab === 'ALL' && (
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <GraduationCap size={18} className="text-purple-400" />
                    <span>Published Courses & Modules ({filteredCourses.length})</span>
                  </h2>
                  {filteredCourses.length > 0 && (
                    <button
                      onClick={() => setMainTab('COURSES')}
                      className="text-xs text-purple-400 hover:underline font-mono cursor-pointer"
                    >
                      Focus Courses →
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredCourses.length === 0 ? (
                  <div className="col-span-full glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2">
                    <GraduationCap size={28} className="mx-auto text-purple-400 opacity-60" />
                    <p className="text-xs font-semibold text-white">No courses match your current filter</p>
                  </div>
                ) : (
                  filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/5 hover:border-purple-500/30 transition-all duration-300"
                    >
                      <div className="relative h-36 w-full bg-slate-800/80 overflow-hidden">
                        {course.imageUrl ? (
                          <img
                            src={course.imageUrl}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900/40 via-slate-900 to-indigo-900/40 flex items-center justify-center">
                            <GraduationCap className="w-12 h-12 text-purple-400/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                          <Badge
                            variant={
                              course.difficulty === 'Beginner'
                                ? 'blue'
                                : course.difficulty === 'Intermediate'
                                ? 'purple'
                                : 'amber'
                            }
                            size="xs"
                          >
                            {course.difficulty}
                          </Badge>
                          {course.hasCertificate && <Badge variant="buy" size="xs">Certified</Badge>}
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-slate-200 text-sm mb-1">{course.title}</h3>
                          {course.instructorName && (
                            <p className="text-[10px] font-mono text-teal-400 mb-2">
                              By {course.instructorName}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                            {course.description}
                          </p>
                          <div className="flex flex-wrap gap-3 text-[10px] text-slate-400 mt-2">
                            <span className="flex items-center gap-1">
                              <GraduationCap size={12} className="text-purple-400" /> {course.totalLessons} Lessons & Notes
                            </span>
                            {typeof course.totalAssignments === 'number' && course.totalAssignments > 0 && (
                              <span className="flex items-center gap-1 text-indigo-300">
                                <FileCheck2 size={12} /> {course.totalAssignments} Assignments
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-purple-400 font-bold">
                              <Award size={12} /> {course.progressPercent}% Complete
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/academy/courses/${course.id}`)}
                          className="w-full btn-ghost py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-purple-500 hover:text-white hover:border-purple-600 transition-all mt-4 cursor-pointer"
                        >
                          {course.completedLessons > 0 ? 'Continue Course & Notes' : 'Open Course & Study Notes'}{' '}
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: STUDY NOTES, LESSON NOTES & MARKET BRIEFS */}
          {loadState === 'ready' && (mainTab === 'ALL' || mainTab === 'NOTES') && (
            <div className="space-y-4">
              {mainTab === 'ALL' && (
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <FileText size={18} className="text-teal-400" />
                    <span>Published Study Notes, Lesson Notes & Market Breakdowns ({filteredNotes.length})</span>
                  </h2>
                  {filteredNotes.length > 0 && (
                    <button
                      onClick={() => setMainTab('NOTES')}
                      className="text-xs text-teal-400 hover:underline font-mono cursor-pointer"
                    >
                      Focus Study Notes →
                    </button>
                  )}
                </div>
              )}

              {filteredNotes.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-white/5">
                  <FileText size={28} className="mx-auto text-teal-400 opacity-70" />
                  <p className="text-xs font-semibold text-white">No Study Notes Published Yet</p>
                  <p className="text-[11px] text-slate-500">
                    When instructors publish course lesson notes, study notes, chart breakdowns, or session recaps, they appear right here.
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const [bodyPart, takeawaysPart] = (note.content || '').split(/###\s+Key Takeaways/i);
                  const takeaways = takeawaysPart
                    ? takeawaysPart
                        .split('\n')
                        .map((l: string) => l.replace(/^[-*•]\s*/, '').trim())
                        .filter(Boolean)
                    : [];

                  return (
                    <div
                      key={note.id}
                      className="glass-card p-6 rounded-2xl border border-teal-500/20 bg-slate-950/70 space-y-4 hover:border-teal-500/40 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                            {(note.type || 'STUDY_NOTE').replace(/_/g, ' ')}
                          </span>
                          {note.courseTitle && (
                            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              📚 {note.courseTitle}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 font-mono">
                            By <strong className="text-slate-200">{note.instructorName || 'Lead Instructor'}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {note.publishedAt ? new Date(note.publishedAt).toLocaleString() : ''}
                        </span>
                      </div>

                      <h3 className="text-base md:text-lg font-bold text-white font-outfit">{note.title}</h3>

                      <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-900/70 p-4 rounded-xl border border-white/5">
                        {(bodyPart || '').trim()}
                      </div>

                      {takeaways.length > 0 && (
                        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold flex items-center gap-1.5">
                            <ListChecks className="w-3.5 h-3.5" /> Key Institutional Takeaways
                          </span>
                          <ul className="space-y-1.5">
                            {takeaways.map((t: string, idx: number) => (
                              <li key={idx} className="text-xs text-slate-100 flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                        {note.videoUrl && (
                          <a
                            href={note.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                          >
                            <Video size={13} /> Watch Lesson Video
                          </a>
                        )}
                        {note.chartUrl && (
                          <a
                            href={note.chartUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                          >
                            <ExternalLink size={13} /> Open TradingView Chart Breakdown
                          </a>
                        )}
                        {note.courseId && (
                          <button
                            onClick={() => router.push(`/academy/courses/${note.courseId}`)}
                            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <BookOpen size={13} /> Open Full Course
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SECTION 3: ASSIGNMENTS & HOMEWORK */}
          {loadState === 'ready' && (mainTab === 'ALL' || mainTab === 'ASSIGNMENTS') && (
            <div className="space-y-5">
              {mainTab === 'ALL' && (
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <FileCheck2 size={18} className="text-indigo-400" />
                    <span>Published Assignments & Homework ({filteredAssignments.length})</span>
                  </h2>
                  {filteredAssignments.length > 0 && (
                    <button
                      onClick={() => setMainTab('ASSIGNMENTS')}
                      className="text-xs text-indigo-400 hover:underline font-mono cursor-pointer"
                    >
                      Focus Assignments →
                    </button>
                  )}
                </div>
              )}

              {filteredAssignments.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-white/5">
                  <FileCheck2 size={28} className="mx-auto text-indigo-400 opacity-70" />
                  <p className="text-xs font-semibold text-white">No Assignments Published Yet</p>
                  <p className="text-[11px] text-slate-500">
                    Practical trading homework published by instructors appears here for submission and grading.
                  </p>
                </div>
              ) : (
                filteredAssignments.map((assignment) => {
                  const brief = parseAssignmentBrief(assignment.instructions || '');
                  const sub = assignment.userSubmission;
                  const draft = homeworkDrafts[assignment.id] || { text: '', link: '' };
                  const isBusy = submittingAssignmentId === assignment.id;

                  return (
                    <div
                      key={assignment.id}
                      className="glass-card p-6 rounded-2xl border border-indigo-500/25 bg-slate-950/75 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                              {assignment.courseTitle}
                            </span>
                            {assignment.lessonTitle && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                {assignment.lessonTitle}
                              </span>
                            )}
                            {sub?.status === 'GRADED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✓ GRADED ({sub.score}/{assignment.maxScore} PTS)
                              </span>
                            )}
                            {sub?.status === 'SUBMITTED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⏳ PENDING INSTRUCTOR REVIEW
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-white font-outfit pt-1">{assignment.title}</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="blue" size="xs">Max: {assignment.maxScore} pts</Badge>
                          <Badge variant="purple" size="xs">+{assignment.xpReward} XP</Badge>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{brief.summary}</p>

                      {brief.deliverables.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                            <ListChecks className="w-3.5 h-3.5" /> Required Deliverables Checklist
                          </span>
                          <ul className="space-y-1">
                            {brief.deliverables.map((d, i) => (
                              <li key={i} className="text-xs text-slate-200 flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(brief.gradingCriteria || brief.referenceUrl) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          {brief.gradingCriteria && (
                            <span>
                              <strong className="text-slate-200">Grading Criteria:</strong> {brief.gradingCriteria}
                            </span>
                          )}
                          {brief.referenceUrl && (
                            <a
                              href={brief.referenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-400 hover:underline font-mono flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Open Reference Chart
                            </a>
                          )}
                        </div>
                      )}

                      {sub?.status === 'GRADED' && (
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <Award className="w-4 h-4" /> Official Instructor Grade & Feedback
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              {sub.score} / {assignment.maxScore} pts (+{assignment.xpReward} XP)
                            </span>
                          </div>
                          {sub.feedback && (
                            <p className="text-xs text-slate-200 font-mono leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-white/5">
                              "{sub.feedback}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inline Submission Form */}
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-200">
                            {sub ? 'Update Your Homework Submission' : 'Submit Your Completed Work'}
                          </h4>
                          {assignment.dueDate && (
                            <span className="text-[11px] font-mono text-slate-400">
                              Due: {new Date(assignment.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <textarea
                          value={draft.text}
                          onChange={(e) => updateHomeworkDraft(assignment.id, 'text', e.target.value)}
                          placeholder="Write your market structure analysis, HTF bias, entry/SL/TP levels, and trade rationale..."
                          rows={3}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                        />

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex-1 flex items-center bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-teal-500">
                            <ExternalLink className="w-4 h-4 text-teal-400 mr-2 shrink-0" />
                            <input
                              type="url"
                              value={draft.link}
                              onChange={(e) => updateHomeworkDraft(assignment.id, 'link', e.target.value)}
                              placeholder="Paste TradingView chart snapshot URL or Google Doc link..."
                              className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono"
                            />
                          </div>
                          <button
                            onClick={() => handleSubmitAssignment(assignment.id)}
                            disabled={isBusy}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20"
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            <span>{sub ? 'Resubmit Work' : 'Submit Homework'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SECTION 4: QUIZZES & STRICT ASSESSMENTS */}
          {loadState === 'ready' && (mainTab === 'ALL' || mainTab === 'QUIZZES') && (
            <div className="space-y-4">
              {mainTab === 'ALL' && (
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <HelpCircle size={18} className="text-purple-400" />
                    <span>Published Quizzes & Certification Assessments ({filteredQuizzes.length})</span>
                  </h2>
                  {filteredQuizzes.length > 0 && (
                    <button
                      onClick={() => setMainTab('QUIZZES')}
                      className="text-xs text-purple-400 hover:underline font-mono cursor-pointer"
                    >
                      Focus Quizzes →
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredQuizzes.length === 0 ? (
                  <div className="col-span-2 glass-card rounded-2xl p-8 border border-white/5 text-center space-y-2">
                    <HelpCircle size={28} className="text-slate-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">No quizzes match your filter criteria.</p>
                  </div>
                ) : (
                  filteredQuizzes.map((quiz) => {
                    const isPassed = quiz.userAttempt?.passed;
                    const hasAttempt = Boolean(quiz.userAttempt);

                    return (
                      <div
                        key={quiz.id}
                        className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/5 hover:border-purple-500/30 transition-all duration-300 p-5 space-y-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={
                                  quiz.difficulty === 'BEGINNER'
                                    ? 'blue'
                                    : quiz.difficulty === 'INTERMEDIATE'
                                    ? 'purple'
                                    : 'amber'
                                }
                                size="xs"
                              >
                                {quiz.difficulty}
                              </Badge>
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Pass: {quiz.passMarkPct}%
                              </span>
                            </div>

                            {hasAttempt && (
                              <span
                                className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1',
                                  isPassed
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                )}
                              >
                                {isPassed ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                {isPassed
                                  ? `Passed (${quiz.userAttempt?.score}%)`
                                  : `Retake Needed (${quiz.userAttempt?.score}%)`}
                              </span>
                            )}
                          </div>

                          <div>
                            <h3 className="font-bold text-slate-100 text-sm leading-snug">{quiz.title}</h3>
                            {quiz.courseTitle && (
                              <p className="text-[10px] text-purple-300 font-semibold mt-0.5">📚 {quiz.courseTitle}</p>
                            )}
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mt-2">
                              {quiz.description}
                            </p>
                          </div>

                          {quiz.skillTags && quiz.skillTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {quiz.skillTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[9px] bg-white/5 text-slate-300 px-2 py-0.5 rounded border border-white/5"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                            <span className="flex items-center gap-1">
                              <HelpCircle size={12} className="text-purple-400" /> {quiz.questionCount} Questions
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-purple-400" /> {quiz.timeLimitMinutes} Mins
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <Award size={12} /> +{quiz.xpReward} XP
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleStartQuiz(quiz.id)}
                          className={cn(
                            'w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg',
                            isPassed
                              ? 'bg-white/5 hover:bg-purple-500 text-slate-200 hover:text-white border border-white/10'
                              : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20'
                          )}
                        >
                          <Zap size={13} />
                          {isPassed ? 'Retake Assessment' : 'Start Strict Timed Quiz'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SECTION 5: COMMUNITY Q&A & INSTRUCTOR ANSWERS */}
          {loadState === 'ready' && (mainTab === 'ALL' || mainTab === 'COMMUNITY') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-pink-400" />
                  <span>Community Q&A & Official Instructor Answers ({filteredDiscussions.length})</span>
                </h2>
                <button
                  onClick={() => setAskModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus size={13} /> Ask Question
                </button>
              </div>

              {filteredDiscussions.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center text-slate-400 space-y-2 border border-white/5">
                  <MessageSquare size={28} className="mx-auto text-pink-400 opacity-70" />
                  <p className="text-xs font-semibold text-white">No Community Questions Yet</p>
                  <p className="text-[11px] text-slate-500">
                    Ask a question about any course, chart setup, or assignment to receive an official instructor reply.
                  </p>
                </div>
              ) : (
                filteredDiscussions.map((disc) => (
                  <div
                    key={disc.id}
                    className={cn(
                      'glass-card p-5 rounded-2xl border space-y-3 transition',
                      disc.isPinned
                        ? 'border-purple-500/40 bg-purple-950/15'
                        : 'border-white/10 bg-slate-900/60'
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {disc.isPinned && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                            <Pin size={10} /> PINNED
                          </span>
                        )}
                        {disc.isResolved && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 size={10} /> RESOLVED
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-white">{disc.title}</h3>
                      </div>
                      <button
                        onClick={() => setReplyTarget(disc)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-purple-300 text-[11px] font-mono border border-white/10 cursor-pointer"
                      >
                        Reply ({disc.replies?.length || 0})
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{disc.content}</p>

                    {disc.replies && disc.replies.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        {disc.replies.map((rep: any) => (
                          <div
                            key={rep.id}
                            className={cn(
                              'p-3 rounded-xl border text-xs',
                              rep.isInstructorReply
                                ? 'bg-teal-950/25 border-teal-500/30 text-teal-100'
                                : 'bg-slate-950/60 border-white/5 text-slate-300'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-[11px]">
                                  {rep.user?.fullName || 'Academy Trader'}
                                </span>
                                {rep.isInstructorReply && (
                                  <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[9px] font-mono font-bold flex items-center gap-1">
                                    <Sparkles size={9} /> OFFICIAL INSTRUCTOR ANSWER
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-500">
                                {new Date(rep.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed whitespace-pre-line">{rep.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Live Webinars, Certification Progress & Quick Hubs */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5 border border-white/5">
            <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
              <Video size={16} className="text-purple-400" />
              Live Webinars & Trading Rooms ({liveSessions.length})
            </h3>
            <div className="space-y-4">
              {liveSessions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No scheduled live webinars at this moment.</p>
              ) : (
                liveSessions.map((live) => {
                  const accessLink = live.joinUrl || live.meetingUrl || live.recordingUrl;
                  return (
                    <div key={live.id} className="p-3.5 rounded-xl border border-white/5 bg-white/2 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <Badge variant="purple" size="xs">{live.category}</Badge>
                        <span className="text-[10px] text-slate-400">{live.registeredCount} Attending</span>
                      </div>
                      <h4 className="font-bold text-slate-200 text-xs leading-normal">{live.title}</h4>
                      {live.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">{live.description}</p>
                      )}
                      <p className="text-[10px] text-slate-500">Host: {live.instructor}</p>

                      {live.zoomMeetingId && (
                        <div className="text-[10px] font-mono text-teal-300 bg-teal-500/10 px-2.5 py-1 rounded border border-teal-500/20">
                          Meeting ID: {live.zoomMeetingId} {live.passcode ? `• Pass: ${live.passcode}` : ''}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 gap-2">
                        <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                          <Calendar size={12} />
                          {new Date(live.startTime).toLocaleDateString()}{' '}
                          {new Date(live.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {accessLink && (
                            <a
                              href={accessLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 text-[10px] font-bold transition-all flex items-center gap-1"
                            >
                              <ExternalLink size={10} /> Join
                            </a>
                          )}
                          <button
                            onClick={() => handleRegisterLive(live)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Register
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-48 border border-white/5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award size={18} className="text-purple-400" />
                <h3 className="font-display font-bold text-white text-sm">Certification Progress</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Pass all strict lesson quizzes and complete practical homework to earn verified institutional trading certificates.
              </p>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Completed Modules</span>
                <span className="text-white font-bold">
                  {progress.completedLessons} / {progress.totalLessons}
                </span>
              </div>
              <div className="progress-track h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="progress-fill-purple h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ask Question Modal */}
      {askModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-purple-500/30 bg-slate-900 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold text-white">Ask an Instructor or Community</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Question Title *</label>
                <input
                  type="text"
                  value={askTitle}
                  onChange={(e) => setAskTitle(e.target.value)}
                  placeholder="e.g., How to validate an M15 Order Block during London Open?"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Question Details *</label>
                <textarea
                  value={askContent}
                  onChange={(e) => setAskContent(e.target.value)}
                  rows={4}
                  placeholder="Describe the chart setup, timeframe, or lesson concept you want clarified..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAskModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAskQuestion}
                disabled={askingQuestion}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {askingQuestion ? 'Publishing...' : 'Post Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-purple-500/30 bg-slate-900 w-full max-w-lg space-y-4">
            <h2 className="text-base font-bold text-white">Reply to: {replyTarget.title}</h2>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              placeholder="Write your reply..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReplyTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReplyDiscussion}
                disabled={postingReply}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {postingReply ? 'Posting...' : 'Post Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Strict Timed Quiz Modal */}
      <QuizModal
        quizId={selectedQuizId}
        isOpen={isQuizModalOpen}
        onClose={() => {
          setIsQuizModalOpen(false);
          setSelectedQuizId(null);
        }}
        onCompleted={() => {
          fetchAcademyData();
        }}
      />
    </motion.div>
  );
}
