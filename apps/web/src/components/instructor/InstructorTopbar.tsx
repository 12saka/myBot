'use client';

import React, { useState, useEffect } from 'react';
import { Menu, User as UserIcon, Shield, Bell, Sparkles } from 'lucide-react';

interface TopbarProps {
  onOpenMobile?: () => void;
}

export function InstructorTopbar({ onOpenMobile }: TopbarProps) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('trademind_profile');
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  const name = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email
    : 'Instructor';
  const role = profile?.role || 'INSTRUCTOR';

  return (
    <header className="h-16 border-b border-teal-500/20 bg-slate-900/60 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-bold text-white font-outfit">Instructor Studio</h1>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>EDUCATOR PRIVILEGE</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">Manage curriculum, assignments, grading, and Zoom live webinars</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-teal-500/30">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center border border-teal-500/30 text-teal-400">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-white block leading-none">{name}</span>
            <span className="text-[9px] font-mono text-teal-400 font-semibold">{role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
