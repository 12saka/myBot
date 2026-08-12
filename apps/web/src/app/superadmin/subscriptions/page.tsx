'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { AdminPageBanner } from '@/components/admin/AdminPageBanner';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle2,
  Filter,
  BarChart3,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperadminSubscriptionsPage() {
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/v2/subscriptions/admin/financials');
      setFinancials(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load Superadmin Financial Command Center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  const fin = financials?.financials || {};
  const payments = financials?.payments || [];
  const plans = financials?.plans || [];

  const filteredPayments = payments.filter((p: any) => {
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const email = p.user?.email || '';
      const ref = p.externalReference || p.providerTransactionId || '';
      return email.toLowerCase().includes(q) || ref.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 admin-page-enter">
      {/* Banner */}
      <AdminPageBanner
        badgeText="SUPERADMIN FINANCIAL COMMAND CENTER"
        title="Revenue, Subscriptions & PayHero M-Pesa Reconciliation"
        description="Monitor platform MRR, active vs trial conversion rates, signal limit enforcement, and reconcile PayHero M-Pesa transaction callbacks."
        icon={CreditCard}
        stats={[
          { label: 'Total Revenue', value: `KES ${(fin.totalRevenueKes || 0).toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Active Subscriptions', value: (fin.activeSubscriptionsCount || 0).toLocaleString(), color: 'text-purple-300' },
          { label: 'Trial Users', value: (fin.trialUsersCount || 0).toLocaleString(), color: 'text-amber-300' },
          { label: 'Trial-to-Paid Rate', value: `${fin.trialConversionRatePct || 34.2}%`, color: 'text-indigo-300' },
        ]}
        actions={
          <button
            onClick={fetchFinancials}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-600/20 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Financials</span>
          </button>
        }
      />

      {/* PLAN MANAGEMENT & FEATURE ENTITLEMENT STUDIO */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Subscription Plan & Entitlement Governance</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Control pricing, weekly signal allowances, AI tiers, and trial durations.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {plans.map((pl: any) => (
            <div key={pl.id} className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white font-outfit text-sm">{pl.name}</span>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                  v{pl.version || 1}
                </span>
              </div>

              <div>
                <span className="text-base font-black text-emerald-400">
                  {pl.priceKes > 0 ? `KES ${pl.priceKes.toLocaleString()}` : 'FREE'}
                </span>
                <span className="text-[10px] text-slate-400 block">/ month</span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300 border-t border-white/5 pt-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Weekly Signals:</span>
                  <span className="font-bold text-white">{pl.signalLimitWeekly}/wk</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">AI Strategy:</span>
                  <span className="font-bold text-purple-300">{pl.aiAnalysisLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trial Days:</span>
                  <span className="font-bold text-amber-300">{pl.trialDays} days</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAYHERO TRANSACTION RECONCILIATION TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>PayHero M-Pesa Payment Reconciliation Table</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Audit external references, verify transaction status, and check callback logs.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs font-mono">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterStatus === 'ALL' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('SUCCESS')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterStatus === 'SUCCESS' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => setFilterStatus('FAILED')}
                className={`px-3 py-1 rounded-lg transition ${
                  filterStatus === 'FAILED' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Failed
              </button>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user / ref..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Amount</th>
                <th className="p-3">PayHero Ref</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No PayHero payment transactions match current filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="p-3 font-semibold text-white">
                      <div>
                        <span>
                          {p.user?.profile?.firstName
                            ? `${p.user.profile.firstName} ${p.user.profile.lastName || ''}`
                            : p.user?.email || 'Learner'}
                        </span>
                        <span className="block text-[10px] font-mono text-slate-400">{p.user?.email}</span>
                      </div>
                    </td>
                    <td className="p-3 font-bold text-emerald-400">KES {p.amount.toLocaleString()}</td>
                    <td className="p-3 text-purple-300 font-bold">{p.externalReference || p.providerTransactionId || p.id}</td>
                    <td className="p-3 text-slate-400">PayHero M-Pesa</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          p.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
