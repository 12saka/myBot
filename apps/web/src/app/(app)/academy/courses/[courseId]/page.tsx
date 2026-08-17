'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, CheckCircle2, ArrowLeft,
  Award, Clock, ChevronRight, Loader2, Sparkles, Video,
  HelpCircle, AlertTriangle, ShieldCheck, XCircle, BrainCircuit
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

function extractVideoInfo(rawContent: string) {
  if (!rawContent) return { cleanText: '', videoUrl: null, embedUrl: null };

  let videoUrl: string | null = null;

  const tagMatch = rawContent.match(/\[VIDEO_URL:(https?:\/\/[^\]]+)\]/i);
  if (tagMatch) {
    videoUrl = tagMatch[1].trim();
  } else {
    const urlMatch = rawContent.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^\s]+)/i);
    if (urlMatch) {
      videoUrl = urlMatch[1].trim();
    }
  }

  const cleanText = rawContent
    .replace(/\[VIDEO_URL:[^\]]+\]/gi, '')
    .replace(/detailed on how/gi, 'Detailed on how')
    .trim();

  let embedUrl: string | null = null;
  if (videoUrl) {
    const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    if (ytMatch && ytMatch[1]) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
    } else if (videoUrl.includes('vimeo.com')) {
      const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/i);
      if (vimeoMatch && vimeoMatch[1]) {
        embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    } else if (videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
      embedUrl = videoUrl;
    }
  }

  return { cleanText, videoUrl, embedUrl };
}

interface Lesson {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  completed?: boolean;
  quizzes?: any[];
}

interface CourseDetails {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  imageUrl?: string | null;
  lessons: Lesson[];
  hasCertificate: boolean;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [lastResult, setLastResult] = useState<any | null>(null);

  // Student Homework & Webinars State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [webinars, setWebinars] = useState<any[]>([]);
  const [homeworkText, setHomeworkText] = useState('');
  const [homeworkLink, setHomeworkLink] = useState('');
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CourseDetails>(`/api/v2/academy/courses/${courseId}`);
      setCourse(data);
      if (data.lessons && data.lessons.length > 0) {
        setSelectedLesson((prev) => (prev ? data.lessons.find(l => l.id === prev.id) || data.lessons[0] : data.lessons[0]));
      }

