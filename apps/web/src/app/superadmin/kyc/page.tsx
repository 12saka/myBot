'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ShieldCheck, Check, X, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminKycPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/kyc');
      setQueue(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleApprove = async (id: string, email: string) => {
    try {
      await apiFetch(`/api/v2/admin/kyc/${id}/approve`, { method: 'PATCH' });
      toast.success(`KYC Approved for ${email}`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    }
  };

  const handleReject = async (id: string, email: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await apiFetch(`/api/v2/admin/kyc/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      });
      toast.error(`KYC Rejected for ${email}`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-outfit font-bold text-white">KYC Verification Queue</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Review submitted identity documents, verify national IDs, and approve/reject compliance records.
        </p>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3.5">User</th>
              <th className="p-3.5">National ID</th>
              <th className="p-3.5">Document Type</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Face Verification</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Loading KYC queue...
                </td>
              </tr>
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No KYC records found in queue.
                </td>
              </tr>
            ) : (
              queue.map((rec) => (
                <tr key={rec.id} className="hover:bg-white/5 transition">
                  <td className="p-3.5">
                    <div className="font-semibold text-white">
                      {rec.user?.profile?.firstName} {rec.user?.profile?.lastName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{rec.user?.email}</div>
                  </td>
                  <td className="p-3.5 font-mono text-purple-300">
                    {rec.user?.profile?.nationalId || 'N/A'}
                  </td>
                  <td className="p-3.5 font-mono">{rec.documentType || 'National ID Card'}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        rec.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : rec.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono">
                    {rec.faceVerified ? (
                      <span className="text-emerald-400">PASSED</span>
                    ) : (
                      <span className="text-slate-500">PENDING</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => handleApprove(rec.id, rec.user?.email)}
                      className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(rec.id, rec.user?.email)}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold transition"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
