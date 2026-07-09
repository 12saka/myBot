'use client';

import React, { useEffect, useRef } from 'react';

let tvScriptLoadingPromise: Promise<void>;

interface TradingViewWidgetProps {
  symbol: string;
  containerId?: string;
  height?: number;
}

export function TradingViewWidget({ symbol, containerId = 'tradingview_chart', height = 300 }: TradingViewWidgetProps) {
  const onLoadScriptRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onLoadScriptRef.current = createWidget;

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
        else if (cleanSymbol === 'US30') tvSymbol = 'FOREXCOM:DJI';
        else if (cleanSymbol === 'US100') tvSymbol = 'NASDAQ:NDX';
        else if (cleanSymbol === 'SPX500') tvSymbol = 'FOREXCOM:SPX500';
        else if (cleanSymbol === 'DAX40') tvSymbol = 'FOREXCOM:GRXEUR';
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
          studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
        });
      }
    }
  }, [symbol, containerId, height]);

  return (
    <div className="tradingview-widget-container h-full w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/20">
      <div id={containerId} style={{ height: `${height}px`, width: '100%' }} />
    </div>
  );
}
