'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Zap, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SuperadminSignalsPage() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSignals = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await apiFetch<any[]>('/api/v2/admin/signals');
      setSignals(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSignals(true);
    const interval = setInterval(() => {
      fetchSignals(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleExpire = async (id: string, symbol: string) => {
    try {
      await apiFetch(`/api/v2/admin/signals/${id}/expire`, { method: 'PATCH' });
      toast.success(`Expired signal for ${symbol}`);
      fetchSignals(false);
    } catch (err: any) {
      toast.error(err.message || 'Override failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-outfit font-bold text-white">Signal Audit & Override Queue</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Monitor live AI signals, audit confidence breakdowns, and manually expire compromised signals.
          </p>
        </div>
        <button
          onClick={() => fetchSignals(false)}
          disabled={isRefreshing}
          className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono font-semibold text-slate-300 border border-white/10 flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
            <tr>
              <th className="p-3.5">Symbol</th>
              <th className="p-3.5">Direction</th>
              <th className="p-3.5">Entry Price</th>
              <th className="p-3.5">Stop Loss / TP1</th>
              <th className="p-3.5">Win Probability</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Loading signals...
                </td>
              </tr>
            ) : signals.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No signals found.
                </td>
              </tr>
            ) : (
              signals.map((sig) => {
                const isExpired = new Date(sig.expiresAt).getTime() <= Date.now();
                return (
                  <tr key={sig.id} className="hover:bg-white/5 transition">
                    <td className="p-3.5 font-bold text-white font-mono">{sig.symbol}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          sig.direction === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {sig.direction}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-purple-300">${Number(sig.entryPrice).toFixed(2)}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-400">
                      SL: ${Number(sig.stopLoss).toFixed(2)} / TP1: ${Number(sig.takeProfit1).toFixed(2)}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">{sig.winProbability}%</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          !isExpired ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {!isExpired ? 'ACTIVE' : 'EXPIRED'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {!isExpired && (
                        <button
                          onClick={() => handleExpire(sig.id, sig.symbol)}
                          className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold transition"
                        >
                          Expire Now
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
