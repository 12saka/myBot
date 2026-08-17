'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Shield, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';

interface SignalPositionToolProps {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice?: number;
  quantity?: number;
  accountSize?: number;
  riskPercent?: number;
  className?: string;
  compact?: boolean;
}

export function SignalPositionTool({
  symbol,
  direction,
  entryPrice,
  stopLoss,
  takeProfit,
  currentPrice,
  quantity,
  accountSize = 10000,
  riskPercent = 1.0,
  className,
  compact = false
}: SignalPositionToolProps) {
  const isBuy = direction === 'BUY';
  const isForex = symbol.includes('/') || ['EURUSD', 'GBPUSD', 'USDJPY'].includes(symbol.replace('/', ''));
  const isJpy = symbol.includes('JPY');
  const decimals = isForex ? (isJpy ? 3 : 4) : entryPrice > 500 ? 2 : 3;

  const validEntry = Number(entryPrice) || 1;
  const validSL = Number(stopLoss) || validEntry * 0.99;
  const validTP = Number(takeProfit) || validEntry * 1.02;

  // Calculate distances & metrics
  const targetDistance = Math.abs(validTP - validEntry);
  const stopDistance = Math.abs(validEntry - validSL) || 0.0001;

  const targetPct = parseFloat(((targetDistance / validEntry) * 100).toFixed(3));
  const stopPct = parseFloat(((stopDistance / validEntry) * 100).toFixed(3));

  const rrRatio = parseFloat((targetDistance / stopDistance).toFixed(1)) || 2.9;

  // Calculate default position size and dollar amounts matching screenshot
  const calculatedRiskAmount = (accountSize * (riskPercent / 100));
  const calculatedQty = quantity || parseFloat((calculatedRiskAmount / stopDistance).toFixed(3));
  const targetProfitAmount = parseFloat((calculatedQty * targetDistance).toFixed(2));
  const stopRiskAmount = parseFloat((calculatedQty * stopDistance).toFixed(2));

  // Current market progress relative to target
  const livePrice = currentPrice || validEntry;
  const liveDistance = isBuy ? livePrice - validEntry : validEntry - livePrice;
  const liveProfitAmount = parseFloat((calculatedQty * liveDistance).toFixed(2));
  const isInProfit = liveDistance >= 0;

  if (direction === 'WAIT' || validEntry === 0) {
    return (
      <div className={cn("p-4 rounded-xl bg-white/2 border border-white/5 text-center text-xs text-slate-400 font-mono", className)}>
        <p className="text-amber-400 font-bold">Position Tool Inactive (Market Consolidation / Neutral)</p>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950/80 shadow-2xl font-mono select-none", className)}>
      {/* TradingView Grid Simulation Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

      {/* Main Position Tool Structure (Long / Short) */}
      <div className="relative flex flex-col w-full text-xs">
        
        {/* GREEN TARGET BOX (TOP FOR BUY, BOTTOM FOR SELL) */}
        {isBuy ? (
          <div className="relative bg-emerald-500/15 border-t border-dashed border-emerald-400/80 p-3 sm:p-4 min-h-[90px] flex flex-col justify-between transition-all duration-300">
            {/* Top Anchor Handles */}
            <div className="absolute -top-1.5 left-3 w-3 h-3 rounded-xs border-2 border-emerald-400 bg-slate-950" />
            <div className="absolute -top-1.5 right-3 w-3 h-3 rounded-xs border-2 border-emerald-400 bg-slate-950" />

            {/* Target Pill Badge (Matching TradingView reference) */}
            <div className="flex items-center justify-start z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#00a676] text-white text-[11px] font-bold shadow-lg shadow-emerald-950/50">
                <Target size={12} className="shrink-0" />
                <span>
                  Target: {targetDistance.toFixed(decimals)} ({targetPct}%) {validTP.toFixed(decimals)}, Amount: ${targetProfitAmount}
                </span>
              </div>
            </div>

            {/* TradingView Slanted projection ray */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <svg className="w-full h-full opacity-30" preserveAspectRatio="none">
                <line x1="10%" y1="100%" x2="50%" y2="0%" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
            </div>

            {/* Central Risk/Reward Ratio Floating Badge */}
            <div className="self-center my-1 z-10">
              <div className="inline-flex flex-col items-center px-3.5 py-1.5 rounded-lg bg-[#00a676] text-white text-[11px] font-bold shadow-xl border border-emerald-300/30 text-center">
                <span>Closed / Projected PnL: ${targetProfitAmount} | Qty: {calculatedQty}</span>
                <span className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-wide">
                  Risk / Reward Ratio: {rrRatio}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* FOR SELL: RED STOP LOSS ON TOP */
          <div className="relative bg-red-500/15 border-t border-dashed border-red-400/80 p-3 sm:p-4 min-h-[75px] flex flex-col justify-between transition-all duration-300">
            {/* Top Anchor Handles */}
            <div className="absolute -top-1.5 left-3 w-3 h-3 rounded-xs border-2 border-red-400 bg-slate-950" />
            <div className="absolute -top-1.5 right-3 w-3 h-3 rounded-xs border-2 border-red-400 bg-slate-950" />

            {/* Stop Pill Badge */}
            <div className="flex items-center justify-start z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#e63946] text-white text-[11px] font-bold shadow-lg shadow-red-950/50">
                <Shield size={12} className="shrink-0" />
                <span>
                  Stop: {stopDistance.toFixed(decimals)} ({stopPct}%) {validSL.toFixed(decimals)}, Amount: ${stopRiskAmount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* MIDDLE ENTRY ANCHOR DIVIDER LINE */}
        <div className="relative w-full h-0.5 bg-slate-400/60 flex items-center justify-between z-20">
          <div className="w-3.5 h-3.5 -ml-1 rounded-xs border-2 border-slate-200 bg-purple-600 shadow-md flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
          <div className="px-2.5 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/50 text-[10px] text-purple-200 font-bold backdrop-blur-md">
            ENTRY: {validEntry.toFixed(decimals)}
          </div>
          <div className="w-3.5 h-3.5 -mr-1 rounded-xs border-2 border-slate-200 bg-purple-600 shadow-md flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
        </div>

        {/* BOTTOM BOX (STOP FOR BUY, TARGET FOR SELL) */}
        {isBuy ? (
          <div className="relative bg-red-500/15 border-b border-dashed border-red-400/80 p-3 sm:p-4 min-h-[75px] flex flex-col justify-end transition-all duration-300">
            {/* Stop Pill Badge */}
            <div className="flex items-center justify-start z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#e63946] text-white text-[11px] font-bold shadow-lg shadow-red-950/50">
                <Shield size={12} className="shrink-0" />
                <span>
                  Stop: {stopDistance.toFixed(decimals)} ({stopPct}%) {validSL.toFixed(decimals)}, Amount: ${stopRiskAmount}
                </span>
              </div>
            </div>

            {/* Bottom Anchor Handles */}
            <div className="absolute -bottom-1.5 left-3 w-3 h-3 rounded-xs border-2 border-red-400 bg-slate-950" />
            <div className="absolute -bottom-1.5 right-3 w-3 h-3 rounded-xs border-2 border-red-400 bg-slate-950" />
          </div>
        ) : (
          /* FOR SELL: GREEN TARGET ON BOTTOM */
          <div className="relative bg-emerald-500/15 border-b border-dashed border-emerald-400/80 p-3 sm:p-4 min-h-[90px] flex flex-col justify-between transition-all duration-300">
            {/* Central Risk/Reward Ratio Floating Badge */}
            <div className="self-center my-1 z-10">
              <div className="inline-flex flex-col items-center px-3.5 py-1.5 rounded-lg bg-[#00a676] text-white text-[11px] font-bold shadow-xl border border-emerald-300/30 text-center">
                <span>Closed / Projected PnL: ${targetProfitAmount} | Qty: {calculatedQty}</span>
                <span className="text-[10px] text-emerald-100 font-extrabold uppercase tracking-wide">
                  Risk / Reward Ratio: {rrRatio}
                </span>
              </div>
            </div>

            {/* Target Pill Badge */}
            <div className="flex items-center justify-start z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#00a676] text-white text-[11px] font-bold shadow-lg shadow-emerald-950/50">
                <Target size={12} className="shrink-0" />
                <span>
                  Target: {targetDistance.toFixed(decimals)} ({targetPct}%) {validTP.toFixed(decimals)}, Amount: ${targetProfitAmount}
                </span>
              </div>
            </div>

            {/* Bottom Anchor Handles */}
            <div className="absolute -bottom-1.5 left-3 w-3 h-3 rounded-xs border-2 border-emerald-400 bg-slate-950" />
            <div className="absolute -bottom-1.5 right-3 w-3 h-3 rounded-xs border-2 border-emerald-400 bg-slate-950" />
          </div>
        )}
      </div>

      {/* LIVE MARKET MOMENTUM FOOTER */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-white/5 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-slate-400">Live Price:</span>
          <span className="font-bold text-white font-mono">{livePrice.toFixed(decimals)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">P&L Status:</span>
          <span className={cn("font-bold font-mono px-2 py-0.5 rounded text-[10px]", isInProfit ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300")}>
            {isInProfit ? `+${liveProfitAmount > 0 ? liveProfitAmount : '0.00'} (${targetPct}%)` : `-${Math.abs(liveProfitAmount)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
