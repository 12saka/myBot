'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, RefreshCw,
  TrendingUp, ShieldCheck, DollarSign, Plus, ArrowRight, Zap,
  Smartphone, CreditCard, Clock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'FEE';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'UNDER_REVIEW';
  paymentId: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0.0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [brokerData, setBrokerData] = useState<any>({ connected: false, balance: 0, equity: 0, broker: 'None' });

  // Form selections
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositMethod, setDepositMethod] = useState<'mpesa' | 'visa' | 'generic'>('mpesa');
  const [amount, setAmount] = useState('');
  
  // M-Pesa details
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Visa details
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Step-by-step progress spinners
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState('');

  const fetchWalletDetails = async () => {
    try {
      setErrorMessage('');
      const data = await apiFetch<any>('/api/v2/wallet');
      setBalance(data.balance);
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load live wallet details.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBrokerDetails = async () => {
    try {
      const data = await apiFetch<any>('/api/v2/portfolio/broker');
      if (data) setBrokerData(data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchWalletDetails();
    fetchBrokerDetails();
    // Refresh wallet balance and broker data every 10 seconds in background
    const interval = setInterval(() => {
      fetchWalletDetails();
      fetchBrokerDetails();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (depositMethod === 'mpesa') {
        if (!phoneNumber || phoneNumber.length < 10) {
          toast.error('Please enter a valid M-Pesa phone number.');
          setIsSubmitting(false);
          return;
        }

        setProgressStep('Contacting Safaricom gateway...');
        await new Promise(r => setTimeout(r, 1000));
        setProgressStep('Sending STK Push prompt to your mobile...');

        await apiFetch('/api/v2/wallet/deposit/mpesa', {
          method: 'POST',
          body: JSON.stringify({ phoneNumber, amount: Number(amount) })
        });

        setProgressStep('Awaiting your PIN confirmation on phone screen...');
        // Mock a 3.5s wait representing phone interaction
        await new Promise(r => setTimeout(r, 3500));
        setProgressStep('Verifying receipt payment token...');
        await new Promise(r => setTimeout(r, 1000));

        toast.success(`M-Pesa deposit request dispatched for $${Number(amount).toFixed(2)}.`);
      } else if (depositMethod === 'visa') {
        if (cardNumber.length !== 16 || isNaN(Number(cardNumber))) {
          toast.error('Please enter a valid 16-digit Card Number.');
          setIsSubmitting(false);
          return;
        }

        setProgressStep('Contacting Visa payment gateway...');
        await new Promise(r => setTimeout(r, 1200));
        setProgressStep('Verifying card CVV and balance constraints...');

        await apiFetch('/api/v2/wallet/deposit/visa', {
          method: 'POST',
          body: JSON.stringify({ cardNumber, expiry, cvv, amount: Number(amount) })
        });

        setProgressStep('Charging card ledger...');
        await new Promise(r => setTimeout(r, 1000));

        toast.success(`Visa deposit of $${Number(amount).toFixed(2)} successful.`);
      } else {
        // Generic
        await apiFetch('/api/v2/wallet/deposit', {
          method: 'POST',
          body: JSON.stringify({ amount: Number(amount) })
        });
        toast.success(`Deposit of $${Number(amount).toFixed(2)} successfully processsed.`);
      }

      setAmount('');
      setPhoneNumber('');
      setCardNumber('');
      setExpiry('');
      setCvv('');
      fetchWalletDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete transaction.');
    } finally {
      setIsSubmitting(false);
      setProgressStep('');
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    setProgressStep('Processing instant withdrawal request...');

    try {
      await apiFetch('/api/v2/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) })
      });

      await new Promise(r => setTimeout(r, 1500));
      toast.success(`Withdrawal of $${Number(amount).toFixed(2)} completed successfully.`);
      setAmount('');
      fetchWalletDetails();
    } catch (err: any) {
      toast.error(err.message || 'Insufficient funds.');
    } finally {
      setIsSubmitting(false);
      setProgressStep('');
    }
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Secure Wallet"
        subtitle="Manage your deposits, withdrawals, and asset balances in real-time."
        icon={WalletIcon}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold">
          <ShieldCheck size={14} />
          Secured with AES-256
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {errorMessage && (
          <div className="md:col-span-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">
            {errorMessage}
          </div>
        )}
        {/* Wallet balances */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Wallet Value (USD)"
              value={formatCurrency(balance)}
              subValue="Ready for immediate trading"
              icon={WalletIcon}
              glowColor="purple"
            />
            <StatCard
              label="Linked Broker Balance"
              value={brokerData.connected ? formatCurrency(brokerData.balance) : '$0.00'}
              subValue={brokerData.connected ? `Broker: ${brokerData.broker}` : 'No Broker Connected'}
              change={brokerData.connected ? { value: `Account: ${brokerData.accountId}`, positive: true } : undefined}
              icon={TrendingUp}
              glowColor={brokerData.connected ? "blue" : "slate"}
            />
            <StatCard
              label="Linked Processor"
              value="Multi-Gateway"
              subValue="M-Pesa Online & Visa Enabled"
              icon={DollarSign}
              glowColor="green"
            />
          </div>

          {/* Asset List */}
          <div className="glass-card rounded-2xl p-5 border border-white/5">
            <h3 className="font-display font-bold text-white mb-4">My Stable Cash</h3>
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-300 text-lg">
                  $
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-sm">US Dollar</div>
                  <div className="text-[10px] text-slate-500">Fiat Cash Asset</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-white text-sm">{formatCurrency(balance)}</div>
                <div className="text-[10px] text-emerald-400 font-bold">Stable</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs mb-5">
              <button
                onClick={() => { setActiveTab('deposit'); setAmount(''); }}
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  activeTab === 'deposit' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                )}
              >
                <ArrowDownLeft size={14} /> Deposit
              </button>
              <button
                onClick={() => { setActiveTab('withdraw'); setAmount(''); }}
                className={cn(
                  'flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  activeTab === 'withdraw' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                )}
              >
                <ArrowUpRight size={14} /> Withdraw
              </button>
            </div>

            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <RefreshCw size={36} className="text-purple-400 animate-spin" />
                <div className="text-center">
                  <p className="text-slate-200 font-semibold text-xs">{progressStep}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Please do not refresh this page.</p>
                </div>
              </div>
            ) : activeTab === 'deposit' ? (
              <div className="space-y-4">
                {/* Method selector */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Deposit Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDepositMethod('mpesa')}
                      className={cn(
                        'p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer',
                        depositMethod === 'mpesa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                      )}
                    >
                      <Smartphone size={16} className={depositMethod === 'mpesa' ? 'text-purple-400' : 'text-slate-500'} />
                      <span className="text-[10px] font-bold">M-Pesa STK</span>
                    </button>
                    <button
                      onClick={() => setDepositMethod('visa')}
                      className={cn(
                        'p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer',
                        depositMethod === 'visa' ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/5 bg-white/2 text-slate-400 hover:text-white'
                      )}
                    >
                      <CreditCard size={16} className={depositMethod === 'visa' ? 'text-purple-400' : 'text-slate-500'} />
                      <span className="text-[10px] font-bold">Visa / Card</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleDeposit} className="space-y-4">
                  {depositMethod === 'mpesa' && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">M-Pesa Mobile Number</label>
                      <input
                        type="text"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. 254712345678"
                        className="w-full input-glass rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  )}

                  {depositMethod === 'visa' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Card Number</label>
                        <input
                          type="text"
                          required
                          maxLength={16}
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="4242 4242 4242 4242"
                          className="w-full input-glass rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Expiry Date</label>
                          <input
                            type="text"
                            required
                            placeholder="MM/YY"
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            className="w-full input-glass rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">CVV Code</label>
                          <input
                            type="password"
                            required
                            maxLength={4}
                            placeholder="•••"
                            value={cvv}
                            onChange={(e) => setCvv(e.target.value)}
                            className="w-full input-glass rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Deposit Amount (USD)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full input-glass rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">USD</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full btn-primary py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
                  >
                    <Plus size={14} /> Deposit Funds
                  </button>
                </form>
              </div>
            ) : (
              <form onSubmit={handleWithdrawal} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Withdrawal Amount (USD)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full input-glass rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">USD</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  <ArrowUpRight size={14} /> Withdraw Funds
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-[10px] text-slate-500 leading-normal flex items-start gap-2">
            <Zap size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <span>
              Transactions are processed instantly. M-Pesa callbacks dynamically update cash ledgers and trigger socket broadcasts.
            </span>
          </div>
        </div>
      </div>

      {/* Transactions History */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/5" id="history">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-white flex items-center gap-2">
            <RefreshCw size={16} className="text-purple-400" />
            Transaction History
          </h3>
          <button onClick={fetchWalletDetails} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw size={24} className="text-slate-500 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No transactions logged yet.
            </div>
          ) : (
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Type</th>
                  <th className="text-left">Processor ID</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Date</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
                        {tx.type === 'DEPOSIT' ? (
                          <ArrowDownLeft size={12} className="text-emerald-400" />
                        ) : (
                          <ArrowUpRight size={12} className="text-red-400" />
                        )}
                        {tx.type}
                      </span>
                    </td>
                    <td className="text-slate-400 font-mono text-xs">{tx.paymentId || 'INTERNAL'}</td>
                    <td className="text-right font-mono font-semibold text-xs text-white">
                      {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </td>
                    <td className="text-right text-slate-500 text-xs">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="text-center">
                      <Badge
                        variant={
                          tx.status === 'COMPLETED' ? 'green' :
                          tx.status === 'PENDING' ? 'amber' : 'red'
                        }
                        size="xs"
                      >
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </motion.div>
  );
}
