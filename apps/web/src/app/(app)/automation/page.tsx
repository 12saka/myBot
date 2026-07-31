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

  const fetchAutomationData = async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      const [stratRes, rulesRes] = await Promise.allSettled([
        apiFetch<StrategyTemplate[]>('/api/v2/strategies'),
        apiFetch<AutomationRule[]>('/api/v2/automation/rules')
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
        title="Automation Engine & Strategy Rules"
        subtitle="Configure server-side automated execution rules, risk caps, and strategy templates."
        icon={Cpu}
      >
        <button
          onClick={fetchAutomationData}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Refresh Rules & Strategies"
        >
          <RefreshCw size={14} className={cn(loadState === 'loading' && "animate-spin")} />
        </button>
      </PageHeader>

      {/* Grid status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36 border border-white/5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Engine Status</span>
                <h3 className="text-xl font-display font-bold text-white mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeRule ? 'bg-purple-400 animate-ping' : 'bg-slate-600'}`} />
                  {activeRule ? `Bot Running (${activeRule.name})` : 'Engine Standing By'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {activeRule ? 'Active server-side rule listening to live market signals.' : 'No active automation rules running. Select a strategy to launch.'}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36 border border-white/5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Strategy Allocation</span>
                <h3 className="text-xl font-display font-bold text-purple-400 mt-1">
                  ${activeRule ? activeRule.allocation.toLocaleString() : '0.00'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Max risk per trade cap: {activeRule ? activeRule.riskLimit : 1.0}% | Drawdown limit: {activeRule ? activeRule.maxDrawdown : 5.0}%
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
    </motion.div>
  );
}
