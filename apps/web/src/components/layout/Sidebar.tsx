'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, TrendingUp, Zap, Briefcase,
  Wallet, Settings2, BookOpen, Bot, ChevronLeft,
  ChevronRight, Bell, Shield, Activity, BarChart3,
  Cpu, LogOut, User
} from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';


const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/markets',    label: 'Markets',      icon: TrendingUp       },
      { href: '/signals',    label: 'AI Signals',   icon: Zap              },
      { href: '/portfolio',  label: 'Portfolio',    icon: Briefcase        },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/wallet',     label: 'Wallet',       icon: Wallet           },
      { href: '/orders',     label: 'Orders',       icon: BarChart3        },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/copilot',    label: 'AI Copilot',   icon: Bot              },
      { href: '/automation', label: 'Automation',   icon: Cpu              },
      { href: '/academy',    label: 'Academy',      icon: BookOpen         },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings',   label: 'Settings',     icon: Settings2        },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out of your session?');
    if (!confirmLogout) return;

    localStorage.removeItem('trademind_token');
    localStorage.removeItem('trademind_profile');
    toast.success('Successfully logged out.');
    router.push('/login');
  };

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    photo: ''
  });

  // Read profile changes from localStorage
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

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full flex flex-col glass-panel border-r border-white/6',
          'transition-all duration-300 ease-in-out',
          'md:sticky md:top-0 md:flex md:h-screen',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        style={{ width: sidebarCollapsed ? '72px' : '240px' }}
        animate={{ width: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-white/5 min-h-[64px]">
          <div className="relative flex-shrink-0">
            <span className="relative flex h-8 w-8">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-8 w-8 bg-gradient-to-br from-purple-500 to-indigo-600 items-center justify-center">
                <Activity size={16} className="text-white" />
              </span>
            </span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="font-display text-lg font-bold tracking-tight gradient-text">
                  TradeMind
                </span>
                <span className="text-xs text-purple-400 font-semibold ml-1">AI</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-6 no-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <div className="px-4 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="px-2 space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname?.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn('sidebar-link group', isActive && 'active')}
                      title={sidebarCollapsed ? label : undefined}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'
                        )}
                      />
                      <AnimatePresence>
                        {!sidebarCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="whitespace-nowrap"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: User + Collapse */}
        <div className="border-t border-white/5 p-3 space-y-2">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center font-bold text-xs text-purple-300">
              {profile.photo ? (
                <img src={profile.photo} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                `${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`.toUpperCase() || <User size={14} className="text-purple-300" />
              )}
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-xs font-semibold text-slate-200 whitespace-nowrap min-h-[16px]">
                    {profile.firstName ? `${profile.firstName} ${profile.lastName}` : <span className="h-3.5 w-20 bg-white/5 animate-pulse rounded block" />}
                  </div>
                  <div className="text-[10px] text-slate-500">Premium Account</div>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={handleLogout}
            className={cn(
              'w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 cursor-pointer transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <LogOut size={18} className="flex-shrink-0" />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-semibold whitespace-nowrap"
                >
                  Log Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex w-full items-center justify-center gap-2 p-2 rounded-xl btn-ghost text-xs font-medium"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
