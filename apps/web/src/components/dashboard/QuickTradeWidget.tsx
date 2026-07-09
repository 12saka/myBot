'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, RefreshCw, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useMarketStore } from '@/store/useMarketStore';
import { Badge } from '@/components/ui/Badge';

interface QuickTradeWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
  defaultDirection?: 'BUY' | 'SELL';
  onOrderSuccess?: () => void;
  aiSignal?: {
    entry: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
    direction: 'BUY' | 'SELL';
    strategy: string;
    confidence: number;
  };
}

export function QuickTradeWidget({
  isOpen,
  onClose,
  defaultSymbol = 'BTC',
  defaultDirection = 'BUY',
  onOrderSuccess,
  aiSignal
}: QuickTradeWidgetProps) {
  const { tickers } = useMarketStore();
  const cleanDefault = defaultSymbol.replace('/USD', '').toUpperCase();

  const [symbol, setSymbol] = useState(cleanDefault);
  const [direction, setDirection] = useState<'BUY' | 'SELL'>(defaultDirection);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Switch between AI signal parameters and Manual trade parameters
  const [tradeMode, setTradeMode] = useState<'MANUAL' | 'AI'>(aiSignal ? 'AI' : 'MANUAL');

  // Load defaults if changing props
  useEffect(() => {
    setSymbol(cleanDefault);
    setDirection(defaultDirection);
    setTradeMode(aiSignal ? 'AI' : 'MANUAL');
  }, [cleanDefault, defaultDirection, aiSignal]);

  // Find live price from market store tickers list
  const activeTicker = tickers.find(
    (t) =>
      t.symbol.toUpperCase() === symbol.toUpperCase() ||
      t.symbol.toUpperCase() === `${symbol.toUpperCase()}/USD` ||
      t.symbol.toUpperCase().replace('/USD', '') === symbol.toUpperCase()
  );

  const currentPrice = activeTicker ? activeTicker.price : 100.0;

  // Compute total cost based on execution mode
  const executionPrice = tradeMode === 'AI' && aiSignal
    ? aiSignal.entry
    : (orderType === 'LIMIT' ? Number(limitPrice) || currentPrice : currentPrice);

  const estimatedCost = (Number(quantity) || 0) * executionPrice;

  // Handle order submissions
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }

    if (tradeMode === 'MANUAL' && orderType === 'LIMIT' && (!limitPrice || isNaN(Number(limitPrice)) || Number(limitPrice) <= 0)) {
      toast.error('Please enter a valid limit price.');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('trademind_token');

    try {
      // The gateway stores crypto market data as BTC/ETH/SOL, while the UI can display BTC/USD.
      const backendSymbol = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(symbol)
        ? symbol
        : symbol;

      const oType = tradeMode === 'AI' ? 'LIMIT' : orderType;
      const payload: any = {
        symbol: backendSymbol,
        direction: tradeMode === 'AI' && aiSignal ? aiSignal.direction : direction,
        type: oType,
        quantity: Number(quantity),
        price: tradeMode === 'AI' && aiSignal ? aiSignal.entry : (orderType === 'LIMIT' ? Number(limitPrice) : undefined),
      };

      if (oType !== 'MARKET') {
        payload.stopLoss = tradeMode === 'AI' && aiSignal ? aiSignal.stopLoss : undefined;
        payload.takeProfit = tradeMode === 'AI' && aiSignal ? aiSignal.tp1 : undefined;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v2/portfolio/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to execute trade.');
      }

      toast.success(
        `Order Filled: ${data.direction} ${quantity} ${symbol} @ $${data.executionPrice.toLocaleString()} (Total: $${data.totalCost.toLocaleString()})`
      );

      setQuantity('');
      setLimitPrice('');
      if (onOrderSuccess) onOrderSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Network connection refused.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            className="relative w-full max-w-md overflow-hidden glass-card rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white text-sm">Quick Trade Routing</h3>
                  <p className="text-[10px] text-slate-500">Real-time parameters execution</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Switch Mode Tab if AI signal is passed */}
            {aiSignal && (
              <div className="flex bg-white/5 border border-white/5 rounded-xl p-1 mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTradeMode('AI')}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tradeMode === 'AI' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu size={12} /> AI Signal Params
                </button>
                <button
                  type="button"
                  onClick={() => setTradeMode('MANUAL')}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    tradeMode === 'MANUAL' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manual Trade
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {tradeMode === 'AI' && aiSignal ? (
                /* AI Signals Mode Details Display */
                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-2xl border border-purple-500/25 bg-purple-500/5 space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] text-purple-400 uppercase tracking-wider font-bold">
                      <span>Applying AI Targets</span>
                      <Badge variant="neutral">{aiSignal.strategy}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 text-sm font-black">{symbol}</span>
                      <Badge variant={aiSignal.direction === 'BUY' ? 'buy' : 'sell'}>
                        {aiSignal.direction}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-1.5 border-t border-white/5">
                      <div>Entry price: <span className="font-bold text-white">${aiSignal.entry.toLocaleString()}</span></div>
                      <div>Stop Loss: <span className="font-bold text-red-400">${aiSignal.stopLoss.toLocaleString()}</span></div>
                      <div>Target 1: <span className="font-bold text-emerald-400">${aiSignal.tp1.toLocaleString()}</span></div>
                      <div>Target 2: <span className="font-bold text-emerald-300">${aiSignal.tp2.toLocaleString()}</span></div>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Trade Quantity</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full input-glass rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[10px] text-slate-500">{symbol}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Manual Trading Mode Inputs */
                <div className="space-y-4">
                  {/* Asset selection */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Asset Symbol</label>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="w-full input-glass rounded-xl px-3 py-2.5 bg-slate-900 border border-white/8 text-white focus:outline-none"
                    >
                      {tickers.map((t) => (
                        <option key={t.symbol} value={t.symbol.replace('/USD', '')}>
                          {t.symbol} - {t.name} (Current: ${t.price.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* BUY / SELL Switch */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Order Direction</label>
                    <div className="flex bg-white/5 border border-white/5 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setDirection('BUY')}
                        className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          direction === 'BUY'
                            ? 'bg-emerald-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <TrendingUp size={14} /> BUY
                      </button>
                      <button
                        type="button"
                        onClick={() => setDirection('SELL')}
                        className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          direction === 'SELL'
                            ? 'bg-rose-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <TrendingDown size={14} /> SELL
                      </button>
                    </div>
                  </div>

                  {/* Order Type Tabs */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Execution Type</label>
                    <div className="flex bg-white/3 border border-white/5 rounded-xl p-1">
                      {(['MARKET', 'LIMIT'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setOrderType(type)}
                          className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                            orderType === type ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity and Limit Price Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Quantity</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0.00"
                          className="w-full input-glass rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[10px] text-slate-500">{symbol}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                        {orderType === 'LIMIT' ? 'Limit Price' : 'Est. Price'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          disabled={orderType === 'MARKET'}
                          required={orderType === 'LIMIT'}
                          value={orderType === 'LIMIT' ? limitPrice : currentPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          className="w-full input-glass rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-200 focus:outline-none disabled:opacity-50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-[10px] text-slate-500">USD</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimations summary card */}
              <div className="p-3 rounded-xl border border-white/5 bg-white/2 space-y-2">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Estimated Total cost:</span>
                  <span className="font-bold text-white font-mono">${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Commission Fee (0.1%):</span>
                  <span>${(estimatedCost * 0.001).toFixed(2)}</span>
                </div>
              </div>

              {/* Execution warning / info banner */}
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[9px] text-slate-500 leading-normal flex items-start gap-1.5">
                <ShieldAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Order will pass through automated risk rules. Rejection triggers if drawdown limits are breached.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                  (tradeMode === 'AI' && aiSignal ? aiSignal.direction : direction) === 'BUY'
                    ? 'btn-emerald border-emerald-500/20 text-white'
                    : 'btn-rose border-rose-500/20 text-white'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <>
                    <Zap size={14} /> Execute {(tradeMode === 'AI' && aiSignal ? aiSignal.direction : direction) === 'BUY' ? 'Buy Long' : 'Sell Short'}
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
