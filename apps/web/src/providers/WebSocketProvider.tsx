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

  // 1. Live spot market price poller (Binance live feed)
  useEffect(() => {
    let isMounted = true;

    const fetchLivePrices = async () => {
      try {
        const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]');
        if (binanceRes.ok) {
          const data = await binanceRes.json();
          if (Array.isArray(data)) {
            data.forEach((t: any) => {
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
      } catch (err) {
        // Silently catch network errors
      }
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 5000);
    return () => {
      isMounted = false;
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

    return () => {
      socket.disconnect();
    };
  }, [updateTicker]);

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
