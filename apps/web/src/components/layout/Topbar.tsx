'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, Zap, ChevronUp, ChevronDown, X, Cpu, Target, HelpCircle, User } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useMarketStore } from '@/store/useMarketStore';
import { cn } from '@/lib/utils';

const FEATURED = ['BTC/USD', 'ETH/USD', 'AAPL', 'EUR/USD'];

export function Topbar() {
  const router = useRouter();
  const { toggleSidebar } = useUIStore();
  const { tickers } = useMarketStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const featured = tickers.filter(t => FEATURED.includes(t.symbol));

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    photo: ''
  });

  const allAssets = [
    { symbol: 'BTC/USD', name: 'Bitcoin', type: 'crypto' },
    { symbol: 'ETH/USD', name: 'Ethereum', type: 'crypto' },
    { symbol: 'SOL/USD', name: 'Solana', type: 'crypto' },
    { symbol: 'BNB/USD', name: 'BNB Coin', type: 'crypto' },
    { symbol: 'XRP/USD', name: 'Ripple', type: 'crypto' },
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock' },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'forex' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar', type: 'forex' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', type: 'forex' },
  ];

  const searchResults = searchQuery
    ? allAssets.filter(
        (a) =>
          a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allAssets.slice(0, 5);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to profile changes in localStorage
  useEffect(() => {
    const loadProfile = () => {
      const saved = localStorage.getItem('trademind_profile');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setProfile({
            firstName: parsed.profileData?.firstName || '',
            lastName: parsed.profileData?.lastName || '',
            photo: parsed.profilePhoto || ''
          });
        } catch (e) {
          console.error(e);
        }
      }
    };

    loadProfile();
    window.addEventListener('storage', loadProfile);
    const interval = setInterval(loadProfile, 2000);

    return () => {
      window.removeEventListener('storage', loadProfile);
      clearInterval(interval);
    };
  }, []);

  const handleSelectAsset = (symbol: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(`/markets?symbol=${encodeURIComponent(symbol)}`);
  };

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

          {/* Search Trigger Button */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost text-xs text-slate-400 hover:text-slate-200 min-w-[200px] border border-white/5"
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

          {/* Notifications Bell */}
          <Link href="/settings?tab=ai" className="relative p-2 rounded-xl btn-ghost flex items-center justify-center">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-purple-500 border border-surface-0" />
          </Link>

          {/* Avatar Link to Settings */}
          <Link href="/settings" className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300 hover:scale-105 transition-all cursor-pointer">
            {profile.photo ? (
              <img src={profile.photo} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`.toUpperCase() || <User size={14} className="text-purple-300" />
            )}
          </Link>
        </div>
      </div>

      {/* Glassmorphic Command Palette Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-xl glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input header */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/5">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type asset (e.g. BTC, Apple) or command..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-500"
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="p-2 max-h-[300px] overflow-y-auto space-y-1">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => handleSelectAsset(item.symbol)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5 transition-all group"
                    >
                      <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-all">
                        {item.type === 'crypto' ? <Cpu size={14} /> : <Target size={14} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">{item.symbol}</div>
                        <div className="text-[10px] text-slate-500">{item.name}</div>
                      </div>
                      <span className="ml-auto text-[10px] uppercase font-bold text-slate-600 px-2 py-0.5 rounded border border-white/5">
                        {item.type}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-500 gap-2">
                    <HelpCircle size={24} />
                    <span className="text-xs">No matching assets found</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-600">
                <span>Use ↑↓ to navigate, Enter to select</span>
                <span>ESC to exit</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
