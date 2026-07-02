'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Search, Star, StarOff,
  BarChart3, RefreshCw, ChevronUp, ChevronDown
} from 'lucide-react';
import { useMarketStore, Ticker } from '@/store/useMarketStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { MiniSparkline } from '@/components/charts/MiniSparkline';
import { cn } from '@/lib/utils';

const TABS = ['All', 'Crypto', 'Stocks', 'Forex', 'Watchlist'] as const;
type Tab = typeof TABS[number];

const sparkMap: Record<string, number[]> = {
  'BTC/USD': [60000, 61200, 62400, 63100, 62800, 64000, 64318],
  'ETH/USD': [2900, 3050, 3120, 3090, 3200, 3150, 3182],
  'SOL/USD': [168, 172, 176, 181, 185, 183, 184],
  'BNB/USD': [400, 405, 408, 410, 415, 413, 412],
  'XRP/USD': [0.63, 0.64, 0.625, 0.618, 0.622, 0.620, 0.625],
  'AAPL':    [190, 192, 194, 195, 193, 196, 197],
  'TSLA':    [260, 256, 252, 248, 250, 246, 248],
  'NVDA':    [840, 850, 855, 860, 870, 868, 875],
  'EUR/USD': [1.082, 1.083, 1.084, 1.085, 1.086, 1.085, 1.085],
  'GBP/USD': [1.274, 1.272, 1.271, 1.273, 1.272, 1.270, 1.271],
  'USD/JPY': [150.8, 151.0, 151.2, 151.4, 151.5, 151.4, 151.4],
};

export default function MarketsPage() {
  const { tickers, watchlist, addToWatchlist, removeFromWatchlist } = useMarketStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [sortKey, setSortKey] = useState<keyof Ticker>('changePct24h');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let list = [...tickers];
    if (activeTab === 'Crypto') list = list.filter(t => t.type === 'crypto');
    else if (activeTab === 'Stocks') list = list.filter(t => t.type === 'stock');
    else if (activeTab === 'Forex') list = list.filter(t => t.type === 'forex');
    else if (activeTab === 'Watchlist') list = list.filter(t => watchlist.includes(t.symbol));

    if (search) {
      list = list.filter(t =>
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' || typeof bv === 'string') {
        return sortDir === 'desc'
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      }
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

    return list;
  }, [tickers, activeTab, search, sortKey, sortDir, watchlist]);

  const toggleSort = (key: keyof Ticker) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: keyof Ticker }) => {
    if (sortKey !== col) return <ChevronDown size={12} className="text-slate-600" />;
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="text-purple-400" />
      : <ChevronUp size={12} className="text-purple-400" />;
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Global Markets"
        subtitle="Live prices across 10,000+ assets. Updated every 500ms."
        icon={BarChart3}
      >
        <button className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 text-xs">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-1.5 rounded-lg font-semibold transition-all',
                activeTab === tab ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {tab} {tab === 'Watchlist' && <span className="ml-1 text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">{watchlist.length}</span>}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-glass pl-8 pr-4 py-2 rounded-xl text-xs w-52 md:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Market Cap', value: '$2.84T', change: '+1.8%', positive: true },
          { label: 'BTC Dominance',    value: '44.3%',  change: '+0.4%', positive: true },
          { label: '24h Volume',        value: '$98.6B', change: '-3.2%', positive: false },
          { label: 'Active Markets',    value: '10,248', change: '+12',   positive: true },
        ].map(({ label, value, change, positive }) => (
          <div key={label} className="glass-card rounded-2xl p-4">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">{label}</div>
            <div className="font-display font-bold text-white text-xl">{value}</div>
            <div className={cn('text-xs font-semibold mt-1 flex items-center gap-1', positive ? 'text-emerald-400' : 'text-red-400')}>
              {positive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {change}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left w-8">#</th>
                <th className="text-left">Asset</th>
                <th className="text-right cursor-pointer" onClick={() => toggleSort('price')}>
                  <div className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></div>
                </th>
                <th className="text-right cursor-pointer" onClick={() => toggleSort('changePct24h')}>
                  <div className="flex items-center justify-end gap-1">24h % <SortIcon col="changePct24h" /></div>
                </th>
                <th className="text-right hidden md:table-cell cursor-pointer" onClick={() => toggleSort('volume24h')}>
                  <div className="flex items-center justify-end gap-1">Volume <SortIcon col="volume24h" /></div>
                </th>
                <th className="text-right hidden lg:table-cell cursor-pointer" onClick={() => toggleSort('marketCap')}>
                  <div className="flex items-center justify-end gap-1">Mkt Cap <SortIcon col="marketCap" /></div>
                </th>
                <th className="text-right hidden xl:table-cell">7D Chart</th>
                <th className="text-center">Watch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticker, i) => {
                const inWatchlist = watchlist.includes(ticker.symbol);
                const spark = sparkMap[ticker.symbol] ?? [50, 52, 51, 53, 54, 55, 56];
                return (
                  <tr key={ticker.symbol} className="group">
                    <td className="text-slate-600 text-xs">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/15 to-indigo-600/15 border border-purple-500/10 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0">
                          {ticker.symbol.replace('/USD','').slice(0,3)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">{ticker.symbol}</div>
                          <div className="text-[10px] text-slate-500">{ticker.name}</div>
                        </div>
                        <Badge
                          variant={ticker.type === 'crypto' ? 'purple' : ticker.type === 'stock' ? 'blue' : 'amber'}
                          size="xs"
                        >
                          {ticker.type}
                        </Badge>
                      </div>
                    </td>
                    <td className="text-right font-mono font-semibold text-slate-100">
                      {ticker.type === 'forex' ? ticker.price.toFixed(4) :
                       ticker.price >= 1000 ? ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) :
                       ticker.price.toFixed(4)}
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        'inline-flex items-center gap-0.5 font-bold text-xs',
                        ticker.changePct24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {ticker.changePct24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(ticker.changePct24h).toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right text-slate-400 text-xs hidden md:table-cell">
                      {new Intl.NumberFormat('en', { notation:'compact', maximumFractionDigits:2 }).format(ticker.volume24h)}
                    </td>
                    <td className="text-right text-slate-400 text-xs hidden lg:table-cell">
                      {ticker.marketCap > 0 ? new Intl.NumberFormat('en', { notation:'compact', maximumFractionDigits:2 }).format(ticker.marketCap) : '—'}
                    </td>
                    <td className="hidden xl:table-cell" style={{ width: 100 }}>
                      <MiniSparkline data={spark} color={ticker.changePct24h >= 0 ? '#10b981' : '#ef4444'} height={36} />
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => inWatchlist ? removeFromWatchlist(ticker.symbol) : addToWatchlist(ticker.symbol)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                      >
                        {inWatchlist
                          ? <Star size={14} className="text-amber-400 fill-amber-400" />
                          : <StarOff size={14} className="text-slate-600 hover:text-amber-400" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
