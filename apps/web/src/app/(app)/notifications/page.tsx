'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  GraduationCap,
  Zap,
  Megaphone,
  CheckCircle2,
  Inbox,
  ArrowUpRight,
  Search,
  Trash2,
  RefreshCw,
  ShieldAlert,
  BookOpen,
  FileText,
  FileCheck2,
  Video,
  Sparkles,
  Check,
  Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

type FilterType = 'All' | 'Unread' | 'Academy' | 'Signals' | 'Admin' | 'System';

function getRelativeTime(dateString?: string) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function classifyNotificationCategory(notif: any): 'Academy' | 'Signals' | 'Admin' | 'System' {
  const t = (notif.type || '').toUpperCase();
  const title = (notif.title || '').toLowerCase();

  if (
    t === 'ACADEMY' ||
    title.includes('course') ||
    title.includes('lesson') ||
    title.includes('study note') ||
    title.includes('homework') ||
    title.includes('assignment') ||
    title.includes('quiz') ||
    title.includes('webinar') ||
    title.includes('daily challenge')
  ) {
    return 'Academy';
  }
  if (t === 'SIGNAL' || title.includes('signal') || title.includes('xau') || title.includes('gold engine')) {
    return 'Signals';
  }
  if (
    t.startsWith('ADMIN') ||
    ['PROMOTION', 'UPDATE', 'MAINTENANCE'].includes(t) ||
    title.includes('broadcast')
  ) {
    return 'Admin';
  }
  return 'System';
}

