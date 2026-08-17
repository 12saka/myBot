'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { Bell, Send, Clock, Users, ShieldAlert, Sparkles, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SuperadminNotificationsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('System Alert');
  const [specificUserId, setSpecificUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notificationTypes = [
    'System Alert',
    'Maintenance',
    'Promotion',
    'Update',
    'Security'
  ];

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
    if (!title || !message) {
      toast.error('Title and message are required.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Sending broadcast notification...');

    try {
      const payload = {
        title,
        message,
        type,
        ...(specificUserId && { userId: specificUserId })
      };

      const endpoint = specificUserId 
        ? '/api/v2/admin/notifications/send' 
        : '/api/v2/admin/notifications/broadcast';

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast.success(specificUserId ? 'Notification sent to user!' : 'Broadcast notification sent to all users!', { id: toastId });
      
      // Reset form
      setTitle('');
      setMessage('');
      setSpecificUserId('');
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
            Notifications Management
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Broadcast platform-wide alerts or send targeted notifications to specific users.
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
            <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
              <Send className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white font-outfit">Compose Message</h2>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Notification Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                  placeholder="e.g., Scheduled Maintenance"
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
                  placeholder="Enter the notification message..."
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Notification Type</label>
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

              <div className="pt-4 border-t border-white/10">
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Specific User ID (Optional)</label>
                <input
                  type="text"
                  value={specificUserId}
                  onChange={(e) => setSpecificUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                  placeholder="Leave empty to broadcast to all"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Provide a user ID to send a targeted message instead of a broadcast.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-outfit font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : specificUserId ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting ? 'Sending...' : specificUserId ? 'Send to Specific User' : 'Broadcast to All Users'}
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
                Broadcast History
              </h2>
              <button 
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition disabled:opacity-50"
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
                <p className="text-sm text-slate-400 font-mono">No recent notifications found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item: any, idx: number) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={item.id || idx} 
                    className="p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTypeColor(item.type)}`}>
                          {item.type || 'System Alert'}
                        </span>
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt || item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Recipients: {item.recipientCount || (item.userId ? '1' : 'All Users')}</span>
                      </div>
                      {item.userId && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>User ID: {item.userId}</span>
                        </div>
                      )}
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
