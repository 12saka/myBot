import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly symbols = [
    { name: 'BTC/USD', type: 'crypto', binanceSymbol: 'BTCUSDT',  volatility: 50 },
    { name: 'ETH/USD', type: 'crypto', binanceSymbol: 'ETHUSDT',  volatility: 8 },
    { name: 'SOL/USD', type: 'crypto', binanceSymbol: 'SOLUSDT',  volatility: 1.5 },
    { name: 'BNB/USD', type: 'crypto', binanceSymbol: 'BNBUSDT',  volatility: 1.5 },
    { name: 'XRP/USD', type: 'crypto', binanceSymbol: 'XRPUSDT',  volatility: 0.005 },
    { name: 'XAU/USD', type: 'commodity', binanceSymbol: 'PAXGUSDT', volatility: 5.0 },
    { name: 'GOLD',    type: 'commodity', binanceSymbol: 'PAXGUSDT', volatility: 5.0 },
    { name: 'AAPL',    type: 'stock',  binanceSymbol: null,       volatility: 0.6 },
    { name: 'TSLA',    type: 'stock',  binanceSymbol: null,       volatility: 1.2 },
    { name: 'NVDA',    type: 'stock',  binanceSymbol: null,       volatility: 3.0 },
    { name: 'MSFT',    type: 'stock',  binanceSymbol: null,       volatility: 1.0 },
    { name: 'AMZN',    type: 'stock',  binanceSymbol: null,       volatility: 0.8 },
    { name: 'US30',    type: 'index',  binanceSymbol: null,       volatility: 80 },
    { name: 'US100',   type: 'index',  binanceSymbol: null,       volatility: 60 },
    { name: 'SPX500',  type: 'index',  binanceSymbol: null,       volatility: 15 },
    { name: 'DAX40',   type: 'index',  binanceSymbol: null,       volatility: 70 },
    { name: 'OIL',     type: 'commodity', binanceSymbol: null,    volatility: 0.4 },
    { name: 'EUR/USD', type: 'forex', binanceSymbol: null,       volatility: 0.0005 },
    { name: 'GBP/USD', type: 'forex', binanceSymbol: null,       volatility: 0.0005 },
    { name: 'USD/JPY', type: 'forex', binanceSymbol: null,       volatility: 0.05 },
  ];

  private tickerCache: Record<string, { price: number; changePct24h: number; volume24h: number; timestamp: number }> = {};

  getCachedTicker(symbol: string): { price: number; changePct24h: number; volume24h: number } | null {
    const cached = this.tickerCache[symbol];
    if (!cached) return null;
    return cached;
  }

  constructor(private readonly prisma: PrismaService) {}

  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs = 7000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(options.headers || {})
      };
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async onModuleInit() {
    console.log('[MarketsService] Initializing real-time feeds and database candle cache...');
    this.bootstrapMarketCache();
  }

  private async bootstrapMarketCache() {
    try {
      // Purge any legacy simulated/dummy/corrupted prices from database tables
      await this.prisma.marketData.deleteMany({
        where: {
          OR: [
            { symbol: 'US100', bidPrice: { gt: 24000 } },
            { symbol: 'US100', bidPrice: { lt: 10000 } },
            { symbol: 'US30', bidPrice: { lt: 25000 } },
            { symbol: 'XAU/USD', bidPrice: { lt: 1800 } },
            { symbol: 'XAU/USD', bidPrice: { gt: 3200 } },
            { symbol: 'GOLD', bidPrice: { lt: 1800 } },
            { symbol: 'GOLD', bidPrice: { gt: 3200 } },
            { bidPrice: 100 }
          ]
        }
      }).catch(() => {});

      await this.prisma.historicalCandle.deleteMany({
        where: {
          OR: [
            { symbol: 'US100', close: { gt: 24000 } },
            { symbol: 'US100', close: { lt: 10000 } },
            { symbol: 'US30', close: { lt: 25000 } },
            { symbol: 'XAU/USD', close: { lt: 1800 } },
            { symbol: 'XAU/USD', close: { gt: 3200 } },
            { symbol: 'GOLD', close: { lt: 1800 } },
            { symbol: 'GOLD', close: { gt: 3200 } },
            { close: 100 }
          ]
        }
      }).catch(() => {});

      await this.seedHistoricalCandles();
      await this.updateLivePrices();
    } catch (err: any) {
      console.warn(`[MarketsService] Market bootstrap skipped so API can start: ${err.message}`);
    }
  }

  public getYahooTicker(symbol: string): string {
    const map: Record<string, string> = {
      'US30': '^DJI',
      'US100': '^NDX',
      'SPX500': '^GSPC',
      'DAX40': '^GDAXI',
      'GOLD': 'XAUUSD=X',
      'XAU/USD': 'XAUUSD=X',
      'OIL': 'CL=F',
      'EUR/USD': 'EURUSD=X',
      'GBP/USD': 'GBPUSD=X',
      'USD/JPY': 'USDJPY=X',
      'AAPL': 'AAPL',
      'TSLA': 'TSLA',
      'NVDA': 'NVDA',
      'MSFT': 'MSFT',
      'AMZN': 'AMZN',
      'BTC': 'BTC-USD',
      'ETH': 'ETH-USD',
      'SOL': 'SOL-USD',
      'BNB': 'BNB-USD',
      'XRP': 'XRP-USD',
      'BTC/USD': 'BTC-USD',
      'ETH/USD': 'ETH-USD',
      'SOL/USD': 'SOL-USD',
      'BNB/USD': 'BNB-USD',
      'XRP/USD': 'XRP-USD',
    };
    return map[symbol] || symbol;
  }

  public getTwelveDataSymbol(symbol: string): string {
    const map: Record<string, string> = {
      'US30': 'US30',
      'US100': 'US100',
      'SPX500': 'SPX500',
      'DAX40': 'DAX40',
      'GOLD': 'XAU/USD',
      'XAU/USD': 'XAU/USD',
      'OIL': 'WTI/USD',
      'EUR/USD': 'EUR/USD',
      'GBP/USD': 'GBP/USD',
      'USD/JPY': 'USD/JPY',
      'BTC': 'BTC/USD',
      'ETH': 'ETH/USD',
      'SOL': 'SOL/USD',
      'BNB': 'BNB/USD',
      'XRP': 'XRP/USD',
      'BTC/USD': 'BTC/USD',
      'ETH/USD': 'ETH/USD',
      'SOL/USD': 'SOL/USD',
      'BNB/USD': 'BNB/USD',
      'XRP/USD': 'XRP/USD',
    };
    return map[symbol] || symbol;
  }

  public getTickerStats(): Record<string, { price: number; changePct24h: number; volume24h: number }> {
    return this.tickerCache;
  }

  // Poll live prices every 2.5 seconds for instant high-speed streaming
  @Interval(2500)
  async updateLivePrices() {
    try {
      // 1. Fetch Crypto Prices & 24h Stats from Binance (including PAXGUSDT for Gold)
      let cryptoPriceMap: Record<string, { price: number; changePct: number; volume: number }> = {};
      try {
        const binanceApiKey = process.env.BINANCE_KEY || process.env.BINANCE_API_KEY;
        const headers: Record<string, string> = {};
        if (binanceApiKey) {
          headers['X-MBX-APIKEY'] = binanceApiKey;
        }
        const response = await this.fetchWithTimeout(
          'https://api.binance.com/api/v3/ticker/24hr',
          { headers }
        );
        if (response.ok) {
          const stats = await response.json();
          if (Array.isArray(stats)) {
            const targetSymbols = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'PAXGUSDT']);
            for (const item of stats) {
              if (targetSymbols.has(item.symbol)) {
                const price = parseFloat(item.lastPrice || '0');
                if (price > 0) {
                  cryptoPriceMap[item.symbol] = {
                    price,
                    changePct: parseFloat(item.priceChangePercent || '0'),
                    volume: parseFloat(item.quoteVolume || '0')
                  };
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Binance 24h stats API connection failed: ${err.message}`);
      }

      // High-availability CoinGecko quoter for Crypto & Gold spot backup
      try {
        const cgRes = await this.fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple,paxos-gold&vs_currencies=usd&include_24hr_change=true', {}, 3500);
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          if (cgData.bitcoin?.usd) cryptoPriceMap['BTCUSDT'] = cryptoPriceMap['BTCUSDT'] || { price: cgData.bitcoin.usd, changePct: parseFloat((cgData.bitcoin.usd_24h_change || 0).toFixed(2)), volume: 15000000000 };
          if (cgData.ethereum?.usd) cryptoPriceMap['ETHUSDT'] = cryptoPriceMap['ETHUSDT'] || { price: cgData.ethereum.usd, changePct: parseFloat((cgData.ethereum.usd_24h_change || 0).toFixed(2)), volume: 8000000000 };
          if (cgData.solana?.usd) cryptoPriceMap['SOLUSDT'] = cryptoPriceMap['SOLUSDT'] || { price: cgData.solana.usd, changePct: parseFloat((cgData.solana.usd_24h_change || 0).toFixed(2)), volume: 3000000000 };
          if (cgData.binancecoin?.usd) cryptoPriceMap['BNBUSDT'] = cryptoPriceMap['BNBUSDT'] || { price: cgData.binancecoin.usd, changePct: parseFloat((cgData.binancecoin.usd_24h_change || 0).toFixed(2)), volume: 1000000000 };
          if (cgData.ripple?.usd) cryptoPriceMap['XRPUSDT'] = cryptoPriceMap['XRPUSDT'] || { price: cgData.ripple.usd, changePct: parseFloat((cgData.ripple.usd_24h_change || 0).toFixed(2)), volume: 800000000 };
          if (cgData['paxos-gold']?.usd) cryptoPriceMap['PAXGUSDT'] = cryptoPriceMap['PAXGUSDT'] || { price: cgData['paxos-gold'].usd, changePct: parseFloat((cgData['paxos-gold'].usd_24h_change || 0).toFixed(2)), volume: 50000000 };
        }
      } catch (err: any) {}

      // 2. Fetch Stocks, Indices, Commodities, Forex from Twelve Data (if key present) or Fast Yahoo Finance API
      const nonCryptoSymbols = this.symbols;
      let yahooPriceMap: Record<string, { price: number; changePct: number; volume: number }> = {};
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      let fetchedFromTwelveData = false;

      if (twelveDataKey && twelveDataKey !== 'demo') {
        try {
          const symbolsQuery = nonCryptoSymbols.map(s => this.getTwelveDataSymbol(s.name)).join(',');
          const response = await this.fetchWithTimeout(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolsQuery)}&apikey=${twelveDataKey}`, {}, 3000);
          if (response.ok) {
            const data = await response.json();
            for (const asset of nonCryptoSymbols) {
              const tdSym = this.getTwelveDataSymbol(asset.name);
              const tdData = data[tdSym] || (data.symbol === tdSym ? data : null);
              if (tdData && (tdData.price || tdData.close)) {
                const yahooTicker = this.getYahooTicker(asset.name);
                yahooPriceMap[yahooTicker] = {
                  price: parseFloat(tdData.price || tdData.close),
                  changePct: parseFloat(tdData.percent_change || tdData.change_percent || 0),
                  volume: parseFloat(tdData.volume || '0')
                };
              }
            }
            fetchedFromTwelveData = true;
          }
        } catch (err: any) {}
      }

      // Fast Yahoo Finance Batch Quoter (< 100ms response)
      if (!fetchedFromTwelveData) {
        try {
          const yahooSymbolsQuery = nonCryptoSymbols.map(s => this.getYahooTicker(s.name)).join(',');
          const response = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbolsQuery)}`, {}, 4000);
          if (response.ok) {
            const data = await response.json();
            const results = data?.quoteResponse?.result || [];
            for (const q of results) {
              const symbol = q.symbol;
              const price = parseFloat(q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0);
              const changePct = parseFloat(q.regularMarketChangePercent || 0);
              const volume = parseFloat(q.regularMarketVolume || '0');
              if (price > 0) {
                yahooPriceMap[symbol] = {
                  price,
                  changePct: parseFloat(changePct.toFixed(2)),
                  volume
                };
              }
            }
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Yahoo Finance batch quote API failed: ${err.message}`);
        }
      }

      // High-availability open.er-api.com as emergency fallback only for Forex exchange rates
      try {
        if (!yahooPriceMap['EURUSD=X'] || !yahooPriceMap['GBPUSD=X'] || !yahooPriceMap['USDJPY=X']) {
          const forexRes = await this.fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
          if (forexRes.ok) {
            const fxData = await forexRes.json();
            const rates = fxData?.rates || {};
            if (rates.EUR && rates.EUR > 0 && !yahooPriceMap['EURUSD=X']) {
              const currentP = parseFloat((1 / rates.EUR).toFixed(5));
              const prevP = this.tickerCache['EUR/USD']?.price;
              const changePct = prevP && prevP > 0 ? parseFloat((((currentP - prevP) / prevP) * 100).toFixed(2)) : 0;
              yahooPriceMap['EURUSD=X'] = { price: currentP, changePct, volume: 500000 };
            }
            if (rates.GBP && rates.GBP > 0 && !yahooPriceMap['GBPUSD=X']) {
              const currentP = parseFloat((1 / rates.GBP).toFixed(5));
              const prevP = this.tickerCache['GBP/USD']?.price;
              const changePct = prevP && prevP > 0 ? parseFloat((((currentP - prevP) / prevP) * 100).toFixed(2)) : 0;
              yahooPriceMap['GBPUSD=X'] = { price: currentP, changePct, volume: 450000 };
            }
            if (rates.JPY && rates.JPY > 0 && !yahooPriceMap['USDJPY=X']) {
              const currentP = parseFloat(rates.JPY.toFixed(3));
              const prevP = this.tickerCache['USD/JPY']?.price;
              const changePct = prevP && prevP > 0 ? parseFloat((((currentP - prevP) / prevP) * 100).toFixed(2)) : 0;
              yahooPriceMap['USDJPY=X'] = { price: currentP, changePct, volume: 600000 };
            }
          }
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Forex fallback notice: ${err.message}`);
      }

      // High-availability Yahoo Chart v8 API for Crypto, Indices, Stocks, Commodities & Forex
      const chartTickers = [
        { name: 'BTC/USD', yahoo: 'BTC-USD' },
        { name: 'ETH/USD', yahoo: 'ETH-USD' },
        { name: 'SOL/USD', yahoo: 'SOL-USD' },
        { name: 'BNB/USD', yahoo: 'BNB-USD' },
        { name: 'XRP/USD', yahoo: 'XRP-USD' },
        { name: 'US30', yahoo: '^DJI' },
        { name: 'US100', yahoo: '^NDX' },
        { name: 'SPX500', yahoo: '^GSPC' },
        { name: 'DAX40', yahoo: '^GDAXI' },
        { name: 'US10Y', yahoo: '^TNX' },
        { name: 'DXY', yahoo: 'DX-Y.NYB' },
        { name: 'VIX', yahoo: '^VIX' },
        { name: 'NQ', yahoo: 'NQ=F' },
        { name: 'YM', yahoo: 'YM=F' },
        { name: 'GOLD', yahoo: 'GC=F' },
        { name: 'XAU/USD', yahoo: 'GC=F' },
        { name: 'OIL', yahoo: 'CL=F' },
        { name: 'AAPL', yahoo: 'AAPL' },
        { name: 'TSLA', yahoo: 'TSLA' },
        { name: 'NVDA', yahoo: 'NVDA' },
        { name: 'MSFT', yahoo: 'MSFT' },
        { name: 'AMZN', yahoo: 'AMZN' },
        { name: 'EUR/USD', yahoo: 'EURUSD=X' },
        { name: 'GBP/USD', yahoo: 'GBPUSD=X' },
        { name: 'USD/JPY', yahoo: 'USDJPY=X' },
      ];

      for (const idxAsset of chartTickers) {
        try {
          const chartRes = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${idxAsset.yahoo}?interval=1m&range=1d`);
          if (chartRes.ok) {
            const cData = await chartRes.json();
            const meta = cData?.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice && meta.regularMarketPrice > 0) {
              const price = parseFloat(meta.regularMarketPrice);
              const prevClose = parseFloat(meta.chartPreviousClose || meta.previousClose || price);
              const changePct = prevClose > 0 ? parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;
              yahooPriceMap[idxAsset.yahoo] = {
                price,
                changePct,
                volume: parseFloat(meta.regularMarketVolume || '0')
              };
            }
          }
        } catch (e) {}
      }

      // High-availability Stooq & Yahoo quoter for Indices & Commodities
      try {
        const stooqRes = await this.fetchWithTimeout('https://stooq.com/q/l/?s=^dji,^ndx,^gspc,^dax,cl.f&f=sd2t2ohlcv&h&e=json');
        if (stooqRes.ok) {
          const sData = await stooqRes.json();
          const symbolsList = sData?.symbols || [];
          const stooqMap: Record<string, string> = {
            '^dji': 'US30',
            '^ndx': 'US100',
            '^gspc': 'SPX500',
            '^dax': 'DAX40',
            'cl.f': 'OIL'
          };
          for (const s of symbolsList) {
            const symLower = String(s.symbol || '').toLowerCase();
            const assetName = stooqMap[symLower];
            const p = parseFloat(s.close);
            if (assetName && !isNaN(p) && p > 0) {
              const yahooTicker = this.getYahooTicker(assetName);
              if (!yahooPriceMap[yahooTicker] || yahooPriceMap[yahooTicker].price <= 0) {
                const openP = parseFloat(s.open);
                const changePct = (!isNaN(openP) && openP > 0) ? parseFloat((((p - openP) / openP) * 100).toFixed(2)) : 0;
                yahooPriceMap[yahooTicker] = {
                  price: p,
                  changePct,
                  volume: parseFloat(s.volume || '0')
                };
              }
            }
          }
        }
      } catch (err) {}

      // 3. Update Database Records & Populate in-memory Cache
      for (const asset of this.symbols) {
        const lastCached = this.tickerCache[asset.name];
        let currentPrice = lastCached ? lastCached.price : 0;
        let changePct24h = lastCached ? lastCached.changePct24h : 0;
        let volume24h = lastCached ? lastCached.volume24h : 0;

        if (asset.binanceSymbol && cryptoPriceMap[asset.binanceSymbol] && cryptoPriceMap[asset.binanceSymbol].price > 0) {
          const binanceData = cryptoPriceMap[asset.binanceSymbol];
          currentPrice = binanceData.price;
          changePct24h = binanceData.changePct;
          volume24h = binanceData.volume;
        } else {
          const yahooTicker = this.getYahooTicker(asset.name);
          const yahooData = yahooPriceMap[yahooTicker];
          if (yahooData && yahooData.price > 0) {
            currentPrice = yahooData.price;
            changePct24h = yahooData.changePct;
            volume24h = yahooData.volume;
          }
        }

        // Futures fallbacks for indices when regular markets are closed
        if (asset.name === 'US100' && yahooPriceMap['NQ=F'] && yahooPriceMap['NQ=F'].price > 0) {
          if (currentPrice <= 0 || !yahooPriceMap['^NDX'] || yahooPriceMap['^NDX'].price <= 0) {
            currentPrice = yahooPriceMap['NQ=F'].price;
            changePct24h = yahooPriceMap['NQ=F'].changePct;
            volume24h = yahooPriceMap['NQ=F'].volume;
          }
        }
        if (asset.name === 'US30' && yahooPriceMap['YM=F'] && yahooPriceMap['YM=F'].price > 0) {
          if (currentPrice <= 0 || !yahooPriceMap['^DJI'] || yahooPriceMap['^DJI'].price <= 0) {
            currentPrice = yahooPriceMap['YM=F'].price;
            changePct24h = yahooPriceMap['YM=F'].changePct;
            volume24h = yahooPriceMap['YM=F'].volume;
          }
        }

        // Gold spot bounds check: Real Gold spot / PAXG trades between $1800 and $6000 per troy oz in 2026 market.
        if (asset.name === 'XAU/USD' || asset.name === 'GOLD') {
          if (currentPrice > 6000 || currentPrice < 1800) {
            if (cryptoPriceMap['PAXGUSDT'] && cryptoPriceMap['PAXGUSDT'].price >= 1800 && cryptoPriceMap['PAXGUSDT'].price <= 6000) {
              currentPrice = cryptoPriceMap['PAXGUSDT'].price;
              changePct24h = cryptoPriceMap['PAXGUSDT'].changePct;
              volume24h = cryptoPriceMap['PAXGUSDT'].volume;
            } else if (yahooPriceMap['XAUUSD=X'] && yahooPriceMap['XAUUSD=X'].price >= 1800 && yahooPriceMap['XAUUSD=X'].price <= 6000) {
              currentPrice = yahooPriceMap['XAUUSD=X'].price;
              changePct24h = yahooPriceMap['XAUUSD=X'].changePct;
              volume24h = yahooPriceMap['XAUUSD=X'].volume;
            } else if (yahooPriceMap['GC=F'] && yahooPriceMap['GC=F'].price >= 1800 && yahooPriceMap['GC=F'].price <= 6000) {
              currentPrice = yahooPriceMap['GC=F'].price;
              changePct24h = yahooPriceMap['GC=F'].changePct;
              volume24h = yahooPriceMap['GC=F'].volume;
            } else {
              try {
                const paxgRes = await this.fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', {}, 2500);
                if (paxgRes.ok) {
                  const pData = await paxgRes.json();
                  if (pData && Number(pData.lastPrice) >= 1800 && Number(pData.lastPrice) <= 6000) {
                    currentPrice = Number(pData.lastPrice);
                    changePct24h = Number(pData.priceChangePercent || 0);
                    volume24h = Number(pData.volume || 1000);
                  }
                }
              } catch (goldApiErr) {}
            }
          }
        }

        if ((asset.name === 'XAU/USD' || asset.name === 'GOLD') && currentPrice <= 0) {
          const tdKey = process.env.TWELVE_DATA_API_KEY;
          if (tdKey) {
            try {
              const tdRes = await this.fetchWithTimeout(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${tdKey}`, {}, 3000);
              if (tdRes.ok) {
                const tdData = await tdRes.json();
                if (tdData && Number(tdData.price) >= 1800) {
                  currentPrice = Number(tdData.price);
                }
              }
            } catch (e) {}
          }
        }

        if (currentPrice <= 0) {
          try {
            const existing = await this.prisma.marketData.findUnique({ where: { symbol: asset.name } });
            if (existing && Number(existing.bidPrice) > 0) {
              currentPrice = Number(existing.bidPrice);
            }
          } catch (e) {}
        }

        if (currentPrice <= 0) {
          console.warn(`[MarketsService] Skipping DB market update for ${asset.name} because live price is unavailable (${currentPrice}).`);
          continue;
        }
 
        const bidPrice = parseFloat(currentPrice.toFixed(4));
        const askPrice = parseFloat((currentPrice * 1.0005).toFixed(4)); // 0.05% spread
        
        // Cache the metadata in memory
        this.tickerCache[asset.name] = {
          price: currentPrice,
          changePct24h,
          volume24h,
          timestamp: Date.now()
        };

        await this.prisma.marketData.upsert({
          where: { symbol: asset.name },
          update: { bidPrice, askPrice, volume24h, lastUpdated: new Date() },
          create: { symbol: asset.name, bidPrice, askPrice, volume24h, lastUpdated: new Date() },
        });

        // Also update the latest historical candle block close price
        await this.updateLatestCandle(asset.name, bidPrice);
      }

      // 4. Update active signals lifecycle
      const activeSignals = await this.prisma.signal.findMany({
        where: {
          expiresAt: { gt: new Date() }
        }
      });

      for (const signal of activeSignals) {
        const reasoning = signal.aiReasoning as any || {};
        let status = reasoning.status || 'ACTIVE';
        
        // Skip terminal/neutral states
        if (['CLOSED', 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'WAIT'].includes(status)) {
          continue;
        }

        // Get current price of symbol
        const marketData = await this.prisma.marketData.findUnique({
          where: { symbol: signal.symbol }
        });
        if (!marketData) continue;

        const currentPrice = marketData.bidPrice;
        let updatedStatus = status;

        if (status === 'ACTIVE' || status === 'RUNNING') {
          // Directly check for SL or TPs
          if (signal.direction === 'BUY') {
            if (currentPrice <= signal.stopLoss && signal.stopLoss > 0) {
              updatedStatus = 'SL_HIT';
            } else if (currentPrice >= signal.takeProfit2 && signal.takeProfit2 > 0) {
              updatedStatus = 'TP2_HIT';
            } else if (currentPrice >= signal.takeProfit1 && signal.takeProfit1 > 0) {
              updatedStatus = 'TP1_HIT';
            } else {
              updatedStatus = 'RUNNING';
            }
          } else if (signal.direction === 'SELL') {
            if (currentPrice >= signal.stopLoss && signal.stopLoss > 0) {
              updatedStatus = 'SL_HIT';
            } else if (currentPrice <= signal.takeProfit2 && signal.takeProfit2 > 0) {
              updatedStatus = 'TP2_HIT';
            } else if (currentPrice <= signal.takeProfit1 && signal.takeProfit1 > 0) {
              updatedStatus = 'TP1_HIT';
            } else {
              updatedStatus = 'RUNNING';
            }
          }
        }

        if (updatedStatus !== status) {
          console.log(`[SIGNALS LIFECYCLE] Signal ${signal.id} for ${signal.symbol} updated status: ${status} ➔ ${updatedStatus} (Price: ${currentPrice})`);
          await this.prisma.signal.update({
            where: { id: signal.id },
            data: {
              aiReasoning: {
                ...reasoning,
                status: updatedStatus
              }
            }
          });
        }
      }
    } catch (error: any) {
      console.error('[MarketsService] Error updating live prices:', error.message);
    }
  }

  // Cache or append latest prices to historical hourly candles
  private async updateLatestCandle(symbol: string, currentPrice: number) {
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);

    const candle = await this.prisma.historicalCandle.findUnique({
      where: {
        symbol_interval_timestamp: {
          symbol,
          interval: '1h',
          timestamp: currentHour,
        },
      },
    });

    if (candle) {
      await this.prisma.historicalCandle.update({
        where: { id: candle.id },
        data: {
          close: currentPrice,
          high: Math.max(candle.high, currentPrice),
          low: Math.min(candle.low, currentPrice),
        },
      });
    } else {
      await this.prisma.historicalCandle.create({
        data: {
          symbol,
          interval: '1h',
          open: currentPrice,
          high: currentPrice,
          low: currentPrice,
          close: currentPrice,
          volume: 1000,
          timestamp: currentHour,
        },
      });
    }
  }  // Pre-seed 100 hourly candles for each symbol
  private async seedHistoricalCandles() {
    // Force seeding to overwrite any simulated/dummy candles in database with real ones
    console.log('[MarketsService] Seeding database with historical price candles...');
    
    // Purge any old simulated dummy candles from database (which are marked with volume = 5000)
    try {
      const purgeRes = await this.prisma.historicalCandle.deleteMany({
        where: { volume: 5000 }
      });
      if (purgeRes.count > 0) {
        console.log(`[MarketsService] Purged ${purgeRes.count} dummy candles from database.`);
      }
    } catch (e: any) {
      console.warn(`[MarketsService] Failed to purge dummy candles: ${e.message}`);
    }

    for (const asset of this.symbols) {
      let seeded = false;

      // 1. Try Binance (Crypto only)
      if (asset.type === 'crypto' && asset.binanceSymbol) {
        try {
          const res = await this.fetchWithTimeout(`https://api.binance.com/api/v3/klines?symbol=${asset.binanceSymbol}&interval=1h&limit=100`);
          if (res.ok) {
            const data = await res.json();
            for (const item of data) {
              const timestamp = new Date(item[0]);
              await this.prisma.historicalCandle.upsert({
                where: {
                  symbol_interval_timestamp: {
                    symbol: asset.name,
                    interval: '1h',
                    timestamp,
                  },
                },
                update: {
                  open: parseFloat(item[1]),
                  high: parseFloat(item[2]),
                  low: parseFloat(item[3]),
                  close: parseFloat(item[4]),
                  volume: parseFloat(item[5]),
                },
                create: {
                  symbol: asset.name,
                  interval: '1h',
                  open: parseFloat(item[1]),
                  high: parseFloat(item[2]),
                  low: parseFloat(item[3]),
                  close: parseFloat(item[4]),
                  volume: parseFloat(item[5]),
                  timestamp,
                },
              });
            }
            seeded = true;
            console.log(`[MarketsService] Successfully seeded candles for ${asset.name} from Binance.`);
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Failed to seed ${asset.name} from Binance: ${err.message}. Trying Twelve Data.`);
        }
      }

      // 2. Try Twelve Data (Crypto and Stocks/Indices/Forex)
      if (!seeded) {
        const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
        if (twelveDataKey) {
          try {
            const tdSym = this.getTwelveDataSymbol(asset.name);
            const response = await this.fetchWithTimeout(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSym)}&interval=1h&outputsize=100&apikey=${twelveDataKey}`);
            if (response.ok) {
              const data = await response.json();
              const values = data.values || [];
              if (values.length > 0) {
                for (const v of values) {
                  const timestamp = new Date(v.datetime);
                  await this.prisma.historicalCandle.upsert({
                    where: {
                      symbol_interval_timestamp: {
                        symbol: asset.name,
                        interval: '1h',
                        timestamp,
                      },
                    },
                    update: {
                      open: parseFloat(v.open),
                      high: parseFloat(v.high),
                      low: parseFloat(v.low),
                      close: parseFloat(v.close),
                      volume: parseFloat(v.volume || 1000),
                    },
                    create: {
                      symbol: asset.name,
                      interval: '1h',
                      open: parseFloat(v.open),
                      high: parseFloat(v.high),
                      low: parseFloat(v.low),
                      close: parseFloat(v.close),
                      volume: parseFloat(v.volume || 1000),
                      timestamp,
                    },
                  });
                }
                seeded = true;
                console.log(`[MarketsService] Successfully seeded candles for ${asset.name} from Twelve Data.`);
              }
            }
          } catch (err: any) {
            console.warn(`[MarketsService] Twelve Data candle seed failed for ${asset.name}: ${err.message}. Trying Yahoo Finance.`);
          }
        }
      }

      // 3. Try Yahoo Finance (Crypto and Stocks/Indices/Forex)
      if (!seeded) {
        try {
          const yahooTicker = this.getYahooTicker(asset.name);
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1h&range=7d`;
          const res = await this.fetchWithTimeout(url);
          if (res.ok) {
            const data = await res.json();
            const chartResult = data?.chart?.result?.[0];
            if (chartResult) {
              const timestamps = chartResult.timestamp || [];
              const quotes = chartResult.indicators?.quote?.[0] || {};
              const opens = quotes.open || [];
              const highs = quotes.high || [];
              const lows = quotes.low || [];
              const closes = quotes.close || [];
              const volumes = quotes.volume || [];
              
              for (let i = 0; i < timestamps.length; i++) {
                const timestamp = new Date(timestamps[i] * 1000);
                const open = opens[i];
                const close = closes[i];
                const high = highs[i];
                const low = lows[i];
                const volume = volumes[i] || 1000;
                
                if (open !== null && close !== null && high !== null && low !== null) {
                  await this.prisma.historicalCandle.upsert({
                    where: {
                      symbol_interval_timestamp: {
                        symbol: asset.name,
                        interval: '1h',
                        timestamp,
                      },
                    },
                    update: {
                      open: parseFloat(open.toFixed(4)),
                      high: parseFloat(high.toFixed(4)),
                      low: parseFloat(low.toFixed(4)),
                      close: parseFloat(close.toFixed(4)),
                      volume: parseFloat(volume.toFixed(0)),
                    },
                    create: {
                      symbol: asset.name,
                      interval: '1h',
                      open: parseFloat(open.toFixed(4)),
                      high: parseFloat(high.toFixed(4)),
                      low: parseFloat(low.toFixed(4)),
                      close: parseFloat(close.toFixed(4)),
                      volume: parseFloat(volume.toFixed(0)),
                      timestamp,
                    },
                  });
                }
              }
              seeded = true;
              console.log(`[MarketsService] Successfully seeded candles for ${asset.name} from Yahoo Finance.`);
            }
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Yahoo Finance candle seed failed for ${asset.name}: ${err.message}`);
        }
      }

      if (!seeded) {
        console.warn(`[MarketsService] Live candle seeding skipped for ${asset.name}. Will retry during next price poll cycle.`);
      }
    }
    console.log('[MarketsService] Pre-seeding database completed successfully.');
  }

  async getOrFetchCandles(symbol: string, interval: string): Promise<any[]> {
    const rawSymbol = symbol.toUpperCase().trim();
    const baseAsset = rawSymbol.split('/')[0];
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(baseAsset);
    const dbSymbol = isCrypto ? `${baseAsset}/USD` : rawSymbol;
    const cleanSymbol = dbSymbol;
    
    // 1. Try to read from DB first
    let candles = await this.prisma.historicalCandle.findMany({
      where: {
        OR: [
          { symbol: dbSymbol, interval },
          { symbol: baseAsset, interval },
          { symbol: rawSymbol, interval }
        ]
      },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
    
    // 2. If we have at least 50 candles and they are fresh (e.g. last candle is within 3 * interval time), return them!
    const now = new Date();
    let isFresh = false;
    if (candles.length >= 50) {
      const lastCandle = candles[candles.length - 1];
      const diffMs = now.getTime() - lastCandle.timestamp.getTime();
      let maxAgeMs = 3 * 3600 * 1000; // default 3 hours for 1h
      if (interval === '1m') maxAgeMs = 5 * 60 * 1000;
      else if (interval === '3m') maxAgeMs = 15 * 60 * 1000;
      else if (interval === '5m') maxAgeMs = 25 * 60 * 1000;
      else if (interval === '15m') maxAgeMs = 75 * 60 * 1000;
      else if (interval === '30m') maxAgeMs = 150 * 60 * 1000;
      
      if (diffMs < maxAgeMs) {
        isFresh = true;
      }
    }
    
    if (isFresh) {
      return candles;
    }
    
    // 3. Otherwise, fetch real-time from Yahoo Finance (for indices/forex/stocks/commodities) or Binance (for crypto)
    if (isCrypto) {
      // Fetch from Binance
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      try {
        const binanceSym = `${baseAsset}USDT`;
        const res = await this.fetchWithTimeout(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${binanceInterval}&limit=150`);
        if (res.ok) {
          const klines = await res.json();
          // Clear old candles for this symbol+interval to avoid duplicates
          await this.prisma.historicalCandle.deleteMany({
            where: { symbol: cleanSymbol, interval }
          });
          
          const newCandles = [];
          for (const k of klines) {
            const candle = await this.prisma.historicalCandle.create({
              data: {
                symbol: cleanSymbol,
                interval,
                timestamp: new Date(k[0]),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
              }
            });
            newCandles.push(candle);
          }
          return newCandles;
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Failed to fetch live Binance candles for ${cleanSymbol}: ${err.message}`);
      }
    } else {
      let fetchedFromTwelveData = false;
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      if (twelveDataKey) {
        try {
          const tdSym = this.getTwelveDataSymbol(cleanSymbol);
          let tdInterval = interval;
          if (interval === '1h') tdInterval = '1h'; // Twelve Data supports '1h'
          
          const response = await this.fetchWithTimeout(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSym)}&interval=${tdInterval}&outputsize=100&apikey=${twelveDataKey}`);
          if (response.ok) {
            const data = await response.json();
            const values = data.values || [];
            if (values.length > 0) {
              await this.prisma.historicalCandle.deleteMany({
                where: { symbol: cleanSymbol, interval }
              });
              
              const newCandles = [];
              const reversedValues = [...values].reverse(); // reverse chronological -> chronological
              for (const v of reversedValues) {
                const candle = await this.prisma.historicalCandle.create({
                  data: {
                    symbol: cleanSymbol,
                    interval,
                    timestamp: new Date(v.datetime),
                    open: parseFloat(v.open),
                    high: parseFloat(v.high),
                    low: parseFloat(v.low),
                    close: parseFloat(v.close),
                    volume: parseFloat(v.volume || 1000),
                  }
                });
                newCandles.push(candle);
              }
              fetchedFromTwelveData = true;
              console.log(`[MarketsService] Candlesticks fetched and cached from Twelve Data for ${cleanSymbol}.`);
              return newCandles;
            }
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Twelve Data timeseries fetch failed for ${cleanSymbol}: ${err.message}. Falling back to Yahoo Finance.`);
        }
      }

      if (!fetchedFromTwelveData) {
        // Fetch from Yahoo Finance chart API
        try {
          const yahooTicker = this.getYahooTicker(cleanSymbol);
          let yahooInterval = interval;
          if (interval === '1h') yahooInterval = '60m';
          
          let range = '2d';
          if (interval === '1m') range = '1d';
          else if (interval === '3m' || interval === '5m') range = '2d';
          else if (interval === '15m' || interval === '30m') range = '5d';
          else if (interval === '1h') range = '7d';
          
          const res = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${yahooInterval}&range=${range}`);
          if (res.ok) {
            const data = await res.json();
            const chartData = data?.chart?.result?.[0];
            const timestamps = chartData?.timestamp || [];
            const quote = chartData?.indicators?.quote?.[0] || {};
            const opens = quote.open || [];
            const highs = quote.high || [];
            const lows = quote.low || [];
            const closes = quote.close || [];
            const volumes = quote.volume || [];
            
            if (timestamps.length > 0) {
              // Delete old candles for this symbol+interval
              await this.prisma.historicalCandle.deleteMany({
                where: { symbol: cleanSymbol, interval }
              });
              
              const newCandles = [];
              for (let i = 0; i < timestamps.length; i++) {
                if (opens[i] === null || closes[i] === null) continue;
                const candle = await this.prisma.historicalCandle.create({
                  data: {
                    symbol: cleanSymbol,
                    interval,
                    timestamp: new Date(timestamps[i] * 1000),
                    open: parseFloat(opens[i]),
                    high: parseFloat(highs[i]),
                    low: parseFloat(lows[i]),
                    close: parseFloat(closes[i]),
                    volume: parseFloat(volumes[i] || 1000),
                  }
                });
                newCandles.push(candle);
              }
              return newCandles;
            }
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Failed to fetch live Yahoo candles for ${cleanSymbol}: ${err.message}`);
        }
      }
    }
    
    return candles;
  }
}
