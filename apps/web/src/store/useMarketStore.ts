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

const MOCK_TICKERS: Ticker[] = [
  { symbol: 'BTC/USD',  name: 'Bitcoin',          price: 64318.50, change24h: 1240.30,  changePct24h: 1.97,  volume24h: 28.4e9,  marketCap: 1.26e12,  high24h: 65200,   low24h: 62900, type: 'crypto' },
  { symbol: 'ETH/USD',  name: 'Ethereum',          price: 3182.40,  change24h: -54.20,   changePct24h: -1.67, volume24h: 15.2e9,  marketCap: 382e9,    high24h: 3290,    low24h: 3120,  type: 'crypto' },
  { symbol: 'SOL/USD',  name: 'Solana',            price: 184.72,   change24h: 8.14,     changePct24h: 4.61,  volume24h: 4.8e9,   marketCap: 84.2e9,   high24h: 190,     low24h: 174,   type: 'crypto' },
  { symbol: 'BNB/USD',  name: 'BNB',               price: 412.30,   change24h: 6.20,     changePct24h: 1.53,  volume24h: 1.9e9,   marketCap: 63.4e9,   high24h: 418,     low24h: 402,   type: 'crypto' },
  { symbol: 'XRP/USD',  name: 'XRP',               price: 0.6248,   change24h: -0.0120,  changePct24h: -1.89, volume24h: 2.1e9,   marketCap: 34.1e9,   high24h: 0.648,   low24h: 0.605, type: 'crypto' },
  { symbol: 'AAPL',     name: 'Apple Inc.',        price: 197.34,   change24h: 2.56,     changePct24h: 1.31,  volume24h: 58.4e6,  marketCap: 3.04e12,  high24h: 198.2,   low24h: 194.8, type: 'stock'  },
  { symbol: 'TSLA',     name: 'Tesla Inc.',        price: 248.60,   change24h: -5.40,    changePct24h: -2.13, volume24h: 112e6,   marketCap: 792e9,    high24h: 256.8,   low24h: 244.2, type: 'stock'  },
  { symbol: 'NVDA',     name: 'NVIDIA Corp.',      price: 875.20,   change24h: 22.40,    changePct24h: 2.63,  volume24h: 42.1e6,  marketCap: 2.15e12,  high24h: 882,     low24h: 849,   type: 'stock'  },
  { symbol: 'MSFT',     name: 'Microsoft Corp.',   price: 415.20,   change24h: 3.10,     changePct24h: 0.75,  volume24h: 22.0e6,  marketCap: 3.05e12,  high24h: 417,     low24h: 411,   type: 'stock'  },
  { symbol: 'AMZN',     name: 'Amazon.com Inc.',   price: 185.40,   change24h: 1.80,     changePct24h: 0.98,  volume24h: 32.5e6,  marketCap: 1.95e12,  high24h: 187,     low24h: 182,   type: 'stock'  },
  { symbol: 'US30',     name: 'Dow Jones (US30)',  price: 39220,    change24h: 180,      changePct24h: 0.46,  volume24h: 0,       marketCap: 0,        high24h: 39400,   low24h: 38900, type: 'index'  },
  { symbol: 'US100',    name: 'NASDAQ 100',        price: 18420,    change24h: -120,     changePct24h: -0.65, volume24h: 0,       marketCap: 0,        high24h: 18600,   low24h: 18200, type: 'index'  },
  { symbol: 'SPX500',   name: 'S&P 500',           price: 5310,     change24h: 25,       changePct24h: 0.47,  volume24h: 0,       marketCap: 0,        high24h: 5340,    low24h: 5270,  type: 'index'  },
  { symbol: 'DAX40',    name: 'DAX 40',            price: 18710,    change24h: 95,       changePct24h: 0.51,  volume24h: 0,       marketCap: 0,        high24h: 18800,   low24h: 18550, type: 'index'  },
  { symbol: 'GOLD',     name: 'Gold (XAU/USD)',    price: 2355,     change24h: 12.50,    changePct24h: 0.53,  volume24h: 0,       marketCap: 0,        high24h: 2370,    low24h: 2330,  type: 'commodity' },
  { symbol: 'OIL',      name: 'Crude Oil (WTI)',   price: 78.60,    change24h: 0.80,     changePct24h: 1.03,  volume24h: 0,       marketCap: 0,        high24h: 79.5,    low24h: 77.8,  type: 'commodity' },
  { symbol: 'EUR/USD',  name: 'Euro / US Dollar',  price: 1.0852,   change24h: 0.0034,   changePct24h: 0.31,  volume24h: 8.4e9,   marketCap: 0,        high24h: 1.0884,  low24h: 1.082, type: 'forex'  },
  { symbol: 'GBP/USD',  name: 'Pound / US Dollar', price: 1.2714,   change24h: -0.0028,  changePct24h: -0.22, volume24h: 5.2e9,   marketCap: 0,        high24h: 1.2758,  low24h: 1.268, type: 'forex'  },
  { symbol: 'USD/JPY',  name: 'US Dollar / Yen',   price: 151.42,   change24h: 0.68,     changePct24h: 0.45,  volume24h: 7.1e9,   marketCap: 0,        high24h: 152.1,   low24h: 150.9, type: 'forex'  },
];

const getInitialWatchlist = (): string[] => {
  if (typeof window === 'undefined') return ['BTC/USD', 'ETH/USD', 'AAPL', 'NVDA'];
  const saved = localStorage.getItem('trademind_watchlist');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return ['BTC/USD', 'ETH/USD', 'AAPL', 'NVDA'];
    }
  }
  return ['BTC/USD', 'ETH/USD', 'AAPL', 'NVDA'];
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
  tickers: MOCK_TICKERS,
  selectedSymbol: null,
  watchlist: getInitialWatchlist(),
  setTickers: (tickers) => set({ tickers }),
  updateTicker: (symbol, data) =>
    set((s) => ({
      tickers: s.tickers.map((t) => (t.symbol === symbol ? { ...t, ...data } : t)),
    })),
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
