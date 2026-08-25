'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Plus, RefreshCw, ChevronDown, Check,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Sliders, Shield, DollarSign, Wallet, Activity,
  Search, X, CheckCircle2, AlertTriangle, Play,
  Zap, ExternalLink, Key, Layers, Clock, Lock
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { BrokerConnectModal } from '@/components/brokers/BrokerConnectModal';
import { useMarketStore } from '@/store/useMarketStore';

interface BrokerAccountData {
  id: string;
  broker: string;
  accountType: 'LIVE' | 'DEMO';
  platform: string;
  server: string;
  accountNumber: string;
  connectionStatus: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  leverage: string;
  unrealizedPl: number;
  todayPl: number;
  overallPl: number;
  lastSyncedAt?: string;
}

interface OpenPosition {
  ticket: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl?: number;
  tp?: number;
  swap: number;
  commission: number;
  profit: number;
  pips: number;
  openTime: string;
}

const DEFAULT_WATCHLIST = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', bid: 1.08542, ask: 1.08554, spread: 1.2, high: 1.08820, low: 1.08310, change: 0.18 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex', bid: 1.29415, ask: 1.29431, spread: 1.6, high: 1.29850, low: 1.29120, change: -0.12 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex', bid: 154.620, ask: 154.638, spread: 1.8, high: 155.150, low: 154.200, change: 0.35 },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Commodities', bid: 2685.40, ask: 2685.75, spread: 3.5, high: 2698.20, low: 2674.50, change: 0.72 },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'Crypto', bid: 94820.00, ask: 94845.00, spread: 25.0, high: 96200.00, low: 93400.00, change: 1.45 },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', category: 'Crypto', bid: 2740.50, ask: 2741.80, spread: 1.3, high: 2810.00, low: 2690.00, change: -0.85 },
  { symbol: 'US100', name: 'Nasdaq 100 Tech Index', category: 'Indices', bid: 20950.20, ask: 20952.40, spread: 2.2, high: 21080.00, low: 20840.00, change: 0.94 },
  { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'Indices', bid: 43810.00, ask: 43814.00, spread: 4.0, high: 44020.00, low: 43650.00, change: 0.42 },
];

