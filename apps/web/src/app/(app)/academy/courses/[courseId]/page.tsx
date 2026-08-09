'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, CheckCircle2, ArrowLeft,
  Award, Clock, ChevronRight, Loader2, Sparkles, Video
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

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

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CourseDetails>(`/api/v2/academy/courses/${courseId}`);
      setCourse(data);
      if (data.lessons && data.lessons.length > 0) {
        setSelectedLesson(data.lessons[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load course curriculum.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) fetchCourse();
  }, [courseId]);

  const handleCompleteLesson = async () => {
    if (!selectedLesson) return;
    setSubmittingQuiz(true);
    try {
      const answersArray = selectedLesson.quizzes ? selectedLesson.quizzes.map((_, idx) => quizAnswers[idx] ?? 0) : [];
      const res = await apiFetch<any>(`/api/v2/academy/lessons/${selectedLesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersArray })
      });

      if (res.passed) {
        toast.success(res.message || 'Lesson completed successfully!');
        fetchCourse();
      } else {
        toast.error(`Quiz attempt score: ${res.score}%. Minimum 70% required.`);
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
        <p className="text-xs text-slate-400">Loading course curriculum...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12 space-y-4">
        <h3 className="text-white text-lg font-bold">Course Not Found</h3>
        <button onClick={() => router.push('/academy')} className="btn-primary text-xs px-4 py-2">
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

      <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="purple" size="xs">{course.difficulty}</Badge>
          {course.hasCertificate && <Badge variant="buy" size="xs">Certified</Badge>}
        </div>
        <h1 className="text-xl font-bold text-white font-display">{course.title}</h1>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">{course.description}</p>
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
                  onClick={() => setSelectedLesson(lesson)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500/10 border-purple-500/30 text-white'
                      : 'glass-card border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold">{lesson.title}</span>
                  </div>
                  {lesson.completed ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-600" />
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
                  <Badge variant="buy" size="xs">Completed</Badge>
                )}
              </div>

              {(() => {
                const { cleanText, videoUrl, embedUrl } = extractVideoInfo(selectedLesson.content || '');
                return (
                  <div className="space-y-4">
                    {/* Embedded Video Player */}
                    {embedUrl ? (
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-purple-500/20 bg-black/80 shadow-2xl">
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
                          <span className="text-xs text-white font-semibold">Lesson Video Resource</span>
                        </div>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <Play size={12} /> Watch Video Lesson
                        </a>
                      </div>
                    ) : null}

                    {/* Cleaned Lesson Text Content */}
                    <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed">
                      <p>{cleanText || selectedLesson.content}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Quiz section if present */}
              {selectedLesson.quizzes && selectedLesson.quizzes.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">Lesson Knowledge Check</h4>
                  {selectedLesson.quizzes.map((quiz, qIdx) => (
                    <div key={quiz.id} className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3">
                      <p className="text-xs font-semibold text-slate-200">{qIdx + 1}. {quiz.question}</p>
                      <div className="space-y-2">
                        {quiz.options.map((opt: string, optIdx: number) => (
                          <label
                            key={optIdx}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              quizAnswers[qIdx] === optIdx
                                ? 'bg-purple-500/20 border-purple-500 text-white'
                                : 'bg-white/2 border-white/5 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`quiz-${qIdx}`}
                              checked={quizAnswers[qIdx] === optIdx}
                              onChange={() => {}}
                              className="accent-purple-500"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleCompleteLesson}
                disabled={submittingQuiz}
                className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-500/10 disabled:opacity-50"
              >
                {submittingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {selectedLesson.completed ? 'Re-take Quiz / Mark Complete' : 'Complete Lesson & Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
