'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Flame, 
  Layers, 
  Target, 
  Globe2, 
  ShieldAlert, 
  History, 
  ChevronRight,
  TrendingUp,
  Activity,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Overview Cockpit',
    href: '/dashboard/engines/gold',
    icon: Flame,
    description: 'Hero Barometer & Live 5-Gate State'
  },
  {
    name: 'Multi-TF Structure',
    href: '/dashboard/engines/gold/analysis',
    icon: Layers,
    description: '4H/1H/15M Liquidity & FVGs'
  },
  {
    name: 'Entry Intelligence',
    href: '/dashboard/engines/gold/entries',
    icon: Target,
    description: 'Strategy Selector & Confluence'
  },
  {
    name: 'Macro & News Shield',
    href: '/dashboard/engines/gold/fundamentals',
    icon: Globe2,
    description: 'DXY, Yields & ForexFactory'
  },
  {
    name: 'Risk & Execution',
    href: '/dashboard/engines/gold/risk',
    icon: ShieldAlert,
    description: 'Position Sizing & Spread Guard'
  },
  {
    name: 'Verified History',
    href: '/dashboard/engines/gold/history',
    icon: History,
    description: 'Immutable Audit Ledger'
  }
];

interface GoldHeaderNavProps {
  currentPrice?: number;
  spread?: number;
  regime?: string;
  session?: string;
}

export function GoldHeaderNav({ currentPrice, spread, regime, session }: GoldHeaderNavProps) {
  const pathname = usePathname();

  return (
    <div className="w-full space-y-4">
      {/* Top Gold Engine Branding Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0B0F17] via-[#131926] to-[#0B0F17] border border-amber-500/25 p-5 shadow-2xl">
        {/* Subtle 24K Gold ambient radial glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 border border-amber-300/40">
              <Flame className="text-slate-950 fill-slate-950" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Institutional Intelligence
                </span>
                <span className="text-xs font-mono text-slate-400">v3.2 PROD</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                TradeMind <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500">Gold Engine</span>
              </h1>
            </div>
          </div>

          {/* Quick HUD Metrics */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            {currentPrice !== undefined && (
              <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[10px] uppercase font-bold text-slate-400">Spot XAU/USD</div>
                <div className="text-base font-black font-mono text-amber-400">
                  ${currentPrice.toFixed(2)}
                </div>
              </div>
            )}
            {spread !== undefined && (
              <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[10px] uppercase font-bold text-slate-400">Broker Spread</div>
                <div className={cn(
                  "text-base font-black font-mono",
                  spread <= 0.60 ? "text-emerald-400" : spread <= 1.50 ? "text-amber-400" : "text-rose-400"
                )}>
                  ${spread.toFixed(2)}
                </div>
              </div>
            )}
            {session && (
              <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-amber-500/20 backdrop-blur-md">
                <div className="text-[10px] uppercase font-bold text-slate-400">Active Session</div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {session}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Luxury Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-amber-500/15">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-black/20 text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/5"
              )}
            >
              <Icon 
                size={15} 
                className={cn(
                  "transition-colors",
                  isActive ? "text-amber-400" : "text-slate-500 group-hover:text-amber-300"
                )} 
              />
              <span>{item.name}</span>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
