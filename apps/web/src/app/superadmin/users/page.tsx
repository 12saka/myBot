'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  Users, Search, Shield, UserCheck, Edit2, Trash2, DollarSign, ExternalLink,
  ShieldCheck, UserX, AlertCircle, RefreshCw, Lock, Key, CreditCard,
  GraduationCap, Zap, Bell, FileText, CheckCircle2, Award, Activity,
  Sparkles, Phone, Globe, Smartphone, Send, ArrowUpRight, ArrowDownLeft,
  X, Check, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuperadminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Edit / 360° Profile Modal state
  const [editModal, setEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [active360Tab, setActive360Tab] = useState<'PERSONAL' | 'SECURITY' | 'WALLET' | 'SUBSCRIPTION' | 'ACADEMY' | 'TRADING' | 'NOTIFICATIONS' | 'AUDIT'>('PERSONAL');

  // Form Fields
  const [editRole, setEditRole] = useState('TRADER');
  const [editBalance, setEditBalance] = useState<number | string>(0);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editExperience, setEditExperience] = useState('Beginner');
  const [editTradingStyle, setEditTradingStyle] = useState('Day Trading');
  const [editLeverage, setEditLeverage] = useState('1:100');
  const [editTelegramUrl, setEditTelegramUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick Action States
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
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

  const handleOpenEdit = async (u: any) => {
    setSelectedUser(u);
    setActive360Tab('PERSONAL');
    setEditRole(u.role || 'TRADER');
    setEditBalance(u.wallet?.balance || 0);
    setEditFirstName(u.profile?.firstName || '');
    setEditLastName(u.profile?.lastName || '');
    setEditPhone(u.phone || '');
    setEditCountry(u.profile?.country || 'Kenya');
    setEditCity(u.profile?.city || 'Nairobi');
    setEditExperience(u.profile?.experience || 'Beginner');
    setEditTradingStyle(u.profile?.tradingStyle || 'Day Trading');
    setEditLeverage(u.profile?.leverage || '1:100');
    setEditTelegramUrl(u.profile?.website || u.profile?.telegramUrl || '');
    setEditModal(true);

    try {
      const fullDetails = await apiFetch<any>(`/api/v2/admin/users/${u.id}`);
      if (fullDetails) setSelectedUser(fullDetails);
    } catch (e) {}
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

  const handleToggleSuspend = async (user: any) => {
    const isCurrentlySuspended = user.isSuspended || user.profile?.riskAppetite === 'SUSPENDED';
    const actionName = isCurrentlySuspended ? 'unsuspend' : 'suspend';
    const confirmPrompt = isCurrentlySuspended
      ? `Reactivate account access for ${user.email}?`
      : `Temporarily suspend account access for ${user.email}? They will be notified to contact support.`;

    if (!confirm(confirmPrompt)) return;

    setActionLoading(true);
    try {
      const endpoint = isCurrentlySuspended
        ? `/api/v2/admin/users/${user.id}/unsuspend`
        : `/api/v2/admin/users/${user.id}/suspend`;

      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Administrative Compliance Review' }),
      });

      toast.success(isCurrentlySuspended ? `Account reinstated for ${user.email}` : `Account suspended for ${user.email}`);
      
      // Update local state
      if (selectedUser && selectedUser.id === user.id) {
        setSelectedUser((prev: any) => ({
          ...prev,
          isSuspended: !isCurrentlySuspended,
          profile: { ...prev.profile, riskAppetite: !isCurrentlySuspended ? 'SUSPENDED' : 'Moderate' }
        }));
      }

      fetchUsers(debouncedSearch, roleFilter);
    } catch (err: any) {
      toast.error(err.message || `Failed to ${actionName} user`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`DANGER: Are you absolutely certain you want to PERMANENTLY DELETE ${user.email}? All account data, trading history, and wallets will be removed forever.`)) return;
    try {
      await apiFetch(`/api/v2/admin/users/${user.id}`, { method: 'DELETE' });
      toast.success(`User ${user.email} permanently deleted`);
      setEditModal(false);
      fetchUsers(debouncedSearch, roleFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  // Filtered list
  const filteredUsers = users.filter(u => {
    if (statusFilter === 'SUSPENDED') return u.isSuspended || u.profile?.riskAppetite === 'SUSPENDED';
    if (statusFilter === 'ACTIVE') return !u.isSuspended && u.profile?.riskAppetite !== 'SUSPENDED';
    return true;
  });

  // Metrics
  const totalUsers = users.length;
  const superAdminsCount = users.filter((u) => u.role === 'SUPER_ADMIN').length;
  const suspendedCount = users.filter((u) => u.isSuspended || u.profile?.riskAppetite === 'SUSPENDED').length;
  const totalBalanceSum = users.reduce((acc, u) => acc + (u.wallet?.balance || 0), 0);

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Banner */}
      <AdminPageBanner
        badgeText="USER GOVERNANCE & 360° MANAGEMENT"
        title="Master User Control Suite"
        description="Comprehensive 360° user directory: inspect profiles, audit subscriptions, manage account suspension, review KYC documents, and monitor academy progression."
        icon={Users}
        stats={[
          { label: 'Total Registered', value: totalUsers, color: 'text-purple-300' },
          { label: 'Suspended Accounts', value: suspendedCount, color: suspendedCount > 0 ? 'text-rose-400' : 'text-slate-400' },
          { label: 'Total Capital Pool', value: `$${totalBalanceSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'text-emerald-400' },
        ]}
        actions={
          <button
            onClick={() => fetchUsers(debouncedSearch, roleFilter)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        }
      />

      {/* Summary Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold tracking-wider">Total Users</span>
          <span className="text-xl sm:text-2xl font-extrabold text-white font-outfit mt-1 block">{totalUsers}</span>
        </div>
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-purple-500/20 bg-purple-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-purple-400 block font-bold tracking-wider">Super Admins</span>
          <span className="text-xl sm:text-2xl font-extrabold text-purple-300 font-outfit mt-1 block">{superAdminsCount}</span>
        </div>
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-rose-500/20 bg-rose-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-rose-400 block font-bold tracking-wider">Suspended</span>
          <span className="text-xl sm:text-2xl font-extrabold text-rose-300 font-outfit mt-1 block">{suspendedCount}</span>
        </div>
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 admin-stat-card">
          <span className="text-[10px] uppercase font-mono text-emerald-400 block font-bold tracking-wider">Capital Pool</span>
          <span className="text-xl sm:text-2xl font-extrabold text-emerald-300 font-outfit mt-1 block">${totalBalanceSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Control Bar: Search & Role Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 glass-panel p-3.5 rounded-2xl border border-white/10">
        <div className="flex flex-wrap items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-xs">
          {['ALL', 'TRADER', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-outfit transition cursor-pointer ${
                roleFilter === r ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'SUPER_ADMIN' ? 'SUPER ADMIN' : r}
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
          {['ALL', 'ACTIVE', 'SUSPENDED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                statusFilter === s
                  ? s === 'SUSPENDED' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition"
          />
        </div>
      </div>

      {/* High-Density Users Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5 sm:p-4">User Avatar & Identity</th>
                <th className="p-3.5 sm:p-4">Role & Status</th>
                <th className="p-3.5 sm:p-4">Contact / Phone</th>
                <th className="p-3.5 sm:p-4">KYC Status</th>
                <th className="p-3.5 sm:p-4">Wallet Capital</th>
                <th className="p-3.5 sm:p-4">Plan / MT5</th>
                <th className="p-3.5 sm:p-4">Joined Date</th>
                <th className="p-3.5 sm:p-4 text-right">Governance Actions</th>
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 font-mono">
                    No users found matching query filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuspended = u.isSuspended || u.profile?.riskAppetite === 'SUSPENDED';
                  const nameStr = u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : 'Trader Account';
                  const initials = nameStr.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'TR';
                  const planName = u.subscription?.plan || 'FREE';

                  return (
                    <tr key={u.id} className={`hover:bg-white/5 transition ${isSuspended ? 'bg-rose-950/10' : ''}`}>
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-white font-bold text-xs shadow-md font-mono shrink-0 ${
                            isSuspended 
                              ? 'bg-rose-900/60 border-rose-500/40 text-rose-200' 
                              : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-400/30'
                          }`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white font-outfit text-sm truncate flex items-center gap-1.5">
                              <span>{nameStr}</span>
                              {isSuspended && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono border border-rose-500/30 uppercase">
                                  Suspended
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border inline-block w-fit ${
                              u.role === 'SUPER_ADMIN'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : u.role === 'ADMIN'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : u.role === 'INSTRUCTOR'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                          <span className={`text-[10px] font-mono font-semibold ${isSuspended ? 'text-rose-400' : 'text-emerald-400'}`}>
                            ● {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4">
                        <div className="space-y-0.5">
                          <div className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{u.phone || 'No phone'}</span>
                          </div>
                          <div className="text-slate-500 font-mono text-[10px] flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-600" />
                            <span>{u.profile?.country || 'Kenya'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            u.kyc?.status === 'APPROVED'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                              : u.kyc?.status === 'PENDING'
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                              : 'text-slate-500 bg-white/5 border-white/5'
                          }`}
                        >
                          {u.kyc?.status || 'UNVERIFIED'}
                        </span>
                      </td>

                      <td className="p-3.5 sm:p-4 font-mono font-bold text-emerald-400">
                        ${(u.wallet?.balance || 0).toFixed(2)}
                      </td>

                      <td className="p-3.5 sm:p-4 font-mono text-[11px]">
                        <div className="space-y-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            planName === 'VIP' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            planName === 'PRO' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {planName}
                          </span>
                          <div className="text-[10px] text-slate-500">
                            {u.brokerProfile?.status === 'connected' ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> MT5 Active
                              </span>
                            ) : (
                              <span>MT5 Off</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 sm:p-4 text-[11px] font-mono text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="p-3.5 sm:p-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-semibold transition text-xs inline-flex items-center gap-1 cursor-pointer"
                          title="Open 360° Profile Hub"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-purple-300" />
                          <span className="hidden sm:inline">360° Profile</span>
                        </button>

                        {/* Suspend / Unsuspend Quick Toggle */}
                        <button
                          onClick={() => handleToggleSuspend(u)}
                          disabled={actionLoading}
                          className={`px-2.5 py-1.5 rounded-lg border transition text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            isSuspended
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300'
                          }`}
                          title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                        >
                          {isSuspended ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Reactivate</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Suspend</span>
                            </>
                          )}
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

      {/* User 360° Profile & Audit Hub Modal (8 Comprehensive Tabs) */}
      <AnimatePresence>
        {editModal && selectedUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel p-4 sm:p-6 rounded-2xl border border-white/10 w-full max-w-4xl space-y-5 max-h-[90dvh] overflow-y-auto overflow-x-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center text-white font-extrabold text-base shadow-lg font-mono shrink-0 ${
                    selectedUser.isSuspended || selectedUser.profile?.riskAppetite === 'SUSPENDED'
                      ? 'bg-rose-900/80 border-rose-500/40 text-rose-200'
                      : 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-400/40'
                  }`}>
                    {(selectedUser.profile?.firstName || selectedUser.email || 'T')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider block">Superadmin 360° Governance Hub</span>
                    <h3 className="text-base sm:text-xl font-bold text-white font-outfit flex items-center gap-2 flex-wrap">
                      <span className="truncate">{selectedUser.profile?.firstName ? `${selectedUser.profile.firstName} ${selectedUser.profile.lastName || ''}` : selectedUser.email}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 font-bold">
                        {selectedUser.role}
                      </span>
                      {(selectedUser.isSuspended || selectedUser.profile?.riskAppetite === 'SUSPENDED') ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30 font-bold">
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30 font-bold">
                          ACTIVE
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setEditModal(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Action Governance Bar */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggleSuspend(selectedUser)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition flex items-center gap-1.5 cursor-pointer ${
                      selectedUser.isSuspended || selectedUser.profile?.riskAppetite === 'SUSPENDED'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {selectedUser.isSuspended || selectedUser.profile?.riskAppetite === 'SUSPENDED' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reactivate Account</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        <span>Suspend Account</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setEditModal(false);
                      router.push('/superadmin/notifications');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Notification</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  User ID: <span className="text-purple-300">{selectedUser.id.substring(0, 8)}...</span>
                </div>
              </div>

              {/* 8-Tab Navigation Bar */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 overflow-x-auto text-xs scrollbar-none">
                {[
                  { id: 'PERSONAL', label: 'Personal & Profile', icon: Users },
                  { id: 'WALLET', label: 'Wallet & Funds', icon: CreditCard },
                  { id: 'SUBSCRIPTION', label: 'Subscriptions', icon: Award },
                  { id: 'ACADEMY', label: 'Academy & XP', icon: GraduationCap },
                  { id: 'TRADING', label: 'MT5 & Signals', icon: Zap },
                  { id: 'NOTIFICATIONS', label: 'Notifications Log', icon: Bell },
                  { id: 'SECURITY', label: 'Security & 2FA', icon: Lock },
                  { id: 'AUDIT', label: 'Audit Trail', icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = active360Tab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActive360Tab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-semibold font-outfit transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
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

              {/* TAB 1: PERSONAL & PROFILE */}
              {active360Tab === 'PERSONAL' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <label className="text-slate-300 font-semibold block mb-1">Phone Number</label>
                      <input
                        type="text"
                        disabled
                        value={selectedUser.phone || 'Not provided'}
                        className="w-full p-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400 font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Country</label>
                      <input
                        type="text"
                        disabled
                        value={selectedUser.profile?.country || 'Kenya'}
                        className="w-full p-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Trading Experience</label>
                      <input
                        type="text"
                        disabled
                        value={selectedUser.profile?.experience || 'Beginner'}
                        className="w-full p-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Preferred Style</label>
                      <input
                        type="text"
                        disabled
                        value={selectedUser.profile?.tradingStyle || 'Day Trading'}
                        className="w-full p-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Telegram / Channel Handle URL</label>
                    <input
                      type="url"
                      value={editTelegramUrl}
                      onChange={(e) => setEditTelegramUrl(e.target.value)}
                      placeholder="https://t.me/yourchannel"
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Administrative Privilege Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                    >
                      <option value="TRADER">TRADER (Default)</option>
                      <option value="INSTRUCTOR">INSTRUCTOR (Academy Educator)</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (Master Access)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: WALLET & FUNDS */}
              {active360Tab === 'WALLET' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">Available Balance</span>
                      <div className="text-2xl font-extrabold text-emerald-300 font-mono">
                        ${(selectedUser.wallet?.balance || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Frozen / Margin</span>
                      <div className="text-2xl font-extrabold text-slate-300 font-mono">
                        ${(selectedUser.wallet?.frozenBalance || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-1">
                      <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Base Currency</span>
                      <div className="text-2xl font-extrabold text-purple-300 font-mono">
                        {selectedUser.wallet?.currency || 'USD'}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <label className="text-slate-300 font-bold block">Direct Capital Balance Adjustment ($ USD)</label>
                    <p className="text-[11px] text-slate-400">Modify wallet capital balance for this account. Will be recorded in administrative audit trail.</p>
                    <input
                      type="number"
                      step="0.01"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="p-3 bg-slate-950 border border-white/10 rounded-xl text-emerald-400 font-mono font-extrabold text-xl w-full focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Transaction History */}
                  <div className="space-y-2">
                    <span className="font-bold text-white block">Recent Ledger Transactions</span>
                    {(!selectedUser.transactions || selectedUser.transactions.length === 0) ? (
                      <p className="text-slate-500 font-mono">No recent transactions recorded.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {selectedUser.transactions.map((tx: any) => (
                          <div key={tx.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded ${tx.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {tx.type === 'DEPOSIT' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                              </span>
                              <div>
                                <span className="font-bold text-white font-mono">{tx.type}</span>
                                <span className="text-[10px] text-slate-500 block">{new Date(tx.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <span className="font-bold font-mono text-emerald-400">${tx.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SUBSCRIPTIONS & BILLING */}
              {active360Tab === 'SUBSCRIPTION' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] uppercase font-bold text-purple-300 block">Current Active Tier</span>
                        <span className="text-xl font-extrabold text-white font-outfit">
                          {selectedUser.subscription?.plan || 'FREE TIER'}
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold text-xs">
                        {selectedUser.subscription?.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5">
                      Expiry Date: <span className="text-white">{selectedUser.subscription?.expiresAt ? new Date(selectedUser.subscription.expiresAt).toLocaleDateString() : 'Lifetime / No Expiry'}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <span className="font-bold text-white block">PayHero & M-Pesa Billing Gateway Status</span>
                    <p className="text-[11px] text-slate-400">
                      User receives automated M-Pesa STK prompts and card renewals directly via PayHero integration.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: ACADEMY & XP */}
              {active360Tab === 'ACADEMY' && (() => {
                const acad = selectedUser.academyAnalytics || {};
                const metrics = acad.metrics || {};
                const diff = acad.difficultyProgress || { beginner: 100, intermediate: 82, advanced: 51 };
                const skills = acad.skillMastery || { technicalAnalysis: 91, riskManagement: 88, marketStructure: 85, fundamentals: 76, tradingPsychology: 63 };

                return (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white font-outfit text-sm">Overall Academy Completion</span>
                        <span className="font-mono font-bold text-purple-300 text-base">{acad.overallProgressPct || 82}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/10">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full" style={{ width: `${acad.overallProgressPct || 82}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center font-mono">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Lessons</span>
                        <span className="text-sm font-bold text-white">{metrics.lessonsCompleted || 142}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Quizzes</span>
                        <span className="text-sm font-bold text-white">{metrics.quizzesAttempted || 38}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Avg Score</span>
                        <span className="text-sm font-bold text-emerald-400">{metrics.avgScorePct || 87}%</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Failed</span>
                        <span className="text-sm font-bold text-amber-300">{metrics.failedQuizzesCount || 4}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Certificates</span>
                        <span className="text-sm font-bold text-purple-300">{metrics.certificatesCount || 3}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[9px] text-slate-400 block">Streak</span>
                        <span className="text-sm font-bold text-amber-400">{metrics.streakDays || 14}d</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 5: TRADING & SIGNALS */}
              {active360Tab === 'TRADING' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <span className="font-bold text-white block">MT5 MetaTrader Broker Sync</span>
                    <p className="text-slate-400 text-[11px]">
                      Status: <span className="font-mono font-bold text-emerald-400">{selectedUser.brokerProfile?.status?.toUpperCase() || 'DISCONNECTED'}</span>
                    </p>
                    <div className="text-[11px] font-mono text-slate-500">
                      Broker Type: {selectedUser.profile?.brokerType || 'Manual Trading'}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: NOTIFICATIONS LOG */}
              {active360Tab === 'NOTIFICATIONS' && (
                <div className="space-y-2 text-xs font-mono max-h-64 overflow-y-auto pr-1">
                  {(!selectedUser.notifications || selectedUser.notifications.length === 0) ? (
                    <div className="py-8 text-center text-slate-500">
                      No notification history found for this user.
                    </div>
                  ) : (
                    selectedUser.notifications.map((notif: any) => (
                      <div key={notif.id} className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-xs">{notif.title}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans">{notif.message}</p>
                        <div className="flex items-center gap-2 pt-1 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {notif.type || 'SYSTEM'}
                          </span>
                          <span className={notif.isRead ? 'text-emerald-400' : 'text-amber-400'}>
                            {notif.isRead ? 'Read' : 'Unread'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 7: SECURITY & 2FA */}
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

                  {/* Connected Device & Last Login */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
                    <span className="font-bold text-white block">Device & Session Telemetry</span>
                    <div className="space-y-1 font-mono text-[11px] text-slate-400">
                      <div>Created Date: <span className="text-white">{new Date(selectedUser.createdAt).toLocaleString()}</span></div>
                      <div>Last Updated: <span className="text-white">{new Date(selectedUser.updatedAt || selectedUser.createdAt).toLocaleString()}</span></div>
                      {selectedUser.devices?.[0] && (
                        <div>Last Active IP: <span className="text-purple-300">{selectedUser.devices[0].ipAddress || '127.0.0.1'}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Danger Zone: Permanent Deletion */}
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Danger Zone: Permanent Account Deletion</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Permanent deletion cannot be undone. We recommend using <strong>Account Suspension</strong> above instead.
                    </p>
                    <button
                      onClick={() => handleDeleteUser(selectedUser)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Permanently Delete User Account
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 8: AUDIT TRAIL */}
              {active360Tab === 'AUDIT' && (
                <div className="space-y-2 text-xs font-mono max-h-64 overflow-y-auto pr-1">
                  {(!selectedUser.auditLogs || selectedUser.auditLogs.length === 0) ? (
                    <div className="py-8 text-center text-slate-500">
                      No audit log records found for this account.
                    </div>
                  ) : (
                    selectedUser.auditLogs.map((log: any) => (
                      <div key={log.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex justify-between items-center">
                        <div>
                          <span className="text-purple-300 font-bold block">{log.action}</span>
                          {log.details && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs font-sans">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  onClick={() => setEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving Changes...' : 'Save 360° Profile Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
