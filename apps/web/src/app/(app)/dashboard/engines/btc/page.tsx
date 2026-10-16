'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  Zap,
  Flame,
  ArrowRight,
  Shield,
  Sparkles,
  Terminal,
  TrendingUp,
  BarChart3,
  Coins,
  Globe2,
  Lock
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function BtcEngineComingSoonPage() {
  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* 1. Header */}
      <PageHeader
        title="MrCrypto-btc — Bitcoin Liquidity Engine"
        subtitle="24/7 Spot ETF institutional absorption, liquidation cluster heatmaps & CME gap mechanics for BTC/USD."
      >
        <div className="flex items-center gap-3">
          <Badge variant="amber" size="md" className="font-mono px-3 py-1 text-xs">
            24/7 ON-CHAIN ALPHALINK
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
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-950/25 via-slate-950/80 to-slate-950/95 p-8 sm:p-14 shadow-2xl">
        {/* Ambient Gold / Crypto Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
          {/* Animated Icon Avatar */}
          <div className="relative">
            <div className="absolute -inset-2 rounded-3xl bg-amber-500/30 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/30 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-500/20">
              <Coins size={36} className="text-amber-400" />
            </div>
            <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-amber-400 text-slate-950 uppercase tracking-widest shadow-md">
              BTC-21M
            </span>
          </div>

          {/* Core Title & Tagline */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles size={12} className="text-amber-400" />
              Engine Version: MrCrypto-btc Protocol
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-white tracking-tight">
              Sovereign Sound Money <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-200">Meets Quant Rigor</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed">
              We are training the 24/7 liquidation heatmap models, Wall Street Spot ETF creation/redemption arb feeds, and CME futures gap-fill probabilities for the king of digital assets.
            </p>
          </div>

          {/* Cool Features Pill Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-4">
            {[
              {
                title: 'Spot ETF Inflow Telemetry',
                desc: 'Real-time tracking of institutional custodian accumulation & redemption flows.',
                icon: Globe2,
                tag: 'INSTITUTIONAL'
              },
              {
                title: 'Liquidation Heatmap Scanner',
                desc: 'Pinpoints clustered stop losses and leveraged liquidation levels on perp desks.',
                icon: Activity,
                tag: 'LIQUIDITY'
              },
              {
                title: 'CME Weekend Gap Reclaim',
                desc: 'Algorithmic probability scoring for institutional CME futures gap fill retests.',
                icon: BarChart3,
                tag: 'GAPS'
              },
              {
                title: '24/7 Zero-Sleep Architecture',
                desc: 'Uninterrupted 5-Gate decision audits spanning Asian, European, and US sessions.',
                icon: Shield,
                tag: 'ALWAYS-ON'
              }
            ].map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-amber-500/30 transition-all flex items-start gap-3.5 group"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                  <f.icon size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{f.title}</span>
                    <span className="text-[9px] font-mono px-1.5 rounded bg-white/5 text-amber-300 border border-white/10 font-bold">{f.tag}</span>
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
                <Terminal size={12} className="text-amber-400" />
                MrCrypto-btc Autonomous On-Chain Stream
              </span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                ACTIVE MEMPOOL SYNCHRONIZATION
              </span>
            </div>
            <div className="text-slate-400">[00:00:00.010] Listening to Binance, Coinbase, and Deribit perpetual order books...</div>
            <div className="text-amber-300">[00:00:01.320] ETF net accumulation delta: +2,840 BTC absorbed at $67,400 liquidity floor.</div>
            <div className="text-orange-300">[00:00:02.780] Halving supply squeeze index: 94.2/100 bullish continuation regime.</div>
            <div className="text-emerald-400 font-bold">[00:00:03.940] Status: CALIBRATING 15M / 1H FRACTAL LIQUIDITY GATES.</div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/engines/gold"
              className="btn-primary py-3 px-6 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black"
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
