'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  Video,
  Sparkles,
  FileText,
  ListChecks,
  Bell,
  Eye,
  Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ParsedLessonContent {
  videoUrl: string;
  studyNotes: string;
  keyTakeaways: string[];
  chartUrl: string;
}

function serializeLessonContent(data: ParsedLessonContent): string {
  const blocks: string[] = [];
  if (data.videoUrl.trim()) {
    blocks.push(`VIDEO_URL: ${data.videoUrl.trim()}`);
  }
  if (data.chartUrl.trim()) {
    blocks.push(`CHART_URL: ${data.chartUrl.trim()}`);
  }
  if (data.studyNotes.trim()) {
    blocks.push(data.studyNotes.trim());
  }
  const cleanTakeaways = data.keyTakeaways.map((t) => t.trim()).filter(Boolean);
  if (cleanTakeaways.length > 0) {
    blocks.push(`### Key Takeaways\n${cleanTakeaways.map((t) => `- ${t}`).join('\n')}`);
  }
  return blocks.join('\n\n');
}

function parseLessonContent(raw: string = ''): ParsedLessonContent {
  let text = raw.trim();
  let videoUrl = '';
  let chartUrl = '';

  const lines = text.split('\n');
  const remainingLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VIDEO_URL:')) {
      videoUrl = trimmed.replace('VIDEO_URL:', '').trim();
    } else if (trimmed.startsWith('CHART_URL:')) {
      chartUrl = trimmed.replace('CHART_URL:', '').trim();
    } else if (
      !videoUrl &&
      remainingLines.length === 0 &&
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com)\//i.test(trimmed)
    ) {
      videoUrl = trimmed;
    } else {
      remainingLines.push(line);
    }
  }

  const joined = remainingLines.join('\n').trim();
  const [notesPart, takeawaysPart] = joined.split(/###\s+Key Takeaways/i);
  const studyNotes = (notesPart || '').trim();
  const keyTakeaways = takeawaysPart
    ? takeawaysPart
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean)
    : [];

  return {
    videoUrl,
    studyNotes,
    keyTakeaways,
    chartUrl,
  };
}

