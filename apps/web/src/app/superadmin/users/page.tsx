'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users, Search, Shield, UserCheck, Edit2, Trash2, DollarSign, ExternalLink, ShieldCheck, UserX, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Edit User Modal state
  const [editModal, setEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editRole, setEditRole] = useState('TRADER');
  const [editBalance, setEditBalance] = useState<number | string>(0);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editTelegramUrl, setEditTelegramUrl] = useState('');

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
    setEditRole(u.role || 'TRADER');
    setEditBalance(u.wallet?.balance || 0);
    setEditFirstName(u.profile?.firstName || '');
    setEditLastName(u.profile?.lastName || '');
    setEditTelegramUrl(u.profile?.website || u.profile?.telegramUrl || '');
    setEditModal(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
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
      toast.success(`User settings updated for ${selectedUser.email}`);
      setEditModal(false);
      fetchUsers(debouncedSearch, roleFilter);
    } catch (err: any) {
      toast.error(err.message || 'User update failed');
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
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-outfit font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Master User Control Suite</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Full operational control: manage roles, inspect telemetry, adjust wallet balances, link channels, and audit accounts.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-white/10 text-xs w-full sm:w-auto justify-center">
            {['ALL', 'TRADER', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold font-mono transition ${
                  roleFilter === r ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'SUPER_ADMIN' ? 'SUPER' : r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-white/10">
          <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Total Users</span>
          <span className="text-xl font-bold text-white font-mono">{totalUsers}</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-purple-500/20 bg-purple-950/10">
          <span className="text-[10px] uppercase font-mono text-purple-400 block font-bold">Super Admins</span>
          <span className="text-xl font-bold text-purple-300 font-mono">{superAdminsCount}</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-blue-500/20 bg-blue-950/10">
          <span className="text-[10px] uppercase font-mono text-blue-400 block font-bold">Admins</span>
          <span className="text-xl font-bold text-blue-300 font-mono">{adminsCount}</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10">
          <span className="text-[10px] uppercase font-mono text-emerald-400 block font-bold">Total Capital Assets</span>
          <span className="text-xl font-bold text-emerald-300 font-mono">${totalBalanceSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* High-Density Users Table */}
      <div className="glass-panel rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3.5">User Identity</th>
              <th className="p-3.5">Privilege Role</th>
              <th className="p-3.5">Direct Channel / Profile</th>
              <th className="p-3.5">KYC Status</th>
              <th className="p-3.5">Wallet Balance</th>
              <th className="p-3.5">Broker MT5 Sync</th>
              <th className="p-3.5">Joined Date</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                  Loading user directory telemetry...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-red-400 font-mono">
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
                <td colSpan={8} className="p-8 text-center text-slate-500 font-mono">
                  No users found matching query filters.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const channelUrl = u.profile?.website || u.profile?.telegramUrl || (u.email ? `https://t.me/${u.email.split('@')[0]}` : null);
                return (
                  <tr key={u.id} className="hover:bg-white/5 transition">
                    <td className="p-3.5">
                      <div className="font-semibold text-white">
                        {u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : 'Trader Account'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
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
                    <td className="p-3.5">
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
                        <span className="text-slate-500 font-mono text-[11px]">No channel link</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
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
                    <td className="p-3.5 font-mono font-semibold text-emerald-400">
                      ${(u.wallet?.balance || 0).toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      {u.brokerProfile?.status === 'connected' ? (
                        <span className="text-emerald-400 font-semibold">{u.brokerProfile.brokerType.toUpperCase()} (MT5)</span>
                      ) : (
                        'Disconnected'
                      )}
                    </td>
                    <td className="p-3.5 text-[11px] font-mono text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition text-xs inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-purple-300" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition text-xs inline-flex items-center"
                        title="Delete User"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Comprehensive Edit User Modal */}
      {editModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase">Superadmin Editor</span>
                <h3 className="text-base font-bold text-white">Manage User Settings</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">{selectedUser.email}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Channel / Telegram Profile URL</label>
                <input
                  type="url"
                  value={editTelegramUrl}
                  onChange={(e) => setEditTelegramUrl(e.target.value)}
                  placeholder="https://t.me/yourchannel"
                  className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">System Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="TRADER">TRADER (Default)</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Master Access)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Wallet Capital ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-emerald-400 font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