function getSmartBadge(notif: any) {
  const title = (notif.title || '').toLowerCase();
  const cat = classifyNotificationCategory(notif);

  if (title.includes('homework') || title.includes('assignment')) {
    return {
      label: 'Homework & Grading',
      icon: FileCheck2,
      pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      iconBox: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    };
  }
  if (title.includes('study note') || title.includes('lesson') || title.includes('breakdown') || title.includes('recap')) {
    return {
      label: 'Study Notes',
      icon: FileText,
      pillClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      iconBox: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
    };
  }
  if (title.includes('course')) {
    return {
      label: 'Course Curriculum',
      icon: BookOpen,
      pillClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      iconBox: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
    };
  }
  if (title.includes('quiz') || title.includes('assessment') || title.includes('challenge')) {
    return {
      label: 'Quiz & XP Challenge',
      icon: Sparkles,
      pillClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      iconBox: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    };
  }
  if (title.includes('zoom') || title.includes('webinar') || title.includes('live class')) {
    return {
      label: 'Live Zoom Class',
      icon: Video,
      pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      iconBox: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    };
  }
  if (cat === 'Academy') {
    return {
      label: 'Academy Hub',
      icon: GraduationCap,
      pillClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      iconBox: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
    };
  }
  if (cat === 'Signals') {
    return {
      label: 'Engine Signal',
      icon: Zap,
      pillClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      iconBox: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    };
  }
  if (cat === 'Admin') {
    return {
      label: 'Platform Broadcast',
      icon: Megaphone,
      pillClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      iconBox: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    };
  }
  return {
    label: notif.type === 'Security' ? 'Security Alert' : 'System Dispatch',
    icon: notif.type === 'Security' ? ShieldAlert : Bell,
    pillClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    iconBox: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const deduplicateClientList = (list: any[]) => {
    const seen = new Set<string>();
    return list.filter((n) => {
      const sig = `${(n.type || '').trim()}::${(n.title || '').trim().toLowerCase()}::${(n.message || '').trim().toLowerCase()}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  };

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const list = await apiFetch<any[]>('/api/v2/notifications');
      if (Array.isArray(list)) {
        setNotifications(deduplicateClientList(list));
      }
    } catch (err) {
      if (!silent) toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/v2/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm('Clear all notifications from your inbox?')) return;
    try {
      await apiFetch('/api/v2/notifications/clear-all', { method: 'DELETE' });
      setNotifications([]);
      toast.success('Notification inbox cleared');
    } catch (err) {
      toast.error('Failed to clear notifications');
    }
  };

  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v2/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification removed');
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {}
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      try {
        await apiFetch(`/api/v2/notifications/${notif.id}/read`, { method: 'PATCH' });
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      } catch (err) {}
    }
    if (notif.linkUrl) {
      router.push(notif.linkUrl);
    } else if (classifyNotificationCategory(notif) === 'Academy') {
      router.push('/academy');
    }
  };

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead).length;
    const academy = notifications.filter((n) => classifyNotificationCategory(n) === 'Academy').length;
    const signals = notifications.filter((n) => classifyNotificationCategory(n) === 'Signals').length;
    const admin = notifications.filter((n) => classifyNotificationCategory(n) === 'Admin').length;
    const system = notifications.filter((n) => classifyNotificationCategory(n) === 'System').length;
    return {
      total: notifications.length,
      unread,
      academy,
      signals,
      admin,
      system,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const cat = classifyNotificationCategory(n);
      if (activeFilter === 'Unread' && n.isRead) return false;
      if (activeFilter === 'Academy' && cat !== 'Academy') return false;
      if (activeFilter === 'Signals' && cat !== 'Signals') return false;
      if (activeFilter === 'Admin' && cat !== 'Admin') return false;
      if (activeFilter === 'System' && cat !== 'System') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchMsg = (n.message || '').toLowerCase().includes(q);
        return matchTitle || matchMsg;
      }
      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  return (
    <motion.div
      className="space-y-6 pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <PageHeader
        title="Institutional Notification & Dispatch Center"
        subtitle="Real-time Academy publications (courses, study notes, homework grading, quizzes), Gold Engine v3 triggers, and platform broadcasts — automatically deduplicated."
        icon={Bell}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchNotifications(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-purple-400' : ''} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={counts.unread === 0}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            <CheckCircle2 size={14} />
            <span>Mark All Read ({counts.unread})</span>
          </button>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/25 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Clear Inbox</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* --- Top 4 KPI Summary Strip --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveFilter('All')}
          className="glass-card p-4 rounded-2xl border border-white/10 hover:border-purple-500/30 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase text-[10px]">Total Unique Dispatches</span>
            <Bell size={15} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1.5">{counts.total}</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
            ✓ Auto-Deduplicated Feed
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('Unread')}
          className="glass-card p-4 rounded-2xl border border-purple-500/25 bg-purple-950/15 hover:border-purple-500/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase text-[10px]">Unread Action Items</span>
            <Sparkles size={15} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono mt-1.5">{counts.unread}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            {counts.unread === 0 ? 'All caught up' : 'Click to filter unread'}
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('Academy')}
          className="glass-card p-4 rounded-2xl border border-teal-500/25 bg-teal-950/15 hover:border-teal-500/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase text-[10px]">Academy & Instructor</span>
            <GraduationCap size={15} className="text-teal-400" />
          </div>
          <div className="text-2xl font-black text-teal-300 font-mono mt-1.5">{counts.academy}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            Notes, Courses, Homework & Zoom
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('Signals')}
          className="glass-card p-4 rounded-2xl border border-amber-500/25 bg-amber-950/15 hover:border-amber-500/50 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase text-[10px]">Signals & Broadcasts</span>
            <Zap size={15} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono mt-1.5">
            {counts.signals + counts.admin}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            Gold Engine v3 & Admin Alerts
          </div>
        </div>
      </div>

      {/* --- Filter Pills & Search Bar --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'All', label: 'All Dispatches', count: counts.total },
              { id: 'Unread', label: 'Unread', count: counts.unread },
              { id: 'Academy', label: 'Academy & Notes', count: counts.academy },
              { id: 'Signals', label: 'Engine Signals', count: counts.signals },
              { id: 'Admin', label: 'Broadcasts', count: counts.admin },
              { id: 'System', label: 'System & Security', count: counts.system },
            ] as { id: FilterType; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border',
                activeFilter === tab.id
                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                  activeFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter alerts by title or keyword..."
            className="w-full input-glass rounded-xl pl-9 pr-3.5 py-2 text-xs text-white"
          />
        </div>
      </div>

      {/* --- Notifications Stream --- */}
      <div className="glass-panel rounded-2xl border border-white/10 p-4 md:p-6 bg-slate-950/60">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
            <span className="text-sm font-mono">Synchronizing notification vault...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Inbox size={30} className="text-slate-500" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-slate-200 font-bold text-sm">No Notifications in "{activeFilter}"</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                New instructor study notes, homework assignments, quizzes, and Gold Engine v3 signals will appear here automatically.
              </p>
            </div>
            {activeFilter !== 'All' && (
              <button
                onClick={() => setActiveFilter('All')}
                className="px-4 py-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-bold cursor-pointer"
              >
                Show All Notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filteredNotifications.map((notif) => {
                const badge = getSmartBadge(notif);
                const IconComp = badge.icon;
                const destinationUrl =
                  notif.linkUrl ||
                  (classifyNotificationCategory(notif) === 'Academy' ? '/academy' : undefined);

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      'group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4',
                      notif.isRead
                        ? 'bg-slate-900/40 border-white/5 opacity-80 hover:opacity-100 hover:border-white/15'
                        : 'bg-gradient-to-r from-purple-950/30 via-slate-900/80 to-slate-900/60 border-purple-500/30 hover:border-purple-500/50 shadow-lg shadow-purple-950/20'
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          'h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center border mt-0.5',
                          badge.iconBox
                        )}
                      >
                        <IconComp size={18} />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                              badge.pillClass
                            )}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {getRelativeTime(notif.createdAt)}
                          </span>
                          {!notif.isRead && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                              NEW
                            </span>
                          )}
                        </div>

                        <h4
                          className={cn(
                            'text-sm font-bold leading-snug',
                            notif.isRead ? 'text-slate-200' : 'text-white'
                          )}
                        >
                          {notif.title}
                        </h4>

                        <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 self-end sm:self-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {destinationUrl && (
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notif)}
                          className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>Open</span>
                          <ArrowUpRight size={13} />
                        </button>
                      )}

                      {!notif.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkOneRead(notif.id, e)}
                          title="Mark as Read"
                          className="p-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-white/10 cursor-pointer transition"
                        >
                          <Check size={14} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteOne(notif.id, e)}
                        title="Remove Notification"
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 cursor-pointer transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
