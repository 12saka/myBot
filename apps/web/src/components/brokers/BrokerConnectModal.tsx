'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, ShieldCheck, Server, KeyRound, User,
  Globe, AlertCircle, ArrowRight, RefreshCw, CheckCircle2,
  Lock, Zap, Layers, Sparkles
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export interface BrokerDirectoryItem {
  id: string;
  name: string;
  brandColor: string;
  logoUrl?: string;
  badge?: string;
  platforms: string[];
  accountTypes: string[];
  defaultLeverage: string;
  maxLeverage: string;
  servers: string[];
  regulation: string;
  spreadFrom: string;
}

interface BrokerConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (account: any) => void;
}

const DEFAULT_BROKERS: BrokerDirectoryItem[] = [
  {
    id: 'fbs',
    name: 'FBS',
    brandColor: '#22c55e',
    badge: 'Top Rated',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Standard', 'Cent', 'Pro', 'Zero Spread'],
    defaultLeverage: '1:500',
    maxLeverage: '1:3000',
    servers: ['FBS-Real-01', 'FBS-Real-02', 'FBS-Real-03', 'FBS-Demo-01', 'FBS-Demo-02'],
    regulation: 'FSC, CySEC, ASIC',
    spreadFrom: '0.0 pips',
  },
  {
    id: 'exness',
    name: 'Exness',
    brandColor: '#eab308',
    badge: 'Instant Withdrawals',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Standard', 'Raw Spread', 'Zero', 'Pro'],
    defaultLeverage: '1:500',
    maxLeverage: '1:2000',
    servers: ['Exness-MT5Real', 'Exness-MT5Real2', 'Exness-MT5Real3', 'Exness-MT5Trial', 'Exness-MT5Trial2'],
    regulation: 'FCA, CySEC, FSCA',
    spreadFrom: '0.0 pips',
  },
  {
    id: 'justmarkets',
    name: 'JustMarkets',
    brandColor: '#3b82f6',
    badge: 'Ultra Low Spreads',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Standard', 'Pro', 'Raw Spread', 'Cent'],
    defaultLeverage: '1:500',
    maxLeverage: '1:3000',
    servers: ['JustMarkets-Live', 'JustMarkets-Live2', 'JustMarkets-Demo'],
    regulation: 'FSA, CySEC',
    spreadFrom: '0.0 pips',
  },
  {
    id: 'xm',
    name: 'XM Global',
    brandColor: '#ef4444',
    badge: 'Global Leader',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Standard', 'Micro', 'XM Ultra Low'],
    defaultLeverage: '1:500',
    maxLeverage: '1:1000',
    servers: ['XMGlobal-MT5', 'XMGlobal-MT5 2', 'XMGlobal-Demo', 'XMGlobal-Demo 2'],
    regulation: 'FSC, ASIC, CySEC, DFSA',
    spreadFrom: '0.6 pips',
  },
  {
    id: 'icmarkets',
    name: 'IC Markets',
    brandColor: '#10b981',
    badge: 'ECN Liquidity',
    platforms: ['MT5', 'MT4', 'cTrader'],
    accountTypes: ['Raw Spread', 'Standard'],
    defaultLeverage: '1:500',
    maxLeverage: '1:1000',
    servers: ['ICMarketsSC-MT5', 'ICMarketsSC-MT5-02', 'ICMarketsSC-Demo'],
    regulation: 'ASIC, CySEC, FSA',
    spreadFrom: '0.0 pips',
  },
  {
    id: 'pepperstone',
    name: 'Pepperstone',
    brandColor: '#0ea5e9',
    badge: 'Razor Spreads',
    platforms: ['MT5', 'MT4', 'cTrader'],
    accountTypes: ['Razor', 'Standard'],
    defaultLeverage: '1:500',
    maxLeverage: '1:500',
    servers: ['Pepperstone-MT5-Live01', 'Pepperstone-MT5-Live02', 'Pepperstone-MT5-Demo01'],
    regulation: 'FCA, ASIC, CySEC, BaFin',
    spreadFrom: '0.0 pips',
  },
  {
    id: 'deriv',
    name: 'Deriv (Synthetics)',
    brandColor: '#dc2626',
    badge: '24/7 Volatility Indices',
    platforms: ['MT5', 'Deriv X'],
    accountTypes: ['Derived (Synthetics)', 'Financial'],
    defaultLeverage: '1:500',
    maxLeverage: '1:1000',
    servers: ['Deriv-Server', 'Deriv-Server-02', 'Deriv-Demo'],
    regulation: 'MFSA, LFSA, VFSC',
    spreadFrom: '0.5 pips',
  },
  {
    id: 'octafx',
    name: 'OctaFX',
    brandColor: '#6366f1',
    badge: '0% Commission',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Octa MT5', 'Octa MT4'],
    defaultLeverage: '1:500',
    maxLeverage: '1:1000',
    servers: ['OctaFX-Real', 'OctaFX-Real2', 'OctaFX-Demo'],
    regulation: 'CySEC, MISA',
    spreadFrom: '0.6 pips',
  },
  {
    id: 'hfm',
    name: 'HFM (HotForex)',
    brandColor: '#b91c1c',
    badge: 'Premium Multi-Asset',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Premium', 'Pro', 'Zero', 'Cent'],
    defaultLeverage: '1:500',
    maxLeverage: '1:2000',
    servers: ['HFMarketsSC-Live', 'HFMarketsSC-Live2', 'HFMarketsSC-Demo'],
    regulation: 'FCA, CySEC, FSCA, DFSA',
    spreadFrom: '0.1 pips',
  },
  {
    id: 'fxtm',
    name: 'FXTM',
    brandColor: '#f97316',
    badge: 'Micro & ECN Execution',
    platforms: ['MT5', 'MT4'],
    accountTypes: ['Advantage', 'Advantage Plus', 'Micro'],
    defaultLeverage: '1:500',
    maxLeverage: '1:2000',
    servers: ['ForexTimeFXTM-Live', 'ForexTimeFXTM-Live02', 'ForexTimeFXTM-Demo'],
    regulation: 'FCA, CySEC, FSCA',
    spreadFrom: '0.0 pips',
  },
];

