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
  const lastUpdateRef = useRef<Record<string, number>>({});

  // Smooth throttled wrapper for updateTicker (max 1 update per symbol every 1000ms)
  const throttledUpdateTicker = useRef((symbol: string, data: any) => {
    const now = Date.now();
    const last = lastUpdateRef.current[symbol] || 0;
    if (now - last >= 1000) {
      lastUpdateRef.current[symbol] = now;
      updateTicker(symbol, data);
    }
  }).current;

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
            throttledUpdateTicker(mapped, {
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

    // 2. High-speed Unified Price Synchronizer
    const fetchLivePrices = async () => {
      if (!isMounted) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        // Fetch from API Gateway as Single Source of Truth for all markets
        const gatewayRes = await fetch(`${apiUrl}/api/v2/markets/tickers`).catch(() => null);

        let gatewaySuccess = false;
        if (gatewayRes && gatewayRes.ok) {
          const markets = await gatewayRes.json();
          if (Array.isArray(markets) && markets.length > 0) {
            gatewaySuccess = true;
            markets.forEach((m: any) => {
              let storeSymbol = m.symbol || m.name;
              if (storeSymbol === 'GOLD') storeSymbol = 'XAU/USD';
              if (storeSymbol === 'BTC') storeSymbol = 'BTC/USD';
              if (storeSymbol === 'ETH') storeSymbol = 'ETH/USD';
              if (isMounted && m.price && parseFloat(m.price) > 0) {
                updateTicker(storeSymbol, {
                  price: parseFloat(m.price),
                  changePct24h: typeof m.changePct24h === 'number' ? m.changePct24h : parseFloat(m.changePct24h || '0'),
                  high24h: parseFloat(m.high24h || m.price * 1.005),
                  low24h: parseFloat(m.low24h || m.price * 0.995),
                  type: m.type === 'indices' ? 'index' : m.type === 'commodities' ? 'commodity' : m.type === 'stocks' ? 'stock' : (m.type || 'index')
                });
              }
            });
          }
        }

        // Fallback: If gateway fetch fails, query Binance 24h ticker directly for crypto
        if (!gatewaySuccess) {
          try {
            const cryptoRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]');
            if (cryptoRes.ok) {
              const cryptoData = await cryptoRes.json();
              if (Array.isArray(cryptoData)) {
                const symMap: Record<string, string> = {
                  'BTCUSDT': 'BTC/USD',
                  'ETHUSDT': 'ETH/USD',
                  'SOLUSDT': 'SOL/USD',
                  'BNBUSDT': 'BNB/USD',
                  'XRPUSDT': 'XRP/USD'
                };
                cryptoData.forEach((t: any) => {
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
          } catch (e) {}
        }
      } catch (err) {}
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 2500); // Clean 2.5-second refresh cycle

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

      throttledUpdateTicker(storeSymbol, {
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
