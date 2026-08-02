'use client';

import React from 'react';
import { Menu, Cpu, RefreshCw, ShieldCheck } from 'lucide-react';

interface AdminTopbarProps {
  onOpenMobile?: () => void;
}

export function AdminTopbar({ onOpenMobile }: AdminTopbarProps) {
  return (
    <header className="h-16 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Button */}
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition"
          aria-label="Toggle Admin Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden xs:inline">SYSTEM OPERATIONAL</span>
          <span className="xs:hidden">LIVE</span>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span>API Gateway: v2.0.0</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-xs">
            SA
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">Superadmin</p>
            <p className="text-[10px] font-mono text-purple-400">SUPER_ADMIN</p>
          </div>
        </div>
      </div>
    </header>
  );
}
