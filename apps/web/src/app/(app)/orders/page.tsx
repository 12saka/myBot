'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, Plus, ArrowUpRight, ArrowDownLeft,
  X, CheckCircle2, Clock, AlertTriangle, RefreshCw,
  TrendingUp, BarChart3, ChevronDown, Sparkles
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'react-hot-toast';
import { apiFetch, normalizeMarketSymbol, mapTicker } from '@/lib/api';
import { useMarketStore } from '@/store/useMarketStore';

interface Order {
  id: string;
  symbol: string;
  type: 'Market' | 'Limit' | 'Stop Loss';
  side: 'Buy' | 'Sell';
  status: 'Filled' | 'Pending' | 'Cancelled' | 'Rejected';
  quantity: number;
  price: number;
  totalValue: number;
  timestamp: string;
}

const mapOrder = (order: any): Order => {
  const executionPrice = Number(order.trades?.[0]?.executionPrice ?? order.price ?? 0);
  const quantity = Number(order.quantity ?? 0);

  return {
    id: order.id,
    symbol: normalizeMarketSymbol(order.symbol),
    type: order.type === 'LIMIT' ? 'Limit' : order.type === 'STOP_LOSS' ? 'Stop Loss' : 'Market',
    side: order.direction === 'SELL' ? 'Sell' : 'Buy',
    status: order.status === 'FILLED' ? 'Filled' : order.status === 'CANCELLED' ? 'Cancelled' : order.status === 'REJECTED' ? 'Rejected' : 'Pending',
    quantity,
    price: executionPrice,
    totalValue: quantity * executionPrice,
    timestamp: new Date(order.createdAt).toLocaleString(),
  };
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'filled' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState<'all' | 'crypto' | 'forex' | 'stocks'>('all');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { tickers, setTickers } = useMarketStore();

  // New Order Form States
  const [newOrder, setNewOrder] = useState({
    symbol: 'BTC/USD',
    side: 'Buy' as 'Buy' | 'Sell',
    type: 'Limit' as 'Market' | 'Limit' | 'Stop Loss',
    quantity: 0.1,
    price: 64200,
  });

  const [orders, setOrders] = useState<Order[]>([]);

  const fetchTickers = async () => {
    try {
      const rawTickers = await apiFetch<any[]>('/api/v2/markets/tickers');
      const liveTickers = rawTickers.map(mapTicker);
      setTickers(liveTickers);
    } catch (err) {
      console.error('[OrdersPage] Failed to fetch tickers:', err);
    }
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiFetch<any[]>('/api/v2/portfolio/orders');
      setOrders(data.map(mapOrder));
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load live order history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchOrders(), fetchTickers()]);
  }, []);

  const currentTicker = useMemo(() => {
    const clean = newOrder.symbol.replace('/USD', '').toUpperCase();
    return tickers.find((ticker) => {
      const tickerSymbol = ticker.symbol.toUpperCase();
      return tickerSymbol === clean || tickerSymbol === `${clean}/USD` || tickerSymbol.replace('/USD', '') === clean;
    });
  }, [newOrder.symbol, tickers]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrder.quantity <= 0 || (newOrder.type !== 'Market' && newOrder.price <= 0)) {
      toast.error('Please enter valid quantity and price metrics.');
      return;
    }

    setIsSubmitting(true);
    try {
      const symbol = newOrder.symbol.replace('/USD', '').toUpperCase();
      await apiFetch('/api/v2/portfolio/order', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          direction: newOrder.side === 'Sell' ? 'SELL' : 'BUY',
          type: newOrder.type === 'Limit' ? 'LIMIT' : 'MARKET',
          quantity: newOrder.quantity,
          price: newOrder.type === 'Market' ? undefined : newOrder.price,
        }),
      });

      setIsPlacingOrder(false);
      toast.success(`Successfully submitted ${newOrder.side} order for ${newOrder.symbol}.`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Unable to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (id: string) => {
    try {
      await apiFetch(`/api/v2/portfolio/order/${id}/cancel`, { method: 'PATCH' });
      toast.success(`Order ${id} has been cancelled.`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Unable to cancel order.');
    }
  };

  // Filtering Logic
  const filteredOrders = orders.filter(order => {
    // Status Filter
    if (activeTab === 'pending' && order.status !== 'Pending') return false;
    if (activeTab === 'filled' && order.status !== 'Filled') return false;
    if (activeTab === 'cancelled' && order.status !== 'Cancelled') return false;

    // Search Query Filter
    if (searchQuery && !order.symbol.toLowerCase().includes(searchQuery.toLowerCase()) && !order.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Find the ticker in market store to check its actual type
    const cleanSym = order.symbol.replace('/USD', '').toUpperCase();
    const ticker = tickers.find(t => t.symbol.toUpperCase().replace('/USD', '') === cleanSym);
    
    if (selectedAssetType !== 'all') {
      if (!ticker) {
        // Fallback checks if ticker list not loaded yet
        if (selectedAssetType === 'crypto' && !['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(cleanSym)) return false;
        if (selectedAssetType === 'stocks' && !['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'].includes(cleanSym)) return false;
        if (selectedAssetType === 'forex' && !['EUR/USD', 'GBP/USD', 'USD/JPY', 'GOLD', 'OIL', 'US30', 'US100', 'SPX500', 'DAX40'].includes(cleanSym)) return false;
      } else {
        if (selectedAssetType === 'crypto' && ticker.type !== 'crypto') return false;
        if (selectedAssetType === 'stocks' && ticker.type !== 'stock') return false;
        if (selectedAssetType === 'forex' && !['forex', 'commodity', 'index'].includes(ticker.type)) return false;
      }
    }

    return true;
  });

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader
        title="Order History"
        subtitle="Monitor current pending entries, executed signals, manual orders, and historical trade logs."
        icon={BarChart3}
      >
        <button
          onClick={fetchOrders}
          className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <button
          onClick={() => setIsPlacingOrder(true)}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
        >
          <Plus size={14} /> New Order
        </button>
      </PageHeader>

      {/* --- Filter Controls Tape --- */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-950/20 border border-white/5 p-4 rounded-2xl glass-card text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Symbol/ID..."
              className="input-glass rounded-xl pl-9 pr-4 py-2 w-[180px]"
            />
          </div>

          {/* Asset Type Select */}
          <select
            value={selectedAssetType}
            onChange={e => setSelectedAssetType(e.target.value as any)}
            className="input-glass rounded-xl px-3 py-2 bg-slate-950"
          >
            <option value="all">All Asset Classes</option>
            <option value="crypto">Cryptocurrencies</option>
            <option value="forex">Forex / Metals</option>
            <option value="stocks">Stocks / Equities</option>
          </select>
        </div>

        {/* Tab Filters */}
        <div className="flex bg-white/5 border border-white/5 p-0.5 rounded-xl">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending', label: 'Pending' },
            { id: 'filled', label: 'Filled' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Orders Data Table --- */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          {errorMessage ? (
            <div className="py-12 text-center text-xs text-rose-300">
              <AlertTriangle size={24} className="mx-auto mb-2" />
              {errorMessage}
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
              Loading live order history...
            </div>
          ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-5">Order ID</th>
                <th className="py-4 px-4">Timestamp</th>
                <th className="py-4 px-4">Asset Symbol</th>
                <th className="py-4 px-4">Type</th>
                <th className="py-4 px-4">Side</th>
                <th className="py-4 px-4">Quantity</th>
                <th className="py-4 px-4">Price</th>
                <th className="py-4 px-4 text-right">Total Value</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              <AnimatePresence mode="popLayout">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <FileText size={24} className="mx-auto mb-2 opacity-35" />
                      No matching transaction orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-white/2 transition-colors"
                    >
                      <td className="py-4 px-5 font-mono text-slate-400">{order.id}</td>
                      <td className="py-4 px-4 text-slate-500 font-mono">{order.timestamp}</td>
                      <td className="py-4 px-4 font-bold text-slate-200">{order.symbol}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-semibold text-slate-400">
                          {order.type}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-bold flex items-center gap-1 ${order.side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {order.side === 'Buy' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          {order.side}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-semibold">{order.quantity}</td>
                      <td className="py-4 px-4 font-mono">${order.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 px-4 text-right font-bold text-slate-200 font-mono">
                        ${order.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={
                          order.status === 'Filled' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                          order.status === 'Pending' ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400 animate-pulse' :
                          order.status === 'Cancelled' ? 'bg-slate-500/15 border border-slate-500/30 text-slate-400' :
                          'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                        }>
                          {order.status === 'Filled' && 'Filled'}
                          {order.status === 'Pending' && 'Pending'}
                          {order.status === 'Cancelled' && 'Cancelled'}
                          {order.status === 'Rejected' && 'Rejected'}
                        </Badge>
                      </td>
                      <td className="py-4 px-5 text-right">
                        {order.status === 'Pending' ? (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* --- Floating Order Placement Modal --- */}
      <AnimatePresence>
        {isPlacingOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-panel border border-purple-500/20 bg-slate-950 p-6 rounded-2xl shadow-2xl relative"
            >
              <button
                onClick={() => setIsPlacingOrder(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>

              <h3 className="text-lg font-display font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Place Custom Order
              </h3>
              <p className="text-[10px] text-slate-400 mb-6">Create a manual entry that will bypass automated AI routing triggers.</p>

              <form onSubmit={handlePlaceOrder} className="space-y-4 text-xs">
                {/* Side Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewOrder({ ...newOrder, side: 'Buy' })}
                    className={`py-2.5 rounded-xl font-bold border transition-all ${
                      newOrder.side === 'Buy'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'border-white/5 bg-white/2 text-slate-400'
                    }`}
                  >
                    Buy (Long)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewOrder({ ...newOrder, side: 'Sell' })}
                    className={`py-2.5 rounded-xl font-bold border transition-all ${
                      newOrder.side === 'Sell'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                        : 'border-white/5 bg-white/2 text-slate-400'
                    }`}
                  >
                    Sell (Short)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Symbol */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Asset Symbol</label>
                    <select
                      value={newOrder.symbol}
                      onChange={e => setNewOrder({ ...newOrder, symbol: e.target.value })}
                      className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900"
                    >
                      {tickers.map((ticker) => (
                        <option key={ticker.symbol} value={ticker.symbol}>
                          {ticker.symbol} ({ticker.type}) - ${ticker.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Order Type */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Order Type</label>
                    <select
                      value={newOrder.type}
                      onChange={e => setNewOrder({ ...newOrder, type: e.target.value as any })}
                      className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900"
                    >
                      <option value="Limit">Limit Order</option>
                      <option value="Market">Market Order</option>
                      <option value="Stop Loss">Stop Loss</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Quantity */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Volume Size</label>
                    <input
                      type="number"
                      step="any"
                      value={newOrder.quantity}
                      onChange={e => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })}
                      className="w-full input-glass rounded-xl px-3 py-2.5"
                      required
                    />
                  </div>

                  {/* Limit Price */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">
                      {newOrder.type === 'Market' ? 'Market Price' : 'Execution Price ($)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newOrder.type === 'Market' ? '' : newOrder.price}
                      onChange={e => setNewOrder({ ...newOrder, price: Number(e.target.value) })}
                      disabled={newOrder.type === 'Market'}
                      placeholder={newOrder.type === 'Market' ? `Best rate: ${currentTicker?.price ?? 'live'}` : '64200'}
                      className="w-full input-glass rounded-xl px-3 py-2.5 disabled:opacity-55 disabled:cursor-not-allowed"
                      required={newOrder.type !== 'Market'}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : 'Place Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
