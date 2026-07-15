import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly symbols = [
    { name: 'BTC',    type: 'crypto', binanceSymbol: 'BTCUSDT',  defaultPrice: 64200,   volatility: 50 },
    { name: 'ETH',    type: 'crypto', binanceSymbol: 'ETHUSDT',  defaultPrice: 3180,    volatility: 8 },
    { name: 'SOL',    type: 'crypto', binanceSymbol: 'SOLUSDT',  defaultPrice: 184,     volatility: 1.5 },
    { name: 'BNB',    type: 'crypto', binanceSymbol: 'BNBUSDT',  defaultPrice: 412,     volatility: 1.5 },
    { name: 'XRP',    type: 'crypto', binanceSymbol: 'XRPUSDT',  defaultPrice: 0.62,    volatility: 0.005 },
    { name: 'AAPL',   type: 'stock',  binanceSymbol: null,       defaultPrice: 197,     volatility: 0.6 },
    { name: 'TSLA',   type: 'stock',  binanceSymbol: null,       defaultPrice: 248,     volatility: 1.2 },
    { name: 'NVDA',   type: 'stock',  binanceSymbol: null,       defaultPrice: 875,     volatility: 3.0 },
    { name: 'MSFT',   type: 'stock',  binanceSymbol: null,       defaultPrice: 415,     volatility: 1.0 },
    { name: 'AMZN',   type: 'stock',  binanceSymbol: null,       defaultPrice: 185,     volatility: 0.8 },
    { name: 'US30',   type: 'index',  binanceSymbol: null,       defaultPrice: 39200,   volatility: 80 },
    { name: 'US100',  type: 'index',  binanceSymbol: null,       defaultPrice: 18400,   volatility: 60 },
    { name: 'SPX500', type: 'index',  binanceSymbol: null,       defaultPrice: 5300,    volatility: 15 },
    { name: 'DAX40',  type: 'index',  binanceSymbol: null,       defaultPrice: 18700,   volatility: 70 },
    { name: 'GOLD',   type: 'commodity', binanceSymbol: null,    defaultPrice: 2350,    volatility: 5.0 },
    { name: 'OIL',    type: 'commodity', binanceSymbol: null,    defaultPrice: 78.5,    volatility: 0.4 },
    { name: 'EUR/USD', type: 'forex', binanceSymbol: null,       defaultPrice: 1.085,   volatility: 0.0005 },
    { name: 'GBP/USD', type: 'forex', binanceSymbol: null,       defaultPrice: 1.271,   volatility: 0.0005 },
    { name: 'USD/JPY', type: 'forex', binanceSymbol: null,       defaultPrice: 151.4,   volatility: 0.05 },
  ];

  private tickerCache: Record<string, { price: number; changePct24h: number; volume24h: number }> = {};

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    console.log('[MarketsService] Initializing real-time feeds and database candle cache...');
    this.bootstrapMarketCache();
  }

  private async bootstrapMarketCache() {
    try {
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
      'GOLD': 'GC=F',
      'OIL': 'CL=F',
      'EUR/USD': 'EURUSD=X',
      'GBP/USD': 'GBPUSD=X',
      'USD/JPY': 'USDJPY=X',
      'AAPL': 'AAPL',
      'TSLA': 'TSLA',
      'NVDA': 'NVDA',
      'MSFT': 'MSFT',
      'AMZN': 'AMZN'
    };
    return map[symbol] || symbol;
  }

  public getTwelveDataSymbol(symbol: string): string {
    const map: Record<string, string> = {
      'US30': 'DIA',
      'US100': 'QQQ',
      'SPX500': 'SPY',
      'DAX40': 'EWG',
      'GOLD': 'GLD',
      'OIL': 'USO',
      'EUR/USD': 'EUR/USD',
      'GBP/USD': 'GBP/USD',
      'USD/JPY': 'USD/JPY'
    };
    return map[symbol] || symbol;
  }

  public getTickerStats(): Record<string, { price: number; changePct24h: number; volume24h: number }> {
    return this.tickerCache;
  }

  // Poll live prices every 10 seconds
  @Interval(10000)
  async updateLivePrices() {
    try {
      // 1. Fetch Crypto Prices & 24h Stats from Binance
      const binanceCryptoSymbols = this.symbols.filter(s => s.type === 'crypto');
      const cryptoSymbolsQuery = JSON.stringify(binanceCryptoSymbols.map(s => s.binanceSymbol));
      
      let cryptoPriceMap: Record<string, { price: number; changePct: number; volume: number }> = {};
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(cryptoSymbolsQuery)}`);
        if (response.ok) {
          const stats = await response.json();
          for (const item of stats) {
            cryptoPriceMap[item.symbol] = {
              price: parseFloat(item.lastPrice || 0),
              changePct: parseFloat(item.priceChangePercent || 0),
              volume: parseFloat(item.quoteVolume || 0)
            };
          }
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Binance 24h stats API connection failed: ${err.message}`);
      }

      // 2. Fetch Stocks, Indices, Commodities, and Forex from Yahoo Finance chart API in parallel (v8 is open and free)
      // 2. Fetch Stocks, Indices, Commodities, and Forex
      const nonCryptoSymbols = this.symbols.filter(s => s.type !== 'crypto');
      let yahooPriceMap: Record<string, { price: number; changePct: number; volume: number }> = {};
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      let fetchedFromTwelveData = false;

      if (twelveDataKey) {
        try {
          const symbolsQuery = nonCryptoSymbols.map(s => this.getTwelveDataSymbol(s.name)).join(',');
          const response = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolsQuery)}&apikey=${twelveDataKey}`);
          if (response.ok) {
            const data = await response.json();
            for (const asset of nonCryptoSymbols) {
              const tdSym = this.getTwelveDataSymbol(asset.name);
              const tdData = data[tdSym] || data; // Handle both multi-symbol dictionary and single-symbol objects
              if (tdData && tdData.price) {
                const yahooTicker = this.getYahooTicker(asset.name);
                yahooPriceMap[yahooTicker] = {
                  price: parseFloat(tdData.price),
                  changePct: parseFloat(tdData.percent_change || 0),
                  volume: parseFloat(tdData.volume || 100000)
                };
              }
            }
            fetchedFromTwelveData = true;
            console.log('[MarketsService] Live prices updated successfully using Twelve Data API.');
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Twelve Data quotes API failed: ${err.message}. Falling back to Yahoo Finance.`);
        }
      }

      if (!fetchedFromTwelveData) {
        try {
          await Promise.all(nonCryptoSymbols.map(async (asset) => {
            try {
              const yahooTicker = this.getYahooTicker(asset.name);
              const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1m&range=1d`);
              if (response.ok) {
                const data = await response.json();
                const meta = data?.chart?.result?.[0]?.meta;
                if (meta) {
                  const price = parseFloat(meta.regularMarketPrice || meta.previousClose || asset.defaultPrice);
                  const prevClose = parseFloat(meta.chartPreviousClose || meta.previousClose || price);
                  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0.0;
                  yahooPriceMap[yahooTicker] = {
                    price,
                    changePct: parseFloat(changePct.toFixed(2)),
                    volume: parseFloat(meta.regularMarketVolume || 100000)
                  };
                }
              }
            } catch (err: any) {
              console.warn(`[MarketsService] Failed to fetch live price for ${asset.name} from Yahoo Finance: ${err.message}`);
            }
          }));
        } catch (err: any) {
          console.warn(`[MarketsService] Yahoo Finance parallel chart fetch failed: ${err.message}`);
        }
      }
 
      // 3. Update Database Records & Populate in-memory Cache
      for (const asset of this.symbols) {
        let currentPrice = asset.defaultPrice;
        let changePct24h = 0;
        let volume24h = 1500000;

        if (asset.type === 'crypto' && asset.binanceSymbol) {
          const binanceData = cryptoPriceMap[asset.binanceSymbol];
          if (binanceData) {
            currentPrice = binanceData.price;
            changePct24h = binanceData.changePct;
            volume24h = binanceData.volume;
          }
        } else {
          const yahooTicker = this.getYahooTicker(asset.name);
          const yahooData = yahooPriceMap[yahooTicker];
          if (yahooData) {
            currentPrice = yahooData.price;
            changePct24h = yahooData.changePct;
            volume24h = yahooData.volume;
          }
        }
 
        const bidPrice = parseFloat(currentPrice.toFixed(4));
        const askPrice = parseFloat((currentPrice * 1.0005).toFixed(4)); // 0.05% spread
        
        // Cache the metadata in memory
        this.tickerCache[asset.name] = {
          price: currentPrice,
          changePct24h,
          volume24h
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

        if (status === 'ACTIVE') {
          // Check if entry price zone has been reached/crossed
          const entryBoundLower = signal.entryPrice * 0.998;
          const entryBoundUpper = signal.entryPrice * 1.002;
          if (currentPrice >= entryBoundLower && currentPrice <= entryBoundUpper) {
            updatedStatus = 'RUNNING';
          }
        } else if (status === 'RUNNING') {
          // Check for SL or TPs
          if (signal.direction === 'BUY') {
            if (currentPrice <= signal.stopLoss) {
              updatedStatus = 'SL_HIT';
            } else if (currentPrice >= signal.takeProfit2) {
              updatedStatus = 'TP2_HIT';
            } else if (currentPrice >= signal.takeProfit1) {
              updatedStatus = 'TP1_HIT';
            }
          } else { // SELL
            if (currentPrice >= signal.stopLoss) {
              updatedStatus = 'SL_HIT';
            } else if (currentPrice <= signal.takeProfit2) {
              updatedStatus = 'TP2_HIT';
            } else if (currentPrice <= signal.takeProfit1) {
              updatedStatus = 'TP1_HIT';
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
  }

  // Pre-seed 100 hourly candles for each symbol
  private async seedHistoricalCandles() {
    // Force seeding to overwrite any simulated/dummy candles in database with real ones

    console.log('[MarketsService] Seeding database with historical price candles...');
    
    for (const asset of this.symbols) {
      if (asset.type === 'crypto' && asset.binanceSymbol) {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${asset.binanceSymbol}&interval=1h&limit=100`);
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
                update: {},
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
            continue;
          }
        } catch (err: any) {
          console.warn(`[MarketsService] Failed to seed ${asset.name} from Binance: ${err.message}`);
        }
      }

      // Non-crypto: Fetch from Yahoo Finance chart API
      let seededFromYahoo = false;
      try {
        const yahooTicker = this.getYahooTicker(asset.name);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1h&range=7d`;
        const res = await fetch(url);
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
                  update: {},
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
            seededFromYahoo = true;
            console.log(`[MarketsService] Successfully seeded candles for ${asset.name} from Yahoo Finance.`);
          }
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Yahoo Finance candle seed failed for ${asset.name}: ${err.message}`);
      }

      if (!seededFromYahoo) {
        // Fallback: Seed simulated random walk data
        let walkPrice = asset.defaultPrice;
        const baseTime = new Date();
        baseTime.setMinutes(0, 0, 0);

        for (let i = 100; i >= 0; i--) {
          const timestamp = new Date(baseTime.getTime() - i * 60 * 60 * 1000);
          const change = (Math.random() - 0.5) * (asset.name === 'NVDA' ? 8.0 : asset.name === 'EUR/USD' ? 0.001 : 1.5);
          const open = walkPrice;
          walkPrice += change;
          const close = walkPrice;
          const high = Math.max(open, close) + Math.random() * (asset.name === 'EUR/USD' ? 0.0005 : 0.5);
          const low = Math.min(open, close) - Math.random() * (asset.name === 'EUR/USD' ? 0.0005 : 0.5);

          await this.prisma.historicalCandle.upsert({
            where: {
              symbol_interval_timestamp: {
                symbol: asset.name,
                interval: '1h',
                timestamp,
              },
            },
            update: {},
            create: {
              symbol: asset.name,
              interval: '1h',
              open: parseFloat(open.toFixed(4)),
              high: parseFloat(high.toFixed(4)),
              low: parseFloat(low.toFixed(4)),
              close: parseFloat(close.toFixed(4)),
              volume: 5000,
              timestamp,
            },
          });
        }
      }
    }
    console.log('[MarketsService] Pre-seeding database completed successfully.');
  }

  async getOrFetchCandles(symbol: string, interval: string): Promise<any[]> {
    let cleanSymbol = symbol.toUpperCase().trim();
    const isForex = cleanSymbol.includes('/');
    if (!isForex) {
      cleanSymbol = cleanSymbol.replace('/USD', '');
    }
    
    // 1. Try to read from DB first
    let candles = await this.prisma.historicalCandle.findMany({
      where: { symbol: cleanSymbol, interval },
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
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(cleanSymbol);
    if (isCrypto) {
      // Fetch from Binance
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      try {
        const binanceSym = `${cleanSymbol}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${binanceInterval}&limit=150`);
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
          
          const response = await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSym)}&interval=${tdInterval}&outputsize=100&apikey=${twelveDataKey}`);
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
          
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${yahooInterval}&range=${range}`);
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