export default function InstructorCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Modal State for Course Create/Edit
  const [courseModal, setCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('BEGINNER');
  const [category, setCategory] = useState('FOREX');
  const [imageUrl, setImageUrl] = useState('');

  // Modal State for Lesson & Study Notes Create/Edit
  const [lessonModal, setLessonModal] = useState(false);
  const [lessonTab, setLessonTab] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [chartUrl, setChartUrl] = useState('');
  const [studyNotes, setStudyNotes] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>(['']);
  const [lessonOrder, setLessonOrder] = useState(1);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || null;

  const fetchCourses = async (preferCourseId?: string) => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/v2/instructor/courses');
      const list = data || [];
      setCourses(list);
      const targetId = preferCourseId || selectedCourseId || list[0]?.id || null;
      setSelectedCourseId(targetId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleOpenCreateCourse = () => {
    setEditingCourseId(null);
    setTitle('');
    setDescription('');
    setDifficulty('BEGINNER');
    setCategory('FOREX');
    setImageUrl('');
    setCourseModal(true);
  };

  const handleOpenEditCourse = (c: any) => {
    setEditingCourseId(c.id);
    setTitle(c.title || '');
    setDescription(c.description || '');
    setDifficulty(c.difficulty || 'BEGINNER');
    setCategory(c.category || 'FOREX');
    setImageUrl(c.imageUrl || '');
    setCourseModal(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSaveCourse = async () => {
    if (saving) return;
    if (!title.trim()) {
      toast.error('Course title is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        difficulty,
        category,
        imageUrl: imageUrl.trim() || undefined,
        isPublished: true,
      };

      if (editingCourseId) {
        await apiFetch(`/api/v2/instructor/courses/${editingCourseId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Course updated successfully!');
        setCourseModal(false);
        fetchCourses(editingCourseId);
      } else {
        const created = await apiFetch<any>('/api/v2/instructor/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('New course published & students notified!');
        setCourseModal(false);
        fetchCourses(created?.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string, titleStr: string) => {
    if (!confirm(`Are you sure you want to delete course "${titleStr}"?`)) return;
    try {
      await apiFetch(`/api/v2/instructor/courses/${courseId}`, { method: 'DELETE' });
      toast.success('Course deleted.');
      fetchCourses(selectedCourseId === courseId ? undefined : selectedCourseId || undefined);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete course');
    }
  };

  const handleOpenCreateLesson = () => {
    if (!selectedCourse) return;
    setEditingLessonId(null);
    setLessonTab('WRITE');
    setLessonTitle('');
    setVideoUrl('');
    setChartUrl('');
    setStudyNotes('');
    setKeyTakeaways([
      'Identify Higher Timeframe (H4/H1) institutional order flow before looking for entries',
      'Wait for a liquidity sweep and displacement candle leaving a Fair Value Gap',
    ]);
    setLessonOrder((selectedCourse.lessons?.length || 0) + 1);
    setLessonModal(true);
  };

  const handleOpenEditLesson = (les: any, idx: number) => {
    const parsed = parseLessonContent(les.content || '');
    setEditingLessonId(les.id);
    setLessonTab('WRITE');
    setLessonTitle(les.title || '');
    setVideoUrl(parsed.videoUrl);
    setChartUrl(parsed.chartUrl);
    setStudyNotes(parsed.studyNotes);
    setKeyTakeaways(parsed.keyTakeaways.length > 0 ? parsed.keyTakeaways : ['']);
    setLessonOrder(les.orderIndex || idx + 1);
    setLessonModal(true);
  };

  const handleSaveLesson = async () => {
    if (saving) return;
    if (!selectedCourse || !lessonTitle.trim()) {
      toast.error('Lesson title is required.');
      return;
    }

    const compiledContent =
      serializeLessonContent({
        videoUrl,
        studyNotes,
        keyTakeaways,
        chartUrl,
      }) || 'Comprehensive lesson study notes.';

    setSaving(true);
    try {
      if (editingLessonId) {
        await apiFetch(`/api/v2/instructor/lessons/${editingLessonId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: lessonTitle.trim(),
            content: compiledContent,
            orderIndex: Number(lessonOrder),
          }),
        });
        toast.success('Lesson & study notes updated!');
      } else {
        await apiFetch(`/api/v2/instructor/courses/${selectedCourse.id}/lessons`, {
          method: 'POST',
          body: JSON.stringify({
            title: lessonTitle.trim(),
            content: compiledContent,
            orderIndex: Number(lessonOrder),
          }),
        });
        toast.success('Lesson & study notes published (students notified)!');
      }
      setLessonModal(false);
      fetchCourses(selectedCourse.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-teal-500/25 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-teal-950/30">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white font-outfit">Course & Lesson Study Notes Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Bell className="w-3 h-3" /> AUTO-NOTIFY ENABLED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build structured trading courses, attach video embeds, and publish formatted lesson study notes with key takeaways.
          </p>
        </div>

        <button
          onClick={handleOpenCreateCourse}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Course</span>
        </button>
      </div>

      {/* Main Grid: Course List & Lesson Curriculum Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Courses List */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-400 px-1">Published Courses ({courses.length})</h3>
          {courses.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-500 font-mono rounded-2xl border border-teal-500/20">
              No courses created yet. Click "Publish New Course" to get started.
            </div>
          ) : (
            courses.map((c) => {
              const isSelected = selectedCourse?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCourseId(c.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-950/60 to-indigo-950/40 border-teal-500/50 shadow-lg shadow-teal-500/10'
                      : 'bg-slate-900/60 border-teal-500/10 hover:border-teal-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                        {c.category || 'FOREX'}
                      </span>
                      <h4 className="text-sm font-bold text-white font-outfit mt-1">{c.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {c.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{c.description}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
                    <span className="font-mono flex items-center gap-1.5 text-[11px]">
                      <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                      <span>{c.lessons?.length || 0} Modules / Notes</span>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEditCourse(c)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-teal-300 transition cursor-pointer"
                        title="Edit Course"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(c.id, c.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Course Curriculum Details */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedCourse ? (
            <div className="glass-panel p-12 text-center text-slate-500 font-mono rounded-2xl border border-teal-500/20">
              Select a course on the left to manage its lessons and structured study notes.
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wider block">
                    Course Curriculum & Study Notes
                  </span>
                  <h3 className="text-lg font-black text-white font-outfit mt-0.5">{selectedCourse.title}</h3>
                </div>

                <button
                  onClick={handleOpenCreateLesson}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Lesson & Study Notes</span>
                </button>
              </div>

              {/* Lessons List */}
              <div className="space-y-3">
                {!selectedCourse.lessons || selectedCourse.lessons.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                    <FileText className="w-8 h-8 text-teal-400 mx-auto opacity-70" />
                    <p className="text-xs font-semibold text-white">No Modules or Study Notes Published Yet</p>
                    <p className="text-[11px] text-slate-500">
                      Click "Publish Lesson & Study Notes" to add video lessons, written market breakdowns, and key takeaways.
                    </p>
                  </div>
                ) : (
                  selectedCourse.lessons.map((les: any, idx: number) => {
                    const parsed = parseLessonContent(les.content || '');
                    return (
                      <div
                        key={les.id || idx}
                        className="p-4 rounded-xl bg-slate-950/85 border border-teal-500/20 hover:border-teal-500/40 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center font-mono font-bold text-xs text-teal-300 shrink-0 mt-0.5">
                              #{les.orderIndex || idx + 1}
                            </div>
                            <div className="space-y-1">
                              <h5 className="text-sm font-bold text-white font-outfit">{les.title}</h5>
                              <div className="flex flex-wrap items-center gap-2">
                                {parsed.videoUrl && (
                                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 flex items-center gap-1">
                                    <Video className="w-3 h-3" /> Video Attached
                                  </span>
                                )}
                                {parsed.studyNotes && (
                                  <span className="text-[10px] font-mono text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/25 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> Study Notes
                                  </span>
                                )}
                                {parsed.keyTakeaways.length > 0 && (
                                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25">
                                    {parsed.keyTakeaways.length} Key Takeaways
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleOpenEditLesson(les, idx)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300 border border-white/10 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Are you sure you want to delete "${les.title}"?`)) return;
                                try {
                                  await apiFetch(`/api/v2/instructor/lessons/${les.id}`, { method: 'DELETE' });
                                  toast.success('Lesson deleted.');
                                  fetchCourses(selectedCourse.id);
                                } catch (err: any) {
                                  toast.error(err.message || 'Failed to delete lesson');
                                }
                              }}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
                              title="Delete Lesson"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {parsed.studyNotes && (
                          <p className="text-xs text-slate-300 line-clamp-2 pl-11 leading-relaxed">{parsed.studyNotes}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create/Edit Course */}
      {courseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">
              {editingCourseId ? 'Edit Course Details' : 'Publish New Trading Course'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Course Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Institutional Gold (XAU/USD) Order Block & FVG Mastery"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Course Overview & Learning Outcomes</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed summary of course objectives and what students will master..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Market Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                  >
                    <option value="FOREX">FOREX & GOLD</option>
                    <option value="CRYPTO">CRYPTO</option>
                    <option value="INDICES">INDICES</option>
                    <option value="STOCKS">STOCKS</option>
                    <option value="PSYCHOLOGY">RISK & PSYCHOLOGY</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Difficulty Tier</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                  >
                    <option value="BEGINNER">BEGINNER</option>
                    <option value="INTERMEDIATE">INTERMEDIATE</option>
                    <option value="ADVANCED">ADVANCED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCourseModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition cursor-pointer"
              >
                {editingCourseId ? 'Save Changes' : 'Publish Course & Notify Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rich Lesson & Study Notes Publisher */}
      {lessonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-2xl space-y-5 bg-slate-900 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-outfit">
                  {editingLessonId ? 'Edit Lesson & Study Notes' : 'Publish Lesson & Structured Study Notes'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Combine video instruction with clean, readable written study notes and key takeaways for students.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setLessonTab('WRITE')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    lessonTab === 'WRITE' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Editor
                </button>
                <button
                  type="button"
                  onClick={() => setLessonTab('PREVIEW')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                    lessonTab === 'PREVIEW' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" /> 2. Student Reader Preview
                </button>
              </div>
            </div>

            {lessonTab === 'WRITE' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-slate-300 font-semibold block mb-1">Lesson / Module Title *</label>
                    <input
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="e.g. Module 1: Institutional Liquidity Sweeps & Displacement"
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Module Order #</label>
                    <input
                      type="number"
                      min={1}
                      value={lessonOrder}
                      onChange={(e) => setLessonOrder(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Video className="w-3.5 h-3.5 text-teal-400" /> Video URL (YouTube / Vimeo / Loom — Optional)
                    </label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-indigo-400" /> Reference Chart Image / Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={chartUrl}
                      onChange={(e) => setChartUrl(e.target.value)}
                      placeholder="https://www.tradingview.com/x/..."
                      className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Written Study Notes & Market Breakdown *
                  </label>
                  <textarea
                    rows={6}
                    value={studyNotes}
                    onChange={(e) => setStudyNotes(e.target.value)}
                    placeholder="Write clear, structured study notes explaining the trading concept, execution rules, session timing, and invalidation criteria..."
                    className="w-full p-3 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 leading-relaxed"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-teal-300 font-bold flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4" /> Key Takeaways Summary (Displayed as Highlight Box)
                    </label>
                    <button
                      type="button"
                      onClick={() => setKeyTakeaways((prev) => [...prev, ''])}
                      className="text-[11px] font-bold text-teal-400 hover:text-teal-300 cursor-pointer"
                    >
                      + Add Takeaway
                    </button>
                  </div>

                  <div className="space-y-2">
                    {keyTakeaways.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-teal-400">•</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) =>
                            setKeyTakeaways((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                          }
                          placeholder="e.g. Never enter an FVG against Higher Timeframe BOS direction..."
                          className="flex-1 p-2 bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-teal-500"
                        />
                        {keyTakeaways.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setKeyTakeaways((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-red-400 px-1.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-950 border border-teal-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 font-bold">
                    Module #{lessonOrder} • {selectedCourse?.title}
                  </span>
                  {videoUrl && (
                    <span className="text-[10px] font-mono text-emerald-300">Video Lecture Included</span>
                  )}
                </div>
                <h4 className="text-lg font-bold text-white font-outfit">
                  {lessonTitle || 'Untitled Lesson Module'}
                </h4>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {studyNotes || 'No written study notes entered yet.'}
                </div>
                {keyTakeaways.filter((t) => t.trim()).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 font-bold block">
                      Key Institutional Takeaways
                    </span>
                    <ul className="space-y-1">
                      {keyTakeaways
                        .filter((t) => t.trim())
                        .map((t, i) => (
                          <li key={i} className="text-xs text-slate-100 flex items-start gap-2">
                            <span className="text-teal-400 font-bold">✓</span>
                            <span>{t}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {editingLessonId ? 'Updates student course player immediately' : 'Notifies all students of new study module'}
              </span>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setLessonModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLesson}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-teal-500/20 transition cursor-pointer"
                >
                  {editingLessonId ? 'Save Lesson Changes' : 'Publish Lesson & Study Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
