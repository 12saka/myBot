'use client';
import { create } from 'zustand';

export interface Position {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  allocation: number;
  type: 'crypto' | 'stock' | 'forex';
}

interface PortfolioState {
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: Position[];
  performanceHistory: { date: string; value: number }[];
}

export const usePortfolioStore = create<PortfolioState>()(() => ({
  totalValue: 48_420.50,
  totalPnl: 6_320.40,
  totalPnlPct: 15.04,
  positions: [
    { id: 'p1', symbol: 'BTC/USD', name: 'Bitcoin',    quantity: 0.42,  avgPrice: 58200, currentPrice: 64318, pnl: 2569.56, pnlPct: 10.51, allocation: 55.7, type: 'crypto' },
    { id: 'p2', symbol: 'ETH/USD', name: 'Ethereum',   quantity: 4.8,   avgPrice: 2980,  currentPrice: 3182,  pnl: 969.60,  pnlPct: 6.78,  allocation: 31.5, type: 'crypto' },
    { id: 'p3', symbol: 'AAPL',    name: 'Apple Inc.', quantity: 20,    avgPrice: 182.4, currentPrice: 197.34,pnl: 298.80,  pnlPct: 8.19,  allocation: 8.1,  type: 'stock'  },
    { id: 'p4', symbol: 'NVDA',    name: 'NVIDIA',     quantity: 5,     avgPrice: 790,   currentPrice: 875.20,pnl: 426.00,  pnlPct: 10.78, allocation: 9.0,  type: 'stock'  },
    { id: 'p5', symbol: 'SOL/USD', name: 'Solana',     quantity: 18,    avgPrice: 158,   currentPrice: 184.72,pnl: 480.96,  pnlPct: 16.91, allocation: 6.9,  type: 'crypto' },
  ],
  performanceHistory: [
    { date: '2026-01-01', value: 38000 },
    { date: '2026-02-01', value: 41200 },
    { date: '2026-03-01', value: 39800 },
    { date: '2026-04-01', value: 44100 },
    { date: '2026-05-01', value: 46300 },
    { date: '2026-06-01', value: 45200 },
    { date: '2026-07-01', value: 48420 },
  ],
}));
