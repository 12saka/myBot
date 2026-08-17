'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Play, Calendar, Star, Clock,
  ArrowRight, Search, Award, GraduationCap, Video, RefreshCw, AlertTriangle,
  HelpCircle, CheckCircle2, ShieldCheck, Flame, Zap
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { QuizModal } from '@/components/academy/QuizModal';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface CourseItem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category?: string;
  imageUrl?: string | null;
  totalLessons: number;
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
  instructor: string;
  startTime: string;
  durationMinutes: number;
  registeredCount: number;
  category: string;
}

interface UserProgress {
  totalCourses: number;
  totalLessons: number;
  completedLessons: number;
  certificatesEarned: number;
  progressPercent: number;
}

export default function AcademyPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [mainTab, setMainTab] = useState<'COURSES' | 'QUIZZES'>('COURSES');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [progress, setProgress] = useState<UserProgress>({
    totalCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    certificatesEarned: 0,
    progressPercent: 0
  });

  // Quiz Modal State
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const [activeLevel, setActiveLevel] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [search, setSearch] = useState('');

  const fetchAcademyData = async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      const [coursesRes, progressRes, liveRes, quizzesRes] = await Promise.allSettled([
        apiFetch<CourseItem[]>('/api/v2/academy/courses'),
        apiFetch<UserProgress>('/api/v2/academy/progress'),
        apiFetch<LiveSession[]>('/api/v2/academy/live-sessions'),
        apiFetch<QuizItem[]>('/api/v2/academy/quizzes')
      ]);

      let fetchedCourses: CourseItem[] = [];
      if (coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)) {
        fetchedCourses = coursesRes.value;
        setCourses(fetchedCourses);
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

      if (fetchedCourses.length === 0 && (!quizzesRes || quizzesRes.status !== 'fulfilled' || quizzesRes.value.length === 0)) {
        setLoadState('empty');
      } else {
        setLoadState('ready');
      }
    } catch (err: any) {
      console.warn('[Academy] API load notice:', err);
      setErrorMessage(err.message || 'Cannot reach API Gateway');
      setLoadState('error');
    }
  };

  useEffect(() => {
    fetchAcademyData();
  }, []);

  const filteredCourses = courses.filter(course => {
    const matchLevel = activeLevel === 'All' || course.difficulty.toLowerCase() === activeLevel.toLowerCase();
    const matchSearch = course.title.toLowerCase().includes(search.toLowerCase()) || (course.description && course.description.toLowerCase().includes(search.toLowerCase()));
    return matchLevel && matchSearch;
  });

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchLevel = activeLevel === 'All' || quiz.difficulty.toLowerCase() === activeLevel.toLowerCase();
    const matchSearch = quiz.title.toLowerCase().includes(search.toLowerCase()) || (quiz.description && quiz.description.toLowerCase().includes(search.toLowerCase()));
    return matchLevel && matchSearch;
  });

  const handleRegisterLive = async (session: LiveSession) => {
    const toastId = toast.loading(`Registering for "${session.title}"...`);
    try {
      await apiFetch(`/api/v2/academy/live-sessions/${session.id}/register`, { method: 'POST' });
      toast.success(`Successfully registered for ${session.title}!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || `Failed to register for live webinar "${session.title}". Please try again.`, { id: toastId });
    }
  };

  const handleStartQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setIsQuizModalOpen(true);
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Academy LMS & Mastery Hub"
        subtitle="Master institutional SMC, liquidity footprints, quantitative scalping, and pass strict certification assessments."
        icon={BookOpen}
      />

      {/* Main Tab Switcher */}
      <div className="flex border-b border-white/5 pb-2 gap-4">
        <button
          onClick={() => setMainTab('COURSES')}
          className={cn(
            "flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer",
            mainTab === 'COURSES'
              ? "border-purple-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <GraduationCap size={16} /> Courses & Modules ({courses.length})
        </button>
        <button
          onClick={() => setMainTab('QUIZZES')}
          className={cn(
            "flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer",
            mainTab === 'QUIZZES'
              ? "border-purple-500 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          <HelpCircle size={16} /> Quizzes & Strict Assessments ({quizzes.length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core content */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
              {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevel(lvl)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer",
                    activeLevel === lvl ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <div className="relative flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder={mainTab === 'COURSES' ? "Search curriculum..." : "Search quizzes..."}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-glass pl-8 pr-4 py-2 rounded-xl text-xs w-full sm:w-52 md:w-64"
                />
              </div>
              <button
                onClick={fetchAcademyData}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh Directory"
              >
                <RefreshCw size={14} className={cn(loadState === 'loading' && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Load States */}
          {loadState === 'loading' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
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

          {loadState === 'ready' && mainTab === 'COURSES' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCourses.map((course) => (
                <div key={course.id} className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/5 hover:border-purple-500/30 transition-all duration-300">
                  {/* Course Image Header Banner */}
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
                      <Badge variant={course.difficulty === 'Beginner' ? 'blue' : course.difficulty === 'Intermediate' ? 'purple' : 'amber'} size="xs">
                        {course.difficulty}
                      </Badge>
                      {course.hasCertificate && (
                        <Badge variant="buy" size="xs">Certified</Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm mb-2">{course.title}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">{course.description}</p>
                      <div className="flex gap-4 text-[10px] text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><GraduationCap size={12} /> {course.totalLessons} Lessons</span>
                        <span className="flex items-center gap-1 text-purple-400 font-bold"><Award size={12} /> {course.progressPercent}% Done</span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/academy/courses/${course.id}`)}
                      className="w-full btn-ghost py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-purple-500 hover:text-white hover:border-purple-600 transition-all mt-4 cursor-pointer"
                    >
                      {course.completedLessons > 0 ? 'Continue Course' : 'Start Course'} <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quizzes & Strict Assessment Tab */}
          {loadState === 'ready' && mainTab === 'QUIZZES' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredQuizzes.length === 0 ? (
                <div className="col-span-2 glass-card rounded-2xl p-8 border border-white/5 text-center space-y-2">
                  <HelpCircle size={32} className="text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No quizzes match your filter criteria.</p>
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
                            <Badge variant={quiz.difficulty === 'BEGINNER' ? 'blue' : quiz.difficulty === 'INTERMEDIATE' ? 'purple' : 'amber'} size="xs">
                              {quiz.difficulty}
                            </Badge>
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Pass: {quiz.passMarkPct}%
                            </span>
                          </div>

                          {hasAttempt && (
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1",
                                isPassed
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-red-500/20 text-red-300 border border-red-500/30"
                              )}
                            >
                              {isPassed ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                              {isPassed ? `Passed (${quiz.userAttempt?.score}%)` : `Retake Needed (${quiz.userAttempt?.score}%)`}
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-100 text-sm leading-snug">{quiz.title}</h3>
                          {quiz.courseTitle && (
                            <p className="text-[10px] text-purple-300 font-semibold mt-0.5">📚 {quiz.courseTitle}</p>
                          )}
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mt-2">{quiz.description}</p>
                        </div>

                        {/* Skill Badges */}
                        {quiz.skillTags && quiz.skillTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {quiz.skillTags.map(tag => (
                              <span key={tag} className="text-[9px] bg-white/5 text-slate-300 px-2 py-0.5 rounded border border-white/5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                          <span className="flex items-center gap-1"><HelpCircle size={12} className="text-purple-400" /> {quiz.questionCount} Questions</span>
                          <span className="flex items-center gap-1"><Clock size={12} className="text-purple-400" /> {quiz.timeLimitMinutes} Mins</span>
                          <span className="flex items-center gap-1 text-emerald-400 font-bold"><Award size={12} /> +{quiz.xpReward} XP</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartQuiz(quiz.id)}
                        className={cn(
                          "w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg",
                          isPassed
                            ? "bg-white/5 hover:bg-purple-500 text-slate-200 hover:text-white border border-white/10"
                            : "bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20"
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
          )}
        </div>

        {/* Live sessions & Webinars sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5 border border-white/5">
            <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
              <Video size={16} className="text-purple-400" />
              Live Webinars & Q&A
            </h3>
            <div className="space-y-4">
              {liveSessions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No scheduled live webinars at this moment.</p>
              ) : (
                liveSessions.map((live) => (
                  <div key={live.id} className="p-3.5 rounded-xl border border-white/5 bg-white/2 space-y-2">
                    <div className="flex justify-between items-center">
                      <Badge variant="purple" size="xs">{live.category}</Badge>
                      <span className="text-[10px] text-slate-400">{live.registeredCount} Attending</span>
                    </div>
                    <h4 className="font-bold text-slate-200 text-xs leading-normal">{live.title}</h4>
                    <p className="text-[10px] text-slate-500">{live.instructor}</p>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold">
                        <Calendar size={12} />
                        {new Date(live.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                      </div>
                      <button
                        onClick={() => handleRegisterLive(live)}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Register
                      </button>
                    </div>
                  </div>
                ))
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
                Pass all strict lesson quizzes to earn verified institutional trading certificates.
              </p>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Completed Modules</span>
                <span className="text-white font-bold">{progress.completedLessons} / {progress.totalLessons}</span>
              </div>
              <div className="progress-track h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="progress-fill-purple h-full bg-purple-500 transition-all duration-500" style={{ width: `${progress.progressPercent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

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
