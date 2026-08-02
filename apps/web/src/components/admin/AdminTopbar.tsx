'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, Cpu, RefreshCw, ShieldAlert, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';

interface AdminTopbarProps {
  onOpenMobile?: () => void;
}

export function AdminTopbar({ onOpenMobile }: AdminTopbarProps) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    if (path.includes('/superadmin/users')) return 'User Management';
    if (path.includes('/superadmin/kyc')) return 'KYC Verification';
    if (path.includes('/superadmin/academy')) return 'Academy LMS';
    if (path.includes('/superadmin/signals')) return 'Signal Audit & Override';
    if (path.includes('/superadmin/audit-logs')) return 'System Audit Logs';
    return 'Executive Overview';
  };

  return (
    <header className="h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur-2xl px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-lg shadow-black/40">
      {/* Left section: Mobile menu & Breadcrumb */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/10"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Breadcrumb */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="text-slate-500">Superadmin</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <h2 className="text-sm md:text-base font-outfit font-bold text-white tracking-wide flex items-center gap-2">
            <span>{getPageTitle(pathname || '')}</span>
          </h2>
        </div>

        {/* Live System Telemetry Badge */}
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
          <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-semibold flex items-center gap-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>SYSTEM OPERATIONAL</span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span>v2.0.0</span>
          </div>
        </div>
      </div>

      {/* Right section: Action Buttons & Profile */}
      <div className="flex items-center gap-3">
        {/* Switch to Trader View shortcut */}
        <Link href="/dashboard" className="hidden md:block">
          <button className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span>Trader View</span>
          </button>
        </Link>

        {/* Refresh Page */}
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Admin Profile Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-400/40 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-purple-500/20">
            SA
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-white leading-tight">Superadmin</p>
            <p className="text-[10px] font-mono text-purple-400 font-semibold">MASTER ACCESS</p>
          </div>
        </div>
      </div>
    </header>
  );
}
