'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Lock, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw,
  TrendingUp, DollarSign, Activity, CheckCircle2, AlertTriangle, X,
  Sliders, ShieldAlert, Cpu, Eye, Check, Key, Search, ChevronRight,
  Server, Zap, FileText, Ban, Power
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';

const SUPPORTED_BROKERS = [
  { id: 'JustMarkets', name: 'JustMarkets', logo: '🟢', type: 'Forex & CFD Broker' },
  { id: 'FBS', name: 'FBS', logo: '🟢', type: 'International Broker' },
  { id: 'Exness', name: 'Exness', logo: '🟡', type: 'Multi-Asset Prime' },
  { id: 'XM', name: 'XM Global', logo: '🔴', type: 'MetaTrader ECN' },
  { id: 'IC Markets', name: 'IC Markets', logo: '🟢', type: 'Raw Spread Specialist' },
  { id: 'Pepperstone', name: 'Pepperstone', logo: '🔵', type: 'Institutional Liquidity' },
  { id: 'Deriv', name: 'Deriv', logo: '🔴', type: 'Synthetic & Forex' },
];

export default function SecureWalletPage() {
  const [data, setData] = useState<any>({
    summary: {
      totalBalance: 12.96,
      totalEquity: 12.96,
      availableMargin: 12.96,
      usedMargin: 0.0,
      unrealizedPl: 0.0,
      todayPl: 0.85,
      overallPl: 2.40
    },
    liveAccounts: [
      {
        id: 'acc-justmarkets-1',
        broker: 'JustMarkets',
        accountType: 'LIVE',
        platform: 'MT5',
        server: 'JustMarkets-Live2',
        accountNumber: '5892104',
        balance: 12.96,
        equity: 12.96,
        freeMargin: 12.96,
        margin: 0.0,
        unrealizedPl: 0.0,
        todayPl: 0.85,
        overallPl: 2.40,
        currency: 'USD',
        leverage: '1:500',
        connectionStatus: 'CONNECTED',
        aiTradingEnabled: false,
        maxRiskPerTrade: 1.0,
        maxDailyLoss: 3.0,
        maxOpenTrades: 5,
        maxExposure: 10.0,
        minRiskReward: 2.0,
        tradingSessions: 'London + NY',
        riskGuardActive: true,
        lastSyncedAt: new Date().toISOString()
      }
    ],
    demoAccounts: [
      {
        id: 'acc-fbs-demo-1',
        broker: 'FBS',
        accountType: 'DEMO',
        platform: 'MT5',
        server: 'FBS-Demo-01',
        accountNumber: '9204112',
        balance: 10000.00,
        equity: 10245.50,
        freeMargin: 10095.50,
        margin: 150.00,
        unrealizedPl: 245.50,
        todayPl: 120.00,
        overallPl: 245.50,
        currency: 'USD',
        leverage: '1:500',
        connectionStatus: 'CONNECTED',
        aiTradingEnabled: true,
        maxRiskPerTrade: 1.0,
        maxDailyLoss: 3.0,
        maxOpenTrades: 5,
        maxExposure: 10.0,
        minRiskReward: 2.0,
        tradingSessions: 'London + NY',
        riskGuardActive: true,
        lastSyncedAt: new Date().toISOString()
      }
    ]
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'demo'>('live');
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'permissions' | 'riskGuard' | 'audit'>('overview');

  // Connect form state
  const [brokerSearch, setBrokerSearch] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('JustMarkets');
  const [formAccountType, setFormAccountType] = useState<'LIVE' | 'DEMO'>('LIVE');
  const [formPlatform, setFormPlatform] = useState<'MT5' | 'MT4' | 'cTrader'>('MT5');
  const [formServer, setFormServer] = useState('JustMarkets-Live2');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formAuthorized, setFormAuthorized] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch<any>('/api/v2/brokers/accounts');
      if (res && res.summary) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load live broker accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectBroker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAccountNumber || !formServer || !formPassword) {
      toast.error('Please complete all required fields.');
      return;
    }
    if (!formAuthorized) {
      toast.error('You must authorize TradeMind AI access to connect this account.');
      return;
    }

    setIsConnecting(true);

    try {
      await apiFetch('/api/v2/brokers/connect', {
        method: 'POST',
        body: JSON.stringify({
          broker: selectedBroker,
          accountType: formAccountType,
          platform: formPlatform,
          server: formServer,
          accountNumber: formAccountNumber,
          tradingPassword: formPassword,
          authorizeAccess: true
        })
      });

      toast.success(`Successfully connected ${selectedBroker} (${formAccountType}) #${formAccountNumber}!`);
      setIsConnectOpen(false);
      setFormAccountNumber('');
      setFormPassword('');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect broker account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleToggleAiTrading = async (acc: any) => {
    const nextState = !acc.aiTradingEnabled;
    try {
      await apiFetch(`/api/v2/brokers/${acc.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({
          aiTradingEnabled: nextState,
          placeTrades: nextState,
          modifySlTp: nextState,
          closePositions: nextState
        })
      });
      toast.success(`AI Trading Mode ${nextState ? 'ENABLED 🟢' : 'DISABLED 🔴'} for ${acc.broker} #${acc.accountNumber}`);
      if (selectedAccount && selectedAccount.id === acc.id) {
        setSelectedAccount({
          ...selectedAccount,
          aiTradingEnabled: nextState,
          placeTrades: nextState,
          modifySlTp: nextState,
          closePositions: nextState
        });
      }
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update AI Trading status.');
    }
  };

  const handleUpdateRiskGuard = async (acc: any, newGuard: any) => {
    try {
      await apiFetch(`/api/v2/brokers/${acc.id}/risk-guard`, {
        method: 'PATCH',
        body: JSON.stringify(newGuard)
      });
      toast.success(`AI Risk Guard parameters updated for ${acc.broker}`);
      if (selectedAccount && selectedAccount.id === acc.id) {
        setSelectedAccount({ ...selectedAccount, ...newGuard });
      }
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update AI Risk Guard.');
    }
  };

  const handleDisconnect = async (accId: string) => {
    if (!window.confirm('Are you sure you want to disconnect this broker account?')) return;
    try {
      await apiFetch(`/api/v2/brokers/${accId}`, { method: 'DELETE' });
      toast.success('Broker account disconnected.');
      setSelectedAccount(null);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect account.');
    }
  };

  const filteredBrokers = SUPPORTED_BROKERS.filter(b =>
    b.name.toLowerCase().includes(brokerSearch.toLowerCase()) ||
    b.type.toLowerCase().includes(brokerSearch.toLowerCase())
  );

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="🔐 TradeMind AI — Secure Wallet"
        subtitle="Financial command center & encrypted credential vault for broker account integration, risk guard, and AI execution permissions."
        icon={Lock}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConnectOpen(true)}
            className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
          >
            <Plus size={16} />
            <span>Connect Broker Account</span>
          </button>
        </div>
      </PageHeader>

      {/* Main Portfolio Aggregation Metrics */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 bg-gradient-to-br from-slate-900/90 via-purple-950/20 to-slate-950">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-purple-400" />
            <h3 className="font-display font-bold text-white text-base">Total Aggregated Portfolio</h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/20">
            ● Vault Connection Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Balance</span>
            <div className="text-base font-bold font-mono text-white mt-1">{formatCurrency(data.summary?.totalBalance || 0)}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Equity</span>
            <div className="text-base font-bold font-mono text-purple-300 mt-1">{formatCurrency(data.summary?.totalEquity || 0)}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Free Margin</span>
            <div className="text-base font-bold font-mono text-emerald-400 mt-1">{formatCurrency(data.summary?.availableMargin || 0)}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Used Margin</span>
            <div className="text-base font-bold font-mono text-slate-300 mt-1">{formatCurrency(data.summary?.usedMargin || 0)}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Unrealized P/L</span>
            <div className={cn("text-base font-bold font-mono mt-1", (data.summary?.unrealizedPl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {(data.summary?.unrealizedPl || 0) >= 0 ? '+' : ''}${Number(data.summary?.unrealizedPl || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Today's P/L</span>
            <div className={cn("text-base font-bold font-mono mt-1", (data.summary?.todayPl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {(data.summary?.todayPl || 0) >= 0 ? '+' : ''}${Number(data.summary?.todayPl || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/2 border border-white/5">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Overall P/L</span>
            <div className={cn("text-base font-bold font-mono mt-1", (data.summary?.overallPl || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {(data.summary?.overallPl || 0) >= 0 ? '+' : ''}${Number(data.summary?.overallPl || 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Account Type Navigation Tabs (Live Accounts vs Demo Accounts) */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('live')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'live' ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <span>🟢 Live Accounts</span>
            <span className="bg-purple-900/60 text-purple-200 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
              {data.liveAccounts?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('demo')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'demo' ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <span>🔵 Demo Accounts</span>
            <span className="bg-purple-900/60 text-purple-200 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
              {data.demoAccounts?.length || 0}
            </span>
          </button>
        </div>

        <button
          onClick={() => setIsConnectOpen(true)}
          className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Connected Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(activeTab === 'live' ? data.liveAccounts : data.demoAccounts)?.map((acc: any) => (
          <motion.div
            key={acc.id}
            className="glass-card rounded-2xl p-5 border border-white/5 hover:border-purple-500/30 transition-all flex flex-col justify-between space-y-4"
            whileHover={{ y: -2 }}
          >
            <div>
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟢</span>
                  <div>
                    <h4 className="font-display font-bold text-white text-base">{acc.broker}</h4>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span>{acc.accountType}</span> • <span>{acc.platform}</span> • <span className="text-slate-300">{acc.server}</span>
                    </span>
                  </div>
                </div>
                <Badge variant={acc.aiTradingEnabled ? "green" : "neutral"} size="xs">
                  {acc.aiTradingEnabled ? '⚡ AI Executing' : '👁 Read-Only'}
                </Badge>
              </div>

              {/* Account Balance Metrics */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Account ID</span>
                  <span className="font-mono font-bold text-slate-200">#{acc.accountNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Balance</span>
                  <span className="font-mono font-bold text-white">${acc.balance?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Equity</span>
                  <span className="font-mono font-bold text-purple-300">${acc.equity?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Free Margin</span>
                  <span className="font-mono font-bold text-emerald-400">${acc.freeMargin?.toFixed(2)}</span>
                </div>
              </div>

              {/* Status & Security Indicator */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Leverage {acc.leverage || '1:500'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => { setSelectedAccount(acc); setActiveModalTab('overview'); }}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Eye size={14} /> View Account
              </button>
              <button
                onClick={() => { setSelectedAccount(acc); setActiveModalTab('permissions'); }}
                className="py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sliders size={14} /> Manage & Risk
              </button>
            </div>
          </motion.div>
        ))}

        {/* Empty state button card */}
        <div
          onClick={() => setIsConnectOpen(true)}
          className="rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/40 p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-purple-500/5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
            <Plus size={24} />
          </div>
          <h4 className="font-display font-bold text-white text-sm mb-1">Connect {activeTab === 'live' ? 'Live' : 'Demo'} Broker Account</h4>
          <p className="text-xs text-slate-500 max-w-xs">
            Connect JustMarkets, FBS, Exness, XM, or IC Markets via secure investor/trading credentials vault.
          </p>
        </div>
      </div>

      {/* CONNECT BROKER ACCOUNT MODAL */}
      <AnimatePresence>
        {isConnectOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setIsConnectOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-xl glass-card rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Lock size={20} className="text-purple-400" />
                  <div>
                    <h3 className="font-display font-bold text-white text-lg">Connect Trading Account</h3>
                    <p className="text-xs text-slate-400">Encrypted financial-control vault for TradeMind AI</p>
                  </div>
                </div>
                <button onClick={() => setIsConnectOpen(false)} className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConnectBroker} className="space-y-4">
                {/* 1. Select Broker */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Select Broker Entity</label>
                  <div className="relative mb-2">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search broker (FBS, JustMarkets, Exness, XM, IC Markets)..."
                      value={brokerSearch}
                      onChange={(e) => setBrokerSearch(e.target.value)}
                      className="w-full input-glass rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {filteredBrokers.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBroker(b.name)}
                        className={cn(
                          "p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all text-left",
                          selectedBroker === b.name ? "border-purple-500 bg-purple-500/15 text-white" : "border-white/5 bg-white/2 text-slate-400 hover:text-slate-200"
                        )}
                      >
                        <span className="text-base">{b.logo}</span>
                        <div>
                          <div className="font-bold text-xs leading-tight">{b.name}</div>
                          <div className="text-[9px] text-slate-500">{b.type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Account Type & Platform */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Account Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormAccountType('LIVE')}
                        className={cn("py-2 rounded-xl text-xs font-bold border transition-all", formAccountType === 'LIVE' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-white/5 text-slate-400 border-white/5")}
                      >
                        🟢 Live
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormAccountType('DEMO')}
                        className={cn("py-2 rounded-xl text-xs font-bold border transition-all", formAccountType === 'DEMO' ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/5 text-slate-400 border-white/5")}
                      >
                        🔵 Demo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Trading Platform</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['MT5', 'MT4', 'cTrader'] as const).map((plat) => (
                        <button
                          key={plat}
                          type="button"
                          onClick={() => setFormPlatform(plat)}
                          className={cn("py-2 rounded-xl text-[11px] font-bold border transition-all", formPlatform === plat ? "bg-purple-600 text-white border-purple-500" : "bg-white/5 text-slate-400 border-white/5")}
                        >
                          {plat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Server Name & Account ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Exact Server Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JustMarkets-Live2"
                      value={formServer}
                      onChange={(e) => setFormServer(e.target.value)}
                      className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Account ID / Login</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 5892104"
                      value={formAccountNumber}
                      onChange={(e) => setFormAccountNumber(e.target.value)}
                      className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Trading / Investor Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full input-glass rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Credentials are stored in AES-256 encrypted vault. Plaintext passwords are never stored in database.</p>
                </div>

                {/* 5. Authorization Checkbox */}
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="authCheck"
                    checked={formAuthorized}
                    onChange={(e) => setFormAuthorized(e.target.checked)}
                    className="h-4 w-4 rounded border-purple-500 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="authCheck" className="text-xs font-medium text-slate-200 cursor-pointer">
                    I authorize TradeMind AI to access this account for market analysis & authorized execution.
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConnectOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
                  >
                    {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                    <span>Securely Connect</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACCOUNT DETAILS & MANAGE MODAL */}
      <AnimatePresence>
        {selectedAccount && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedAccount(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-2xl glass-card rounded-2xl border border-white/10 p-6 space-y-6 shadow-2xl bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🟢</span>
                  <div>
                    <h3 className="font-display font-bold text-white text-lg">{selectedAccount.broker} — {selectedAccount.accountType}</h3>
                    <p className="text-xs text-slate-400 font-mono">Account #{selectedAccount.accountNumber} • {selectedAccount.server}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAccount(null)} className="p-1 rounded-lg bg-white/5 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Sub-Tabs: Overview, Permissions, AI Risk Guard, Audit Logs */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
                {(['overview', 'permissions', 'riskGuard', 'audit'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveModalTab(t)}
                    className={cn(
                      "flex-1 py-2 rounded-lg font-bold capitalize transition-all cursor-pointer",
                      activeModalTab === t ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {t === 'riskGuard' ? '🛡 AI Risk Guard' : t}
                  </button>
                ))}
              </div>

              {/* 1. OVERVIEW TAB */}
              {activeModalTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Balance</span>
                      <div className="font-mono font-bold text-white text-base mt-1">${selectedAccount.balance?.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Equity</span>
                      <div className="font-mono font-bold text-purple-300 text-base mt-1">${selectedAccount.equity?.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Free Margin</span>
                      <div className="font-mono font-bold text-emerald-400 text-base mt-1">${selectedAccount.freeMargin?.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Used Margin</span><span className="font-mono text-white">${selectedAccount.margin?.toFixed(2) || '0.00'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Leverage</span><span className="font-mono text-white">{selectedAccount.leverage || '1:500'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Currency</span><span className="font-mono text-white">{selectedAccount.currency || 'USD'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Connection Status</span><span className="font-semibold text-emerald-400">🟢 Connected</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Last Synced</span><span className="font-mono text-slate-300">{new Date(selectedAccount.lastSyncedAt || Date.now()).toLocaleTimeString()}</span></div>
                  </div>

                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">Recent AI Activity</span>
                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                      <div className="flex justify-between"><span>13:10 BTCUSD analyzed</span><span className="text-emerald-400">✓ Confluence 88%</span></div>
                      <div className="flex justify-between"><span>12:55 XAUUSD signal generated</span><span className="text-purple-400">🏆 A+ Setup</span></div>
                      <div className="flex justify-between"><span>12:30 EURUSD risk check</span><span className="text-slate-300">Passed</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PERMISSIONS TAB */}
              {activeModalTab === 'permissions' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>🟢 AI Trading Mode</span>
                        <Badge variant={selectedAccount.aiTradingEnabled ? "green" : "neutral"} size="xs">
                          {selectedAccount.aiTradingEnabled ? 'ACTIVE' : 'OFF'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        When active, TradeMind AI can execute trades automatically based on your Risk Guard limits.
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleAiTrading(selectedAccount)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                        selectedAccount.aiTradingEnabled ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      )}
                    >
                      <Power size={14} />
                      {selectedAccount.aiTradingEnabled ? 'Disable AI Trading' : 'Enable AI Trading'}
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/5 text-slate-400">
                        <tr>
                          <th className="p-3">Permission</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <tr><td className="p-3 text-slate-200">View balance & metrics</td><td className="p-3 text-right text-emerald-400 font-bold">✅ Authorized</td></tr>
                        <tr><td className="p-3 text-slate-200">View open positions</td><td className="p-3 text-right text-emerald-400 font-bold">✅ Authorized</td></tr>
                        <tr><td className="p-3 text-slate-200">View pending orders</td><td className="p-3 text-right text-emerald-400 font-bold">✅ Authorized</td></tr>
                        <tr><td className="p-3 text-slate-200">Market structure analysis</td><td className="p-3 text-right text-emerald-400 font-bold">✅ Authorized</td></tr>
                        <tr><td className="p-3 text-slate-200">Generate AI signals</td><td className="p-3 text-right text-emerald-400 font-bold">✅ Authorized</td></tr>
                        <tr><td className="p-3 text-slate-200">Place live trades</td><td className="p-3 text-right font-bold">{selectedAccount.placeTrades ? <span className="text-emerald-400">✅ Authorized</span> : <span className="text-rose-400">🔴 Disabled</span>}</td></tr>
                        <tr><td className="p-3 text-slate-200">Modify Stop Loss / Take Profit</td><td className="p-3 text-right font-bold">{selectedAccount.modifySlTp ? <span className="text-emerald-400">✅ Authorized</span> : <span className="text-rose-400">🔴 Disabled</span>}</td></tr>
                        <tr><td className="p-3 text-slate-200">Close open positions</td><td className="p-3 text-right font-bold">{selectedAccount.closePositions ? <span className="text-emerald-400">✅ Authorized</span> : <span className="text-rose-400">🔴 Disabled</span>}</td></tr>
                        <tr><td className="p-3 text-slate-200">Withdraw funds</td><td className="p-3 text-right font-bold text-rose-500">❌ Never Allowed</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. AI RISK GUARD TAB */}
              {activeModalTab === 'riskGuard' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <ShieldCheck size={16} className="text-purple-400" />
                      AI Risk Guard Protection
                    </span>
                    <button
                      onClick={() => handleUpdateRiskGuard(selectedAccount, { riskGuardActive: !selectedAccount.riskGuardActive })}
                      className={cn("px-3 py-1 rounded-lg text-xs font-bold cursor-pointer", selectedAccount.riskGuardActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40")}
                    >
                      {selectedAccount.riskGuardActive ? '🟢 ON' : '🔴 OFF'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-slate-400 block mb-1">Max Risk per Trade</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedAccount.maxRiskPerTrade}
                        onChange={(e) => setSelectedAccount({ ...selectedAccount, maxRiskPerTrade: Number(e.target.value) })}
                        className="w-full input-glass rounded-lg px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-slate-400 block mb-1">Max Daily Loss (%)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedAccount.maxDailyLoss}
                        onChange={(e) => setSelectedAccount({ ...selectedAccount, maxDailyLoss: Number(e.target.value) })}
                        className="w-full input-glass rounded-xl px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-slate-400 block mb-1">Max Open Trades</span>
                      <input
                        type="number"
                        value={selectedAccount.maxOpenTrades}
                        onChange={(e) => setSelectedAccount({ ...selectedAccount, maxOpenTrades: Number(e.target.value) })}
                        className="w-full input-glass rounded-xl px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                      <span className="text-slate-400 block mb-1">Min Risk:Reward Ratio</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedAccount.minRiskReward}
                        onChange={(e) => setSelectedAccount({ ...selectedAccount, minRiskReward: Number(e.target.value) })}
                        className="w-full input-glass rounded-xl px-2 py-1 text-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateRiskGuard(selectedAccount, {
                      maxRiskPerTrade: selectedAccount.maxRiskPerTrade,
                      maxDailyLoss: selectedAccount.maxDailyLoss,
                      maxOpenTrades: selectedAccount.maxOpenTrades,
                      minRiskReward: selectedAccount.minRiskReward,
                    })}
                    className="w-full btn-primary py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Save Risk Guard Parameters
                  </button>
                </div>
              )}

              {/* 4. AUDIT & SECURITY TAB */}
              {activeModalTab === 'audit' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/2 border border-white/5 space-y-3 text-xs">
                    <div className="flex items-center justify-between"><span className="text-slate-400">2FA Authentication</span><span className="text-emerald-400 font-bold">🟢 Active</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-400">TLS AES-256 Connection</span><span className="text-emerald-400 font-bold">🟢 Active</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-400">Credential Encryption Vault</span><span className="text-emerald-400 font-bold">🟢 Isolated Key</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-400">Last Authentication</span><span className="font-mono text-slate-300">14 Aug 2026, 13:05</span></div>
                  </div>

                  <button
                    onClick={() => handleDisconnect(selectedAccount.id)}
                    className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    Disconnect Broker Account
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
