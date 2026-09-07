'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Zap, Shield, Play, Pause, Settings,
  AlertTriangle, RefreshCw, BarChart3, Sliders, Info, Plus
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  historicalReturn: number;
  winRate: number;
  riskScore: number;
  maxDrawdown: number;
}

interface AutomationRule {
  id: string;
  name: string;
  strategy: string;
  allocation: number;
  riskLimit: number;
  maxDrawdown: number;
  isActive: boolean;
}

export default function AutomationPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [strategies, setStrategies] = useState<StrategyTemplate[]>([]);
  const [userRules, setUserRules] = useState<AutomationRule[]>([]);
  
  const [selectedStratName, setSelectedStratName] = useState('Smart Money Concept (SMC)');
  const [ruleName, setRuleName] = useState('SMC Scalper Bot');
  const [allocation, setAllocation] = useState(1000);
  const [riskLimit, setRiskLimit] = useState(1.0);
  const [maxDrawdown, setMaxDrawdown] = useState(5.0);
  const [isSaving, setIsSaving] = useState(false);

  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [isEmergencyStopping, setIsEmergencyStopping] = useState(false);

  const fetchAutomationData = async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      const [stratRes, rulesRes, brokersRes, ordersRes] = await Promise.allSettled([
        apiFetch<StrategyTemplate[]>('/api/v2/strategies'),
        apiFetch<AutomationRule[]>('/api/v2/automation/rules'),
        apiFetch<any>('/api/v2/brokers/accounts'),
        apiFetch<any[]>('/api/v2/brokers/orders')
      ]);

      if (stratRes.status === 'fulfilled' && Array.isArray(stratRes.value)) {
        setStrategies(stratRes.value);
        if (stratRes.value.length > 0) {
          setSelectedStratName(stratRes.value[0].name);
        }
      }

      if (rulesRes.status === 'fulfilled' && Array.isArray(rulesRes.value)) {
        setUserRules(rulesRes.value);
      }

      if (brokersRes.status === 'fulfilled' && brokersRes.value) {
        const live = brokersRes.value.liveAccounts || [];
        const demo = brokersRes.value.demoAccounts || [];
        setConnectedAccounts([...live, ...demo]);
      }

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        setLiveOrders(ordersRes.value);
      }

      setLoadState('ready');
    } catch (err: any) {
      console.warn('[Automation] Load notice:', err);
      setErrorMessage(err.message || 'Cannot reach API Gateway at http://localhost:4000');
      setLoadState('error');
    }
  };

  useEffect(() => {
    fetchAutomationData();
  }, []);

  const activeRule = userRules.find(r => r.isActive);
  const autoTradeAccounts = connectedAccounts.filter(a => a.aiTradingEnabled && a.placeTrades);

  const handleToggleRule = async (rule: AutomationRule) => {
    const toastId = toast.loading(`${rule.isActive ? 'Pausing' : 'Starting'} automation rule "${rule.name}"...`);
    try {
      const res = await apiFetch<any>(`/api/v2/automation/rules/${rule.id}/toggle`, { method: 'PATCH' });
      setUserRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
      toast.success(res.message || 'Rule status updated in DB!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle rule state.', { id: toastId });
    }
  };

  const handleKillSwitch = async () => {
    if (!window.confirm('⚠️ ACTIVATE EMERGENCY KILL SWITCH?\n\nThis will instantly halt all automated execution and disarm all connected broker accounts.')) {
      return;
    }
    setIsEmergencyStopping(true);
    const toastId = toast.loading('Engaging Hardware Kill Switch...');
    try {
      const res = await apiFetch<any>('/api/v2/automation/emergency-kill-switch', { method: 'POST' });
      toast.success(res.message || 'Emergency Kill Switch engaged!', { id: toastId });
      fetchAutomationData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to engage Kill Switch.', { id: toastId });
    } finally {
      setIsEmergencyStopping(false);
    }
  };

  const handleCheckBreakEven = async () => {
    const toastId = toast.loading('Scanning positions for TP1 Break-Even protection...');
    try {
      const res = await apiFetch<any[]>('/api/v2/automation/break-even/check', { method: 'POST' });
      if (Array.isArray(res) && res.length > 0) {
        toast.success(`Secured ${res.length} position(s) at zero-risk Break-Even!`, { id: toastId });
      } else {
        toast.success('All positions already protected or within normal variance.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Break-Even check completed.', { id: toastId });
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading('Saving automation rule to backend database...');
    try {
      const created = await apiFetch<AutomationRule>('/api/v2/automation/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: ruleName,
          strategy: selectedStratName,
          allocation: Number(allocation),
          riskLimit: Number(riskLimit),
          maxDrawdown: Number(maxDrawdown),
          isActive: true
        })
      });
      setUserRules(prev => [created, ...prev]);
      toast.success(`Automation rule "${created.name}" created and saved to DB!`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save automation rule.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Autonomous Trading Engine & Strategy Rules"
        subtitle="3-Brain Guardian Architecture: Signal Intelligence proposes, Risk Guardian decides, Execution Engine obeys."
        icon={Cpu}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckBreakEven}
            className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Scan positions and move Stop Loss to Entry for trades past TP1"
          >
            <Shield size={14} />
            <span>Break-Even Guardian</span>
          </button>
          <button
            onClick={handleKillSwitch}
            disabled={isEmergencyStopping}
            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/40"
            title="Instantly disarm all broker auto-trade execution"
          >
            <AlertTriangle size={14} className="text-rose-400" />
            <span>Kill Switch</span>
          </button>
          <button
            onClick={fetchAutomationData}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Rules & Strategies"
          >
            <RefreshCw size={14} className={cn(loadState === 'loading' && "animate-spin")} />
          </button>
        </div>
      </PageHeader>

      {/* Grid status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36 border border-white/5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Guardian Status</span>
                <h3 className="text-xl font-display font-bold text-white mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${autoTradeAccounts.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  {autoTradeAccounts.length > 0 ? `${autoTradeAccounts.length} Broker(s) Armed` : 'Auto-Trade Disarmed'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {autoTradeAccounts.length > 0
                  ? `Active brokers: ${autoTradeAccounts.map(a => `${a.broker} #${a.accountNumber}`).join(', ')}`
                  : 'Connect a broker in Wallet and enable Autonomous Trading to automate execution.'}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36 border border-white/5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Trading Constitution Limits</span>
                <h3 className="text-xl font-display font-bold text-purple-400 mt-1">
                  Max 1-3% Risk / Trade
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Daily Drawdown Cap: 3.0% max | Min R:R: 1:1.5 | Break-Even SL auto-secures at TP1.
              </p>
            </div>
          </div>

          {/* Active Rules List */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="font-display font-bold text-white text-sm">Configured Automation Rules</h3>
            {userRules.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No saved automation rules yet. Use the form below to configure a new strategy rule.</p>
            ) : (
              <div className="space-y-3">
                {userRules.map(rule => (
                  <div key={rule.id} className="p-4 rounded-xl border border-white/5 bg-white/2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{rule.name}</span>
                        <Badge variant={rule.isActive ? 'buy' : 'neutral'} size="xs">
                          {rule.isActive ? 'ACTIVE' : 'PAUSED'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Strategy: <span className="text-purple-300 font-semibold">{rule.strategy}</span> | Capital: ${rule.allocation.toLocaleString()} | Risk: {rule.riskLimit}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer",
                        rule.isActive
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10"
                      )}
                    >
                      {rule.isActive ? <Pause size={12} /> : <Play size={12} />}
                      {rule.isActive ? 'Pause' : 'Start'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strategies Catalog */}
          <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="font-display font-bold text-white text-sm">Select Institutional Strategy Template</h3>
            {loadState === 'loading' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="glass-card rounded-2xl p-4 h-32 animate-pulse bg-white/3" />
                ))}
              </div>
            )}

            {loadState === 'ready' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {strategies.map((strat) => {
                  const isSelected = selectedStratName === strat.name;
                  return (
                    <div
                      key={strat.id}
                      onClick={() => setSelectedStratName(strat.name)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-white/5 bg-white/2 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-bold text-white text-xs">{strat.name}</h4>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">Win Rate {strat.winRate}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-2">{strat.description}</p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/5">
                        <span>Hist. Return: +{strat.historicalReturn}%</span>
                        <span>Max DD: {strat.maxDrawdown}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Configuration Form Sidebar */}
        <div>
          <form onSubmit={handleSaveRule} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4 sticky top-6">
            <h3 className="font-display font-bold text-white text-sm flex items-center gap-2">
              <Sliders size={16} className="text-purple-400" />
              Configure Bot Rule
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Rule Name</label>
              <input
                type="text"
                value={ruleName}
                onChange={e => setRuleName(e.target.value)}
                className="input-glass w-full px-3 py-2 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Selected Strategy Template</label>
              <input
                type="text"
                value={selectedStratName}
                readOnly
                className="input-glass w-full px-3 py-2 text-xs rounded-xl bg-white/3 text-purple-300 font-semibold cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Capital Allocation ($)</label>
              <input
                type="number"
                value={allocation}
                onChange={e => setAllocation(Number(e.target.value))}
                className="input-glass w-full px-3 py-2 text-xs rounded-xl font-mono"
                min={50}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Max Risk per Trade (%)</label>
              <input
                type="number"
                step="0.1"
                value={riskLimit}
                onChange={e => setRiskLimit(Number(e.target.value))}
                className="input-glass w-full px-3 py-2 text-xs rounded-xl font-mono"
                min={0.1}
                max={5.0}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Max Daily Drawdown Cap (%)</label>
              <input
                type="number"
                step="0.5"
                value={maxDrawdown}
                onChange={e => setMaxDrawdown(Number(e.target.value))}
                className="input-glass w-full px-3 py-2 text-xs rounded-xl font-mono"
                min={1.0}
                max={20.0}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-purple-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={14} /> Save & Activate Rule
            </button>
          </form>
        </div>
      </div>

      {/* 3-Brain Guardian Autonomous Order Log */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
                Guardian Auto-Executed Orders
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {liveOrders.length} Recorded
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                1-Click autonomous broker orders dispatched by 3-Brain Risk Guardian. Operating in Paper Trading simulation mode.
              </p>
            </div>
          </div>
          <button
            onClick={fetchAutomationData}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw size={12} className={loadState === 'loading' ? 'animate-spin' : ''} />
            Refresh Orders
          </button>
        </div>

        {liveOrders.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-white/2 border border-white/5 space-y-2">
            <div className="text-2xl">🛡️</div>
            <p className="text-xs font-bold text-white">No Autonomous Orders Executed Yet</p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              When a verified A+ or A Institutional Signal triggers and passes the 3-Brain Risk Guardian checks (Daily Loss, Max Exposure, 1:1.5+ R:R), the order will appear here immediately with verified tickets.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <th className="pb-3 font-semibold">Ticket</th>
                  <th className="pb-3 font-semibold">Market</th>
                  <th className="pb-3 font-semibold">Direction</th>
                  <th className="pb-3 font-semibold">Type</th>
                  <th className="pb-3 font-semibold">Lots</th>
                  <th className="pb-3 font-semibold">Price</th>
                  <th className="pb-3 font-semibold">Stop Loss / TP</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Mode</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveOrders.map((order) => {
                  const isBuy = order.direction === 'BUY';
                  return (
                    <tr key={order.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-3 font-mono font-bold text-purple-300">
                        #{order.ticket || order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 font-bold text-white">
                        {order.symbol}
                      </td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold font-mono",
                          isBuy ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        )}>
                          {order.direction}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-300">
                        {order.type}
                      </td>
                      <td className="py-3 font-mono text-[11px] font-bold text-white">
                        {order.quantity} lot
                      </td>
                      <td className="py-3 font-mono font-bold text-slate-200">
                        ${Number(order.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 font-mono text-[10px] text-slate-400">
                        <span className="text-rose-400">SL: ${order.stopLoss || 'None'}</span>
                        <span className="mx-1">•</span>
                        <span className="text-emerald-400">TP: ${order.takeProfit || 'None'}</span>
                      </td>
                      <td className="py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold font-mono",
                          order.status === 'FILLED' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                          order.status === 'PENDING' ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" :
                          "bg-slate-500/20 text-slate-400"
                        )}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {order.mode === 'PAPER_TRADING' ? 'Paper Trading' : order.mode}
                        </span>
                      </td>
                      <td className="py-3 text-[11px] text-slate-400 font-mono">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
