'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  Info,
  Maximize2,
  RefreshCw,
  SlidersHorizontal,
  Compass,
  Zap,
  Activity
} from 'lucide-react';
import { TradingViewWidget } from '@/components/charts/TradingViewWidget';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GoldAnnotationsResponse, GoldChartAnnotation } from '@trademind/shared';

interface GoldAnnotatedChartProps {
  symbol?: string;
  defaultTimeframe?: '15m' | '1h' | '4h';
  height?: number | string;
  onSelectAnnotation?: (annotation: GoldChartAnnotation) => void;
}

export function GoldAnnotatedChart({
  symbol = 'GOLD',
  defaultTimeframe = '15m',
  height = 540,
  onSelectAnnotation
}: GoldAnnotatedChartProps) {
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h'>(defaultTimeframe);
  const [data, setData] = useState<GoldAnnotationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GoldChartAnnotation | null>(null);

  // Layer Visibility Controls (No clutter, user has full mastery)
  const [layers, setLayers] = useState({
    orderBlocks: true,
    fvgs: true,
    bosChoch: true,
    liquidity: true,
    tradeLevels: true,
  });

  const fetchAnnotations = async () => {
    try {
      const res = await apiFetch<GoldAnnotationsResponse>(`/api/v2/signals/gold/annotations?timeframe=${timeframe}`);
      if (res && res.annotations) {
        setData(res);
      }
    } catch (e) {
      console.error('[GoldAnnotatedChart] failed to fetch annotations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnotations();
    const interval = setInterval(fetchAnnotations, 20000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tradeLevels = data?.tradeLevels;
  const annotations = (data?.annotations || []).filter(a => {
    if (!layers.orderBlocks && (a.type === 'DEMAND_ZONE' || a.type === 'SUPPLY_ZONE' || a.type === 'ORDER_BLOCK')) return false;
    if (!layers.fvgs && a.type === 'FVG') return false;
    if (!layers.bosChoch && (a.type === 'BOS' || a.type === 'CHOCH' || a.type === 'MSS')) return false;
    if (!layers.liquidity && (a.type === 'LIQUIDITY_POOL' || a.type === 'TURTLE_SOUP' || a.type === 'LIQUIDITY_SWEEP')) return false;
    if (!layers.tradeLevels && (a.type.includes('LEVEL') || a.type.includes('PROFIT') || a.type === 'STOP_LOSS')) return false;
    return true;
  });

  const p = data?.currentPrice || 0;

  return (
    <div className="w-full flex flex-col rounded-2xl bg-[#0B0F17] border border-amber-500/25 overflow-hidden shadow-2xl relative">
      {/* 1. Institutional Bullion Chart Header */}
      <div className="p-3 sm:p-4 bg-gradient-to-r from-black/80 via-[#0F172A]/90 to-black/80 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-amber-500/20">
            SMC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Institutional Analysis & Liquidity Zones
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Spot: <strong className="font-mono text-white">${p.toFixed(2)}</strong></span>
              <span>•</span>
              <span className="text-amber-300">{annotations.length} Active Annotations</span>
            </div>
          </div>
        </div>

        {/* Timeframe selector & layer toggles */}
        <div className="flex items-center gap-2">
          {/* Timeframe Buttons */}
          <div className="flex items-center rounded-xl bg-black/60 p-1 border border-white/10">
            {(['15m', '1h', '4h'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer",
                  timeframe === tf
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAnnotations}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 border border-white/10 transition-colors cursor-pointer"
            title="Refresh Annotations"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin text-amber-400")} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Annotation Toggle Strip (Zero Clutter, Easy Filtering) */}
      <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex flex-wrap items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-slate-400 uppercase font-bold text-[10px] mr-1 flex items-center gap-1">
          <SlidersHorizontal size={11} className="text-amber-400" />
          Filter:
        </span>

        <button
          onClick={() => toggleLayer('orderBlocks')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
            layers.orderBlocks
              ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
              : "bg-white/5 text-slate-500 border-white/5 line-through opacity-60"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Order Blocks (OB)
        </button>

        <button
          onClick={() => toggleLayer('fvgs')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
            layers.fvgs
              ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
              : "bg-white/5 text-slate-500 border-white/5 line-through opacity-60"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          FVGs (Gaps)
        </button>

        <button
          onClick={() => toggleLayer('bosChoch')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
            layers.bosChoch
              ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
              : "bg-white/5 text-slate-500 border-white/5 line-through opacity-60"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          BOS & CHoCH
        </button>

        <button
          onClick={() => toggleLayer('liquidity')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
            layers.liquidity
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
              : "bg-white/5 text-slate-500 border-white/5 line-through opacity-60"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Liquidity & Sweeps
        </button>

        <button
          onClick={() => toggleLayer('tradeLevels')}
          className={cn(
            "px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
            layers.tradeLevels
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              : "bg-white/5 text-slate-500 border-white/5 line-through opacity-60"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Entry / SL / TP Levels
        </button>
      </div>

      {/* 3. Live High-Performance Chart Display */}
      <div className="relative w-full" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <TradingViewWidget
          symbol="GOLD"
          interval={timeframe === '4h' ? '240' : timeframe === '1h' ? '60' : '15'}
          height="100%"
          entryPrice={tradeLevels?.direction !== 'WAIT' ? tradeLevels?.entry || undefined : undefined}
          stopLoss={tradeLevels?.direction !== 'WAIT' ? tradeLevels?.stopLoss || undefined : undefined}
          tp1={tradeLevels?.direction !== 'WAIT' ? tradeLevels?.takeProfit1 || undefined : undefined}
          tp2={tradeLevels?.direction !== 'WAIT' ? tradeLevels?.takeProfit2 || undefined : undefined}
        />

        {/* Floating Structural Heads-Up Display (Overlay matching uploaded charts) */}
        <div className="absolute top-12 left-3 z-10 max-w-xs space-y-2 pointer-events-none sm:pointer-events-auto">
          {tradeLevels && tradeLevels.entry && tradeLevels.direction !== 'WAIT' && (
            <div className="px-3 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-amber-500/30 text-xs shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-bold uppercase text-[10px] text-amber-400">
                  {tradeLevels.orderType} Setup
                </span>
                <span className={cn(
                  "font-bold font-mono px-1.5 py-0.2 rounded text-[10px]",
                  tradeLevels.direction === 'BUY' ? "text-emerald-400 bg-emerald-500/20" : "text-rose-400 bg-rose-500/20"
                )}>
                  {tradeLevels.direction}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                <div className="text-slate-400">Entry: <span className="text-white font-bold">${tradeLevels.entry.toFixed(2)}</span></div>
                <div className="text-slate-400">SL: <span className="text-rose-400 font-bold">${tradeLevels.stopLoss?.toFixed(2)}</span></div>
                <div className="text-slate-400">TP1: <span className="text-emerald-400 font-bold">${tradeLevels.takeProfit1?.toFixed(2)}</span></div>
                <div className="text-slate-400">TP2: <span className="text-emerald-400 font-bold">${tradeLevels.takeProfit2?.toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Detected Zones & Patterns Strip (Below Chart) */}
      <div className="p-4 bg-gradient-to-t from-black via-[#0B0F17] to-transparent border-t border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Compass size={14} className="text-amber-400" />
            Detected Institutional Zones & Structure ({timeframe.toUpperCase()})
          </span>
          <span className="text-[11px] text-slate-400">
            Click any zone to inspect validation thesis
          </span>
        </div>

        {annotations.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 text-center text-xs text-slate-400">
            No active unmitigated zones detected on this timeframe. Switch timeframe or await session open.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {annotations.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const isDemand = item.type === 'DEMAND_ZONE' || item.direction === 'BULLISH';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    if (onSelectAnnotation) onSelectAnnotation(item);
                  }}
                  className={cn(
                    "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between",
                    isSelected
                      ? "bg-amber-500/20 border-amber-500 shadow-md shadow-amber-500/10"
                      : "bg-black/40 border-white/5 hover:border-amber-500/30 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white truncate pr-2">
                      {item.label}
                    </span>
                    <span className={cn(
                      "text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase shrink-0",
                      item.status === 'CONFIRMED' || item.status === 'ACTIVE'
                        ? "bg-emerald-500/20 text-emerald-400"
                        : item.status === 'SWEPT'
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-cyan-500/20 text-cyan-300"
                    )}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 truncate">
                      {item.upperPrice && item.lowerPrice 
                        ? `$${item.lowerPrice.toFixed(2)} - $${item.upperPrice.toFixed(2)}`
                        : `$${item.price.toFixed(2)}`
                      }
                    </span>
                    <span className={cn(
                      "font-bold text-[10px]",
                      isDemand ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {item.direction}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Selected Zone Detailed Inspection Card */}
        {selectedItem && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs animate-in fade-in">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedItem.label}</span>
                <span className="font-mono text-amber-300 font-bold">
                  {selectedItem.upperPrice && selectedItem.lowerPrice 
                    ? `[$${selectedItem.lowerPrice.toFixed(2)} – $${selectedItem.upperPrice.toFixed(2)}]`
                    : `@ $${selectedItem.price.toFixed(2)}`}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {selectedItem.description}
              </p>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-slate-400 hover:text-white px-2 py-1 rounded bg-black/40 text-[10px] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
