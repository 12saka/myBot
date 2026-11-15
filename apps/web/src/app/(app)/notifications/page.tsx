'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Inbox,
  ArrowUpRight,
  Search,
  Trash2,
  RefreshCw,
  Check,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

type FilterType = 'All' | 'Unread' | 'Signals' | 'Academy' | 'System';

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

function classifyNotificationCategory(notif: any): 'Signals' | 'Academy' | 'System' {
  const t = (notif.type || '').toUpperCase();
  const title = (notif.title || '').toLowerCase();

  if (
    t === 'SIGNAL' ||
    title.includes('signal') ||
    title.includes('xau') ||
    title.includes('gold engine') ||
    title.includes('tp1') ||
    title.includes('tp2') ||
    title.includes('sl hit') ||
    title.includes('order')
  ) {
    return 'Signals';
  }

  if (
    t === 'ACADEMY' ||
    title.includes('course') ||
    title.includes('lesson') ||
    title.includes('study note') ||
    title.includes('homework') ||
    title.includes('assignment') ||
    title.includes('quiz') ||
    title.includes('webinar') ||
    title.includes('qotd') ||
    title.includes('challenge')
  ) {
    return 'Academy';
  }

  return 'System';
}

function getCategoryConfig(category: 'Signals' | 'Academy' | 'System') {
  switch (category) {
    case 'Signals':
      return {
        label: 'Signal',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        accentBorder: 'hover:border-amber-500/40',
        dotClass: 'bg-amber-400',
      };
    case 'Academy':
      return {
        label: 'Academy',
        badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        accentBorder: 'hover:border-cyan-500/40',
        dotClass: 'bg-cyan-400',
      };
    case 'System':
    default:
      return {
        label: 'System',
        badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        accentBorder: 'hover:border-slate-500/40',
        dotClass: 'bg-slate-400',
      };
  }
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
    } catch {
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
      toast.success('All marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm('Clear all notifications from inbox?')) return;
    try {
      await apiFetch('/api/v2/notifications/clear-all', { method: 'DELETE' });
      setNotifications([]);
      toast.success('Inbox cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v2/notifications/${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification removed');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {}
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      try {
        await apiFetch(`/api/v2/notifications/${notif.id}/read`, { method: 'PATCH' });
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)));
      } catch {}
    }
    if (notif.linkUrl) {
      router.push(notif.linkUrl);
    } else if (classifyNotificationCategory(notif) === 'Academy') {
      router.push('/academy');
    } else if (classifyNotificationCategory(notif) === 'Signals') {
      router.push('/dashboard/engines/gold');
    }
  };

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead).length;
    const signals = notifications.filter((n) => classifyNotificationCategory(n) === 'Signals').length;
    const academy = notifications.filter((n) => classifyNotificationCategory(n) === 'Academy').length;
    const system = notifications.filter((n) => classifyNotificationCategory(n) === 'System').length;
    return {
      total: notifications.length,
      unread,
      signals,
      academy,
      system,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const cat = classifyNotificationCategory(n);
      if (activeFilter === 'Unread' && n.isRead) return false;
      if (activeFilter === 'Signals' && cat !== 'Signals') return false;
      if (activeFilter === 'Academy' && cat !== 'Academy') return false;
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
      className="space-y-4 pb-12 max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* --- Compact Institutional Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Notifications</h1>
          {counts.unread > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {counts.unread} unread
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => fetchNotifications(true)}
            title="Refresh feed"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-amber-400' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {counts.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <CheckCircle2 size={12} />
              <span>Mark all read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Clear all"
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg bg-white/5 hover:bg-red-500/15 text-slate-400 hover:text-red-300 border border-white/10 text-xs transition cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* --- Space-Efficient Filters & Search --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Horizontal Scrollable Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: 'All', label: 'All', count: counts.total },
              { id: 'Unread', label: 'Unread', count: counts.unread },
              { id: 'Signals', label: 'Signals', count: counts.signals },
              { id: 'Academy', label: 'Academy', count: counts.academy },
              { id: 'System', label: 'System', count: counts.system },
            ] as { id: FilterType; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border',
                activeFilter === tab.id
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] font-mono px-1 py-0.2 rounded',
                  activeFilter === tab.id ? 'text-amber-300 font-bold' : 'text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Compact Search Field */}
        <div className="relative w-full sm:w-56">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts..."
            className="w-full bg-[#0E1424] border border-white/10 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
      </div>

      {/* --- Streamlined Notifications List --- */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-mono">Loading notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-2 border border-white/5 rounded-xl bg-white/2">
            <Inbox size={22} className="text-slate-600" />
            <div className="text-center">
              <span className="text-xs font-semibold text-slate-400 block">No notifications</span>
              <span className="text-[11px] text-slate-500">
                {searchQuery ? 'No alerts match your search' : 'Your inbox is completely caught up'}
              </span>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredNotifications.map((notif) => {
              const cat = classifyNotificationCategory(notif);
              const config = getCategoryConfig(cat);
              const hasLink = Boolean(notif.linkUrl || cat === 'Academy' || cat === 'Signals');

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'group relative rounded-xl border p-2.5 sm:p-3 transition-all cursor-pointer flex items-start justify-between gap-3',
                    notif.isRead
                      ? 'bg-[#0B0F19]/50 border-white/5 opacity-75 hover:opacity-100 hover:border-white/15'
                      : 'bg-[#0E1424] border-amber-500/25 shadow-sm shadow-black/40',
                    config.accentBorder
                  )}
                >
                  {/* Left Column: Category Dot, Category Tag, Title, Body, Timestamp */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {/* Subtle status indicator dot */}
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', notif.isRead ? 'bg-slate-600' : config.dotClass)} />
                      
                      {/* Category tag */}
                      <span className={cn('font-mono font-semibold px-1.5 py-0.2 rounded border text-[9px] uppercase tracking-wider', config.badgeClass)}>
                        {config.label}
                      </span>

                      {/* Relative time */}
                      <span className="font-mono text-slate-500 text-[10px]">
                        {getRelativeTime(notif.createdAt)}
                      </span>

                      {/* New indicator */}
                      {!notif.isRead && (
                        <span className="font-mono font-bold text-amber-400 text-[9px] uppercase tracking-wider ml-0.5">
                          • new
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className={cn(
                        'text-xs font-semibold leading-tight tracking-tight',
                        notif.isRead ? 'text-slate-300' : 'text-white'
                      )}
                    >
                      {notif.title}
                    </h3>

                    {/* Body text - clamped on mobile for density */}
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 sm:line-clamp-3">
                      {notif.message}
                    </p>
                  </div>

                  {/* Right Column: Actions (compact, non-cluttering) */}
                  <div
                    className="flex items-center gap-1 shrink-0 pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hasLink && (
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        title="View details"
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-0.5 transition cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowUpRight size={11} className="text-slate-400" />
                      </button>
                    )}

                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkOneRead(notif.id, e)}
                        title="Mark read"
                        className="p-1 rounded bg-white/5 hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-300 border border-white/5 transition cursor-pointer"
                      >
                        <Check size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDeleteOne(notif.id, e)}
                      title="Delete"
                      className="p-1 rounded bg-white/5 hover:bg-red-500/15 text-slate-500 hover:text-red-300 border border-white/5 transition cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
