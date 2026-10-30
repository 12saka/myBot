'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, User as UserIcon, Bell, Sparkles, GraduationCap, Megaphone, Zap, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface TopbarProps {
  onOpenMobile?: () => void;
}

export function InstructorTopbar({ onOpenMobile }: TopbarProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const seenNotifIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef<boolean>(true);

  useEffect(() => {
    const raw = localStorage.getItem('trademind_profile');
    if (raw) {
      try {
        setProfile(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const list = await apiFetch<any[]>('/api/v2/notifications');
        if (Array.isArray(list)) {
          if (isInitialLoad.current) {
            list.forEach((n) => seenNotifIds.current.add(n.id));
            isInitialLoad.current = false;
          } else {
            list.forEach((n) => {
              if (!seenNotifIds.current.has(n.id) && !n.isRead) {
                seenNotifIds.current.add(n.id);
                toast.success(`${n.title}: ${n.message}`, { duration: 6000 });
              }
            });
          }
          setNotifications(list);
        }
      } catch (e) {}
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.instructor-notif-container')) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/v2/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (e) {}
  };

  const handleMarkSingleRead = async (id: string, linkUrl?: string) => {
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {}
    if (linkUrl) {
      setDropdownOpen(false);
      router.push(linkUrl);
    }
  };

  const name = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email
    : 'Instructor';
  const role = profile?.role || 'INSTRUCTOR';

  return (
    <header className="h-16 border-b border-teal-500/20 bg-slate-950/95 backdrop-blur-2xl px-4 md:px-6 flex items-center justify-between z-40 shrink-0 shadow-xl shadow-black/50">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 md:hidden transition border border-white/10"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-bold text-white font-outfit">Instructor Studio</h1>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>EDUCATOR PRIVILEGE</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">Manage curriculum, study notes, assignments, grading, and live webinars</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/academy"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-teal-500/15 text-slate-300 hover:text-teal-300 border border-white/10 hover:border-teal-500/30 text-xs font-semibold transition"
        >
          <GraduationCap className="w-3.5 h-3.5 text-teal-400" />
          <span>Student Academy View</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </Link>

        {/* Instructor Notifications Bell */}
        <div className="relative instructor-notif-container">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-white/10 border border-white/10 flex items-center justify-center relative cursor-pointer transition"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-teal-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-84 max-w-sm rounded-2xl border border-teal-500/25 bg-slate-950/95 backdrop-blur-2xl shadow-2xl p-4 z-50 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Instructor Alerts & Submissions</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-teal-400 hover:text-teal-300 font-bold transition-colors cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {notifications.filter((n) => !n.isRead).length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-slate-500 font-mono">
                    No unread notifications
                  </div>
                ) : (
                  notifications
                    .filter((n) => !n.isRead)
                    .slice(0, 8)
                    .map((notif) => {
                      const isAcademy = notif.type?.includes('ACADEMY');
                      const isBroadcast = notif.type?.includes('ADMIN');
                      const isSignal = notif.type?.includes('SIGNAL');

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkSingleRead(notif.id, notif.linkUrl)}
                          className="p-2.5 rounded-xl border transition-all text-left cursor-pointer bg-slate-900/70 border-white/5 hover:border-teal-500/30 hover:bg-teal-500/10 text-slate-200 group flex items-start gap-2.5"
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                              isAcademy
                                ? 'bg-teal-500/20 text-teal-300'
                                : isBroadcast
                                ? 'bg-purple-500/20 text-purple-300'
                                : isSignal
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-blue-500/20 text-blue-300'
                            )}
                          >
                            {isAcademy ? (
                              <GraduationCap size={12} />
                            ) : isBroadcast ? (
                              <Megaphone size={12} />
                            ) : isSignal ? (
                              <Zap size={12} />
                            ) : (
                              <Bell size={12} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-semibold text-[11px] block truncate text-white group-hover:text-teal-300 transition-colors">
                                {notif.title}
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0 animate-pulse" />
                            </div>
                            <p className="text-[10px] leading-tight text-slate-400 line-clamp-2">{notif.message}</p>
                            <span className="text-[9px] text-slate-500 mt-1 block font-mono">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="border-t border-white/10 pt-2 flex justify-center">
                <Link
                  href="/notifications"
                  onClick={() => setDropdownOpen(false)}
                  className="text-[10px] text-center font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 hover:underline transition-colors"
                >
                  Open Notification Center →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-teal-500/30">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center border border-teal-500/30 text-teal-400">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-white block leading-none">{name}</span>
            <span className="text-[9px] font-mono text-teal-400 font-semibold">{role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
