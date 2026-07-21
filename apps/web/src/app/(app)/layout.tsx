'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { motion } from 'framer-motion';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useMarketStore } from '@/store/useMarketStore';
import { useAIStore } from '@/store/useAIStore';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  Briefcase,
  BookOpen,
  Newspaper,
} from 'lucide-react';
import {
  apiFetch,
  mapPositionsToPortfolio,
  mapSignal,
  mapTicker,
  normalizeProfile,
  saveProfileSnapshot,
} from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setPortfolio } = usePortfolioStore();
  const { setTickers, setWatchlist } = useMarketStore();
  const { setSignals } = useAIStore();
  const { sidebarOpen } = useUIStore();

  useEffect(() => {
    // Guard check: Redirect unauthenticated user immediately
    const initialToken = localStorage.getItem('trademind_token');
    if (!initialToken) {
      router.push('/login');
      return;
    }

    const syncAppData = async () => {
      const token = localStorage.getItem('trademind_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const [user, rawPositions, rawTickers, rawSignals, rawPerformance] = await Promise.all([
          apiFetch<any>('/api/v2/users/me'),
          apiFetch<any[]>('/api/v2/portfolio/positions'),
          apiFetch<any[]>('/api/v2/markets/tickers'),
          apiFetch<any[]>('/api/v2/signals'),
          apiFetch<any[]>('/api/v2/portfolio/performance'),
        ]);

        const liveTickers = rawTickers.map(mapTicker);
        setTickers(liveTickers);
        setSignals(rawSignals.map(mapSignal));

        // Sync watchlist from database profile preferredAssets
        const preferredStr = user.profile?.preferredAssets || '';
        if (preferredStr) {
          const list = preferredStr.split(',').map((s: string) => s.trim()).filter(Boolean);
          setWatchlist(list);
        }

        // Map performance history
        const performanceHistory = rawPerformance.map((h: any) => ({
          date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          value: h.balance
        })).reverse();

        const profileData = normalizeProfile(user);
        saveProfileSnapshot(profileData, { profilePhoto: user.profile?.avatarUrl || '' });
        
        setPortfolio({
          ...mapPositionsToPortfolio(user, rawPositions, liveTickers),
          performanceHistory
        });
      } catch (err) {
        console.error('[AppLayout] Failed to sync app data:', err);
      }
    };

    syncAppData();
    const interval = setInterval(syncAppData, 10000);
    return () => clearInterval(interval);
  }, [router, setPortfolio, setSignals, setTickers, setWatchlist]);

  return (
    <WebSocketProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <Topbar />
          <motion.main
            className="flex-1 overflow-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">
              {children}
            </div>
          </motion.main>

          {/* Mobile Bottom Navigation */}
          {!sidebarOpen && (
            <nav className="glass-panel fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 py-2 md:hidden">
              <div className="flex items-center justify-around px-2">
                {[
                  { href: '/dashboard', label: 'Home',      icon: LayoutDashboard },
                  { href: '/markets',   label: 'Markets',   icon: TrendingUp },
                  { href: '/signals',   label: 'Signals',   icon: Zap },
                  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
                  { href: '/news',      label: 'News',      icon: Newspaper },
                  { href: '/academy',   label: 'Academy',   icon: BookOpen },
                ].map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname?.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-1.5 transition-all relative shrink-0",
                        isActive ? "text-purple-400" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <Icon size={18} className={cn("transition-transform duration-200", isActive && "scale-110")} />
                      <span className="text-[9px] font-bold tracking-wide uppercase">{label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </div>
    </WebSocketProvider>
  );
}
