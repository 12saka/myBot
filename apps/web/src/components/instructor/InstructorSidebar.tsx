'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck2,
  HelpCircle,
  Video,
  Users,
  GraduationCap,
  Sparkles,
  ChevronRight,
  LogOut,
  MessageSquare,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function InstructorSidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Instructor Overview', href: '/instructor/dashboard', icon: LayoutDashboard },
    { label: 'My Courses Studio', href: '/instructor/courses', icon: BookOpen },
    { label: 'Homework & Grading Queue', href: '/instructor/assignments', icon: FileCheck2 },
    { label: 'Quizzes & Question Bank', href: '/instructor/quizzes', icon: HelpCircle },
    { label: 'Zoom Live Webinars', href: '/instructor/webinars', icon: Video },
    { label: 'Daily Updates & QOTD', href: '/instructor/daily-updates', icon: Sparkles },
    { label: 'Community Q&A Hub', href: '/instructor/discussions', icon: MessageSquare },
    { label: 'Student Roster & Health', href: '/instructor/students', icon: Users },
  ];

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-teal-500/20 flex items-center justify-between">
          <Link href="/instructor/dashboard" onClick={onCloseMobile} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-500 to-indigo-600 p-0.5 shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-outfit font-black text-lg tracking-wider text-white">TRADE<span className="text-teal-400">MIND</span></span>
                <span className="text-[9px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 rounded">EDU</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">Instructor Portal & Studio</p>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="py-4 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono font-bold text-teal-400/70 uppercase tracking-wider">
            Academy Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/20 to-indigo-500/10 text-teal-300 border border-teal-500/30 shadow-md shadow-teal-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-400" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Info & Quick Exit */}
      <div className="p-4 border-t border-teal-500/20 bg-slate-950/40 space-y-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-teal-950/30 to-indigo-950/20 border border-teal-500/20">
          <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Scoped Privilege</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            You are signed in as an Educator. All curriculum, grading, quizzes, and live webinars are scoped to your studio.
          </p>
        </div>

        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Return to Main App</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-teal-500/20 bg-slate-950/95 backdrop-blur-2xl flex-col justify-between h-dvh sticky top-0 z-40 shrink-0">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[80vw] bg-slate-950 border-r border-teal-500/20 h-full flex flex-col z-50">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
