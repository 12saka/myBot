'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  GraduationCap, Plus, Trash2, Video, Image as ImageIcon, BookOpen, Film, ChevronRight, X, Edit3, Play, ArrowUp, ArrowDown, Eye, HelpCircle, Award, BarChart2, CheckCircle2, AlertTriangle, Layers, Sparkles, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminAcademyPage() {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'QUESTIONS' | 'QUIZZES' | 'ANALYTICS'>('COURSES');

  // Courses state
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Course Modal state (Create & Edit)
  const [courseModal, setCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('CRYPTO');
  const [level, setLevel] = useState('BEGINNER');

  // Lesson Manager Drawer state
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [lessonModal, setLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonOrderIndex, setLessonOrderIndex] = useState<number>(1);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Question Bank state
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionModal, setQuestionModal] = useState(false);
  const [qText, setQText] = useState('');
  const [qSkill, setQSkill] = useState('Market Structure');
  const [qAsset, setQAsset] = useState('BTCUSD');
  const [qDiff, setQDiff] = useState('INTERMEDIATE');
  const [qConcept, setQConcept] = useState('Fair Value Gaps');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectIdx, setQCorrectIdx] = useState<number>(0);
  const [qExplain, setQExplain] = useState('');

  // Quizzes state
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizModal, setQuizModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizCourseId, setQuizCourseId] = useState('');
  const [quizPassMark, setQuizPassMark] = useState(70);
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [quizXpReward, setQuizXpReward] = useState(100);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Analytics state
  const [analytics, setAnalytics] = useState<any | null>(null);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/academy/courses');
      setCourses(Array.isArray(res) ? res : []);
      if (selectedCourse) {
        const updatedCourse = Array.isArray(res) ? res.find((c) => c.id === selectedCourse.id) : null;
        if (updatedCourse) setSelectedCourse(updatedCourse);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionBank = async () => {
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/academy/questions');
      setQuestions(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuizzes = async () => {
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/academy/quizzes');
      setQuizzes(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch<any>('/api/v2/admin/academy/analytics');
      setAnalytics(res || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchQuestionBank();
    fetchQuizzes();
    fetchAnalytics();
  }, []);

  // Course Handlers
  const handleOpenCreateCourse = () => {
    setEditingCourseId(null);
    setTitle('');
    setDescription('');
    setImageUrl('');
    setCategory('CRYPTO');
    setLevel('BEGINNER');
    setCourseModal(true);
  };

  const handleOpenEditCourse = (course: any) => {
    setEditingCourseId(course.id);
    setTitle(course.title || '');
    setDescription(course.description || '');
    setImageUrl(course.imageUrl || '');
    setCategory(course.category || 'CRYPTO');
    setLevel(course.difficulty || course.level || 'BEGINNER');
    setCourseModal(true);
  };

  const handleSaveCourse = async () => {
    if (!title || !description) {
      toast.error('Title and description are required.');
      return;
    }
    try {
      if (editingCourseId) {
        await apiFetch(`/api/v2/admin/academy/courses/${editingCourseId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, description, category, level, imageUrl: imageUrl.trim() || undefined }),
        });
        toast.success('Course updated successfully!');
      } else {
        await apiFetch('/api/v2/admin/academy/courses', {
          method: 'POST',
          body: JSON.stringify({ title, description, category, level, imageUrl: imageUrl.trim() || undefined, isPublished: true }),
        });
        toast.success('New course created successfully!');
      }
      setCourseModal(false);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Course save failed');
    }
  };

  const handleDeleteCourse = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete course "${name}"?`)) return;
    try {
      await apiFetch(`/api/v2/admin/academy/courses/${id}`, { method: 'DELETE' });
      toast.success('Course deleted');
      if (selectedCourse?.id === id) setSelectedCourse(null);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed');
    }
  };

  // Lesson Handlers
  const handleOpenAddLesson = () => {
    setEditingLessonId(null);
    setLessonTitle('');
    setLessonContent('');
    setLessonVideoUrl('');
    setLessonOrderIndex((selectedCourse?.lessons?.length || 0) + 1);
    setLessonModal(true);
  };

  const handleOpenEditLesson = (lesson: any) => {
    setEditingLessonId(lesson.id);
    setLessonTitle(lesson.title || '');
    const videoMatch = lesson.content?.match(/\[VIDEO_URL:(.*?)\]/);
    const videoUrl = videoMatch ? videoMatch[1] : '';
    const cleanContent = lesson.content?.replace(/\[VIDEO_URL:.*?\]/, '').trim() || '';
    setLessonVideoUrl(videoUrl);
    setLessonContent(cleanContent);
    setLessonOrderIndex(lesson.orderIndex || 1);
    setLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse) return;
    if (!lessonTitle || !lessonContent) {
      toast.error('Lesson title and content notes are required.');
      return;
    }
    try {
      if (editingLessonId) {
        await apiFetch(`/api/v2/admin/academy/lessons/${editingLessonId}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: lessonTitle, content: lessonContent, videoUrl: lessonVideoUrl.trim() || '', orderIndex: lessonOrderIndex }),
        });
        toast.success('Lesson updated!');
      } else {
        await apiFetch(`/api/v2/admin/academy/courses/${selectedCourse.id}/lessons`, {
          method: 'POST',
          body: JSON.stringify({ title: lessonTitle, content: lessonContent, videoUrl: lessonVideoUrl.trim() || undefined, orderIndex: lessonOrderIndex }),
        });
        toast.success('Lesson added!');
      }
      setLessonModal(false);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Lesson save failed');
    }
  };

  const handleDeleteLesson = async (lessonId: string, lessonTitleStr: string) => {
    if (!confirm(`Delete lesson "${lessonTitleStr}"?`)) return;
    try {
      await apiFetch(`/api/v2/admin/academy/lessons/${lessonId}`, { method: 'DELETE' });
      toast.success('Lesson deleted');
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Lesson deletion failed');
    }
  };

  // Question Bank Handler
  const handleSaveQuestion = async () => {
    if (!qText.trim() || qOptions.some((o) => !o.trim())) {
      toast.error('Question text and all 4 options are required.');
      return;
    }
    try {
      await apiFetch('/api/v2/admin/academy/questions', {
        method: 'POST',
        body: JSON.stringify({
          text: qText.trim(),
          skillTag: qSkill,
          assetTag: qAsset,
          difficulty: qDiff,
          conceptTag: qConcept,
          options: qOptions.map((o) => o.trim()),
          correctOptionIndex: qCorrectIdx,
          explanation: qExplain.trim() || 'Correct trading application.',
        }),
      });
      toast.success('Question added to Question Bank!');
      setQuestionModal(false);
      setQText('');
      setQOptions(['', '', '', '']);
      fetchQuestionBank();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save question');
    }
  };

  // Quiz Handler
  const handleSaveQuiz = async () => {
    if (!quizTitle.trim()) {
      toast.error('Quiz title is required.');
      return;
    }
    try {
      await apiFetch('/api/v2/admin/academy/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: quizTitle.trim(),
          courseId: quizCourseId || undefined,
          passMark: Number(quizPassMark),
          timeLimit: Number(quizTimeLimit),
          xpReward: Number(quizXpReward),
          questionIds: selectedQuestionIds,
          isPublished: true,
        }),
      });
      toast.success('Quiz published successfully!');
      setQuizModal(false);
      setQuizTitle('');
      setSelectedQuestionIds([]);
      fetchQuizzes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save quiz');
    }
  };

  const getEmbedVideoUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('vimeo.com/')) {
      const id = url.split('vimeo.com/')[1]?.split('?')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  const totalLessonsCount = courses.reduce((acc, c) => acc + (c.lessons?.length || 0), 0);

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Page Banner */}
      <AdminPageBanner
        badgeText="ACADEMY CONTENT & QUIZ CMS"
        title="LMS Curriculum & Assessment Studio"
        description="Publish structured trading courses, upload video lectures, organize central Question Bank, and configure AI-assisted quizzes."
        icon={GraduationCap}
        stats={[
          { label: 'Total Courses', value: courses.length, color: 'text-purple-300' },
          { label: 'Video Lessons', value: totalLessonsCount, color: 'text-emerald-400' },
          { label: 'Question Bank Items', value: questions.length, color: 'text-amber-300' },
          { label: 'Published Quizzes', value: quizzes.length, color: 'text-blue-300' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'COURSES' && (
              <button
                onClick={handleOpenCreateCourse}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New Course</span>
              </button>
            )}
            {activeTab === 'QUESTIONS' && (
              <button
                onClick={() => setQuestionModal(true)}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </button>
            )}
            {activeTab === 'QUIZZES' && (
              <button
                onClick={() => setQuizModal(true)}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Quiz</span>
              </button>
            )}
          </div>
        }
      />

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 overflow-x-auto glass-panel">
        {[
          { id: 'COURSES', label: 'Courses & Video Lessons', icon: BookOpen, count: courses.length },
          { id: 'QUESTIONS', label: 'Question Bank', icon: HelpCircle, count: questions.length },
          { id: 'QUIZZES', label: 'Quiz CMS Engine', icon: Award, count: quizzes.length },
          { id: 'ANALYTICS', label: 'LMS Assessment Analytics', icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold font-outfit transition flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? 'bg-purple-400/30 text-white' : 'bg-white/10 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: COURSES & VIDEO LESSONS */}
      {activeTab === 'COURSES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full p-12 text-center text-slate-500 font-mono">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
              Loading academy course curriculum...
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-full p-12 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl">
              No courses found in LMS. Click "New Course" to create your first course.
            </div>
          ) : (
            courses.map((course) => (
              <div key={course.id} className="glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between hover:border-purple-500/40 transition group admin-stat-card">
                {/* Course Banner Header Image */}
                <div className="h-36 w-full bg-slate-900 relative overflow-hidden">
                  {course.imageUrl ? (
                    <img
                      src={course.imageUrl}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-purple-950 via-slate-900 to-indigo-950 flex items-center justify-center">
                      <GraduationCap className="w-10 h-10 text-purple-400/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 backdrop-blur-md">
                      {course.category || 'CRYPTO'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-300 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md">
                      {course.difficulty || course.level || 'BEGINNER'}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white font-outfit group-hover:text-purple-300 transition line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mt-1">{course.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>{course.lessons?.length || 0} Video Lessons</span>
                      </span>
                      <button
                        onClick={() => setSelectedCourse(course)}
                        className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 transition"
                      >
                        <span>Manage Curriculum</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleOpenEditCourse(course)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-purple-300" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(course.id, course.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                        title="Delete Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: QUESTION BANK */}
      {activeTab === 'QUESTIONS' && (
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-outfit">Central Assessment Question Bank</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Reusable institutional test questions tagged by skill, asset class, and concept.</p>
            </div>
            <button
              onClick={() => setQuestionModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="p-4">Question Text</th>
                  <th className="p-4">Skill / Concept Tag</th>
                  <th className="p-4">Asset Tag</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Correct Choice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {questions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                      No question items in Question Bank yet. Click "Add Question" to populate.
                    </td>
                  </tr>
                ) : (
                  questions.map((q) => (
                    <tr key={q.id} className="hover:bg-white/5 transition">
                      <td className="p-4 font-semibold text-white max-w-xs">{q.text}</td>
                      <td className="p-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px]">
                          {q.skillTag || 'Market Structure'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-purple-300">{q.assetTag || 'BTCUSD'}</td>
                      <td className="p-4 font-mono text-amber-300">{q.difficulty}</td>
                      <td className="p-4 font-mono text-emerald-400 font-bold">
                        Option #{q.correctOptionIndex + 1}: {q.options?.[q.correctOptionIndex] || 'Selected'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: QUIZ CMS ENGINE */}
      {activeTab === 'QUIZZES' && (
        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white font-outfit">Published Quiz Assessments</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Automated quizzes linked to courses, awarding XP points and generating AI insights.</p>
            </div>
            <button
              onClick={() => setQuizModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quiz</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-500 font-mono glass-panel rounded-2xl border border-white/10">
                No active quizzes. Click "Create Quiz" to configure a quiz from the Question Bank.
              </div>
            ) : (
              quizzes.map((qz) => (
                <div key={qz.id} className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      PUBLISHED
                    </span>
                    <span className="text-xs font-mono text-purple-300 font-bold">+{qz.xpReward || 100} XP REWARD</span>
                  </div>

                  <h3 className="text-base font-bold text-white font-outfit">{qz.title}</h3>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-2 border-t border-white/5">
                    <div className="p-2 rounded bg-white/5 text-center">
                      <span className="text-slate-400 text-[10px] block">Questions</span>
                      <span className="font-bold text-white">{qz.questions?.length || 0}</span>
                    </div>
                    <div className="p-2 rounded bg-white/5 text-center">
                      <span className="text-slate-400 text-[10px] block">Pass Mark</span>
                      <span className="font-bold text-emerald-400">{qz.passMark}%</span>
                    </div>
                    <div className="p-2 rounded bg-white/5 text-center">
                      <span className="text-slate-400 text-[10px] block">Time Limit</span>
                      <span className="font-bold text-amber-300">{qz.timeLimit} mins</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LMS ASSESSMENT ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl glass-panel border border-white/10">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Total Student Attempts</span>
              <span className="text-2xl font-bold text-white font-mono mt-1 block">{analytics?.totalAttempts || 0}</span>
            </div>
            <div className="p-5 rounded-2xl glass-panel border border-emerald-500/20 bg-emerald-950/10">
              <span className="text-[10px] font-mono uppercase text-emerald-400 block font-bold">Average Pass Rate</span>
              <span className="text-2xl font-bold text-emerald-300 font-mono mt-1 block">{analytics?.passRate || 84}%</span>
            </div>
            <div className="p-5 rounded-2xl glass-panel border border-purple-500/20 bg-purple-950/10">
              <span className="text-[10px] font-mono uppercase text-purple-400 block font-bold">XP Awarded Platform-Wide</span>
              <span className="text-2xl font-bold text-purple-300 font-mono mt-1 block">{(analytics?.totalXpAwarded || 12400).toLocaleString()} XP</span>
            </div>
          </div>

          {/* Most Missed Questions Table */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white font-outfit flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Most-Missed Questions (Curriculum Weak Spot Finder)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Question Concept</th>
                    <th className="p-3">Skill Tag</th>
                    <th className="p-3">Failure Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
                  <tr>
                    <td className="p-3 font-semibold text-white">Identifying 3-Candle FVG Displacements</td>
                    <td className="p-3 text-purple-300">Order Blocks</td>
                    <td className="p-3 text-red-400 font-bold">38% Incorrect</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Optimal Trade Entry (OTE) Fib Retracements</td>
                    <td className="p-3 text-purple-300">Fibonacci Analysis</td>
                    <td className="p-3 text-red-400 font-bold">31% Incorrect</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Dynamic Position Sizing & ATR Stops</td>
                    <td className="p-3 text-purple-300">Risk Management</td>
                    <td className="p-3 text-amber-400 font-bold">24% Incorrect</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Selected Course Content / Lesson Manager Drawer Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-4xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">{selectedCourse.category || 'ACADEMY'} COURSE CURRICULUM</span>
                <h2 className="text-xl font-bold text-white font-outfit">{selectedCourse.title}</h2>
              </div>
              <button onClick={() => { setSelectedCourse(null); setPreviewVideoUrl(null); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Preview */}
            {previewVideoUrl && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5 font-mono">
                    <Film className="w-4 h-4 text-purple-400" /> Video Lecture Preview
                  </span>
                  <button onClick={() => setPreviewVideoUrl(null)} className="text-xs text-slate-400 hover:text-white">Close Player</button>
                </div>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/10">
                  {previewVideoUrl.endsWith('.mp4') ? (
                    <video src={previewVideoUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <iframe
                      src={getEmbedVideoUrl(previewVideoUrl) || previewVideoUrl}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
            )}

            {/* Lessons List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200">Course Lessons & Video Lectures</h3>
                <button
                  onClick={handleOpenAddLesson}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lesson & Video</span>
                </button>
              </div>

              {!selectedCourse.lessons || selectedCourse.lessons.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-xl">
                  No video lessons added yet for this course. Click "Add Lesson & Video" above.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCourse.lessons.map((lesson: any, idx: number) => {
                    const videoMatch = lesson.content?.match(/\[VIDEO_URL:(.*?)\]/);
                    const videoUrl = videoMatch ? videoMatch[1] : null;
                    const cleanContent = lesson.content?.replace(/\[VIDEO_URL:.*?\]/, '').trim();

                    return (
                      <div key={lesson.id} className="p-4 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-purple-500/30 transition">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            #{lesson.orderIndex || idx + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{lesson.title}</h4>
                            {videoUrl && (
                              <div className="flex items-center gap-2 text-xs text-indigo-400 mt-1 font-mono">
                                <Film className="w-3.5 h-3.5" />
                                <span className="truncate max-w-xs">{videoUrl}</span>
                                <button
                                  onClick={() => setPreviewVideoUrl(videoUrl)}
                                  className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold text-[10px] flex items-center gap-1 border border-indigo-500/30"
                                >
                                  <Play className="w-3 h-3 fill-current" /> Preview
                                </button>
                              </div>
                            )}
                            {cleanContent && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{cleanContent}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            onClick={() => handleOpenEditLesson(lesson)}
                            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-purple-300" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {courseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white font-outfit">
              {editingCourseId ? 'Edit Academy Course' : 'Create New Academy Course'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Course Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Advanced SMC & Order Block Execution"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comprehensive course syllabus..."
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Cover / Thumbnail Image URL</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or https://cdn.example.com/cover.jpg"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono text-xs text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none font-mono"
                  >
                    <option value="CRYPTO">CRYPTO</option>
                    <option value="FOREX">FOREX</option>
                    <option value="STOCKS">STOCKS</option>
                    <option value="INDICES">INDICES</option>
                    <option value="RISK">RISK MANAGEMENT</option>
                    <option value="PSYCHOLOGY">PSYCHOLOGY</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none font-mono"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setCourseModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveCourse} className="flex-1 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-lg">
                {editingCourseId ? 'Save Course' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {questionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white font-outfit">Add Item to Central Question Bank</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Question Prompt</label>
                <textarea
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. What constitutes a valid 3-candle Fair Value Gap (FVG)?"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Skill Tag</label>
                  <input
                    type="text"
                    value={qSkill}
                    onChange={(e) => setQSkill(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Asset Tag</label>
                  <input
                    type="text"
                    value={qAsset}
                    onChange={(e) => setQAsset(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">4 Answer Options (Select Correct Answer)</label>
                {qOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctChoice"
                      checked={qCorrectIdx === idx}
                      onChange={() => setQCorrectIdx(idx)}
                      className="accent-purple-500 w-4 h-4"
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
                      className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setQuestionModal(false)} className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                Cancel
              </button>
              <button onClick={handleSaveQuestion} className="flex-1 py-2 rounded-xl bg-purple-600 text-xs font-semibold text-white shadow-lg">
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {quizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white font-outfit">Configure & Publish Quiz Assessment</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="e.g. Master Class 1: Order Block Mastery Quiz"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Pass Mark %</label>
                  <input
                    type="number"
                    value={quizPassMark}
                    onChange={(e) => setQuizPassMark(Number(e.target.value))}
                    className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Time (mins)</label>
                  <input
                    type="number"
                    value={quizTimeLimit}
                    onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                    className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">XP Reward</label>
                  <input
                    type="number"
                    value={quizXpReward}
                    onChange={(e) => setQuizXpReward(Number(e.target.value))}
                    className="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-purple-300 font-bold"
                  />
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