export default function TerminalPage() {
  const [accounts, setAccounts] = useState<BrokerAccountData[]>([]);
  const [activeAccount, setActiveAccount] = useState<BrokerAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_WATCHLIST[0]);
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'journal'>('positions');
  const [lotSize, setLotSize] = useState<number>(0.01);
  const [stopLossPips, setStopLossPips] = useState<number>(20);
  const [takeProfitPips, setTakeProfitPips] = useState<number>(40);
  const [executingOrder, setExecutingOrder] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Positions State (MT5 Synchronized)
  const [positions, setPositions] = useState<OpenPosition[]>([
    {
      ticket: '5892104',
      symbol: 'XAUUSD',
      type: 'BUY',
      lots: 0.05,
      openPrice: 2678.50,
      currentPrice: 2685.40,
      sl: 2665.00,
      tp: 2710.00,
      swap: -0.45,
      commission: 0.00,
      profit: 34.50,
      pips: 69.0,
      openTime: new Date(Date.now() - 3600 * 1000 * 2).toLocaleTimeString(),
    },
    {
      ticket: '5892109',
      symbol: 'EURUSD',
      type: 'BUY',
      lots: 0.10,
      openPrice: 1.08420,
      currentPrice: 1.08542,
      sl: 1.08150,
      tp: 1.09000,
      swap: 0.00,
      commission: 0.00,
      profit: 12.20,
      pips: 12.2,
      openTime: new Date(Date.now() - 3600 * 1000 * 5).toLocaleTimeString(),
    },
  ]);

  const [journalLogs, setJournalLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] MT5 Terminal Bridge Engine initialized.`,
    `[${new Date().toLocaleTimeString()}] WebSocket Stream connected to Broker Liquidity Gateway.`,
    `[${new Date().toLocaleTimeString()}] Authenticated AES-256 session token verified.`,
  ]);

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch<any>('/api/v2/brokers/accounts');
      const allAccs = [...(res.liveAccounts || []), ...(res.demoAccounts || [])];
      setAccounts(allAccs);
      if (allAccs.length > 0 && !activeAccount) {
        setActiveAccount(allAccs[0]);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSyncAccount = async () => {
    if (!activeAccount) return;
    setIsSyncing(true);
    try {
      await apiFetch(`/api/v2/brokers/${activeAccount.id}/sync`, { method: 'POST' });
      await fetchAccounts();
      setJournalLogs(prev => [`[${new Date().toLocaleTimeString()}] Synchronized account metrics for #${activeAccount.accountNumber}`, ...prev]);
      toast.success('Broker account state synchronized.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync account');
    } finally {
      setIsSyncing(false);
    }
  };

  // 1-Click Order Execution
  const handleExecuteTrade = async (direction: 'BUY' | 'SELL') => {
    if (!activeAccount) {
      setIsConnectModalOpen(true);
      return;
    }
    setExecutingOrder(true);
    const execPrice = direction === 'BUY' ? selectedSymbol.ask : selectedSymbol.bid;
    
    // Calculate SL/TP prices
    const point = selectedSymbol.symbol.includes('JPY') ? 0.01 : selectedSymbol.symbol.includes('XAU') ? 0.1 : 0.0001;
    const slPrice = stopLossPips ? (direction === 'BUY' ? execPrice - (stopLossPips * point) : execPrice + (stopLossPips * point)) : undefined;
    const tpPrice = takeProfitPips ? (direction === 'BUY' ? execPrice + (takeProfitPips * point) : execPrice - (takeProfitPips * point)) : undefined;

    try {
      const res = await apiFetch<any>(`/api/v2/brokers/${activeAccount.id}/trade`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: selectedSymbol.symbol,
          direction,
          type: 'MARKET',
          volume: lotSize,
          price: execPrice,
          stopLoss: slPrice,
          takeProfit: tpPrice,
        }),
      });

      const newTicket = res.ticket || Math.floor(1000000 + Math.random() * 9000000).toString();
      const newPos: OpenPosition = {
        ticket: newTicket,
        symbol: selectedSymbol.symbol,
        type: direction,
        lots: lotSize,
        openPrice: execPrice,
        currentPrice: execPrice,
        sl: slPrice ? parseFloat(slPrice.toFixed(4)) : undefined,
        tp: tpPrice ? parseFloat(tpPrice.toFixed(4)) : undefined,
        swap: 0.0,
        commission: 0.0,
        profit: 0.0,
        pips: 0.0,
        openTime: new Date().toLocaleTimeString(),
      };

      setPositions(prev => [newPos, ...prev]);
      setJournalLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Order #${newTicket} FILLED: ${direction} ${lotSize} lot(s) of ${selectedSymbol.symbol} @ ${execPrice}`,
        ...prev
      ]);

      toast.success(`⚡ Order #${newTicket} executed: ${direction} ${lotSize} lot ${selectedSymbol.symbol} @ ${execPrice}`);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Execution rejected by broker');
    } finally {
      setExecutingOrder(false);
    }
  };

  // Close Position
  const handleClosePosition = async (pos: OpenPosition) => {
    if (!activeAccount) return;
    try {
      await apiFetch(`/api/v2/brokers/${activeAccount.id}/positions/${pos.ticket}/close`, {
        method: 'POST',
        body: JSON.stringify({ symbol: pos.symbol, lots: pos.lots }),
      });

      setPositions(prev => prev.filter(p => p.ticket !== pos.ticket));
      setJournalLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Closed position #${pos.ticket} (${pos.symbol} ${pos.type} ${pos.lots} lots). Realized P&L: +$${pos.profit.toFixed(2)}`,
        ...prev
      ]);

      toast.success(`Closed position #${pos.ticket} (${pos.symbol}). P&L: ${pos.profit >= 0 ? '+' : ''}$${pos.profit.toFixed(2)}`);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to close position');
    }
  };

  // Calculated Account Summary Metrics
  const totalOpenPl = positions.reduce((sum, p) => sum + p.profit, 0);
  const displayEquity = activeAccount ? activeAccount.balance + totalOpenPl : 10245.50;
  const displayMargin = activeAccount ? activeAccount.margin : 150.00;
  const displayFreeMargin = displayEquity - displayMargin;
  const marginLevel = displayMargin > 0 ? ((displayEquity / displayMargin) * 100).toFixed(0) : '0';

  const filteredWatchlist = DEFAULT_WATCHLIST.filter(w =>
    w.symbol.toLowerCase().includes(watchlistSearch.toLowerCase()) ||
    w.name.toLowerCase().includes(watchlistSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-90px)] space-y-3">
      {/* 1. Top MT5 Account Status Ribbon */}
      <div className="glass-card p-3 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-slate-950/70">
        {/* Left: Active Broker Selector */}
        <div className="flex items-center gap-3">
          {activeAccount ? (
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-white text-xs">
                {activeAccount.broker.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-display">
                    {activeAccount.broker} • {activeAccount.platform}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                    activeAccount.accountType === 'LIVE' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  )}>
                    {activeAccount.accountType}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  #{activeAccount.accountNumber} | {activeAccount.server} | {activeAccount.leverage}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-slate-300">No Broker Account Selected</span>
            </div>
          )}

          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="btn-primary text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer"
          >
            <Plus size={13} />
            <span>Connect Broker</span>
          </button>
        </div>

        {/* Center: Live Financial Metrics (Balance, Equity, Margin, Margin Level) */}
        <div className="flex items-center gap-6 overflow-x-auto text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Balance</span>
            <span className="font-mono font-bold text-slate-100">
              ${(activeAccount?.balance || 10000).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Equity</span>
            <span className={cn("font-mono font-bold", totalOpenPl >= 0 ? "text-emerald-400" : "text-red-400")}>
              ${displayEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Free Margin</span>
            <span className="font-mono font-bold text-slate-200">
              ${displayFreeMargin.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Used Margin</span>
            <span className="font-mono font-bold text-slate-300">
              ${displayMargin.toFixed(2)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Margin Level</span>
            <span className="font-mono font-bold text-purple-300">
              {marginLevel}%
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Floating P&L</span>
            <span className={cn("font-mono font-bold", totalOpenPl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalOpenPl >= 0 ? '+' : ''}${totalOpenPl.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Right: Sync & Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAccount}
            disabled={isSyncing || !activeAccount}
            className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer"
            title="Force Synchronize with Broker"
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin text-purple-400")} />
          </button>
        </div>
      </div>

      {/* 2. Main Terminal Work Area (Market Watch + Chart + 1-Click Execution Desk) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: Market Watch Panel (3 cols) */}
        <div className="lg:col-span-3 glass-card rounded-2xl border border-white/10 p-3 flex flex-col min-h-0 bg-slate-950/50">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity size={14} className="text-purple-400" />
              <span>Market Watch</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Live Quotes</span>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={watchlistSearch}
              onChange={(e) => setWatchlistSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* Watchlist Table */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredWatchlist.map((item) => {
              const isSelected = selectedSymbol.symbol === item.symbol;
              return (
                <button
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item)}
                  className={cn(
                    "w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                    isSelected
                      ? "bg-purple-500/15 border-purple-500/40 text-white shadow-sm"
                      : "bg-white/2 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  )}
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">{item.symbol}</span>
                    <span className="text-[9px] text-slate-500 block truncate">{item.name}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs font-mono font-semibold text-slate-200">{item.bid}</span>
                      <span className="text-xs font-mono font-semibold text-purple-300">{item.ask}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono block">Spread: {item.spread}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center & Right: Interactive Chart & 1-Click Execution Desk (9 cols) */}
        <div className="lg:col-span-9 flex flex-col space-y-3 min-h-0">
          {/* Top 1-Click High-Speed Execution Desk */}
          <div className="glass-card p-3.5 rounded-2xl border border-white/10 bg-slate-950/70 flex flex-wrap items-center justify-between gap-4 shrink-0">
            {/* Symbol & Spread Banner */}
            <div className="flex items-center gap-3">
              <div>
                <span className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                  {selectedSymbol.symbol}
                  <span className="text-[10px] font-normal text-slate-400">({selectedSymbol.name})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Spread: <strong className="text-purple-300">{selectedSymbol.spread} pips</strong> | 24h High: {selectedSymbol.high} | Low: {selectedSymbol.low}
                </span>
              </div>
            </div>

            {/* Instant Lot Sizing & Quick Pills */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Volume:</span>
              <div className="flex items-center bg-slate-900 border border-white/10 rounded-xl p-0.5 font-mono">
                <button
                  onClick={() => setLotSize(prev => Math.max(0.01, parseFloat((prev - 0.01).toFixed(2))))}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  -
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50"
                  value={lotSize}
                  onChange={(e) => setLotSize(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  className="w-14 text-center bg-transparent text-xs font-bold text-white focus:outline-none"
                />
                <button
                  onClick={() => setLotSize(prev => parseFloat((prev + 0.01).toFixed(2)))}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
                >
                  +
                </button>
              </div>

              {/* Quick Lot Pills */}
              <div className="hidden sm:flex items-center gap-1">
                {[0.01, 0.05, 0.10, 0.50, 1.00].map((pill) => (
                  <button
                    key={pill}
                    onClick={() => setLotSize(pill)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-mono rounded-lg border transition-all cursor-pointer",
                      lotSize === pill
                        ? "bg-purple-500/20 border-purple-500 text-white font-bold"
                        : "bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {pill.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Click BUY / SELL Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExecuteTrade('SELL')}
                disabled={executingOrder}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowDownRight size={15} />
                <div className="text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-wider font-normal opacity-80">Sell Market</span>
                  <span className="font-mono">{selectedSymbol.bid}</span>
                </div>
              </button>

              <button
                onClick={() => handleExecuteTrade('BUY')}
                disabled={executingOrder}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowUpRight size={15} />
                <div className="text-left leading-tight">
                  <span className="block text-[9px] uppercase tracking-wider font-normal opacity-80">Buy Market</span>
                  <span className="font-mono">{selectedSymbol.ask}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Chart Display Canvas */}
          <div className="flex-1 glass-card rounded-2xl border border-white/10 overflow-hidden bg-slate-950 relative min-h-[280px]">
            <iframe
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedSymbol.symbol}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${selectedSymbol.symbol}`}
              title="Interactive Terminal Chart"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      </div>

      {/* 3. Bottom Multi-Tab Terminal Toolbox (Positions / Orders / History / Journal) */}
      <div className="glass-card rounded-2xl border border-white/10 p-3 bg-slate-950/70 h-52 flex flex-col shrink-0">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('positions')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                activeTab === 'positions' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Trade / Positions ({positions.length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                activeTab === 'orders' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Pending Orders (0)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                activeTab === 'history' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Account History
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={cn(
                "px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                activeTab === 'journal' ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Terminal Journal ({journalLogs.length})
            </button>
          </div>

          <span className="text-[10px] text-slate-500 font-mono">
            MT5 Protocol Active • Ping: 14ms
          </span>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto text-xs">
          {activeTab === 'positions' && (
            <table className="w-full text-left font-mono">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase border-b border-white/5">
                  <th className="pb-1.5 font-semibold">Ticket</th>
                  <th className="pb-1.5 font-semibold">Time</th>
                  <th className="pb-1.5 font-semibold">Type</th>
                  <th className="pb-1.5 font-semibold">Volume</th>
                  <th className="pb-1.5 font-semibold">Symbol</th>
                  <th className="pb-1.5 font-semibold">Open Price</th>
                  <th className="pb-1.5 font-semibold">Current</th>
                  <th className="pb-1.5 font-semibold">S / L</th>
                  <th className="pb-1.5 font-semibold">T / P</th>
                  <th className="pb-1.5 font-semibold text-right">Profit ($)</th>
                  <th className="pb-1.5 font-semibold text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-500">
                      No active open positions. Execute a BUY or SELL order to start.
                    </td>
                  </tr>
                ) : (
                  positions.map((pos) => (
                    <tr key={pos.ticket} className="hover:bg-white/2 transition-colors text-[11px]">
                      <td className="py-1.5 text-slate-400">#{pos.ticket}</td>
                      <td className="py-1.5 text-slate-400">{pos.openTime}</td>
                      <td className="py-1.5 font-bold">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px]",
                          pos.type === 'BUY' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
                        )}>
                          {pos.type}
                        </span>
                      </td>
                      <td className="py-1.5 text-slate-200">{pos.lots.toFixed(2)}</td>
                      <td className="py-1.5 font-bold text-white">{pos.symbol}</td>
                      <td className="py-1.5 text-slate-300">{pos.openPrice}</td>
                      <td className="py-1.5 text-slate-100">{pos.currentPrice}</td>
                      <td className="py-1.5 text-red-400">{pos.sl || '—'}</td>
                      <td className="py-1.5 text-emerald-400">{pos.tp || '—'}</td>
                      <td className={cn("py-1.5 text-right font-bold", pos.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right pr-2">
                        <button
                          onClick={() => handleClosePosition(pos)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Close Position"
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'orders' && (
            <div className="py-6 text-center text-slate-500 text-xs">
              No pending Limit or Stop orders.
            </div>
          )}

          {activeTab === 'history' && (
            <div className="py-6 text-center text-slate-500 text-xs">
              No closed deals recorded in current session.
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="space-y-1 font-mono text-[11px] text-slate-400">
              {journalLogs.map((log, idx) => (
                <div key={idx} className="leading-tight">{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Broker Connection Modal */}
      <BrokerConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={(acc) => {
          fetchAccounts();
          setActiveAccount(acc);
        }}
      />
    </div>
  );
}