      // Fetch Course Assignments & Webinars
      try {
        const [assData, webData] = await Promise.all([
          apiFetch<any[]>('/api/v2/instructor/assignments'),
          apiFetch<any[]>('/api/v2/instructor/webinars'),
        ]);
        const courseAss = (assData || []).filter((a) => a.courseId === courseId);
        setAssignments(courseAss);
        setWebinars(webData || []);
      } catch (e) {}
    } catch (err: any) {
      toast.error('Failed to load course curriculum.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitHomework = async (assignmentId: string) => {
    if (!homeworkText.trim() && !homeworkLink.trim()) {
      toast.error('Please provide notes or a deliverable link.');
      return;
    }
    setSubmittingAssignmentId(assignmentId);
    try {
      await apiFetch(`/api/v2/academy/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          submissionText: homeworkText.trim(),
          linkUrl: homeworkLink.trim() || undefined,
        }),
      });
      toast.success('Homework submitted to instructor for grading!');
      setHomeworkText('');
      setHomeworkLink('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit homework');
    } finally {
      setSubmittingAssignmentId(null);
    }
  };

  useEffect(() => {
    if (courseId) fetchCourse();
  }, [courseId]);

  const handleCompleteLesson = async () => {
    if (!selectedLesson) return;
    const quizCount = selectedLesson.quizzes?.length || 0;
    if (quizCount === 0) {
      toast.error('No published quiz is attached to this lesson yet.');
      return;
    }
    if (Object.keys(quizAnswers).length < quizCount) {
      toast.error(`Please answer all ${quizCount} questions before submitting for strict grading.`);
      return;
    }
    setSubmittingQuiz(true);
    try {
      const answersArray = selectedLesson.quizzes ? selectedLesson.quizzes.map((_, idx) => quizAnswers[idx] ?? 0) : [];
      const res = await apiFetch<any>(`/api/v2/academy/lessons/${selectedLesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersArray })
      });

      setLastResult(res);

      if (res.passed) {
        toast.success(`🎉 Passed with ${res.score}%! Lesson unlocked & XP credited.`);
        fetchCourse();
      } else {
        toast.error(`Score: ${res.score}%. Strict passing mark of ${res.passMarkPct || 75}% not reached.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete lesson. Please try again.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 size={32} className="animate-spin text-purple-400" />
        <p className="text-xs text-slate-400 font-medium">Loading course curriculum and videos...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-white text-lg font-bold">Course Not Found</h3>
        <button onClick={() => router.push('/academy')} className="btn-primary text-xs px-4 py-2 cursor-pointer">
          Return to Academy
        </button>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button
        onClick={() => router.push('/academy')}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Academy Hub
      </button>

      {/* Course Banner Card with Image Header */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/5 relative">
        {course.imageUrl && (
          <div className="h-44 w-full relative overflow-hidden bg-slate-900">
            <img
              src={course.imageUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          </div>
        )}
        <div className="p-6 space-y-3 relative">
          <div className="flex items-center gap-2">
            <Badge variant="purple" size="xs">{course.difficulty}</Badge>
            {course.hasCertificate && <Badge variant="buy" size="xs">Certified Completion</Badge>}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-display">{course.title}</h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">{course.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson Navigation Sidebar */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Curriculum Lessons</h3>
          <div className="space-y-2">
            {course.lessons.map((lesson, idx) => {
              const isSelected = selectedLesson?.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setSelectedLesson(lesson);
                    setQuizAnswers({});
                    setLastResult(null);
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-500/40 text-white shadow-md'
                      : 'glass-card border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold",
                      isSelected ? "bg-purple-500 text-white" : "bg-white/5 text-slate-400"
                    )}>
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold">{lesson.title}</span>
                  </div>
                  {lesson.completed ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Lesson Player & Content */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLesson && (
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <span className="text-[10px] text-purple-400 font-bold uppercase">Lesson {selectedLesson.orderIndex}</span>
                  <h2 className="text-lg font-bold text-white mt-0.5">{selectedLesson.title}</h2>
                </div>
                {selectedLesson.completed && (
                  <Badge variant="buy" size="xs">Completed & Verified</Badge>
                )}
              </div>

              {(() => {
                const { cleanText, videoUrl, embedUrl } = extractVideoInfo(selectedLesson.content || '');
                return (
                  <div className="space-y-4">
                    {/* Embedded Video Player */}
                    {embedUrl ? (
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-purple-500/30 bg-black shadow-2xl">
                        {embedUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video src={embedUrl} controls className="w-full h-full object-cover" />
                        ) : (
                          <iframe
                            src={embedUrl}
                            title={selectedLesson.title}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}
                      </div>
                    ) : videoUrl ? (
                      <div className="p-4 rounded-xl glass-card border border-purple-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Video className="w-5 h-5 text-purple-400" />
                          <span className="text-xs text-white font-semibold">Video Lesson Stream</span>
                        </div>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <Play size={12} /> Play Video
                        </a>
                      </div>
                    ) : null}

                    {/* Lesson Text Content */}
                    <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed bg-white/2 p-4 rounded-xl border border-white/5">
                      <p className="whitespace-pre-line">{cleanText || selectedLesson.content}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Strict Lesson Quiz Assessment */}
              {selectedLesson.quizzes && selectedLesson.quizzes.length > 0 ? (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={16} className="text-purple-400" />
                      <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                        Lesson Mastery Assessment
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Strict Pass Mark: {selectedLesson.quizzes[0]?.passMarkPct || 75}%
                    </span>
                  </div>

                  {selectedLesson.quizzes.map((quiz, qIdx) => (
                    <div key={quiz.id} className="p-4 rounded-xl bg-slate-900/70 border border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="blue" size="xs">{quiz.skillTag || 'Market Concept'}</Badge>
                        {quiz.assetTag && (
                          <span className="text-[9px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">
                            {quiz.assetTag}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-100">{qIdx + 1}. {quiz.question}</p>

                      <div className="space-y-2">
                        {quiz.options.map((opt: string, optIdx: number) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all",
                                isSelected
                                  ? "bg-purple-500/20 border-purple-500 text-white"
                                  : "bg-white/2 border-white/5 text-slate-400 hover:text-slate-200"
                              )}
                            >
                              <input
                                type="radio"
                                name={`quiz-${qIdx}`}
                                checked={isSelected}
                                onChange={() => {}}
                                className="accent-purple-500"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Post-submission Result Feedback Banner */}
                  {lastResult && (
                    <div className={cn(
                      "p-4 rounded-xl border space-y-2 text-xs",
                      lastResult.passed
                        ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                        : "bg-red-950/20 border-red-500/30 text-red-200"
                    )}>
                      <div className="flex items-center gap-2 font-bold">
                        {lastResult.passed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-red-400" />}
                        <span>{lastResult.passed ? `Assessment Passed (${lastResult.score}%)` : `Strict Passing Mark Not Met (${lastResult.score}%)`}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{lastResult.aiInsight}</p>
                    </div>
                  )}

                  <button
                    onClick={handleCompleteLesson}
                    disabled={submittingQuiz}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {submittingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {selectedLesson.completed ? 'Retake Strict Quiz' : 'Submit Assessment & Complete Lesson'}
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>This lesson is awaiting published quiz questions.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
