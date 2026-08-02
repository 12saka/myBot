'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  GraduationCap,
  Zap,
  Bot,
  Wallet,
  FileText,
  Settings,
  ShieldAlert,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_NAV_ITEMS = [
  { name: 'Overview', href: '/superadmin/dashboard', icon: LayoutDashboard },
  { name: 'User Management', href: '/superadmin/users', icon: Users },
  { name: 'KYC & Verification', href: '/superadmin/kyc', icon: ShieldCheck },
  { name: 'Academy LMS', href: '/superadmin/academy', icon: GraduationCap },
  { name: 'Signal Audit & Override', href: '/superadmin/signals', icon: Zap },
  { name: 'Audit Logs', href: '/superadmin/audit-logs', icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('trademind_token');
    localStorage.removeItem('trademind_profile');
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 border-r border-white/10 bg-slate-950/90 backdrop-blur-2xl flex flex-col justify-between h-dvh sticky top-0 z-40">
      <div>
        {/* Brand Banner */}
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <ShieldAlert className="text-white w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-outfit font-black text-lg text-white tracking-wider">TRADEMIND</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-purple-400/90 font-mono font-medium">SUPERADMIN PANEL</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
            Control Plane
          </div>
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    'relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-4 h-4 transition-colors', isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300')} />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-400" />}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer / Quick Back to App & Logout */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <Link href="/dashboard">
          <button className="w-full text-xs font-semibold py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center justify-between transition">
            <span>Switch to Trader View</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full text-xs font-semibold py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 flex items-center gap-2 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
