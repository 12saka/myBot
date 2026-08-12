'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  Video,
  ChevronRight,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  // Modal State for Course Create/Edit
  const [courseModal, setCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('BEGINNER');
  const [category, setCategory] = useState('CRYPTO');
  const [imageUrl, setImageUrl] = useState('');

  // Modal State for Lesson Create
  const [lessonModal, setLessonModal] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonOrder, setLessonOrder] = useState(1);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/v2/instructor/courses');
      setCourses(data || []);
      if (data && data.length > 0 && !selectedCourse) {
        setSelectedCourse(data[0]);
      }
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
    setCategory('CRYPTO');
    setImageUrl('');
    setCourseModal(true);
  };

  const handleOpenEditCourse = (c: any) => {
    setEditingCourseId(c.id);
    setTitle(c.title || '');
    setDescription(c.description || '');
    setDifficulty(c.difficulty || 'BEGINNER');
    setCategory(c.category || 'CRYPTO');
    setImageUrl(c.imageUrl || '');
    setCourseModal(true);
  };

  const handleSaveCourse = async () => {
    if (!title.trim()) {
      toast.error('Course title is required.');
      return;
    }
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
      } else {
        await apiFetch('/api/v2/instructor/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('New course created successfully!');
      }
      setCourseModal(false);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save course');
    }
  };

  const handleDeleteCourse = async (courseId: string, titleStr: string) => {
    if (!confirm(`Are you sure you want to delete course "${titleStr}"?`)) return;
    try {
      await apiFetch(`/api/v2/instructor/courses/${courseId}`, { method: 'DELETE' });
      toast.success('Course deleted.');
      if (selectedCourse?.id === courseId) setSelectedCourse(null);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete course');
    }
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !lessonTitle.trim()) {
      toast.error('Lesson title is required.');
      return;
    }
    try {
      await apiFetch(`/api/v2/admin/academy/courses/${selectedCourse.id}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title: lessonTitle.trim(),
          content: lessonContent.trim() || 'Video lesson content.',
          orderIndex: Number(lessonOrder),
        }),
      });
      toast.success('Lesson added to curriculum!');
      setLessonModal(false);
      setLessonTitle('');
      setLessonContent('');
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add lesson');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-outfit">Course & Curriculum Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded">
              AUTHORING
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Build and manage your trading courses, video lessons, and curriculum outline.</p>
        </div>

        <button
          onClick={handleOpenCreateCourse}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Course</span>
        </button>
      </div>

      {/* Main Grid: Course List & Lesson Curriculum Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Courses List */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-400 px-1">My Courses ({courses.length})</h3>
          {courses.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-500 font-mono rounded-2xl border border-teal-500/20">
              No courses created yet. Click "Create New Course" to get started.
            </div>
          ) : (
            courses.map((c) => {
              const isSelected = selectedCourse?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCourse(c)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-950/60 to-indigo-950/40 border-teal-500/50 shadow-lg shadow-teal-500/10'
                      : 'bg-slate-900/60 border-teal-500/10 hover:border-teal-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                        {c.category || 'CRYPTO'}
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
                      <Video className="w-3.5 h-3.5 text-teal-400" />
                      <span>{c.lessons?.length || 0} Lessons</span>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEditCourse(c)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-teal-300 transition"
                        title="Edit Course"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCourse(c.id, c.title)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
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
              Select a course on the left to manage its video lessons and curriculum.
            </div>
          ) : (
            <div className="glass-panel p-6 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-teal-400 uppercase tracking-wider block">Course Curriculum Manager</span>
                  <h3 className="text-lg font-black text-white font-outfit mt-0.5">{selectedCourse.title}</h3>
                </div>

                <button
                  onClick={() => {
                    setLessonOrder((selectedCourse.lessons?.length || 0) + 1);
                    setLessonModal(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lesson</span>
                </button>
              </div>

              {/* Lessons List */}
              <div className="space-y-2.5">
                {!selectedCourse.lessons || selectedCourse.lessons.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-mono rounded-xl bg-slate-950/60 border border-white/5">
                    No video lessons added to this course yet. Click "Add Lesson" to build curriculum.
                  </div>
                ) : (
                  selectedCourse.lessons.map((les: any, idx: number) => (
                    <div
                      key={les.id || idx}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-teal-500/20 flex items-center justify-between hover:border-teal-500/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center font-mono font-bold text-xs text-teal-400">
                          #{les.orderIndex || idx + 1}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-white">{les.title}</h5>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{les.content}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Video Ready
                        </span>
                      </div>
                    </div>
                  ))
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
              {editingCourseId ? 'Edit Course Details' : 'Create New Trading Course'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Course Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Master Class 1: Order Block & FVG Mastery"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed summary of course objectives and prerequisites..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                  >
                    <option value="CRYPTO">CRYPTO</option>
                    <option value="FOREX">FOREX</option>
                    <option value="INDICES">INDICES</option>
                    <option value="STOCKS">STOCKS</option>
                    <option value="PSYCHOLOGY">PSYCHOLOGY</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Difficulty</label>
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
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition"
              >
                {editingCourseId ? 'Save Changes' : 'Publish Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Lesson */}
      {lessonModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">Add Video Lesson to Course</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Lesson Title</label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g. Lesson 1: Identifying High Probability Fair Value Gaps"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Video URL or Lesson Content</label>
                <textarea
                  rows={3}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Paste YouTube/Vimeo video embed link or lesson breakdown..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLessonModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLesson}
                className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition"
              >
                Save Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
