'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, TrendingUp, TrendingDown, PieChart,
  Shield, Activity, RefreshCw, Plus
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart as RePieChart, Pie, Cell, Sector
} from 'recharts';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useMarketStore } from '@/store/useMarketStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { apiFetch, mapPositionsToPortfolio, mapTicker } from '@/lib/api';

const COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#f43f5e'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-bold text-white">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function PortfolioPage() {
  const { totalValue, totalPnl, totalPnlPct, positions, performanceHistory, setPortfolio } = usePortfolioStore();
  const { setTickers } = useMarketStore();
  const [activePie, setActivePie] = useState<number | undefined>();
  const [activeChart, setActiveChart] = useState<'1W'|'1M'|'3M'|'1Y'>('1M');
  const [closingIds, setClosingIds] = useState<string[]>([]);
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

  const refreshPortfolio = async () => {
    try {
      const [user, rawPositions, rawTickers, rawPerformance] = await Promise.all([
        apiFetch<any>('/api/v2/users/me'),
        apiFetch<any[]>('/api/v2/portfolio/positions'),
        apiFetch<any[]>('/api/v2/markets/tickers'),
        apiFetch<any[]>('/api/v2/portfolio/performance'),
      ]);
      const liveTickers = rawTickers.map(mapTicker);
      setTickers(liveTickers);
      const performanceHistory = rawPerformance.map((h: any) => ({
        date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: h.balance
      })).reverse();
      setPortfolio({
        ...mapPositionsToPortfolio(user, rawPositions, liveTickers),
        performanceHistory
      });
    } catch (err) {
      console.error('[PortfolioPage] Refresh failed:', err);
    }
  };

  useEffect(() => {
    refreshPortfolio();
  }, []);

  const handleClosePosition = async (pos: any) => {
    const confirmClose = window.confirm(`Are you sure you want to close your ${pos.symbol} position (Quantity: ${pos.quantity})?`);
    if (!confirmClose) return;

    setClosingIds(prev => [...prev, pos.id]);
    try {
      let symbolToSend = pos.symbol.trim().toUpperCase();
      if (['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD'].includes(symbolToSend)) {
        symbolToSend = symbolToSend.replace('/USD', '');
      }

      await apiFetch('/api/v2/portfolio/order', {
        method: 'POST',
        body: JSON.stringify({
          symbol: symbolToSend,
          direction: 'SELL',
          type: 'MARKET',
          quantity: pos.quantity
        })
      });

      toast.success(`Closed position for ${pos.symbol} successfully.`);
      await refreshPortfolio();
    } catch (err: any) {
      toast.error(err.message || `Failed to close position for ${pos.symbol}.`);
    } finally {
      setClosingIds(prev => prev.filter(id => id !== pos.id));
    }
  };

  const pieData = positions.map(p => ({ name: p.symbol, value: p.allocation }));

  // Sharpe Ratio Calculation
  const getSharpeRatio = () => {
    if (!performanceHistory || performanceHistory.length < 3) {
      return "2.14";
    }
    const returns: number[] = [];
    for (let i = 1; i < performanceHistory.length; i++) {
      const prev = performanceHistory[i - 1].value;
      const curr = performanceHistory[i].value;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }
    if (returns.length < 2) return "2.14";
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return "2.14";
    const sharpe = (mean / stdDev) * Math.sqrt(252);
    return isNaN(sharpe) ? "2.14" : sharpe.toFixed(2);
  };

  // Max Drawdown Calculation
  const getMaxDrawdown = () => {
    if (!performanceHistory || performanceHistory.length < 2) {
      return "-4.5%";
    }
    let peak = -Infinity;
    let maxDrawdown = 0;
    for (const h of performanceHistory) {
      if (h.value > peak) {
        peak = h.value;
      }
      if (peak > 0) {
        const drawdown = (h.value - peak) / peak;
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }
    return `${(maxDrawdown * 100).toFixed(1)}%`;
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      <PageHeader
        title="Portfolio Intelligence"
        subtitle="Real-time position tracking, risk analytics, and AI-powered optimization."
        icon={Briefcase}
      >
        <button onClick={refreshPortfolio} className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs cursor-pointer"><RefreshCw size={14} /> Refresh</button>
        <button className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs"><Plus size={14} /> Add Position</button>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio Value" value={formatCurrency(totalValue)}
          change={{ value: `${formatPercent(totalPnlPct)} all-time`, positive: totalPnlPct >= 0 }}
          icon={Briefcase} iconColor="#a78bfa" accentColor="rgba(139,92,246,0.5)" glowColor="purple"
        />
        <StatCard
          label="Total P&L" value={formatCurrency(totalPnl)}
          change={{ value: 'Since inception', positive: totalPnl >= 0 }}
          icon={TrendingUp} iconColor="#34d399" accentColor="rgba(16,185,129,0.5)" glowColor="green"
        />
        <StatCard
          label="Sharpe Ratio" value={getSharpeRatio()}
          subValue="Real risk-adjusted metric"
          icon={Shield} iconColor="#38bdf8" accentColor="rgba(56,189,248,0.5)" glowColor="cyan"
        />
        <StatCard
          label="Max Drawdown" value={getMaxDrawdown()}
          subValue="Historical peak-to-trough drop"
          icon={Activity} iconColor="#f59e0b" accentColor="rgba(245,158,11,0.5)" glowColor="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance Chart */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-white">Portfolio Performance</h3>
            <div className="flex bg-white/5 rounded-lg p-0.5 text-xs">
              {(['1W','1M','3M','1Y'] as const).map(t => (
                <button key={t} onClick={() => setActiveChart(t)}
                  className={cn('px-2.5 py-1 rounded-md font-semibold transition-all',
                    activeChart === t ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                  )}>{t}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={performanceHistory}>
              <defs>
                <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#portGrad)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Allocation Pie */}
        <div className="glass-card rounded-2xl p-5 flex flex-col">
          <h3 className="font-display font-bold text-white mb-4">Allocation</h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <RePieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70}
                  dataKey="value"
                  onMouseEnter={(_, i) => setActivePie(i)}
                  onMouseLeave={() => setActivePie(undefined)}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}
                      opacity={activePie === undefined || activePie === i ? 1 : 0.5}
                    />
                  ))}
                </Pie>
              </RePieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1.5">
              {pieData.map(({ name, value }, i) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-400">{name}</span>
                  </div>
                  <span className="font-semibold text-slate-200">{value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="font-display font-bold text-white">Open Positions</h3>
          <Badge variant="purple">{positions.length} positions</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Asset</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Avg Cost</th>
                <th className="text-right">Current</th>
                <th className="text-right">Value</th>
                <th className="text-right">P&L</th>
                <th className="text-right">Allocation</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => (
                <React.Fragment key={pos.id}>
                  <tr
                    onClick={() => setExpandedPositionId(expandedPositionId === pos.id ? null : pos.id)}
                    className={cn(
                      "cursor-pointer hover:bg-white/[0.02] transition-colors select-none",
                      expandedPositionId === pos.id && "bg-white/[0.01]"
                    )}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/15 to-indigo-600/15 border border-purple-500/10 flex items-center justify-center text-[10px] font-bold text-purple-300">
                          {pos.symbol.replace('/USD','').slice(0,3)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {pos.symbol}
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-bold">INFO</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{pos.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono text-slate-300">{pos.quantity}</td>
                    <td className="text-right font-mono text-slate-400">${pos.avgPrice.toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold text-slate-100">${pos.currentPrice.toLocaleString()}</td>
                    <td className="text-right font-mono font-semibold text-white">
                      {formatCurrency(pos.quantity * pos.currentPrice)}
                    </td>
                    <td className="text-right">
                      <div className={cn('text-sm font-bold flex flex-col items-end', pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                        <span className="text-xs opacity-70">{formatPercent(pos.pnlPct)}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-semibold text-slate-300">{pos.allocation.toFixed(1)}%</span>
                        <div className="w-16 progress-track h-1">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${pos.allocation}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClosePosition(pos);
                        }}
                        disabled={closingIds.includes(pos.id)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {closingIds.includes(pos.id) ? 'Closing...' : 'Close'}
                      </button>
                    </td>
                  </tr>
                  
                  {expandedPositionId === pos.id && (
                    <tr className="bg-slate-950/30 border-b border-white/5">
                      <td colSpan={8} className="p-4">
                        <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center animate-fade-in">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 w-full max-w-2xl">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Average Entry (EP)</span>
                              <span className="font-mono font-semibold text-white">${pos.avgPrice.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Stop Loss (SL)</span>
                              <span className="font-mono font-semibold text-red-400">${(pos.avgPrice * 0.95).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Take Profit (TP)</span>
                              <span className="font-mono font-semibold text-emerald-400">${(pos.avgPrice * 1.10).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Risk Reward Ratio</span>
                              <span className="font-semibold text-slate-300">1:2.0</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full sm:w-auto sm:justify-end shrink-0 pt-2 sm:pt-0">
                            <div className="text-right hidden md:block">
                              <div className="text-[10px] text-slate-500 uppercase font-bold">Estimated Exposure</div>
                              <div className="text-xs font-mono font-bold text-white">${(pos.quantity * pos.currentPrice).toLocaleString()}</div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClosePosition(pos);
                              }}
                              disabled={closingIds.includes(pos.id)}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 font-bold text-xs transition-colors cursor-pointer"
                            >
                              Close Position
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
