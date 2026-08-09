'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  ShieldCheck, Check, X, Eye, RefreshCw, Search, Clock, ShieldAlert, FileText, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminKycPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Document Lightbox modal state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  // Styled Rejection Modal state
  const [rejectRecord, setRejectRecord] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejecting, setRejecting] = useState<boolean>(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/kyc');
      setQueue(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load KYC verification queue.');
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

  const handleConfirmReject = async () => {
    if (!rejectRecord) return;
    if (!rejectionReason.trim()) {
      toast.error('Please select or provide a rejection reason.');
      return;
    }
    setRejecting(true);
    try {
      await apiFetch(`/api/v2/admin/kyc/${rejectRecord.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      toast.success(`KYC Rejected for ${rejectRecord.user?.email || 'user'}`);
      setRejectRecord(null);
      setRejectionReason('');
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  // Filter queue
  const filteredQueue = queue.filter((rec) => {
    const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      rec.user?.email?.toLowerCase().includes(searchLower) ||
      rec.user?.profile?.firstName?.toLowerCase().includes(searchLower) ||
      rec.user?.profile?.lastName?.toLowerCase().includes(searchLower) ||
      rec.user?.profile?.nationalId?.toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalCount = queue.length;
  const pendingCount = queue.filter((r) => r.status === 'PENDING').length;
  const approvedCount = queue.filter((r) => r.status === 'APPROVED').length;
  const rejectedCount = queue.filter((r) => r.status === 'REJECTED').length;

  const reasonPresets = [
    'Blurry or unreadable document photo',
    'National ID number mismatch with profile',
    'Expired document or invalid ID type',
    'Face verification mismatch',
    'Proof of address missing or outdated',
  ];

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Executive Page Banner */}
      <AdminPageBanner
        badgeText="COMPLIANCE & AML GOVERNANCE"
        title="KYC Identity Verification Queue"
        description="Review submitted identity verification documents, national IDs, and face check telemetry. Enforce global compliance rules."
        icon={ShieldCheck}
        stats={[
          { label: 'Total Submissions', value: totalCount, color: 'text-purple-300' },
          { label: 'Pending Review', value: pendingCount, color: 'text-amber-400' },
          { label: 'Approved', value: approvedCount, color: 'text-emerald-400' },
        ]}
        actions={
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel border border-white/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-slate-400 font-bold tracking-wider">Total Queue</p>
            <p className="text-2xl font-extrabold font-outfit text-white mt-1">{totalCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-amber-500/20 bg-amber-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-amber-400 font-bold tracking-wider">Pending Action</p>
            <p className="text-2xl font-extrabold font-outfit text-amber-300 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-emerald-500/20 bg-emerald-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-emerald-400 font-bold tracking-wider">Approved Records</p>
            <p className="text-2xl font-extrabold font-outfit text-emerald-300 mt-1">{approvedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-red-500/20 bg-red-950/10 flex items-center justify-between admin-stat-card">
          <div>
            <p className="text-[11px] font-mono uppercase text-red-400 font-bold tracking-wider">Rejected Records</p>
            <p className="text-2xl font-extrabold font-outfit text-red-300 mt-1">{rejectedCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Status Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-3.5 rounded-2xl border border-white/10">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-white/10 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Submissions', count: totalCount },
            { id: 'PENDING', label: 'Pending Review', count: pendingCount },
            { id: 'APPROVED', label: 'Approved', count: approvedCount },
            { id: 'REJECTED', label: 'Rejected', count: rejectedCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold font-outfit transition flex items-center gap-2 shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === tab.id ? 'bg-purple-400/30 text-white' : 'bg-white/10 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search email, name, national ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition"
          />
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">User & Contact</th>
                <th className="p-4">National ID</th>
                <th className="p-4">Document Type</th>
                <th className="p-4">Compliance Status</th>
                <th className="p-4">Biometric Verification</th>
                <th className="p-4">Submitted Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Fetching compliance documents from gateway...
                  </td>
                </tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 font-mono">
                    <div className="max-w-xs mx-auto space-y-2">
                      <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="font-semibold text-slate-400">No KYC records found</p>
                      <p className="text-[11px] text-slate-500">No identity documents matching your current filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredQueue.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/5 transition">
                    <td className="p-4">
                      <div className="font-bold text-white font-outfit text-sm">
                        {rec.user?.profile?.firstName || 'User'} {rec.user?.profile?.lastName || ''}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{rec.user?.email}</div>
                    </td>

                    <td className="p-4 font-mono font-bold text-purple-300">
                      {rec.user?.profile?.nationalId || 'N/A'}
                    </td>

                    <td className="p-4 font-mono">
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-[11px]">
                        {rec.documentType || 'National ID Card'}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 w-max ${
                          rec.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : rec.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          rec.status === 'APPROVED' ? 'bg-emerald-400' : rec.status === 'PENDING' ? 'bg-amber-400 animate-ping' : 'bg-red-400'
                        }`} />
                        <span>{rec.status}</span>
                      </span>
                    </td>

                    <td className="p-4 font-mono text-[11px]">
                      {rec.faceVerified ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> PENDING
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-[11px] font-mono text-slate-400">
                      {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : 'Recent'}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition inline-flex items-center gap-1"
                        title="View Document Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-300" />
                        <span>Inspect</span>
                      </button>

                      {rec.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleApprove(rec.id, rec.user?.email || '')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      )}

                      {rec.status !== 'REJECTED' && (
                        <button
                          onClick={() => {
                            setRejectRecord(rec);
                            setRejectionReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-semibold text-xs transition inline-flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Lightbox / Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 w-full max-w-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider">KYC Verification Audit</span>
                <h3 className="text-lg font-bold text-white font-outfit">
                  {selectedRecord.user?.profile?.firstName} {selectedRecord.user?.profile?.lastName || 'Trader'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 block">User Email</span>
                <span className="font-mono font-semibold text-white">{selectedRecord.user?.email}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 block">National ID</span>
                <span className="font-mono font-bold text-purple-300">{selectedRecord.user?.profile?.nationalId || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 block">Document Type</span>
                <span className="font-semibold text-slate-200">{selectedRecord.documentType || 'National ID Card'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 block">Status</span>
                <span className="font-bold text-amber-300 font-mono">{selectedRecord.status}</span>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-3">
              <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Submitted Document Photo / ID Image
              </span>
              <div className="w-full h-48 rounded-xl bg-slate-900 border border-white/10 flex flex-col items-center justify-center text-center p-4 relative overflow-hidden">
                {selectedRecord.documentUrl ? (
                  <img
                    src={selectedRecord.documentUrl}
                    alt="National ID Document"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="space-y-2">
                    <ShieldAlert className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
                    <p className="text-xs font-mono text-slate-400">Document Image Sealed & Encrypted</p>
                    <p className="text-[10px] font-mono text-slate-500">ID Verification # {selectedRecord.id.slice(0, 12)}...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
              {selectedRecord.status !== 'APPROVED' && (
                <button
                  onClick={() => {
                    const id = selectedRecord.id;
                    const email = selectedRecord.user?.email || '';
                    setSelectedRecord(null);
                    handleApprove(id, email);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20"
                >
                  Approve KYC
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectRecord && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-red-500/30 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-outfit">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Reject KYC Submission
              </h3>
              <button
                onClick={() => setRejectRecord(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Rejecting submission for <span className="font-mono font-bold text-white">{rejectRecord.user?.email}</span>. Please select or enter the compliance failure rationale.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400 block uppercase font-bold">Preset Reasons</label>
              <div className="space-y-1.5">
                {reasonPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReason(preset)}
                    className={`w-full text-left p-2 rounded-lg text-xs font-mono transition border ${
                      rejectionReason === preset
                        ? 'bg-red-500/20 text-red-300 border-red-500/40 font-semibold'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/5'
                    }`}
                  >
                    • {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block uppercase font-bold mb-1">Custom Explanation</label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide detailed feedback for the user..."
                className="w-full p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setRejectRecord(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-500/20 disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
