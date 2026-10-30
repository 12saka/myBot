'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, CheckCircle2, ArrowLeft,
  Award, Clock, ChevronRight, Loader2, Sparkles, Video,
  HelpCircle, AlertTriangle, FileCheck2, ExternalLink, Send,
  ListChecks, FileText, Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

function extractLessonStructuredContent(rawContent: string) {
  if (!rawContent) {
    return { studyNotes: '', keyTakeaways: [] as string[], videoUrl: null, embedUrl: null, chartUrl: null };
  }

  let videoUrl: string | null = null;
  let chartUrl: string | null = null;

  const tagMatch = rawContent.match(/\[VIDEO_URL:(https?:\/\/[^\]]+)\]/i);
  if (tagMatch) {
    videoUrl = tagMatch[1].trim();
  }

  const lines = rawContent.replace(/\[VIDEO_URL:[^\]]+\]/gi, '').split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VIDEO_URL:')) {
      videoUrl = trimmed.replace('VIDEO_URL:', '').trim();
    } else if (trimmed.startsWith('CHART_URL:')) {
      chartUrl = trimmed.replace('CHART_URL:', '').trim();
    } else {
      cleanLines.push(line);
    }
  }

  if (!videoUrl) {
    const urlMatch = rawContent.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^\s]+)/i);
    if (urlMatch) {
      videoUrl = urlMatch[1].trim();
    }
  }

  const joined = cleanLines.join('\n').trim();
  const [notesPart, takeawaysPart] = joined.split(/###\s+Key Takeaways/i);
  const studyNotes = (notesPart || '')
    .replace(/detailed on how/gi, 'Detailed on how')
    .trim();

  const keyTakeaways = takeawaysPart
    ? takeawaysPart
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean)
    : [];

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

  return { studyNotes, keyTakeaways, videoUrl, embedUrl, chartUrl };
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
  assignments?: any[];
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

  // Per-Assignment Draft State (Separate from submittingAssignmentId so typing never disables the button!)
  const [assignments, setAssignments] = useState<any[]>([]);
  const [homeworkDrafts, setHomeworkDrafts] = useState<Record<string, { text: string; link: string }>>({});
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CourseDetails>(`/api/v2/academy/courses/${courseId}`);
      setCourse(data);
      if (data.lessons && data.lessons.length > 0) {
        setSelectedLesson((prev) =>
          prev ? data.lessons.find((l) => l.id === prev.id) || data.lessons[0] : data.lessons[0]
        );
      }

      const courseAssignments = data.assignments || [];
      setAssignments(courseAssignments);

      const initialDrafts: Record<string, { text: string; link: string }> = {};
      courseAssignments.forEach((a: any) => {
        initialDrafts[a.id] = {
          text: a.userSubmission?.submissionText || '',
          link: a.userSubmission?.linkUrl || '',
        };
      });
      setHomeworkDrafts(initialDrafts);
    } catch (err: any) {
      toast.error('Failed to load course curriculum.');
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (assignmentId: string, field: 'text' | 'link', value: string) => {
    setHomeworkDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        text: prev[assignmentId]?.text || '',
        link: prev[assignmentId]?.link || '',
        [field]: value,
      },
    }));
  };

  const handleSubmitHomework = async (assignmentId: string) => {
    const draft = homeworkDrafts[assignmentId] || { text: '', link: '' };
    if (!draft.text.trim() && !draft.link.trim()) {
      toast.error('Please provide your written analysis or a TradingView/document link.');
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
      toast.success('Homework submitted! The instructor has been notified for grading.');
      await fetchCourse();
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
      const answersArray = selectedLesson.quizzes
        ? selectedLesson.quizzes.map((_, idx) => quizAnswers[idx] ?? 0)
        : [];
      const res = await apiFetch<any>(`/api/v2/academy/lessons/${selectedLesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersArray }),
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
        <p className="text-xs text-slate-400 font-medium">Loading course curriculum, study notes, and assignments...</p>
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

      {/* Course Banner Card */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10 relative">
        {course.imageUrl && (
          <div className="h-44 w-full relative overflow-hidden bg-slate-900">
            <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
          </div>
        )}
        <div className="p-6 space-y-3 relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="purple" size="xs">{course.difficulty}</Badge>
            <Badge variant="blue" size="xs">{course.lessons.length} Modules</Badge>
            {assignments.length > 0 && (
              <Badge variant="amber" size="xs">{assignments.length} Practical Assignments</Badge>
            )}
            {course.hasCertificate && <Badge variant="buy" size="xs">Certified Completion</Badge>}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-display">{course.title}</h1>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">{course.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson Navigation Sidebar */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Curriculum & Study Modules
          </h3>
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
                    <span
                      className={cn(
                        'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                        isSelected ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400'
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold line-clamp-1">{lesson.title}</span>
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

        {/* Selected Lesson Player, Structured Study Notes & Course Assignments */}
        <div className="lg:col-span-2 space-y-6">
          {selectedLesson && (
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    Module {selectedLesson.orderIndex} • Study Notes & Video
                  </span>
                  <h2 className="text-lg font-bold text-white mt-0.5">{selectedLesson.title}</h2>
                </div>
                {selectedLesson.completed && <Badge variant="buy" size="xs">Completed & Verified</Badge>}
              </div>

              {(() => {
                const { studyNotes, keyTakeaways, videoUrl, embedUrl, chartUrl } = extractLessonStructuredContent(
                  selectedLesson.content || ''
                );
                return (
                  <div className="space-y-5">
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
                          <span className="text-xs text-white font-semibold">Video Lecture Stream</span>
                        </div>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <Play size={12} /> Watch Video
                        </a>
                      </div>
                    ) : null}

                    {/* Structured Written Study Notes */}
                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" /> Official Instructor Study Notes
                        </span>
                        {chartUrl && (
                          <a
                            href={chartUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-mono text-teal-400 hover:text-teal-300 flex items-center gap-1 underline"
                          >
                            <ExternalLink className="w-3 h-3" /> Open Annotated Reference Chart
                          </a>
                        )}
                      </div>

                      <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                        {studyNotes || selectedLesson.content}
                      </div>

                      {keyTakeaways.length > 0 && (
                        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold flex items-center gap-1.5">
                            <ListChecks className="w-3.5 h-3.5" /> Key Institutional Takeaways
                          </span>
                          <ul className="space-y-1.5">
                            {keyTakeaways.map((item, idx) => (
                              <li key={idx} className="text-xs text-slate-100 flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Strict Lesson Quiz Assessment */}
              {selectedLesson.quizzes && selectedLesson.quizzes.length > 0 ? (
                <div className="space-y-4 pt-4 border-t border-white/10">
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

                      <p className="text-xs font-semibold text-slate-100">
                        {qIdx + 1}. {quiz.question}
                      </p>

                      <div className="space-y-2">
                        {quiz.options.map((opt: string, optIdx: number) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                              className={cn(
                                'flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all',
                                isSelected
                                  ? 'bg-purple-500/20 border-purple-500 text-white'
                                  : 'bg-white/2 border-white/5 text-slate-400 hover:text-slate-200'
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

                  {lastResult && (
                    <div
                      className={cn(
                        'p-4 rounded-xl border space-y-2 text-xs',
                        lastResult.passed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-red-950/20 border-red-500/30 text-red-200'
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {lastResult.passed ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                          <AlertTriangle size={16} className="text-red-400" />
                        )}
                        <span>
                          {lastResult.passed
                            ? `Assessment Passed (${lastResult.score}%)`
                            : `Strict Passing Mark Not Met (${lastResult.score}%)`}
                        </span>
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
              ) : null}
            </div>
          )}

          {/* Course Assignments & Homework Section */}
          {assignments.length > 0 && (
            <div className="glass-card rounded-2xl p-6 border border-indigo-500/25 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-5 h-5 text-teal-400" />
                  <div>
                    <h2 className="text-base font-bold text-white">Practical Trading Assignments & Homework</h2>
                    <p className="text-[11px] text-slate-400">
                      Complete the deliverables below to receive instructor feedback and earn bonus XP.
                    </p>
                  </div>
                </div>
                <Badge variant="purple" size="xs">{assignments.length} Assigned</Badge>
              </div>

              <div className="space-y-5">
                {assignments.map((assignment) => {
                  const brief = parseAssignmentBrief(assignment.instructions || '');
                  const sub = assignment.userSubmission;
                  const draft = homeworkDrafts[assignment.id] || { text: '', link: '' };
                  const isBusy = submittingAssignmentId === assignment.id;

                  return (
                    <div
                      key={assignment.id}
                      className="p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/25 space-y-4"
                    >
                      {/* Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-white font-outfit">{assignment.title}</h3>
                            {sub?.status === 'GRADED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ✓ GRADED ({sub.score}/{assignment.maxScore} PTS)
                              </span>
                            )}
                            {sub?.status === 'SUBMITTED' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⏳ AWAITING INSTRUCTOR REVIEW
                              </span>
                            )}
                          </div>
                          {assignment.dueDate && (
                            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-teal-400" /> Due:{' '}
                              {new Date(assignment.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="blue" size="xs">Max Score: {assignment.maxScore}</Badge>
                          <Badge variant="purple" size="xs">+{assignment.xpReward} XP</Badge>
                        </div>
                      </div>

                      {/* Brief Summary */}
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{brief.summary}</p>

                      {/* Deliverables Checklist */}
                      {brief.deliverables.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                            <ListChecks className="w-3.5 h-3.5" /> Required Deliverables
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
                              <strong className="text-slate-200">Grading Rubric:</strong> {brief.gradingCriteria}
                            </span>
                          )}
                          {brief.referenceUrl && (
                            <a
                              href={brief.referenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-400 hover:underline font-mono flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Open Instructor Reference Chart
                            </a>
                          )}
                        </div>
                      )}

                      {/* Instructor Grade & Feedback Banner (when graded) */}
                      {sub?.status === 'GRADED' && (
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <Award className="w-4 h-4" /> Official Instructor Evaluation
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              Score: {sub.score} / {assignment.maxScore} pts (+{assignment.xpReward} XP Awarded)
                            </span>
                          </div>
                          {sub.feedback && (
                            <p className="text-xs text-slate-200 font-mono leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-white/5">
                              "{sub.feedback}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Submission Form */}
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        <h4 className="text-xs font-bold text-slate-200">
                          {sub ? 'Update Your Submission' : 'Submit Your Completed Assignment'}
                        </h4>
                        <textarea
                          value={draft.text}
                          onChange={(e) => updateDraft(assignment.id, 'text', e.target.value)}
                          placeholder="Write your market structure breakdown, entry/SL/TP levels, and trade rationale..."
                          rows={3}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex-1 flex items-center bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-teal-500">
                            <ExternalLink className="w-4 h-4 text-teal-400 mr-2 shrink-0" />
                            <input
                              type="url"
                              value={draft.link}
                              onChange={(e) => updateDraft(assignment.id, 'link', e.target.value)}
                              placeholder="Paste TradingView chart snapshot URL or Google Doc link..."
                              className="w-full bg-transparent border-none text-xs text-white focus:outline-none font-mono"
                            />
                          </div>
                          <button
                            onClick={() => handleSubmitHomework(assignment.id)}
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
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
