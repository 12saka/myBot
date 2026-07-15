'use client';

import React, { useEffect, useRef } from 'react';

let tvScriptLoadingPromise: Promise<void>;

interface TradingViewWidgetProps {
  symbol: string;
  containerId?: string;
  height?: number | string;
  entryPrice?: number;
  stopLoss?: number;
  tp1?: number;
  tp2?: number;
}

export function TradingViewWidget({ symbol, containerId = `tv_chart_${symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')}`, height = '100%', entryPrice, stopLoss, tp1, tp2 }: TradingViewWidgetProps) {
  const onLoadScriptRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onLoadScriptRef.current = () => {
      setTimeout(createWidget, 100);
    };

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => {
      if (onLoadScriptRef.current) onLoadScriptRef.current();
    });

    return () => {
      onLoadScriptRef.current = null;
    };

    function createWidget() {
      const containerElement = document.getElementById(containerId);
      if (containerElement && 'TradingView' in window) {
        let tvSymbol = '';
        const cleanSymbol = symbol.toUpperCase().replace('/USD', '').trim();
        
        if (cleanSymbol === 'BTC') tvSymbol = 'BINANCE:BTCUSDT';
        else if (cleanSymbol === 'ETH') tvSymbol = 'BINANCE:ETHUSDT';
        else if (cleanSymbol === 'SOL') tvSymbol = 'BINANCE:SOLUSDT';
        else if (cleanSymbol === 'BNB') tvSymbol = 'BINANCE:BNBUSDT';
        else if (cleanSymbol === 'XRP') tvSymbol = 'BINANCE:XRPUSDT';
        else if (cleanSymbol === 'AAPL') tvSymbol = 'NASDAQ:AAPL';
        else if (cleanSymbol === 'TSLA') tvSymbol = 'NASDAQ:TSLA';
        else if (cleanSymbol === 'NVDA') tvSymbol = 'NASDAQ:NVDA';
        else if (cleanSymbol === 'MSFT') tvSymbol = 'NASDAQ:MSFT';
        else if (cleanSymbol === 'AMZN') tvSymbol = 'NASDAQ:AMZN';
        else if (cleanSymbol === 'US30') tvSymbol = 'TVC:DJI';
        else if (cleanSymbol === 'US100') tvSymbol = 'TVC:NDX';
        else if (cleanSymbol === 'SPX500') tvSymbol = 'TVC:SPX';
        else if (cleanSymbol === 'DAX40') tvSymbol = 'TVC:DEU40';
        else if (cleanSymbol === 'GOLD') tvSymbol = 'OANDA:XAUUSD';
        else if (cleanSymbol === 'OIL') tvSymbol = 'OANDA:WTICOUSD';
        else if (cleanSymbol.includes('EUR')) tvSymbol = 'FX_IDC:EURUSD';
        else if (cleanSymbol.includes('GBP')) tvSymbol = 'FX_IDC:GBPUSD';
        else if (cleanSymbol.includes('JPY')) tvSymbol = 'FX_IDC:USDJPY';
        else tvSymbol = `BINANCE:${cleanSymbol}USDT`;

        new (window as any).TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: '60',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          container_id: containerId,
          studies: [
            'RSI@tv-basicstudies',
            'MASimple@tv-basicstudies',
            'MACD@tv-basicstudies',
            'BB@tv-basicstudies',
            'Volume@tv-basicstudies',
          ],
        });
      }
    }
  }, [symbol, containerId, height]);

  // Build TradingView external URL
  const getTradingViewUrl = () => {
    const containerElement = document.getElementById(containerId);
    // reuse the tvSymbol mapping logic
    let tvSym = '';
    const cs = symbol.toUpperCase().replace('/USD', '').trim();
    if (cs === 'BTC') tvSym = 'BINANCE:BTCUSDT';
    else if (cs === 'ETH') tvSym = 'BINANCE:ETHUSDT';
    else if (cs === 'SOL') tvSym = 'BINANCE:SOLUSDT';
    else if (cs === 'BNB') tvSym = 'BINANCE:BNBUSDT';
    else if (cs === 'XRP') tvSym = 'BINANCE:XRPUSDT';
    else if (cs === 'AAPL') tvSym = 'NASDAQ:AAPL';
    else if (cs === 'TSLA') tvSym = 'NASDAQ:TSLA';
    else if (cs === 'NVDA') tvSym = 'NASDAQ:NVDA';
    else if (cs === 'MSFT') tvSym = 'NASDAQ:MSFT';
    else if (cs === 'AMZN') tvSym = 'NASDAQ:AMZN';
    else if (cs === 'US30') tvSym = 'TVC:DJI';
    else if (cs === 'US100') tvSym = 'TVC:NDX';
    else if (cs === 'SPX500') tvSym = 'TVC:SPX';
    else if (cs === 'DAX40') tvSym = 'TVC:DEU40';
    else if (cs === 'GOLD') tvSym = 'OANDA:XAUUSD';
    else if (cs === 'OIL') tvSym = 'OANDA:WTICOUSD';
    else if (cs.includes('EUR')) tvSym = 'FX_IDC:EURUSD';
    else if (cs.includes('GBP')) tvSym = 'FX_IDC:GBPUSD';
    else if (cs.includes('JPY')) tvSym = 'FX_IDC:USDJPY';
    else tvSym = `BINANCE:${cs}USDT`;
    return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`;
  };

  return (
    <div className="tradingview-widget-container h-full w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/20 relative">
      <div id={containerId} style={{ height: typeof height === 'number' ? `${height}px` : height, width: '100%' }} />
      {/* Price Level Annotations Overlay */}
      {(entryPrice || stopLoss || tp1 || tp2) && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {entryPrice && (
            <div className="flex items-center gap-1.5 bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 rounded-lg px-2 py-0.5">
              <div className="w-3 h-0.5 bg-purple-400" />
              <span className="text-[9px] font-bold text-purple-300">ENTRY {entryPrice.toLocaleString()}</span>
            </div>
          )}
          {stopLoss && (
            <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg px-2 py-0.5">
              <div className="w-3 h-0.5 bg-red-400" />
              <span className="text-[9px] font-bold text-red-300">SL {stopLoss.toLocaleString()}</span>
            </div>
          )}
          {tp1 && (
            <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 rounded-lg px-2 py-0.5">
              <div className="w-3 h-0.5 bg-emerald-400" />
              <span className="text-[9px] font-bold text-emerald-300">TP1 {tp1.toLocaleString()}</span>
            </div>
          )}
          {tp2 && (
            <div className="flex items-center gap-1.5 bg-teal-500/20 backdrop-blur-sm border border-teal-500/30 rounded-lg px-2 py-0.5">
              <div className="w-3 h-0.5 bg-teal-400" />
              <span className="text-[9px] font-bold text-teal-300">TP2 {tp2.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
      {/* Open in TradingView Link */}
      <div className="absolute bottom-2 right-2 z-10">
        <a
          href={getTradingViewUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 bg-blue-600/20 backdrop-blur-sm border border-blue-500/30 rounded-lg px-2.5 py-1 text-[10px] font-bold text-blue-300 hover:bg-blue-600/40 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open in TradingView
        </a>
      </div>
    </div>
  );
}
