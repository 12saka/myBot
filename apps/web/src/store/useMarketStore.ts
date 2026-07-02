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
  type: 'crypto' | 'stock' | 'forex';
}

interface MarketState {
  tickers: Ticker[];
  selectedSymbol: string | null;
  watchlist: string[];
  setTickers: (tickers: Ticker[]) => void;
  updateTicker: (symbol: string, data: Partial<Ticker>) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
}

const MOCK_TICKERS: Ticker[] = [
  { symbol: 'BTC/USD',  name: 'Bitcoin',    price: 64318.50, change24h: 1240.30, changePct24h: 1.97,  volume24h: 28.4e9, marketCap: 1.26e12, high24h: 65200, low24h: 62900, type: 'crypto' },
  { symbol: 'ETH/USD',  name: 'Ethereum',   price: 3182.40,  change24h: -54.20,  changePct24h: -1.67, volume24h: 15.2e9, marketCap: 382e9,  high24h: 3290,  low24h: 3120,  type: 'crypto' },
  { symbol: 'SOL/USD',  name: 'Solana',     price: 184.72,   change24h: 8.14,    changePct24h: 4.61,  volume24h: 4.8e9,  marketCap: 84.2e9, high24h: 190,   low24h: 174,   type: 'crypto' },
  { symbol: 'BNB/USD',  name: 'BNB',        price: 412.30,   change24h: 6.20,    changePct24h: 1.53,  volume24h: 1.9e9,  marketCap: 63.4e9, high24h: 418,   low24h: 402,   type: 'crypto' },
  { symbol: 'XRP/USD',  name: 'XRP',        price: 0.6248,   change24h: -0.0120, changePct24h: -1.89, volume24h: 2.1e9,  marketCap: 34.1e9, high24h: 0.648, low24h: 0.605, type: 'crypto' },
  { symbol: 'AAPL',     name: 'Apple Inc.', price: 197.34,   change24h: 2.56,    changePct24h: 1.31,  volume24h: 58.4e6, marketCap: 3.04e12,high24h: 198.2, low24h: 194.8, type: 'stock'  },
  { symbol: 'TSLA',     name: 'Tesla',      price: 248.60,   change24h: -5.40,   changePct24h: -2.13, volume24h: 112e6,  marketCap: 792e9,  high24h: 256.8, low24h: 244.2, type: 'stock'  },
  { symbol: 'NVDA',     name: 'NVIDIA',     price: 875.20,   change24h: 22.40,   changePct24h: 2.63,  volume24h: 42.1e6, marketCap: 2.15e12,high24h: 882,   low24h: 849,   type: 'stock'  },
  { symbol: 'EUR/USD',  name: 'Euro/Dollar',price: 1.0852,   change24h: 0.0034,  changePct24h: 0.31,  volume24h: 8.4e9,  marketCap: 0,      high24h: 1.0884,low24h: 1.082, type: 'forex'  },
  { symbol: 'GBP/USD',  name: 'GBP/Dollar', price: 1.2714,   change24h: -0.0028, changePct24h: -0.22, volume24h: 5.2e9,  marketCap: 0,      high24h: 1.2758,low24h: 1.268, type: 'forex'  },
  { symbol: 'USD/JPY',  name: 'USD/Yen',    price: 151.42,   change24h: 0.68,    changePct24h: 0.45,  volume24h: 7.1e9,  marketCap: 0,      high24h: 152.1, low24h: 150.9, type: 'forex'  },
];

export const useMarketStore = create<MarketState>()((set) => ({
  tickers: MOCK_TICKERS,
  selectedSymbol: null,
  watchlist: ['BTC/USD', 'ETH/USD', 'AAPL', 'NVDA'],
  setTickers: (tickers) => set({ tickers }),
  updateTicker: (symbol, data) =>
    set((s) => ({
      tickers: s.tickers.map((t) => (t.symbol === symbol ? { ...t, ...data } : t)),
    })),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  addToWatchlist: (symbol) => set((s) => ({ watchlist: [...new Set([...s.watchlist, symbol])] })),
  removeFromWatchlist: (symbol) => set((s) => ({ watchlist: s.watchlist.filter((w) => w !== symbol) })),
}));
