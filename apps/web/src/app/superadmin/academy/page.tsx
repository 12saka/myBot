'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GraduationCap, Plus, Trash2, Video, Image as ImageIcon, BookOpen, Film, ChevronRight, X, Edit3, Play, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminAcademyPage() {
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

  // Lesson Manager Modal state (Create & Edit)
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [lessonModal, setLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonOrderIndex, setLessonOrderIndex] = useState<number>(1);

  // Active Video Preview in Lesson Manager
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

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

  useEffect(() => {
    fetchCourses();
  }, []);

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
        // Edit existing course
        await apiFetch(`/api/v2/admin/academy/courses/${editingCourseId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            description,
            category,
            level,
            imageUrl: imageUrl.trim() || undefined,
          }),
        });
        toast.success('Course updated successfully!');
      } else {
        // Create new course
        await apiFetch('/api/v2/admin/academy/courses', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description,
            category,
            level,
            imageUrl: imageUrl.trim() || undefined,
            isPublished: true,
          }),
        });
        toast.success('New course created successfully!');
      }
      setCourseModal(false);
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Course action failed');
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

  // Lesson handlers
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
        // Edit existing lesson
        await apiFetch(`/api/v2/admin/academy/lessons/${editingLessonId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: lessonTitle,
            content: lessonContent,
            videoUrl: lessonVideoUrl.trim() || '',
            orderIndex: lessonOrderIndex,
          }),
        });
        toast.success('Lesson updated successfully!');
      } else {
        // Create new lesson
        await apiFetch(`/api/v2/admin/academy/courses/${selectedCourse.id}/lessons`, {
          method: 'POST',
          body: JSON.stringify({
            title: lessonTitle,
            content: lessonContent,
            videoUrl: lessonVideoUrl.trim() || undefined,
            orderIndex: lessonOrderIndex,
          }),
        });
        toast.success('Lesson added successfully!');
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

  // Extract embeddable iframe URL for video preview
  const getEmbedVideoUrl = (url: string) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
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

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-outfit font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-400" />
            <span>Academy & LMS Content Manager</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Create and edit trading courses, video lectures (YouTube/Vimeo/MP4), lesson notes, and curriculum ordering.
          </p>
        </div>

        <button
          onClick={handleOpenCreateCourse}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
        </button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-mono">Loading LMS courses...</div>
        ) : courses.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 border border-dashed border-white/10 rounded-2xl">
            No courses found in LMS. Click "New Course" to create one.
          </div>
        ) : (
          courses.map((course) => (
            <div key={course.id} className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {course.category || 'CRYPTO'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-white/5">{course.difficulty || course.level || 'BEGINNER'}</span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition">{course.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{course.description}</p>
              </div>

              {/* Lessons Summary & Actions */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>{course.lessons?.length || 0} Video Lessons</span>
                  </span>
                  <button
                    onClick={() => setSelectedCourse(course)}
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20"
                  >
                    <span>Manage Content</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleOpenEditCourse(course)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center gap-1"
                    title="Edit Course Metadata"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-300" />
                    <span>Edit Course</span>
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
          ))
        )}
      </div>

      {/* Selected Course Content / Lesson Manager Drawer Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-4xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">{selectedCourse.category || 'ACADEMY'} COURSE CURRICULUM</span>
                <h2 className="text-xl font-bold text-white">{selectedCourse.title}</h2>
              </div>
              <button onClick={() => { setSelectedCourse(null); setPreviewVideoUrl(null); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player Preview (if video clicked) */}
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
                            title="Delete Lesson"
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

      {/* Course Modal (Create & Edit) */}
      {courseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">
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
                  placeholder="Comprehensive course syllabus and objective..."
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
              <button
                onClick={() => setCourseModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCourse}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20"
              >
                {editingCourseId ? 'Save Course' : 'Create Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Modal (Create & Edit) */}
      {lessonModal && selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              <span>{editingLessonId ? 'Edit Lesson' : `Add Lesson to ${selectedCourse.title}`}</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="text-slate-300 font-semibold block mb-1">Lesson Title</label>
                  <input
                    type="text"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="e.g. Identifying High-Probability Fair Value Gaps (FVGs)"
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Order #</label>
                  <input
                    type="number"
                    min="1"
                    value={lessonOrderIndex}
                    onChange={(e) => setLessonOrderIndex(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Video Stream / Lecture URL (YouTube, Vimeo, MP4)</label>
                <input
                  type="url"
                  value={lessonVideoUrl}
                  onChange={(e) => setLessonVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/video.mp4"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono text-slate-300"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Lesson Notes & Key Takeaways</label>
                <textarea
                  rows={4}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Detailed lesson explanation, key trade parameters, and notes for student traders..."
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setLessonModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLesson}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20"
              >
                {editingLessonId ? 'Update Lesson' : 'Save & Publish Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
