'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Play, Calendar, Star, Clock,
  ArrowRight, Search, Award, GraduationCap, Video
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';

const MOCK_COURSES = [
  { id: 'c1', title: 'Introduction to AI Trading', level: 'Beginner', duration: '2 hours', rating: 4.8, students: '12K', lectures: 10 },
  { id: 'c2', title: 'Mastering Smart Money Concepts', level: 'Intermediate', duration: '5 hours', rating: 4.9, students: '8K', lectures: 18 },
  { id: 'c3', title: 'Algorithmic Backtesting Principles', level: 'Intermediate', duration: '3 hours', rating: 4.7, students: '5K', lectures: 12 },
  { id: 'c4', title: 'Advanced Neural Network Strategies', level: 'Advanced', duration: '8 hours', rating: 4.9, students: '3K', lectures: 24 },
];

const MOCK_LIVE = [
  { id: 'l1', title: 'AI Signals Weekly Market Review', host: 'Alex Mercer (Head of Trading)', date: 'Today, 18:00 UTC', status: 'LIVE SOON' },
  { id: 'l2', title: 'Backtesting Workshop: Risk Management', host: 'Elena Rostova (Lead Data Scientist)', date: 'July 5, 14:00 UTC', status: 'REGISTERED' },
];

export default function AcademyPage() {
  const [activeLevel, setActiveLevel] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [search, setSearch] = useState('');

  const filteredCourses = MOCK_COURSES.filter(course => {
    const matchLevel = activeLevel === 'All' || course.level === activeLevel;
    const matchSearch = course.title.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const handleEnroll = (title: string) => {
    toast.success(`Successfully enrolled in "${title}"!`);
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Academy Hub"
        subtitle="Learn trading strategies, backtesting skills, and quantitative concepts from experts."
        icon={BookOpen}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Core content */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
              {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    activeLevel === lvl ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-glass pl-8 pr-4 py-2 rounded-xl text-xs w-52 md:w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredCourses.map((course) => (
              <div key={course.id} className="glass-card rounded-2xl p-5 flex flex-col justify-between h-56">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Badge variant={course.level === 'Beginner' ? 'blue' : course.level === 'Intermediate' ? 'purple' : 'amber'} size="xs">
                      {course.level}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-amber-400 font-bold">
                      <Star size={12} className="fill-amber-400" />
                      {course.rating}
                    </div>
                  </div>
                  <h3 className="font-bold text-slate-200 text-sm mb-2">{course.title}</h3>
                  <div className="flex gap-4 text-[10px] text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><Clock size={12} /> {course.duration}</span>
                    <span className="flex items-center gap-1"><GraduationCap size={12} /> {course.lectures} lectures</span>
                    <span>{course.students} students</span>
                  </div>
                </div>
                <button
                  onClick={() => handleEnroll(course.title)}
                  className="w-full btn-ghost py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-purple-500 hover:text-white hover:border-purple-600 transition-all mt-4"
                >
                  Start Course <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live sessions & Webinars sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
              <Video size={16} className="text-purple-400" />
              Live Webinars
            </h3>
            <div className="space-y-4">
              {MOCK_LIVE.map((live) => (
                <div key={live.id} className="p-3.5 rounded-xl border border-white/5 bg-white/2 space-y-2">
                  <div className="flex justify-between items-center">
                    <Badge variant={live.status.includes('LIVE') ? 'buy' : 'purple'} size="xs">
                      {live.status}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-slate-200 text-xs leading-normal">{live.title}</h4>
                  <p className="text-[10px] text-slate-500">{live.host}</p>
                  <div className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold pt-1">
                    <Calendar size={12} />
                    {live.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-48">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award size={18} className="text-purple-400" />
                <h3 className="font-display font-bold text-white text-sm">Certification Progress</h3>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Complete basic training courses to unlock institutional API integration features.
              </p>
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Completed</span>
                <span className="text-white font-bold">25% (1/4 Courses)</span>
              </div>
              <div className="progress-track h-1.5">
                <div className="progress-fill-purple h-full" style={{ width: '25%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
