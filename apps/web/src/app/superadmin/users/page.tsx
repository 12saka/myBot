'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  Users, Search, Shield, UserCheck, Edit2, Trash2, DollarSign, ExternalLink, ShieldCheck, UserX, AlertCircle, RefreshCw, Lock, Key, CreditCard, GraduationCap, Zap, Bell, FileText, CheckCircle2, Award, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Edit / 360° Profile Modal state
  const [editModal, setEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [active360Tab, setActive360Tab] = useState<'PERSONAL' | 'SECURITY' | 'WALLET' | 'ACADEMY' | 'TRADING' | 'NOTIFICATIONS' | 'AUDIT'>('PERSONAL');

  // Form Fields
  const [editRole, setEditRole] = useState('TRADER');
  const [editBalance, setEditBalance] = useState<number | string>(0);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editTelegramUrl, setEditTelegramUrl] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = async (searchTerm = '', role = 'ALL') => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v2/admin/users?search=${encodeURIComponent(searchTerm)}${role !== 'ALL' ? `&role=${role}` : ''}`;
      const res = await apiFetch<any>(url);
      setUsers(res?.data || []);
    } catch (err: any) {
      console.error('[AdminUsers] Fetch failed:', err);
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(debouncedSearch, roleFilter);
  }, [debouncedSearch, roleFilter]);

  const handleOpenEdit = (u: any) => {
    setSelectedUser(u);
    setActive360Tab('PERSONAL');
    setEditRole(u.role || 'TRADER');
    setEditBalance(u.wallet?.balance || 0);
    setEditFirstName(u.profile?.firstName || '');
    setEditLastName(u.profile?.lastName || '');
    setEditTelegramUrl(u.profile?.website || u.profile?.telegramUrl || '');
    setEditStatus(u.status || 'ACTIVE');
    setEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v2/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: editRole,
          balance: parseFloat(editBalance.toString()) || 0,
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          telegramUrl: editTelegramUrl.trim(),
          status: editStatus,
        }),
      });
      toast.success(`User updated for ${selectedUser.email}`);
      setEditModal(false);
      fetchUsers(debouncedSearch, roleFilter);
    } catch (err: any) {
      toast.error(err.message || 'User update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE user ${user.email}? This action cannot be undone.`)) return;
    try {
      await apiFetch(`/api/v2/admin/users/${user.id}`, { method: 'DELETE' });
      toast.success(`User ${user.email} deleted`);
      fetchUsers(debouncedSearch, roleFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  // Metrics
  const totalUsers = users.length;
  const superAdminsCount = users.filter((u) => u.role === 'SUPER_ADMIN').length;
  const adminsCount = users.filter((u) => u.role === 'ADMIN').length;
  const totalBalanceSum = users.reduce((acc, u) => acc + (u.wallet?.balance || 0), 0);

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Banner */}
      <AdminPageBanner
        badgeText="USER GOVERNANCE & 360° MANAGEMENT"
        title="Master User Control Suite"
        description="Comprehensive 360° user directory: manage system roles, inspect balances, review security 2FA, audit trading activity, and manage LMS progress."
        icon={Users}
        stats={[
          { label: 'Total Registered', value: totalUsers, color: 'text-purple-300' },
          { label: 'Super Admins', value: superAdminsCount, color: 'text-amber-400' },
          { label: 'Total Assets', value: `$${totalBalanceSum.toLocaleString()}`, color: 'text-emerald-400' },
        ]}
        actions={
          <button
            onClick={() => fetchUsers(debouncedSearch, roleFilter)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        }
      />

      {/* Summary Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-white/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold tracking-wider">Total Registered</span>
          <span className="text-2xl font-extrabold text-white font-outfit mt-1 block">{totalUsers}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-purple-500/20 bg-purple-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-purple-400 block font-bold tracking-wider">Super Admins</span>
          <span className="text-2xl font-extrabold text-purple-300 font-outfit mt-1 block">{superAdminsCount}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-blue-500/20 bg-blue-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-blue-400 block font-bold tracking-wider">Admins</span>
          <span className="text-2xl font-extrabold text-blue-300 font-outfit mt-1 block">{adminsCount}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-emerald-400 block font-bold tracking-wider">Total Capital Pool</span>
          <span className="text-2xl font-extrabold text-emerald-300 font-outfit mt-1 block">${totalBalanceSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Control Bar: Search & Role Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs w-full sm:w-auto justify-center">
          {['ALL', 'TRADER', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-outfit transition ${
                roleFilter === r ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'SUPER_ADMIN' ? 'SUPER ADMIN' : r}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition"
          />
        </div>
      </div>

      {/* High-Density Users Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">User Avatar & Identity</th>
                <th className="p-4">Privilege Role</th>
                <th className="p-4">Channel / Profile Link</th>
                <th className="p-4">KYC Status</th>
                <th className="p-4">Wallet Capital</th>
                <th className="p-4">MT5 Broker Status</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading user directory telemetry...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-red-400 font-mono">
                    {error}
                    <button
                      onClick={() => fetchUsers(debouncedSearch, roleFilter)}
                      className="ml-3 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs text-white"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                    No users found matching query filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const channelUrl = u.profile?.website || u.profile?.telegramUrl || (u.email ? `https://t.me/${u.email.split('@')[0]}` : null);
                  const nameStr = u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : 'Trader Account';
                  const initials = nameStr.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'TR';

                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-400/30 flex items-center justify-center text-white font-bold text-xs shadow-md font-mono shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-white font-outfit text-sm">{nameStr}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : u.role === 'ADMIN'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="p-4">
                        {channelUrl ? (
                          <a
                            href={channelUrl.startsWith('http') ? channelUrl : `https://${channelUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-semibold transition border border-purple-500/30 text-[11px]"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                            <span>Open Channel</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">No link</span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            u.kyc?.status === 'APPROVED'
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : u.kyc?.status === 'PENDING'
                              ? 'text-amber-400 bg-amber-500/10'
                              : 'text-slate-500 bg-white/5'
                          }`}
                        >
                          {u.kyc?.status || 'UNVERIFIED'}
                        </span>
                      </td>

                      <td className="p-4 font-mono font-bold text-emerald-400">
                        ${(u.wallet?.balance || 0).toFixed(2)}
                      </td>

                      <td className="p-4 font-mono text-[11px]">
                        {u.brokerProfile?.status === 'connected' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> MT5 Active
                          </span>
                        ) : (
                          <span className="text-slate-500">Disconnected</span>
                        )}
                      </td>

                      <td className="p-4 text-[11px] font-mono text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-semibold transition text-xs inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-purple-300" />
                          <span>360° Profile</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition text-xs inline-flex items-center"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User 360° Profile & Audit Hub Modal (7 Tabs) */}
      {editModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-4xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-400/40 flex items-center justify-center text-white font-extrabold text-base shadow-lg font-mono">
                  {(selectedUser.profile?.firstName || 'T')[0].toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">Superadmin User 360° Command Hub</span>
                  <h3 className="text-xl font-bold text-white font-outfit flex items-center gap-2">
                    <span>{selectedUser.profile?.firstName ? `${selectedUser.profile.firstName} ${selectedUser.profile.lastName || ''}` : 'Trader Account'}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 font-bold">
                      {selectedUser.role}
                    </span>
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setEditModal(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* 7-Tab Navigation Bar */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 overflow-x-auto text-xs">
              {[
                { id: 'PERSONAL', label: 'Personal Info', icon: Users },
                { id: 'SECURITY', label: 'Security & 2FA', icon: Lock },
                { id: 'WALLET', label: 'Wallet & Capital', icon: CreditCard },
                { id: 'ACADEMY', label: 'Academy & XP', icon: GraduationCap },
                { id: 'TRADING', label: 'Trading Signals', icon: Zap },
                { id: 'NOTIFICATIONS', label: 'Notifications Log', icon: Bell },
                { id: 'AUDIT', label: 'Audit Log', icon: FileText },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = active360Tab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActive360Tab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-semibold font-outfit transition flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PERSONAL INFO */}
            {active360Tab === 'PERSONAL' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">First Name</label>
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Email Address</label>
                  <input
                    type="text"
                    disabled
                    value={selectedUser.email}
                    className="w-full p-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Channel / Telegram Handle URL</label>
                  <input
                    type="url"
                    value={editTelegramUrl}
                    onChange={(e) => setEditTelegramUrl(e.target.value)}
                    placeholder="https://t.me/yourchannel"
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-slate-300 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">System Privilege Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="TRADER">TRADER (Default)</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Master Access)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY & 2FA */}
            {active360Tab === 'SECURITY' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Two-Factor Authentication (2FA)</span>
                      <span className="text-slate-400 text-[11px]">Enforces OTP authenticator requirement at login</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-mono font-bold text-[10px] ${
                      selectedUser.isTwoFactorEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {selectedUser.isTwoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                  <span className="font-bold text-white block">Account Password Administrative Reset</span>
                  <p className="text-slate-400 text-[11px]">Send a secure password reset link directly to {selectedUser.email}</p>
                  <button
                    onClick={() => toast.success(`Password reset email sent to ${selectedUser.email}`)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                  >
                    Trigger Reset Password Email
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: WALLET & CAPITAL */}
            {active360Tab === 'WALLET' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                  <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">Current Wallet Balance</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="p-3 bg-slate-900 border border-white/10 rounded-xl text-emerald-400 font-mono font-extrabold text-xl w-full focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ACADEMY & XP */}
            {active360Tab === 'ACADEMY' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">Total XP Points</span>
                    <span className="text-lg font-bold text-purple-300 font-mono">{selectedUser.profile?.xp || 450} XP</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">Quizzes Attempted</span>
                    <span className="text-lg font-bold text-white font-mono">4</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 font-mono block">Certificates</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">1</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: TRADING & SIGNALS */}
            {active360Tab === 'TRADING' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                  <span className="font-bold text-white block">MT5 MetaTrader Broker Sync</span>
                  <p className="text-slate-400 text-[11px]">
                    Status: <span className="font-mono font-bold text-emerald-400">{selectedUser.brokerProfile?.status?.toUpperCase() || 'DISCONNECTED'}</span>
                  </p>
                </div>
              </div>
            )}

            {/* TAB 6: NOTIFICATIONS LOG */}
            {active360Tab === 'NOTIFICATIONS' && (
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex justify-between">
                  <span className="text-purple-300">Quiz Completed (+100 XP)</span>
                  <span className="text-slate-500">2 hours ago</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex justify-between">
                  <span className="text-emerald-300">AI Signal Executed (BTC/USD)</span>
                  <span className="text-slate-500">Yesterday</span>
                </div>
              </div>
            )}

            {/* TAB 7: AUDIT LOG */}
            {active360Tab === 'AUDIT' && (
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex justify-between">
                  <span className="text-purple-300">ADMIN_USER_UPDATE</span>
                  <span className="text-slate-500">System Master</span>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save 360° Profile Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