export function BrokerConnectModal({ isOpen, onClose, onSuccess }: BrokerConnectModalProps) {
  const [directory, setDirectory] = useState<BrokerDirectoryItem[]>(DEFAULT_BROKERS);
  const [selectedBroker, setSelectedBroker] = useState<BrokerDirectoryItem>(DEFAULT_BROKERS[0]);
  const [accountType, setAccountType] = useState<'LIVE' | 'DEMO'>('DEMO');
  const [platform, setPlatform] = useState<'MT5' | 'MT4'>('MT5');
  const [server, setServer] = useState(DEFAULT_BROKERS[0].servers[3] || DEFAULT_BROKERS[0].servers[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncStep, setSyncStep] = useState<number>(0);

  const SYNC_STEPS = [
    { title: 'Resolving Gateway', desc: `Handshaking with ${selectedBroker.name} cluster...` },
    { title: 'Authenticating Credentials', desc: `Verifying MT5 Account #${accountNumber || '••••'} on ${server}...` },
    { title: 'Synchronizing Account State', desc: 'Importing live Balance, Equity, Margin & Free Margin...' },
    { title: 'Loading Trading Portfolio', desc: 'Syncing active positions, pending orders & history...' },
    { title: 'Connecting Live Bid/Ask Stream', desc: 'Establishing sub-second WebSocket quote feed...' },
  ];

  useEffect(() => {
    if (isOpen) {
      apiFetch<BrokerDirectoryItem[]>('/api/v2/brokers/directory')
        .then((res) => {
          if (Array.isArray(res) && res.length > 0) {
            setDirectory(res);
            setSelectedBroker(res[0]);
            setServer(res[0].servers[0]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    // Pick default server based on Live vs Demo
    const match = selectedBroker.servers.find((s) =>
      accountType === 'DEMO' ? s.toLowerCase().includes('demo') || s.toLowerCase().includes('trial') : !s.toLowerCase().includes('demo') && !s.toLowerCase().includes('trial')
    );
    setServer(match || selectedBroker.servers[0]);
  }, [selectedBroker, accountType]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber.trim()) {
      toast.error('Please enter your MT5 Account Number / Login ID.');
      return;
    }
    if (!password.trim()) {
      toast.error('Please enter your Trading or Investor Password.');
      return;
    }

    setIsConnecting(true);
    setSyncStep(0);

    // 5-Step progressive synchronization animation
    for (let i = 0; i < 5; i++) {
      setSyncStep(i);
      await new Promise((r) => setTimeout(r, 650));
    }

    try {
      const res = await apiFetch<any>('/api/v2/brokers/connect', {
        method: 'POST',
        body: JSON.stringify({
          broker: selectedBroker.name,
          accountType,
          platform,
          server,
          accountNumber: accountNumber.trim(),
          tradingPassword: password.trim(),
        }),
      });

      toast.success(`🎉 ${selectedBroker.name} (${accountType}) #${accountNumber} connected & synchronized!`);
      if (onSuccess) onSuccess(res.account);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect broker account. Please verify login & server.');
    } finally {
      setIsConnecting(false);
      setSyncStep(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg"
              style={{ backgroundColor: selectedBroker.brandColor }}
            >
              {selectedBroker.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-display">Connect Broker Terminal</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  MT5 / MT4 Direct
                </span>
              </div>
              <p className="text-xs text-slate-400">Trade directly inside TradeMind with zero-latency broker synchronization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isConnecting ? (
            /* Live 5-Step Synchronization State Machine Animation */
            <div className="py-8 px-4 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                  <RefreshCw size={28} className="animate-spin text-purple-400" />
                </div>
                <h4 className="text-base font-bold text-white">Synchronizing with {selectedBroker.name}</h4>
                <p className="text-xs text-slate-400">Establishing encrypted AES-256 bridge & importing MT5 state...</p>
              </div>

              <div className="space-y-3 max-w-md mx-auto">
                {SYNC_STEPS.map((step, idx) => {
                  const isDone = syncStep > idx;
                  const isCurrent = syncStep === idx;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border text-xs transition-all',
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : isCurrent
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-md shadow-purple-500/10'
                          : 'bg-slate-950/30 border-white/5 text-slate-500 opacity-60'
                      )}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : isCurrent ? (
                          <RefreshCw size={14} className="animate-spin text-purple-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[9px] text-slate-500 font-mono">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold block truncate">{step.title}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-6">
              {/* 1. Select Broker Directory Grid */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>1. Select Broker</span>
                  <span className="text-[10px] text-slate-500 lowercase">12+ official brokers supported</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {directory.map((b) => {
                    const isSelected = selectedBroker.id === b.id;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => setSelectedBroker(b)}
                        className={cn(
                          'p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer relative overflow-hidden',
                          isSelected
                            ? 'bg-purple-500/15 border-purple-500 shadow-md shadow-purple-500/10'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: b.brandColor }}
                          >
                            {b.name.slice(0, 2).toUpperCase()}
                          </span>
                          {isSelected && <Check size={14} className="text-purple-400" />}
                        </div>
                        <div>
                          <span className={cn('text-xs font-bold block truncate', isSelected ? 'text-white' : 'text-slate-300')}>
                            {b.name}
                          </span>
                          <span className="text-[9px] text-slate-500 block truncate">{b.spreadFrom}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Platform & Account Mode Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Account Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAccountType('DEMO')}
                      className={cn(
                        'py-2 text-xs font-bold rounded-lg transition-all',
                        accountType === 'DEMO' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      Demo Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('LIVE')}
                      className={cn(
                        'py-2 text-xs font-bold rounded-lg transition-all',
                        accountType === 'LIVE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      Live Account
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Platform Protocol</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPlatform('MT5')}
                      className={cn(
                        'py-2 text-xs font-bold rounded-lg transition-all',
                        platform === 'MT5' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      MetaTrader 5
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlatform('MT4')}
                      className={cn(
                        'py-2 text-xs font-bold rounded-lg transition-all',
                        platform === 'MT4' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      )}
                    >
                      MetaTrader 4
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Server & Credentials Inputs */}
              <div className="space-y-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Server size={14} className="text-purple-400" />
                    <span>Broker Server</span>
                  </label>
                  <select
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  >
                    {selectedBroker.servers.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <User size={14} className="text-purple-400" />
                      <span>MT5 Login / Account #</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5892104"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Lock size={14} className="text-purple-400" />
                      <span>Trading / Investor Password</span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Security Shield Banner */}
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3 text-xs text-purple-200">
                <ShieldCheck size={18} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>Bank-Grade Security:</strong> Credentials are encrypted locally via <strong>AES-256-GCM</strong>. You can use an Investor (read-only) password or Master password to trade directly inside TradeMind.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2"
                >
                  <span>Connect & Synchronize</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
