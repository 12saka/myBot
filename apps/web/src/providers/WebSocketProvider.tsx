'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMarketStore } from '@/store/useMarketStore';
import { toast } from 'react-hot-toast';

const WebSocketContext = createContext<Socket | null>(null);

export const useWebSocket = () => useContext(WebSocketContext);

const SYMBOLS_TO_SUBSCRIBE = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
  'AAPL', 'TSLA', 'NVDA',
  'EUR/USD', 'GBP/USD', 'USD/JPY'
];

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const updateTicker = useMarketStore((s) => s.updateTicker);

  // 1. Direct Sub-Second Binance WebSocket Stream for Crypto
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker/ethusdt@ticker/solusdt@ticker/bnbusdt@ticker/xrpusdt@ticker');
      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          const symMap: Record<string, string> = {
            'BTCUSDT': 'BTC/USD',
            'ETHUSDT': 'ETH/USD',
            'SOLUSDT': 'SOL/USD',
            'BNBUSDT': 'BNB/USD',
            'XRPUSDT': 'XRP/USD'
          };
          const mapped = symMap[data.s];
          if (mapped && data.c) {
            updateTicker(mapped, {
              price: parseFloat(data.c),
              changePct24h: parseFloat(data.P || '0'),
              high24h: parseFloat(data.h || data.c),
              low24h: parseFloat(data.l || data.c),
              type: 'crypto'
            });
          }
        } catch (e) {}
      };
    } catch (err) {}

    // High-speed Universal Parallel Poller for ALL Assets (Crypto, Forex, Indices, Commodities)
    const fetchLivePrices = async () => {
      if (!isMounted) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        // Execute parallel fast requests for Binance Crypto + Gateway Markets simultaneously
        const [binanceRes, gatewayRes] = await Promise.allSettled([
          fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]'),
          fetch(`${apiUrl}/api/v2/markets`)
        ]);

        if (binanceRes.status === 'fulfilled' && binanceRes.value.ok) {
          const cryptoData = await binanceRes.value.json();
          if (Array.isArray(cryptoData)) {
            cryptoData.forEach((t: any) => {
              const symMap: Record<string, string> = {
                'BTCUSDT': 'BTC/USD',
                'ETHUSDT': 'ETH/USD',
                'SOLUSDT': 'SOL/USD',
                'BNBUSDT': 'BNB/USD',
                'XRPUSDT': 'XRP/USD'
              };
              const mapped = symMap[t.symbol];
              if (mapped && isMounted) {
                updateTicker(mapped, {
                  price: parseFloat(t.lastPrice),
                  changePct24h: parseFloat(t.priceChangePercent),
                  high24h: parseFloat(t.highPrice),
                  low24h: parseFloat(t.lowPrice),
                  volume24h: parseFloat(t.quoteVolume),
                  type: 'crypto'
                });
              }
            });
          }
        }

        // 2. Direct Browser Fetch for Indices, Forex, Commodities & Stocks (bypasses server IP blocks)
        try {
          const yahooSymbols = '^DJI,^NDX,^GSPC,^GDAXI,GC=F,CL=F,EURUSD=X,GBPUSD=X,USDJPY=X,AAPL,TSLA,NVDA,MSFT,AMZN';
          const yahooRes = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}`);
          if (yahooRes.ok) {
            const yData = await yahooRes.json();
            const results = yData?.quoteResponse?.result || [];
            const symbolMap: Record<string, { symbol: string; type: 'crypto' | 'forex' | 'stock' | 'index' | 'commodity' }> = {
              '^DJI': { symbol: 'US30', type: 'index' },
              '^NDX': { symbol: 'US100', type: 'index' },
              '^GSPC': { symbol: 'SPX500', type: 'index' },
              '^GDAXI': { symbol: 'DAX40', type: 'index' },
              'GC=F': { symbol: 'XAU/USD', type: 'commodity' },
              'CL=F': { symbol: 'OIL', type: 'commodity' },
              'EURUSD=X': { symbol: 'EUR/USD', type: 'forex' },
              'GBPUSD=X': { symbol: 'GBP/USD', type: 'forex' },
              'USDJPY=X': { symbol: 'USD/JPY', type: 'forex' },
              'AAPL': { symbol: 'AAPL', type: 'stock' },
              'TSLA': { symbol: 'TSLA', type: 'stock' },
              'NVDA': { symbol: 'NVDA', type: 'stock' },
              'MSFT': { symbol: 'MSFT', type: 'stock' },
              'AMZN': { symbol: 'AMZN', type: 'stock' },
            };

            results.forEach((q: any) => {
              const mapped = symbolMap[q.symbol];
              if (mapped && isMounted) {
                const price = parseFloat(q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0);
                const changePct = parseFloat(q.regularMarketChangePercent || 0);
                if (price > 0) {
                  updateTicker(mapped.symbol, {
                    price,
                    changePct24h: parseFloat(changePct.toFixed(2)),
                    high24h: parseFloat(q.regularMarketDayHigh || price * 1.005),
                    low24h: parseFloat(q.regularMarketDayLow || price * 0.995),
                    type: mapped.type
                  });
                }
              }
            });
          }
        } catch (e) {}

        // Direct Browser Stooq Fallback for Indices, Forex & Commodities
        try {
          const stooqRes = await fetch('https://stooq.com/q/l/?s=^dji,^ndx,^gspc,^dax,gc.f,cl.f,eurusd,gbpusd,usdjpy,aapl.us,tsla.us,nvda.us&f=sd2t2ohlcv&h&e=json');
          if (stooqRes.ok) {
            const sData = await stooqRes.json();
            const symbolsList = sData?.symbols || [];
            const stooqMap: Record<string, { symbol: string; type: 'crypto' | 'forex' | 'stock' | 'index' | 'commodity' }> = {
              '^dji': { symbol: 'US30', type: 'index' },
              '^ndx': { symbol: 'US100', type: 'index' },
              '^gspc': { symbol: 'SPX500', type: 'index' },
              '^dax': { symbol: 'DAX40', type: 'index' },
              'gc.f': { symbol: 'XAU/USD', type: 'commodity' },
              'cl.f': { symbol: 'OIL', type: 'commodity' },
              'eurusd': { symbol: 'EUR/USD', type: 'forex' },
              'gbpusd': { symbol: 'GBP/USD', type: 'forex' },
              'usdjpy': { symbol: 'USD/JPY', type: 'forex' },
              'aapl.us': { symbol: 'AAPL', type: 'stock' },
              'tsla.us': { symbol: 'TSLA', type: 'stock' },
              'nvda.us': { symbol: 'NVDA', type: 'stock' },
            };

            symbolsList.forEach((s: any) => {
              const mapped = stooqMap[s.symbol?.toLowerCase()];
              if (mapped && isMounted) {
                const price = parseFloat(s.close || 0);
                const open = parseFloat(s.open || price);
                const changePct = open > 0 ? ((price - open) / open) * 100 : 0;
                if (price > 0) {
                  updateTicker(mapped.symbol, {
                    price,
                    changePct24h: parseFloat(changePct.toFixed(2)),
                    high24h: parseFloat(s.high || price * 1.005),
                    low24h: parseFloat(s.low || price * 0.995),
                    type: mapped.type
                  });
                }
              }
            });
          }
        } catch (e) {}

        // Direct Browser Fetch for Forex (open.er-api.com) & Gold (Binance PAXG)
        try {
          const fxRes = await fetch('https://open.er-api.com/v6/latest/USD');
          if (fxRes.ok && isMounted) {
            const data = await fxRes.json();
            const rates = data?.rates || {};
            if (rates.EUR) updateTicker('EUR/USD', { price: parseFloat((1 / rates.EUR).toFixed(4)), changePct24h: 0.05, type: 'forex' });
            if (rates.GBP) updateTicker('GBP/USD', { price: parseFloat((1 / rates.GBP).toFixed(4)), changePct24h: 0.12, type: 'forex' });
            if (rates.JPY) updateTicker('USD/JPY', { price: parseFloat(rates.JPY.toFixed(2)), changePct24h: -0.08, type: 'forex' });
          }
        } catch (e) {}

        try {
          const paxgRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
          if (paxgRes.ok && isMounted) {
            const paxg = await paxgRes.json();
            if (paxg && paxg.lastPrice) {
              updateTicker('XAU/USD', {
                price: parseFloat(paxg.lastPrice),
                changePct24h: parseFloat(paxg.priceChangePercent || '0'),
                high24h: parseFloat(paxg.highPrice || paxg.lastPrice),
                low24h: parseFloat(paxg.lowPrice || paxg.lastPrice),
                type: 'commodity'
              });
            }
          }
        } catch (e) {}

        if (gatewayRes.status === 'fulfilled' && gatewayRes.value.ok) {
          const markets = await gatewayRes.value.json();
          if (Array.isArray(markets)) {
            markets.forEach((m: any) => {
              let storeSymbol = m.symbol || m.name;
              if (storeSymbol === 'GOLD') storeSymbol = 'XAU/USD';
              if (storeSymbol === 'BTC') storeSymbol = 'BTC/USD';
              if (storeSymbol === 'ETH') storeSymbol = 'ETH/USD';
              if (isMounted && m.price && parseFloat(m.price) > 0) {
                updateTicker(storeSymbol, {
                  price: parseFloat(m.price),
                  changePct24h: parseFloat(m.changePct24h || '0'),
                  high24h: parseFloat(m.high24h || m.price * 1.005),
                  low24h: parseFloat(m.low24h || m.price * 0.995),
                  type: m.type === 'indices' ? 'index' : m.type === 'commodities' ? 'commodity' : m.type === 'stocks' ? 'stock' : (m.type || 'index')
                });
              }
            });
          }
        }
      } catch (err) {}
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 1000); // 1-second ultra-fast refresh for all assets

    return () => {
      isMounted = false;
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, [updateTicker]);

  // 2. WebSocket gateway connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('trademind_token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    const socket = io(apiUrl, {
      query: { token: token || '' },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      SYMBOLS_TO_SUBSCRIBE.forEach((symbol) => {
        socket.emit('subscribe_market', { symbol });
      });
    });

    socket.on('market_tick', (data: { symbol: string; bidPrice: number; askPrice: number }) => {
      const symbol = data.symbol;
      const storeSymbol = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(symbol)
        ? `${symbol}/USD`
        : symbol;

      updateTicker(storeSymbol, {
        price: data.bidPrice,
        high24h: Math.max(data.bidPrice, data.bidPrice * 1.01),
        low24h: Math.min(data.bidPrice, data.bidPrice * 0.99),
      });
    });

    socket.on('notification', (data: { title: string; message: string }) => {
      toast(
        (t) => (
          <div className="flex flex-col gap-1">
            <span className="font-bold text-xs text-white">{data.title}</span>
            <span className="text-[11px] text-slate-300">{data.message}</span>
          </div>
        ),
        {
          duration: 4000,
          position: 'top-right',
          style: {
            background: 'rgba(15, 12, 30, 0.9)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            color: '#fff',
            backdropFilter: 'blur(12px)',
          },
        }
      );
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from gateway.');
    });

    return () => {
      socket.disconnect();
    };
  }, [updateTicker]);

  return (
    <WebSocketContext.Provider value={socketRef.current}>
      {children}
    </WebSocketContext.Provider>
  );
}
