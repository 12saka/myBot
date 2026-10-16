'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Cpu,
  Zap,
  Flame,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  Compass,
  TrendingUp,
  BarChart3,
  Clock
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function NasdaqEngineComingSoonPage() {
  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* 1. Header */}
      <PageHeader
        title="Am_100 — Nasdaq Quantitative Engine"
        subtitle="High-frequency microstructure order flow, Opening Range Breakouts & Big Tech gamma regimes for US100 / NQ."
      >
        <div className="flex items-center gap-3">
          <Badge variant="blue" size="md" className="font-mono px-3 py-1 text-xs">
            CYBERNETIC ALGO IN CALIBRATION
          </Badge>
          <Link
            href="/dashboard/engines/gold"
            className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <Flame size={14} className="text-amber-400" />
            <span>Switch to MasterGold (Live)</span>
          </Link>
        </div>
      </PageHeader>

      {/* 2. Hero Coming Soon Canvas */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/25 via-slate-950/80 to-slate-950/95 p-8 sm:p-14 shadow-2xl">
        {/* Futuristic Grid and Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
          {/* Animated Icon Avatar */}
          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-cyan-500/30 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-xl shadow-cyan-500/20">
              <Cpu size={36} className="animate-spin-slow" />
            </div>
            <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-cyan-400 text-slate-950 uppercase tracking-widest shadow-md">
              NQ-100
            </span>
          </div>

          {/* Core Title & Tagline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles size={12} className="text-cyan-400" />
              Engine Version: Am_100 Beta Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-white tracking-tight">
              Institutional Speed for <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">Tech Index Alpha</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed">
              We are finalizing the sub-millisecond liquidity sweep algorithms, Wall Street 09:30 ET Opening Range Breakout (ORB) models, and real-yield duration discounting matrix for Nasdaq 100.
            </p>
          </div>

          {/* Cool Features Pill Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-4">
            {[
              {
                title: '09:30 ET Opening Range Breakouts',
                desc: 'Captures early Wall Street cash open institutional impulse and liquidity runs.',
                icon: Clock,
                tag: 'ORB'
              },
              {
                title: 'Mag-7 Duration Beta Matrix',
                desc: 'Synthesizes 10Y Treasury yield swings directly into tech discount multiples.',
                icon: Activity,
                tag: 'MACRO'
              },
              {
                title: '15:00 ET Power Hour Gamma Surge',
                desc: 'Monitors institutional options delta unwinding in the final trading hour.',
                icon: TrendingUp,
                tag: 'GAMMA'
              },
              {
                title: '5-Gate Capital Guardian Active',
                desc: 'Protected by identical institutional risk veto constitution as MasterGold.',
                icon: Shield,
                tag: 'RISK'
              }
            ].map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-cyan-500/30 transition-all flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0 group-hover:scale-105 transition-transform">
                  <f.icon size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{f.title}</span>
                    <span className="text-[9px] font-mono px-1.5 rounded bg-white/5 text-cyan-300 border border-white/10 font-bold">{f.tag}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Simulated Calibration Terminal Stream */}
          <div className="w-full rounded-2xl bg-black/80 border border-white/10 p-4 font-mono text-[11px] text-left space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between text-slate-500 border-b border-white/5 pb-2 mb-2">
              <span className="flex items-center gap-1.5">
                <Terminal size={12} className="text-cyan-400" />
                Am_100 Autonomous Neural Synthesis
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                98.7% TRAINING CONVERGENCE
              </span>
            </div>
            <div className="text-slate-400">[09:30:00.124] Ingesting CME Nasdaq E-mini level 2 tick stream...</div>
            <div className="text-cyan-300">[09:30:01.048] US10Y Yield cross-correlation coefficient: -0.84 verified.</div>
            <div className="text-teal-300">[09:30:02.412] 5-Minute Fair Value Gap engine: calibrated across 12,000 historic cycles.</div>
            <div className="text-emerald-400 font-bold">[09:30:03.980] Status: READY FOR BETA BENCHMARK DEPLOYMENT.</div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/engines/gold"
              className="btn-primary py-3 px-6 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <span>Explore Live MasterGold Signals</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/signals"
              className="btn-ghost py-3 px-5 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
            >
              <span>View Signal Terminal</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
