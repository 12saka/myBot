'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, Zap, ChevronUp, ChevronDown, X, Cpu, Target, HelpCircle, User, ShieldAlert } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { useMarketStore } from '@/store/useMarketStore';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';

const DEFAULT_FEATURED_TICKERS = [
  { symbol: 'BTC/USD', type: 'crypto' },
  { symbol: 'ETH/USD', type: 'crypto' },
  { symbol: 'XAU/USD', type: 'commodity' },
  { symbol: 'EUR/USD', type: 'forex' },
  { symbol: 'USD/JPY', type: 'forex' },
  { symbol: 'US100', type: 'index' },
  { symbol: 'US30', type: 'index' },
  { symbol: 'TSLA', type: 'stock' },
  { symbol: 'NVDA', type: 'stock' },
  { symbol: 'SOL/USD', type: 'crypto' }
];

export function Topbar() {
  const router = useRouter();
  const { toggleSidebar } = useUIStore();
  const { tickers } = useMarketStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Build the ticker tape from live store data. Defaults are symbol placeholders only.
  const featured = DEFAULT_FEATURED_TICKERS.map(def => {
    const live = tickers.find(t =>
      t.symbol === def.symbol ||
      (t.symbol === 'GOLD' && def.symbol === 'XAU/USD') ||
      (t.symbol === 'BTC' && def.symbol === 'BTC/USD') ||
      (t.symbol === 'ETH' && def.symbol === 'ETH/USD') ||
      (t.symbol === 'SOL' && def.symbol === 'SOL/USD')
    );
    if (live && typeof live.price === 'number' && !isNaN(live.price) && live.price > 0) {
      const hasRealChange =
        typeof live.changePct24h === 'number' &&
        Number.isFinite(live.changePct24h) &&
        (Math.abs(live.changePct24h) >= 0.005 || Math.abs(live.change24h || 0) > 0);

      return {
        ...def,
        price: live.price,
        changePct24h: hasRealChange ? live.changePct24h : null,
        type: live.type || def.type
      };
    }
    return { ...def, price: null, changePct24h: null };
  }).filter((item, index, self) => index === self.findIndex(t => t.symbol === item.symbol));

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    photo: '',
    role: ''
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
            photo: parsed.profilePhoto || '',
            role: parsed.role || parsed.profileData?.role || ''
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

  // Load and poll notifications
  useEffect(() => {
    let previousIds = new Set<string>();

    const fetchNotifications = async () => {
      try {
        const list = await apiFetch<any[]>('/api/v2/notifications');
        if (Array.isArray(list)) {
          // If this is not the initial empty load, check for new unread notifications
          if (previousIds.size > 0) {
            const newUnread = list.filter(n => !n.isRead && !previousIds.has(n.id));
            newUnread.forEach(notif => {
              toast(notif.message || notif.title, {
                icon: '⚡',
                className: '!max-w-[90vw] md:!max-w-md',
                style: {
                  borderRadius: '12px',
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  fontSize: '12px',
                },
              });
            });
          }
          // Update the tracked IDs
          previousIds = new Set(list.map(n => n.id));
          setNotifications(list);
        }
      } catch (err) {
        // Silently catch auth or network issues
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  // Continuous live market price polling for topbar ticker tape (every 2.5 seconds)
  const setTickers = useMarketStore(s => s.setTickers);
  useEffect(() => {
    const pollLivePrices = async () => {
      try {
        const rawMarkets = await apiFetch<any[]>('/api/v2/markets/tickers');
        if (Array.isArray(rawMarkets)) {
          const mapped = rawMarkets.map(m => {
            const price = Number(m.bidPrice || m.price || 0);
            const changePct24h = Number(m.changePct24h || 0.0);
            const change24h = Number(m.change24h || (price * (changePct24h / 100)));
            return {
              symbol: m.symbol === 'GOLD' ? 'XAU/USD' : m.symbol,
              name: m.name || m.symbol,
              price,
              change24h,
              changePct24h,
              high24h: Number(m.high24h || price * 1.01),
              low24h: Number(m.low24h || price * 0.99),
              volume24h: Number(m.volume24h || 0),
              marketCap: Number(m.marketCap || 0),
              type: (m.type || 'forex') as any
            };
          }).filter(m => m.price > 0);
          if (mapped.length > 0) {
            setTickers(mapped);
          }
        }
      } catch (err) {}
    };
    pollLivePrices();
    const interval = setInterval(pollLivePrices, 2500);
    return () => clearInterval(interval);
  }, [setTickers]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.notifications-bell-container')) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/v2/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err: any) {
      console.error(err);
    }
  };

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
            <div key={i} className="flex items-center gap-2 text-xs whitespace-nowrap min-w-max">
              <span className="text-slate-400 font-medium">{ticker.symbol}</span>
              <span className="font-bold text-slate-200">
                {!ticker.price ? (
                  <span className="text-slate-500 font-mono text-[10px]">Loading...</span>
                ) : ticker.symbol.includes('JPY') ? ticker.price.toFixed(2)
                  : ticker.symbol.includes('EUR') || ticker.symbol.includes('GBP') ? ticker.price.toFixed(4)
                  : ticker.symbol.includes('XAU') || ticker.symbol.includes('GOLD') ? `$${ticker.price.toFixed(2)}`
                  : ticker.price > 1000 ? `$${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `$${ticker.price.toFixed(2)}`}
              </span>
              {ticker.price && ticker.changePct24h !== null && ticker.changePct24h !== undefined ? (
                <span className={cn(
                  'flex items-center gap-0.5 font-semibold',
                  ticker.changePct24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {ticker.changePct24h >= 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {Math.abs(ticker.changePct24h).toFixed(2)}%
                </span>
              ) : ticker.price ? (
                <span className="text-[10px] text-emerald-400/80 font-mono">Live</span>
              ) : null}
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
          {/* Admin Back Link Button for Superadmins */}
          {(profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') && (
            <Link href="/superadmin/dashboard">
              <button className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-500/10 transition-all cursor-pointer">
                <ShieldAlert size={14} className="text-purple-400" />
                <span className="hidden xs:inline">Admin Panel</span>
              </button>
            </Link>
          )}

          {/* AI Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span className="text-xs font-semibold text-purple-300">AI Engine Active</span>
          </div>

          {/* Notifications Bell */}
          <div className="relative notifications-bell-container">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 rounded-xl hover:bg-white/5 flex items-center justify-center relative cursor-pointer"
            >
              <Bell size={18} className="text-slate-300 hover:text-white transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-purple-500 ring-2 ring-slate-950 animate-pulse" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 glass-panel rounded-2xl border border-white/10 shadow-2xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Recent Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold transition-colors cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                  {notifications.filter(n => !n.isRead).length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-slate-500">
                      No new notifications
                    </div>
                  ) : (
                    notifications.filter(n => !n.isRead).slice(0, 4).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkSingleRead(notif.id)}
                        className="p-2.5 rounded-xl border transition-all text-left cursor-pointer bg-purple-500/5 border-purple-500/10 text-slate-200 hover:bg-purple-500/10"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-bold text-[11px] block truncate text-white">{notif.title}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0 animate-pulse" />
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-400 break-words">{notif.message}</p>
                        <span className="text-[9px] text-slate-500 mt-1 block">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-white/5 pt-2 flex justify-center">
                  <Link
                    href="/settings?tab=notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="text-[10px] text-center font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline transition-colors"
                  >
                    View All Notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

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
