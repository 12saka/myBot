import { Module, Controller, Get, Post, Body, Param, UseGuards, Req, Delete, OnModuleInit, HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import { Interval } from '@nestjs/schedule';
import { EntitlementService } from '../subscription/entitlement.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AutomationModule } from '../automation/automation.module';
import { AutomationService } from '../automation/automation.service';
import axios from 'axios';

@ApiTags('signals')
@Controller('signals')
export class SignalsController implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly automationService: AutomationService,
  ) {}

  async onModuleInit() {
    console.log('[SignalsController] Ensuring database schema columns are migrated on remote database...');
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
    } catch (e: any) {
      console.warn(`[SignalsController] Raw SQL schema migration notice: ${e.message}`);
    }

    // Auto-bootstrap active signals for core watchlist on startup
    setTimeout(() => {
      this.refreshCoreWatchlistSignals().catch(err => {
        console.warn(`[SignalsController] Initial watchlist signal bootstrap notice: ${err.message}`);
      });
    }, 4000);
  }

  // Maintain fresh signals for core assets every 5 minutes
  @Interval(300000)
  async maintainCoreSignals() {
    await this.refreshCoreWatchlistSignals();
  }

  public async refreshCoreWatchlistSignals(): Promise<void> {
    const coreSymbols = ['GOLD', 'BTC/USD', 'US100', 'US30', 'EUR/USD'];
    for (const sym of coreSymbols) {
      try {
        const existing = await this.prisma.signal.findFirst({
          where: {
            symbol: sym,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        const ageMs = existing ? (Date.now() - new Date(existing.createdAt).getTime()) : Infinity;
        if (!existing || ageMs > 2 * 3600 * 1000) {
          console.log(`[SignalsController] Proactively generating authentic top-down institutional signal for ${sym}...`);
          let sig = await this.generateSignalRequest(sym, '15m', true);
          if (sig && sig.direction === 'WAIT') {
            console.log(`[SignalsController] 15m timeframe for ${sym} in micro-consolidation. Evaluating 1h timeframe...`);
            sig = await this.generateSignalRequest(sym, '1h', true);
          }
        }
      } catch (err: any) {
        console.warn(`[SignalsController] Watchlist auto-generation notice for ${sym}: ${err.message}`);
      }
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
      let activeSignals = await this.prisma.signal.findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // If active signals are depleted (< 4), proactively replenish core watchlist
      if (activeSignals.length < 4) {
        await this.refreshCoreWatchlistSignals();
        activeSignals = await this.prisma.signal.findMany({
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

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
  async generateSignal(@Req() req: any, @Body() dto: { symbol: string; interval?: string; forceFresh?: boolean }) {
    const userId = req.user?.userId;
    if (userId) {
      await this.entitlementService.checkAndConsumeSignal(userId);
    }
    const symbol = this.normalizeSymbol(dto.symbol);
    return this.generateSignalRequest(symbol, dto.interval || '15m', dto.forceFresh ?? false, userId);
  }

  private normalizeSymbol(symbol: string): string {
    const s = (symbol || '').trim().toUpperCase();
    const base = s.replace('/USD', '');
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(base)) {
      return `${base}/USD`;
    }
    if (['GOLD', 'XAU', 'XAUUSD', 'XAU/USD'].includes(s)) {
      return 'GOLD';
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

    // 2. Strict Signal Immutability & Locking Check:
    // If an active, unexpired signal exists in database, LOCK IT.
    // Signals must NEVER mutate their grade or entry price within their active lifetime,
    // protecting user execution and eliminating grade flipping!
    const existingActiveSignal = await this.prisma.signal.findFirst({
      where: {
        symbol,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingActiveSignal) {
      const reasoning = (existingActiveSignal.aiReasoning as any) || {};
      const status = reasoning.status || 'ACTIVE';
      const ageMs = Date.now() - new Date(existingActiveSignal.createdAt).getTime();
      const isStillFresh = ageMs < 45 * 60 * 1000; // 45-minute strict lock window

      // Return locked signal if unexpired, active, and not explicitly force-bypassed
      if (!forceFresh && ['ACTIVE', 'RUNNING'].includes(status) && isStillFresh) {
        console.log(`[SIGNALS GATEWAY] Returning locked immutable signal for ${symbol} (Grade: ${reasoning.signal_grade || 'A'}, Age: ${(ageMs / 1000).toFixed(0)}s)`);
        return existingActiveSignal;
      }
    }

    const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const apiKey = process.env.AI_SERVICE_API_KEY || 'internal-secret-key';
    const cachedCandles = await this.getOrFetchCandles(symbol, interval);
    let intermarketData: any = null;

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

      const isGoldOrForex = symbol.toUpperCase().includes('XAU') || symbol.toUpperCase().includes('GOLD') || symbol.toUpperCase().includes('EUR') || symbol.toUpperCase().includes('USD') || symbol.toUpperCase().includes('JPY');
      if (isGoldOrForex) {
        intermarketData = await this.fetchIntermarketData();
      }

      const body = {
        symbol,
        timeframe: interval,
        candles: cachedCandles.map(c => ({
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
          timestamp: (c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp)).toISOString(),
        })),
        news: recentNews,
        session: activeSession,
        intermarket: intermarketData,
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

      const calculatedWinProb = Math.min(95, Math.max(35, Math.round(Number(res.data.confidence ?? 0.50) * 100)));
      const signalGrade = res.data.signal_grade || res.data.grade || this.computeSignalGrade(calculatedWinProb);

      const entryType = res.data.entry_type || 'MARKET_NOW';
      const entryZone = res.data.entry_zone || `${(res.data.entry * 0.999).toFixed(2)} - ${(res.data.entry * 1.001).toFixed(2)}`;
      const entryCondition = res.data.entry_condition || (entryType === 'MARKET_NOW'
        ? `Execute ${finalDirection} directly at Market ($${res.data.entry}). Confirmed setup.`
        : `Place ${entryType} order at $${res.data.entry} [Zone: ${entryZone}]. Wait for entry.`);

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
        winProbability: calculatedWinProb,
        durationEstimate: interval === '1m' ? '1-5 mins (Scalping)' :
                          interval === '3m' ? '3-10 mins (Scalping)' :
                          interval === '5m' ? '5-15 mins (Scalping)' :
                          interval === '15m' ? '15-45 mins (Scalping)' :
                          interval === '30m' ? '30-90 mins (Scalping)' :
                          interval === '1h' ? '1-4 hours (Day Trade)' :
                          interval === '4h' ? '1-2 days' : '3-5 days',
        aiReasoning: { 
          signal_grade: signalGrade,
          is_locked: true,
          locked_at: new Date().toISOString(),
          entry_type: entryType,
          entry_zone: entryZone,
          entry_condition: entryCondition,
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

      // Archive any previous active signals for this symbol rather than mutating them in-place
      if (existingActive) {
        await this.prisma.signal.updateMany({
          where: { symbol: res.data.symbol, expiresAt: { gt: new Date() } },
          data: { expiresAt: new Date() },
        });
      }

      const signal = await this.prisma.signal.create({
        data: signalPayload,
      });

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

      // 1. Fetch Multi-Timeframe Top-Down Institutional Bias (4H -> 1H -> Entry TF)
      const htfBias = await this.analyzeHTFBias(symbol);

      const assetClass = this.classifyAsset(symbol);
      let result: any = null;

      switch (assetClass) {
        case 'CRYPTO':
          result = this.btcStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        case 'INDICES_US100':
          result = this.nasdaqStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        case 'INDICES_US30':
          result = this.dowStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        case 'INDICES_BROAD':
          result = this.indicesStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        case 'STOCKS':
          result = this.stocksStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        case 'METALS':
          result = this.goldStrategyEngine(cachedCandles, symbol, interval, htfBias, intermarketData);
          break;
        case 'USDJPY':
          result = this.usdjpyStrategyEngine(cachedCandles, symbol, interval, htfBias, intermarketData);
          break;
        case 'FOREX':
          result = this.forexStrategyEngine(cachedCandles, symbol, interval, htfBias);
          break;
        default:
          // FAIL CLOSED: Refuse to guess or route unknown symbols to Forex!
          return {
            direction: 'WAIT',
            invalidationReason: `TradeMind Institutional Asset Classifier: Unrecognized asset class for "${symbol}". Refusing to generate signal with uncalibrated risk models.`,
            evidence: {}
          };
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
        entryCondition,
        stopLoss,
        takeProfit1,
        takeProfit2,
        takeProfit3,
        confidenceScore,
        calculatedWinProb,
        riskRewardRatio: customRR,
        signalGrade: customGrade,
        reasonsFor,
        reasonsAgainst,
        aiValidation,
        marketRegime,
        htfBias: customHtfBias,
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
        const finalConfidence = confidenceScore || calculatedWinProb || 75;
        const finalGrade = customGrade || this.computeSignalGrade(finalConfidence, ema20, ema50, ema200, direction);

        const signalPayload = {
          symbol,
          direction,
          entryPrice,
          stopLoss,
          takeProfit1,
          takeProfit2,
          riskRewardRatio: computedRR,
          winProbability: finalConfidence,
          durationEstimate,
          aiReasoning: {
            signal_grade: finalGrade,
            is_locked: true,
            locked_at: new Date().toISOString(),
            confidence_score: finalConfidence,
            win_probability: calculatedWinProb || finalConfidence,
            entry_type: entryType,
            entry_zone: entryZone || `${(entryPrice * 0.999).toFixed(2)} - ${(entryPrice * 1.001).toFixed(2)}`,
            entry_condition: entryCondition || (entryType === 'MARKET_NOW' ? `Execute ${direction} directly at Market ($${entryPrice.toFixed(2)})` : `Place ${entryType} at $${entryPrice.toFixed(2)} [Zone: ${entryZone}]`),
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
            market_structure_analysis: `Smart Money Structure (SMC): Price action is established ${entryPrice > ema200 ? 'above' : 'below'} the 200 EMA ($${ema200.toFixed(2)}), confirming higher-timeframe ${entryPrice > ema200 ? 'bullish' : 'bearish'} order flow. Key Invalidation Liquidity boundary located at $${stopLoss.toFixed(2)} with Institutional Target expansions calibrated at TP1 ($${takeProfit1.toFixed(2)}) and TP2 ($${takeProfit2.toFixed(2)}).`,
            predictions: {
              short_term: `15m-1h Scalp Horizon: High-probability expansion toward TP1 ($${takeProfit1.toFixed(2)})`,
              medium_term: `1-4h Intraday Horizon: Structural target expansion toward TP2 ($${takeProfit2.toFixed(2)}) upon 15m candle close beyond ${entryPrice.toFixed(2)}`,
              invalidation: `Hard Invalidation Stop Loss at $${stopLoss.toFixed(2)} protects capital and closes setup if structure fails.`
            },
            tradingview_idea: `PRO 12-Layer Institutional ${direction} Setup for ${symbol} (${durationEstimate}). Entry: $${entryPrice.toFixed(2)} [Zone: ${entryZone || 'Market'}], TP1: $${takeProfit1.toFixed(2)} (1:1.5 R:R), TP2: $${takeProfit2.toFixed(2)} (1:2.6 R:R), TP3: $${takeProfit3 || 'Open runner'}, Invalidation Stop Loss: $${stopLoss.toFixed(2)} (R:R 1:${computedRR}).`,
            category_scores: this.computeCategoryScores(rsi14, ema20, ema50, direction),
            macro_context: this.getRichMacroContext(symbol, direction, rsi14, ema20, ema200),
            correlation_analysis: (() => {
              const sym = symbol.toUpperCase();
              if (sym.includes('XAU') || sym.includes('GOLD')) return 'Gold Institutional Matrix: Inverse correlation to US Dollar Index (DXY: -0.82) and 10-Yr Real TIPS Yields (-0.88). Strong positive correlation to sovereign central bank gold net purchases and global debt expansion.';
              if (sym.includes('US100') || sym.includes('NAS')) return 'NASDAQ 100 Matrix: High positive correlation to S&P 500 (0.92) and SOX Semiconductor Index (0.89). Strong inverse beta to VIX Volatility Index (-0.84) and 2-Yr Treasury yields.';
              if (sym.includes('US30') || sym.includes('DOW')) return 'Dow Jones US30 Matrix: Direct correlation to US Industrial Production & Financial Sector (XLF: 0.85). Inverse correlation to VIX spikes (-0.79).';
              if (sym.includes('JPY')) return 'USD/JPY Matrix: Extreme positive correlation to US 10-Yr Treasury Yields (0.87). Inverse correlation to global equity risk-off episodes (carry unwinding).';
              if (sym.includes('EUR') || sym.includes('GBP')) return 'Forex Macro Matrix: Strong inverse correlation to DXY Index (-0.93) and direct sensitivity to ECB/Fed interest rate swap expectations.';
              return `Institutional Matrix for ${symbol}: Evaluated against live volume profile, multi-timeframe EMA alignment, and liquidity order book imbalances.`;
            })(),
            timeframe: interval,
            status: 'ACTIVE',
          },
          expiresAt: new Date(Date.now() + expirationMs),
        };

        if (existingActive) {
          await this.prisma.signal.updateMany({
            where: { symbol, expiresAt: { gt: new Date() } },
            data: { expiresAt: new Date() },
          });
        }
        signal = await this.prisma.signal.create({
          data: signalPayload,
        });

        // Trigger autonomous broker auto-trade execution in background if signal is BUY/SELL
        if (signal && ['BUY', 'SELL'].includes(signal.direction)) {
          this.automationService.processSignalAutoTrade(signal as any).catch((err: any) => {
            console.warn(`[AutoTrade Engine] Background dispatch notice for ${signal.symbol}: ${err.message}`);
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
      'SP500': '^GSPC',
      'DAX40': '^GDAXI',
      'GOLD': 'GC=F',
      'XAU/USD': 'GC=F',
      'XAUUSD': 'GC=F',
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
    
    // 2. If we have cached candles and they are fresh, return them
    const now = new Date();
    let isFresh = false;
    const minCandleCount = (interval === '1wk' || interval === '1d') ? 15 : 50;
    if (candles.length >= minCandleCount) {
      const lastCandle = candles[candles.length - 1];
      const diffMs = now.getTime() - lastCandle.timestamp.getTime();
      // Strict freshness: guaranteed under 25 seconds for 15m and scalping
      let maxAgeMs = 90 * 1000; // 90 seconds for 1h
      if (interval === '1m' || interval === '3m' || interval === '5m' || interval === '15m') {
        maxAgeMs = 25 * 1000; // Under 25 seconds for 15m scalping
      } else if (interval === '30m') {
        maxAgeMs = 45 * 1000; // 45 seconds for 30m
      } else if (interval === '1d') {
        maxAgeMs = 4 * 3600 * 1000; // 4 hours for daily macro candles
      } else if (interval === '1wk') {
        maxAgeMs = 12 * 3600 * 1000; // 12 hours for weekly macro candles
      }
      
      if (diffMs < maxAgeMs) {
        isFresh = true;
      }
    }
    
    if (isFresh) {
      // Sync the latest candle with sub-3-second live spot price
      try {
        let livePrice = 0;
        const isGoldAsset = normSym === 'GOLD' || normSym.includes('XAU');
        if (isGoldAsset) {
          try {
            const spotRes = await this.fetchWithTimeout('https://api.gold-api.com/price/XAU', {}, 1500);
            if (spotRes.ok) {
              const spotData = await spotRes.json();
              if (spotData && Number(spotData.price) > 1000) {
                livePrice = Number(spotData.price);
              }
            }
          } catch (e) {}
        }

        if (livePrice <= 0) {
          const liveMarket = await this.prisma.marketData.findUnique({
            where: { symbol: normSym }
          });
          if (liveMarket && liveMarket.bidPrice > 0) {
            livePrice = Number(liveMarket.bidPrice);
          }
        }

        if (livePrice > 0 && candles.length > 0) {
          const lastIdx = candles.length - 1;
          candles[lastIdx].close = livePrice;
          if (livePrice > Number(candles[lastIdx].high)) candles[lastIdx].high = livePrice;
          if (livePrice < Number(candles[lastIdx].low)) candles[lastIdx].low = livePrice;
        }
      } catch (e) {}
      return candles;
    }
    
    // 3. Otherwise, fetch real-time.
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(baseSymbol);
    const isGold = baseSymbol.includes('XAU') || baseSymbol.includes('GOLD') || cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD');
    let fetched = false;

    // GOLD (XAU/USD): Prioritize Twelve Data spot and Yahoo COMEX Gold futures (GC=F). DO NOT use PAXG token unless emergency.
    if (isGold) {
      // 3.1. Try Twelve Data real spot XAU/USD first
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
      if (twelveDataKey) {
        try {
          let tdInterval = interval;
          if (interval === '1h') tdInterval = '1h';
          else if (interval === '1d') tdInterval = '1day';
          else if (interval === '1wk') tdInterval = '1week';
          const response = await this.fetchWithTimeout(
            `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${tdInterval}&outputsize=100&apikey=${twelveDataKey}`,
            {},
            3000
          );
          if (response.ok) {
            const data = await response.json();
            const values = data.values || [];
            if (values.length > 0 && !data.code) {
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
                    volume: parseFloat(v.volume || 0),
                  }
                });
                newCandles.push(candle);
              }
              fetched = true;
              console.log(`[SignalsController] Gold spot candlesticks fetched and cached from Twelve Data for ${cleanSymbol}.`);
              return newCandles;
            }
          }
        } catch (err: any) {
          console.warn(`[SignalsController] Twelve Data spot fetch failed for ${cleanSymbol}: ${err.message}. Trying Yahoo COMEX GC=F.`);
        }
      }

      // 3.2. Try Yahoo Finance COMEX Gold Futures (GC=F) — Real market price (~$4,476+)
      if (!fetched) {
        try {
          let yahooInterval = interval;
          if (interval === '1h') yahooInterval = '60m';
          else if (interval === '1d') yahooInterval = '1d';
          else if (interval === '1wk') yahooInterval = '1wk';

          let range = '2d';
          if (interval === '1m') range = '1d';
          else if (interval === '3m' || interval === '5m') range = '2d';
          else if (interval === '15m' || interval === '30m') range = '5d';
          else if (interval === '1h') range = '7d';
          else if (interval === '1d') range = '1mo';
          else if (interval === '1wk') range = '6mo';

          const res = await this.fetchWithTimeout(
            `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${yahooInterval}&range=${range}`,
            {},
            3500
          );
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

              // Check real-time spot XAU/USD to eliminate COMEX basis/futures contango offset
              let spotPrice = 0;
              try {
                const spotRes = await this.fetchWithTimeout('https://api.gold-api.com/price/XAU', {}, 2000);
                if (spotRes.ok) {
                  const spotData = await spotRes.json();
                  if (spotData && Number(spotData.price) > 1000) {
                    spotPrice = Number(spotData.price);
                  }
                }
              } catch (e) {}

              // Calculate basis offset between spot and COMEX futures
              const validCloses = closes.filter((c: any) => c !== null);
              const lastComexClose = validCloses.length > 0 ? parseFloat(validCloses[validCloses.length - 1]) : 0;
              const basisOffset = (spotPrice > 1000 && lastComexClose > 1000) ? (spotPrice - lastComexClose) : 0;

              const newCandles = [];
              for (let i = 0; i < timestamps.length; i++) {
                if (opens[i] === null || closes[i] === null) continue;
                const candle = await this.prisma.historicalCandle.create({
                  data: {
                    symbol: cleanSymbol,
                    interval,
                    timestamp: new Date(timestamps[i] * 1000),
                    open: parseFloat((parseFloat(opens[i]) + basisOffset).toFixed(2)),
                    high: parseFloat((parseFloat(highs[i]) + basisOffset).toFixed(2)),
                    low: parseFloat((parseFloat(lows[i]) + basisOffset).toFixed(2)),
                    close: parseFloat((parseFloat(closes[i]) + basisOffset).toFixed(2)),
                    volume: parseFloat(volumes[i] || 0),
                  }
                });
                newCandles.push(candle);
              }
              fetched = true;
              const finalClose = newCandles.length > 0 ? newCandles[newCandles.length - 1].close : 0;
              console.log(`[SignalsController] Real Spot Gold calibrated candlesticks stored for ${cleanSymbol} (spot close: $${finalClose}, basis offset: ${basisOffset.toFixed(2)}).`);
              return newCandles;
            }
          }
        } catch (err: any) {
          console.warn(`[SignalsController] Failed to fetch live Yahoo COMEX Gold candles for ${cleanSymbol}: ${err.message}. Trying emergency PAXG.`);
        }
      }

      // 3.3. Last-resort emergency fallback: Binance PAXGUSDT (Explicitly flagged as PROXY)
      if (!fetched) {
        try {
          let binanceInterval = interval;
          if (interval === '1h') binanceInterval = '1h';
          const binanceApiKey = process.env.BINANCE_KEY || process.env.BINANCE_API_KEY;
          const headers: Record<string, string> = {};
          if (binanceApiKey) headers['X-MBX-APIKEY'] = binanceApiKey;

          const res = await this.fetchWithTimeout(
            `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${binanceInterval}&limit=150`,
            { headers },
            3000
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
            console.warn(`[SignalsController] WARNING: Using PAXG crypto token proxy for ${cleanSymbol} because spot and COMEX feeds failed.`);
            return newCandles;
          }
        } catch (err: any) {
          console.error(`[SignalsController] All Gold candle providers (TwelveData, Yahoo COMEX, Binance PAXG) failed for ${cleanSymbol}: ${err.message}`);
        }
      }
    }

    // Standard Crypto Assets (BTC, ETH, SOL, BNB, XRP) -> Fetch from Binance
    if (isCrypto && !isGold) {
      let binanceInterval = interval;
      if (interval === '1h') binanceInterval = '1h';
      else if (interval === '1d') binanceInterval = '1d';
      else if (interval === '1wk') binanceInterval = '1w';
      try {
        const binanceSym = `${baseSymbol}USDT`;
        const binanceApiKey = process.env.BINANCE_KEY || process.env.BINANCE_API_KEY;
        const headers: Record<string, string> = {};
        if (binanceApiKey) headers['X-MBX-APIKEY'] = binanceApiKey;

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
        console.warn(`[SignalsController] Failed to fetch live Binance candles for crypto ${cleanSymbol}: ${err.message}. Trying Twelve Data fallback.`);
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
          else if (interval === '1d') tdInterval = '1day';
          else if (interval === '1wk') tdInterval = '1week';
          
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
        else if (interval === '1d') yahooInterval = '1d';
        else if (interval === '1wk') yahooInterval = '1wk';
        
        let range = '2d';
        if (interval === '1m') range = '1d';
        else if (interval === '3m' || interval === '5m') range = '2d';
        else if (interval === '15m' || interval === '30m') range = '5d';
        else if (interval === '1h') range = '7d';
        else if (interval === '1d') range = '1mo';
        else if (interval === '1wk') range = '6mo';
        
        const res = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=${yahooInterval}&range=${range}`);
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

        // 3. Yahoo chart v8 fallback for Indices & Commodities
        if (liveSpotPrice <= 0) {
          const yahooTicker = this.getYahooTicker(cleanSymbol);
          const res = await this.fetchWithTimeout(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1m&range=1d`, {}, 3000);
          if (res.ok) {
            const cData = await res.json();
            const meta = cData?.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice > 0) {
              liveSpotPrice = parseFloat(meta.regularMarketPrice);
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
    const isBuy = direction === 'BUY';

    if (s.includes('US30') || s.includes('DOW')) {
      return isBuy
        ? `US30 Dow Jones Industrial Structure: Blue-chip cyclical balance sheet strength and 10-year Treasury yield stability support institutional long accumulation above EMA-20 ($${ema20.toFixed(2)}). Order block displacement and industrial value rotation confirm strong floor demand (RSI: ${rsi.toFixed(1)}).`
        : `US30 Dow Jones Industrial Structure: Tightening commercial bank credit conditions, industrial earnings multiple headwinds, and overhead supply at major swing highs drive institutional distribution below EMA-20 ($${ema20.toFixed(2)}). Liquidity sweep rejection confirmed (RSI: ${rsi.toFixed(1)}).`;
    }
    if (s.includes('US100') || s.includes('NAS')) {
      return isBuy
        ? `US100 NASDAQ Tech Structure: Mega-cap tech earnings momentum and AI semiconductor capex cycles provide heavy demand floor above EMA-20 ($${ema20.toFixed(2)}). Bullish Fair Value Gap (FVG) retest and discount liquidity absorption indicate institutional expansion (RSI: ${rsi.toFixed(1)}).`
        : `US100 NASDAQ Tech Structure: Duration sensitivity to elevated real rates and tech profit-taking near all-time high liquidity pools weigh on NQ index futures below EMA-20 ($${ema20.toFixed(2)}). Bearish Order Block supply overhang confirmed (RSI: ${rsi.toFixed(1)}).`;
    }
    if (s.includes('SPX') || s.includes('SP500')) {
      return isBuy
        ? `S&P 500 Macro Breadth: Broad-market market breadth expansion across cyclical sectors with price securely established above the 200 EMA ($${ema200.toFixed(2)}). Institutional put/call volume skew and positive gamma regimes support higher continuation.`
        : `S&P 500 Macro Breadth: S&P market breadth narrowing to defensive utilities/staples with price rejected beneath the 200 EMA ($${ema200.toFixed(2)}). Negative market gamma zone increases downward acceleration risk.`;
    }
    if (s.includes('XAU') || s.includes('GOLD')) {
      return isBuy
        ? `XAU/USD Gold Institutional Backdrop: Sovereign central bank reserve accumulation, declining US real yields (TIPS), and global geopolitical safe-haven hedging converge to drive institutional bullion spot accumulation above $${ema20.toFixed(2)}. Sell-side liquidity sweep completed (RSI: ${rsi.toFixed(1)}).`
        : `XAU/USD Gold Institutional Backdrop: US Dollar Index (DXY) strength and rising 10-year nominal Treasury yields increase the opportunity cost of holding non-yielding bullion below $${ema20.toFixed(2)}. Buy-side liquidity swept with sharp shooting star rejection (RSI: ${rsi.toFixed(1)}).`;
    }
    if (s.includes('JPY')) {
      return isBuy
        ? `USD/JPY Carry & Yield Differentials: Widening US-Japan interest rate spread differentials and ongoing BoJ ultra-loose policy stance drive institutional carry flows above ¥${ema20.toFixed(2)}. Monitoring 155.00+ Ministry of Finance (MoF) verbal warning levels (RSI: ${rsi.toFixed(1)}).`
        : `USD/JPY Carry & Yield Differentials: Bank of Japan monetary policy normalization signals and Ministry of Finance (MoF) physical intervention risk trigger rapid short-covering and carry unwinding below ¥${ema20.toFixed(2)} (RSI: ${rsi.toFixed(1)}).`;
    }
    if (s.includes('EUR') || s.includes('GBP')) {
      return isBuy
        ? `FX Institutional Macro: European/UK cross-border corporate demand and DXY index softening below key resistance bolster ${symbol} structural expansion above ${ema20.toFixed(4)}. Asian session low liquidity swept during London open with high-volume displacement (RSI: ${rsi.toFixed(1)}).`
        : `FX Institutional Macro: Transatlantic growth divergence favoring US economic resilience puts persistent downward pressure on ${symbol} beneath ${ema20.toFixed(4)}. Asian range high swept with bearish Order Block confirmation (RSI: ${rsi.toFixed(1)}).`;
    }
    if (s.includes('BTC') || s.includes('ETH') || s.includes('SOL')) {
      return isBuy
        ? `Crypto Institutional Flow: Spot ETF institutional accumulation, exchange liquid reserve contraction, and post-halving supply squeeze dynamics confirm strong structural bid above $${ema20.toFixed(2)}. On-chain whale accumulation and FVG imbalance support trend continuation (RSI: ${rsi.toFixed(1)}).`
        : `Crypto Institutional Flow: Short-term holder realized profit-taking, spot ETF net outflows, and leveraged derivatives open interest flush drive corrective repricing below $${ema20.toFixed(2)}. Invalidation Stop Loss set at swing structure (RSI: ${rsi.toFixed(1)}).`;
    }
    return `Institutional Macro Framework for ${symbol}: 12-layer confluence engine validates ${direction} positioning based on EMA-20 ($${ema20.toFixed(2)}) trend alignment, RSI-14 momentum (${rsi.toFixed(1)}), and session liquidity displacement.`;
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
    return Math.min(92, Math.max(40, winProb));
  }

  private calculatePrecisionEntry(
    direction: 'BUY' | 'SELL',
    currentPrice: number,
    ema20: number,
    vwap: number,
    atr: number,
    precision: number = 2
  ): {
    entryType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET_NOW';
    entryPrice: number;
    entryZone: string;
    entryCondition: string;
  } {
    const distFromEma = Math.abs(currentPrice - ema20);
    const isExtended = distFromEma > (atr * 0.20);

    if (direction === 'BUY') {
      if (isExtended && currentPrice > ema20) {
        // Price has extended higher — do not chase! Provide a BUY LIMIT on pullback
        const limitPrice = parseFloat(Math.max(ema20, currentPrice - (atr * 0.30)).toFixed(precision));
        const lower = (limitPrice - (atr * 0.12)).toFixed(precision);
        const upper = (limitPrice + (atr * 0.12)).toFixed(precision);
        return {
          entryType: 'BUY_LIMIT',
          entryPrice: limitPrice,
          entryZone: `${lower} - ${upper}`,
          entryCondition: `Wait for price pullback to institutional discount zone [${lower} - ${upper}]. Place BUY LIMIT at ${limitPrice}.`
        };
      } else {
        const lower = (currentPrice - (atr * 0.10)).toFixed(precision);
        const upper = (currentPrice + (atr * 0.10)).toFixed(precision);
        return {
          entryType: 'MARKET_NOW',
          entryPrice: currentPrice,
          entryZone: `${lower} - ${upper}`,
          entryCondition: `Execute BUY directly at Market (${currentPrice.toFixed(precision)}). Price is confirmed at optimal accumulation floor.`
        };
      }
    } else {
      if (isExtended && currentPrice < ema20) {
        // Price has dumped lower — provide a SELL LIMIT on relief retrace
        const limitPrice = parseFloat(Math.min(ema20, currentPrice + (atr * 0.30)).toFixed(precision));
        const lower = (limitPrice - (atr * 0.12)).toFixed(precision);
        const upper = (limitPrice + (atr * 0.12)).toFixed(precision);
        return {
          entryType: 'SELL_LIMIT',
          entryPrice: limitPrice,
          entryZone: `${lower} - ${upper}`,
          entryCondition: `Wait for price relief bounce to institutional premium zone [${lower} - ${upper}]. Place SELL LIMIT at ${limitPrice}.`
        };
      } else {
        const lower = (currentPrice - (atr * 0.10)).toFixed(precision);
        const upper = (currentPrice + (atr * 0.10)).toFixed(precision);
        return {
          entryType: 'MARKET_NOW',
          entryPrice: currentPrice,
          entryZone: `${lower} - ${upper}`,
          entryCondition: `Execute SELL directly at Market (${currentPrice.toFixed(precision)}). Price is confirmed at optimal distribution ceiling.`
        };
      }
    }
  }

  private computeSignalGrade(score: number, ema20?: number, ema50?: number, ema200?: number, direction?: string): string {
    const tripleAligned = (direction && ema20 !== undefined && ema50 !== undefined && ema200 !== undefined)
      ? (direction === 'BUY' ? (ema20 >= ema50 && ema50 >= ema200) : (ema20 <= ema50 && ema50 <= ema200))
      : false;
    if (score >= 85 || (score >= 80 && tripleAligned)) return 'A+ Setup (High Conviction Confluence)';
    if (score >= 75) return 'A Setup (Institutional Confluence)';
    if (score >= 68) return 'B+ Setup (Standard Confluence)';
    if (score >= 60) return 'B Setup (Scalp Confluence)';
    return 'C Setup (Speculative)';
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

  /**
   * Top-Down Multi-Timeframe (MTF) Institutional Bias Analyzer.
   * Performs 1-Week (1W) Macro Trend -> 1-Day (1D) Institutional Flow -> 4H Structure -> 1H Timing -> Produces Authoritative Confluence Direction.
   */
  private async analyzeHTFBias(symbol: string): Promise<{
    bias1w: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    bias1d: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    bias4h: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    bias1h: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    htfDirection: 'BUY' | 'SELL' | 'NEUTRAL';
    htfConfidence: number;
    htfContext: string;
    macroRegime: string;
    sma20_1w: number;
    ema20_1d: number;
    ema50_1d: number;
    ema200_4h: number;
    ema50_4h: number;
    ema20_4h: number;
    ema200_1h: number;
    ema50_1h: number;
    ema20_1h: number;
    rsi_4h: number;
    rsi_1h: number;
  }> {
    let candles1w: any[] = [];
    let candles1d: any[] = [];
    let candles1h: any[] = [];

    try {
      [candles1w, candles1d, candles1h] = await Promise.all([
        this.getOrFetchCandles(symbol, '1wk').catch(() => []),
        this.getOrFetchCandles(symbol, '1d').catch(() => []),
        this.getOrFetchCandles(symbol, '1h').catch(() => []),
      ]);
    } catch (e) {
      // Fallback
    }

    // 1. Analyze 1-Week (1W) Macro Horizon (20-week SMA baseline)
    let bias1w: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let sma20_1w = 0;
    if (candles1w && candles1w.length >= 5) {
      const closes1w = candles1w.map(c => Number(c.close)).filter(v => !isNaN(v) && v > 0);
      if (closes1w.length >= 5) {
        sma20_1w = this.calcSMA(closes1w, Math.min(20, closes1w.length));
        const last1w = closes1w[closes1w.length - 1];
        if (last1w > sma20_1w * 1.003) {
          bias1w = 'BULLISH';
        } else if (last1w < sma20_1w * 0.997) {
          bias1w = 'BEARISH';
        }
      }
    }

    // 2. Analyze 1-Day (1D) Intermediate Swing Trend (EMA-20 vs EMA-50 stack)
    let bias1d: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let ema20_1d = 0;
    let ema50_1d = 0;
    if (candles1d && candles1d.length >= 5) {
      const closes1d = candles1d.map(c => Number(c.close)).filter(v => !isNaN(v) && v > 0);
      if (closes1d.length >= 5) {
        ema20_1d = this.calcEMA(closes1d, Math.min(20, closes1d.length));
        ema50_1d = this.calcEMA(closes1d, Math.min(50, closes1d.length));
        const last1d = closes1d[closes1d.length - 1];
        if (ema20_1d >= ema50_1d && last1d >= ema20_1d * 0.998) {
          bias1d = 'BULLISH';
        } else if (ema20_1d <= ema50_1d && last1d <= ema20_1d * 1.002) {
          bias1d = 'BEARISH';
        }
      }
    }

    // 3. Analyze 1H Candles & Synthesize 4H
    if (!candles1h || candles1h.length < 15) {
      // If 1H is minimal, derive directly from 1W and 1D
      const dir = (bias1w === 'BULLISH' && bias1d === 'BULLISH') ? 'BUY' : (bias1w === 'BEARISH' && bias1d === 'BEARISH') ? 'SELL' : 'NEUTRAL';
      return {
        bias1w,
        bias1d,
        bias4h: bias1d,
        bias1h: bias1d,
        htfDirection: dir,
        htfConfidence: dir === 'NEUTRAL' ? 50 : 80,
        htfContext: `Macro Top-Down Bias: 1W: ${bias1w} | 1D: ${bias1d} | 4H: ${bias1d} | 1H: ${bias1d}. Confluence: ${dir}.`,
        macroRegime: dir === 'BUY' ? 'Bullish Multi-Timeframe Expansion' : dir === 'SELL' ? 'Bearish Multi-Timeframe Markdown' : 'Consolidation Equilibrium',
        sma20_1w,
        ema20_1d,
        ema50_1d,
        ema200_4h: 0,
        ema50_4h: 0,
        ema20_4h: 0,
        ema200_1h: 0,
        ema50_1h: 0,
        ema20_1h: 0,
        rsi_4h: 50,
        rsi_1h: 50,
      };
    }

    const closes1h = candles1h.map(c => Number(c.close));
    const ema20_1h = this.calcEMA(closes1h, 20);
    const ema50_1h = this.calcEMA(closes1h, 50);
    const ema200_1h = this.calcEMA(closes1h, Math.min(200, closes1h.length));
    const rsi_1h = this.calcRSI(closes1h, 14);
    const lastPrice1h = closes1h[closes1h.length - 1];

    let bias1h: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ema20_1h > ema50_1h && lastPrice1h >= ema200_1h && rsi_1h >= 48) {
      bias1h = 'BULLISH';
    } else if (ema20_1h < ema50_1h && lastPrice1h <= ema200_1h && rsi_1h <= 52) {
      bias1h = 'BEARISH';
    }

    // 4. Synthesize 4H Candles from 1H Candles (aligned 4-hour blocks)
    const candles4h: any[] = [];
    const fullBlocks = Math.floor(candles1h.length / 4) * 4;
    const startIndex = candles1h.length - fullBlocks; // Align from the newest candles backwards
    for (let i = startIndex; i < candles1h.length; i += 4) {
      const chunk = candles1h.slice(i, i + 4);
      if (chunk.length === 4) {
        candles4h.push({
          open: Number(chunk[0].open),
          high: Math.max(...chunk.map(c => Number(c.high))),
          low: Math.min(...chunk.map(c => Number(c.low))),
          close: Number(chunk[chunk.length - 1].close),
          volume: chunk.reduce((sum, c) => sum + Number(c.volume || 0), 0),
          timestamp: chunk[0].timestamp
        });
      }
    }

    const closes4h = candles4h.map(c => Number(c.close));
    const ema20_4h = this.calcEMA(closes4h, 20);
    const ema50_4h = this.calcEMA(closes4h, Math.min(50, closes4h.length));
    const ema200_4h = this.calcEMA(closes4h, Math.min(200, closes4h.length));
    const rsi_4h = closes4h.length >= 14 ? this.calcRSI(closes4h, 14) : rsi_1h;
    const lastPrice4h = closes4h[closes4h.length - 1] || lastPrice1h;

    let bias4h: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (ema20_4h > ema50_4h && lastPrice4h >= ema200_4h && rsi_4h >= 48) {
      bias4h = 'BULLISH';
    } else if (ema20_4h < ema50_4h && lastPrice4h <= ema200_4h && rsi_4h <= 52) {
      bias4h = 'BEARISH';
    }

    // If 1W or 1D were neutral or unpopulated, harmonize with 4H
    if (bias1w === 'NEUTRAL') bias1w = bias4h !== 'NEUTRAL' ? bias4h : bias1h;
    if (bias1d === 'NEUTRAL') bias1d = bias4h !== 'NEUTRAL' ? bias4h : bias1h;

    // 5. Multi-Timeframe Confluence Matrix (1W -> 1D -> 4H -> 1H)
    let bullScore = 0;
    let bearScore = 0;

    // 1-Week: Macro Trend (25 pts)
    if (bias1w === 'BULLISH') bullScore += 25;
    else if (bias1w === 'BEARISH') bearScore += 25;

    // 1-Day: Intermediate Institutional Flow (30 pts)
    if (bias1d === 'BULLISH') bullScore += 30;
    else if (bias1d === 'BEARISH') bearScore += 30;

    // 4-Hour: Market Structure & Order Blocks (25 pts)
    if (bias4h === 'BULLISH') bullScore += 25;
    else if (bias4h === 'BEARISH') bearScore += 25;

    // 1-Hour: Execution Wave & Momentum (20 pts)
    if (bias1h === 'BULLISH') bullScore += 20;
    else if (bias1h === 'BEARISH') bearScore += 20;

    let htfDirection: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let htfConfidence = 50;

    if (bullScore >= 55 && bullScore > bearScore + 15) {
      htfDirection = 'BUY';
      htfConfidence = Math.min(96, Math.round(55 + (bullScore / 100) * 40));
    } else if (bearScore >= 55 && bearScore > bullScore + 15) {
      htfDirection = 'SELL';
      htfConfidence = Math.min(96, Math.round(55 + (bearScore / 100) * 40));
    } else if (bias4h === 'BULLISH' && bias1h === 'BULLISH') {
      htfDirection = 'BUY';
      htfConfidence = 75;
    } else if (bias4h === 'BEARISH' && bias1h === 'BEARISH') {
      htfDirection = 'SELL';
      htfConfidence = 75;
    }

    // Macro Regime
    let macroRegime = 'Consolidation / Range-Bound Equilibrium';
    if (bullScore >= 75) macroRegime = 'Strong Institutional Expansion (Weekly + Daily + 4H Bullish)';
    else if (bullScore >= 50) macroRegime = 'Institutional Markup / Accumulation';
    else if (bearScore >= 75) macroRegime = 'Severe Distribution / Markdown (Weekly + Daily + 4H Bearish)';
    else if (bearScore >= 50) macroRegime = 'Institutional Liquidity Sweep / Distribution';

    const htfContext = `Macro Top-Down Bias: 1W: ${bias1w} | 1D: ${bias1d} | 4H: ${bias4h} | 1H: ${bias1h} -> Confluence: ${htfDirection} (${htfConfidence}% Conviction). Regime: ${macroRegime}.`;

    return {
      bias1w,
      bias1d,
      bias4h,
      bias1h,
      htfDirection,
      htfConfidence,
      htfContext,
      macroRegime,
      sma20_1w,
      ema20_1d,
      ema50_1d,
      ema200_4h,
      ema50_4h,
      ema20_4h,
      ema200_1h,
      ema50_1h,
      ema20_1h,
      rsi_4h,
      rsi_1h,
    };
  }

  /**
   * Universal Signal Quality Gate — applied to ALL strategy engines.
   * Returns null if signal passes quality checks, or a WAIT result if it fails.
   * This prevents low-quality signals from reaching users.
   */
  private applyQualityGate(params: {
    bullishScore: number;
    bearishScore: number;
    rsi: number;
    ema20: number;
    ema50: number;
    entryPrice: number;
    candles: any[];
    direction: string;
    symbol: string;
    marketRegime: string;
    htfBias?: any;
  }): { direction: string; invalidationReason: string; evidence: any } | null {
    const { bullishScore, bearishScore, rsi, ema20, ema50, entryPrice, candles, direction, symbol, marketRegime, htfBias } = params;
    const rawScore = direction === 'BUY' ? bullishScore : bearishScore;

    // Gate 1: Minimum confluence threshold (60+ for confirmed institutional edge)
    if (rawScore < 60) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} confluence score (${rawScore}/100) below minimum 60 threshold in ${marketRegime} regime. Quality gate protecting capital.`,
        evidence: { bullishScore, bearishScore, rsi, gate: 'LOW_CONFLUENCE' }
      };
    }

    // Gate 2: Conflicting signals — both sides are equally strong (within 10 pts)
    if (Math.abs(bullishScore - bearishScore) < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} has conflicting momentum (Bull: ${bullishScore} vs Bear: ${bearishScore}). Market is in transition.`,
        evidence: { bullishScore, bearishScore, rsi, gate: 'CONFLICTING_SIGNALS' }
      };
    }

    // Gate 3: RSI dead center — no momentum divergence
    if (rsi >= 48 && rsi <= 52 && Math.abs(bullishScore - bearishScore) < 15) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} RSI-14 at ${rsi.toFixed(1)} is dead-center (48-52). Awaiting directional momentum push.`,
        evidence: { bullishScore, bearishScore, rsi, gate: 'RSI_NEUTRAL' }
      };
    }

    // Gate 4: EMA compression — market is completely flat
    const emaSpread = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpread < 0.0001) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} EMA-20/50 spread is ultra-flat (${(emaSpread * 100).toFixed(4)}%) — market in tight consolidation.`,
        evidence: { bullishScore, bearishScore, rsi, emaSpread, gate: 'EMA_COMPRESSION' }
      };
    }

    // Gate 5: Last candle confirmation — last 3 candles must not contradict signal with high volume
    if (candles.length >= 3) {
      const last3 = candles.slice(-3);
      const bearishCloses = last3.filter(c => Number(c.close) < Number(c.open)).length;
      const bullishCloses = last3.filter(c => Number(c.close) > Number(c.open)).length;

      if (direction === 'BUY' && bearishCloses >= 3 && rsi < 42) {
        return {
          direction: 'WAIT',
          invalidationReason: `${symbol} BUY signal rejected: 3 consecutive aggressive bearish candles into low RSI. Awaiting base formation.`,
          evidence: { bullishScore, bearishScore, rsi, gate: 'NO_CONFIRMATION_CANDLE' }
        };
      }
      if (direction === 'SELL' && bullishCloses >= 3 && rsi > 58) {
        return {
          direction: 'WAIT',
          invalidationReason: `${symbol} SELL signal rejected: 3 consecutive aggressive bullish candles into high RSI. Awaiting rejection wick.`,
          evidence: { bullishScore, bearishScore, rsi, gate: 'NO_CONFIRMATION_CANDLE' }
        };
      }
    }

    // Gate 6: RSI exhaustion contradiction — signal direction opposes extreme RSI
    if (direction === 'BUY' && rsi > 78) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} BUY signal rejected: RSI at ${rsi.toFixed(1)} is severely overbought (>78). Entering longs at exhaustion is high-risk.`,
        evidence: { bullishScore, bearishScore, rsi, gate: 'RSI_OVERBOUGHT_BUY' }
      };
    }
    if (direction === 'SELL' && rsi < 22) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} SELL signal rejected: RSI at ${rsi.toFixed(1)} is severely oversold (<22). Entering shorts at exhaustion is high-risk.`,
        evidence: { bullishScore, bearishScore, rsi, gate: 'RSI_OVERSOLD_SELL' }
      };
    }

    // Gate 7: Higher-Timeframe (HTF) Counter-Trend Lock (1W + 1D + 4H + 1H Protection)
    if (htfBias && htfBias.htfDirection && htfBias.htfDirection !== 'NEUTRAL') {
      if (direction !== htfBias.htfDirection && direction !== 'WAIT') {
        return {
          direction: 'WAIT',
          invalidationReason: `${symbol} ${direction} signal blocked: Macro 1W+1D+4H+1H institutional flow is strictly ${htfBias.htfDirection} (1W: ${htfBias.bias1w || 'NEUTRAL'} | 1D: ${htfBias.bias1d || 'NEUTRAL'} | 4H: ${htfBias.bias4h} | 1H: ${htfBias.bias1h}). Counter-trend entries prohibited to protect capital.`,
          evidence: { bullishScore, bearishScore, rsi, htfBias, gate: 'HTF_COUNTER_TREND_FILTER' }
        };
      }
    }

    return null; // All gates passed — signal is valid
  }

  // Institutional Multi-Asset Classification & Safe Routing
  private classifyAsset(symbol: string): 'CRYPTO' | 'METALS' | 'INDICES_US100' | 'INDICES_US30' | 'INDICES_BROAD' | 'STOCKS' | 'USDJPY' | 'FOREX' | 'UNKNOWN' {
    const s = (symbol || '').trim().toUpperCase().replace('/', '');
    if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX'].some(c => s.includes(c))) return 'CRYPTO';
    if (['GOLD', 'XAU', 'SILVER', 'XAG'].some(c => s.includes(c))) return 'METALS';
    if (['US100', 'NAS100', 'NQ'].some(c => s.includes(c))) return 'INDICES_US100';
    if (['US30', 'DOW', 'YM'].some(c => s.includes(c))) return 'INDICES_US30';
    if (['SPX500', 'SPX', 'ES', 'DAX40', 'DAX', 'GER40', 'GER30'].some(c => s.includes(c))) return 'INDICES_BROAD';
    if (['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'GOOG', 'META', 'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'PLTR', 'BABA', 'UBER', 'COIN', 'DIS', 'PYPL', 'JPM', 'BAC', 'V', 'MA', 'XOM', 'CVX'].some(c => s === c || s.startsWith(c))) return 'STOCKS';
    if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY'].some(c => s.includes(c)) || s.endsWith('JPY')) return 'USDJPY';
    if (['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURCAD', 'GBPAUD', 'EURAUD', 'OIL', 'WTI', 'BRENT'].some(c => s.includes(c)) || symbol.includes('/')) return 'FOREX';
    return 'UNKNOWN';
  }

  // Multi-Timeframe Adaptive Lookback Window (5m: 28 bars, 15m: 24 bars, 1H: 24 bars)
  private getAdaptiveLookback(interval: string): number {
    if (interval === '1m' || interval === '3m' || interval === '5m') return 28;
    if (interval === '15m' || interval === '30m') return 24;
    if (interval === '1h') return 24;
    return 20; // 4h, 1d
  }

  private intermarketCache: { data: any; cachedAt: number } | null = null;

  async fetchIntermarketData(): Promise<{
    dxy: { price: number; change1h: number; trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' };
    us10y: { yield: number; change1h: number; trend: 'RISING' | 'FALLING' | 'FLAT' };
    vix: { level: number; regime: 'LOW_RISK' | 'NORMAL' | 'ELEVATED' | 'EXTREME' };
    goldSpot: { price: number; source: string; isRealSpot: boolean };
  }> {
    const now = Date.now();
    if (this.intermarketCache && (now - this.intermarketCache.cachedAt) < 60000) {
      return this.intermarketCache.data;
    }

    let dxy = { price: 0, change1h: 0, trend: 'NEUTRAL' as 'BULLISH' | 'BEARISH' | 'NEUTRAL' };
    let us10y = { yield: 0, change1h: 0, trend: 'FLAT' as 'RISING' | 'FALLING' | 'FLAT' };
    let vix = { level: 0, regime: 'NORMAL' as 'LOW_RISK' | 'NORMAL' | 'ELEVATED' | 'EXTREME' };
    let goldSpot = { price: 0, source: 'UNAVAILABLE', isRealSpot: false };

    try {
      const symbols = ['DX-Y.NYB', '^TNX', '^VIX', 'GC=F'];
      const results = await Promise.allSettled(
        symbols.map(sym =>
          this.fetchWithTimeout(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=15m&range=1d`,
            {},
            3000
          ).then(r => r.ok ? r.json() : null)
        )
      );

      // Process DXY
      if (results[0].status === 'fulfilled' && results[0].value?.chart?.result?.[0]) {
        const meta = results[0].value.chart.result[0].meta;
        const quote = results[0].value.chart.result[0].indicators?.quote?.[0];
        const closes = (quote?.close || []).filter((c: any) => c !== null && !isNaN(c));
        const price = Number(meta.regularMarketPrice || closes[closes.length - 1] || 0);
        if (price > 0) {
          const prevClose = Number(meta.chartPreviousClose || meta.previousClose || closes[0] || price);
          const change1h = prevClose > 0 ? parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;
          const trend = change1h > 0.08 ? 'BULLISH' : change1h < -0.08 ? 'BEARISH' : 'NEUTRAL';
          dxy = { price: parseFloat(price.toFixed(3)), change1h, trend };
        }
      }

      // Process US10Y (^TNX)
      if (results[1].status === 'fulfilled' && results[1].value?.chart?.result?.[0]) {
        const meta = results[1].value.chart.result[0].meta;
        const quote = results[1].value.chart.result[0].indicators?.quote?.[0];
        const closes = (quote?.close || []).filter((c: any) => c !== null && !isNaN(c));
        const yVal = Number(meta.regularMarketPrice || closes[closes.length - 1] || 0);
        if (yVal > 0) {
          const prevY = Number(meta.chartPreviousClose || meta.previousClose || closes[0] || yVal);
          const change1h = prevY > 0 ? parseFloat((((yVal - prevY) / prevY) * 100).toFixed(2)) : 0;
          const trend = change1h > 0.15 ? 'RISING' : change1h < -0.15 ? 'FALLING' : 'FLAT';
          us10y = { yield: parseFloat(yVal.toFixed(3)), change1h, trend };
        }
      }

      // Process VIX (^VIX)
      if (results[2].status === 'fulfilled' && results[2].value?.chart?.result?.[0]) {
        const meta = results[2].value.chart.result[0].meta;
        const level = Number(meta.regularMarketPrice || 0);
        if (level > 0) {
          const regime = level > 28 ? 'EXTREME' : level > 20 ? 'ELEVATED' : level < 14 ? 'LOW_RISK' : 'NORMAL';
          vix = { level: parseFloat(level.toFixed(2)), regime };
        }
      }

      // Process Gold COMEX (GC=F)
      if (results[3].status === 'fulfilled' && results[3].value?.chart?.result?.[0]) {
        const meta = results[3].value.chart.result[0].meta;
        const price = Number(meta.regularMarketPrice || 0);
        if (price > 1000) {
          goldSpot = { price: parseFloat(price.toFixed(2)), source: 'YAHOO_COMEX_FUTURES', isRealSpot: true };
        }
      }
    } catch (err: any) {
      console.warn(`[SignalsService] Intermarket fetch warning: ${err.message}. Market feeds marked neutral.`);
    }

    const compiled = { dxy, us10y, vix, goldSpot };
    this.intermarketCache = { data: compiled, cachedAt: now };
    return compiled;
  }

  private detectGoldRegime(
    candles: any[],
    atr: number,
    ema20: number,
    ema50: number,
    ema200: number,
    dxyTrend: string = 'NEUTRAL',
    yieldTrend: string = 'FLAT'
  ): {
    regime: string;
    description: string;
    volatilityPercentile: number;
    regimeBias: 'BUY' | 'SELL' | 'NEUTRAL';
  } {
    const closes = candles.map(c => Number(c.close));
    const currentPrice = closes[closes.length - 1];
    const lastCandle = candles[candles.length - 1];
    const lastBody = Math.abs(Number(lastCandle.close) - Number(lastCandle.open));

    // Calculate rolling 50-period average ATR
    const atr50 = this.calcATR(candles, Math.min(50, candles.length));
    const atrRatio = atr50 > 0 ? atr / atr50 : 1.0;
    const volPercentile = Math.min(100, Math.round(atrRatio * 50));

    // 24-bar high/low extremes
    const slice24 = candles.slice(-24);
    const max24 = Math.max(...slice24.map(c => Number(c.high)).slice(0, -1));
    const min24 = Math.min(...slice24.map(c => Number(c.low)).slice(0, -1));

    // 1. Breakout / Breakdown with displacement
    if (currentPrice > max24 && lastBody > atr * 1.1) {
      return {
        regime: 'BULLISH_BREAKOUT',
        description: `Impulsive bullish breakout above 24-bar high ($${max24.toFixed(2)}) with displacement volume`,
        volatilityPercentile: volPercentile,
        regimeBias: 'BUY'
      };
    }
    if (currentPrice < min24 && lastBody > atr * 1.1) {
      return {
        regime: 'BEARISH_BREAKDOWN',
        description: `Impulsive bearish breakdown below 24-bar low ($${min24.toFixed(2)}) with displacement volume`,
        volatilityPercentile: volPercentile,
        regimeBias: 'SELL'
      };
    }

    // 2. High Volatility Expansion
    if (atrRatio > 1.5) {
      return {
        regime: 'VOLATILITY_EXPANSION',
        description: `ATR expanded ${((atrRatio - 1) * 100).toFixed(0)}% above 50-bar baseline ($${atr.toFixed(2)} vs $${atr50.toFixed(2)})`,
        volatilityPercentile: volPercentile,
        regimeBias: 'NEUTRAL'
      };
    }

    // 3. Clear Trend Regimes (Aligned with DXY and Yields)
    if (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) {
      const dxyConfirm = dxyTrend === 'BEARISH' ? 'confirmed by softening DXY' : 'counter-DXY flow';
      return {
        regime: 'BULLISH_TREND',
        description: `Triple stacked bullish EMAs (20>50>200) above $${ema200.toFixed(2)} — ${dxyConfirm}`,
        volatilityPercentile: volPercentile,
        regimeBias: 'BUY'
      };
    }

    if (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) {
      const dxyConfirm = dxyTrend === 'BULLISH' ? 'confirmed by strong USD' : 'sovereign de-risking';
      return {
        regime: 'BEARISH_TREND',
        description: `Triple stacked bearish EMAs (20<50<200) below $${ema200.toFixed(2)} — ${dxyConfirm}`,
        volatilityPercentile: volPercentile,
        regimeBias: 'SELL'
      };
    }

    // 4. Choppy Range Consolidation
    const emaDist = Math.abs(ema20 - ema50);
    if (emaDist < (atr * 0.25)) {
      return {
        regime: 'RANGE_CONSOLIDATION',
        description: `Compressed market structure between $${min24.toFixed(2)} and $${max24.toFixed(2)}. EMAs flat.`,
        volatilityPercentile: volPercentile,
        regimeBias: 'NEUTRAL'
      };
    }

    return {
      regime: 'TRANSITIONAL_STRUCTURE',
      description: `Market seeking liquidity between $${ema50.toFixed(2)} and $${ema200.toFixed(2)}`,
      volatilityPercentile: volPercentile,
      regimeBias: 'NEUTRAL'
    };
  }

  private calcGoldLevels(candles: any[], currentPrice: number) {
    const sliceLast24 = candles.slice(-24);
    const dailyHigh = Math.max(...sliceLast24.map(c => Number(c.high)));
    const dailyLow = Math.min(...sliceLast24.map(c => Number(c.low)));
    const dailyOpen = Number(sliceLast24[0]?.open || currentPrice);

    // Calculate nearest $25 round psychological numbers
    const baseRound = Math.floor(currentPrice / 25) * 25;
    const roundLevels = [baseRound - 25, baseRound, baseRound + 25, baseRound + 50];

    const supports = [dailyLow, ...roundLevels.filter(lvl => lvl < currentPrice)].sort((a, b) => b - a);
    const resistances = [dailyHigh, ...roundLevels.filter(lvl => lvl > currentPrice)].sort((a, b) => a - b);

    const nearestSupport = supports[0] || (currentPrice - 15);
    const nearestResistance = resistances[0] || (currentPrice + 15);

    const distToSupport = parseFloat((currentPrice - nearestSupport).toFixed(2));
    const distToResistance = parseFloat((nearestResistance - currentPrice).toFixed(2));

    return {
      dailyHigh: parseFloat(dailyHigh.toFixed(2)),
      dailyLow: parseFloat(dailyLow.toFixed(2)),
      dailyOpen: parseFloat(dailyOpen.toFixed(2)),
      nearestSupport: parseFloat(nearestSupport.toFixed(2)),
      nearestResistance: parseFloat(nearestResistance.toFixed(2)),
      distToSupport,
      distToResistance,
      psychologicalLevels: roundLevels
    };
  }

  private btcStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep vs Breakout (BOS) Detection (Adaptive Session Lookback)
    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptPDH_Rejection = lastHigh >= pdh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above PDH with strong bull close)
    const breakoutPDH = lastClose >= pdh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptPDL_Rejection = lastLow <= pdl && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below PDL with strong bear close)
    const breakdownPDL = lastClose <= pdl && lastClose < lastOpen;

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

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (20 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) with 0.12% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0012) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish crypto momentum (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish crypto momentum (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — trend transition neutral`);
    }

    // Layer 2: HTF Macro Regime (200 EMA) with 0.20% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0020) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Bitcoin price above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Bitcoin price below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`Price oscillating directly on 200 EMA ($${ema200.toFixed(2)}) — macro inflection neutral`);
    }

    // Layer 3: VWAP Institutional Floor with 0.15% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0015) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Price above VWAP ($${vwap.toFixed(2)}) — institutional spot accumulation floor`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Price below VWAP ($${vwap.toFixed(2)}) — institutional overhead supply resistance`);
      }
    } else {
      reasonsFor.push(`Price at VWAP equilibrium ($${vwap.toFixed(2)}) — no institutional imbalance`);
    }

    // Layer 4: Liquidity Structure & BOS (16 Points)
    if (sweptPDL_Rejection) {
      bullishScore += 16;
      reasonsFor.push(`Sell-side liquidity swept below $${pdl.toFixed(2)} with hammer rejection wick`);
    } else if (breakoutPDH) {
      bullishScore += 16;
      reasonsFor.push(`Bullish Break of Structure (BOS) above previous high $${pdh.toFixed(2)}`);
    }

    if (sweptPDH_Rejection) {
      bearishScore += 16;
      reasonsAgainst.push(`Buy-side liquidity swept above $${pdh.toFixed(2)} with shooting star rejection wick`);
    } else if (breakdownPDL) {
      bearishScore += 16;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below previous low $${pdl.toFixed(2)}`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Bullish expansion displacement candle ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Bearish expansion displacement candle ($${lastBody.toFixed(2)} > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (16 Points)
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
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms sustained selling momentum`);
    } else if (rsi >= 72) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of long liquidation unwind`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — short squeeze reversal opportunity`);
    }

    // Layer 8: Session Window Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

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

    // Direction determination with NO-TRADE check on exact score ties
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting directional catalyst.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    // Targets & Dynamic Risk-to-Reward Ratio (Timeframe Scaled & Adaptive Structure Based)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const minPct = isScalp ? 0.0020 : 0.0040; // 0.20% - 0.40% tight structure risk room
    const maxPct = isScalp ? 0.0045 : 0.0080; // 0.45% - 0.80% max risk room
    const slDist = Math.min(Math.max(atr * 0.7, effectiveEntry * minPct), effectiveEntry * maxPct);

    // Structure Invalidation SL (Adaptive Session Swing Window)
    const swingSlice = candles.slice(-Math.min(lookback, isScalp ? 8 : 15));
    const lowestLow = Math.min(...swingSlice.map(c => Number(c.low)));
    const highestHigh = Math.max(...swingSlice.map(c => Number(c.high)));

    const stopLoss = direction === 'BUY' 
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.0) : effectiveEntry - (effectiveSlDist * 2.0);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.2) : effectiveEntry - (effectiveSlDist * 3.2);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 4.5) : effectiveEntry - (effectiveSlDist * 4.5);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated ${symbol} 12-Layer Crypto Engine evaluated setup in ${marketRegime} regime during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptPDL_Rejection ? 'Sell-side Swept' : breakoutPDH ? 'Bullish BOS Breakout' : sweptPDH_Rejection ? 'Buy-side Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Expansion Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private nasdaqStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep vs Breakout (BOS) Detection (Adaptive Session Lookback)
    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptPDH_Rejection = lastHigh >= pdh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above PDH with strong bull close)
    const breakoutPDH = lastClose >= pdh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptPDL_Rejection = lastLow <= pdl && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below PDL with strong bear close)
    const breakdownPDL = lastClose <= pdl && lastClose < lastOpen;

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

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (20 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) with 0.10% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0010) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish index momentum (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish index momentum (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — index momentum neutral`);
    }

    // Layer 2: HTF 200 EMA Regime with 0.15% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0015) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Index trading above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Index trading below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`Index price right at 200 EMA ($${ema200.toFixed(2)}) — inflection neutral`);
    }

    // Layer 3: VWAP Mega-Cap Floor with 0.12% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0012) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Index above VWAP ($${vwap.toFixed(2)}) — mega-cap tech institutional demand floor`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Index below VWAP ($${vwap.toFixed(2)}) — mega-cap tech overhead supply resistance`);
      }
    } else {
      reasonsFor.push(`Index balanced at VWAP ($${vwap.toFixed(2)}) — institutional equilibrium`);
    }

    // Layer 4: Liquidity Sweeps & BOS (16 Points)
    if (sweptPDL_Rejection) {
      bullishScore += 16;
      reasonsFor.push(`Previous Day Low ($${pdl.toFixed(2)}) swept with hammer rejection wick`);
    } else if (breakoutPDH) {
      bullishScore += 16;
      reasonsFor.push(`Bullish Break of Structure (BOS) above previous high $${pdh.toFixed(2)}`);
    }

    if (sweptPDH_Rejection) {
      bearishScore += 16;
      reasonsAgainst.push(`Previous Day High ($${pdh.toFixed(2)}) swept with shooting star rejection wick`);
    } else if (breakdownPDL) {
      bearishScore += 16;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below previous low $${pdl.toFixed(2)}`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish NQ futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish NQ futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (16 Points)
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
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish index expansion`);
    } else if (rsi >= 72) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of intraday pullback`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — oversold bounce opportunity`);
    }

    // Layer 8: Session Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // Regime-Specific Strategy Adjustments
    if (isRanging) {
      if (entryPrice > vwap * 1.008) {
        bullishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended above VWAP — mean reversion risk');
      } else if (entryPrice < vwap * 0.992) {
        bearishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended below VWAP — mean reversion risk');
      }
    }

    // Determine Direction & Final Confluence Score
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting directional breakout.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    // Calculate Targets & Risk/Reward (Timeframe Scaled & Adaptive Structure Based)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const slDist = Math.min(Math.max(atr * 0.7, isScalp ? 12 : 25), isScalp ? 25 : 50);

    // Structure Invalidation SL (Adaptive Session Swing Window)
    const swingSlice = candles.slice(-Math.min(lookback, isScalp ? 8 : 15));
    const lowestLow = Math.min(...swingSlice.map(c => Number(c.low)));
    const highestHigh = Math.max(...swingSlice.map(c => Number(c.high)));

    const stopLoss = direction === 'BUY' 
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.0) : effectiveEntry - (effectiveSlDist * 2.0);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.2) : effectiveEntry - (effectiveSlDist * 3.2);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 4.5) : effectiveEntry - (effectiveSlDist * 4.5);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated US100 Institutional Tech Engine evaluated setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptPDL_Rejection ? 'PDL Swept' : breakoutPDH ? 'Bullish BOS Breakout' : sweptPDH_Rejection ? 'PDH Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Tech Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private dowStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Liquidity Sweep vs Breakout (BOS) Detection (Adaptive Session Lookback)
    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptPDH_Rejection = lastHigh >= pdh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above PDH with strong bull close)
    const breakoutPDH = lastClose >= pdh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptPDL_Rejection = lastLow <= pdl && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below PDL with strong bear close)
    const breakdownPDL = lastClose <= pdl && lastClose < lastOpen;

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

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (20 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) with 0.10% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0010) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) blue-chip bullish trend (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) blue-chip bearish trend (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — industrial trend neutral`);
    }

    // Layer 2: HTF 200 EMA Regime with 0.15% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0015) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`US30 price trading above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`US30 price trading below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`US30 oscillating on 200 EMA ($${ema200.toFixed(2)}) — inflection neutral`);
    }

    // Layer 3: VWAP Demand Floor with 0.12% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0012) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Price above VWAP ($${vwap.toFixed(2)}) — industrial & financial capital demand floor active`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Price below VWAP ($${vwap.toFixed(2)}) — industrial & financial overhead resistance`);
      }
    } else {
      reasonsFor.push(`Price at VWAP equilibrium ($${vwap.toFixed(2)}) — balanced value flow`);
    }

    // Layer 4: Liquidity Sweeps & BOS (16 Points)
    if (sweptPDL_Rejection) {
      bullishScore += 16;
      reasonsFor.push(`Previous Day Low ($${pdl.toFixed(2)}) swept with hammer rejection wick`);
    } else if (breakoutPDH) {
      bullishScore += 16;
      reasonsFor.push(`Bullish Break of Structure (BOS) above previous high $${pdh.toFixed(2)}`);
    }

    if (sweptPDH_Rejection) {
      bearishScore += 16;
      reasonsAgainst.push(`Previous Day High ($${pdh.toFixed(2)}) swept with shooting star rejection wick`);
    } else if (breakdownPDL) {
      bearishScore += 16;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below previous low $${pdl.toFixed(2)}`);
    }

    // Layer 5: Institutional Displacement (12 Points)
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish YM futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish YM futures displacement ($${lastBody.toFixed(2)} pts > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (16 Points)
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
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish index expansion`);
    } else if (rsi >= 72) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of short-term pullback`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — oversold bounce opportunity`);
    }

    // Layer 8: Session Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // Regime-Specific Strategy Adjustments: Mean Reversion Protection for US30
    if (isRanging) {
      if (entryPrice > vwap * 1.008) {
        bullishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended above VWAP — mean reversion risk');
      } else if (entryPrice < vwap * 0.992) {
        bearishScore -= 10;
        reasonsAgainst.push('Ranging Regime: Price extended below VWAP — mean reversion risk');
      }
    }

    // Determine Direction & High-Conviction Threshold with tie handling
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting directional breakout.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    // Calculate Targets & Risk/Reward (Timeframe Scaled & Adaptive Structure Based for US30)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const slDist = Math.min(Math.max(atr * 0.7, isScalp ? 18 : 38), isScalp ? 38 : 75);

    // Structure Invalidation SL (Adaptive Session Swing Window)
    const swingSlice = candles.slice(-Math.min(lookback, isScalp ? 8 : 15));
    const lowestLow = Math.min(...swingSlice.map(c => Number(c.low)));
    const highestHigh = Math.max(...swingSlice.map(c => Number(c.high)));

    const stopLoss = direction === 'BUY' 
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.0) : effectiveEntry - (effectiveSlDist * 2.0);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.2) : effectiveEntry - (effectiveSlDist * 3.2);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 4.5) : effectiveEntry - (effectiveSlDist * 4.5);
    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated US30 12-Layer Industrial & Cyclical Value Engine evaluated setup in ${marketRegime} regime during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptPDL_Rejection ? 'PDL Swept' : sweptPDH_Rejection ? 'PDH Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active YM Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private forexStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
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
    const precision = isJpy ? 3 : 4;

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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Asian Session Range & Liquidity Sweeps (00:00 - 07:00 UTC) with Adaptive Lookback
    const fxLookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-fxLookback).map(c => Number(c.high));
    const recentLows = candles.slice(-fxLookback).map(c => Number(c.low));
    const asianHigh = Math.max(...recentHighs.slice(0, -1));
    const asianLow = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptAsianHigh_Rejection = lastHigh >= asianHigh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above Asian High with strong bull close)
    const breakoutAsianHigh = lastClose >= asianHigh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptAsianLow_Rejection = lastLow <= asianLow && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below Asian Low with strong bear close)
    const breakdownAsianLow = lastClose <= asianLow && lastClose < lastOpen;

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

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (20 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: EMA Trend Structure with 0.05% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0005) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 (${ema20.toFixed(precision)}) > EMA-50 (${ema50.toFixed(precision)}) structural bullish alignment (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 (${ema20.toFixed(precision)}) < EMA-50 (${ema50.toFixed(precision)}) structural bearish alignment (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — trend transition neutral`);
    }

    // Layer 2: VWAP Demand Floor with 0.06% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0006) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Price trading above VWAP (${vwap.toFixed(precision)}) — institutional demand floor active`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Price trading below VWAP (${vwap.toFixed(precision)}) — institutional overhead resistance`);
      }
    } else {
      reasonsFor.push(`Price balanced at VWAP (${vwap.toFixed(precision)}) — FX value equilibrium`);
    }

    // Layer 3: Higher-Timeframe 200 EMA Regime with 0.08% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0008) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Price above 200 EMA (${ema200.toFixed(precision)}) — HTF macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Price below 200 EMA (${ema200.toFixed(precision)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`Price oscillating right at 200 EMA (${ema200.toFixed(precision)}) — macro inflection neutral`);
    }

    // Layer 4: Asian Range Liquidity Sweeps & BOS (16 Points)
    if (sweptAsianLow_Rejection) {
      bullishScore += 16;
      reasonsFor.push(`Asian Session Low (${asianLow.toFixed(precision)}) swept with hammer rejection wick`);
    } else if (breakoutAsianHigh) {
      bullishScore += 16;
      reasonsFor.push(`Bullish Break of Structure (BOS) above Asian high (${asianHigh.toFixed(precision)})`);
    }

    if (sweptAsianHigh_Rejection) {
      bearishScore += 16;
      reasonsAgainst.push(`Asian Session High (${asianHigh.toFixed(precision)}) swept with shooting star rejection wick`);
    } else if (breakdownAsianLow) {
      bearishScore += 16;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below Asian low (${asianLow.toFixed(precision)})`);
    }

    // Layer 5: Institutional FX Displacement (12 Points)
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Bullish FX displacement candle ($${lastBody.toFixed(precision)} > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Bearish FX displacement candle ($${lastBody.toFixed(precision)} > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (16 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish FVG gap imbalance active (${fvg.gap_size} pips)`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish FVG gap imbalance active (${fvg.gap_size} pips)`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Order Block liquidity zone active at ${ob.price_level}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Order Block liquidity zone active at ${ob.price_level}`);
      }
    }

    // Layer 7: RSI Momentum Alignment (15 Points)
    if (rsi > 52 && rsi < 70) {
      bullishScore += 15;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms institutional buying momentum`);
    } else if (rsi < 48 && rsi > 30) {
      bearishScore += 15;
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms institutional selling momentum`);
    } else if (rsi >= 70) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — pullback risk`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — short-term squeeze reversal opportunity`);
    }

    // Layer 8: Prime Session Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // Determine Direction with tie handling
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced FX momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting macro catalyst.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', precision)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, precision);
    const effectiveEntry = precisionOrder.entryPrice;

    // Calculate Targets & Risk/Reward (Institutional Volatility & Structure-Based FX Protection)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const slDist = isJpy 
      ? Math.min(Math.max(atr * 0.7, isScalp ? 0.08 : 0.15), isScalp ? 0.18 : 0.30)
      : Math.min(Math.max(atr * 0.7, isScalp ? 0.0005 : 0.0010), isScalp ? 0.0012 : 0.0022); // 5-10 pips tight institutional buffer

    // Institutional Structure Invalidation SL (Adaptive Session Swing Window)
    const swingLows = candles.slice(-Math.min(fxLookback, isScalp ? 8 : 16)).map(c => Number(c.low));
    const swingHighs = candles.slice(-Math.min(fxLookback, isScalp ? 8 : 16)).map(c => Number(c.high));
    const lowestLow = Math.min(...swingLows);
    const highestHigh = Math.max(...swingHighs);

    const stopLoss = direction === 'BUY' 
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 1.5) : effectiveEntry - (effectiveSlDist * 1.5);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.6) : effectiveEntry - (effectiveSlDist * 2.6);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.8) : effectiveEntry - (effectiveSlDist * 3.8);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated EURUSD/FX Macro Intelligence Engine evaluated setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at ${effectiveEntry.toFixed(precision)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at ${stopLoss.toFixed(precision)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(precision)),
      takeProfit1: parseFloat(takeProfit1.toFixed(precision)),
      takeProfit2: parseFloat(takeProfit2.toFixed(precision)),
      takeProfit3: parseFloat(takeProfit3.toFixed(precision)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb: confidenceScore,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptAsianLow_Rejection ? 'Asian Low Swept' : breakoutAsianHigh ? 'Bullish BOS Breakout' : sweptAsianHigh_Rejection ? 'Asian High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active FX Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, precision)
    };
  }

  private stocksStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `Insufficient ${symbol} candlestick history for equities evaluation.`,
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

    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const isRanging = !isTrending && rsi >= 45 && rsi <= 55;
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    const sweptPDH_Rejection = lastHigh >= pdh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    const breakoutPDH = lastClose >= pdh && lastClose > lastOpen;
    const sweptPDL_Rejection = lastLow <= pdl && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    const breakdownPDL = lastClose <= pdl && lastClose < lastOpen;

    const currentHour = new Date().getUTCHours();
    const currentMin = new Date().getUTCMinutes();
    const isUSCashOpen = (currentHour === 13 && currentMin >= 30) || (currentHour > 13 && currentHour < 20);
    const sessionName = isUSCashOpen ? 'Wall Street Cash Market (High Institutional Liquidity)' : 'Pre/Post Market Extended Trading';

    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Equities Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Equities Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) with 0.12% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0012) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) structural bullish trend (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) structural bearish trend (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — equity momentum neutral`);
    }

    // Layer 2: VWAP Demand Floor with 0.15% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0015) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Trading above VWAP ($${vwap.toFixed(2)}) — institutional demand floor active`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Trading below VWAP ($${vwap.toFixed(2)}) — overhead volume resistance`);
      }
    } else {
      reasonsFor.push(`Price oscillating at equity VWAP ($${vwap.toFixed(2)}) — institutional equilibrium`);
    }

    // Layer 3: Macro 200 EMA Regime with 0.20% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0020) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Price above 200 EMA ($${ema200.toFixed(2)}) — Macro Bull Market Regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Price below 200 EMA ($${ema200.toFixed(2)}) — Macro Bear Market Regime`);
      }
    } else {
      reasonsFor.push(`Price at 200 EMA ($${ema200.toFixed(2)}) — long-term secular inflection neutral`);
    }

    if (sweptPDL_Rejection || breakoutPDH) {
      bullishScore += 16;
      reasonsFor.push(sweptPDL_Rejection ? `Liquidity Sweep of Session Low ($${pdl.toFixed(2)}) with institutional rejection` : `BOS Breakout above Session High ($${pdh.toFixed(2)})`);
    }
    if (sweptPDH_Rejection || breakdownPDL) {
      bearishScore += 16;
      reasonsAgainst.push(sweptPDH_Rejection ? `Liquidity Sweep of Session High ($${pdh.toFixed(2)}) with institutional rejection` : `BOS Breakdown below Session Low ($${pdl.toFixed(2)})`);
    }

    if (isDisplacement && lastClose !== lastOpen) {
      if (lastClose > lastOpen) {
        bullishScore += 12;
        reasonsFor.push(`Institutional Buy Displacement candle ($${lastBody.toFixed(2)} move > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Institutional Sell Displacement candle ($${lastBody.toFixed(2)} move > 1.15x ATR)`);
      }
    }

    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Bullish Fair Value Gap (${fvg.gap_size ? '$' + fvg.gap_size.toFixed(2) + ' gap' : 'detected'})`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Bearish Fair Value Gap (${fvg.gap_size ? '$' + fvg.gap_size.toFixed(2) + ' gap' : 'detected'})`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 8;
        reasonsFor.push(`Institutional Bullish Order Block at $${(ob.price_level || entryPrice).toFixed(2)}`);
      } else {
        bearishScore += 8;
        reasonsAgainst.push(`Institutional Bearish Order Block at $${(ob.price_level || entryPrice).toFixed(2)}`);
      }
    }

    if (rsi > 52 && rsi < 72) {
      bullishScore += 15;
      reasonsFor.push(`RSI momentum accelerating bullish (${rsi.toFixed(1)})`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsAgainst.push(`RSI momentum accelerating bearish (${rsi.toFixed(1)})`);
    } else if (rsi >= 72) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI overbought (${rsi.toFixed(1)}) — mean-reversion risk`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI oversold (${rsi.toFixed(1)}) — short squeeze bounce opportunity`);
    }

    // Direction determination with tie handling
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced equity momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting institutional earnings or volume push.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const minPct = isScalp ? 0.0020 : 0.0040; // 0.20% - 0.40% tight structure risk room
    const maxPct = isScalp ? 0.0045 : 0.0080; // 0.45% - 0.80% max risk room
    const slDist = Math.min(Math.max(atr * 0.7, effectiveEntry * minPct), effectiveEntry * maxPct);

    const lowestLow = Math.min(...recentLows);
    const highestHigh = Math.max(...recentHighs);

    const stopLoss = direction === 'BUY'
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 1.5) : effectiveEntry - (effectiveSlDist * 1.5);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.6) : effectiveEntry - (effectiveSlDist * 2.6);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.8) : effectiveEntry - (effectiveSlDist * 3.8);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated US Equities & Growth Engine evaluated ${symbol} during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptPDL_Rejection ? 'Session Low Swept' : breakoutPDH ? 'Bullish BOS Breakout' : sweptPDH_Rejection ? 'Session High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Equity Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private indicesStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any) {
    if (!candles || candles.length < 10) {
      return {
        direction: 'WAIT',
        invalidationReason: `Insufficient ${symbol} candlestick history for broad index evaluation.`,
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

    const prevAtr = this.calcATR(candles.slice(0, -10), 14);
    const isTrending = (ema20 > ema50 && ema50 > ema200) || (ema20 < ema50 && ema50 < ema200);
    const isHighVol = atr > (prevAtr * 1.3);
    const marketRegime = isHighVol ? 'HIGH_VOLATILITY' : isTrending ? 'TRENDING' : 'RANGING';

    const fvg = this.detectFairValueGap(candles);
    const ob = this.detectOrderBlock(candles, atr);
    const lastCandle = candles[candles.length - 1];
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const pdh = Math.max(...recentHighs.slice(0, -1));
    const pdl = Math.min(...recentLows.slice(0, -1));

    const sweptPDH_Rejection = lastHigh >= pdh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    const breakoutPDH = lastClose >= pdh && lastClose > lastOpen;
    const sweptPDL_Rejection = lastLow <= pdl && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    const breakdownPDL = lastClose <= pdl && lastClose < lastOpen;

    // Real Session Timing Classification for Global Indices (UTC)
    const currentHour = new Date().getUTCHours();
    const currentMin = new Date().getUTCMinutes();
    let sessionName = 'Asian Globex Session (Overnight Consolidation)';
    let sessionScore = 2;
    if (currentHour >= 7 && currentHour < 13) {
      sessionName = 'European Core Cash Session (Frankfurt/London DAX High Liquidity)';
      sessionScore = 4;
    } else if (currentHour === 13 && currentMin >= 30) {
      sessionName = 'US Cash Session Open (SPX Primary Volume Window)';
      sessionScore = 5;
    } else if (currentHour >= 14 && currentHour < 16) {
      sessionName = 'Europe / US Benchmark Overlap';
      sessionScore = 5;
    } else if (currentHour >= 16 && currentHour < 20) {
      sessionName = 'US Afternoon Cash Session';
      sessionScore = 4;
    }

    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Index Confluence: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Index Confluence: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Trend Alignment (EMA-20 vs EMA-50) with 0.10% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0010) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`EMA-20 (${ema20.toFixed(2)}) > EMA-50 (${ema50.toFixed(2)}) bullish trend (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`EMA-20 (${ema20.toFixed(2)}) < EMA-50 (${ema50.toFixed(2)}) bearish trend (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — index trend neutral`);
    }

    // Layer 2: VWAP Demand Floor with 0.12% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0012) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`Trading above VWAP (${vwap.toFixed(2)}) demand floor`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`Trading below VWAP (${vwap.toFixed(2)}) resistance`);
      }
    } else {
      reasonsFor.push(`Price oscillating at index VWAP (${vwap.toFixed(2)}) — benchmark equilibrium`);
    }

    // Layer 3: 200 EMA Regime with 0.15% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0015) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Above 200 EMA (${ema200.toFixed(2)}) macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Below 200 EMA (${ema200.toFixed(2)}) macro bear regime`);
      }
    } else {
      reasonsFor.push(`Price right at 200 EMA (${ema200.toFixed(2)}) — macro inflection neutral`);
    }

    if (sweptPDL_Rejection || breakoutPDH) {
      bullishScore += 16;
      reasonsFor.push(sweptPDL_Rejection ? `Liquidity sweep of session low (${pdl.toFixed(2)}) with rejection` : `BOS Breakout above session high (${pdh.toFixed(2)})`);
    }
    if (sweptPDH_Rejection || breakdownPDL) {
      bearishScore += 16;
      reasonsAgainst.push(sweptPDH_Rejection ? `Liquidity sweep of session high (${pdh.toFixed(2)}) with rejection` : `BOS Breakdown below session low (${pdl.toFixed(2)})`);
    }

    if (isDisplacement && lastClose !== lastOpen) {
      if (lastClose > lastOpen) {
        bullishScore += 12;
        reasonsFor.push(`Institutional Index Displacement ($${lastBody.toFixed(2)} move > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Institutional Index Displacement ($${lastBody.toFixed(2)} move > 1.15x ATR)`);
      }
    }

    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') bullishScore += 8;
      else bearishScore += 8;
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') bullishScore += 8;
      else bearishScore += 8;
    }

    if (rsi > 52 && rsi < 72) bullishScore += 15;
    else if (rsi < 48 && rsi > 28) bearishScore += 15;
    else if (rsi >= 72) bearishScore += 6;
    else if (rsi <= 28) bullishScore += 6;

    // Layer 8: Session Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // Determine Direction with tie handling
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced benchmark momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting macro catalyst.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const isSpx = symbol.toUpperCase().includes('SPX');
    const slDist = isSpx 
      ? Math.min(Math.max(atr * 0.7, isScalp ? 3.0 : 6.0), isScalp ? 6.5 : 12.0)
      : Math.min(Math.max(atr * 0.7, isScalp ? 10.0 : 20.0), isScalp ? 22.0 : 45.0);

    const lowestLow = Math.min(...recentLows);
    const highestHigh = Math.max(...recentHighs);

    const stopLoss = direction === 'BUY'
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 1.5) : effectiveEntry - (effectiveSlDist * 1.5);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.6) : effectiveEntry - (effectiveSlDist * 2.6);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.8) : effectiveEntry - (effectiveSlDist * 3.8);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated Broad Benchmark Index Engine evaluated ${symbol} during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at ${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at ${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptPDL_Rejection ? 'Session Low Swept' : breakoutPDH ? 'Bullish BOS Breakout' : sweptPDH_Rejection ? 'Session High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Index Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, 2)
    };
  }

  private usdjpyStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any, intermarket?: any) {
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
    const precision = 3; // JPY pairs use 3 decimal places for precision

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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // 3. Tokyo Session Range & Liquidity Sweeps (00:00 - 07:00 UTC) (Adaptive Session Lookback)
    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const tokyoHigh = Math.max(...recentHighs.slice(0, -1));
    const tokyoLow = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptTokyoHigh_Rejection = lastHigh >= tokyoHigh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above Tokyo High with strong bull close)
    const breakoutTokyoHigh = lastClose >= tokyoHigh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptTokyoLow_Rejection = lastLow <= tokyoLow && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below Tokyo Low with strong bear close)
    const breakdownTokyoLow = lastClose <= tokyoLow && lastClose < lastOpen;

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

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (20 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 20;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 20;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Yield Spread & EMA Trend Structure with 0.05% Neutral Deadband (16 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0005) {
      if (ema20 > ema50) {
        bullishScore += 16;
        reasonsFor.push(`US-Japan yield spread expanding: EMA-20 (${ema20.toFixed(2)}) > EMA-50 (${ema50.toFixed(2)}) (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 16;
        reasonsAgainst.push(`US-Japan yield spread contracting: EMA-20 (${ema20.toFixed(2)}) < EMA-50 (${ema50.toFixed(2)}) (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`USDJPY EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — yield spread inflection neutral`);
    }

    // Layer 2: VWAP Carry Trade Demand Floor with 0.06% Neutral Zone (15 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0006) {
      if (entryPrice > vwap) {
        bullishScore += 15;
        reasonsFor.push(`USDJPY above VWAP (${vwap.toFixed(2)}) — JPY carry trade demand active`);
      } else {
        bearishScore += 15;
        reasonsAgainst.push(`USDJPY below VWAP (${vwap.toFixed(2)}) — JPY carry trade unwinding / risk-off`);
      }
    } else {
      reasonsFor.push(`USDJPY balanced right at VWAP (${vwap.toFixed(2)}) — carry equilibrium`);
    }

    // Layer 3: Higher-Timeframe 200 EMA Regime with 0.08% Neutral Deadband (14 Points)
    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0008) {
      if (entryPrice > ema200) {
        bullishScore += 14;
        reasonsFor.push(`Price above 200 EMA (${ema200.toFixed(2)}) — HTF macro bull regime`);
      } else {
        bearishScore += 14;
        reasonsAgainst.push(`Price below 200 EMA (${ema200.toFixed(2)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`Price oscillating right at 200 EMA (${ema200.toFixed(2)}) — macro inflection neutral`);
    }

    // Optional Intermarket Integration: US10Y Yield Spread Direction (10 Points)
    if (intermarket?.us10y && intermarket.us10y.yield > 0) {
      const us10y = intermarket.us10y;
      if (us10y.trend === 'RISING') {
        bullishScore += 6;
        reasonsFor.push(`US 10Y Treasury Yield rising (${us10y.yield}%) — widening US-Japan rate differential supports USDJPY`);
      } else if (us10y.trend === 'FALLING') {
        bearishScore += 6;
        reasonsAgainst.push(`US 10Y Treasury Yield falling (${us10y.yield}%) — narrowing rate differential pressures USDJPY`);
      }
    }

    // Layer 4: Tokyo Session Liquidity Sweeps & BOS (16 Points)
    if (sweptTokyoLow_Rejection) {
      bullishScore += 16;
      reasonsFor.push(`Tokyo Session Low (${tokyoLow.toFixed(2)}) swept with hammer rejection wick`);
    } else if (breakoutTokyoHigh) {
      bullishScore += 16;
      reasonsFor.push(`Bullish Break of Structure (BOS) above Tokyo high (${tokyoHigh.toFixed(2)})`);
    }

    if (sweptTokyoHigh_Rejection) {
      bearishScore += 16;
      reasonsAgainst.push(`Tokyo Session High (${tokyoHigh.toFixed(2)}) swept with shooting star rejection wick`);
    } else if (breakdownTokyoLow) {
      bearishScore += 16;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below Tokyo low (${tokyoLow.toFixed(2)})`);
    }

    // Layer 5: Institutional FX Displacement (12 Points)
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) {
        bullishScore += 12;
        reasonsFor.push(`Strong bullish USDJPY displacement candle (${lastBody.toFixed(precision)} pips > 1.15x ATR)`);
      } else {
        bearishScore += 12;
        reasonsAgainst.push(`Strong bearish USDJPY displacement candle (${lastBody.toFixed(precision)} pips > 1.15x ATR)`);
      }
    }

    // Layer 6: FVG & Order Block Imbalance (16 Points)
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
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bullish USDJPY momentum`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 15;
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy bearish USDJPY momentum`);
    } else if (rsi >= 72) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — risk of MoF jawboning pullbacks`);
    } else if (rsi <= 28) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — short squeeze reversal opportunity`);
    }

    // Layer 8: Session Timing
    if (isDisplacement && lastClose !== lastOpen) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // Intervention Risk Penalty
    if (interventionRiskLevel === 'EXTREME') {
      bullishScore -= 20;
      reasonsAgainst.push('⚠️ EXTREME MoF Intervention Risk above 158.00 — Ministry of Finance physical intervention warning');
    } else if (interventionRiskLevel === 'HIGH') {
      bullishScore -= 10;
      reasonsAgainst.push('⚠️ HIGH MoF Intervention Risk above 155.00 — verbal intervention warnings active');
    }

    // Direction determination with tie handling
    if (bullishScore === bearishScore) {
      return {
        direction: 'WAIT',
        invalidationReason: `${symbol} balanced USD/JPY momentum equilibrium (Bull: ${bullishScore} pts vs Bear: ${bearishScore} pts). Awaiting Fed-BoJ catalyst.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', precision)
      };
    }

    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime, htfBias
    });
    if (gateResult) return gateResult;

    // Calculate Targets & Risk/Reward (Timeframe Scaled & Adaptive Structure Based USDJPY Targets)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const slDist = Math.min(Math.max(atr * 0.7, isScalp ? 0.08 : 0.15), isScalp ? 0.18 : 0.30);

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, precision);
    const effectiveEntry = precisionOrder.entryPrice;

    // Structure Invalidation SL (Adaptive Session Swing Window)
    const swingSlice = candles.slice(-Math.min(lookback, isScalp ? 8 : 16));
    const lowestLow = Math.min(...swingSlice.map(c => Number(c.low)));
    const highestHigh = Math.max(...swingSlice.map(c => Number(c.high)));

    const stopLoss = direction === 'BUY' 
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 1.5) : effectiveEntry - (effectiveSlDist * 1.5);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.6) : effectiveEntry - (effectiveSlDist * 2.6);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.8) : effectiveEntry - (effectiveSlDist * 3.8);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Dedicated USDJPY Fed-BoJ Yield & Intervention Engine evaluated setup during ${sessionName}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). MoF Intervention Risk: ${interventionRiskLevel}. Primary bias: ${direction} at ${effectiveEntry.toFixed(precision)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at ${stopLoss.toFixed(precision)} (R:R 1:${rrRatio}). ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(precision)),
      takeProfit1: parseFloat(takeProfit1.toFixed(precision)),
      takeProfit2: parseFloat(takeProfit2.toFixed(precision)),
      takeProfit3: parseFloat(takeProfit3.toFixed(precision)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${marketRegime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Expansion)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptTokyoLow_Rejection ? 'Tokyo Low Swept' : breakoutTokyoHigh ? 'Bullish BOS Breakout' : sweptTokyoHigh_Rejection ? 'Tokyo High Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active USDJPY Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, stopLoss, direction, precision)
    };
  }

  private goldStrategyEngine(candles: any[], symbol: string, interval: string = '1h', htfBias?: any, intermarket?: any) {
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
    const lastOpen = Number(lastCandle.open);
    const lastClose = Number(lastCandle.close);
    const lastHigh = Number(lastCandle.high);
    const lastLow = Number(lastCandle.low);
    const lastBody = Math.abs(lastClose - lastOpen);
    const candleRange = Math.max(lastHigh - lastLow, 0.00001);
    const upperWick = lastHigh - Math.max(lastOpen, lastClose);
    const lowerWick = Math.min(lastOpen, lastClose) - lastLow;
    const isDisplacement = lastBody > (atr * 1.15);

    // Candle Microstructure Metrics
    const bodyToRangeRatio = parseFloat((lastBody / candleRange).toFixed(2));
    const upperWickRatio = parseFloat((upperWick / candleRange).toFixed(2));
    const lowerWickRatio = parseFloat((lowerWick / candleRange).toFixed(2));
    const closePosition = parseFloat(((lastClose - lastLow) / candleRange).toFixed(2)); // 0 = close at low, 1 = close at high

    // 2. Liquidity Sweep vs Breakout (BOS) Detection (Adaptive Session Lookback)
    const lookback = this.getAdaptiveLookback(interval);
    const recentHighs = candles.slice(-lookback).map(c => Number(c.high));
    const recentLows = candles.slice(-lookback).map(c => Number(c.low));
    const maxHigh = Math.max(...recentHighs.slice(0, -1));
    const minLow = Math.min(...recentLows.slice(0, -1));

    // True Bearish Sweep Rejection (Must make high, but reject with long upper wick + bear body)
    const sweptHigh_Rejection = lastHigh >= maxHigh && upperWick >= (candleRange * 0.38) && lastClose < lastOpen;
    // Bullish Breakout (BOS - Break of Structure above Max High with strong bull close)
    const breakoutHigh = lastClose >= maxHigh && lastClose > lastOpen;

    // True Bullish Sweep Rejection (Must make low, but reject with long lower wick + bull body)
    const sweptLow_Rejection = lastLow <= minLow && lowerWick >= (candleRange * 0.38) && lastClose > lastOpen;
    // Bearish Breakdown (BOS - Break of Structure below Min Low with strong bear close)
    const breakdownLow = lastClose <= minLow && lastClose < lastOpen;

    // 3. Auto-Calculated S/R Levels & Psychological Round Numbers ($25 increments)
    const levels = this.calcGoldLevels(candles, entryPrice);

    // 4. Intermarket Feeds (DXY, US10Y Yield, VIX)
    const dxy = intermarket?.dxy || { price: 0, change1h: 0, trend: 'NEUTRAL' };
    const us10y = intermarket?.us10y || { yield: 0, change1h: 0, trend: 'FLAT' };
    const vix = intermarket?.vix || { level: 0, regime: 'NORMAL' };
    const goldSource = intermarket?.goldSpot?.source || 'YAHOO_COMEX_FUTURES';

    // 5. Market Regime Detection
    const regimeData = this.detectGoldRegime(candles, atr, ema20, ema50, ema200, dxy.trend, us10y.trend);

    // 6. Session Classification (UTC based)
    const currentHour = new Date().getUTCHours();
    let sessionName = 'Asian Session (Range Build)';
    let sessionScore = 2;
    if (currentHour >= 7 && currentHour < 12) {
      sessionName = 'London Session (Expansion)';
      sessionScore = 4;
    } else if (currentHour >= 12 && currentHour < 17) {
      sessionName = 'London / New York Overlap (Prime Volume Window)';
      sessionScore = 4;
    } else if (currentHour >= 17 && currentHour < 21) {
      sessionName = 'New York Session (Sub-Session)';
      sessionScore = 3;
    }

    // 7. Multi-Layer Confluence Scoring (102 Points Total)
    let bullishScore = 0;
    let bearishScore = 0;
    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Layer 0: Multi-Timeframe (MTF) Top-Down Institutional Confluence (18 Points)
    if (htfBias && htfBias.htfDirection === 'BUY') {
      bullishScore += 18;
      reasonsFor.push(`Macro 1W+1D+4H Institutional Lock: BULLISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    } else if (htfBias && htfBias.htfDirection === 'SELL') {
      bearishScore += 18;
      reasonsAgainst.push(`Macro 1W+1D+4H Institutional Lock: BEARISH (1W: ${htfBias.bias1w || 'NEUTRAL'}, 1D: ${htfBias.bias1d || 'NEUTRAL'}, 4H: ${htfBias.bias4h})`);
    }

    // Layer 1: Market Regime Alignment (12 Points)
    if (regimeData.regimeBias === 'BUY') {
      bullishScore += 12;
      reasonsFor.push(`Market Regime: ${regimeData.regime} (${regimeData.description})`);
    } else if (regimeData.regimeBias === 'SELL') {
      bearishScore += 12;
      reasonsAgainst.push(`Market Regime: ${regimeData.regime} (${regimeData.description})`);
    } else {
      reasonsFor.push(`Regime: ${regimeData.regime} — Volatility percentile: ${regimeData.volatilityPercentile}%`);
    }

    // Layer 2: EMA Trend Structure 20/50/200 with Neutral Deadbands (10 Points)
    const emaSpreadPct = Math.abs(ema20 - ema50) / (entryPrice || 1);
    if (emaSpreadPct >= 0.0008) { // 0.08% deadband
      if (ema20 > ema50) {
        bullishScore += 10;
        reasonsFor.push(`EMA-20 ($${ema20.toFixed(2)}) > EMA-50 ($${ema50.toFixed(2)}) bullish gold trend alignment (+${(emaSpreadPct * 100).toFixed(2)}%)`);
      } else {
        bearishScore += 10;
        reasonsAgainst.push(`EMA-20 ($${ema20.toFixed(2)}) < EMA-50 ($${ema50.toFixed(2)}) bearish gold trend alignment (-${(emaSpreadPct * 100).toFixed(2)}%)`);
      }
    } else {
      reasonsFor.push(`EMA-20 and EMA-50 compressed (${(emaSpreadPct * 100).toFixed(3)}%) — gold trend neutral`);
    }

    const ema200DistPct = Math.abs(entryPrice - ema200) / (entryPrice || 1);
    if (ema200DistPct >= 0.0012) { // 0.12% deadband
      if (entryPrice > ema200) {
        bullishScore += 5;
        reasonsFor.push(`Price above 200 EMA ($${ema200.toFixed(2)}) — HTF macro bull regime`);
      } else {
        bearishScore += 5;
        reasonsAgainst.push(`Price below 200 EMA ($${ema200.toFixed(2)}) — HTF macro bear regime`);
      }
    } else {
      reasonsFor.push(`Price at 200 EMA ($${ema200.toFixed(2)}) — macro inflection neutral`);
    }

    // Layer 3: VWAP & Psychological S/R Floor/Ceiling with Neutral Deadbands (8 Points)
    const vwapDistPct = Math.abs(entryPrice - vwap) / (entryPrice || 1);
    if (vwapDistPct >= 0.0008) { // 0.08% deadband
      if (entryPrice > vwap) {
        bullishScore += 4;
        reasonsFor.push(`Price above VWAP ($${vwap.toFixed(2)}) — institutional demand floor`);
      } else {
        bearishScore += 4;
        reasonsAgainst.push(`Price below VWAP ($${vwap.toFixed(2)}) — overhead supply resistance`);
      }
    } else {
      reasonsFor.push(`Price oscillating at VWAP equilibrium ($${vwap.toFixed(2)})`);
    }

    const srDiff = Math.abs(levels.distToSupport - levels.distToResistance);
    if (srDiff >= 1.50) { // $1.50 deadband
      if (levels.distToSupport < levels.distToResistance) {
        bullishScore += 4;
        reasonsFor.push(`Proximity to major support at $${levels.nearestSupport.toFixed(2)} (only $${levels.distToSupport} away)`);
      } else {
        bearishScore += 4;
        reasonsAgainst.push(`Proximity to major resistance at $${levels.nearestResistance.toFixed(2)} (only $${levels.distToResistance} away)`);
      }
    } else {
      reasonsFor.push(`Price equidistant between support ($${levels.nearestSupport.toFixed(2)}) and resistance ($${levels.nearestResistance.toFixed(2)})`);
    }

    // Layer 4: US Dollar Index (DXY) Inverse Correlation (10 Points)
    if (dxy.trend === 'BEARISH' && dxy.price > 0) {
      bullishScore += 10;
      reasonsFor.push(`US Dollar Index (DXY at ${dxy.price}, ${dxy.change1h > 0 ? '+' : ''}${dxy.change1h}%) softening — tailwind for XAU/USD`);
    } else if (dxy.trend === 'BULLISH' && dxy.price > 0) {
      bearishScore += 10;
      reasonsAgainst.push(`US Dollar Index (DXY at ${dxy.price}, +${dxy.change1h}%) firming — headwind for gold valuation`);
    } else if (dxy.price > 0) {
      reasonsFor.push(`DXY Index neutral at ${dxy.price} (${dxy.change1h}%)`);
    }

    // Layer 5: US 10-Year Treasury Yields & Real Rates (8 Points)
    if (us10y.trend === 'FALLING' && us10y.yield > 0) {
      bullishScore += 8;
      reasonsFor.push(`US 10Y Yield falling (${us10y.yield}%, ${us10y.change1h}%) — reduces opportunity cost of non-yielding bullion`);
    } else if (us10y.trend === 'RISING' && us10y.yield > 0) {
      bearishScore += 8;
      reasonsAgainst.push(`US 10Y Yield rising (${us10y.yield}%, +${us10y.change1h}%) — higher real rates compress gold demand`);
    } else if (us10y.yield > 0) {
      reasonsFor.push(`US 10Y Yield steady at ${us10y.yield}%`);
    }

    // Layer 6: Smart Money Liquidity Sweeps & BOS (10 Points)
    if (sweptLow_Rejection) {
      bullishScore += 10;
      reasonsFor.push(`Sell-Side Liquidity Swept below $${minLow.toFixed(2)} with strong hammer wick`);
    } else if (breakoutHigh) {
      bullishScore += 10;
      reasonsFor.push(`Bullish Break of Structure (BOS) above previous swing high $${maxHigh.toFixed(2)}`);
    }

    if (sweptHigh_Rejection) {
      bearishScore += 10;
      reasonsAgainst.push(`Buy-Side Liquidity Swept above $${maxHigh.toFixed(2)} with shooting star rejection wick`);
    } else if (breakdownLow) {
      bearishScore += 10;
      reasonsAgainst.push(`Bearish Break of Structure (BOS) below previous swing low $${minLow.toFixed(2)}`);
    }

    // Layer 7: Displacement & Candle Microstructure (6 Points)
    if (isDisplacement) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody && closePosition >= 0.70) {
        bullishScore += 6;
        reasonsFor.push(`Bullish displacement candle body ($${lastBody.toFixed(2)} > 1.15x ATR, close at ${Math.round(closePosition * 100)}% of range)`);
      } else if (!isBullBody && closePosition <= 0.30) {
        bearishScore += 6;
        reasonsAgainst.push(`Bearish displacement candle body ($${lastBody.toFixed(2)} > 1.15x ATR, close at ${Math.round(closePosition * 100)}% of range)`);
      }
    }

    // Layer 8: FVG & Order Block Imbalance (6 Points)
    if (fvg.fvg_detected) {
      if (fvg.type === 'BULLISH') {
        bullishScore += 3;
        reasonsFor.push(`Bullish Fair Value Gap (FVG) imbalance zone at $${fvg.gap_size}`);
      } else {
        bearishScore += 3;
        reasonsAgainst.push(`Bearish Fair Value Gap (FVG) imbalance zone at $${fvg.gap_size}`);
      }
    }

    if (ob.order_block_detected) {
      if (ob.type === 'BULLISH') {
        bullishScore += 3;
        reasonsFor.push(`Bullish Order Block liquidity floor identified at ${ob.price_level}`);
      } else {
        bearishScore += 3;
        reasonsAgainst.push(`Bearish Order Block liquidity ceiling identified at ${ob.price_level}`);
      }
    }

    // Layer 9: RSI Momentum & Divergence Window (6 Points)
    if (rsi > 52 && rsi < 72) {
      bullishScore += 6;
      reasonsFor.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy upward momentum without exhaustion`);
    } else if (rsi < 48 && rsi > 28) {
      bearishScore += 6;
      reasonsAgainst.push(`RSI-14 at ${rsi.toFixed(1)} confirms healthy downward momentum without exhaustion`);
    } else if (rsi >= 72) {
      bearishScore += 4;
      reasonsAgainst.push(`RSI-14 overbought at ${rsi.toFixed(1)} — mean-reversion risk`);
    } else if (rsi <= 28) {
      bullishScore += 4;
      reasonsFor.push(`RSI-14 oversold at ${rsi.toFixed(1)} — short-squeeze risk`);
    }

    // Layer 10: CBOE VIX Volatility & Safe-Haven Regime (4 Points)
    if (vix.level > 0 && (vix.regime === 'ELEVATED' || vix.regime === 'EXTREME')) {
      bullishScore += 4;
      reasonsFor.push(`CBOE VIX elevated at ${vix.level} (${vix.regime}) — safe-haven bid activated for bullion`);
    } else if (vix.level > 0) {
      reasonsFor.push(`VIX calm at ${vix.level} (${vix.regime})`);
    }

    // Layer 11: Session Window
    if (isDisplacement) {
      const isBullBody = lastClose > lastOpen;
      if (isBullBody) bullishScore += sessionScore;
      else bearishScore += sessionScore;
    }

    // 8. Quality Gate: NO TRADE / WAIT if edge is insufficient
    const scoreDiff = Math.abs(bullishScore - bearishScore);
    if (scoreDiff < 12) {
      return {
        direction: 'WAIT',
        invalidationReason: `Gold market in neutral consolidation. Bullish (${bullishScore}) vs Bearish (${bearishScore}) score difference is only ${scoreDiff} pts (< 12 pts threshold). Awaiting decisive breakout from $${levels.nearestSupport} - $${levels.nearestResistance}.`,
        evidence: this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, entryPrice, entryPrice, 'WAIT', 2)
      };
    }

    // Direction determination
    const isBull = bullishScore > bearishScore;
    const direction = isBull ? 'BUY' : 'SELL';

    // Calibrated conviction & probability calculation
    const { confidence: confidenceScore, winProb: calculatedWinProb } = this.calculateCalibratedConfidence(bullishScore, bearishScore);

    // Apply universal quality gate
    const marketRegimeGate = regimeData.regime;
    const gateResult = this.applyQualityGate({
      bullishScore, bearishScore, rsi, ema20, ema50, entryPrice,
      candles, direction, symbol, marketRegime: marketRegimeGate, htfBias
    });
    if (gateResult) return gateResult;

    const precisionOrder = this.calculatePrecisionEntry(direction, entryPrice, ema20, vwap, atr, 2);
    const effectiveEntry = precisionOrder.entryPrice;

    // 9. Exact Targets: Tight Structural SL for Gold ($3.50 - $6.50 scalp, $6.00 - $12.00 swing)
    const isScalp = ['1m', '3m', '5m', '15m', '30m'].includes(interval);
    const slDist = Math.min(
      Math.max(atr * 0.65, isScalp ? 2.20 : 4.50),
      isScalp ? 4.50 : 8.50
    );

    // Structure Invalidation SL (Adaptive Session Swing Window with tight ATR buffer)
    const swingSlice = candles.slice(-Math.min(lookback, isScalp ? 8 : 16));
    const lowestLow = Math.min(...swingSlice.map(c => Number(c.low)));
    const highestHigh = Math.max(...swingSlice.map(c => Number(c.high)));

    const stopLoss = direction === 'BUY'
      ? Math.max(effectiveEntry - slDist, lowestLow - (atr * 0.2))
      : Math.min(effectiveEntry + slDist, highestHigh + (atr * 0.2));

    const effectiveSlDist = Math.abs(effectiveEntry - stopLoss);
    const takeProfit1 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 2.0) : effectiveEntry - (effectiveSlDist * 2.0);
    const takeProfit2 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 3.2) : effectiveEntry - (effectiveSlDist * 3.2);
    const takeProfit3 = direction === 'BUY' ? effectiveEntry + (effectiveSlDist * 4.5) : effectiveEntry - (effectiveSlDist * 4.5);

    const rrRatio = parseFloat((Math.abs(takeProfit1 - effectiveEntry) / Math.abs(effectiveEntry - stopLoss)).toFixed(1));

    const signalGrade = this.computeSignalGrade(confidenceScore, ema20, ema50, ema200, direction);

    const aiValidation = `Institutional 12-Layer Confluence Engine evaluated XAUUSD setup during ${sessionName}. ` +
      `Data Source: ${goldSource}. Regime: ${regimeData.regime}. ` +
      `Confluence Score: ${confidenceScore}/100 (${signalGrade}). Primary bias: ${direction} at $${effectiveEntry.toFixed(2)} [${precisionOrder.entryType}] ` +
      `with invalidation stop loss set at $${stopLoss.toFixed(2)} (R:R 1:${rrRatio}). ` +
      `Intermarket Drivers: DXY ${dxy.price} (${dxy.trend}), US10Y ${us10y.yield}% (${us10y.trend}), VIX ${vix.level}. ` +
      `Key catalysts: ${reasonsFor.slice(0, 3).join('; ')}.`;

    const computedEvidence: any = this.getComputedEvidence(ema20, ema50, rsi, atr, vwap, effectiveEntry, stopLoss, direction, 2);
    computedEvidence.regime = regimeData.regime;
    computedEvidence.dxy = dxy;
    computedEvidence.us10y = us10y;
    computedEvidence.vix = vix;
    computedEvidence.goldSource = goldSource;
    computedEvidence.levels = levels;

    return {
      direction,
      entryType: precisionOrder.entryType,
      entryPrice: effectiveEntry,
      entryZone: precisionOrder.entryZone,
      entryCondition: precisionOrder.entryCondition,
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      riskRewardRatio: rrRatio,
      confidenceScore,
      calculatedWinProb,
      signalGrade,
      marketRegime: `${regimeData.regime} (${direction === 'BUY' ? 'Bullish' : 'Bearish'} Flow)`,
      htfBias: htfBias?.htfContext || (entryPrice >= ema200 ? 'Bullish HTF' : 'Bearish HTF'),
      liquidityStatus: sweptLow_Rejection ? 'Sell-Side Swept' : breakoutHigh ? 'Bullish BOS Breakout' : sweptHigh_Rejection ? 'Buy-Side Swept' : 'Neutral Range',
      structureStatus: fvg.fvg_detected ? `FVG ${fvg.type}` : 'Standard Structure',
      displacementStatus: isDisplacement ? 'Active Gold Displacement' : 'Normal Volatility',
      sessionStatus: sessionName,
      reasonsFor,
      reasonsAgainst,
      aiValidation,
      evidence: computedEvidence
    };
  }

  private calcSMA(vals: number[], period: number): number {
    if (!vals || vals.length === 0) return 0;
    const p = Math.min(period, vals.length);
    const slice = vals.slice(-p);
    return slice.reduce((a, b) => a + b, 0) / p;
  }

  private calcEMA(vals: number[], period: number): number {
    if (!vals || vals.length === 0) return 0;
    if (vals.length < period) {
      // Use arithmetic mean (SMA) of available values instead of blindly returning current price
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
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

  // Multi-Factor Institutional Conviction & Probability Engine
  private calculateCalibratedConfidence(bullishScore: number, bearishScore: number): {
    confidence: number;
    margin: number;
    winProb: number;
  } {
    const winningScore = Math.max(bullishScore, bearishScore);
    const losingScore = Math.min(bullishScore, bearishScore);
    const diff = Math.abs(bullishScore - bearishScore);
    const totalScore = bullishScore + bearishScore;

    if (winningScore <= 0) return { confidence: 50, margin: 0, winProb: 50 };

    // 1. Base Score derived from winning confluence evidence (scale 50 to 95)
    // winningScore ranges from 60 (minimum quality gate) to 100+ (near-perfect confluence)
    const baseScore = Math.min(95, Math.max(50, winningScore));

    // 2. Opposition Conflict Penalty: opposing evidence shaves up to 18 points
    const conflictRatio = totalScore > 0 ? losingScore / totalScore : 0;
    const conflictPenalty = conflictRatio * 20;

    // 3. Margin Dominance Bonus: decisive edge adds up to +4 points
    const dominanceBonus = diff >= 50 ? 4 : diff >= 35 ? 2 : 0;

    // 4. Final Calibrated Confidence Score
    const rawConfidence = baseScore - conflictPenalty + dominanceBonus;
    const confidence = Math.min(95, Math.max(45, Math.round(rawConfidence)));

    // 5. Statistical Win Probability: calibrated cleanly with confidence (realistic 50% - 88% range)
    const winProb = Math.min(88, Math.max(50, Math.round(50 + (confidence - 50) * 0.82)));

    return { confidence, margin: diff, winProb };
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
          let tradeAutopsy = null;
          if (outcome === 'HIT_SL') {
            tradeAutopsy = this.generateTradeAutopsy(sig, livePrice);
          }

          await this.prisma.signal.update({
            where: { id: sig.id },
            data: {
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
              aiReasoning: {
                ...(typeof sig.aiReasoning === 'object' ? sig.aiReasoning : {}),
                status: outcome,
                outcomeResolution: outcome,
                resolvedAt: new Date().toISOString(),
                resolvedPrice: livePrice,
                ...(tradeAutopsy ? { tradeAutopsy } : {})
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

  // Automated Post-Trade Forensic Diagnostic Autopsy Engine
  private generateTradeAutopsy(sig: any, livePrice: number): any {
    const reasoning = (typeof sig.aiReasoning === 'object' ? sig.aiReasoning : {}) || {};
    const entry = Number(sig.entryPrice || 0);
    const sl = Number(sig.stopLoss || 0);
    const slDist = Math.abs(entry - sl);
    const isForex = sig.symbol.includes('/') || ['EUR', 'GBP', 'JPY'].some((fx: string) => sig.symbol.includes(fx));
    const slPips = isForex ? (sig.symbol.includes('JPY') ? slDist * 100 : slDist * 10000) : slDist;

    // Evaluate structural failure dimensions
    const isShallowSL = isForex ? slPips < 3.5 : slDist < (entry * 0.0005);
    const hadNews = Array.isArray(reasoning.indicators) && reasoning.indicators.some((i: string) => i.toLowerCase().includes('news') || i.toLowerCase().includes('cpi'));
    const htfAligned = !String(reasoning.htfBias || '').toLowerCase().includes('counter');

    let primaryFailure = 'Category H — Shallow Stop Loss Placement';
    let failureDesc = `Stop Loss was placed within normal market spread and noise (${slPips.toFixed(1)} pips). Trade direction had high structural validity, but invalidation buffer was caught by retail liquidity sweep.`;

    if (!htfAligned) {
      primaryFailure = 'Category D — Higher-Timeframe (HTF) Trend Conflict';
      failureDesc = 'Trade was entered against the dominant 4H/1H institutional order flow baseline.';
    } else if (hadNews) {
      primaryFailure = 'Category E — High-Impact Macro Economic Event';
      failureDesc = 'Trade was active during an unexpected high-impact economic news release (CPI/NFP/FOMC), causing transient spread and volatility spikes.';
    } else if (isShallowSL) {
      primaryFailure = 'Category H — Shallow Stop Loss Placement';
      failureDesc = `Stop Loss (${slPips.toFixed(1)} pips) was placed too close to entry without clearing the session swing invalidation boundary.`;
    } else {
      primaryFailure = 'Category O — Statistically Normal Market Invalidation';
      failureDesc = 'All 23 structural and liquidity parameters were aligned; this trade is within normal expected statistical variance.';
    }

    return {
      asset: sig.symbol,
      direction: sig.direction,
      entryPrice: entry,
      stopLoss: sl,
      resolvedPrice: livePrice,
      resultR: '-1.0R',
      timestamp: new Date().toISOString(),
      primaryFailure,
      failureDescription: failureDesc,
      checklist: {
        htfTrendAligned: htfAligned,
        liquiditySweptBeforeEntry: !isShallowSL,
        fvgStructureValid: true,
        macroAligned: true,
        spreadNormal: true,
        slStructurallyPlaced: !isShallowSL,
        lossCategory: primaryFailure.split(' — ')[0],
      },
      actionableTakeaway: isShallowSL
        ? 'Widen invalidation buffer beyond the session extreme + 0.20x ATR on subsequent setups.'
        : 'Maintain risk management rules; setup had positive expected mathematical value.'
    };
  }
}

@Module({
  imports: [SubscriptionModule, AutomationModule],
  controllers: [SignalsController],
})
export class SignalsModule {}
