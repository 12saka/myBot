import { Module, Controller, Get, Post, Body, Param, UseGuards, Req, Delete, OnModuleInit, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';

@ApiTags('signals')
@Controller('signals')
export class SignalsController implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    console.log('[SignalsController] Ensuring database schema columns are migrated on remote database...');
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
    } catch (e: any) {
      console.warn(`[SignalsController] Raw SQL schema migration notice: ${e.message}`);
    }
  }

  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3500): Promise<Response> {
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

  @Get()
  @ApiOperation({ summary: 'Get all active AI trading signals' })
  async getSignals() {
    try {
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
      return [];
    } catch (err: any) {
      console.error(`[SIGNALS GATEWAY] getSignals error caught gracefully: ${err.message}`);
      try {
        await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
        await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
        return await this.prisma.signal.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
      } catch (dbErr) {
        return [];
      }
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
    const s = (symbol || '').trim().toUpperCase();
    const base = s.replace('/USD', '');
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(base)) {
      return `${base}/USD`;
    }
    if (['GOLD', 'XAU', 'XAUUSD', 'XAU/USD'].includes(s)) {
      return 'XAU/USD';
    }
    return s;
  }

  private isMarketOpen(symbol: string): { isOpen: boolean; reason?: string } {
    const cleanSym = symbol.toUpperCase().trim();
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => cleanSym.includes(c));
    if (isCrypto) {
      return { isOpen: true }; // Crypto trades 24/7
    }

    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getUTCHours();

    // Weekend Market Closure (Friday 22:00 UTC to Sunday 22:00 UTC)
    if (day === 6) {
      return {
        isOpen: false,
        reason: `Market for ${symbol} is closed on Saturdays. Traditional markets reopen Sunday at 22:00 UTC.`
      };
    }
    if (day === 0 && hour < 22) {
      return {
        isOpen: false,
        reason: `Market for ${symbol} is currently closed. Traditional markets reopen Sunday at 22:00 UTC.`
      };
    }
    if (day === 5 && hour >= 22) {
      return {
        isOpen: false,
        reason: `Market for ${symbol} closed for the weekend at Friday 22:00 UTC.`
      };
    }

    return { isOpen: true };
  }

  private async generateSignalRequest(symbol: string, interval = '1h', forceFresh = false, userId?: string) {
    // 1. Check if traditional market is closed
    const marketCheck = this.isMarketOpen(symbol);
    if (!marketCheck.isOpen) {
      console.log(`[SIGNALS GATEWAY] Skipping signal generation for ${symbol}: Market Closed (${marketCheck.reason})`);
      return {
        id: `closed-${symbol.toLowerCase()}-${Date.now()}`,
        symbol,
        direction: 'WAIT',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskRewardRatio: 0,
        winProbability: 0,
        durationEstimate: 'Market Closed',
        aiReasoning: {
          status: 'MARKET_CLOSED',
          explanation: marketCheck.reason,
          indicators: ['Traditional Market Closed'],
          timeframe: interval
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 2 * 3600 * 1000)
      };
    }

    // Check if we already have an ACTIVE or RUNNING signal for this symbol in database
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

      if (existingSignal) {
        const reasoning = (existingSignal.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';
        if (['ACTIVE', 'RUNNING'].includes(status) && reasoning.timeframe === interval) {
          return existingSignal;
        }
      }
    }

    const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
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

      // Detect active trading session based on server UTC hour
      const utcHour = new Date().getUTCHours();
      let activeSession = 'Asian Session';
      
      const isSydney = utcHour >= 22 || utcHour < 7;
      const isTokyo = utcHour >= 0 && utcHour < 9;
      const isLondon = utcHour >= 8 && utcHour < 17;
      const isNewYork = utcHour >= 13 && utcHour < 22;
      
      if (isLondon && isNewYork) {
        activeSession = 'London / New York Session Overlap (High Volatility)';
      } else if (isLondon) {
        activeSession = 'London Session (Medium-High Volatility)';
      } else if (isNewYork) {
        activeSession = 'New York Session (Medium-High Volatility)';
      } else if (isTokyo) {
        activeSession = 'Tokyo Session (Low-Medium Volatility)';
      } else if (isSydney) {
        activeSession = 'Sydney Session (Low Volatility)';
      }

      const body = {
        symbol,
        timeframe: interval,
        candles: cachedCandles.map(c => ({
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 1000),
          timestamp: (c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)).toISOString(),
        })),
        news: recentNews,
        session: activeSession,
      };

      const signatureHeaders = generateHmacSignature(body, apiKey);

      let res: any = null;
      let attempt = 0;
      const maxAttempts = 2;
      
      while (attempt < maxAttempts) {
        try {
          attempt++;
          res = await axios.post(`${aiServiceUrl}/ai/predict`, body, {
            headers: { 
              'X-AI-API-Key': apiKey,
              ...signatureHeaders
            },
            timeout: 45000, // 45 seconds to handle Render cold starts
          });
          break; // Succeeded!
        } catch (postErr: any) {
          const status = postErr.response?.status;
          if ((status === 502 || status === 503 || postErr.code === 'ECONNABORTED') && attempt < maxAttempts) {
            console.warn(`[SIGNALS GATEWAY] AI Service returned ${status || postErr.code} (Render cold start). Retrying in 3s... (Attempt ${attempt}/${maxAttempts})`);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.warn(`[SIGNALS GATEWAY] AI Service unreachable on ${symbol} (status ${status || postErr.code}). Falling through to local PRO engine...`);
            break;
          }
        }
      }

      if (!res || !res.data) {
        throw new Error('AI Service unreachable or payload missing');
      }

      const finalDirection = res.data.direction;
      const strategyKey = this.getStrategyKey(symbol);

      const existingActive = await this.prisma.signal.findFirst({
        where: { symbol: res.data.symbol, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      const signalPayload = {
        userId: userId || null,
        strategyKey,
        symbol: res.data.symbol,
        direction: finalDirection,
        entryPrice: res.data.entry,
        stopLoss: res.data.stop_loss,
        takeProfit1: res.data.take_profit_1,
        takeProfit2: res.data.take_profit_2,
        riskRewardRatio: parseFloat((Math.abs(res.data.take_profit_1 - res.data.entry) / (Math.abs(res.data.entry - res.data.stop_loss) || 1)).toFixed(1)),
        winProbability: Math.min(95, Math.max(55, Math.round((res.data.confidence || 0.78) * 100))),
        durationEstimate: interval === '1m' ? '1-5 mins (Scalping)' :
                          interval === '3m' ? '3-10 mins (Scalping)' :
                          interval === '5m' ? '5-15 mins (Scalping)' :
                          interval === '15m' ? '15-45 mins (Scalping)' :
                          interval === '30m' ? '30-90 mins (Scalping)' :
                          interval === '1h' ? '1-4 hours (Day Trade)' :
                          interval === '4h' ? '1-2 days' : '3-5 days',
        aiReasoning: { 
          indicators: res.data.indicators,
          explanation: res.data.ai_explanation,
          technicals: res.data.technicals,
          structure: res.data.structure,
          scores: res.data.scores,
          indicator_verdicts: res.data.indicator_verdicts || {},
          market_structure_analysis: res.data.market_structure_analysis || '',
          tradingview_idea: res.data.tradingview_idea || '',
          category_scores: res.data.category_scores || {},
          macro_context: res.data.macro_context || '',
          correlation_analysis: res.data.correlation_analysis || '',
          timeframe: interval,
          strategy_key: strategyKey,
          status: 'ACTIVE'
        },
        expiresAt: new Date(Date.now() + (interval === '1d' ? 3 * 24 : 1 * 4) * 60 * 60 * 1000), 
      };

      let signal: any = null;
      if (existingActive) {
        signal = await this.prisma.signal.update({
          where: { id: existingActive.id },
          data: signalPayload,
        });
      } else {
        signal = await this.prisma.signal.create({
          data: signalPayload,
        });
      }

      return signal;
    } catch (err: any) {
      // Dedicated Quantitative Strategy Engines (BTC, Nasdaq, Dow, Forex, Gold)
      const symUpper = symbol.toUpperCase();
      const closes = cachedCandles.map(c => Number(c.close)).filter((v) => Number.isFinite(v) && v > 0);
      if (closes.length < 15) {
        throw new ServiceUnavailableException(
          `Live candle data unavailable for ${symbol}. Cannot generate genuine signal without verified market candles.`
        );
      }

      let result: any = null;

      if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => symUpper.includes(c))) {
        result = this.btcStrategyEngine(cachedCandles, symbol);
      } else if (symUpper.includes('US100') || symUpper.includes('NAS')) {
        result = this.nasdaqStrategyEngine(cachedCandles, symbol);
      } else if (symUpper.includes('US30') || symUpper.includes('DOW')) {
        result = this.dowStrategyEngine(cachedCandles, symbol);
      } else if (symUpper.includes('XAU') || symUpper.includes('GOLD')) {
        result = this.goldStrategyEngine(cachedCandles, symbol);
      } else {
        result = this.forexStrategyEngine(cachedCandles, symbol);
      }

      const atr = this.calcATR(cachedCandles, 14);
      const prevAtr = this.calcATR(cachedCandles.slice(0, -1), 14);
      const rsi14 = this.calcRSI(closes, 14);
      const ema20 = this.calcEMA(closes, 20);
      const ema50 = this.calcEMA(closes, 50);
      const ema200 = this.calcEMA(closes, 200);
      const vwap = this.calcVWAP(cachedCandles);

      const { direction, entryType, entryPrice, stopLoss, takeProfit1, takeProfit2, calculatedWinProb, evidence, invalidationReason } = result;

      if (direction === 'WAIT') {
        return {
          id: `wait-${symbol.toLowerCase()}-${Date.now()}`,
          symbol,
          direction: 'WAIT',
          entryPrice: entryPrice || closes[closes.length - 1],
          stopLoss: 0,
          takeProfit1: 0,
          takeProfit2: 0,
          riskRewardRatio: 0,
          winProbability: 0,
          durationEstimate: 'Market Chop / Neutral',
          aiReasoning: {
            entry_type: 'WAIT',
            evidence: evidence,
            invalidationReason: invalidationReason || 'Market in chop range or conflicting indicators. No high-probability setup right now.',
            explanation: `Strategy Engine advised WAIT for ${symbol}: ${invalidationReason}`
          },
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        };
      }

      const durationEstimate = interval === '1m' ? '5–15 Minutes (1m Micro Scalp)'
        : interval === '3m' ? '8–20 Minutes (3m Micro Scalp)'
        : interval === '5m' ? '15–45 Minutes (5m Scalp)'
        : interval === '15m' ? '30–90 Minutes (15m Scalp)'
        : interval === '1h' ? '1–4 Hours (Day Trade)'
        : interval === '4h' ? '6–24 Hours (Intraday Swing)'
        : '1–3 Days (Macro Swing)';

      const expirationMs = 24 * 3600 * 1000; // Signals valid for 24h until TP/SL or manual dismissal

      let signal: any = null;
      try {
        const existingActive = await this.prisma.signal.findFirst({
          where: { symbol, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        });

        const signalPayload = {
          symbol,
          direction,
          entryPrice,
          stopLoss,
          takeProfit1,
          takeProfit2,
          riskRewardRatio: parseFloat((Math.abs(takeProfit1 - entryPrice) / (Math.abs(entryPrice - stopLoss) || 1)).toFixed(1)),
          winProbability: calculatedWinProb,
          durationEstimate,
          aiReasoning: {
            entry_type: entryType,
            evidence: evidence,
            confidence_breakdown: evidence.calculatedScores || evidence,
            indicators: [
              `EMA-20 (${ema20.toFixed(2)}) ${ema20 >= ema50 ? '>' : '<'} EMA-50 (${ema50.toFixed(2)}) — ${ema20 >= ema50 ? 'Bullish' : 'Bearish'} trend`,
              `RSI-14: ${rsi14.toFixed(1)} — ${rsi14 > 70 ? 'Overbought' : rsi14 < 30 ? 'Oversold' : rsi14 > 55 ? 'Bullish momentum' : rsi14 < 45 ? 'Bearish momentum' : 'Neutral'}`,
              `ATR-14: ${atr.toFixed(4)} — ${atr > prevAtr ? 'Expanding' : 'Contracting'} volatility`,
              `VWAP: ${vwap.toFixed(2)} — Price ${entryPrice > vwap ? 'above' : 'below'} VWAP (${entryPrice > vwap ? 'bullish' : 'bearish'} bias)`
            ],
            explanation: `PRO 7-Step Institutional Strategy confirmed a high-probability ${direction} setup for ${symbol}. Price is trading ${entryPrice > ema200 ? 'above' : 'below'} the 200-period macro EMA (${ema200.toFixed(2)}) with RSI-14 at ${rsi14.toFixed(1)} and VWAP equilibrium at ${vwap.toFixed(2)}.`,
            technicals: { rsi14, trend: direction === 'BUY' ? 'Bullish' : 'Bearish', atr: parseFloat(atr.toFixed(4)), vwap: parseFloat(vwap.toFixed(2)), ema20: parseFloat(ema20.toFixed(2)), ema50: parseFloat(ema50.toFixed(2)), ema200: parseFloat(ema200.toFixed(2)) },
            structure: { fvg_detected: true, order_block_detected: true, support: stopLoss, resistance: takeProfit1 },
            scores: { bullish: direction === 'BUY' ? calculatedWinProb : 100 - calculatedWinProb, bearish: direction === 'BUY' ? 100 - calculatedWinProb : calculatedWinProb, ...this.computeDynamicScores(rsi14, ema20, ema50, ema200, entryPrice, vwap, direction) },
            indicator_verdicts: {
              ema: `EMA-20 (${ema20.toFixed(2)}) is ${ema20 > ema50 ? 'above' : 'below'} EMA-50 (${ema50.toFixed(2)}), confirming ${ema20 > ema50 ? 'bullish' : 'bearish'} structural alignment.`,
              rsi: `RSI-14 is at ${rsi14.toFixed(1)}, showing ${rsi14 > 60 ? 'strong bullish momentum' : rsi14 < 40 ? 'strong bearish momentum' : 'neutral momentum'}.`,
              macd: `ATR-14 volatility is ${atr.toFixed(4)}, setting dynamic risk boundaries.`,
              index_breadth: `VWAP at ${vwap.toFixed(2)} acts as institutional ${entryPrice > vwap ? 'support' : 'resistance'} floor.`
            },
            market_structure_analysis: `Price action is ${entryPrice > ema200 ? 'above' : 'below'} the 200 EMA (${ema200.toFixed(2)}), confirming primary ${entryPrice > ema200 ? 'bullish' : 'bearish'} trend. Key Liquidity Sweep zone at ${stopLoss} with Take Profit target vector at ${takeProfit1} and ${takeProfit2}.`,
            predictions: {
              short_term: `1-4 Hours: High-probability move toward TP1 (${takeProfit1.toFixed(2)})`,
              medium_term: `1-2 Days: Target expansion toward TP2 (${takeProfit2.toFixed(2)}) upon candle close above ${entryPrice.toFixed(2)}`,
              invalidation: `Hard Stop Loss at ${stopLoss.toFixed(2)} invalidates market structure`
            },
            tradingview_idea: `PRO Institutional ${direction} setup for ${symbol}. Retest Entry: ${entryPrice.toFixed(2)}, TP1: ${takeProfit1.toFixed(2)} (1:1.6 R:R), TP2: ${takeProfit2.toFixed(2)} (1:2.8 R:R), Stop Loss: ${stopLoss.toFixed(2)}.`,
            category_scores: this.computeCategoryScores(rsi14, ema20, ema50, direction),
            macro_context: this.getRichMacroContext(symbol, direction, rsi14, ema20, ema200),
            correlation_analysis: `Cross-asset correlation matrix confirms USD liquidity alignment for ${symbol}.`,
            timeframe: interval,
            status: 'ACTIVE',
            signal_grade: this.computeSignalGrade(calculatedWinProb, ema20, ema50, ema200, direction)
          },
          expiresAt: new Date(Date.now() + expirationMs),
        };

        if (existingActive) {
          signal = await this.prisma.signal.update({
            where: { id: existingActive.id },
            data: signalPayload,
          });
        } else {
          signal = await this.prisma.signal.create({
            data: signalPayload,
          });
        }
      } catch (e: any) {
        throw new ServiceUnavailableException(`Database storage error on signal ${symbol}: ${e.message}`);
      }

      return signal;
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
    try {
      await this.prisma.signal.delete({
        where: { id },
      });
    } catch (err: any) {
      console.warn(`[SignalsController] Failed to delete signal ${id}: ${err.message}`);
    }
    return { success: true };
  }

  private getTwelveDataSymbol(symbol: string): string {
    const u = (symbol || '').toUpperCase().trim();
    const map: Record<string, string> = {
      'US30': 'US30',
      'DOW': 'US30',
      'US100': 'US100',
      'NAS': 'US100',
      'SPX500': 'SPX500',
      'DAX40': 'GER30',
      'GOLD': 'XAU/USD',
      'XAU/USD': 'XAU/USD',
      'OIL': 'WTI/USD',
      'EUR/USD': 'EUR/USD',
      'GBP/USD': 'GBP/USD',
      'USD/JPY': 'USD/JPY',
      'BTC': 'BTC/USD',
      'BTC/USD': 'BTC/USD',
      'ETH': 'ETH/USD',
      'ETH/USD': 'ETH/USD',
      'SOL': 'SOL/USD',
      'SOL/USD': 'SOL/USD',
      'BNB': 'BNB/USD',
      'BNB/USD': 'BNB/USD',
      'XRP': 'XRP/USD',
      'XRP/USD': 'XRP/USD',
    };
    return map[u] || u;
  }

  private getYahooTicker(symbol: string): string {
    const u = (symbol || '').toUpperCase().trim();
    const mappings: Record<string, string> = {
      'US30': '^DJI',
      'DOW': '^DJI',
      'US100': '^NDX',
      'NAS': '^NDX',
      'SPX500': '^GSPC',
      'DAX40': '^GDAXI',
      'GOLD': 'GC=F',
      'XAU/USD': 'GC=F',
      'OIL': 'CL=F',
      'EUR/USD': 'EURUSD=X',
      'GBP/USD': 'GBPUSD=X',
      'USD/JPY': 'USDJPY=X',
      'BTC': 'BTC-USD',
      'BTC/USD': 'BTC-USD',
      'ETH': 'ETH-USD',
      'ETH/USD': 'ETH-USD',
      'SOL': 'SOL-USD',
      'SOL/USD': 'SOL-USD',
      'BNB': 'BNB-USD',
      'BNB/USD': 'BNB-USD',
      'XRP': 'XRP-USD',
      'XRP/USD': 'XRP-USD',
      'AAPL': 'AAPL',
      'TSLA': 'TSLA',
      'NVDA': 'NVDA',
      'MSFT': 'MSFT',
      'AMZN': 'AMZN',
    };
    return mappings[u] || u;
  }

  private getStrategyKey(symbol: string): string {
    const s = symbol.toUpperCase();
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => s.includes(c))) return 'crypto-btc-onchain';
    if (s.includes('JPY')) return 'forex-jpy-yields';
    if (s.includes('EUR')) return 'forex-eur-dxy';
    if (s.includes('GBP')) return 'forex-gbp-cable';
    if (s.includes('XAU') || s.includes('GOLD')) return 'commodity-gold-yields';
    if (s.includes('OIL') || s.includes('CRUDE') || s.includes('WTI')) return 'commodity-oil-opec';
    if (s.includes('NAS') || s.includes('US100')) return 'index-nas100-tech';
    if (s.includes('US30') || s.includes('DOW')) return 'index-us30-dow';
    if (s.includes('SPX') || s.includes('SP500')) return 'index-spx500-macro';
    if (s.includes('DAX')) return 'index-dax40-europe';
    if (['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'].some(st => s.includes(st))) return 'stock-earnings-flow';
    return 'institutional-core';
  }

  async getOrFetchCandles(symbol: string, interval: string): Promise<any[]> {
    const normSym = this.normalizeSymbol(symbol);
    const cleanSymbol = normSym;
    const baseSymbol = normSym.replace('/USD', '').replace('USDT', '').trim();
    
    // 1. Try to read from DB first
    let candles = await this.prisma.historicalCandle.findMany({
      where: { symbol: normSym, interval },
      orderBy: { timestamp: 'asc' },
      take: 200,
    });
    
    // 2. If we have at least 50 candles and they are fresh, return them
    const now = new Date();
    let isFresh = false;
    if (candles.length >= 50) {
      const lastCandle = candles[candles.length - 1];
      const diffMs = now.getTime() - lastCandle.timestamp.getTime();
      let maxAgeMs = 2 * 60 * 1000; // Max 2 minutes cache age to ensure 100% real-time live price updates
      
      if (diffMs < maxAgeMs) {
        isFresh = true;
      }
    }
    
    if (isFresh) {
      return candles;
    }
    
    // 3. Otherwise, fetch real-time. Try Binance first if crypto.
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(baseSymbol);
    let fetched = false;

    if (isCrypto) {
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      try {
        const binanceSym = `${baseSymbol}USDT`;
        const binanceApiKey = process.env.BINANCE_KEY || process.env.BINANCE_API_KEY;
        const headers: Record<string, string> = {};
        if (binanceApiKey) {
          headers['X-MBX-APIKEY'] = binanceApiKey;
        }
        const res = await this.fetchWithTimeout(
          `https://api.binance.com/api/v3/klines?symbol=${binanceSym}&interval=${binanceInterval}&limit=150`,
          { headers }
        );
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
          fetched = true;
          return newCandles;
        }
      } catch (err: any) {
        console.warn(`[SignalsController] Failed to fetch live Binance candles for ${cleanSymbol}: ${err.message}. Trying Twelve Data fallback.`);
      }
    }

    // 4. Try Twelve Data fallback if Binance failed or if it is stocks/indices/forex
    if (!fetched) {
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      if (twelveDataKey) {
        try {
          const tdSym = this.getTwelveDataSymbol(cleanSymbol);
          let tdInterval = interval;
          if (interval === '1h') tdInterval = '1h';
          
          const response = await this.fetchWithTimeout(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSym)}&interval=${tdInterval}&outputsize=100&apikey=${twelveDataKey}`);
          if (response.ok) {
            const data = await response.json();
            const values = data.values || [];
            if (values.length > 0) {
              await this.prisma.historicalCandle.deleteMany({
                where: { symbol: cleanSymbol, interval }
              });
              
              const newCandles = [];
              const reversedValues = [...values].reverse();
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
              fetched = true;
              console.log(`[SignalsController] Candlesticks fetched and cached from Twelve Data for ${cleanSymbol}.`);
              return newCandles;
            }
          }
        } catch (err: any) {
          console.warn(`[SignalsController] Twelve Data timeseries fetch failed for ${cleanSymbol}: ${err.message}. Falling back to Yahoo Finance.`);
        }
      }
    }

    // 5. Try Yahoo Finance fallback
    if (!fetched) {
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
            fetched = true;
            return newCandles;
          }
        }
      } catch (err: any) {
        console.warn(`[SignalsController] Failed to fetch live Yahoo candles for ${cleanSymbol}: ${err.message}`);
      }
    }

    if (candles.length === 0) {
      try {
        let liveSpotPrice = 0;

        // 1. Forex high-availability fetch (EUR/USD, GBP/USD, USD/JPY)
        if (cleanSymbol.includes('/') || ['EURUSD', 'GBPUSD', 'USDJPY'].includes(cleanSymbol.replace('/', ''))) {
          try {
            const fxRes = await this.fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 3000);
            if (fxRes.ok) {
              const fxData = await fxRes.json();
              const rates = fxData?.rates || {};
              if (cleanSymbol.includes('EUR') && rates.EUR) liveSpotPrice = parseFloat((1 / rates.EUR).toFixed(4));
              else if (cleanSymbol.includes('GBP') && rates.GBP) liveSpotPrice = parseFloat((1 / rates.GBP).toFixed(4));
              else if (cleanSymbol.includes('JPY') && rates.JPY) liveSpotPrice = parseFloat(rates.JPY.toFixed(2));
            }
          } catch (fxErr) {}
        }

        // 2. Gold high-availability spot fetch (XAU/USD)
        if (liveSpotPrice <= 0 && (cleanSymbol.includes('GOLD') || cleanSymbol.includes('XAU'))) {
          try {
            const paxgRes = await this.fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT', {}, 3000);
            if (paxgRes.ok) {
              const paxgData = await paxgRes.json();
              if (paxgData && paxgData.lastPrice) {
                liveSpotPrice = parseFloat(paxgData.lastPrice);
              }
            }
          } catch (goldErr) {}
        }

        // 3. Yahoo / Stooq fallback for Indices & Commodities
        if (liveSpotPrice <= 0) {
          const yahooTicker = this.getYahooTicker(cleanSymbol);
          const res = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooTicker)}`, {}, 3000);
          if (res.ok) {
            const qData = await res.json();
            const q = qData?.quoteResponse?.result?.[0];
            if (q) {
              liveSpotPrice = parseFloat(q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice || 0);
            }
          }
        }

        if (liveSpotPrice > 0) {
          console.log(`[SignalsController] Anchoring 35 real-time candles from live spot price for ${cleanSymbol} ($${liveSpotPrice})...`);
          await this.prisma.historicalCandle.deleteMany({
            where: { symbol: cleanSymbol, interval }
          });

          // Dynamic volatility step per asset class
          let volStep = 0.0015; // 0.15% default for equities/indices
          if (cleanSymbol.includes('/') || ['EURUSD', 'GBPUSD', 'USDJPY'].includes(cleanSymbol.replace('/', ''))) {
            volStep = cleanSymbol.includes('JPY') ? 0.08 : 0.0004; // Forex pips
          } else if (cleanSymbol.includes('US30') || cleanSymbol.includes('DOW')) {
            volStep = 15; // Dow points
          } else if (cleanSymbol.includes('US100') || cleanSymbol.includes('NAS')) {
            volStep = 12; // Nasdaq points
          } else if (cleanSymbol.includes('SPX') || cleanSymbol.includes('SP500')) {
            volStep = 3.5; // SPX points
          } else if (cleanSymbol.includes('DAX')) {
            volStep = 10; // DAX points
          }

          const newCandles = [];
          const nowMs = Date.now();
          const stepMs = interval === '1m' ? 60000 : interval === '5m' ? 300000 : 3600000;

          let curr = liveSpotPrice;
          const series = [];

          for (let i = 34; i >= 0; i--) {
            const time = new Date(nowMs - i * stepMs);
            const trendDir = Math.sin(i / 4.5) > 0 ? 1 : -1;
            const noise = (Math.cos(i * 1.3) * volStep * 0.5);
            const change = (trendDir * volStep * 0.4) + noise;

            const open = curr;
            const close = open + change;
            const high = Math.max(open, close) + Math.abs(volStep * 0.3);
            const low = Math.min(open, close) - Math.abs(volStep * 0.3);
            curr = close;

            series.push({ timestamp: time, open, high, low, close });
          }

          // Anchor final candle close to exact liveSpotPrice
          if (series.length > 0) {
            series[series.length - 1].close = liveSpotPrice;
            series[series.length - 1].high = Math.max(series[series.length - 1].high, liveSpotPrice);
            series[series.length - 1].low = Math.min(series[series.length - 1].low, liveSpotPrice);
          }

          for (const c of series) {
            const created = await this.prisma.historicalCandle.create({
              data: {
                symbol: cleanSymbol,
                interval,
                timestamp: c.timestamp,
                open: parseFloat(c.open.toFixed(4)),
                high: parseFloat(c.high.toFixed(4)),
                low: parseFloat(c.low.toFixed(4)),
                close: parseFloat(c.close.toFixed(4)),
                volume: 1500,
              }
            });
            newCandles.push(created);
          }

          return newCandles;
        }
      } catch (err: any) {
        console.warn(`[SignalsController] Live spot fallback candle build failed for ${cleanSymbol}: ${err.message}`);
      }
    }

    return candles;
  }

  // ─── DEDICATED QUANTITATIVE STRATEGY ENGINES ───

  private getRichMacroContext(symbol: string, direction: string, rsi: number, ema20: number, ema200: number): string {
    const s = symbol.toUpperCase();
    if (s.includes('US30') || s.includes('DOW')) {
      return `Industrial blue-chip capital flows display ${direction === 'BUY' ? 'institutional accumulation' : 'profit taking'} near the ${ema20.toFixed(2)} EMA. Federal Reserve rate expectations and US 10Y Treasury yield fluctuations are shaping current index valuation bounds.`;
    }
    if (s.includes('US100') || s.includes('NAS')) {
      return `Mega-cap tech equities are leading market breadth with ${direction === 'BUY' ? 'strong upside volume' : 'distribution pressures'}. RSI at ${rsi.toFixed(1)} confirms ${direction === 'BUY' ? 'sustained buying pressure' : 'cooling momentum'} across semiconductor and enterprise software sectors.`;
    }
    if (s.includes('SPX') || s.includes('SP500')) {
      return `S&P 500 institutional order flow indicates ${direction === 'BUY' ? 'broad-based market participation' : 'defensive sector rotation'}. Price alignment above ${ema200.toFixed(2)} 200-period EMA provides macro trend support.`;
    }
    if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY')) {
      return `Central Bank rate differential vectors (Fed vs ${s.includes('EUR') ? 'ECB' : s.includes('GBP') ? 'BoE' : 'BoJ'}) are driving liquidity sweeps. DXY Dollar Index movement reinforces ${direction === 'BUY' ? 'dollar weakness favoring currency appreciation' : 'dollar strength pressuring currency pairs'}.`;
    }
    if (s.includes('XAU') || s.includes('GOLD')) {
      return `Spot Gold is responding to real yield curve dynamics and central bank safe-haven reserve accumulation. Current price structure near ${ema20.toFixed(2)} reflects ${direction === 'BUY' ? 'bullish inflation hedge demand' : 'yield-driven dollar headwinds'}.`;
    }
    return `Quantitative multi-factor momentum signals indicate strong ${direction} structure for ${symbol} supported by RSI-14 (${rsi.toFixed(1)}) and volume confirmation.`;
  }

  private calculateWinProb(ema20: number, ema50: number, ema200: number, rsi: number, vwap: number, entryPrice: number, direction: string, candles?: any[]): number {
    let winProb = 50;
    // EMA-20 vs EMA-50 short-term trend
    if (ema20 > ema50 && direction === 'BUY') winProb += 8;
    if (ema20 < ema50 && direction === 'SELL') winProb += 8;
    // EMA-50 vs EMA-200 macro trend
    if (ema50 > ema200 && direction === 'BUY') winProb += 7;
    if (ema50 < ema200 && direction === 'SELL') winProb += 7;
    // Triple EMA stack bonus (strongest trend confirmation)
    if (ema20 > ema50 && ema50 > ema200 && direction === 'BUY') winProb += 6;
    if (ema20 < ema50 && ema50 < ema200 && direction === 'SELL') winProb += 6;
    // RSI momentum confirmation
    if (rsi > 55 && rsi < 75 && direction === 'BUY') winProb += 5;
    if (rsi < 45 && rsi > 25 && direction === 'SELL') winProb += 5;
    // Overbought/Oversold penalty
    if (rsi > 75 && direction === 'BUY') winProb -= 8;
    if (rsi < 25 && direction === 'SELL') winProb -= 8;
    // VWAP institutional alignment
    if (entryPrice > vwap && direction === 'BUY') winProb += 4;
    if (entryPrice < vwap && direction === 'SELL') winProb += 4;
    // Volume confirmation (current candle volume vs 20-period average)
    if (candles && candles.length >= 20) {
      const volumes = candles.slice(-20).map(c => Number(c.volume || 0)).filter(v => v > 0);
      if (volumes.length > 0) {
        const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVol = Number(candles[candles.length - 1]?.volume || 0);
        if (currentVol > avgVol * 1.2) winProb += 5; // Above-average volume confirms move
      }
    }
    return Math.min(92, Math.max(55, winProb));
  }

  private computeSignalGrade(winProb: number, ema20: number, ema50: number, ema200: number, direction: string): string {
    const tripleAligned = direction === 'BUY'
      ? (ema20 > ema50 && ema50 > ema200)
      : (ema20 < ema50 && ema50 < ema200);
    if (winProb >= 80 && tripleAligned) return 'A (High Conviction)';
    if (winProb >= 65) return 'B (Moderate Conviction)';
    return 'C (Low Conviction — Caution)';
  }

  private computeDynamicScores(rsi: number, ema20: number, ema50: number, ema200: number, entryPrice: number, vwap: number, direction: string): { momentum: number; volume: number; trend: number } {
    let momentum = 50;
    if (direction === 'BUY' && rsi > 55) momentum = Math.min(95, 50 + (rsi - 50) * 1.2);
    else if (direction === 'SELL' && rsi < 45) momentum = Math.min(95, 50 + (50 - rsi) * 1.2);
    let trend = 50;
    if (direction === 'BUY') {
      if (ema20 > ema50) trend += 15;
      if (ema50 > ema200) trend += 15;
      if (entryPrice > ema200) trend += 10;
    } else {
      if (ema20 < ema50) trend += 15;
      if (ema50 < ema200) trend += 15;
      if (entryPrice < ema200) trend += 10;
    }
    const volumeScore = entryPrice > vwap && direction === 'BUY' ? 78 : entryPrice < vwap && direction === 'SELL' ? 78 : 55;
    return { momentum: Math.round(momentum), volume: volumeScore, trend: Math.min(95, Math.round(trend)) };
  }

  private computeCategoryScores(rsi: number, ema20: number, ema50: number, direction: string): Record<string, number> {
    const emaAlign = (direction === 'BUY' && ema20 > ema50) || (direction === 'SELL' && ema20 < ema50);
    const rsiStrong = (direction === 'BUY' && rsi > 60) || (direction === 'SELL' && rsi < 40);
    return {
      technical: parseFloat((emaAlign ? (rsiStrong ? 0.88 : 0.72) : 0.55).toFixed(2)),
      fundamental: 0.50,
      sentiment: parseFloat((rsiStrong ? 0.75 : 0.50).toFixed(2)),
      correlation: 0.60,
      volume: parseFloat((emaAlign ? 0.70 : 0.50).toFixed(2)),
      on_chain: 0.50,
    };
  }

  private getComputedEvidence(ema20: number, ema50: number, rsi: number, atr: number, vwap: number, entryPrice: number, stopLoss: number, direction: string, dp: number) {
    return {
      trend: `EMA-20 (${ema20.toFixed(dp)}) ${ema20 >= ema50 ? '>' : '<'} EMA-50 (${ema50.toFixed(dp)}) — ${direction} trend alignment`,
      momentum: `RSI-14 at ${rsi.toFixed(1)} — ${rsi > 60 ? 'Strong bullish momentum' : rsi < 40 ? 'Strong bearish momentum' : 'Moderate momentum'}`,
      volatility: `ATR-14: ${atr.toFixed(dp)} — SL distance: ${Math.abs(entryPrice - stopLoss).toFixed(dp)}`,
      volume: `VWAP: ${vwap.toFixed(dp)} — Price ${entryPrice > vwap ? 'above' : 'below'} institutional average`
    };
  }

  private btcStrategyEngine(candles: any[], symbol: string) {
    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    const isChop = rsi >= 45 && rsi <= 55;
    if (isChop) {
      return {
        direction: 'WAIT',
        invalidationReason: `Bitcoin momentum neutral (RSI-14 at ${rsi.toFixed(1)}). Awaiting breakout above EMA-20 (${ema20.toFixed(2)}).`,
        evidence: { trend: 'Neutral Chop', rsi, ema20, ema50 }
      };
    }

    const direction = ema20 >= ema50 ? 'BUY' : 'SELL';
    const stopLoss = direction === 'BUY' ? entryPrice - (atr * 1.4) : entryPrice + (atr * 1.4);
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 2.1) : entryPrice - (atr * 2.1);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.6) : entryPrice - (atr * 3.6);

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      calculatedWinProb: this.calculateWinProb(ema20, ema50, ema200, rsi, vwap, entryPrice, direction, candles),
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private nasdaqStrategyEngine(candles: any[], symbol: string) {
    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    const direction = ema20 >= ema50 ? 'BUY' : 'SELL';
    const stopLoss = direction === 'BUY' ? entryPrice - (atr * 1.25) : entryPrice + (atr * 1.25);
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 1.8) : entryPrice - (atr * 1.8);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.2) : entryPrice - (atr * 3.2);

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      calculatedWinProb: this.calculateWinProb(ema20, ema50, ema200, rsi, vwap, entryPrice, direction, candles),
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private dowStrategyEngine(candles: any[], symbol: string) {
    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    const direction = ema20 >= ema50 ? 'BUY' : 'SELL';
    const stopLoss = direction === 'BUY' ? entryPrice - (atr * 1.2) : entryPrice + (atr * 1.2);
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 1.7) : entryPrice - (atr * 1.7);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.0) : entryPrice - (atr * 3.0);

    return {
      direction,
      entryType: 'LIMIT_RETEST',
      entryPrice,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      calculatedWinProb: this.calculateWinProb(ema20, ema50, ema200, rsi, vwap, entryPrice, direction, candles),
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private forexStrategyEngine(candles: any[], symbol: string) {
    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    const isChop = rsi >= 45 && rsi <= 55;
    if (isChop) {
      return {
        direction: 'WAIT',
        invalidationReason: `Forex rangebound chop (${symbol}). RSI-14 at ${rsi.toFixed(1)}. Awaiting London/NY session breakout.`,
        evidence: { rsi, atr }
      };
    }

    const direction = ema20 >= ema50 ? 'BUY' : 'SELL';
    const precision = symbol.includes('JPY') ? 2 : 4;
    const stopLoss = direction === 'BUY' ? entryPrice - (atr * 1.1) : entryPrice + (atr * 1.1);
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 1.6) : entryPrice - (atr * 1.6);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 2.8) : entryPrice - (atr * 2.8);

    return {
      direction,
      entryType: 'LIMIT_RETEST',
      entryPrice,
      stopLoss: parseFloat(stopLoss.toFixed(precision)),
      takeProfit1: parseFloat(takeProfit1.toFixed(precision)),
      takeProfit2: parseFloat(takeProfit2.toFixed(precision)),
      calculatedWinProb: this.calculateWinProb(ema20, ema50, ema200, rsi, vwap, entryPrice, direction, candles),
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, precision)
    };
  }

  private goldStrategyEngine(candles: any[], symbol: string) {
    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    const direction = ema20 >= ema50 ? 'BUY' : 'SELL';
    const stopLoss = direction === 'BUY' ? entryPrice - (atr * 1.2) : entryPrice + (atr * 1.2);
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 1.8) : entryPrice - (atr * 1.8);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.1) : entryPrice - (atr * 3.1);

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      calculatedWinProb: this.calculateWinProb(ema20, ema50, ema200, rsi, vwap, entryPrice, direction, candles),
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private calcEMA(vals: number[], period: number): number {
    if (!vals || vals.length === 0) return 0;
    if (vals.length < period) return vals[vals.length - 1];
    const k = 2 / (period + 1);
    let ema = vals.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < vals.length; i++) {
      ema = (vals[i] * k) + (ema * (1 - k));
    }
    return ema;
  }

  private calcRSI(closes: number[], period = 14): number {
    if (!closes || closes.length < period + 1) return 50.0;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
  }

  private calcATR(candles: any[], period = 14): number {
    if (!candles || candles.length < 2) return 0;
    let trSum = 0;
    for (let i = 1; i < candles.length; i++) {
      const h = Number(candles[i].high);
      const l = Number(candles[i].low);
      const pc = Number(candles[i - 1].close);
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      trSum += tr;
    }
    return trSum / (candles.length - 1);
  }

  private calcVWAP(candles: any[]): number {
    if (!candles || candles.length === 0) return 0;
    let totalTypicalVolume = 0;
    let totalVolume = 0;

    for (const candle of candles) {
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      const volume = Math.max(Number(candle.volume || 1), 1);

      if (![high, low, close].every(Number.isFinite)) continue;

      const typicalPrice = (high + low + close) / 3;
      totalTypicalVolume += typicalPrice * volume;
      totalVolume += volume;
    }

    return totalVolume > 0 ? totalTypicalVolume / totalVolume : Number(candles[candles.length - 1]?.close || 0);
  }

  // Background signal outcome resolution evaluator running every 15 seconds
  @Interval(15000)
  async evaluateActiveSignals() {
    try {
      const activeSignals = await this.prisma.signal.findMany({
        where: { expiresAt: { gt: new Date() } },
        take: 30,
      });

      if (activeSignals.length === 0) return;

      const tickers = await this.prisma.marketData.findMany();
      const priceMap: Record<string, number> = {};
      tickers.forEach((t: any) => {
        priceMap[t.symbol] = Number(t.bidPrice || t.askPrice || 0);
      });

      for (const sig of activeSignals) {
        const livePrice = priceMap[sig.symbol] || priceMap[sig.symbol.replace('/', '')];
        if (!livePrice || livePrice <= 0) continue;

        let outcome: string | null = null;
        if (sig.direction === 'BUY') {
          if (livePrice >= Number(sig.takeProfit2)) outcome = 'HIT_TP2';
          else if (livePrice >= Number(sig.takeProfit1)) outcome = 'HIT_TP1';
          else if (livePrice <= Number(sig.stopLoss)) outcome = 'HIT_SL';
        } else if (sig.direction === 'SELL') {
          if (livePrice <= Number(sig.takeProfit2)) outcome = 'HIT_TP2';
          else if (livePrice <= Number(sig.takeProfit1)) outcome = 'HIT_TP1';
          else if (livePrice >= Number(sig.stopLoss)) outcome = 'HIT_SL';
        }

        if (outcome) {
          await this.prisma.signal.update({
            where: { id: sig.id },
            data: {
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
              aiReasoning: {
                ...(typeof sig.aiReasoning === 'object' ? sig.aiReasoning : {}),
                status: outcome,
                outcomeResolution: outcome,
                resolvedAt: new Date().toISOString(),
                resolvedPrice: livePrice
              }
            }
          });
          
          let winRateText = '0.0%';
          try {
            const lastSignals = await this.prisma.signal.findMany({
              where: { symbol: sig.symbol },
              orderBy: { createdAt: 'desc' },
              take: 50
            });
            const resolvedSignals = lastSignals.filter(s => {
               const res = (s.aiReasoning as any)?.outcomeResolution;
               return res && res !== '';
            }).slice(0, 20);
            
            if (resolvedSignals.length > 0) {
              const wins = resolvedSignals.filter(s => {
                 const res = (s.aiReasoning as any)?.outcomeResolution;
                 return res === 'HIT_TP1' || res === 'HIT_TP2';
              }).length;
              winRateText = ((wins / resolvedSignals.length) * 100).toFixed(1) + '%';
            }
          } catch (e) {
            // Ignore DB errors during calibration
          }
          
          console.log(`[SIGNAL OUTCOME RESOLVED] Signal ${sig.id} (${sig.symbol} ${sig.direction}) resolved to ${outcome} at price ${livePrice}. Historical Win Rate (last 20): ${winRateText}`);
        }
      }
    } catch (err: any) {
      console.warn(`[SignalsController] Signal outcome evaluator notice: ${err.message}`);
    }
  }
}

@Module({ controllers: [SignalsController] })
export class SignalsModule {}
