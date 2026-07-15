'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Zap, Shield, Play, Pause, Settings,
  AlertTriangle, RefreshCw, BarChart3, Sliders, Info
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { useAIStore } from '@/store/useAIStore';
import { toast } from 'react-hot-toast';

const MOCK_STRATEGIES = [
  { id: 'strat1', name: 'Trend Following AI', type: 'Trend', description: 'Leverages EMA-200 and RSI crossovers to capture mid-term momentum breakouts.', accuracy: '88%' },
  { id: 'strat2', name: 'Smart Money Flow', type: 'Liquidity', description: 'Tracks institutional block trades and dark pool orders in key supply/demand zones.', accuracy: '84%' },
  { id: 'strat3', name: 'Breakout AI', type: 'Volatility', description: 'Targets rapid price breakouts from ascending/descending channel resistance.', accuracy: '82%' },
  { id: 'strat4', name: 'Mean Reversion AI', type: 'Reversal', description: 'Detects overbought/oversold extremes using Bollinger Bands and regression.', accuracy: '78%' },
];

export default function AutomationPage() {
  const { 
    autonomousActive, 
    setAutonomous, 
    aiMode, 
    setAIMode,
    allocation,
    setAllocation,
    riskLimit,
    setRiskLimit,
    maxDrawdown,
    setMaxDrawdown
  } = useAIStore();
  const [selectedStrat, setSelectedStrat] = useState('strat1');

  const handleToggleAutonomous = () => {
    const nextState = !autonomousActive;
    setAutonomous(nextState);
    if (nextState) {
      toast.success('Autonomous AI Execution Enabled! The bot will now place trades matching your parameters.');
    } else {
      toast('Autonomous execution paused. Current positions remain active with manual controls.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Strategy parameters updated successfully!');
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Automation Center"
        subtitle="Manage strategy presets, risk constraints, and toggle autonomous execution."
        icon={Cpu}
      >
        <button
          onClick={handleToggleAutonomous}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 ${
            autonomousActive
              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10'
          }`}
        >
          {autonomousActive ? <Pause size={14} /> : <Play size={14} />}
          {autonomousActive ? 'Pause Autonomous Bot' : 'Start Autonomous Bot'}
        </button>
      </PageHeader>

      {/* Grid status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Engine Status</span>
                <h3 className="text-xl font-display font-bold text-white mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${autonomousActive ? 'bg-purple-400 animate-ping' : 'bg-slate-600'}`} />
                  {autonomousActive ? 'Autonomous Bot Running' : 'Engine Standing By'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                {autonomousActive ? 'Engine is active and listening to live WebSockets. Trades will be executed instantly.' : 'System in monitoring mode. AI signals will generate notifications only.'}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-5 flex flex-col justify-between h-36">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Risk Profile Mode</span>
                <div className="flex gap-2 mt-2">
                  {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setAIMode(mode)}
                      className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border uppercase ${
                        aiMode === mode
                          ? 'bg-purple-500 text-white border-purple-600'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Adjusts leverage, win probability thresholds, and stop-loss widths.
              </p>
            </div>
          </div>

          {/* Strategies selection */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-display font-bold text-white mb-4">Select AI Strategy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MOCK_STRATEGIES.map((strat) => (
                <div
                  key={strat.id}
                  onClick={() => setSelectedStrat(strat.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedStrat === strat.id
                      ? 'border-purple-500/40 bg-purple-500/5'
                      : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/3'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-sm text-slate-200">{strat.name}</div>
                    <Badge variant="purple" size="xs">{strat.type}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{strat.description}</p>
                  <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-2">
                    <span className="text-slate-600 uppercase font-bold tracking-wider">Confidence Level</span>
                    <span className="text-purple-400 font-bold">{strat.accuracy} Accuracy</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Configuration settings panel */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders size={18} className="text-purple-400" />
            <h3 className="font-display font-bold text-white">Bot Parameters</h3>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-2 font-semibold">
                <span>Asset Allocation</span>
                <span className="text-white font-bold">{allocation}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={allocation}
                onChange={e => setAllocation(Number(e.target.value))}
                className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-600 mt-1 block">Max portfolio funds to assign to this strategy.</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-2 font-semibold">
                <span>Risk per Trade</span>
                <span className="text-white font-bold">{riskLimit}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={riskLimit}
                onChange={e => setRiskLimit(Number(e.target.value))}
                className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-600 mt-1 block">Capital at risk per executed order block.</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-2 font-semibold">
                <span>Maximum Drawdown Limit</span>
                <span className="text-white font-bold">{maxDrawdown}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                value={maxDrawdown}
                onChange={e => setMaxDrawdown(Number(e.target.value))}
                className="w-full accent-purple-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-600 mt-1 block">Circuit breaker halts trading if account drops this much.</span>
            </div>

            <button
              type="submit"
              className="w-full btn-primary py-3 rounded-xl font-bold text-xs"
            >
              Update Parameters
            </button>
          </form>

          <div className="mt-5 p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/5 text-[10px] text-amber-300 leading-normal flex items-start gap-2.5">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Caution:</strong> Enable autonomous mode only if you fully comprehend the volatility of underlying assets. Use paper trading options inside Settings first to evaluate.
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
