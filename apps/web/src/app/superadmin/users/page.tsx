'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users, Search, Shield, UserCheck, MoreVertical, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [roleModal, setRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('TRADER');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/api/v2/admin/users?search=${encodeURIComponent(search)}`);
      setUsers(res?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    try {
      await apiFetch(`/api/v2/admin/users/${selectedUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(`Role updated for ${selectedUser.email}`);
      setRoleModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Role update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-outfit font-bold text-white">User Management</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Search users, inspect balances, assign roles, and manage access privileges.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search email, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>

      {/* Users High-Density Table */}
      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3.5">User</th>
              <th className="p-3.5">Role</th>
              <th className="p-3.5">KYC Status</th>
              <th className="p-3.5">Wallet Balance</th>
              <th className="p-3.5">Broker Sync</th>
              <th className="p-3.5">Joined</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-white/5 transition">
                  <td className="p-3.5">
                    <div className="font-semibold text-white">
                      {u.profile?.firstName ? `${u.profile.firstName} ${u.profile.lastName || ''}` : 'Unnamed User'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
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
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedUser(u);
                        setNewRole(u.role);
                        setRoleModal(true);
                      }}
                      className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-medium transition"
                    >
                      Edit Role
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role Assignment Modal */}
      {roleModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Change User Role</h3>
            <p className="text-xs text-slate-400 font-mono">
              Target: <span className="text-purple-300 font-semibold">{selectedUser.email}</span>
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-semibold">Select Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="TRADER">TRADER (Default)</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (Master Access)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRoleModal(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-500/20"
              >
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
