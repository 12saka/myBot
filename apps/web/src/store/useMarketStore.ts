'use client';
import { create } from 'zustand';

export interface Ticker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePct24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  type: 'crypto' | 'stock' | 'forex' | 'index' | 'commodity';
}

interface MarketState {
  tickers: Ticker[];
  selectedSymbol: string | null;
  watchlist: string[];
  setTickers: (tickers: Ticker[]) => void;
  updateTicker: (symbol: string, data: Partial<Ticker>) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setWatchlist: (watchlist: string[]) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

const getInitialWatchlist = (): string[] => {
  if (typeof window === 'undefined') return ['BTC/USD', 'ETH/USD', 'XAU/USD', 'EUR/USD', 'USD/JPY', 'US100', 'US30'];
  const saved = localStorage.getItem('trademind_watchlist');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return ['BTC/USD', 'ETH/USD', 'XAU/USD', 'EUR/USD', 'USD/JPY', 'US100', 'US30'];
    }
  }
  return ['BTC/USD', 'ETH/USD', 'XAU/USD', 'EUR/USD', 'USD/JPY', 'US100', 'US30'];
};

// Helper function to update watchlist in DB profile preferredAssets
const syncWatchlistToDb = async (list: string[]) => {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('trademind_token');
  if (!token) return;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    await fetch(`${apiUrl}/api/v2/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ preferredAssets: list.join(',') })
    });
  } catch (err) {
    console.error('Failed to sync watchlist to database:', err);
  }
};

export const useMarketStore = create<MarketState>()((set) => ({
  tickers: [],
  selectedSymbol: null,
  watchlist: getInitialWatchlist(),
  setTickers: (tickers) => set({ tickers }),
  updateTicker: (symbol, data) =>
    set((s) => {
      const idx = s.tickers.findIndex((t) => t.symbol === symbol);
      if (idx >= 0) {
        const next = [...s.tickers];
        next[idx] = { ...next[idx], ...data };
        return { tickers: next };
      } else {
        const newTicker: Ticker = {
          symbol,
          name: data.name || symbol,
          price: data.price || 0,
          change24h: data.change24h || 0,
          changePct24h: data.changePct24h || 0,
          volume24h: data.volume24h || 0,
          marketCap: data.marketCap || 0,
          high24h: data.high24h || (data.price ? data.price * 1.005 : 0),
          low24h: data.low24h || (data.price ? data.price * 0.995 : 0),
          type: data.type || 'crypto'
        };
        return { tickers: [...s.tickers, newTicker] };
      }
    }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setWatchlist: (watchlist) => set({ watchlist }),
  addToWatchlist: (symbol) =>
    set((s) => {
      const next = [...new Set([...s.watchlist, symbol])];
      if (typeof window !== 'undefined') {
        localStorage.setItem('trademind_watchlist', JSON.stringify(next));
      }
      syncWatchlistToDb(next);
      return { watchlist: next };
    }),
  removeFromWatchlist: (symbol) =>
    set((s) => {
      const next = s.watchlist.filter((w) => w !== symbol);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trademind_watchlist', JSON.stringify(next));
      }
      syncWatchlistToDb(next);
      return { watchlist: next };
    }),
}));
