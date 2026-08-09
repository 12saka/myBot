'use client';

import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

interface AdminPageBannerProps {
  badgeText?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
    color?: string;
  }>;
}

export function AdminPageBanner({
  badgeText = 'EXECUTIVE CONTROL PLANE',
  title,
  description,
  icon: Icon = Sparkles,
  actions,
  stats,
}: AdminPageBannerProps) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-slate-950 border border-purple-500/30 shadow-2xl relative overflow-hidden">
      {/* Decorative Glow Orb */}
      <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="space-y-2 relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-semibold">
          <Icon className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>{badgeText}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-outfit font-extrabold text-white tracking-wide flex items-center gap-3">
          <span>{title}</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-400 font-mono leading-relaxed">
          {description}
        </p>

        {stats && stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/10 mt-3">
            {stats.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase">{s.label}:</span>
                <span className={`text-xs font-mono font-bold ${s.color || 'text-purple-300'}`}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full lg:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
