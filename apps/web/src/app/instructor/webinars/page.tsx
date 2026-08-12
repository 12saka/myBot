'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Video,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Users,
  ExternalLink,
  Copy,
  CheckCircle,
  Play,
  Shield,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstructorWebinarsPage() {
  const [webinars, setWebinars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Webinar Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState('Institutional Lead');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [category, setCategory] = useState('LIVE_TRADING');
  const [zoomMeetingId, setZoomMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [startUrl, setStartUrl] = useState('');

  const fetchWebinars = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any[]>('/api/v2/instructor/webinars');
      setWebinars(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load live webinars');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebinars();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setInstructorName('');
    const defaultDate = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    setStartTime(defaultDate);
    setDurationMinutes(60);
    setCategory('LIVE_TRADING');
    const randMeetingId = `${Math.floor(100000000 + Math.random() * 900000000)}`;
    const randPass = `${Math.floor(100000 + Math.random() * 900000)}`;
    setZoomMeetingId(randMeetingId);
    setPasscode(randPass);
    setJoinUrl(`https://zoom.us/j/${randMeetingId}?pwd=${randPass}`);
    setStartUrl(`https://zoom.us/s/${randMeetingId}?pwd=${randPass}`);
    setModalOpen(true);
  };

  const handleOpenEditModal = (w: any) => {
    setEditingId(w.id);
    setTitle(w.title || '');
    setDescription(w.description || '');
    setInstructorName(w.instructor || 'Institutional Lead');
    setStartTime(w.startTime ? new Date(w.startTime).toISOString().slice(0, 16) : '');
    setDurationMinutes(w.durationMinutes || 60);
    setCategory(w.category || 'LIVE_TRADING');
    setZoomMeetingId(w.zoomMeetingId || '');
    setPasscode(w.passcode || '');
    setJoinUrl(w.joinUrl || w.meetingUrl || '');
    setStartUrl(w.startUrl || '');
    setModalOpen(true);
  };

  const handleSaveWebinar = async () => {
    if (!title.trim() || !startTime) {
      toast.error('Webinar topic title and start time are required.');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        instructorName: instructorName.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        durationMinutes: Number(durationMinutes),
        category,
        zoomMeetingId: zoomMeetingId.trim() || undefined,
        passcode: passcode.trim() || undefined,
        joinUrl: joinUrl.trim() || undefined,
        startUrl: startUrl.trim() || undefined,
        status: 'SCHEDULED',
      };

      if (editingId) {
        await apiFetch(`/api/v2/instructor/webinars/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Zoom webinar details updated!');
      } else {
        await apiFetch('/api/v2/instructor/webinars', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Live Zoom Webinar published to students!');
      }
      setModalOpen(false);
      fetchWebinars();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save webinar');
    }
  };

  const handleDeleteWebinar = async (id: string, titleStr: string) => {
    if (!confirm(`Cancel & delete Zoom webinar "${titleStr}"?`)) return;
    try {
      await apiFetch(`/api/v2/instructor/webinars/${id}`, { method: 'DELETE' });
      toast.success('Webinar cancelled.');
      fetchWebinars();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete webinar');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-outfit">Zoom Live Webinar Studio</h2>
            <span className="text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded">
              ZOOM INTEGRATION
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Schedule, publish, and host live Zoom webinars, masterclasses, and Q&A sessions for academy students.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-600/20 transition self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Zoom Webinar</span>
        </button>
      </div>

      {/* Webinars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {webinars.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-500 font-mono glass-panel rounded-2xl border border-teal-500/20">
            No active Zoom webinars scheduled. Click "Schedule Zoom Webinar" to publish a live class.
          </div>
        ) : (
          webinars.map((w) => {
            const isUpcoming = new Date(w.startTime) > new Date();
            const meetingIdStr = w.zoomMeetingId || '123-456-789';
            const passcodeStr = w.passcode || 'TRADEMIND';
            const joinLinkStr = w.joinUrl || w.meetingUrl || `https://zoom.us/j/${meetingIdStr}?pwd=${passcodeStr}`;

            return (
              <div
                key={w.id}
                className="glass-panel p-5 rounded-2xl border border-teal-500/20 bg-slate-900/60 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-teal-300 bg-teal-500/10 px-2.5 py-0.5 rounded border border-teal-500/20">
                      {w.category || 'LIVE_CLASS'}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        isUpcoming
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-slate-400 bg-white/5 border-white/10'
                      }`}
                    >
                      {isUpcoming ? 'SCHEDULED' : 'COMPLETED'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white font-outfit">{w.title}</h3>
                  {w.description && <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{w.description}</p>}

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-white/5">
                    <div className="p-2 rounded bg-slate-950/80 border border-white/5 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-teal-400" />
                      <div>
                        <span className="text-slate-400 text-[9px] block">Start Time</span>
                        <span className="font-bold text-white text-[11px]">{new Date(w.startTime).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-950/80 border border-white/5 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <div>
                        <span className="text-slate-400 text-[9px] block">Duration</span>
                        <span className="font-bold text-white text-[11px]">{w.durationMinutes} mins</span>
                      </div>
                    </div>
                  </div>

                  {/* Zoom Meeting Credentials Box */}
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-teal-500/30 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Zoom Meeting ID:</span>
                      <span className="font-bold text-teal-300">{meetingIdStr}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Passcode:</span>
                      <span className="font-bold text-amber-300">{passcodeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Actions & Launch Buttons */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => copyToClipboard(joinLinkStr, 'Student Join Link')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-teal-300" />
                    <span>Copy Join Link</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <a
                      href={w.startUrl || joinLinkStr}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1 shadow transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Launch Host Room</span>
                    </a>

                    <button
                      onClick={() => handleOpenEditModal(w)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-teal-300 transition"
                      title="Edit Webinar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWebinar(w.id, w.title)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                      title="Delete Webinar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Schedule Zoom Webinar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-teal-500/30 w-full max-w-lg space-y-4 bg-slate-900 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white font-outfit">
              {editingId ? 'Edit Zoom Webinar Details' : 'Schedule Live Zoom Webinar'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Webinar Topic / Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Live Trading Session: New York Session Order Flow Analysis"
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Description & Agenda</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key topics, charts to analyze, and Q&A schedule for students..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Zoom Meeting ID</label>
                  <input
                    type="text"
                    value={zoomMeetingId}
                    onChange={(e) => setZoomMeetingId(e.target.value)}
                    placeholder="9-digit Zoom ID"
                    className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Passcode</label>
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Passcode"
                    className="w-full p-2 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Student Join URL</label>
                <input
                  type="text"
                  value={joinUrl}
                  onChange={(e) => setJoinUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="w-full p-2.5 bg-slate-950 border border-teal-500/20 rounded-xl text-white font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWebinar}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-teal-600/20 transition"
              >
                {editingId ? 'Save Changes' : 'Publish Zoom Webinar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
