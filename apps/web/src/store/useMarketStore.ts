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

const normalizeSym = (sym: string): string => {
  const u = sym.toUpperCase().trim();
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(u)) return `${u}/USD`;
  if (u === 'GOLD') return 'XAU/USD';
  return u;
};

export const useMarketStore = create<MarketState>()((set) => ({
  tickers: [],
  selectedSymbol: null,
  watchlist: getInitialWatchlist(),
  setTickers: (rawTickers) =>
    set(() => {
      const map = new Map<string, Ticker>();
      for (const t of rawTickers) {
        const norm = normalizeSym(t.symbol);
        map.set(norm, { ...t, symbol: norm });
      }
      return { tickers: Array.from(map.values()) };
    }),
  updateTicker: (rawSymbol, data) =>
    set((s) => {
      const symbol = normalizeSym(rawSymbol);
      const idx = s.tickers.findIndex((t) => normalizeSym(t.symbol) === symbol);
      if (idx >= 0) {
        const existing = s.tickers[idx];
        const updated: Ticker = { ...existing, symbol };

        if (typeof data.price === 'number' && !isNaN(data.price) && data.price > 0) {
          updated.price = data.price;
        }
        if (typeof data.change24h === 'number' && !isNaN(data.change24h)) {
          updated.change24h = data.change24h;
        }
        if (typeof data.changePct24h === 'number' && !isNaN(data.changePct24h)) {
          updated.changePct24h = data.changePct24h;
        }
        if (typeof data.volume24h === 'number' && !isNaN(data.volume24h) && data.volume24h > 0) {
          updated.volume24h = data.volume24h;
        }
        if (typeof data.high24h === 'number' && !isNaN(data.high24h) && data.high24h > 0) {
          updated.high24h = Math.max(existing.high24h || 0, data.high24h);
        }
        if (typeof data.low24h === 'number' && !isNaN(data.low24h) && data.low24h > 0) {
          updated.low24h = existing.low24h > 0 ? Math.min(existing.low24h, data.low24h) : data.low24h;
        }
        if (data.name) updated.name = data.name;
        if (data.type) updated.type = data.type;

        // Skip re-render if nothing meaningful changed
        if (
          existing.price === updated.price &&
          existing.changePct24h === updated.changePct24h
        ) {
          return s;
        }

        const next = [...s.tickers];
        next[idx] = updated;
        return { tickers: next };
      } else {
        const price = (typeof data.price === 'number' && !isNaN(data.price)) ? data.price : 0;
        const newTicker: Ticker = {
          symbol,
          name: data.name || symbol,
          price,
          change24h: (typeof data.change24h === 'number' && !isNaN(data.change24h)) ? data.change24h : 0,
          changePct24h: (typeof data.changePct24h === 'number' && !isNaN(data.changePct24h)) ? data.changePct24h : 0,
          volume24h: (typeof data.volume24h === 'number' && !isNaN(data.volume24h)) ? data.volume24h : 0,
          marketCap: (typeof data.marketCap === 'number' && !isNaN(data.marketCap)) ? data.marketCap : 0,
          high24h: (typeof data.high24h === 'number' && !isNaN(data.high24h)) ? data.high24h : (price ? price * 1.005 : 0),
          low24h: (typeof data.low24h === 'number' && !isNaN(data.low24h)) ? data.low24h : (price ? price * 0.995 : 0),
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
