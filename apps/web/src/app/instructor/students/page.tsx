'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Users,
  Award,
  BookOpen,
  FileCheck2,
  HelpCircle,
  Search,
  UserCheck,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/v2/instructor/students');
      setStudents(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load student roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-outfit">Student Roster & Progress Analytics</h2>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
              ACADEMIC ROSTER
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Track student engagement, quiz attempts, homework submissions, and certificates earned.</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student by name or email..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-teal-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="glass-panel rounded-2xl border border-teal-500/20 overflow-hidden bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-teal-500/20">
            <tr>
              <th className="p-4">Student</th>
              <th className="p-4">Role / Experience</th>
              <th className="p-4 text-center">Quiz Attempts</th>
              <th className="p-4 text-center">Submissions</th>
              <th className="p-4 text-center">Certificates</th>
              <th className="p-4">Joined Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-500 font-mono">
                  No students found matching search.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition">
                  <td className="p-4 font-semibold text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold font-mono">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="block">{s.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[10px]">
                      {s.role}
                    </span>
                  </td>
                  <td className="p-4 text-center font-mono text-white font-bold">
                    {s.totalQuizzes || 0}
                  </td>
                  <td className="p-4 text-center font-mono text-indigo-300 font-bold">
                    {s.totalSubmissions || 0}
                  </td>
                  <td className="p-4 text-center font-mono text-emerald-400 font-bold">
                    {s.certificatesEarned || 0}
                  </td>
                  <td className="p-4 font-mono text-slate-400">
                    {new Date(s.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
