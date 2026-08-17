'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, GraduationCap, Zap, Megaphone, CheckCircle2, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type FilterType = 'All' | 'Unread' | 'System' | 'Academy' | 'Signal' | 'Admin';

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const list = await apiFetch<any[]>('/api/v2/notifications');
      if (Array.isArray(list)) {
        setNotifications(list);
      }
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/v2/notifications/read-all', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkSingleRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await apiFetch(`/api/v2/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      // silently fail
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Unread') return !n.isRead;
    if (activeFilter === 'System') return n.type === 'SYSTEM';
    if (activeFilter === 'Academy') return n.type === 'ACADEMY';
    if (activeFilter === 'Signal') return n.type === 'SIGNAL';
    if (activeFilter === 'Admin') return n.type === 'ADMIN_BROADCAST';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'ACADEMY': return <GraduationCap size={18} className="text-teal-400" />;
      case 'SIGNAL': return <Zap size={18} className="text-amber-400" />;
      case 'ADMIN_BROADCAST': return <Megaphone size={18} className="text-red-400" />;
      case 'SYSTEM':
      default:
        return <Bell size={18} className="text-purple-400" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'ACADEMY': return 'bg-teal-500/10 border-teal-500/20';
      case 'SIGNAL': return 'bg-amber-500/10 border-amber-500/20';
      case 'ADMIN_BROADCAST': return 'bg-red-500/10 border-red-500/20';
      case 'SYSTEM':
      default:
        return 'bg-purple-500/10 border-purple-500/20';
    }
  };

  return (
    <motion.div className="space-y-6" variants={CONTAINER} initial="hidden" animate="show">
      <motion.div variants={ITEM}>
        <PageHeader
          title="Notification Center"
          subtitle="Stay updated with signals, academy progress, and platform announcements."
          icon={Bell}
        >
          <button
            onClick={handleMarkAllRead}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            <CheckCircle2 size={14} />
            Mark All as Read
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={ITEM} className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {(['All', 'Unread', 'System', 'Academy', 'Signal', 'Admin'] as FilterType[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              activeFilter === filter
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            )}
          >
            {filter}
          </button>
        ))}
      </motion.div>

      <motion.div variants={ITEM} className="glass-panel rounded-2xl border border-white/10 p-4 md:p-6 bg-slate-950/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-4" />
            <span className="text-sm">Loading notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Inbox size={32} className="text-slate-600" />
            </div>
            <div className="text-center">
              <h3 className="text-slate-300 font-semibold mb-1">No Notifications</h3>
              <p className="text-xs text-slate-500">You're all caught up! Check back later for updates.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => !notif.isRead && handleMarkSingleRead(notif.id, e)}
                  className={cn(
                    'group p-4 rounded-xl border transition-all cursor-pointer flex gap-4',
                    notif.isRead
                      ? 'bg-white/5 border-white/5 opacity-70 hover:opacity-100 hover:bg-white/10'
                      : 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10'
                  )}
                >
                  <div className={cn('h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center border', getBgColor(notif.type))}>
                    {getIcon(notif.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={cn('text-sm font-bold truncate', notif.isRead ? 'text-slate-300' : 'text-white')}>
                        {notif.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {notif.createdAt ? getRelativeTime(notif.createdAt) : 'Just now'}
                        </span>
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
