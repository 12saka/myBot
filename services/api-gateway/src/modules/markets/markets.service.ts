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

  // Poll live prices every 10 seconds
  @Interval(10000)
  async updateLivePrices() {
    try {
      // 1. Fetch Crypto Prices from Binance
      const binanceCryptoSymbols = this.symbols.filter(s => s.type === 'crypto');
      const cryptoSymbolsQuery = JSON.stringify(binanceCryptoSymbols.map(s => s.binanceSymbol));
      
      let cryptoPriceMap: Record<string, number> = {};
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(cryptoSymbolsQuery)}`);
        if (response.ok) {
          const prices = await response.json();
          for (const item of prices) {
            cryptoPriceMap[item.symbol] = parseFloat(item.price);
          }
        }
      } catch (err: any) {
        console.warn(`[MarketsService] Binance API connection failed. Using fallback data. Error: ${err.message}`);
      }

      // 2. Update Database Records
      for (const asset of this.symbols) {
        let currentPrice = asset.defaultPrice;

        if (asset.type === 'crypto' && asset.binanceSymbol && cryptoPriceMap[asset.binanceSymbol]) {
          currentPrice = cryptoPriceMap[asset.binanceSymbol];
        } else {
          // For Stocks / Forex, simulate high-fidelity random walk updates around typical values
          const dbData = await this.prisma.marketData.findUnique({ where: { symbol: asset.name } });
          const basePrice = dbData ? dbData.bidPrice : asset.defaultPrice;
          const fluctuation = (Math.random() - 0.5) * (asset as any).volatility * 2;
          currentPrice = Math.max(0.001, basePrice + fluctuation);
        }

        const bidPrice = parseFloat(currentPrice.toFixed(4));
        const askPrice = parseFloat((currentPrice * 1.0005).toFixed(4)); // 0.05% spread
        const volume24h = asset.type === 'crypto' ? 24800000 : 1500000;

        await this.prisma.marketData.upsert({
          where: { symbol: asset.name },
          update: { bidPrice, askPrice, volume24h, lastUpdated: new Date() },
          create: { symbol: asset.name, bidPrice, askPrice, volume24h, lastUpdated: new Date() },
        });

        // Also update the latest historical candle block close price
        await this.updateLatestCandle(asset.name, bidPrice);
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
    const count = await this.prisma.historicalCandle.count();
    if (count > 200) {
      console.log('[MarketsService] Historical candle cache is already pre-populated.');
      return;
    }

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
    console.log('[MarketsService] Pre-seeding database completed successfully.');
  }
}
