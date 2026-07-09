'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Search, Star, StarOff,
  BarChart3, RefreshCw, ChevronUp, ChevronDown, X, Zap,
  Maximize2, Minimize2, BrainCircuit, Loader2, Activity
} from 'lucide-react';
import { useMarketStore, Ticker } from '@/store/useMarketStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { MiniSparkline } from '@/components/charts/MiniSparkline';
import { cn } from '@/lib/utils';
import { TradingViewWidget } from '@/components/charts/TradingViewWidget';
import { QuickTradeWidget } from '@/components/dashboard/QuickTradeWidget';
import { apiFetch } from '@/lib/api';

const TABS = ['All', 'Crypto', 'Stocks', 'Indices', 'Forex', 'Commodities', 'Watchlist'] as const;
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
  'MSFT':    [408, 410, 412, 414, 413, 416, 415],
  'AMZN':    [182, 183, 184, 185, 184, 186, 185],
  'US30':    [38800, 39000, 39100, 39050, 39200, 39180, 39220],
  'US100':   [18100, 18200, 18300, 18350, 18400, 18380, 18420],
  'SPX500':  [5200, 5240, 5260, 5280, 5300, 5290, 5310],
  'DAX40':   [18500, 18600, 18650, 18700, 18720, 18680, 18710],
  'GOLD':    [2300, 2320, 2330, 2340, 2350, 2345, 2355],
  'OIL':     [76.0, 77.0, 77.5, 78.0, 78.5, 78.2, 78.6],
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

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const closeDrawer = () => {
    setSelectedSymbol(null);
    setIsFullscreen(false);
    setAiAnalysis(null);
    setShowAiPanel(false);
  };

  const fetchAIAnalysis = useCallback(async (symbol: string) => {
    setAiLoading(true);
    setShowAiPanel(true);
    setAiAnalysis(null);
    try {
      const res = await apiFetch<{ reply: string }>('/api/v2/copilot/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Perform a comprehensive technical and fundamental analysis for ${symbol}. Include:
1. Current market trend and momentum
2. Key support and resistance levels
3. RSI, MACD, and moving average insights
4. Short-term (1-3 day) and medium-term (1-2 week) price outlook
5. Risk factors and trading recommendation (BUY/SELL/HOLD) with confidence level
6. Entry point, stop loss, and take profit targets`
          }],
          portfolioContext: null
        }),
      });
      setAiAnalysis(res.reply);
    } catch (err) {
      setAiAnalysis('⚠️ AI analysis unavailable. Please ensure the AI service is running.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const symbolParam = params.get('symbol');
      if (symbolParam) {
        setSelectedSymbol(symbolParam);
      }
    }
  }, []);

  const filtered = useMemo(() => {
    let list = [...tickers];
    if (activeTab === 'Crypto') list = list.filter(t => t.type === 'crypto');
    else if (activeTab === 'Stocks') list = list.filter(t => t.type === 'stock');
    else if (activeTab === 'Indices') list = list.filter(t => t.type === 'index');
    else if (activeTab === 'Forex') list = list.filter(t => t.type === 'forex');
    else if (activeTab === 'Commodities') list = list.filter(t => t.type === 'commodity');
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
        <button 
          onClick={() => window.location.reload()} 
          className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
        >
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
                  <tr
                    key={ticker.symbol}
                    className="group cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => setSelectedSymbol(ticker.symbol)}
                  >
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
                        onClick={(e) => { e.stopPropagation(); inWatchlist ? removeFromWatchlist(ticker.symbol) : addToWatchlist(ticker.symbol); }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
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

      {/* TradingView Chart Side Drawer */}
      <AnimatePresence>
        {selectedSymbol && (
          <div className={cn("fixed inset-0 flex justify-end", isFullscreen ? "z-[60]" : "z-[55]")}>
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
            />

            {/* Sidebar Panel */}
            <motion.div
              className={cn(
                "relative h-full border-l border-white/10 bg-[#080d1a] shadow-2xl overflow-y-auto flex flex-col",
                isFullscreen ? "w-screen max-w-full" : "w-full max-w-3xl"
              )}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300">
                    <Activity size={18} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-base">{selectedSymbol} — Live Chart</h3>
                    <p className="text-[10px] text-slate-500">TradingView feed · RSI · MACD overlays</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchAIAnalysis(selectedSymbol)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-purple-300 hover:text-purple-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Analyse with AI"
                  >
                    <BrainCircuit size={13} /> AI Analyse
                  </button>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    onClick={closeDrawer}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div className={cn("flex-shrink-0 px-2 pt-2", isFullscreen ? "h-[60vh]" : "h-[420px]")}>
                <TradingViewWidget symbol={selectedSymbol} height={isFullscreen ? Math.round(window.innerHeight * 0.58) : 420} />
              </div>

              {/* AI Analysis Panel */}
              <AnimatePresence>
                {showAiPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/5 mx-6 mt-4"
                  >
                    <div className="flex items-center gap-2 py-3">
                      <BrainCircuit size={15} className="text-purple-400" />
                      <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Gemini AI Market Analysis</span>
                      {aiLoading && <Loader2 size={12} className="text-slate-500 animate-spin ml-auto" />}
                      {!aiLoading && aiAnalysis && (
                        <button
                          onClick={() => { setShowAiPanel(false); setAiAnalysis(null); }}
                          className="ml-auto text-slate-600 hover:text-slate-400 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {aiLoading && (
                      <div className="flex flex-col gap-2 pb-4">
                        {[80, 95, 70, 85, 60].map((w, i) => (
                          <div key={i} className="h-3 rounded-full bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
                        ))}
                        <p className="text-[10px] text-slate-600 mt-1">Gemini is analysing {selectedSymbol} market conditions...</p>
                      </div>
                    )}
                    {!aiLoading && aiAnalysis && (
                      <div className="pb-4 text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                        {aiAnalysis}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer Actions */}
              <div className="flex gap-3 border-t border-white/5 px-6 py-4 mt-auto">
                <button
                  onClick={() => fetchAIAnalysis(selectedSymbol!)}
                  disabled={aiLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/25 text-purple-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <BrainCircuit size={13} />}
                  {aiLoading ? 'Analysing...' : 'AI Full Analysis'}
                </button>
                <button
                  onClick={() => setIsTradeOpen(true)}
                  className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap size={14} /> Quick Order
                </button>
                <button
                  onClick={closeDrawer}
                  className="px-5 py-2.5 rounded-xl border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QuickTradeWidget
        isOpen={isTradeOpen}
        onClose={() => setIsTradeOpen(false)}
        defaultSymbol={selectedSymbol || 'BTC'}
      />
    </motion.div>
  );
}
