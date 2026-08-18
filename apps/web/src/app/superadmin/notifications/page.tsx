'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  Bell, Send, Clock, Users, ShieldAlert, Sparkles, AlertCircle,
  RefreshCw, CheckCircle2, Search, User, X, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminUserItem {
  id: string;
  email: string;
  role: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export default function SuperadminNotificationsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('System Alert');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User Auto-Pick State
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<AdminUserItem[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userSearchRef = useRef<HTMLDivElement>(null);

  const notificationTypes = [
    'System Alert',
    'Maintenance',
    'Promotion',
    'Update',
    'Security'
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search users with debounce
  useEffect(() => {
    if (!userSearch || userSearch.trim().length < 2) {
      setUserResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await apiFetch<any>(`/api/v2/admin/users?search=${encodeURIComponent(userSearch.trim())}`);
        const list = res?.users || (Array.isArray(res) ? res : []);
        setUserResults(list.slice(0, 8));
        setUserDropdownOpen(true);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [userSearch]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch<any>('/api/v2/admin/notifications/history');
      if (Array.isArray(res)) {
        setHistory(res);
      } else if (res.data && Array.isArray(res.data)) {
        setHistory(res.data);
      } else {
        setHistory([]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to fetch notification history');
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(selectedUser ? `Sending notification to ${selectedUser.email}...` : 'Broadcasting notification to all users...');

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        ...(selectedUser && { userId: selectedUser.id })
      };

      const endpoint = selectedUser 
        ? '/api/v2/admin/notifications/send' 
        : '/api/v2/admin/notifications/broadcast';

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast.success(
        selectedUser 
          ? `Notification dispatched to ${selectedUser.profile?.firstName || selectedUser.email}!` 
          : 'Broadcast alert published to all platform users!',
        { id: toastId }
      );
      
      // Reset form
      setTitle('');
      setMessage('');
      setSelectedUser(null);
      setUserSearch('');
      setType('System Alert');
      
      // Refresh history
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send notification', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeColor = (notifType: string) => {
    switch (notifType) {
      case 'System Alert': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Maintenance': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'Promotion': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Security': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'Update': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'ADMIN_BROADCAST': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'ADMIN_DIRECT': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-slate-950 border border-purple-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-semibold">
            <Bell className="w-3.5 h-3.5 text-purple-400" />
            <span>COMMUNICATIONS CONTROL</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-outfit font-extrabold text-white tracking-wide">
            Notifications & Broadcast Center
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Broadcast platform-wide alerts or auto-pick specific users to send targeted dispatches.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-5 rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white font-outfit">Compose Message</h2>
              </div>
              {selectedUser ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Targeted Mode
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Broadcast All
                </span>
              )}
            </div>

            <form onSubmit={handleBroadcast} className="space-y-4">
              {/* User Auto-Picker Selector */}
              <div ref={userSearchRef} className="relative">
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  Recipient Mode
                </label>

                {selectedUser ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-white">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-200 text-xs font-bold">
                        {(selectedUser.profile?.firstName?.[0] || selectedUser.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {selectedUser.profile?.firstName ? `${selectedUser.profile.firstName} ${selectedUser.profile.lastName || ''}` : selectedUser.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setUserSearch('');
                      }}
                      className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                      title="Clear and broadcast to all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        onFocus={() => {
                          if (userResults.length > 0) setUserDropdownOpen(true);
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                        placeholder="Search user name or email (or leave blank for all)..."
                      />
                      {isSearchingUsers && (
                        <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin absolute right-3" />
                      )}
                    </div>

                    {/* Auto-Pick Dropdown */}
                    <AnimatePresence>
                      {userDropdownOpen && userResults.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-50 left-0 right-0 mt-1.5 p-1.5 rounded-xl bg-slate-900 border border-white/15 shadow-2xl space-y-1 max-h-52 overflow-y-auto"
                        >
                          <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-white/5">
                            Matching Registered Users
                          </div>
                          {userResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setUserDropdownOpen(false);
                                setUserSearch('');
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-purple-500/10 hover:border-purple-500/20 border border-transparent flex items-center justify-between transition group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 text-[10px] font-bold">
                                  {(u.profile?.firstName?.[0] || u.email[0]).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate group-hover:text-purple-300">
                                    {u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : u.email}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                {u.role}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  {selectedUser 
                    ? 'Only this specific user will receive the notification.' 
                    : 'Leaving empty will broadcast this notification to ALL registered users.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Notification Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                  placeholder="e.g., Critical Market Volatility Alert"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Message Content *</label>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                  placeholder="Enter the message body to push to user devices..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Notification Category</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                >
                  {notificationTypes.map(t => (
                    <option key={t} value={t} className="bg-slate-900">{t}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-outfit font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : selectedUser ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting 
                    ? 'Publishing...' 
                    : selectedUser 
                      ? `Send to ${selectedUser.profile?.firstName || selectedUser.email.split('@')[0]}` 
                      : 'Broadcast to All Users'}
                </span>
              </button>
            </form>
          </motion.div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 min-h-[500px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-outfit">
                <Clock className="w-5 h-5 text-blue-400" />
                Broadcast & Dispatch History
              </h2>
              <button 
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
                title="Refresh history"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 font-mono">No recent notifications logged.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {history.map((item: any, idx: number) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    key={item.id || idx} 
                    className="p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-colors space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTypeColor(item.type)}`}>
                          {item.type || 'System Alert'}
                        </span>
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt || item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          Target: {item.user ? `${item.user.profile?.firstName || ''} (${item.user.email})` : item.userId ? `User: ${item.userId.substring(0, 8)}...` : 'All Registered Users'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Status: Delivered via WebSockets</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
