'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { GraduationCap, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminAcademyPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CRYPTO');
  const [level, setLevel] = useState('BEGINNER');

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/academy/courses');
      setCourses(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreate = async () => {
    if (!title || !description) {
      toast.error('Title and description are required.');
      return;
    }
    try {
      await apiFetch('/api/v2/admin/academy/courses', {
        method: 'POST',
        body: JSON.stringify({ title, description, category, level, isPublished: true }),
      });
      toast.success('Course created successfully');
      setModal(false);
      setTitle('');
      setDescription('');
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Course creation failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete course "${name}"?`)) return;
    try {
      await apiFetch(`/api/v2/admin/academy/courses/${id}`, { method: 'DELETE' });
      toast.success('Course deleted');
      fetchCourses();
    } catch (err: any) {
      toast.error(err.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-bold text-white">Academy Content Manager</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Create, publish, edit, and delete LMS courses and lessons for platform traders.
          </p>
        </div>

        <button
          onClick={() => setModal(true)}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-purple-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Course</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500">Loading courses...</div>
        ) : courses.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500">No courses in LMS.</div>
        ) : (
          courses.map((course) => (
            <div key={course.id} className="glass-panel p-5 rounded-xl border border-white/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {course.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{course.level}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2">{course.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{course.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[11px] font-mono text-slate-500">{course.lessons?.length || 0} Lessons</span>
                <button
                  onClick={() => handleDelete(course.id, course.title)}
                  className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                  title="Delete Course"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Course Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Create New Academy Course</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Course Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Master Forex Price Action"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course summary and objective..."
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none"
                  >
                    <option value="CRYPTO">CRYPTO</option>
                    <option value="FOREX">FOREX</option>
                    <option value="RISK">RISK</option>
                    <option value="PSYCHOLOGY">PSYCHOLOGY</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none"
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
                onClick={() => setModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20"
              >
                Create & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
