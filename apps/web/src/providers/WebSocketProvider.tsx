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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('trademind_token');
    if (!token) return;

    // Connect to the API gateway WebSocket server
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socket = io(apiUrl, {
      query: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected to API gateway.');

      // Subscribe to live market feeds for all assets
      SYMBOLS_TO_SUBSCRIBE.forEach((symbol) => {
        socket.emit('subscribe_market', { symbol });
      });
    });

    socket.on('market_tick', (data: { symbol: string; bidPrice: number; askPrice: number }) => {
      // Map token ticker naming back to frontend keys (BTC -> BTC/USD)
      const symbol = data.symbol;
      const storeSymbol = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(symbol)
        ? `${symbol}/USD`
        : symbol;

      // Update in our Zustand state store
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
