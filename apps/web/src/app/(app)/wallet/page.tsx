'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw,
  TrendingUp, ShieldCheck, DollarSign, Plus, ArrowRight, Zap
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

const MOCK_ASSETS = [
  { name: 'US Dollar', symbol: 'USD', balance: 12450.00, value: 12450.00, icon: '$', change24h: 0 },
  { name: 'Bitcoin', symbol: 'BTC', balance: 0.42, value: 27013.77, icon: '₿', change24h: 1.97 },
  { name: 'Ethereum', symbol: 'ETH', balance: 4.8, value: 15275.52, icon: 'Ξ', change24h: -1.67 },
  { name: 'Solana', symbol: 'SOL', balance: 18.0, value: 3324.96, icon: 'S', change24h: 4.61 },
];

const MOCK_TXS = [
  { id: 'tx1', type: 'Deposit', asset: 'USDT', amount: '5,000.00', status: 'Completed', date: '2026-07-01 14:24' },
  { id: 'tx2', type: 'Withdrawal', asset: 'ETH', amount: '1.20', status: 'Completed', date: '2026-06-28 09:12' },
  { id: 'tx3', type: 'Trade Buy', asset: 'BTC', amount: '0.15', status: 'Completed', date: '2026-06-25 18:45' },
  { id: 'tx4', type: 'Deposit', asset: 'USD', amount: '10,000.00', status: 'Completed', date: '2026-06-20 11:30' },
  { id: 'tx5', type: 'Trade Sell', asset: 'SOL', amount: '12.00', status: 'Completed', date: '2026-06-15 15:02' },
];

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalBalance = MOCK_ASSETS.reduce((acc, asset) => acc + asset.value, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success(`${activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} of ${amount} ${selectedAsset} initiated successfully!`);
      setAmount('');
    }, 1500);
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Secure Wallet"
        subtitle="Manage your deposits, withdrawals, and asset balances in real-time."
        icon={Wallet}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold">
          <ShieldCheck size={14} />
          Secured with AES-256
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet balances */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              label="Estimated Value"
              value={formatCurrency(totalBalance)}
              subValue="Combined Crypto & Fiat balance"
              icon={Wallet}
              glowColor="purple"
            />
            <StatCard
              label="Available Cash (USD)"
              value={formatCurrency(MOCK_ASSETS[0].balance)}
              subValue="Ready for immediate trading"
              icon={DollarSign}
              glowColor="green"
            />
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-display font-bold text-white mb-4">My Assets</h3>
            <div className="space-y-3.5">
              {MOCK_ASSETS.map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/4 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-300">
                      {asset.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{asset.name}</div>
                      <div className="text-[10px] text-slate-500">{asset.balance} {asset.symbol}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white text-sm">{formatCurrency(asset.value)}</div>
                    {asset.change24h !== 0 ? (
                      <div className={`text-[10px] font-bold ${asset.change24h > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500">Stable</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs mb-5">
              <button
                onClick={() => { setActiveTab('deposit'); setAmount(''); }}
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'deposit' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <ArrowDownLeft size={14} /> Deposit
              </button>
              <button
                onClick={() => { setActiveTab('withdraw'); setAmount(''); }}
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'withdraw' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                <ArrowUpRight size={14} /> Withdraw
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Select Asset</label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full input-glass rounded-xl px-3 py-2.5 text-xs bg-slate-900 border border-white/8 text-white focus:outline-none"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="BTC">BTC - Bitcoin</option>
                  <option value="ETH">ETH - Ethereum</option>
                  <option value="SOL">SOL - Solana</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full input-glass rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">{selectedAsset}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : activeTab === 'deposit' ? (
                  <><Plus size={14} /> Deposit Funds</>
                ) : (
                  <><ArrowUpRight size={14} /> Withdraw Funds</>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-[10px] text-slate-500 leading-normal flex items-start gap-2">
            <Zap size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <span>
              Transactions are processed instantly. Large crypto withdrawals may take up to 24 hours to clear manual security audits.
            </span>
          </div>
        </div>
      </div>

      {/* Transactions History */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-white flex items-center gap-2">
            <RefreshCw size={16} className="text-purple-400" />
            Transaction History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Type</th>
                <th className="text-left">Asset</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Date</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TXS.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <span className="font-semibold text-slate-200 text-xs flex items-center gap-1">
                      {tx.type.includes('Deposit') ? (
                        <ArrowDownLeft size={12} className="text-emerald-400" />
                      ) : (
                        <ArrowUpRight size={12} className="text-red-400" />
                      )}
                      {tx.type}
                    </span>
                  </td>
                  <td className="text-slate-300 font-semibold text-xs">{tx.asset}</td>
                  <td className="text-right font-mono font-semibold text-xs text-white">{tx.amount}</td>
                  <td className="text-right text-slate-500 text-xs">{tx.date}</td>
                  <td className="text-center">
                    <Badge variant="green" size="xs">{tx.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
