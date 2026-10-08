'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, ExternalLink, X, TrendingUp } from 'lucide-react';

let tvScriptLoadingPromise: Promise<void>;

interface TradingViewWidgetProps {
  symbol: string;
  containerId?: string;
  height?: number | string;
  interval?: string;
  theme?: string;
  autosize?: boolean;
  entryPrice?: number;
  stopLoss?: number;
  tp1?: number;
  tp2?: number;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

export function TradingViewWidget({
  symbol = 'GOLD',
  containerId,
  height = '100%',
  interval = '15',
  theme = 'dark',
  autosize = true,
  entryPrice,
  stopLoss,
  tp1,
  tp2,
  onFullscreenToggle,
}: TradingViewWidgetProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWidgetSymbolRef = useRef<string>('');
  const activeWidgetIntervalRef = useRef<string>('');
  const widgetInstanceRef = useRef<any>(null);

  // Generate unique stable container ID based on symbol & containerId
  const stableId = useRef(
    containerId || `tv_chart_${(symbol || 'XAU').toUpperCase().replace(/[^A-Z0-9]/g, '')}`
  ).current;

  // Resolve TradingView institutional ticker symbol
  const getTvSymbol = (rawSymbol: string): string => {
    if (rawSymbol && rawSymbol.includes(':')) {
      return rawSymbol;
    }
    const clean = (rawSymbol || 'GOLD').toUpperCase().replace('/USD', '').trim();
    if (['GOLD', 'XAU', 'XAUUSD'].includes(clean)) return 'OANDA:XAUUSD';
    if (clean === 'BTC') return 'BINANCE:BTCUSDT';
    if (clean === 'ETH') return 'BINANCE:ETHUSDT';
    if (clean === 'SOL') return 'BINANCE:SOLUSDT';
    if (clean === 'BNB') return 'BINANCE:BNBUSDT';
    if (clean === 'XRP') return 'BINANCE:XRPUSDT';
    if (clean === 'AAPL') return 'NASDAQ:AAPL';
    if (clean === 'TSLA') return 'NASDAQ:TSLA';
    if (clean === 'NVDA') return 'NASDAQ:NVDA';
    if (clean === 'MSFT') return 'NASDAQ:MSFT';
    if (clean === 'AMZN') return 'NASDAQ:AMZN';
    if (clean === 'US30') return 'TVC:DJI';
    if (clean === 'US100') return 'TVC:NDX';
    if (clean === 'SPX500') return 'TVC:SPX';
    if (clean === 'DAX40') return 'TVC:DEU40';
    if (clean === 'OIL') return 'OANDA:WTICOUSD';
    if (clean.includes('EUR')) return 'FX_IDC:EURUSD';
    if (clean.includes('GBP')) return 'FX_IDC:GBPUSD';
    if (clean.includes('JPY')) return 'FX_IDC:USDJPY';
    return `BINANCE:${clean}USDT`;
  };

  const targetTvSymbol = getTvSymbol(symbol);

  useEffect(() => {
    let isMounted = true;

    // Load TradingView script once globally
    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.async = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }

    const initWidget = () => {
      if (!isMounted) return;
      const el = document.getElementById(stableId);
      if (!el || !(window as any).TradingView) return;

      // STICKY PERSISTENCE CHECK:
      // If the chart is already rendered for this exact symbol & interval, DO NOT re-initialize it!
      // This ensures that user drawings, Fib retracements, trendlines, and zoom stick permanently
      // and are NEVER wiped out by parent state re-renders, price updates, or background syncs.
      if (
        activeWidgetSymbolRef.current === targetTvSymbol &&
        activeWidgetIntervalRef.current === interval &&
        widgetInstanceRef.current &&
        el.querySelector('iframe')
      ) {
        return;
      }

      // Clear previous widget iframe only when symbol or interval fundamentally changes
      el.innerHTML = '';
      activeWidgetSymbolRef.current = targetTvSymbol;
      activeWidgetIntervalRef.current = interval;

      try {
        widgetInstanceRef.current = new (window as any).TradingView.widget({
          autosize: true,
          symbol: targetTvSymbol,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1',
          locale: 'en',
          toolbar_bg: '#090d16',
          enable_publishing: false,
          hide_side_toolbar: false, // Enable drawing tools and analysis tools
          allow_symbol_change: true,
          save_image: true,
          container_id: stableId,
          studies: [
            'RSI@tv-basicstudies',
            'MASimple@tv-basicstudies',
            'Volume@tv-basicstudies',
          ],
        });
      } catch (err) {
        console.error('[TradingViewWidget] Initialization notice:', err);
      }
    };

    tvScriptLoadingPromise.then(() => {
      setTimeout(initWidget, 100);
    });

    return () => {
      isMounted = false;
      // Do NOT destroy DOM here on minor rerenders so drawings stick!
    };
  }, [targetTvSymbol, interval, theme, stableId]);

