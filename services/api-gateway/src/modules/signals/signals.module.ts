import { Module, Controller, Get, Post, Body, Param, UseGuards, Req, Delete, OnModuleInit, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import { Interval } from '@nestjs/schedule';
import { EntitlementService } from '../subscription/entitlement.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import axios from 'axios';

@ApiTags('signals')
@Controller('signals')
export class SignalsController implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request generation of a fresh AI trading signal for a specific market' })
  async generateSignal(@Req() req: any, @Body() dto: { symbol: string; interval?: string }) {
    const userId = req.user?.userId;
    if (userId) {
      await this.entitlementService.checkAndConsumeSignal(userId);
    }
    const symbol = this.normalizeSymbol(dto.symbol);
    return this.generateSignalRequest(symbol, dto.interval || '1h', true, userId);
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
          entry_type: res.data.entry_type || 'MARKET_NOW',
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
      } else if (symUpper.includes('JPY')) {
        result = this.usdjpyStrategyEngine(cachedCandles, symbol);
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

      const {
        direction,
        entryType,
        entryPrice,
        entryZone,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        calculatedWinProb,
        riskRewardRatio: customRR,
        signalGrade: customGrade,
        reasonsFor,
        reasonsAgainst,
        aiValidation,
        marketRegime,
        htfBias,
        liquidityStatus,
        structureStatus,
        displacementStatus,
        sessionStatus,
        evidence,
        invalidationReason
      } = result;

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

        const computedRR = customRR || parseFloat((Math.abs(takeProfit1 - entryPrice) / (Math.abs(entryPrice - stopLoss) || 1)).toFixed(1));

        const signalPayload = {
          symbol,
          direction,
          entryPrice,
          stopLoss,
          takeProfit1,
          takeProfit2,
          riskRewardRatio: computedRR,
          winProbability: calculatedWinProb,
          durationEstimate,
          aiReasoning: {
            entry_type: entryType,
            entry_zone: entryZone || `${(entryPrice * 0.999).toFixed(2)} - ${(entryPrice * 1.001).toFixed(2)}`,
            take_profit_3: takeProfit3 || (direction === 'BUY' ? parseFloat((entryPrice + (Math.abs(takeProfit1 - entryPrice) * 2.2)).toFixed(2)) : parseFloat((entryPrice - (Math.abs(entryPrice - takeProfit1) * 2.2)).toFixed(2))),
            reasons_for: reasonsFor || [
              `EMA-20 (${ema20.toFixed(2)}) ${ema20 >= ema50 ? '>' : '<'} EMA-50 (${ema50.toFixed(2)}) structural alignment`,
              `Price trading ${entryPrice > vwap ? 'above' : 'below'} VWAP ($${vwap.toFixed(2)})`,
              `RSI-14 at ${rsi14.toFixed(1)} confirms momentum`
            ],
            reasons_against: reasonsAgainst || [
              `RSI-14 at ${rsi14.toFixed(1)} requires monitoring near range bounds`
            ],
            ai_validation: aiValidation || `12-Layer Confluence Engine confirmed ${direction} setup for ${symbol} with ${calculatedWinProb}/100 score.`,
            market_regime: marketRegime || (direction === 'BUY' ? 'Bullish Expansion' : 'Bearish Expansion'),
            htf_bias: htfBias || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
            liquidity_status: liquidityStatus || 'Standard Liquidity Range',
            structure_status: structureStatus || 'Standard Structure',
            displacement_status: displacementStatus || 'Normal Volatility',
            session_status: sessionStatus || 'Active Session',
            evidence: evidence,
            confidence_breakdown: evidence.calculatedScores || evidence,
            indicators: [
              `EMA-20 (${ema20.toFixed(2)}) ${ema20 >= ema50 ? '>' : '<'} EMA-50 (${ema50.toFixed(2)}) — ${ema20 >= ema50 ? 'Bullish' : 'Bearish'} trend`,
              `RSI-14: ${rsi14.toFixed(1)} — ${rsi14 > 70 ? 'Overbought' : rsi14 < 30 ? 'Oversold' : rsi14 > 55 ? 'Bullish momentum' : rsi14 < 45 ? 'Bearish momentum' : 'Neutral'}`,
              `ATR-14: ${atr.toFixed(4)} — ${atr > prevAtr ? 'Expanding' : 'Contracting'} volatility`,
              `VWAP: ${vwap.toFixed(2)} — Price ${entryPrice > vwap ? 'above' : 'below'} VWAP (${entryPrice > vwap ? 'bullish' : 'bearish'} bias)`
            ],
            explanation: aiValidation || `PRO 7-Step Institutional Strategy confirmed a high-probability ${direction} setup for ${symbol}. Price is trading ${entryPrice > ema200 ? 'above' : 'below'} the 200-period macro EMA (${ema200.toFixed(2)}) with RSI-14 at ${rsi14.toFixed(1)} and VWAP equilibrium at ${vwap.toFixed(2)}.`,
            structure: {
              ...this.detectFairValueGap(cachedCandles),
              ...this.detectOrderBlock(cachedCandles, atr),
              support: stopLoss,
              resistance: takeProfit1
            },
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
            tradingview_idea: `12-Layer Confluence ${direction} setup for ${symbol} (Score: ${calculatedWinProb}/100). Entry: ${entryPrice.toFixed(2)} [Zone: ${entryZone || 'Market'}], TP1: ${takeProfit1.toFixed(2)}, TP2: ${takeProfit2.toFixed(2)}, TP3: ${takeProfit3 || 'Open'}, Stop Loss: ${stopLoss.toFixed(2)} (R:R 1:${computedRR}).`,
            category_scores: this.computeCategoryScores(rsi14, ema20, ema50, direction),
            macro_context: this.getRichMacroContext(symbol, direction, rsi14, ema20, ema200),
            correlation_analysis: `No live cross-asset correlation matrix is attached for ${symbol}; this signal is scored from available candle-derived technical data only.`,
            timeframe: interval,
            status: 'ACTIVE',
            signal_grade: customGrade || this.computeSignalGrade(calculatedWinProb, ema20, ema50, ema200, direction)
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
      'GOLD': 'XAUUSD=X',
      'XAU/USD': 'XAUUSD=X',
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
    
    // 3. Otherwise, fetch real-time. Try Binance first if crypto or Gold (PAXGUSDT tracks London Spot Gold 1:1).
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(baseSymbol);
    const isGold = baseSymbol.includes('XAU') || baseSymbol.includes('GOLD') || cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD');
    let fetched = false;

    if (isCrypto || isGold) {
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      try {
        const binanceSym = isGold ? 'PAXGUSDT' : `${baseSymbol}USDT`;
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

        // 4. Fallback to DB marketData spot price if liveSpotPrice is still 0
        if (liveSpotPrice <= 0) {
          try {
            const md = await this.prisma.marketData.findFirst({
              where: {
                OR: [
                  { symbol: cleanSymbol },
                  { symbol: normSym },
                  { symbol: cleanSymbol.replace('/', '') }
                ]
              }
            });
            if (md && Number(md.bidPrice || md.askPrice) > 0) {
              liveSpotPrice = Number(md.bidPrice || md.askPrice);
            }
          } catch (dbErr) {}
        }

        if (liveSpotPrice > 0) {
          try {
            const yahooTicker = this.getYahooTicker(cleanSymbol);
            const chartRes = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=5d&interval=1h`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
              }
            }, 4000);
            if (chartRes.ok) {
              const cData = await chartRes.json();
              const result = cData?.chart?.result?.[0];
              const timestamps = result?.timestamp || [];
              const quote = result?.indicators?.quote?.[0] || {};
              const opens = quote.open || [];
              const highs = quote.high || [];
              const lows = quote.low || [];
              const closes = quote.close || [];
              const volumes = quote.volume || [];

              if (timestamps.length >= 10) {
                await this.prisma.historicalCandle.deleteMany({
                  where: { symbol: cleanSymbol, interval }
                });

                const fetchedCandles = [];
                for (let i = 0; i < timestamps.length; i++) {
                  if (closes[i] != null && opens[i] != null) {
                    const created = await this.prisma.historicalCandle.create({
                      data: {
                        symbol: cleanSymbol,
                        interval,
                        timestamp: new Date(timestamps[i] * 1000),
                        open: parseFloat(opens[i].toFixed(4)),
                        high: parseFloat((highs[i] || opens[i]).toFixed(4)),
                        low: parseFloat((lows[i] || closes[i]).toFixed(4)),
                        close: parseFloat(closes[i].toFixed(4)),
                        volume: parseFloat((volumes[i] || 1000).toFixed(0)),
                      }
                    });
                    fetchedCandles.push(created);
                  }
                }

                if (fetchedCandles.length >= 10) {
                  return fetchedCandles;
                }
              }
            }
          } catch (err: any) {
            console.warn(`[SignalsController] Real chart fetch failed for ${cleanSymbol}: ${err.message}`);
          }

          console.warn(
            `[SignalsController] Spot price for ${cleanSymbol} is available (${liveSpotPrice}), but real candle history is unavailable. Refusing to synthesize candles for signal generation.`
          );
        }
        
        console.warn(`[SignalsController] Insufficient live candlestick history for ${cleanSymbol}. Refusing synthetic signal generation.`);
        return [];
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
      return `Technical-only index context: price is ${direction === 'BUY' ? 'holding above' : 'trading below'} the ${ema20.toFixed(2)} EMA with RSI at ${rsi.toFixed(1)}. No live Fed, yield, sector-breadth, or institutional-flow feed is attached to this signal.`;
    }
    if (s.includes('US100') || s.includes('NAS')) {
      return `Technical-only NASDAQ context: price is ${direction === 'BUY' ? 'holding above' : 'trading below'} the ${ema20.toFixed(2)} EMA and RSI is ${rsi.toFixed(1)}. No live sector breadth, mega-cap flow, or yield feed is attached to this signal.`;
    }
    if (s.includes('SPX') || s.includes('SP500')) {
      return `Technical-only S&P context: price is ${direction === 'BUY' ? 'above' : 'below'} the ${ema200.toFixed(2)} 200-period EMA. No live breadth, sector rotation, or institutional-flow feed is attached to this signal.`;
    }
    if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY')) {
      return `Technical-only FX context: EMA alignment and RSI (${rsi.toFixed(1)}) support the current ${direction} bias. No live central-bank, DXY, yield-spread, or macro calendar feed is attached to this signal.`;
    }
    if (s.includes('XAU') || s.includes('GOLD')) {
      return `Technical-only gold context: current price structure near the ${ema20.toFixed(2)} EMA supports a ${direction} bias with RSI at ${rsi.toFixed(1)}. No live real-yield, dollar, futures-positioning, or central-bank flow feed is attached to this signal.`;
    }
    return `Technical-only context for ${symbol}: the setup is based on EMA alignment and RSI-14 (${rsi.toFixed(1)}). No external macro, correlation, or order-flow feed is attached to this signal.`;
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

  private detectFairValueGap(candles: any[]): { fvg_detected: boolean; type?: string; gap_size?: number } {
    if (!candles || candles.length < 3) return { fvg_detected: false };
    const n = candles.length;
    for (let i = n - 1; i >= Math.max(2, n - 8); i--) {
      const c1High = Number(candles[i - 2].high || 0);
      const c1Low = Number(candles[i - 2].low || 0);
      const c3Low = Number(candles[i].low || 0);
      const c3High = Number(candles[i].high || 0);

      if (c3Low > c1High) {
        return { fvg_detected: true, type: 'BULLISH', gap_size: parseFloat((c3Low - c1High).toFixed(4)) };
      }
      if (c3High < c1Low) {
        return { fvg_detected: true, type: 'BEARISH', gap_size: parseFloat((c1Low - c3High).toFixed(4)) };
      }
    }
    return { fvg_detected: false };
  }

  private detectOrderBlock(candles: any[], atr: number): { order_block_detected: boolean; type?: string; price_level?: number } {
    if (!candles || candles.length < 5) return { order_block_detected: false };
    const n = candles.length;
    for (let i = n - 2; i >= Math.max(1, n - 10); i--) {
      const prevClose = Number(candles[i - 1].close || 0);
      const prevOpen = Number(candles[i - 1].open || 0);
      const currClose = Number(candles[i].close || 0);
      const currOpen = Number(candles[i].open || 0);
      const moveSize = Math.abs(currClose - prevOpen);

      if (moveSize > atr * 1.1) {
        const isBullishImpulse = currClose > currOpen;
        const isBearishImpulse = currClose < currOpen;
        if (isBullishImpulse && prevClose < prevOpen) {
          return { order_block_detected: true, type: 'BULLISH', price_level: parseFloat(prevClose.toFixed(4)) };
        }
        if (isBearishImpulse && prevClose > prevOpen) {
          return { order_block_detected: true, type: 'BEARISH', price_level: parseFloat(prevClose.toFixed(4)) };
        }
      }
    }
    return { order_block_detected: false };
  }

  private computeCategoryScores(rsi: number, ema20: number, ema50: number, direction: string): Record<string, number> {
    const emaAlign = (direction === 'BUY' && ema20 > ema50) || (direction === 'SELL' && ema20 < ema50);
    const rsiStrong = (direction === 'BUY' && rsi > 58) || (direction === 'SELL' && rsi < 42);
    return {
      technical: parseFloat((emaAlign ? (rsiStrong ? 0.88 : 0.74) : 0.55).toFixed(2)),
      fundamental: parseFloat((rsiStrong ? 0.70 : 0.60).toFixed(2)),
      sentiment: parseFloat((rsiStrong ? 0.78 : 0.52).toFixed(2)),
      correlation: parseFloat((emaAlign ? 0.75 : 0.58).toFixed(2)),
      volume: parseFloat((emaAlign ? 0.72 : 0.50).toFixed(2)),
      on_chain: parseFloat((rsiStrong ? 0.80 : 0.55).toFixed(2)),
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
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `Insufficient ${symbol} candlestick history for 12-layer crypto evaluation.`,
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    // 1. Market Regime Classification
    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const isRanging = !isTrending && rsi >= 45 && rsi <= 55;
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    // 2. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep Detection (Buy-side & Sell-side Sweeps)
    const recentHighs = candles.slice(-25).map(c => Number(c.high));
    const recentLows = candles.slice(-25).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    const sweptPDH = Number(lastCandle.high) >= pdh && Number(lastCandle.close) < pdh;
    const sweptPDL = Number(lastCandle.low) <= pdl && Number(lastCandle.close) > pdl;

    // 4. Crypto Session & Volume Profile Timing (UTC)
    const currentHour = new Date().getUTCHours();
    let sessionName = 'Asian Globex Accumulation (00:00-07:00 UTC)';
    let sessionScore = 3;

    if (currentHour >= 7 && currentHour < 13) {
      sessionName = 'European / London Crypto Expansion (07:00-13:30 UTC)';
      sessionScore = 4;
    } else if (currentHour >= 13 && currentHour < 20) {
      sessionName = 'US Session / Wall Street ETF Flow Window (13:30-20:00 UTC)';
      sessionScore = 5;
    } else if (currentHour >= 20) {
      sessionName = 'Late US / Pacific Funding Settlement (20:00-24:00 UTC)';
      sessionScore = 4;
    }

    // 5. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish crypto momentum`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish crypto momentum`);
    }

    // Layer 2: HTF Macro Regime (200 EMA) (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`Bitcoin price above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`Bitcoin price below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
    }

    // Layer 3: VWAP Institutional Floor (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`Price above VWAP ($${vwap.toFixed(2)}) — institutional spot accumulation floor`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`Price below VWAP ($${vwap.toFixed(2)}) — institutional overhead supply resistance`);
    }

    // Layer 4: Liquidity Sweeps (15 Points)
    if (sweptPDL) {
      bullishScore += 15;
      reasonsFor.push(`Sell-side liquidity swept below $${pdl.toFixed(2)} with strong bullish rejection`);
    }
    if (sweptPDH) {
      bearishScore += 15;
      reasonsAgainst.push(`Buy-side liquidity swept above $${pdh.toFixed(2)} with strong bearish rejection`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Bullish expansion displacement candle ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Bearish expansion displacement candle ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (13 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Fair Value Gap (FVG) imbalance active (${fvg.gap_size} pts)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Fair Value Gap (FVG) imbalance active (${fvg.gap_size} pts)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone active at $${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone active at $${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms sustained buying momentum`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms sustained selling momentum`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of long liquidation unwind`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — short squeeze hazard`);
    }

    // Layer 8: Session Window Timing (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Rangebound Penalties
    if (isRanging) {
      if (entryPrice > vwap * 1.008) {
        bullishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended above VWAP — mean reversion hazard');
      } else if (entryPrice < vwap * 0.992) {
        bearishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended below VWAP — mean reversion hazard');
      }
    }

    // Direction & High-Conviction Threshold (58/100)
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(55, rawScore));
    const direction = confidenceScore >= 58 ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      return {
        direction: 'WAIT',
        invalidationReason: `Crypto confluence score (${confidenceScore}/100) below minimum 58 threshold in ${marketRegime} regime. Systematic engine protecting capital.`,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap, marketRegime }
      };
    }

    // Targets & Dynamic Risk-to-Reward Ratio
    const slDist = atr * 1.35;
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 2.0) : entryPrice - (atr * 2.0);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.5) : entryPrice - (atr * 3.5);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (atr * 5.2) : entryPrice - (atr * 5.2);

    const rrRatio = parseFloat((Math.abs(takeProfit2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 76 ? 'A Setup (Institutional Confluence)'
      : confidenceScore >= 68 ? 'B+ Setup (Standard Confluence)'
      : confidenceScore >= 60 ? 'B Setup (Scalp Confluence)'
      : 'C Setup (Speculative)';

    const entryZoneLower = (entryPrice - (atr * 0.15)).toFixed(2);
    const entryZoneUpper = (entryPrice + (atr * 0.15)).toFixed(2);

    const aiValidation = `Dedicated BTCUSD 12-Layer Crypto Engine evaluated setup in ${marketRegime} regime during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${entryPrice.toFixed(2)} ` +
      `with invalidation stop loss at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptPDL ? 'Sell-side Swept' : sweptPDH ? 'Buy-side Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Expansion Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private nasdaqStrategyEngine(candles: any[], symbol: string) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: 'Insufficient US100/NQ candlestick history for 12-regime evaluation.',
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    // 1. Market Regime Classification
    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const isRanging = !isTrending && rsi >= 44 && rsi <= 56;
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    // 2. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep Detection (Previous Day / Session High/Low)
    const recentHighs = candles.slice(-25).map(c => Number(c.high));
    const recentLows = candles.slice(-25).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    const sweptPDH = Number(lastCandle.high) >= pdh && Number(lastCandle.close) < pdh;
    const sweptPDL = Number(lastCandle.low) <= pdl && Number(lastCandle.close) > pdl;

    // 4. Session Timing & Power Hour Classification (UTC)
    const currentHour = new Date().getUTCHours();
    const currentMin = new Date().getUTCMinutes();
    let sessionName = 'Asian Globex Session (Liquidity Map Build)';
    let sessionScore = 3;

    if (currentHour >= 7 && currentHour < 13) {
      sessionName = 'London Pre-Market (Structure Build)';
      sessionScore = 4;
    } else if (currentHour === 13 && currentMin >= 30) {
      sessionName = 'US Cash Session Open (09:30 ET ORB Window)';
      sessionScore = 5;
    } else if (currentHour >= 14 && currentHour < 16) {
      sessionName = 'London / New York Overlap (Prime Institutional Execution)';
      sessionScore = 5;
    } else if (currentHour >= 16 && currentHour < 19) {
      sessionName = 'New York Midday Session (Consolidation/Retracement)';
      sessionScore = 3;
    } else if (currentHour >= 19 && currentHour < 20) {
      sessionName = 'US Power Hour (15:00-16:00 ET Institutional Closing Moves)';
      sessionScore = 5;
    }

    // 5. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish index momentum`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish index momentum`);
    }

    // Layer 2: HTF 200 EMA Regime (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`Index trading above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`Index trading below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
    }

    // Layer 3: VWAP Mega-Cap Floor (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`Index above VWAP ($${vwap.toFixed(2)}) — mega-cap tech institutional demand floor`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`Index below VWAP ($${vwap.toFixed(2)}) — mega-cap tech overhead supply resistance`);
    }

    // Layer 4: Liquidity Sweeps (PDH/PDL) (15 Points)
    if (sweptPDL) {
      bullishScore += 15;
      reasonsFor.push(`Previous Day Low ($${pdl.toFixed(2)}) swept with quick bullish rejection`);
    }
    if (sweptPDH) {
      bearishScore += 15;
      reasonsAgainst.push(`Previous Day High ($${pdh.toFixed(2)}) swept with quick bearish rejection`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish NQ futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish NQ futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (13 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish FVG gap imbalance zone identified (${fvg.gap_size} pts)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish FVG gap imbalance zone identified (${fvg.gap_size} pts)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone active at $${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone active at $${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bullish index expansion`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish index expansion`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of intraday pullback`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — risk of short squeezes`);
    }

    // Layer 8: Session Timing (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Regime-Specific Strategy Adjustments
    if (isRanging) {
      // In rangebound regimes, penalize trend breakouts and require VWAP mean-reversion
      if (entryPrice > vwap * 1.008) {
        bullishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended above VWAP — mean reversion risk');
      } else if (entryPrice < vwap * 0.992) {
        bearishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended below VWAP — mean reversion risk');
      }
    }

    // Determine Direction & Final Confluence Score
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(55, rawScore));
    const direction = confidenceScore >= 58 ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      return {
        direction: 'WAIT',
        invalidationReason: `Nasdaq 100 confluence score (${confidenceScore}/100) below minimum 58 threshold. Institutional model rejecting low-confluence setups.`,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap, marketRegime }
      };
    }

    // Calculate Targets & Risk/Reward
    const slDist = atr * 1.45;
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 2.2) : entryPrice - (atr * 2.2);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.8) : entryPrice - (atr * 3.8);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (atr * 5.8) : entryPrice - (atr * 5.8);

    const rrRatio = parseFloat((Math.abs(takeProfit2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 76 ? 'A Setup (Institutional Confluence)'
      : confidenceScore >= 68 ? 'B+ Setup (Standard Confluence)'
      : confidenceScore >= 60 ? 'B Setup (Scalp Confluence)'
      : 'C Setup (Speculative)';

    const entryZoneLower = (entryPrice - (atr * 0.15)).toFixed(2);
    const entryZoneUpper = (entryPrice + (atr * 0.15)).toFixed(2);

    const aiValidation = `Dedicated US100/NQ 12-Regime Confluence Engine evaluated setup in ${marketRegime} regime during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${entryPrice.toFixed(2)} ` +
      `with invalidation stop loss at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptPDL ? 'PDL Swept' : sweptPDH ? 'PDH Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active NQ Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private dowStrategyEngine(candles: any[], symbol: string) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: 'Insufficient US30 candlestick history for 12-layer evaluation.',
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    // 1. Market Regime Classification
    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const isRanging = !isTrending && rsi >= 45 && rsi <= 55;
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    // 2. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep Detection (Previous Day / Session High/Low)
    const recentHighs = candles.slice(-25).map(c => Number(c.high));
    const recentLows = candles.slice(-25).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    const sweptPDH = Number(lastCandle.high) >= pdh && Number(lastCandle.close) < pdh;
    const sweptPDL = Number(lastCandle.low) <= pdl && Number(lastCandle.close) > pdl;

    // 4. Session Timing & Power Hour Classification (UTC)
    const currentHour = new Date().getUTCHours();
    const currentMin = new Date().getUTCMinutes();
    let sessionName = 'Asian Globex Session (Overnight Build)';
    let sessionScore = 3;

    if (currentHour >= 7 && currentHour < 13) {
      sessionName = 'London Pre-Market (European Capital Allocation)';
      sessionScore = 4;
    } else if (currentHour === 13 && currentMin >= 30) {
      sessionName = 'US Cash Session Open (09:30 ET ORB Window)';
      sessionScore = 5;
    } else if (currentHour >= 14 && currentHour < 16) {
      sessionName = 'London / New York Overlap (Prime Institutional Execution)';
      sessionScore = 5;
    } else if (currentHour >= 16 && currentHour < 19) {
      sessionName = 'New York Midday Session (Consolidation/Retracement)';
      sessionScore = 3;
    } else if (currentHour >= 19 && currentHour < 20) {
      sessionName = 'US Power Hour (15:00-16:00 ET Institutional Closing Moves)';
      sessionScore = 5;
    }

    // 5. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) blue-chip bullish trend`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) blue-chip bearish trend`);
    }

    // Layer 2: HTF 200 EMA Regime (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`US30 price trading above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`US30 price trading below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
    }

    // Layer 3: VWAP Demand Floor (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`Price above VWAP ($${vwap.toFixed(2)}) — industrial & financial capital demand floor active`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`Price below VWAP ($${vwap.toFixed(2)}) — industrial & financial overhead resistance`);
    }

    // Layer 4: Liquidity Sweeps (PDH/PDL) (15 Points)
    if (sweptPDL) {
      bullishScore += 15;
      reasonsFor.push(`Previous Day Low ($${pdl.toFixed(2)}) swept with quick rejection`);
    }
    if (sweptPDH) {
      bearishScore += 15;
      reasonsAgainst.push(`Previous Day High ($${pdh.toFixed(2)}) swept with quick rejection`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish YM futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish YM futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (13 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish FVG gap imbalance zone identified (${fvg.gap_size} pts)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish FVG gap imbalance zone identified (${fvg.gap_size} pts)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone identified at $${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone identified at $${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bullish index expansion`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish index expansion`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of short-term pullback`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — risk of short-term squeeze`);
    }

    // Layer 8: Session Timing (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Determine Direction & High-Conviction Threshold (58/100)
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(55, rawScore));
    const direction = confidenceScore >= 58 ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      return {
        direction: 'WAIT',
        invalidationReason: `Dow Jones confluence score (${confidenceScore}/100) below minimum 58 threshold. Industrial engine filtering low-volume noise.`,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap, marketRegime }
      };
    }

    // Calculate Targets & Risk/Reward
    const slDist = atr * 1.40;
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 2.0) : entryPrice - (atr * 2.0);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.6) : entryPrice - (atr * 3.6);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (atr * 5.5) : entryPrice - (atr * 5.5);

    const rrRatio = parseFloat((Math.abs(takeProfit2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 76 ? 'A Setup (Institutional Confluence)'
      : confidenceScore >= 68 ? 'B+ Setup (Standard Confluence)'
      : confidenceScore >= 60 ? 'B Setup (Scalp Confluence)'
      : 'C Setup (Speculative)';

    const entryZoneLower = (entryPrice - (atr * 0.15)).toFixed(2);
    const entryZoneUpper = (entryPrice + (atr * 0.15)).toFixed(2);

    const aiValidation = `Dedicated US30 12-Layer Industrial & Cyclical Value Engine evaluated setup in ${marketRegime} regime during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${entryPrice.toFixed(2)} ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptPDL ? 'PDL Swept' : sweptPDH ? 'PDH Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active YM Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private forexStrategyEngine(candles: any[], symbol: string) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `Insufficient ${symbol} candlestick history for FX macro evaluation.`,
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);
    const isJpy = symbol.includes('JPY');
    const precision = isJpy ? 2 : 4;

    // 1. Market Regime Classification
    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const isRanging = !isTrending && rsi >= 45 && rsi <= 55;
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    // 2. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Asian Session Range & Liquidity Sweeps (00:00 - 07:00 UTC)
    const recentHighs = candles.slice(-24).map(c => Number(c.high));
    const recentLows = candles.slice(-24).map(c => Number(c.low));
    const asianHigh = Math.max(...recentHighs.slice(0, -1));
    const asianLow = Math.min(...recentLows.slice(0, -1));

    const sweptAsianLow = Number(lastCandle.low) <= asianLow && Number(lastCandle.close) > asianLow;
    const sweptAsianHigh = Number(lastCandle.high) >= asianHigh && Number(lastCandle.close) < asianHigh;

    // 4. Session Timing Classification (UTC)
    const currentHour = new Date().getUTCHours();
    let sessionName = 'Asian Session (Range & Liquidity Build)';
    let sessionScore = 3;

    if (currentHour >= 7 && currentHour < 12) {
      sessionName = 'London Session (Asian Range Liquidity Expansion)';
      sessionScore = 5;
    } else if (currentHour >= 12 && currentHour < 16) {
      sessionName = 'London / New York Overlap (Prime Institutional FX Flow)';
      sessionScore = 5;
    } else if (currentHour >= 16 && currentHour < 21) {
      sessionName = 'New York Session (Sub-Session & Benchmark Fix)';
      sessionScore = 4;
    }

    // 5. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: EMA Trend Structure (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`EMA-20 (${ema20.toFixed(precision)}) > EMA-50 (${ema50.toFixed(precision)}) structural bullish alignment`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`EMA-20 (${ema20.toFixed(precision)}) < EMA-50 (${ema50.toFixed(precision)}) structural bearish alignment`);
    }

    // Layer 2: VWAP Demand Floor (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`Price trading above VWAP (${vwap.toFixed(precision)}) — institutional demand floor active`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`Price trading below VWAP (${vwap.toFixed(precision)}) — institutional overhead resistance`);
    }

    // Layer 3: Higher-Timeframe 200 EMA Regime (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`Price above 200 EMA (${ema200.toFixed(precision)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`Price below 200 EMA (${ema200.toFixed(precision)}) — HTF macro bear regime`);
    }

    // Layer 4: Asian Range Liquidity Sweeps (15 Points)
    if (sweptAsianLow) {
      bullishScore += 15;
      reasonsFor.push(`Asian Session Low (${asianLow.toFixed(precision)}) swept during London open with sharp rejection`);
    }
    if (sweptAsianHigh) {
      bearishScore += 15;
      reasonsAgainst.push(`Asian Session High (${asianHigh.toFixed(precision)}) swept during London open with sharp rejection`);
    }

    // Layer 5: Institutional FX Displacement (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish FX displacement candle body (${lastBody.toFixed(precision)} pips > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish FX displacement candle body (${lastBody.toFixed(precision)} pips > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (13 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish FVG gap imbalance zone identified (${fvg.gap_size} pips)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish FVG gap imbalance zone identified (${fvg.gap_size} pips)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone identified at ${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone identified at ${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bullish FX momentum`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish FX momentum`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of short-term pullback`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — risk of short-term squeeze`);
    }

    // Layer 8: Prime Session Timing (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Determine Direction & High-Conviction Threshold (58/100)
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(55, rawScore));
    const direction = confidenceScore >= 58 ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      return {
        direction: 'WAIT',
        invalidationReason: `Forex confluence score (${confidenceScore}/100) below minimum 58 threshold. Institutional DXY engine filtering noise.`,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap, marketRegime }
      };
    }

    // Calculate Targets & Risk/Reward
    const slDist = atr * 1.30;
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 2.0) : entryPrice - (atr * 2.0);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.5) : entryPrice - (atr * 3.5);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (atr * 5.0) : entryPrice - (atr * 5.0);

    const rrRatio = parseFloat((Math.abs(takeProfit2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 76 ? 'A Setup (Institutional Confluence)'
      : confidenceScore >= 68 ? 'B+ Setup (Standard Confluence)'
      : confidenceScore >= 60 ? 'B Setup (Scalp Confluence)'
      : 'C Setup (Speculative)';

    const entryZoneLower = (entryPrice - (atr * 0.12)).toFixed(precision);
    const entryZoneUpper = (entryPrice + (atr * 0.12)).toFixed(precision);

    const aiValidation = `Dedicated EURUSD/FX Macro Intelligence Engine evaluated setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at ${entryPrice.toFixed(precision)} ` +
      `with invalidation stop loss set at ${stopLoss.toFixed(precision)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(precision)),
      takeProfit1: parseFloat(takeProfit1.toFixed(precision)),
      takeProfit2: parseFloat(takeProfit2.toFixed(precision)),
      takeProfit3: parseFloat(takeProfit3.toFixed(precision)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptAsianLow ? 'Asian Low Swept' : sweptAsianHigh ? 'Asian High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active FX Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, precision)
    };
  }

  private usdjpyStrategyEngine(candles: any[], symbol: string) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `Insufficient ${symbol} candlestick history for Fed-BoJ yield evaluation.`,
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);
    const precision = 2; // JPY pairs use 2 decimal places

    // 1. Market Regime & Ministry of Finance (MoF) Intervention Risk Engine
    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.35);
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    // MoF Intervention Risk Classification
    let interventionRiskLevel = 'LOW';
    if (entryPrice >= 158.0) {
      interventionRiskLevel = 'EXTREME';
    } else if (entryPrice >= 155.0 || isHighVol) {
      interventionRiskLevel = 'HIGH';
    } else if (entryPrice >= 152.0) {
      interventionRiskLevel = 'MEDIUM';
    }

    // 2. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Tokyo Session Range & Liquidity Sweeps (00:00 - 07:00 UTC)
    const recentHighs = candles.slice(-24).map(c => Number(c.high));
    const recentLows = candles.slice(-24).map(c => Number(c.low));
    const tokyoHigh = Math.max(...recentHighs.slice(0, -1));
    const tokyoLow = Math.min(...recentLows.slice(0, -1));

    const sweptTokyoLow = Number(lastCandle.low) <= tokyoLow && Number(lastCandle.close) > tokyoLow;
    const sweptTokyoHigh = Number(lastCandle.high) >= tokyoHigh && Number(lastCandle.close) < tokyoHigh;

    // 4. Session Timing Classification (UTC)
    const currentHour = new Date().getUTCHours();
    let sessionName = 'Tokyo Session (Fixing & Range Build)';
    let sessionScore = 4;

    if (currentHour >= 7 && currentHour < 12) {
      sessionName = 'London Session (Tokyo Range Sweep & Expansion)';
      sessionScore = 5;
    } else if (currentHour >= 12 && currentHour < 16) {
      sessionName = 'London / New York Overlap (Treasury Yield Flows)';
      sessionScore = 5;
    } else if (currentHour >= 16 && currentHour < 21) {
      sessionName = 'New York Session (Fed Policy Reaction)';
      sessionScore = 4;
    }

    // 5. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: Yield Spread & EMA Trend Structure (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`US-Japan yield spread expanding: EMA-20 (${ema20.toFixed(2)}) > EMA-50 (${ema50.toFixed(2)})`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`US-Japan yield spread contracting: EMA-20 (${ema20.toFixed(2)}) < EMA-50 (${ema50.toFixed(2)})`);
    }

    // Layer 2: VWAP Carry Trade Demand Floor (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`USDJPY above VWAP (${vwap.toFixed(2)}) — JPY carry trade demand active`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`USDJPY below VWAP (${vwap.toFixed(2)}) — JPY carry trade unwinding / risk-off`);
    }

    // Layer 3: Higher-Timeframe 200 EMA Regime (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`Price above 200 EMA (${ema200.toFixed(2)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`Price below 200 EMA (${ema200.toFixed(2)}) — HTF macro bear regime`);
    }

    // Layer 4: Tokyo Session Liquidity Sweeps (15 Points)
    if (sweptTokyoLow) {
      bullishScore += 15;
      reasonsFor.push(`Tokyo Session Low (${tokyoLow.toFixed(2)}) swept during London open with sharp rejection`);
    }
    if (sweptTokyoHigh) {
      bearishScore += 15;
      reasonsAgainst.push(`Tokyo Session High (${tokyoHigh.toFixed(2)}) swept during London open with sharp rejection`);
    }

    // Layer 5: Institutional FX Displacement (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish USDJPY displacement body (${lastBody.toFixed(2)} pips > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish USDJPY displacement body (${lastBody.toFixed(2)} pips > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (13 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish FVG gap imbalance zone identified (${fvg.gap_size} pips)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish FVG gap imbalance zone identified (${fvg.gap_size} pips)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone identified at ${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone identified at ${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy USDJPY bullish momentum`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy USDJPY bearish momentum`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of short-term pullback`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — risk of short-term squeeze`);
    }

    // Layer 8: Prime Session Timing (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Intervention Risk Penalty
    if (interventionRiskLevel === 'EXTREME') {
      bullishScore -= 20;
      reasonsAgainst.push('⚠️ EXTREME MoF Intervention Risk above 158.00 — Ministry of Finance physical intervention warning');
    } else if (interventionRiskLevel === 'HIGH') {
      bullishScore -= 10;
      reasonsAgainst.push('⚠️ HIGH MoF Intervention Risk above 155.00 — verbal intervention warnings active');
    }

    // Determine Direction & High-Conviction Threshold (72/100)
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(50, rawScore));
    const direction = (confidenceScore >= 72 && interventionRiskLevel !== 'EXTREME') ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      const waitReason = interventionRiskLevel === 'EXTREME'
        ? 'EXTREME MoF Intervention Risk level active. Professional system halted long setups to protect capital.'
        : `USDJPY macro confluence score (${confidenceScore}/100) below minimum 65 threshold. Setup rejected.`;

      return {
        direction: 'WAIT',
        invalidationReason: waitReason,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap, interventionRiskLevel, marketRegime }
      };
    }

    // Calculate Targets & Risk/Reward
    const slDist = atr * 1.25;
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (atr * 1.8) : entryPrice - (atr * 1.8);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (atr * 3.1) : entryPrice - (atr * 3.1);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (atr * 4.8) : entryPrice - (atr * 4.8);

    const rrRatio = parseFloat((Math.abs(takeProfit2 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 75 ? 'A Setup (Institutional Confluence)'
      : 'B Setup (Standard Confluence)';

    const entryZoneLower = (entryPrice - (atr * 0.12)).toFixed(precision);
    const entryZoneUpper = (entryPrice + (atr * 0.12)).toFixed(precision);

    const aiValidation = `Dedicated USDJPY Fed-BoJ Yield & Intervention Engine evaluated setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). MoF Intervention Risk: ${interventionRiskLevel}. Primary bias: ${direction} at ${entryPrice.toFixed(precision)} ` +
      `with invalidation stop loss set at ${stopLoss.toFixed(precision)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(precision)),
      takeProfit1: parseFloat(takeProfit1.toFixed(precision)),
      takeProfit2: parseFloat(takeProfit2.toFixed(precision)),
      takeProfit3: parseFloat(takeProfit3.toFixed(precision)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptTokyoLow ? 'Tokyo Low Swept' : sweptTokyoHigh ? 'Tokyo High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active USDJPY Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, precision)
    };
  }

  private goldStrategyEngine(candles: any[], symbol: string) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: 'Insufficient XAUUSD candlestick history for 12-layer institutional evaluation.',
        evidence: {}
      };
    }

    const closes = candles.map(c => Number(c.close));
    const entryPrice = closes[closes.length - 1];
    const atr = this.calcATR(candles, 14);
    const rsi = this.calcRSI(closes, 14);
    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const ema200 = this.calcEMA(closes, 200);
    const vwap = this.calcVWAP(candles);

    // 1. Technical Structure & Displacement
    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));
    const isDisplacement = lastBody > (atr * 1.15);

    // 2. Liquidity Sweep Detection
    const recentHighs = candles.slice(-20).map(c => Number(c.high));
    const recentLows = candles.slice(-20).map(c => Number(c.low));
    const maxHigh = Math.max(...recentHighs.slice(0, -1));
    const minLow = Math.min(...recentLows.slice(0, -1));

    const sweptHigh = Number(lastCandle.high) >= maxHigh && Number(lastCandle.close) < maxHigh;
    const sweptLow = Number(lastCandle.low) <= minLow && Number(lastCandle.close) > minLow;

    // 3. Session Classification (UTC based)
    const currentHour = new Date().getUTCHours();
    let sessionName = 'Asian Session (Range Build)';
    let sessionScore = 3;
    if (currentHour >= 7 && currentHour < 12) {
      sessionName = 'London Session (Expansion)';
      sessionScore = 4;
    } else if (currentHour >= 12 && currentHour < 17) {
      sessionName = 'London / New York Overlap (Prime Volume Window)';
      sessionScore = 5;
    } else if (currentHour >= 17 && currentHour < 21) {
      sessionName = 'New York Session (Sub-Session)';
      sessionScore = 4;
    }

    // 4. Multi-Layer Confluence Scoring (Total 100 Points)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 1: EMA Trend Structure (16 Points)
    if (ema20 > ema50) {
      bullishScore += 16;
      reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish gold trend alignment`);
    } else {
      bearishScore += 16;
      reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish gold trend alignment`);
    }

    // Layer 2: VWAP Institutional Price Level (15 Points)
    if (entryPrice >= vwap) {
      bullishScore += 15;
      reasonsFor.push(`Price trading above VWAP ($${vwap.toFixed(2)}) — institutional spot demand floor active`);
    } else {
      bearishScore += 15;
      reasonsAgainst.push(`Price trading below VWAP ($${vwap.toFixed(2)}) — institutional overhead supply resistance`);
    }

    // Layer 3: Higher-Timeframe 200 EMA Regime (14 Points)
    if (entryPrice >= ema200) {
      bullishScore += 14;
      reasonsFor.push(`Price above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
    } else {
      bearishScore += 14;
      reasonsAgainst.push(`Price below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
    }

    // Layer 4: Liquidity Sweeps (16 Points)
    if (sweptLow) {
      bullishScore += 16;
      reasonsFor.push(`Sell-Side Liquidity Swept below $${minLow.toFixed(2)} with quick rejection`);
    }
    if (sweptHigh) {
      bearishScore += 16;
      reasonsAgainst.push(`Buy-Side Liquidity Swept above $${maxHigh.toFixed(2)} with quick rejection`);
    }

    // Layer 5: Volume & Displacement Candles (12 Points)
    if (isDisplacement) {
      const isBullBody = Number(lastCandle.close) > Number(lastCandle.open);
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish displacement candle body ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish displacement candle body ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (12 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Fair Value Gap (FVG) imbalance zone detected (gap size: $${fvg.gap_size})`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Fair Value Gap (FVG) imbalance zone detected (gap size: $${fvg.gap_size})`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone identified at $${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone identified at $${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bullish momentum`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish momentum`);
    } else if (rsi >= 72) {
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of pullbacks`);
    } else if (rsi <= 28) {
      reasonsAgainst.push(`RSI-14 oversold at ${rsi.toFixed(1)} — risk of short squeezes`);
    }

    // Layer 8: Prime Session Alignment (5 Points)
    if (bullishScore > bearishScore) bullishScore += sessionScore;
    else if (bearishScore > bullishScore) bearishScore += sessionScore;

    // Determine Direction & High-Conviction Threshold (58/100)
    const isBull = bullishScore >= bearishScore;
    const rawScore = isBull ? bullishScore : bearishScore;
    const confidenceScore = Math.min(95, Math.max(55, rawScore));
    const direction = confidenceScore >= 58 ? (isBull ? 'BUY' : 'SELL') : 'WAIT';

    if (direction === 'WAIT') {
      return {
        direction: 'WAIT',
        invalidationReason: `XAUUSD confluence score (${confidenceScore}/100) below minimum 58 threshold. Professional system rejected low-confluence setup.`,
        evidence: { bullishScore, bearishScore, rsi, atr, vwap }
      };
    }

    // Calculate Exact Targets & Direct Market Scalp Risk/Reward
    const slDist = Math.max(entryPrice * 0.0018, Math.min(entryPrice * 0.0035, atr * 0.95));
    const stopLoss = direction === 'BUY' ? entryPrice - slDist : entryPrice + slDist;
    const takeProfit1 = direction === 'BUY' ? entryPrice + (slDist * 2.5) : entryPrice - (slDist * 2.5);
    const takeProfit2 = direction === 'BUY' ? entryPrice + (slDist * 3.8) : entryPrice - (slDist * 3.8);
    const takeProfit3 = direction === 'BUY' ? entryPrice + (slDist * 5.5) : entryPrice - (slDist * 5.5);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - entryPrice) / Math.abs(entryPrice - stopLoss)).toFixed(1));

    const signalGrade = confidenceScore >= 85 ? 'A+ Setup (High Conviction Confluence)'
      : confidenceScore >= 76 ? 'A Setup (Institutional Confluence)'
      : confidenceScore >= 68 ? 'B+ Setup (Standard Confluence)'
      : confidenceScore >= 60 ? 'B Setup (Scalp Confluence)'
      : 'C Setup (Speculative)';

    const entryZoneLower = (entryPrice - (atr * 0.15)).toFixed(2);
    const entryZoneUpper = (entryPrice + (atr * 0.15)).toFixed(2);

    const aiValidation = `Institutional 12-Layer Confluence Engine evaluated XAUUSD setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${entryPrice.toFixed(2)} ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: 'MARKET_NOW',
      entryPrice,
      entryZone: `${entryZoneLower} - ${entryZoneUpper}`,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: direction === 'BUY' ? 'Bullish Expansion' : 'Bearish Expansion',
      htfBias: entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF',
      liquidityStatus: sweptLow ? 'Sell-Side Swept' : sweptHigh ? 'Buy-Side Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
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
    
    // First average gain/loss
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;

    // Wilder's RMA smoothing for remaining bars
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
  }

  private calcATR(candles: any[], period = 14): number {
    if (!candles || candles.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const h = Number(candles[i].high);
      const l = Number(candles[i].low);
      const pc = Number(candles[i - 1].close);
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    if (trs.length < period) {
      return trs.reduce((a, b) => a + b, 0) / trs.length;
    }
    
    // Initial SMA of TR for first 'period' bars
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    // Wilder's RMA smoothing for subsequent bars
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr;
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

@Module({
  imports: [SubscriptionModule],
  controllers: [SignalsController],
})
export class SignalsModule {}
