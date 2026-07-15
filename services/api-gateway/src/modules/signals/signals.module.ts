import { Module, Controller, Get, Post, Body, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import axios from 'axios';

@ApiTags('signals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('signals')
export class SignalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active AI trading signals' })
  async getSignals() {
    // 1. Fetch unexpired signals from database
    const activeSignals = await this.prisma.signal.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSignals.length > 0) {
      return activeSignals;
    }

    // 2. If no active signals are cached, request new signals from Python AI Service
    console.log('[SIGNALS GATEWAY] No active signals in database. Triggering Python AI Service fallback...');
    return [await this.generateSignalRequest('BTC')];
  }

  @Post()
  @ApiOperation({ summary: 'Create a manually generated trading signal' })
  async createSignal(@Body() dto: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    strategy?: string;
    confidence?: number;
    explanation?: string;
  }) {
    const symbol = this.normalizeSymbol(dto.symbol);
    const signal = await this.prisma.signal.create({
      data: {
        symbol,
        direction: dto.direction,
        entryPrice: Number(dto.entryPrice),
        stopLoss: Number(dto.stopLoss),
        takeProfit1: Number(dto.takeProfit1),
        takeProfit2: Number(dto.takeProfit2),
        riskRewardRatio: parseFloat((Math.abs(dto.takeProfit1 - dto.entryPrice) / Math.abs(dto.entryPrice - dto.stopLoss) || 2.0).toFixed(1)),
        winProbability: Number(dto.confidence || 80),
        durationEstimate: '1-2 days',
        aiReasoning: {
          indicators: ['Manually defined structure', 'Support/Resistance breakthrough'],
          explanation: dto.explanation || 'Manual trading signal structured by user analysis.'
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Manual signals last 24h
      },
    });
    return signal;
  }

  @Post('generate')
  @ApiOperation({ summary: 'Request generation of a fresh AI trading signal for a specific market' })
  async generateSignal(@Body() dto: { symbol: string; interval?: string }) {
    const symbol = this.normalizeSymbol(dto.symbol);
    // User triggered manually ➔ force fresh signal generation
    return this.generateSignalRequest(symbol, dto.interval || '1h', true);
  }

  private normalizeSymbol(symbol: string): string {
    const s = symbol.trim().toUpperCase();
    if (['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD'].includes(s)) {
      return s.split('/')[0];
    }
    return s;
  }

  private async generateSignalRequest(symbol: string, interval = '1h', forceFresh = false) {
    // Check if we already have an active unexpired signal for this symbol and timeframe in database
    if (!forceFresh) {
      const existingSignal = await this.prisma.signal.findFirst({
        where: {
          symbol,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingSignal && (existingSignal.aiReasoning as any)?.timeframe === interval) {
        return existingSignal;
      }
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const apiKey = process.env.AI_SERVICE_API_KEY || 'internal-secret-key';
    const cachedCandles = await this.getOrFetchCandles(symbol, interval);

    try {
      let recentNews: any[] = [];
      const finnhubKey = process.env.FINNHUB_API_KEY;
      if (finnhubKey) {
        try {
          const isStock = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'].includes(symbol.toUpperCase());
          let newsUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;
          if (isStock) {
            const fromDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];
            newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
          }
          const newsRes = await axios.get(newsUrl);
          if (Array.isArray(newsRes.data)) {
            recentNews = newsRes.data.slice(0, 5).map((item: any) => ({
              headline: item.headline || '',
              summary: item.summary || '',
              source: item.source || '',
              datetime: Number(item.datetime || 0),
            }));
          }
        } catch (err: any) {
          console.warn(`[SIGNALS GATEWAY] Failed to fetch news for AI predict payload: ${err.message}`);
        }
      }

      const body = {
        symbol,
        timeframe: interval,
        candles: cachedCandles.map(c => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          timestamp: c.timestamp.toISOString(),
        })),
        news: recentNews,
      };

      const signatureHeaders = generateHmacSignature(body, apiKey);

      const res = await axios.post(`${aiServiceUrl}/ai/predict`, body, {
        headers: { 
          'X-AI-API-Key': apiKey,
          ...signatureHeaders
        },
      });

      // Save the returned prediction and Gemini explanations into the database
      const signal = await this.prisma.signal.create({
        data: {
          symbol: res.data.symbol,
          direction: res.data.direction,
          entryPrice: res.data.entry,
          stopLoss: res.data.stop_loss,
          takeProfit1: res.data.take_profit_1,
          takeProfit2: res.data.take_profit_2,
          riskRewardRatio: parseFloat((Math.abs(res.data.take_profit_1 - res.data.entry) / Math.abs(res.data.entry - res.data.stop_loss) || 2.0).toFixed(1)),
          winProbability: parseFloat((res.data.confidence * 100).toFixed(0)), // convert 0.88 -> 88
          durationEstimate: interval === '1d' ? '3-5 days' : (interval === '4h' ? '1-2 days' : '4h'),
          aiReasoning: { 
            indicators: res.data.indicators,
            explanation: res.data.ai_explanation,
            technicals: res.data.technicals,
            structure: res.data.structure,
            scores: res.data.scores,
            indicator_verdicts: res.data.indicator_verdicts || {},
            market_structure_analysis: res.data.market_structure_analysis || '',
            tradingview_idea: res.data.tradingview_idea || '',
            timeframe: interval,
            status: res.data.direction === 'WAIT' ? 'WAIT' : 'ACTIVE'
          },
          expiresAt: new Date(Date.now() + (interval === '1d' ? 3 * 24 : 1 * 4) * 60 * 60 * 1000), 
        },
      });

      return signal;
    } catch (err: any) {
      console.error(`[SIGNALS GATEWAY] Failed to fetch signals for ${symbol} from AI Service:`, err.message);
      throw new Error(`Failed to generate AI signal for ${symbol}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a single signal' })
  async getSignal(@Param('id') id: string) {
    const signal = await this.prisma.signal.findUnique({
      where: { id },
    });
    return signal;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or dismiss an active trading signal' })
  async deleteSignal(@Param('id') id: string) {
    await this.prisma.signal.delete({
      where: { id },
    });
    return { success: true };
  }

  private getYahooTicker(symbol: string): string {
    const mappings: Record<string, string> = {
      'US30': '^DJI',
      'US100': '^NDX',
      'SPX500': '^GSPC',
      'DAX40': '^GDAXI',
      'GOLD': 'GC=F',
      'OIL': 'CL=F',
      'EUR/USD': 'EURUSD=X',
      'GBP/USD': 'GBPUSD=X',
      'USD/JPY': 'USDJPY=X',
    };
    return mappings[symbol] || symbol;
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
    
    // 2. If we have at least 50 candles and they are fresh, return them
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
    
    // 3. Otherwise, fetch real-time from Yahoo Finance or Binance
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(cleanSymbol);
    if (isCrypto) {
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      try {
        const binanceSym = `${cleanSymbol}USDT`;
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${binanceInterval}&limit=150`);
        if (res.ok) {
          const klines = await res.json();
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
        console.warn(`[SignalsController] Failed to fetch live Binance candles for ${cleanSymbol}: ${err.message}`);
      }
    } else {
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
        console.warn(`[SignalsController] Failed to fetch live Yahoo candles for ${cleanSymbol}: ${err.message}`);
      }
    }
    
    return candles;
  }
}

@Module({ controllers: [SignalsController] })
export class SignalsModule {}
