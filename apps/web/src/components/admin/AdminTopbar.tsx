'use client';

import React from 'react';
import { ShieldCheck, Cpu, RefreshCw, Bell } from 'lucide-react';

export function AdminTopbar() {
  return (
    <header className="h-16 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          SYSTEM OPERATIONAL
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span>API Gateway: v2.0.0</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
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