  // Handle Fullscreen Toggle (Native HTML5 API + Viewport CSS Overlay)
  const toggleFullscreen = useCallback(async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    if (onFullscreenToggle) {
      onFullscreenToggle(nextState);
    }

    try {
      if (nextState) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen().catch(() => {});
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          (containerRef.current as any).webkitRequestFullscreen();
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitFullscreenElement) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Browser might restrict requestFullscreen on some platforms; CSS fixed fullscreen covers it seamlessly
    }
  }, [isFullscreen, onFullscreenToggle]);

  // Sync state if user exits via browser ESC or gesture
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (!isNativeFs && isFullscreen) {
        setIsFullscreen(false);
        if (onFullscreenToggle) onFullscreenToggle(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, onFullscreenToggle]);

  // Listen to Escape key for CSS overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);

  // Lock body scrolling when fullscreen overlay is active
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  const tradingViewUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(targetTvSymbol)}`;

  return (
    <div
      ref={containerRef}
      className={`tradingview-widget-container w-full transition-all duration-200 flex flex-col ${
        isFullscreen
          ? 'fixed inset-0 z-[999999] w-screen h-screen bg-slate-950 p-2 sm:p-4 rounded-none border-none'
          : 'h-full min-h-[380px] sm:min-h-[480px] md:min-h-[520px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950 relative'
      }`}
      style={!isFullscreen ? { height: typeof height === 'number' ? `${height}px` : height } : {}}
    >
      {/* 1. Fullscreen Dedicated Header Bar */}
      {isFullscreen ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 mb-2 rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold font-mono transition-all cursor-pointer shadow-lg shadow-purple-500/25 shrink-0"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 size={14} />
              <span>Exit Fullscreen</span>
              <span className="hidden sm:inline text-[10px] opacity-75 font-normal">(Esc)</span>
            </button>

            <div className="flex items-center gap-2 border-l border-white/10 pl-2.5 min-w-0">
              <span className="font-display font-bold text-white text-xs sm:text-sm truncate">
                {targetTvSymbol}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 shrink-0">
                {interval}M Institutional
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Price Targets in Fullscreen */}
            {(entryPrice || stopLoss || tp1) && (
              <div className="hidden md:flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold">
                {entryPrice && (
                  <span className="text-cyan-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Entry: ${entryPrice.toFixed(2)}
                  </span>
                )}
                {stopLoss && (
                  <span className="text-rose-400 flex items-center gap-1 border-l border-white/10 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    SL: ${stopLoss.toFixed(2)}
                  </span>
                )}
                {tp1 && (
                  <span className="text-emerald-400 flex items-center gap-1 border-l border-white/10 pl-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    TP1: ${tp1.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <a
              href={tradingViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold transition-all"
              title="Open Chart in TradingView"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">TradingView</span>
            </a>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Close Fullscreen"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* 2. Inline Mode Floating Controls */
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
          {(entryPrice || stopLoss || tp1) && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1 text-[10px] font-mono font-bold shadow-lg">
              {entryPrice && (
                <span className="text-cyan-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  ${entryPrice.toFixed(2)}
                </span>
              )}
              {stopLoss && (
                <span className="text-rose-400 flex items-center gap-1 border-l border-white/10 pl-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  SL ${stopLoss.toFixed(2)}
                </span>
              )}
              {tp1 && (
                <span className="text-emerald-400 flex items-center gap-1 border-l border-white/10 pl-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  TP1 ${tp1.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Expand to Full Page / Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-purple-600 text-slate-200 hover:text-white border border-white/10 hover:border-purple-500/50 shadow-md backdrop-blur-md transition-all cursor-pointer text-[11px] font-mono font-bold"
            title="Expand chart to occupy whole page/screen"
          >
            <Maximize2 size={12} />
            <span className="hidden xs:inline sm:inline">Expand Full Page</span>
          </button>

          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white rounded-xl px-2 py-1 text-[10px] font-mono font-bold shadow-md backdrop-blur-md transition-all"
            title="Open in TradingView.com"
          >
            <ExternalLink size={12} />
            <span className="hidden md:inline">TV</span>
          </a>
        </div>
      )}

      {/* 3. Persistent Chart DOM Container (Preserves user drawings and indicators permanently) */}
      <div
        id={stableId}
        className={`w-full flex-1 relative ${
          isFullscreen ? 'min-h-0 rounded-xl overflow-hidden border border-white/10 bg-slate-950' : 'h-full min-h-[360px]'
        }`}
      />
    </div>
  );
}
