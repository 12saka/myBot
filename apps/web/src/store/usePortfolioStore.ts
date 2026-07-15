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
  type: 'crypto' | 'stock' | 'forex' | 'index' | 'commodity';
}

interface PortfolioState {
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: Position[];
  performanceHistory: { date: string; value: number }[];
  setPortfolio: (data: Partial<Omit<PortfolioState, 'setPortfolio'>>) => void;
}

export const usePortfolioStore = create<PortfolioState>()((set) => ({
  totalValue: 0.0,
  totalPnl: 0.0,
  totalPnlPct: 0.0,
  positions: [],
  performanceHistory: [],
  setPortfolio: (data) => set((state) => ({ ...state, ...data })),
}));
