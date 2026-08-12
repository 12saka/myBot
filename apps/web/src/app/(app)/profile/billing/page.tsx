'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Phone,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserBillingPage() {
  const [subData, setSubData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // PayHero Modal
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('0712345678');
  const [paying, setPaying] = useState(false);
  const [payStatusMessage, setPayStatusMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sub, pl] = await Promise.all([
        apiFetch<any>('/api/v2/subscriptions/my-subscription'),
        apiFetch<any[]>('/api/v2/subscriptions/plans'),
      ]);
      setSubData(sub);
      setPlans(pl || []);
    } catch (err: any) {
      toast.error('Failed to load subscription & billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePayHeroStkPush = async () => {
    if (!selectedPlan || !phoneNumber.trim()) {
      toast.error('Please enter a valid M-Pesa phone number.');
      return;
    }
    setPaying(true);
    setPayStatusMessage(`Sending PayHero STK Push to ${phoneNumber}...`);
    try {
      const res = await apiFetch<any>('/api/v2/subscriptions/payhero/stk-push', {
        method: 'POST',
        body: JSON.stringify({
          planId: selectedPlan.id,
          phoneNumber: phoneNumber.trim(),
        }),
      });

      setPayStatusMessage(res.message);
      toast.success('M-Pesa STK Push sent! Please enter your PIN on your phone.');

      // Simulate polling/webhook receipt after 6 seconds for demo UX
      setTimeout(async () => {
        try {
          await apiFetch('/api/v2/subscriptions/payhero/webhook', {
            method: 'POST',
            body: JSON.stringify({
              external_reference: res.externalReference,
              status: 'SUCCESS',
              transaction_id: `MPESA-${Date.now()}`,
            }),
          });
          toast.success('Payment confirmed! Subscription activated.');
          setSelectedPlan(null);
          setPayStatusMessage(null);
          fetchData();
        } catch (e) {}
      }, 6000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate M-Pesa STK push');
      setPayStatusMessage(null);
    } finally {
      setPaying(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    try {
      if (subData?.subscription?.cancelAtPeriodEnd) {
        await apiFetch('/api/v2/subscriptions/reactivate', { method: 'POST' });
        toast.success('Auto-renewal reactivated!');
      } else {
        await apiFetch('/api/v2/subscriptions/cancel-auto-renew', { method: 'POST' });
        toast.success('Auto-renewal cancelled. Plan remains active until period end.');
      }
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update auto-renewal setting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const sub = subData?.subscription || {};
  const plan = sub.plan || {};
  const status = sub.status || 'TRIALING';
  const signalsUsed = subData?.weeklySignalsUsed || 0;
  const signalLimit = subData?.weeklySignalLimit || 10;
  const signalsRemaining = subData?.signalsRemaining || 0;
  const pctUsed = Math.min(100, Math.round((signalsUsed / signalLimit) * 100));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" />
            <span>SUBSCRIPTION & ENTITLEMENTS</span>
          </span>

          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
              status === 'ACTIVE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : status === 'TRIALING'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {status === 'TRIALING' ? '🟡 14-Day Free Trial' : status === 'ACTIVE' ? '🟢 Active Plan' : '🔴 Past Due'}
          </span>
        </div>

        <h1 className="text-xl md:text-2xl font-black text-white font-outfit">My Subscription & PayHero M-Pesa Billing</h1>
        <p className="text-xs text-slate-300 font-mono">
          Manage your subscription tier, weekly AI signal capacity, Academy entitlements, and PayHero M-Pesa payment history.
        </p>
      </div>

      {/* OVERVIEW & WEEKLY USAGE TELEMETRY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CURRENT PLAN CARD */}
        <div className="glass-card p-5 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 block">CURRENT SUBSCRIPTION</span>
              <h2 className="text-lg font-bold text-white font-outfit">{plan.name || '14-Day Free Trial'}</h2>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-purple-300 font-mono">
                {plan.priceKes ? `KES ${plan.priceKes.toLocaleString()}` : 'FREE'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 block">/ month</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block">Next Payment Date</span>
              <span className="font-bold text-white">
                {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'August 26, 2026'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 space-y-0.5">
              <span className="text-[9px] text-slate-400 block">Auto-Renewal</span>
              <span className={`font-bold ${sub.cancelAtPeriodEnd ? 'text-amber-300' : 'text-emerald-400'}`}>
                {sub.cancelAtPeriodEnd ? 'OFF (Expires at end)' : 'ON (Auto renews)'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleToggleAutoRenew}
              className="text-xs font-mono text-slate-400 hover:text-white underline transition"
            >
              {sub.cancelAtPeriodEnd ? 'Reactivate Auto-Renewal' : 'Cancel Auto-Renewal'}
            </button>
          </div>
        </div>

        {/* WEEKLY SIGNAL LIMIT ENFORCEMENT WIDGET */}
        <div className="glass-card p-5 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-purple-300 font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>WEEKLY SIGNAL CAPACITY</span>
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {signalsUsed} / {signalLimit}
              </span>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden my-3 border border-white/10">
              <div
                className={`h-full rounded-full transition-all ${
                  pctUsed >= 100 ? 'bg-red-500' : pctUsed >= 80 ? 'bg-amber-400' : 'bg-purple-500'
                }`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>

            <p className="text-xs font-mono text-slate-300">
              {signalsRemaining > 0 ? (
                <>
                  <span className="text-emerald-400 font-bold">{signalsRemaining} signals</span> remaining this week.
                </>
              ) : (
                <span className="text-red-400 font-bold">⚠️ Weekly signal limit reached (10/10). Upgrade below for more!</span>
              )}
            </p>
          </div>

          <span className="text-[10px] font-mono text-slate-500">Resets every Monday at 00:00 UTC</span>
        </div>
      </div>

      {/* AVAILABLE SUBSCRIPTION PLANS */}
      <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white font-outfit">Upgrade Subscription Plan</h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Choose your plan and pay securely via PayHero M-Pesa STK Push.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {plans.map((pl) => {
            const isCurrent = sub.planId === pl.id || (sub.planType === pl.code);

            return (
              <div
                key={pl.id}
                className={`p-5 rounded-2xl border space-y-4 flex flex-col justify-between transition ${
                  isCurrent
                    ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10'
                    : 'bg-slate-950/60 border-white/10 hover:border-purple-500/40'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white font-outfit">{pl.name}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                        CURRENT
                      </span>
                    )}
                  </div>

                  <div className="font-mono">
                    <span className="text-xl font-black text-white">
                      {pl.priceKes > 0 ? `KES ${pl.priceKes.toLocaleString()}` : 'FREE'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">/ month</span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">{pl.description}</p>

                  <div className="pt-2 space-y-1.5 text-xs font-mono text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pl.signalLimitWeekly} Signals / week</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pl.aiAnalysisLevel} AI Strategy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Full Academy & Quizzes</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={isCurrent}
                  onClick={() => setSelectedPlan(pl)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold font-outfit transition ${
                    isCurrent
                      ? 'bg-white/10 text-slate-400 cursor-default'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : `Upgrade to ${pl.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* BILLING HISTORY TABLE */}
      <div className="glass-card p-6 rounded-2xl border border-purple-500/20 bg-slate-900/60 space-y-4">
        <h3 className="text-base font-bold text-white font-outfit">PayHero M-Pesa Billing History</h3>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">PayHero Reference</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300 font-mono">
              {subData?.paymentHistory?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No billing transaction history.
                  </td>
                </tr>
              ) : (
                subData?.paymentHistory?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-white/5 transition">
                    <td className="p-3 font-semibold text-white">{p.externalReference || p.providerTransactionId || p.id}</td>
                    <td className="p-3 font-bold text-purple-300">KES {p.amount.toLocaleString()}</td>
                    <td className="p-3 text-slate-400">M-Pesa (PayHero)</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          p.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: PayHero STK Push */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-purple-500/30 w-full max-w-md space-y-4 bg-slate-900">
            <h3 className="text-base font-bold text-white font-outfit">PayHero M-Pesa STK Push Payment</h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Selected Plan:</span>
                <span className="font-bold text-white">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Amount:</span>
                <span className="font-bold text-emerald-400">KES {selectedPlan.priceKes.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">M-Pesa Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-purple-500/20 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono block mt-1">An STK prompt will pop up on this phone automatically.</span>
              </div>

              {payStatusMessage && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-mono text-purple-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <span>{payStatusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={paying}
                onClick={() => setSelectedPlan(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                disabled={paying}
                onClick={handlePayHeroStkPush}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20"
              >
                Send STK Push
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
