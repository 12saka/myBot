'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, Zap, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useMarketStore } from '@/store/useMarketStore';
import { cn, formatPercent } from '@/lib/utils';

const FEATURED = ['BTC/USD', 'ETH/USD', 'AAPL', 'EUR/USD'];

export function Topbar() {
  const { toggleSidebar } = useUIStore();
  const { tickers } = useMarketStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const featured = tickers.filter(t => FEATURED.includes(t.symbol));

  return (
    <header className="glass-panel sticky top-0 z-30 w-full border-b border-white/5">
      {/* Market ticker tape */}
      <div className="border-b border-white/4 overflow-hidden bg-black/20">
        <div className="flex gap-8 px-4 py-1.5 ticker-tape" style={{ width: 'max-content' }}>
          {[...featured, ...featured].map((ticker, i) => (
            <div key={i} className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-slate-400 font-medium">{ticker.symbol}</span>
              <span className="font-bold text-slate-200">
                {ticker.type === 'forex' ? ticker.price.toFixed(4) : ticker.price.toLocaleString()}
              </span>
              <span className={cn(
                'flex items-center gap-0.5 font-semibold',
                ticker.changePct24h >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {ticker.changePct24h >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {Math.abs(ticker.changePct24h).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main topbar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Mobile menu */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-lg btn-ghost"
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost text-xs text-slate-400 hover:text-slate-200 min-w-[200px]"
            >
              <Search size={14} />
              <span>Search markets, signals…</span>
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 font-mono">⌘K</kbd>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span className="text-xs font-semibold text-purple-300">AI Engine Active</span>
          </div>

          {/* Quick Trade */}
          <button className="hidden sm:flex btn-primary items-center gap-1.5 px-4 py-2 rounded-xl text-xs">
            <Zap size={14} />
            Quick Trade
          </button>

          {/* Notifications */}
          <button className="relative p-2 rounded-xl btn-ghost">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-purple-500 border border-surface-0" />
          </button>

          {/* Avatar */}
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/60 to-indigo-600/60 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-white cursor-pointer">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
