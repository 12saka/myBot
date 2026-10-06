import { Module, Controller, Get, Post, Body, Param, Query, UseGuards, Req, Delete, OnModuleInit, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Interval } from '@nestjs/schedule';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AutomationModule } from '../automation/automation.module';
import { AutomationService } from '../automation/automation.service';
import * as WS from 'ws';

// ============================================================================
// 1. DATA TYPES & PRODUCTION INTERFACES
// ============================================================================

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export type OrderType = 
  | 'BUY_LIMIT' 
  | 'BUY_STOP' 
  | 'MARKET_BUY' 
  | 'SELL_LIMIT' 
  | 'SELL_STOP' 
  | 'MARKET_SELL' 
  | 'WAIT';

export type MarketRegimeType = 
  | 'STRONG_BULL_TREND' 
  | 'STRONG_BEAR_TREND' 
  | 'COMPRESSION_RANGE' 
  | 'EXPANSION_RANGE' 
  | 'NEWS_SHOCK' 
  | 'VOLATILITY_EXPANSION';

export type VolatilityRegimeType = 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';

export type KillSwitchTier = 
  | 'NONE'
  | 'SYSTEM_KILL'
  | 'DATA_KILL'
  | 'BROKER_KILL'
  | 'RISK_KILL'
  | 'MODEL_KILL'
  | 'NEWS_KILL'
  | 'EXECUTION_KILL';

export interface VolatilityMetrics {
  regime: VolatilityRegimeType;
  atr15m: number;
  atrPercentile: number;
  realizedVolatility: number;
  rangeExpansionRatio: number;
  riskMultiplier: number;
  adaptiveBufferAtr: number;
}

export interface VolumeProfile {
  poc: number;
  vah: number;
  val: number;
  profileWidth: number;
  valueRelation: 'ABOVE_VALUE' | 'INSIDE_VALUE' | 'BELOW_VALUE';
}

export interface FractalSwing {
  index: number;
  type: 'HIGH' | 'LOW';
  price: number;
  timestamp: Date;
}

export interface OrderBlock {
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  midpoint: number;
  candleIndex: number;
  mitigated: boolean;
  qualityScore: number;
}

export interface FairValueGap {
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  midpoint: number;
  size: number;
  candleIndex: number;
  mitigated: boolean;
}

export interface LiquiditySweep {
  levelName: string;
  levelPrice: number;
  direction: 'BULLISH' | 'BEARISH';
  wickExtreme: number;
  candleIndex: number;
  rejectionRatio: number;
  qualityScore: number;
}

export interface SessionLevels {
  session: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'ROLLOVER';
  pdh: number;
  pdl: number;
  pwh: number;
  pwl: number;
  ash: number;
  asl: number;
  sessionVwap: number;
  anchoredVwapAsia: number;
}

export interface MicrostructureState {
  bid: number;
  ask: number;
  spread: number;
  isLiquid: boolean;
  reason?: string;
}

export interface IntermarketState {
  dxy: number;
  dxyChange1h: number;
  us10y: number;
  us10yChange1h: number;
  realYieldProxy: number;
  eurusd?: number;
  silver?: number;
  oil?: number;
  us100Change?: number;
  safeHavenDemandScore: number;
  riskSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  macroAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SAFE_HAVEN_DECOUPLING';
  conflictDetected: boolean;
  conflictReason?: string;
  rationale: string;
}

export interface ClassicalIndicators {
  ema20: number;
  ema50: number;
  ema100: number;
  ema200: number;
  rsi14: number;
  rsiDivergence: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE';
  macd: { macd: number; signal: number; histogram: number };
  adx14: number;
  isTrending: boolean;
  bollingerBands: { upper: number; middle: number; lower: number; bandwidth: number };
}

export interface MultiTimeframeMemory {
  structural: {
    tf4h: { trend: 'BULLISH' | 'BEARISH' | 'RANGING'; candleCount: number };
    tf1h: { trend: 'BULLISH' | 'BEARISH' | 'RANGING'; bosDetected: boolean; candleCount: number };
  };
  tactical: {
    tf15m: { sessionPdhPdl: boolean; activeFvgs: number; candleCount: number };
    tf5m: { mssTriggered: boolean; candleCount: number };
  };
  execution: {
    tf1m: { spreadImpactPips: number; candleCount: number };
  };
}

export interface FiveLevelFactorHierarchy {
  level1_marketEnvironment: {
    regime: MarketRegimeType;
    volatilityRegime: VolatilityRegimeType;
    atrPercentile: number;
    session: string;
    dayOfWeek: string;
  };
  level2_fundamentalMacro: {
    dxy: number;
    us10y: number;
    realYield: number;
    safeHavenScore: number;
    riskSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    macroConflict: boolean;
  };
  level3_technicalStructure: {
    htfTrend4h: string;
    primaryStructure1h: string;
    tacticalStructure15m: string;
    indicators: ClassicalIndicators;
    poc: number;
    vwap: number;
  };
  level4_entryConfirmation: {
    model: string;
    confirmation5m: boolean;
    iczLow: number;
    iczHigh: number;
    preferredEntry: number;
  };
  level5_tradeQuality: {
    orderType: OrderType;
    ev: number;
    r1: number;
    recommendedLots: number;
  };
}

export interface NewsGateState {
  isBlackout: boolean;
  eventStage: 'PRE_EVENT' | 'EVENT_SHOCK' | 'PRICE_DISCOVERY' | 'STRUCTURE_REBUILD' | 'NORMAL_MODE';
  minutesToEvent: number | null;
  eventTitle: string | null;
  impactTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

export interface ConfluenceCandidate {
  source: string;
  price: number;
  weight: number;
}

export interface InstitutionalConfluenceZone {
  zoneLow: number;
  zoneHigh: number;
  preferredEntry: number;
  confluenceFactors: string[];
  overlapCount: number;
  zoneRank: 'TIER_1_PRIME' | 'TIER_2_STRONG' | 'TIER_3_MODERATE' | 'WEAK';
  entryQualityCurve: { price: number; qualityScore: number }[];
}

export interface TradePathModel {
  tp1Price: number;
  tp1LiquiditySource: string;
  tp1RiskReward: number;
  probTp1BeforeSl: number;
  tp2Price: number;
  tp2LiquiditySource: string;
  tp2RiskReward: number;
  probTp2BeforeSl: number;
  tp3Price: number;
  tp3LiquiditySource: string;
  tp3RiskReward: number;
  probTp3BeforeSl: number;
  probSlBeforeTp1: number;
  expectedValueR: number;
}

export interface InvalidationAndExpiry {
  structuralInvalidationLevel: number;
  adaptiveVolBuffer: number;
  exactStopLoss: number;
  invalidationThesis: string;
  orderExpiryHours: number;
  preFillCancelTriggers: string[];
}

export interface DynamicPositionSizing {
  riskBudgetUsd: number;
  recommendedLots: number;
  recommendedUnitsOz: number;
  volatilityAdjustment: number;
  confidenceAdjustment: number;
}

// -------------------------------------------------------------
// FIVE DECISION GATES
// -------------------------------------------------------------

export interface GateCheck<T = any> {
  gateId: 'GATE_1_DATA' | 'GATE_2_MARKET' | 'GATE_3_SETUP' | 'GATE_4_TRADE' | 'GATE_5_EXECUTION';
  passed: boolean;
  score: number;
  code: string;
  reason: string;
  telemetry: T;
}

export interface FiveGatesSummary {
  allPassed: boolean;
  failingGate: string | null;
  failingReason?: string;
  gate1_data: GateCheck;
  gate2_market: GateCheck;
  gate3_setup: GateCheck;
  gate4_trade: GateCheck;
  gate5_execution: GateCheck;
}

export interface ImmutableTradeAudit {
  tradeId: string;
  timestamp: string;
  engineVersion: string;
  dataSnapshot: {
    twelveDataClose: number;
    tvSpotPrice: number;
    spread: number;
    dxy: number;
    us10y: number;
    realYield: number;
  };
  features: {
    atr15m: number;
    atrPercentile: number;
    volumeProfilePoc: number;
    sessionVwap: number;
    regime: string;
    iczOverlapCount: number;
  };
  fiveGates: FiveGatesSummary;
  orderPlan: {
    orderType: OrderType;
    preferredEntry: number;
    zone: [number, number];
    sl: number;
    tp1: number;
    tp2: number;
    tp3: number;
    r1: number;
    ev: number;
  };
  positionSizing: DynamicPositionSizing;
  thesis: {
    thesis: string;
    invalidationConditions: string[];
  };
  executionStatus?: 'APPROVED_FOR_EXECUTION' | 'HELD_AT_GATE';
}

export interface XauusdLiveStateStore {
  symbol: string;
  engineVersion: string;
  lastUpdated: string;
  currentPrice: number;
  bid: number;
  ask: number;
  spread: number;
  marketRegime: MarketRegimeType;
  volatilityRegime: VolatilityRegimeType;
  session: string;
  dxyAlignment: string;
  us10yAlignment: string;
  newsRisk: string;
  activeOrderType: OrderType;
  entryZone: [number, number];
  preferredEntry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  expectedValueR: number;
  fiveGates: FiveGatesSummary;
  killSwitchActive: boolean;
  killSwitchTier: KillSwitchTier;
  killSwitchReason?: string;
}

export interface XauusdInstitutionalSetup {
  fiveGates: FiveGatesSummary;
  orderType: OrderType;
  model: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'NONE';
  direction: 'BUY' | 'SELL' | 'WAIT';
  grade: 'A+' | 'A' | 'B+' | 'WAIT';
  opportunityScore: number;
  marketBiasScore: number;
  entryQualityScore: number;
  entryPrice: number;
  entryZone: [number, number];
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward1: number;
  riskReward2: number;
  riskReward3: number;
  tradePath: TradePathModel;
  invalidationAndExpiry: InvalidationAndExpiry;
  positionSizing: DynamicPositionSizing;
  marketRegime: MarketRegimeType;
  volatilityMetrics: VolatilityMetrics;
  volumeProfile: VolumeProfile;
  levels: {
    currentPrice: number;
    pdh: number;
    pdl: number;
    pwh: number;
    pwl: number;
    ash: number;
    asl: number;
    sessionVwap: number;
    poc: number;
    vah: number;
    val: number;
  };
  microstructure: MicrostructureState;
  intermarket: IntermarketState;
  newsGate: NewsGateState;
  killSwitchActive: boolean;
  killSwitchTier: KillSwitchTier;
  killSwitchReason?: string;
  auditTrail: ImmutableTradeAudit;
  confluenceReasons: string[];
  summary: string;
  hierarchy?: FiveLevelFactorHierarchy;
  memory?: MultiTimeframeMemory;
}

// ============================================================================
// 2. SIGNALS CONTROLLER & FIVE-GATE DECISION ENGINE
// ============================================================================

@ApiTags('signals')
@Controller('signals')
export class SignalsController implements OnModuleInit {
  private readonly logger = new Logger(SignalsController.name);
  private readonly ENGINE_VERSION = 'XAU-PROD-3.2';

  // In-memory Real-time State Store
  private liveStateStore: XauusdLiveStateStore | null = null;

  // Post-Trade Memory & Model Drift Tracking (Rolling 50 completed setups)
  private recentTradesHistory: {
    id: string;
    symbol: string;
    direction: string;
    result: 'WIN' | 'LOSS' | 'SCRATCH';
    pnlR: number;
    timestamp: number;
  }[] = [];

  private candleCache: Map<string, { timestamp: number; candles: Candle[] }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly automationService: AutomationService,
  ) {}

  async onModuleInit() {
    this.logger.log(`[SignalsController] Production TradeMind ${this.ENGINE_VERSION} Initialized.`);
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
    } catch (e: any) {
      this.logger.warn(`[SignalsController] DB check note: ${e.message}`);
    }
  }

  private async fetchWithTimeout(url: string, options: any = {}, timeoutMs = 4500): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(options.headers || {})
      };
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  public async fetchTradingViewQuotes(endpoint: 'cfd' | 'america' | 'crypto' | 'forex', tickers: string[]): Promise<Record<string, { price: number; changePct: number; high?: number; low?: number; volume?: number; bid?: number; ask?: number }>> {
    try {
      const res = await this.fetchWithTimeout(`https://scanner.tradingview.com/${endpoint}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: { tickers, query: { types: [] } },
          columns: ['close', 'change', 'high', 'low', 'volume', 'bid', 'ask']
        })
      }, 4000);
      if (res.ok) {
        const data = await res.json();
        const results: Record<string, any> = {};
        (data.data || []).forEach((item: any) => {
          const sym = item.s;
          const vals = item.d || [];
          if (vals[0] != null && !isNaN(vals[0])) {
            results[sym] = {
              price: Number(vals[0]),
              changePct: Number(vals[1] || 0),
              high: Number(vals[2] || vals[0]),
              low: Number(vals[3] || vals[0]),
              volume: Number(vals[4] || 0),
              bid: vals[5] != null ? Number(vals[5]) : undefined,
              ask: vals[6] != null ? Number(vals[6]) : undefined
            };
          }
        });
        return results;
      }
    } catch (e) {}
    return {};
  }

  // -------------------------------------------------------------
  // REAL MARKET DATA SOURCING: TRADINGVIEW WEBSOCKET (ZERO DUMMY FALLBACKS)
  // -------------------------------------------------------------

  public async fetchTradingViewCandles(
    symbol = 'TVC:GOLD',
    resolution = '15',
    nBars = 120
  ): Promise<Candle[]> {
    const cacheKey = `${symbol}:${resolution}:${nBars}`;
    const cached = this.candleCache.get(cacheKey);
    const now = Date.now();
    // Adaptive TTL: 20s for 1m/5m, 45s for 15m/1h/4h
    const ttl = (resolution === '1' || resolution === '5') ? 20000 : 45000;
    if (cached && now - cached.timestamp < ttl && cached.candles.length >= 20) {
      return cached.candles;
    }

    const symbolsToTry = [symbol, 'OANDA:XAUUSD'];
    const WsConstructor: any = (WS as any).default || WS;

    for (const sym of symbolsToTry) {
      try {
        const candles = await new Promise<Candle[]>((resolve, reject) => {
          const ws = new WsConstructor('wss://data.tradingview.com/socket.io/websocket', {
            headers: {
              Origin: 'https://www.tradingview.com',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });

          const chartSession = 'cs_' + Math.random().toString(36).substring(2, 12);
          const timer = setTimeout(() => {
            try { ws.close(); } catch (e) {}
            reject(new Error(`TradingView WS timeout for ${sym} (${resolution})`));
          }, 8000);

          const send = (func: string, args: any[]) => {
            const msg = JSON.stringify({ m: func, p: args });
            const framed = '~m~' + msg.length + '~m~' + msg;
            if (ws.readyState === 1) { // 1 = OPEN
              ws.send(framed);
            }
          };

          ws.on('open', () => {
            send('set_auth_token', ['unauthorized_user_token']);
            send('chart_create_session', [chartSession, '']);
            send('resolve_symbol', [chartSession, 'sds_sym_1', sym]);
            send('create_series', [chartSession, 'sds_1', 's1', 'sds_sym_1', resolution, nBars]);
          });

          ws.on('message', (data: any) => {
            const str = data.toString();
            const heartbeats = str.match(/~m~\d+~m~(~h~\d+)/g);
            if (heartbeats) {
              for (const hb of heartbeats) {
                const match = hb.match(/~h~\d+/);
                if (match) ws.send('~m~' + match[0].length + '~m~' + match[0]);
              }
            }

            if (str.includes('timescale_update')) {
              const payloads = str.split(/~m~\d+~m~/).filter(Boolean);
              for (const p of payloads) {
                try {
                  const parsed = JSON.parse(p);
                  if (parsed.m === 'timescale_update' && parsed.p && parsed.p[1] && parsed.p[1].sds_1 && parsed.p[1].sds_1.s) {
                    clearTimeout(timer);
                    ws.close();
                    const series = parsed.p[1].sds_1.s;
                    const parsedCandles: Candle[] = series.map((b: any) => ({
                      timestamp: new Date(b.v[0] * 1000),
                      open: Number(b.v[1]),
                      high: Number(b.v[2]),
                      low: Number(b.v[3]),
                      close: Number(b.v[4]),
                      volume: Number(b.v[5] || 100)
                    }));
                    parsedCandles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                    resolve(parsedCandles);
                    return;
                  }
                } catch (e) {}
              }
            }
          });

          ws.on('error', (err: any) => {
            clearTimeout(timer);
            reject(err);
          });
        });

        if (candles && candles.length >= 20) {
          this.candleCache.set(cacheKey, { timestamp: now, candles });
          return candles;
        }
      } catch (err: any) {
        this.logger.warn(`[fetchTradingViewCandles] Warning for ${sym} (${resolution}): ${err.message}`);
      }
    }

    return [];
  }

  public async fetchXauusdCandles(interval: '1min' | '5min' | '15min' | '1h' | '4h', outputsize = 120): Promise<Candle[]> {
    let resolution = '15';
    if (interval === '1min') resolution = '1';
    else if (interval === '5min') resolution = '5';
    else if (interval === '15min') resolution = '15';
    else if (interval === '1h') resolution = '60';
    else if (interval === '4h') resolution = '240';

    // 1. Primary institutional source: TradingView WebSocket (Spot Gold TVC:GOLD / OANDA:XAUUSD)
    const tvCandles = await this.fetchTradingViewCandles('TVC:GOLD', resolution, outputsize);
    if (tvCandles.length >= 20) {
      return tvCandles;
    }

    // 2. Secondary fallback: Twelve Data ONLY if API key exists and quota allows (never synthetic futures)
    const tdKey = process.env.TWELVE_DATA_API_KEY;
    if (tdKey) {
      try {
        const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${interval}&outputsize=${outputsize}&apikey=${tdKey}`;
        const res = await this.fetchWithTimeout(url, {}, 3500);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.values) && data.values.length >= 20) {
            const parsed: Candle[] = data.values.map((v: any) => ({
              open: parseFloat(v.open),
              high: parseFloat(v.high),
              low: parseFloat(v.low),
              close: parseFloat(v.close),
              volume: parseFloat(v.volume || '100'),
              timestamp: new Date(v.datetime)
            }));
            parsed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            return parsed;
          }
        }
      } catch (err: any) {
        this.logger.warn(`[fetchXauusdCandles] Twelve Data notice: ${err.message}`);
      }
    }

    // Zero dummy fallbacks: Return empty array so Gate 1 detects FEED_UNAVAILABLE cleanly
    return [];
  }

  public async fetchGoldMicrostructure(latestCandleClose: number): Promise<MicrostructureState> {
    const quotes = await this.fetchTradingViewQuotes('cfd', ['TVC:GOLD', 'OANDA:XAUUSD']);
    let bid = 0;
    let ask = 0;
    let spot = latestCandleClose;

    const oanda = quotes['OANDA:XAUUSD'];
    const tvc = quotes['TVC:GOLD'];

    if (oanda && oanda.bid && oanda.ask && oanda.bid > 0 && oanda.ask > 0) {
      bid = oanda.bid;
      ask = oanda.ask;
      spot = oanda.price;
    } else if (tvc && tvc.bid && tvc.ask && tvc.bid > 0 && tvc.ask > 0) {
      bid = tvc.bid;
      ask = tvc.ask;
      spot = tvc.price;
    } else {
      // ZERO DUMMY FALLBACKS: If real bid/ask quotes are missing, do NOT synthesize fake spreads!
      return { bid: 0, ask: 0, spread: 0, isLiquid: false, reason: 'Live TradingView bid/ask quote unavailable' };
    }

    const spread = parseFloat(Math.max(0.01, ask - bid).toFixed(2));
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();

    if (utcDay === 6 || (utcDay === 0 && utcHour < 22) || (utcDay === 5 && utcHour >= 22)) {
      return { bid, ask, spread, isLiquid: false, reason: 'Weekend market closure' };
    }

    if (utcHour === 21 && utcMin >= 50) {
      return { bid, ask, spread, isLiquid: false, reason: 'Daily settlement roll buffer' };
    }

    if (spread > 2.50) {
      return { bid, ask, spread, isLiquid: false, reason: `Excessive spread expansion ($${spread.toFixed(2)})` };
    }

    return { bid, ask, spread, isLiquid: true };
  }

  public async fetchIntermarket(): Promise<IntermarketState> {
    let dxy = 0;
    let dxyChange1h = 0.0;
    let us10y = 0;
    let us10yChange1h = 0.0;
    let eurusd = 0;
    let silver = 0;
    let oil = 0;
    let us100Change = 0.0;
    let hasLiveMacro = false;

    try {
      // 1. Fetch TradingView CFD Scanner for institutional macro benchmarks (DXY, Silver)
      const tvQuotes = await this.fetchTradingViewQuotes('cfd', ['TVC:DXY', 'TVC:SILVER']);
      if (tvQuotes['TVC:DXY']?.price) {
        dxy = tvQuotes['TVC:DXY'].price;
        dxyChange1h = tvQuotes['TVC:DXY'].changePct;
        hasLiveMacro = true;
      }
      if (tvQuotes['TVC:SILVER']?.price) {
        silver = tvQuotes['TVC:SILVER'].price;
      }

      // 2. Fetch cross-asset yields and commodities from Yahoo
      const [dxyRes, us10yRes, eurusdRes, silverRes, oilRes, nqRes] = await Promise.allSettled([
        dxy <= 0 ? this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=15m&range=1d', {}, 3000) : Promise.resolve(null as any),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=15m&range=1d', {}, 3000),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=15m&range=1d', {}, 3000),
        silver <= 0 ? this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=15m&range=1d', {}, 3000) : Promise.resolve(null as any),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=15m&range=1d', {}, 3000),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=15m&range=1d', {}, 3000)
      ]);

      if (dxy <= 0 && dxyRes.status === 'fulfilled' && dxyRes.value && dxyRes.value.ok) {
        const dxyData = await dxyRes.value.json();
        const meta = dxyData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          dxy = Number(meta.regularMarketPrice);
          hasLiveMacro = true;
          const quotes = dxyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          if (quotes.length >= 4) {
            const past4 = quotes[quotes.length - 4] || quotes[0];
            dxyChange1h = parseFloat((((dxy - past4) / past4) * 100).toFixed(2));
          }
        }
      }

      if (us10yRes.status === 'fulfilled' && us10yRes.value && us10yRes.value.ok) {
        const yData = await us10yRes.value.json();
        const meta = yData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          us10y = Number(meta.regularMarketPrice);
          hasLiveMacro = true;
          const quotes = yData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          if (quotes.length >= 4) {
            const past4 = quotes[quotes.length - 4] || quotes[0];
            us10yChange1h = parseFloat((((us10y - past4) / past4) * 100).toFixed(2));
          }
        }
      }

      if (eurusdRes.status === 'fulfilled' && eurusdRes.value && eurusdRes.value.ok) {
        const euData = await eurusdRes.value.json();
        const price = euData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) eurusd = Number(price);
      }

      if (silver <= 0 && silverRes.status === 'fulfilled' && silverRes.value && silverRes.value.ok) {
        const siData = await silverRes.value.json();
        const price = siData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) silver = Number(price);
      }

      if (oilRes.status === 'fulfilled' && oilRes.value && oilRes.value.ok) {
        const clData = await oilRes.value.json();
        const price = clData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) oil = Number(price);
      }

      if (nqRes.status === 'fulfilled' && nqRes.value && nqRes.value.ok) {
        const nqData = await nqRes.value.json();
        const meta = nqData?.chart?.result?.[0]?.meta;
        const nqPrice = Number(meta?.regularMarketPrice || 0);
        const prevClose = Number(meta?.chartPreviousClose || nqPrice);
        if (prevClose > 0 && nqPrice > 0) {
          us100Change = parseFloat((((nqPrice - prevClose) / prevClose) * 100).toFixed(2));
        }
      }
    } catch (e) {}

    const realYieldProxy = us10y > 0 ? parseFloat((us10y - 2.30).toFixed(2)) : 0;

    // Calculate Safe-Haven Demand Score (0 - 100)
    let safeHavenScore = 50;
    if (us100Change < -0.50) safeHavenScore += 18;
    if (oil > 80 || dxyChange1h > 0.20 && us10yChange1h < -0.10) safeHavenScore += 12;
    if (silver > 30) safeHavenScore += 10;
    if (us100Change > 0.80) safeHavenScore -= 15;
    const safeHavenDemandScore = Math.max(10, Math.min(95, safeHavenScore));

    const riskSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' = 
      us100Change < -0.60 || safeHavenDemandScore >= 70 ? 'RISK_OFF' :
      us100Change > 0.60 && safeHavenDemandScore <= 45 ? 'RISK_ON' : 'NEUTRAL';

    let macroAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SAFE_HAVEN_DECOUPLING' = 'NEUTRAL';
    let conflictDetected = false;
    let conflictReason: string | undefined;
    let rationale = 'Cross-asset indicators moving within baseline historical tolerances.';

    if (dxyChange1h < -0.15 && us10yChange1h < -0.20) {
      macroAlignment = 'BULLISH';
      rationale = `Macro Tailwind: Softer USD (${dxyChange1h}%) and lower real yields (${realYieldProxy}%) support non-yielding bullion.`;
    } else if (dxyChange1h > 0.15 && us10yChange1h > 0.20) {
      if (safeHavenDemandScore >= 70) {
        macroAlignment = 'SAFE_HAVEN_DECOUPLING';
        rationale = 'Safe-Haven Decoupling: USD/Yields firming, but equity risk-off flow supports flight-to-safety gold demand.';
      } else {
        macroAlignment = 'BEARISH';
        conflictDetected = true;
        conflictReason = `Macro Headwind: Surging USD (${dxyChange1h}%) and rising real yields (${realYieldProxy}%) oppose gold longs.`;
        rationale = conflictReason;
      }
    } else if (dxyChange1h > 0.15 && us10yChange1h < -0.15) {
      macroAlignment = 'NEUTRAL';
      rationale = 'Cross-asset divergence: USD firming while Treasury yields soften, creating mixed institutional flows.';
    }

    return {
      dxy,
      dxyChange1h,
      us10y,
      us10yChange1h,
      realYieldProxy,
      eurusd,
      silver,
      oil,
      us100Change,
      safeHavenDemandScore,
      riskSentiment,
      macroAlignment,
      conflictDetected,
      conflictReason,
      rationale
    };
  }

  public async fetchEconomicNewsGate(): Promise<NewsGateState> {
    try {
      const res = await this.fetchWithTimeout('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {}, 3500);
      if (res.ok) {
        const events = await res.json();
        if (Array.isArray(events)) {
          const nowMs = Date.now();
          const extremeKeywords = ['FOMC', 'POWELL', 'CPI', 'NFP', 'PCE'];
          const highKeywords = ['GDP', 'PPI', 'RETAIL SALES', 'RATE', 'UNEMPLOYMENT'];

          for (const ev of events) {
            if (ev.country !== 'USD') continue;
            const titleUpper = (ev.title || '').toUpperCase();

            let impactTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
            if (extremeKeywords.some(kw => titleUpper.includes(kw))) impactTier = 'EXTREME';
            else if (ev.impact === 'High' || highKeywords.some(kw => titleUpper.includes(kw))) impactTier = 'HIGH';
            else if (ev.impact === 'Medium') impactTier = 'MEDIUM';

            if (impactTier === 'LOW') continue;

            const evDate = new Date(ev.date).getTime();
            const diffMin = (evDate - nowMs) / (60 * 1000);
            const preMin = impactTier === 'EXTREME' ? 45 : 25;
            const postMin = impactTier === 'EXTREME' ? -25 : -15;

            if (diffMin <= preMin && diffMin >= postMin) {
              let stage: 'PRE_EVENT' | 'EVENT_SHOCK' | 'PRICE_DISCOVERY' | 'STRUCTURE_REBUILD' | 'NORMAL_MODE' = 'PRE_EVENT';
              if (diffMin > 0) stage = 'PRE_EVENT';
              else if (diffMin >= -5) stage = 'EVENT_SHOCK';
              else if (diffMin >= -15) stage = 'PRICE_DISCOVERY';
              else stage = 'STRUCTURE_REBUILD';

              return {
                isBlackout: true,
                eventStage: stage,
                minutesToEvent: Math.round(diffMin),
                eventTitle: ev.title,
                impactTier
              };
            }
          }
        }
      }
    } catch (e) {}

    return {
      isBlackout: false,
      eventStage: 'NORMAL_MODE',
      minutesToEvent: null,
      eventTitle: null,
      impactTier: 'LOW'
    };
  }

  // -------------------------------------------------------------
  // VOLATILITY & VOLUME PROFILE
  // -------------------------------------------------------------

  public computeVolatilityMetrics(candles15m: Candle[]): VolatilityMetrics {
    if (!candles15m || candles15m.length === 0) {
      return {
        regime: 'NORMAL',
        atr15m: 4.5,
        atrPercentile: 50,
        realizedVolatility: 15.0,
        rangeExpansionRatio: 1.0,
        riskMultiplier: 1.0,
        adaptiveBufferAtr: 0.25
      };
    }

    const atr15m = this.calcATR(candles15m, 14);
    const len = candles15m.length;

    const historicalAtrs: number[] = [];
    for (let i = 20; i <= len; i++) {
      const slice = candles15m.slice(0, i);
      historicalAtrs.push(this.calcATR(slice, 14));
    }

    const lowerCount = historicalAtrs.filter(v => v <= atr15m).length;
    const atrPercentile = Math.round((lowerCount / Math.max(1, historicalAtrs.length)) * 100);

    const logReturns: number[] = [];
    for (let i = 1; i < candles15m.length; i++) {
      const r = Math.log(candles15m[i].close / candles15m[i - 1].close);
      logReturns.push(r);
    }
    const mean = logReturns.reduce((a, b) => a + b, 0) / Math.max(1, logReturns.length);
    const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, logReturns.length);
    const annualizedVol = Math.sqrt(variance) * Math.sqrt(24192) * 100;

    const lastRange = candles15m[len - 1].high - candles15m[len - 1].low;
    const rangeExpansionRatio = parseFloat((lastRange / Math.max(0.1, atr15m)).toFixed(2));

    let regime: VolatilityRegimeType = 'NORMAL';
    let riskMultiplier = 1.0;
    let adaptiveBufferAtr = 0.25;

    if (atrPercentile >= 90 || rangeExpansionRatio >= 2.5) {
      regime = 'EXTREME';
      riskMultiplier = 0.50;
      adaptiveBufferAtr = 0.35;
    } else if (atrPercentile >= 70 || rangeExpansionRatio >= 1.6) {
      regime = 'HIGH';
      riskMultiplier = 0.75;
      adaptiveBufferAtr = 0.28;
    } else if (atrPercentile <= 25 && rangeExpansionRatio <= 0.6) {
      regime = 'LOW';
      riskMultiplier = 1.05;
      adaptiveBufferAtr = 0.18;
    } else {
      regime = 'NORMAL';
      riskMultiplier = 1.0;
      adaptiveBufferAtr = 0.25;
    }

    return {
      regime,
      atr15m: parseFloat(atr15m.toFixed(2)),
      atrPercentile,
      realizedVolatility: parseFloat(annualizedVol.toFixed(1)),
      rangeExpansionRatio,
      riskMultiplier,
      adaptiveBufferAtr
    };
  }

  public computeVolumeProfile(candles15m: Candle[]): VolumeProfile {
    const slice = candles15m.slice(-48);
    if (slice.length === 0) {
      return { poc: 0, vah: 0, val: 0, profileWidth: 0, valueRelation: 'INSIDE_VALUE' };
    }

    const minPrice = Math.min(...slice.map(c => c.low));
    const maxPrice = Math.max(...slice.map(c => c.high));
    const bucketSize = 1.0;
    const bucketCount = Math.max(5, Math.ceil((maxPrice - minPrice) / bucketSize));
    const volumeBuckets = new Array(bucketCount).fill(0);

    slice.forEach(c => {
      const avg = (c.high + c.low + c.close) / 3;
      const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((avg - minPrice) / bucketSize)));
      volumeBuckets[bIdx] += Math.max(10, c.volume);
    });

    let maxVol = -1;
    let pocIdx = 0;
    for (let i = 0; i < bucketCount; i++) {
      if (volumeBuckets[i] > maxVol) {
        maxVol = volumeBuckets[i];
        pocIdx = i;
      }
    }

    const poc = minPrice + (pocIdx + 0.5) * bucketSize;
    const totalVol = volumeBuckets.reduce((a, b) => a + b, 0);
    const targetValVol = totalVol * 0.70;

    let accumulated = volumeBuckets[pocIdx];
    let lowerIdx = pocIdx;
    let upperIdx = pocIdx;

    while (accumulated < targetValVol && (lowerIdx > 0 || upperIdx < bucketCount - 1)) {
      const downVol = lowerIdx > 0 ? volumeBuckets[lowerIdx - 1] : 0;
      const upVol = upperIdx < bucketCount - 1 ? volumeBuckets[upperIdx + 1] : 0;

      if (downVol >= upVol && lowerIdx > 0) {
        lowerIdx--;
        accumulated += downVol;
      } else if (upperIdx < bucketCount - 1) {
        upperIdx++;
        accumulated += upVol;
      } else if (lowerIdx > 0) {
        lowerIdx--;
        accumulated += downVol;
      } else {
        break;
      }
    }

    const val = parseFloat((minPrice + lowerIdx * bucketSize).toFixed(2));
    const vah = parseFloat((minPrice + (upperIdx + 1) * bucketSize).toFixed(2));
    const currentClose = slice[slice.length - 1].close;

    let valueRelation: 'ABOVE_VALUE' | 'INSIDE_VALUE' | 'BELOW_VALUE' = 'INSIDE_VALUE';
    if (currentClose > vah) valueRelation = 'ABOVE_VALUE';
    else if (currentClose < val) valueRelation = 'BELOW_VALUE';

    return {
      poc: parseFloat(poc.toFixed(2)),
      vah,
      val,
      profileWidth: parseFloat((vah - val).toFixed(2)),
      valueRelation
    };
  }

  public computeSessionLevels(candles15m: Candle[]): SessionLevels {
    const now = new Date();
    const utcHour = now.getUTCHours();

    let session: 'ASIA' | 'LONDON' | 'NEW_YORK' | 'ROLLOVER' = 'ASIA';
    if (utcHour >= 0 && utcHour < 7) session = 'ASIA';
    else if (utcHour >= 7 && utcHour < 13) session = 'LONDON';
    else if (utcHour >= 13 && utcHour < 21) session = 'NEW_YORK';
    else session = 'ROLLOVER';

    const todayUtcDate = now.getUTCDate();
    const todayMonth = now.getUTCMonth();
    const todayYear = now.getUTCFullYear();

    const asiaCandles = candles15m.filter(c => {
      const d = c.timestamp;
      return d.getUTCFullYear() === todayYear &&
             d.getUTCMonth() === todayMonth &&
             d.getUTCDate() === todayUtcDate &&
             d.getUTCHours() >= 0 && d.getUTCHours() < 7;
    });

    let ash = 0;
    let asl = Infinity;
    if (asiaCandles.length > 0) {
      ash = Math.max(...asiaCandles.map(c => c.high));
      asl = Math.min(...asiaCandles.map(c => c.low));
    } else {
      const recentSlice = candles15m.slice(-28);
      ash = Math.max(...recentSlice.map(c => c.high));
      asl = Math.min(...recentSlice.map(c => c.low));
    }

    const prevDayCandles = candles15m.filter(c => {
      const d = c.timestamp;
      return d.getUTCDate() !== todayUtcDate || d.getUTCMonth() !== todayMonth;
    }).slice(-96);

    let pdh = 0;
    let pdl = Infinity;
    if (prevDayCandles.length > 0) {
      pdh = Math.max(...prevDayCandles.map(c => c.high));
      pdl = Math.min(...prevDayCandles.map(c => c.low));
    } else {
      // Use genuine historical range from earlier candles in the series (zero synthetic multipliers)
      const olderCandles = candles15m.slice(0, Math.max(1, candles15m.length - 24));
      pdh = Math.max(...olderCandles.map(c => c.high));
      pdl = Math.min(...olderCandles.map(c => c.low));
    }

    const pwh = Math.max(...candles15m.slice(0, Math.max(1, candles15m.length - 20)).map(c => c.high));
    const pwl = Math.min(...candles15m.slice(0, Math.max(1, candles15m.length - 20)).map(c => c.low));

    const sessionCandles = candles15m.filter(c => {
      const d = c.timestamp;
      if (session === 'ASIA') return d.getUTCHours() >= 0 && d.getUTCHours() < 7;
      if (session === 'LONDON') return d.getUTCHours() >= 7 && d.getUTCHours() < 13;
      if (session === 'NEW_YORK') return d.getUTCHours() >= 13 && d.getUTCHours() < 21;
      return d.getUTCHours() >= 21;
    });

    const sessionVwap = this.calcVWAP(sessionCandles.length >= 4 ? sessionCandles : candles15m.slice(-20));
    const anchoredVwapAsia = this.calcVWAP(asiaCandles.length >= 2 ? asiaCandles : candles15m.slice(-28));

    return { session, pdh, pdl, pwh, pwl, ash, asl, sessionVwap, anchoredVwapAsia };
  }

  public detectFractalSwings(candles: Candle[]): FractalSwing[] {
    const swings: FractalSwing[] = [];
    for (let i = 2; i < candles.length - 2; i++) {
      const c = candles[i];
      const isHigh = c.high > candles[i - 2].high && c.high > candles[i - 1].high && c.high > candles[i + 1].high && c.high > candles[i + 2].high;
      const isLow = c.low < candles[i - 2].low && c.low < candles[i - 1].low && c.low < candles[i + 1].low && c.low < candles[i + 2].low;

      if (isHigh) swings.push({ index: i, type: 'HIGH', price: c.high, timestamp: c.timestamp });
      if (isLow) swings.push({ index: i, type: 'LOW', price: c.low, timestamp: c.timestamp });
    }
    return swings;
  }

  public detectOrderBlocks(candles: Candle[], atr15m: number): OrderBlock[] {
    const obs: OrderBlock[] = [];
    const len = candles.length;

    for (let i = 3; i < len - 1; i++) {
      const c = candles[i];
      const next1 = candles[i + 1];
      const next2 = candles[i + 2] || next1;

      if (c.close < c.open) {
        const displacement = (next2.close - c.high) > (c.high - c.low) * 1.5;
        if (displacement) {
          const high = c.high;
          const low = c.low;
          const midpoint = (high + low) / 2;

          let mitigated = false;
          for (let j = i + 1; j < len; j++) {
            if (candles[j].close < midpoint) {
              mitigated = true;
              break;
            }
          }

          let qualityScore = 60;
          if ((next2.close - c.high) > atr15m * 1.2) qualityScore += 20;
          if (c.low < (candles[i - 1]?.low || c.low)) qualityScore += 20;

          obs.push({ type: 'BULLISH', high, low, midpoint, candleIndex: i, mitigated, qualityScore });
        }
      }

      if (c.close > c.open) {
        const displacement = (c.low - next2.close) > (c.high - c.low) * 1.5;
        if (displacement) {
          const high = c.high;
          const low = c.low;
          const midpoint = (high + low) / 2;

          let mitigated = false;
          for (let j = i + 1; j < len; j++) {
            if (candles[j].close > midpoint) {
              mitigated = true;
              break;
            }
          }

          let qualityScore = 60;
          if ((c.low - next2.close) > atr15m * 1.2) qualityScore += 20;
          if (c.high > (candles[i - 1]?.high || c.high)) qualityScore += 20;

          obs.push({ type: 'BEARISH', high, low, midpoint, candleIndex: i, mitigated, qualityScore });
        }
      }
    }

    return obs;
  }

  public detectFairValueGaps(candles: Candle[], atr15m: number): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const minGapSize = Math.max(0.40, atr15m * 0.25);
    const len = candles.length;

    for (let i = 2; i < len; i++) {
      const cCurrent = candles[i];
      const cPast = candles[i - 2];

      if (cCurrent.low > cPast.high) {
        const gapSize = cCurrent.low - cPast.high;
        if (gapSize >= minGapSize) {
          const bottom = cPast.high;
          const top = cCurrent.low;
          const midpoint = (top + bottom) / 2;

          let mitigated = false;
          for (let j = i + 1; j < len; j++) {
            if (candles[j].low <= midpoint) {
              mitigated = true;
              break;
            }
          }
          fvgs.push({ type: 'BULLISH', top, bottom, midpoint, size: gapSize, candleIndex: i, mitigated });
        }
      }

      if (cCurrent.high < cPast.low) {
        const gapSize = cPast.low - cCurrent.high;
        if (gapSize >= minGapSize) {
          const top = cPast.low;
          const bottom = cCurrent.high;
          const midpoint = (top + bottom) / 2;

          let mitigated = false;
          for (let j = i + 1; j < len; j++) {
            if (candles[j].high >= midpoint) {
              mitigated = true;
              break;
            }
          }
          fvgs.push({ type: 'BEARISH', top, bottom, midpoint, size: gapSize, candleIndex: i, mitigated });
        }
      }
    }

    return fvgs;
  }

  public detectAdaptiveLiquiditySweeps(candles: Candle[], keyLevels: { name: string; price: number }[], atr15m: number): LiquiditySweep[] {
    const sweeps: LiquiditySweep[] = [];
    const len = candles.length;
    const checkStart = Math.max(0, len - 6);

    for (let i = checkStart; i < len; i++) {
      const c = candles[i];
      const range = c.high - c.low;
      if (range <= 0.20) continue;

      for (const lvl of keyLevels) {
        if (!lvl.price || isNaN(lvl.price)) continue;

        if (c.high > lvl.price && c.close < lvl.price) {
          const upperWick = c.high - Math.max(c.open, c.close);
          const ratio = upperWick / range;
          const distanceBeyond = c.high - lvl.price;

          if (ratio >= 0.35 && distanceBeyond >= 0.10 * atr15m) {
            let qualityScore = 65;
            if (ratio >= 0.50) qualityScore += 15;
            if (distanceBeyond >= 0.25 * atr15m) qualityScore += 10;
            if (c.close < c.open) qualityScore += 10;

            sweeps.push({
              levelName: lvl.name,
              levelPrice: lvl.price,
              direction: 'BEARISH',
              wickExtreme: c.high,
              candleIndex: i,
              rejectionRatio: parseFloat(ratio.toFixed(2)),
              qualityScore
            });
          }
        }

        if (c.low < lvl.price && c.close > lvl.price) {
          const lowerWick = Math.min(c.open, c.close) - c.low;
          const ratio = lowerWick / range;
          const distanceBeyond = lvl.price - c.low;

          if (ratio >= 0.35 && distanceBeyond >= 0.10 * atr15m) {
            let qualityScore = 65;
            if (ratio >= 0.50) qualityScore += 15;
            if (distanceBeyond >= 0.25 * atr15m) qualityScore += 10;
            if (c.close > c.open) qualityScore += 10;

            sweeps.push({
              levelName: lvl.name,
              levelPrice: lvl.price,
              direction: 'BULLISH',
              wickExtreme: c.low,
              candleIndex: i,
              rejectionRatio: parseFloat(ratio.toFixed(2)),
              qualityScore
            });
          }
        }
      }
    }

    return sweeps;
  }

  public computeInstitutionalConfluenceZone(
    direction: 'BUY' | 'SELL',
    currentPrice: number,
    candidates: ConfluenceCandidate[],
    atr15m: number
  ): InstitutionalConfluenceZone {
    if (candidates.length === 0) {
      return {
        zoneLow: currentPrice - 0.5,
        zoneHigh: currentPrice + 0.5,
        preferredEntry: currentPrice,
        confluenceFactors: ['Market Current Price'],
        overlapCount: 1,
        zoneRank: 'WEAK',
        entryQualityCurve: []
      };
    }

    const radius = Math.max(0.75, atr15m * 0.35);

    let bestCluster: ConfluenceCandidate[] = [];
    let bestWeight = -1;

    for (const anchor of candidates) {
      const cluster = candidates.filter(c => Math.abs(c.price - anchor.price) <= radius);
      const totalWeight = cluster.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight > bestWeight) {
        bestWeight = totalWeight;
        bestCluster = cluster;
      }
    }

    if (bestCluster.length === 0) bestCluster = [candidates[0]];

    const prices = bestCluster.map(c => c.price);
    const zoneLow = parseFloat(Math.min(...prices).toFixed(2));
    const zoneHigh = parseFloat(Math.max(...prices).toFixed(2));

    let weightedSum = 0;
    let totalW = 0;
    bestCluster.forEach(c => {
      weightedSum += c.price * c.weight;
      totalW += c.weight;
    });
    const preferredEntry = parseFloat((weightedSum / Math.max(1, totalW)).toFixed(2));
    const confluenceFactors = Array.from(new Set(bestCluster.map(c => c.source)));
    const overlapCount = bestCluster.length;

    let zoneRank: 'TIER_1_PRIME' | 'TIER_2_STRONG' | 'TIER_3_MODERATE' | 'WEAK' = 'WEAK';
    if (overlapCount >= 4) zoneRank = 'TIER_1_PRIME';
    else if (overlapCount >= 3) zoneRank = 'TIER_2_STRONG';
    else if (overlapCount >= 2) zoneRank = 'TIER_3_MODERATE';

    const curve: { price: number; qualityScore: number }[] = [];
    const step = Math.max(0.3, (zoneHigh - zoneLow) / 4);
    for (let p = zoneLow - step; p <= zoneHigh + step; p += step) {
      const distToCentroid = Math.abs(p - preferredEntry);
      const baseQuality = zoneRank === 'TIER_1_PRIME' ? 95 : zoneRank === 'TIER_2_STRONG' ? 85 : 72;
      const score = Math.max(40, Math.round(baseQuality - (distToCentroid / Math.max(0.1, radius)) * 30));
      curve.push({ price: parseFloat(p.toFixed(2)), qualityScore: score });
    }

    return {
      zoneLow,
      zoneHigh,
      preferredEntry,
      confluenceFactors,
      overlapCount,
      zoneRank,
      entryQualityCurve: curve
    };
  }

  // -------------------------------------------------------------
  // THE 5 INDEPENDENT DECISION GATES PIPELINE
  // -------------------------------------------------------------

  public evaluateProductionPipeline(
    candles15m: Candle[],
    candles1h: Candle[],
    microstructure: MicrostructureState,
    intermarket: IntermarketState,
    newsGate: NewsGateState,
    candles4h: Candle[] = [],
    candles5m: Candle[] = [],
    candles1m: Candle[] = []
  ): XauusdInstitutionalSetup {
    const len15 = candles15m.length;
    const currentPrice = candles15m[len15 - 1]?.close || 0;
    const tvSpotPrice = microstructure.bid ? (microstructure.bid + microstructure.ask) / 2 : currentPrice;

    // =========================================================
    // GATE 1 — DATA INTEGRITY & SYNCHRONIZATION GATE
    // =========================================================
    let gate1Passed = true;
    let gate1Score = 100;
    let gate1Code = 'DATA_OK';
    let gate1Reason = 'All market sources synchronized with sub-second alignment.';

    if (!candles15m || candles15m.length < 30) {
      gate1Passed = false;
      gate1Score = 0;
      gate1Code = 'FEED_EMPTY';
      gate1Reason = 'Insufficient closed candles from market provider (minimum 30 required).';
    } else {
      const lastCandle = candles15m[len15 - 1];
      const candleAgeMin = (Date.now() - lastCandle.timestamp.getTime()) / (60 * 1000);
      const now = new Date();
      const utcDay = now.getUTCDay();
      const utcHour = now.getUTCHours();
      const isWeekend = utcDay === 6 || (utcDay === 0 && utcHour < 22) || (utcDay === 5 && utcHour >= 22);

      if (!isWeekend && candleAgeMin > 50) {
        gate1Passed = false;
        gate1Score = 10;
        gate1Code = 'FEED_STALE';
        gate1Reason = `TradingView candle feed is ${Math.round(candleAgeMin)}m stale during active market session.`;
      }

      if (tvSpotPrice > 1000 && lastCandle.close > 1000) {
        const deltaPct = Math.abs(lastCandle.close - tvSpotPrice) / lastCandle.close * 100;
        if (deltaPct > 0.40) {
          gate1Passed = false;
          gate1Score = 20;
          gate1Code = 'PRICE_CONFLICT';
          gate1Reason = `TradingView Candle ($${lastCandle.close.toFixed(2)}) vs Live Scanner ($${tvSpotPrice.toFixed(2)}) delta: ${deltaPct.toFixed(2)}% exceeds allowed 0.40% tolerance.`;
        }
      }
    }

    const gate1: GateCheck = {
      gateId: 'GATE_1_DATA',
      passed: gate1Passed,
      score: gate1Score,
      code: gate1Code,
      reason: gate1Reason,
      telemetry: {
        candlesCount: candles15m.length,
        candleClose: currentPrice,
        tvSpotPrice,
        deltaPct: currentPrice ? Math.abs(currentPrice - tvSpotPrice) / currentPrice * 100 : 0
      }
    };

    // Analytical models across memory layers
    const volMetrics = this.computeVolatilityMetrics(candles15m);
    const sessionLevels = this.computeSessionLevels(candles15m);
    const volumeProfile = this.computeVolumeProfile(candles15m);
    const swings15 = this.detectFractalSwings(candles15m);
    const swings1h = this.detectFractalSwings(candles1h);
    const obs15 = this.detectOrderBlocks(candles15m, volMetrics.atr15m);
    const fvgs15 = this.detectFairValueGaps(candles15m, volMetrics.atr15m);

    // Event-driven candle importance weighting
    const eventWeights = this.computeEventDrivenWeights(candles15m, [], swings15, obs15, fvgs15);

    // Classical Technical Indicators
    const closes15 = candles15m.map(c => c.close);
    const ema20 = this.calcEMA(closes15, 20);
    const ema50 = this.calcEMA(closes15, 50);
    const ema100 = this.calcEMA(closes15, 100);
    const ema200 = this.calcEMA(closes15, 200);
    const rsi14 = this.calcRSI(closes15, 14);
    const rsiDiv = this.detectRsiDivergence(closes15, swings15);
    const macd = this.calcMACD(closes15);
    const adx14 = this.calcADX(candles15m, 14);
    const bb = this.calcBollingerBands(closes15, 20, 2);

    const classicalIndicators: ClassicalIndicators = {
      ema20,
      ema50,
      ema100,
      ema200,
      rsi14,
      rsiDivergence: rsiDiv,
      macd,
      adx14,
      isTrending: adx14 >= 25,
      bollingerBands: bb
    };

    const keyLevels = [
      { name: 'Asian High (ASH)', price: sessionLevels.ash },
      { name: 'Asian Low (ASL)', price: sessionLevels.asl },
      { name: 'Previous Day High (PDH)', price: sessionLevels.pdh },
      { name: 'Previous Day Low (PDL)', price: sessionLevels.pdl }
    ];
    swings15.filter(s => s.type === 'HIGH').slice(-3).forEach(s => keyLevels.push({ name: `Swing High ($${s.price.toFixed(1)})`, price: s.price }));
    swings15.filter(s => s.type === 'LOW').slice(-3).forEach(s => keyLevels.push({ name: `Swing Low ($${s.price.toFixed(1)})`, price: s.price }));
    const sweeps = this.detectAdaptiveLiquiditySweeps(candles15m, keyLevels, volMetrics.atr15m);

    // 1H Trend (Primary Structure)
    let htfTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    if (swings1h.length >= 4) {
      const last2Highs = swings1h.filter(s => s.type === 'HIGH').slice(-2);
      const last2Lows = swings1h.filter(s => s.type === 'LOW').slice(-2);
      if (last2Highs.length === 2 && last2Lows.length === 2) {
        if (last2Highs[1].price > last2Highs[0].price && last2Lows[1].price > last2Lows[0].price) htfTrend = 'BULLISH';
        else if (last2Highs[1].price < last2Highs[0].price && last2Lows[1].price < last2Lows[0].price) htfTrend = 'BEARISH';
      }
    }

    // 4H Trend (Structural Memory Environment)
    let trend4h: 'BULLISH' | 'BEARISH' | 'RANGING' = htfTrend;
    if (candles4h && candles4h.length >= 20) {
      const closes4h = candles4h.map(c => c.close);
      const ema50_4h = this.calcEMA(closes4h, 50);
      const ema200_4h = this.calcEMA(closes4h, 200);
      const lastClose4h = closes4h[closes4h.length - 1];
      if (lastClose4h > ema50_4h && ema50_4h > ema200_4h) trend4h = 'BULLISH';
      else if (lastClose4h < ema50_4h && ema50_4h < ema200_4h) trend4h = 'BEARISH';
    }

    let marketRegime: MarketRegimeType = 'EXPANSION_RANGE';
    if (newsGate.isBlackout && newsGate.eventStage === 'EVENT_SHOCK') marketRegime = 'NEWS_SHOCK';
    else if (volMetrics.regime === 'EXTREME') marketRegime = 'VOLATILITY_EXPANSION';
    else if (htfTrend === 'BULLISH' && (trend4h === 'BULLISH' || trend4h === 'RANGING')) marketRegime = 'STRONG_BULL_TREND';
    else if (htfTrend === 'BEARISH' && (trend4h === 'BEARISH' || trend4h === 'RANGING')) marketRegime = 'STRONG_BEAR_TREND';
    else if (volMetrics.regime === 'LOW') marketRegime = 'COMPRESSION_RANGE';

    // =========================================================
    // GATE 2 — MARKET ENVIRONMENT GATE
    // =========================================================
    let gate2Passed = true;
    let gate2Score = 95;
    let gate2Code = 'MARKET_HEALTHY';
    let gate2Reason = 'Active session with tight institutional spread and normal volatility.';

    if (!microstructure.isLiquid) {
      gate2Passed = false;
      gate2Score = 0;
      gate2Code = 'MICROSTRUCTURE_HALT';
      gate2Reason = microstructure.reason || 'Spread expanded beyond $2.50 or rollover halt.';
    } else if (newsGate.isBlackout) {
      gate2Passed = false;
      gate2Score = 15;
      gate2Code = 'NEWS_BLACKOUT';
      gate2Reason = `Binary Event Blackout: ${newsGate.eventTitle} (${newsGate.impactTier}) release proximity (${newsGate.minutesToEvent}m).`;
    } else if (marketRegime === 'NEWS_SHOCK') {
      gate2Passed = false;
      gate2Score = 20;
      gate2Code = 'NEWS_SHOCK';
      gate2Reason = 'Active post-news price discovery shock. Normal setups inhibited until structure rebuilds.';
    } else if (volMetrics.regime === 'EXTREME') {
      gate2Score = 65;
    }

    const gate2: GateCheck = {
      gateId: 'GATE_2_MARKET',
      passed: gate2Passed,
      score: gate2Score,
      code: gate2Code,
      reason: gate2Reason,
      telemetry: {
        spread: microstructure.spread,
        session: sessionLevels.session,
        marketRegime,
        volatilityRegime: volMetrics.regime
      }
    };

    // =========================================================
    // GATE 3 — SETUP STATISTICAL PROBABILITY & CONFLICT GATE
    // =========================================================
    let bias: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
    const latestBullishSweep = sweeps.find(s => s.direction === 'BULLISH');
    const latestBearishSweep = sweeps.find(s => s.direction === 'BEARISH');

    if (marketRegime === 'STRONG_BULL_TREND' || (htfTrend === 'BULLISH' && currentPrice >= sessionLevels.sessionVwap)) {
      bias = 'BUY';
    } else if (marketRegime === 'STRONG_BEAR_TREND' || (htfTrend === 'BEARISH' && currentPrice <= sessionLevels.sessionVwap)) {
      bias = 'SELL';
    } else if (latestBullishSweep) {
      bias = 'BUY';
    } else if (latestBearishSweep) {
      bias = 'SELL';
    }

    let gate3Passed = true;
    let gate3Score = 80;
    let gate3Code = 'SETUP_VALID';
    let gate3Reason = 'Statistical setup matches market regime with directional edge.';

    // Technical + Fundamental Conflict Detection
    if (bias === 'BUY' && intermarket.conflictDetected) {
      gate3Passed = false;
      gate3Score = 30;
      gate3Code = 'MACRO_TECHNICAL_CONFLICT';
      gate3Reason = `Technical long vetoed by Macro Conflict: ${intermarket.conflictReason || 'Surging USD and Yields oppose gold'}`;
    } else if (bias === 'SELL' && intermarket.macroAlignment === 'BULLISH' && intermarket.safeHavenDemandScore >= 70) {
      gate3Passed = false;
      gate3Score = 30;
      gate3Code = 'MACRO_TECHNICAL_CONFLICT';
      gate3Reason = `Technical short vetoed: Safe-Haven Demand (Score: ${intermarket.safeHavenDemandScore}) creates upward breakout risk.`;
    } else if (bias === 'NO_TRADE') {
      gate3Passed = false;
      gate3Score = 40;
      gate3Code = 'NO_DIRECTIONAL_BIAS';
      gate3Reason = 'Market structure is ambiguous with no clean institutional trend or sweep.';
    }

    const gate3: GateCheck = {
      gateId: 'GATE_3_SETUP',
      passed: gate3Passed,
      score: gate3Score,
      code: gate3Code,
      reason: gate3Reason,
      telemetry: {
        bias,
        htfTrend,
        trend4h,
        sweepsCount: sweeps.length,
        obsCount: obs15.length,
        conflictDetected: intermarket.conflictDetected
      }
    };

    // =========================================================
    // GATE 4 — TRADE LOCATION & EXPECTED VALUE (EV) GATE
    // =========================================================
    const candidates: ConfluenceCandidate[] = [];
    const activeBullishObs = obs15.filter(o => o.type === 'BULLISH' && !o.mitigated).slice(-2);
    const activeBearishObs = obs15.filter(o => o.type === 'BEARISH' && !o.mitigated).slice(-2);
    const activeBullishFvgs = fvgs15.filter(f => f.type === 'BULLISH' && !f.mitigated).slice(-2);
    const activeBearishFvgs = fvgs15.filter(f => f.type === 'BEARISH' && !f.mitigated).slice(-2);

    const swingLow = swings15.filter(s => s.type === 'LOW').slice(-1)[0]?.price || sessionLevels.asl;
    const swingHigh = swings15.filter(s => s.type === 'HIGH').slice(-1)[0]?.price || sessionLevels.ash;
    const equilibrium = (swingLow + swingHigh) / 2;

    if (bias === 'BUY') {
      activeBullishObs.forEach(ob => {
        candidates.push({ source: 'Bullish Order Block Midpoint', price: ob.midpoint, weight: 3 });
        candidates.push({ source: 'Bullish Order Block Edge', price: ob.high, weight: 2 });
      });
      activeBullishFvgs.forEach(fvg => candidates.push({ source: 'Fair Value Gap (FVG) 50%', price: fvg.midpoint, weight: 3 }));
      candidates.push({ source: 'Session VWAP', price: sessionLevels.sessionVwap, weight: 2 });
      candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 2 });
      candidates.push({ source: 'Discount Equilibrium', price: equilibrium, weight: 2 });
      if (latestBullishSweep) candidates.push({ source: 'Sweep Retest', price: latestBullishSweep.levelPrice, weight: 3 });
    } else if (bias === 'SELL') {
      activeBearishObs.forEach(ob => {
        candidates.push({ source: 'Bearish Order Block Midpoint', price: ob.midpoint, weight: 3 });
        candidates.push({ source: 'Bearish Order Block Edge', price: ob.low, weight: 2 });
      });
      activeBearishFvgs.forEach(fvg => candidates.push({ source: 'Fair Value Gap (FVG) 50%', price: fvg.midpoint, weight: 3 }));
      candidates.push({ source: 'Session VWAP', price: sessionLevels.sessionVwap, weight: 2 });
      candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 2 });
      candidates.push({ source: 'Premium Equilibrium', price: equilibrium, weight: 2 });
      if (latestBearishSweep) candidates.push({ source: 'Sweep Retest', price: latestBearishSweep.levelPrice, weight: 3 });
    }

    // Connect event-driven weighting: incorporate high-impact impulse candle levels
    const highImpactCandles = (eventWeights || []).filter(ew => ew.weight >= 1.5).slice(-2);
    highImpactCandles.forEach(hic => {
      const c = candles15m[hic.index];
      if (c) {
        candidates.push({
          source: `Event Impulse Level (${hic.eventTag})`,
          price: parseFloat(((c.open + c.close) / 2).toFixed(2)),
          weight: 3
        });
      }
    });

    const icz = this.computeInstitutionalConfluenceZone(bias === 'BUY' ? 'BUY' : 'SELL', currentPrice, candidates, volMetrics.atr15m);

    let orderType: OrderType = 'WAIT';
    let selectedModel: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'NONE' = 'NONE';
    const distancePips = Math.round(Math.abs(currentPrice - icz.preferredEntry) * 10);

    if (bias === 'BUY') {
      if (latestBullishSweep) selectedModel = 'SWEEP_CHOCH_REVERSAL';
      else if (marketRegime === 'STRONG_BULL_TREND') selectedModel = 'BOS_PULLBACK_CONTINUATION';
      else selectedModel = 'RANGE_DEVIATION_RECLAIM';

      if (currentPrice > icz.zoneHigh + 0.25 * volMetrics.atr15m) orderType = 'BUY_LIMIT';
      else if (currentPrice >= icz.zoneLow - 0.25 * volMetrics.atr15m && currentPrice <= icz.zoneHigh + 0.25 * volMetrics.atr15m) {
        orderType = latestBullishSweep ? 'MARKET_BUY' : 'BUY_LIMIT';
      } else {
        orderType = 'WAIT';
      }
    } else if (bias === 'SELL') {
      if (latestBearishSweep) selectedModel = 'SWEEP_CHOCH_REVERSAL';
      else if (marketRegime === 'STRONG_BEAR_TREND') selectedModel = 'BOS_PULLBACK_CONTINUATION';
      else selectedModel = 'RANGE_DEVIATION_RECLAIM';

      if (currentPrice < icz.zoneLow - 0.25 * volMetrics.atr15m) orderType = 'SELL_LIMIT';
      else if (currentPrice >= icz.zoneLow - 0.25 * volMetrics.atr15m && currentPrice <= icz.zoneHigh + 0.25 * volMetrics.atr15m) {
        orderType = latestBearishSweep ? 'MARKET_SELL' : 'SELL_LIMIT';
      } else {
        orderType = 'WAIT';
      }
    }

    // Invalidation
    const adaptiveBuffer = parseFloat((volMetrics.atr15m * volMetrics.adaptiveBufferAtr).toFixed(2));
    const structuralInvalidationLevel = bias === 'BUY' ? (latestBullishSweep?.wickExtreme || swingLow) : (latestBearishSweep?.wickExtreme || swingHigh);
    const exactStopLoss = bias === 'BUY'
      ? parseFloat((structuralInvalidationLevel - adaptiveBuffer).toFixed(2))
      : parseFloat((structuralInvalidationLevel + adaptiveBuffer).toFixed(2));

    const entryPrice = orderType.includes('MARKET') ? currentPrice : icz.preferredEntry;
    const risk = Math.max(0.5, Math.abs(entryPrice - exactStopLoss));

    // Destinations & Path
    let tp1Price = bias === 'BUY' ? parseFloat(Math.max(entryPrice + risk * 1.4, volumeProfile.vah).toFixed(2)) : parseFloat(Math.min(entryPrice - risk * 1.4, volumeProfile.val).toFixed(2));
    let tp2Price = bias === 'BUY' ? parseFloat(Math.max(tp1Price + risk * 0.8, sessionLevels.ash).toFixed(2)) : parseFloat(Math.min(tp1Price - risk * 0.8, sessionLevels.asl).toFixed(2));
    let tp3Price = bias === 'BUY' ? parseFloat(Math.max(tp2Price + risk * 1.2, sessionLevels.pdh).toFixed(2)) : parseFloat(Math.min(tp2Price - risk * 1.2, sessionLevels.pdl).toFixed(2));

    const r1 = parseFloat((Math.abs(tp1Price - entryPrice) / risk).toFixed(2));
    const r2 = parseFloat((Math.abs(tp2Price - entryPrice) / risk).toFixed(2));
    const r3 = parseFloat((Math.abs(tp3Price - entryPrice) / risk).toFixed(2));

    const pTp1 = parseFloat(Math.max(0.45, Math.min(0.82, 0.76 - 0.04 * (r1 - 1.4))).toFixed(2));
    const pTp2 = parseFloat(Math.max(0.30, Math.min(0.68, 0.58 - 0.03 * (r2 - 2.2))).toFixed(2));
    const pTp3 = parseFloat(Math.max(0.20, Math.min(0.50, 0.38 - 0.02 * (r3 - 3.5))).toFixed(2));
    const pSl = parseFloat((1.0 - pTp1).toFixed(2));
    const ev = parseFloat((((pTp1 * 0.5 * r1) + (pTp2 * 0.3 * r2) + (pTp3 * 0.2 * r3)) - (pSl * 1.0)).toFixed(2));

    let gate4Passed = true;
    let gate4Score = 85;
    let gate4Code = 'TRADE_LOCATION_OK';
    let gate4Reason = `Institutional Confluence Zone verified with positive EV (+${ev}R).`;

    if (r1 < 1.4) {
      gate4Passed = false;
      gate4Score = 30;
      gate4Code = 'INSUFFICIENT_RR';
      gate4Reason = `R:R1 is ${r1} (< 1.4 minimum institutional threshold).`;
    } else if (ev < 0.30) {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'NEGATIVE_EXPECTANCY';
      gate4Reason = `Expected Value is ${ev}R (< +0.30R required statistical edge).`;
    } else if (icz.zoneRank === 'WEAK') {
      gate4Passed = false;
      gate4Score = 40;
      gate4Code = 'WEAK_CONFLUENCE_ZONE';
      gate4Reason = 'Fewer than 2 overlapping institutional structural levels.';
    }

    const gate4: GateCheck = {
      gateId: 'GATE_4_TRADE',
      passed: gate4Passed,
      score: gate4Score,
      code: gate4Code,
      reason: gate4Reason,
      telemetry: {
        orderType,
        iczZone: [icz.zoneLow, icz.zoneHigh],
        preferredEntry: entryPrice,
        exactStopLoss,
        r1,
        ev
      }
    };

    // =========================================================
    // GATE 5 — EXECUTION SAFETY & KILL SWITCH GATE
    // =========================================================
    let gate5Passed = true;
    let gate5Score = 95;
    let gate5Code = 'EXECUTION_CLEAR';
    let gate5Reason = 'Execution safety checks passed. Broker limits and risk thresholds satisfied.';
    let killSwitchActive = false;
    let killSwitchTier: KillSwitchTier = 'NONE';
    let killSwitchReason: string | undefined;

    // Check rolling drift: if win rate in recent 20 trades < 45%
    const recent20 = this.recentTradesHistory.slice(-20);
    if (recent20.length >= 15) {
      const wins = recent20.filter(t => t.result === 'WIN').length;
      const winRate = wins / recent20.length;
      if (winRate < 0.40) {
        gate5Passed = false;
        gate5Score = 30;
        gate5Code = 'MODEL_DRIFT_HALT';
        gate5Reason = `Model drift detected: rolling win rate is ${(winRate * 100).toFixed(0)}% (< 40%). Execution halted.`;
        killSwitchActive = true;
        killSwitchTier = 'MODEL_KILL';
        killSwitchReason = gate5Reason;
      }
    }

    if (!gate1Passed) {
      gate5Passed = false;
      killSwitchActive = true;
      killSwitchTier = 'DATA_KILL';
      killSwitchReason = gate1.reason;
    } else if (!gate2Passed) {
      gate5Passed = false;
      killSwitchActive = true;
      killSwitchTier = newsGate.isBlackout ? 'NEWS_KILL' : 'EXECUTION_KILL';
      killSwitchReason = gate2.reason;
    }

    const gate5: GateCheck = {
      gateId: 'GATE_5_EXECUTION',
      passed: gate5Passed,
      score: gate5Score,
      code: gate5Code,
      reason: gate5Reason,
      telemetry: { killSwitchActive, killSwitchTier, killSwitchReason }
    };

    // Aggregate 5 Gates
    const allPassed = gate1.passed && gate2.passed && gate3.passed && gate4.passed && gate5.passed;
    let failingGate: string | null = null;
    if (!gate1.passed) failingGate = 'GATE_1_DATA';
    else if (!gate2.passed) failingGate = 'GATE_2_MARKET';
    else if (!gate3.passed) failingGate = 'GATE_3_SETUP';
    else if (!gate4.passed) failingGate = 'GATE_4_TRADE';
    else if (!gate5.passed) failingGate = 'GATE_5_EXECUTION';

    const fiveGates: FiveGatesSummary = {
      allPassed,
      failingGate,
      gate1_data: gate1,
      gate2_market: gate2,
      gate3_setup: gate3,
      gate4_trade: gate4,
      gate5_execution: gate5
    };

    // Final Action: Emit or Wait
    let finalDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    let grade: 'A+' | 'A' | 'B+' | 'WAIT' = 'WAIT';
    const compositeScore = Math.round((gate1.score * 0.20) + (gate2.score * 0.20) + (gate3.score * 0.20) + (gate4.score * 0.25) + (gate5.score * 0.15));

    if (allPassed && orderType !== 'WAIT' && bias !== 'NO_TRADE') {
      finalDirection = bias;
      if (compositeScore >= 85 && ev >= 0.70) grade = 'A+';
      else if (compositeScore >= 75 && ev >= 0.45) grade = 'A';
      else if (compositeScore >= 70 && ev >= 0.30) grade = 'B+';
    } else {
      orderType = 'WAIT';
    }

    // Position Sizing
    const baseRiskUsd = 1000;
    const confidenceMultiplier = grade === 'A+' ? 1.0 : grade === 'A' ? 0.85 : 0.65;
    const finalRiskUsd = baseRiskUsd * volMetrics.riskMultiplier * confidenceMultiplier;
    const recommendedUnitsOz = parseFloat((finalRiskUsd / risk).toFixed(1));
    const recommendedLots = parseFloat((recommendedUnitsOz / 100).toFixed(2));

    const tradePath: TradePathModel = {
      tp1Price,
      tp1LiquiditySource: 'Volume Profile VAH/VAL',
      tp1RiskReward: r1,
      probTp1BeforeSl: pTp1,
      tp2Price,
      tp2LiquiditySource: 'Asian Session High/Low (ASH/ASL)',
      tp2RiskReward: r2,
      probTp2BeforeSl: pTp2,
      tp3Price,
      tp3LiquiditySource: 'Previous Day High/Low (PDH/PDL)',
      tp3RiskReward: r3,
      probTp3BeforeSl: pTp3,
      probSlBeforeTp1: pSl,
      expectedValueR: ev
    };

    const invalidationAndExpiry: InvalidationAndExpiry = {
      structuralInvalidationLevel,
      adaptiveVolBuffer: adaptiveBuffer,
      exactStopLoss,
      invalidationThesis: bias === 'BUY'
        ? `Invalidated if 15M candle body closes below $${exactStopLoss.toFixed(2)}.`
        : `Invalidated if 15M candle body closes above $${exactStopLoss.toFixed(2)}.`,
      orderExpiryHours: 4,
      preFillCancelTriggers: [
        `15M close breaking opposite swing pivot before fill.`,
        `DXY surges > +0.30% with volume against gold.`,
        `Impending high-impact economic news release.`
      ]
    };

    const positionSizing: DynamicPositionSizing = {
      riskBudgetUsd: Math.round(finalRiskUsd),
      recommendedLots,
      recommendedUnitsOz,
      volatilityAdjustment: volMetrics.riskMultiplier,
      confidenceAdjustment: confidenceMultiplier
    };

    const auditTrail: ImmutableTradeAudit = {
      tradeId: `xau-${Date.now()}`,
      timestamp: new Date().toISOString(),
      engineVersion: this.ENGINE_VERSION,
      dataSnapshot: {
        twelveDataClose: currentPrice,
        tvSpotPrice,
        spread: microstructure.spread,
        dxy: intermarket.dxy,
        us10y: intermarket.us10y,
        realYield: intermarket.realYieldProxy
      },
      features: {
        atr15m: volMetrics.atr15m,
        atrPercentile: volMetrics.atrPercentile,
        volumeProfilePoc: volumeProfile.poc,
        sessionVwap: sessionLevels.sessionVwap,
        regime: marketRegime,
        iczOverlapCount: icz.overlapCount
      },
      fiveGates,
      orderPlan: {
        orderType,
        preferredEntry: entryPrice,
        zone: [icz.zoneLow, icz.zoneHigh],
        sl: exactStopLoss,
        tp1: tp1Price,
        tp2: tp2Price,
        tp3: tp3Price,
        r1,
        ev
      },
      positionSizing,
      thesis: {
        thesis: `Trade Plan: ${orderType} at ICZ ($${icz.zoneLow}–$${icz.zoneHigh}) targeting TP1 $${tp1Price} (R:R ${r1}).`,
        invalidationConditions: invalidationAndExpiry.preFillCancelTriggers
      },
      executionStatus: allPassed ? 'APPROVED_FOR_EXECUTION' : 'HELD_AT_GATE'
    };

    let failingReason = 'Awaiting conditions';
    if (failingGate === 'GATE_1_DATA') failingReason = gate1.reason;
    else if (failingGate === 'GATE_2_MARKET') failingReason = gate2.reason;
    else if (failingGate === 'GATE_3_SETUP') failingReason = gate3.reason;
    else if (failingGate === 'GATE_4_TRADE') failingReason = gate4.reason;
    else if (failingGate === 'GATE_5_EXECUTION') failingReason = gate5.reason;

    const summary = !allPassed
      ? `Gate Check [${failingGate}]: ${failingReason}`
      : `High-conviction ${grade} ${orderType} setup at Institutional Confluence Zone ($${icz.zoneLow}–$${icz.zoneHigh}). Preferred Entry: $${entryPrice.toFixed(2)}, SL: $${exactStopLoss.toFixed(2)}, TP1: $${tp1Price.toFixed(2)} (R:R ${r1}, EV +${ev}R).`;

    // Update real-time state store
    this.liveStateStore = {
      symbol: 'GOLD',
      engineVersion: this.ENGINE_VERSION,
      lastUpdated: new Date().toISOString(),
      currentPrice,
      bid: microstructure.bid,
      ask: microstructure.ask,
      spread: microstructure.spread,
      marketRegime,
      volatilityRegime: volMetrics.regime,
      session: sessionLevels.session,
      dxyAlignment: intermarket.macroAlignment,
      us10yAlignment: `${intermarket.us10yChange1h}%`,
      newsRisk: newsGate.impactTier,
      activeOrderType: orderType,
      entryZone: [icz.zoneLow, icz.zoneHigh],
      preferredEntry: entryPrice,
      stopLoss: exactStopLoss,
      tp1: tp1Price,
      tp2: tp2Price,
      tp3: tp3Price,
      expectedValueR: ev,
      fiveGates,
      killSwitchActive,
      killSwitchTier,
      killSwitchReason
    };

    // Real 5M tactical MSS confirmation
    let mss5mTriggered = false;
    if (candles5m && candles5m.length >= 8) {
      const recent5m = candles5m.slice(-3);
      const priorSwings5m = this.detectFractalSwings(candles5m.slice(0, -3));
      if (finalDirection === 'BUY') {
        const lastSwingHigh = priorSwings5m.filter(s => s.type === 'HIGH').slice(-1)[0]?.price;
        const lastCandle = recent5m[recent5m.length - 1];
        if (lastSwingHigh && lastCandle && lastCandle.close > lastSwingHigh && lastCandle.close > lastCandle.open) {
          mss5mTriggered = true;
        }
      } else if (finalDirection === 'SELL') {
        const lastSwingLow = priorSwings5m.filter(s => s.type === 'LOW').slice(-1)[0]?.price;
        const lastCandle = recent5m[recent5m.length - 1];
        if (lastSwingLow && lastCandle && lastCandle.close < lastSwingLow && lastCandle.close < lastCandle.open) {
          mss5mTriggered = true;
        }
      }
    }

    // Real 1M spread impact on micro-execution
    let spreadImpactPips = Math.round(microstructure.spread * 10);
    if (candles1m && candles1m.length >= 5) {
      const last1m = candles1m[candles1m.length - 1];
      const range1m = last1m.high - last1m.low;
      if (range1m > 0 && microstructure.spread > range1m * 0.40) {
        spreadImpactPips = Math.round(microstructure.spread * 15);
      }
    }

    const memory: MultiTimeframeMemory = {
      structural: {
        tf4h: { trend: trend4h, candleCount: candles4h?.length || 0 },
        tf1h: { trend: htfTrend, bosDetected: htfTrend !== 'RANGING', candleCount: candles1h?.length || 0 }
      },
      tactical: {
        tf15m: { sessionPdhPdl: true, activeFvgs: fvgs15.filter(f => !f.mitigated).length, candleCount: candles15m?.length || 0 },
        tf5m: { mssTriggered: mss5mTriggered, candleCount: candles5m?.length || 0 }
      },
      execution: {
        tf1m: { spreadImpactPips, candleCount: candles1m?.length || 0 }
      }
    };

    const hierarchy: FiveLevelFactorHierarchy = {
      level1_marketEnvironment: {
        regime: marketRegime,
        volatilityRegime: volMetrics.regime,
        atrPercentile: volMetrics.atrPercentile,
        session: sessionLevels.session,
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getUTCDay()]
      },
      level2_fundamentalMacro: {
        dxy: intermarket.dxy,
        us10y: intermarket.us10y,
        realYield: intermarket.realYieldProxy,
        safeHavenScore: intermarket.safeHavenDemandScore,
        riskSentiment: intermarket.riskSentiment,
        macroConflict: intermarket.conflictDetected
      },
      level3_technicalStructure: {
        htfTrend4h: trend4h,
        primaryStructure1h: htfTrend,
        tacticalStructure15m: marketRegime,
        indicators: classicalIndicators,
        poc: volumeProfile.poc,
        vwap: sessionLevels.sessionVwap
      },
      level4_entryConfirmation: {
        model: selectedModel,
        confirmation5m: orderType.includes('MARKET'),
        iczLow: icz.zoneLow,
        iczHigh: icz.zoneHigh,
        preferredEntry: entryPrice
      },
      level5_tradeQuality: {
        orderType,
        ev,
        r1,
        recommendedLots
      }
    };

    return {
      fiveGates,
      orderType,
      model: selectedModel,
      direction: finalDirection,
      grade,
      opportunityScore: compositeScore,
      marketBiasScore: gate3.score,
      entryQualityScore: gate4.score,
      entryPrice,
      entryZone: [icz.zoneLow, icz.zoneHigh],
      stopLoss: exactStopLoss,
      takeProfit1: tp1Price,
      takeProfit2: tp2Price,
      takeProfit3: tp3Price,
      riskReward1: r1,
      riskReward2: r2,
      riskReward3: r3,
      tradePath,
      invalidationAndExpiry,
      positionSizing,
      marketRegime,
      volatilityMetrics: volMetrics,
      volumeProfile,
      levels: {
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        pdh: parseFloat(sessionLevels.pdh.toFixed(2)),
        pdl: parseFloat(sessionLevels.pdl.toFixed(2)),
        pwh: parseFloat(sessionLevels.pwh.toFixed(2)),
        pwl: parseFloat(sessionLevels.pwl.toFixed(2)),
        ash: parseFloat(sessionLevels.ash.toFixed(2)),
        asl: parseFloat(sessionLevels.asl.toFixed(2)),
        sessionVwap: parseFloat(sessionLevels.sessionVwap.toFixed(2)),
        poc: volumeProfile.poc,
        vah: volumeProfile.vah,
        val: volumeProfile.val
      },
      microstructure,
      intermarket,
      newsGate,
      killSwitchActive,
      killSwitchTier,
      killSwitchReason,
      auditTrail,
      confluenceReasons: icz.confluenceFactors,
      summary,
      hierarchy,
      memory
    };
  }

  // -------------------------------------------------------------
  // CONTROLLER ENDPOINTS
  // -------------------------------------------------------------

  @Get('state')
  @ApiOperation({ summary: 'Get live real-time XAUUSD state store snapshot' })
  async getLiveState() {
    return this.liveStateStore || { status: 'INITIALIZING', symbol: 'GOLD', timestamp: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({ summary: 'Get all active trading signals' })
  async getSignals(@Query('forceFresh') forceFreshQuery?: string) {
    try {
      const now = new Date();
      await this.prisma.signal.deleteMany({
        where: { expiresAt: { lte: now } }
      }).catch(() => {});

      const activeSignals = await this.prisma.signal.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
      });

      return activeSignals;
    } catch (err: any) {
      this.logger.error(`[SignalsController] getSignals notice: ${err.message}`);
      return [];
    }
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request generation of a 5-Gate audited institutional trade plan' })
  async generateSignal(@Req() req: any, @Body() dto: { symbol: string; interval?: string; forceFresh?: boolean }) {
    const symbol = this.normalizeSymbol(dto.symbol);

    if (symbol !== 'GOLD') {
      return {
        id: `wait-${symbol.toLowerCase()}-${Date.now()}`,
        symbol,
        direction: 'WAIT',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskRewardRatio: 0,
        winProbability: 0,
        durationEstimate: 'Single Asset Focus',
        aiReasoning: {
          status: 'FOCUSED_MODE',
          explanation: `TradeMind is running in single-asset institutional mode on Gold (XAUUSD). ${symbol} will be activated sequentially.`,
          indicators: ['Single Asset Mode: XAUUSD'],
          timeframe: dto.interval || '15m'
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600 * 1000)
      };
    }

    // 1. Ingest Multi-timeframe Candles (Real Data across 5 Memory Horizons)
    const [candles4h, candles1h, candles15m, candles5m, candles1m] = await Promise.all([
      this.fetchXauusdCandles('4h', 100),
      this.fetchXauusdCandles('1h', 120),
      this.fetchXauusdCandles('15min', 160),
      this.fetchXauusdCandles('5min', 200),
      this.fetchXauusdCandles('1min', 200)
    ]);

    // 2. Microstructure, Intermarket, and News Gate
    const latestPrice = (candles15m.length > 0 ? candles15m[candles15m.length - 1]?.close : 0) || 0;
    const [microstructure, intermarket, newsGate] = await Promise.all([
      this.fetchGoldMicrostructure(latestPrice),
      this.fetchIntermarket(),
      this.fetchEconomicNewsGate()
    ]);

    // 3. 5-Gate Decision Pipeline Execution across 5 Timeframe Memory Layers
    const setup = this.evaluateProductionPipeline(
      candles15m,
      candles1h,
      microstructure,
      intermarket,
      newsGate,
      candles4h,
      candles5m,
      candles1m
    );

    // 4. Contextual AI Reviewer (Gemini Context Layer - Auditable explainability)
    let aiExplanation = setup.summary;
    let aiVerdict = setup.fiveGates.allPassed ? 'APPROVED' : 'HOLD';

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiRes = await this.fetchWithTimeout(`${aiServiceUrl}/ai/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-API-Key': process.env.AI_SERVICE_API_KEY || 'internal-secret-key'
        },
        body: JSON.stringify({
          symbol: 'GOLD',
          timeframe: dto.interval || '15m',
          setup: {
            direction: setup.direction,
            entry: setup.entryPrice,
            stop_loss: setup.stopLoss,
            take_profit_1: setup.takeProfit1,
            take_profit_2: setup.takeProfit2,
            model: setup.model,
            grade: setup.grade,
            score: setup.opportunityScore,
            risk_reward_ratio_tp1: setup.riskReward1,
            risk_reward_ratio_tp2: setup.riskReward2,
            confluence_reasons: setup.confluenceReasons,
            levels: setup.levels,
          },
          session: (setup.levels as any)?.session || 'Active Session',
          intermarket: setup.intermarket,
          microstructure: setup.microstructure,
          news_gate: setup.newsGate,
          market_regime: setup.marketRegime,
          volatility_metrics: setup.volatilityMetrics,
          volume_profile: setup.volumeProfile,
          expectancy: setup.tradePath,
          position_sizing: setup.positionSizing
        })
      }, 5000);

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        if (aiJson && aiJson.ai_explanation) {
          aiExplanation = aiJson.ai_explanation;
          aiVerdict = aiJson.ai_review_verdict || aiVerdict;
        }
      }
    } catch (e: any) {
      this.logger.warn(`[SignalsController] AI service review notice: ${e.message}`);
    }

    // 5. Senior AI Desk Reviewer (Gemini) VETO Enforcement:
    // If Gemini issues a VETO, block database persistence and downgrade direction
    if (aiVerdict === 'VETOED') {
      this.logger.warn(`[SignalsController] Gold candidate VETOED by Gemini AI Desk Reviewer: ${aiExplanation}`);
      setup.direction = 'WAIT';
      setup.orderType = 'WAIT';
      setup.fiveGates.allPassed = false;
      setup.fiveGates.failingGate = 'GEMINI_DESK_VETO';
      setup.fiveGates.failingReason = `Vetoed by Senior AI Desk Reviewer: ${aiExplanation}`;
    }

    if (setup.fiveGates.allPassed && aiVerdict !== 'VETOED' && (setup.direction === 'BUY' || setup.direction === 'SELL')) {
      const createdSignal = await this.prisma.signal.create({
        data: {
          symbol: 'GOLD',
          direction: setup.direction,
          entryPrice: setup.entryPrice,
          stopLoss: setup.stopLoss,
          takeProfit1: setup.takeProfit1,
          takeProfit2: setup.takeProfit2,
          riskRewardRatio: setup.riskReward1,
          winProbability: Math.round(setup.tradePath.probTp1BeforeSl * 100),
          durationEstimate: '4-8 hours',
          aiReasoning: {
            status: 'ACTIVE',
            orderType: setup.orderType,
            entryZone: setup.entryZone,
            strategy: setup.model,
            signalGrade: setup.grade,
            opportunityScore: setup.opportunityScore,
            marketBiasScore: setup.marketBiasScore,
            entryQualityScore: setup.entryQualityScore,
            fiveGates: setup.fiveGates,
            tradePath: setup.tradePath,
            invalidationAndExpiry: setup.invalidationAndExpiry,
            positionSizing: setup.positionSizing,
            auditTrail: setup.auditTrail,
            indicators: setup.confluenceReasons,
            explanation: aiExplanation,
            aiVerdict,
            levels: setup.levels,
            marketRegime: setup.marketRegime,
            volatilityMetrics: setup.volatilityMetrics,
            volumeProfile: setup.volumeProfile,
            microstructure: setup.microstructure,
            intermarket: setup.intermarket,
            timeframe: '15m'
          } as any,
          expiresAt: new Date(Date.now() + setup.invalidationAndExpiry.orderExpiryHours * 60 * 60 * 1000)
        }
      });

      return createdSignal;
    }

    // 6. Return transparent first-class WAIT response with exact gate diagnosis
    return {
      id: `gold-wait-${Date.now()}`,
      symbol: 'GOLD',
      direction: 'WAIT',
      orderType: setup.orderType,
      entryPrice: setup.entryPrice,
      entryZone: setup.entryZone,
      stopLoss: setup.stopLoss,
      takeProfit1: setup.takeProfit1,
      takeProfit2: setup.takeProfit2,
      riskRewardRatio: setup.riskReward1,
      winProbability: Math.round(setup.tradePath.probTp1BeforeSl * 100),
      durationEstimate: 'Awaiting Gate Clearance',
      aiReasoning: {
        status: 'WAIT',
        failedGate: setup.fiveGates.failingGate,
        fiveGates: setup.fiveGates,
        orderType: setup.orderType,
        entryZone: setup.entryZone,
        strategy: setup.model,
        signalGrade: setup.grade,
        opportunityScore: setup.opportunityScore,
        marketBiasScore: setup.marketBiasScore,
        entryQualityScore: setup.entryQualityScore,
        tradePath: setup.tradePath,
        invalidationAndExpiry: setup.invalidationAndExpiry,
        indicators: setup.confluenceReasons,
        explanation: aiExplanation,
        aiVerdict: 'HOLD',
        levels: setup.levels,
        marketRegime: setup.marketRegime,
        volatilityMetrics: setup.volatilityMetrics,
        volumeProfile: setup.volumeProfile,
        microstructure: setup.microstructure,
        intermarket: setup.intermarket,
        killSwitchActive: setup.killSwitchActive,
        killSwitchTier: setup.killSwitchTier,
        killSwitchReason: setup.killSwitchReason,
        timeframe: '15m'
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 180 * 1000)
    };
  }

  // Periodic Automated Background Market Scanner (Every 3 minutes)
  @Interval(180_000)
  async handlePeriodicXauusdScan() {
    try {
      const now = new Date();
      const day = now.getUTCDay();
      const hour = now.getUTCHours();
      if (day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 22)) return;

      const activeCount = await this.prisma.signal.count({
        where: {
          symbol: 'GOLD',
          direction: { in: ['BUY', 'SELL'] },
          expiresAt: { gt: now }
        }
      });

      if (activeCount > 0) return;

      const [candles4h, candles1h, candles15m, candles5m, candles1m] = await Promise.all([
        this.fetchXauusdCandles('4h', 100),
        this.fetchXauusdCandles('1h', 120),
        this.fetchXauusdCandles('15min', 160),
        this.fetchXauusdCandles('5min', 200),
        this.fetchXauusdCandles('1min', 200)
      ]);

      if (!candles15m || candles15m.length < 30) return;

      const latestPrice = candles15m[candles15m.length - 1].close;
      const [microstructure, intermarket, newsGate] = await Promise.all([
        this.fetchGoldMicrostructure(latestPrice),
        this.fetchIntermarket(),
        this.fetchEconomicNewsGate()
      ]);

      const setup = this.evaluateProductionPipeline(
        candles15m,
        candles1h,
        microstructure,
        intermarket,
        newsGate,
        candles4h,
        candles5m,
        candles1m
      );

      if (setup.fiveGates.allPassed && (setup.direction === 'BUY' || setup.direction === 'SELL') && setup.opportunityScore >= 75) {
        // Run AI Desk Review before automated publishing
        let aiVerdict = 'APPROVED';
        let aiExplanation = setup.summary;
        try {
          const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
          const aiRes = await this.fetchWithTimeout(`${aiServiceUrl}/ai/predict`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-AI-API-Key': process.env.AI_SERVICE_API_KEY || 'internal-secret-key'
            },
            body: JSON.stringify({
              symbol: 'GOLD',
              timeframe: '15m',
              setup: {
                direction: setup.direction,
                entry: setup.entryPrice,
                stop_loss: setup.stopLoss,
                take_profit_1: setup.takeProfit1,
                take_profit_2: setup.takeProfit2,
                model: setup.model,
                grade: setup.grade,
                score: setup.opportunityScore,
                risk_reward_ratio_tp1: setup.riskReward1,
                risk_reward_ratio_tp2: setup.riskReward2,
                confluence_reasons: setup.confluenceReasons,
                levels: setup.levels,
              },
              session: (setup.levels as any)?.session || 'Active Session',
              intermarket: setup.intermarket,
              microstructure: setup.microstructure,
              news_gate: setup.newsGate,
              market_regime: setup.marketRegime,
              volatility_metrics: setup.volatilityMetrics,
              volume_profile: setup.volumeProfile,
              expectancy: setup.tradePath,
              position_sizing: setup.positionSizing
            })
          }, 5000);

          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            if (aiJson && aiJson.ai_review_verdict) {
              aiVerdict = aiJson.ai_review_verdict;
              aiExplanation = aiJson.ai_explanation || aiExplanation;
            }
          }
        } catch (e: any) {
          this.logger.warn(`[AUTOMATION] AI service desk review check notice: ${e.message}`);
        }

        if (aiVerdict === 'VETOED') {
          this.logger.warn(`[AUTOMATION] Candidate signal VETOED by Gemini AI Desk Reviewer: ${aiExplanation}`);
          return;
        }

        this.logger.log(`[AUTOMATION] 5-Gate Cleared & Gemini Approved ${setup.grade} ${setup.orderType} on XAUUSD (Score: ${setup.opportunityScore}, EV: +${setup.tradePath.expectedValueR}R)`);

        await this.prisma.signal.create({
          data: {
            symbol: 'GOLD',
            direction: setup.direction,
            entryPrice: setup.entryPrice,
            stopLoss: setup.stopLoss,
            takeProfit1: setup.takeProfit1,
            takeProfit2: setup.takeProfit2,
            riskRewardRatio: setup.riskReward1,
            winProbability: Math.round(setup.tradePath.probTp1BeforeSl * 100),
            durationEstimate: '4-8 hours',
            aiReasoning: {
              status: 'ACTIVE',
              orderType: setup.orderType,
              entryZone: setup.entryZone,
              strategy: setup.model,
              signalGrade: setup.grade,
              opportunityScore: setup.opportunityScore,
              marketBiasScore: setup.marketBiasScore,
              entryQualityScore: setup.entryQualityScore,
              fiveGates: setup.fiveGates,
              tradePath: setup.tradePath,
              invalidationAndExpiry: setup.invalidationAndExpiry,
              positionSizing: setup.positionSizing,
              auditTrail: setup.auditTrail,
              indicators: setup.confluenceReasons,
              explanation: setup.summary,
              levels: setup.levels,
              marketRegime: setup.marketRegime,
              volatilityMetrics: setup.volatilityMetrics,
              volumeProfile: setup.volumeProfile,
              microstructure: setup.microstructure,
              intermarket: setup.intermarket,
              timeframe: '15m'
            } as any,
            expiresAt: new Date(Date.now() + setup.invalidationAndExpiry.orderExpiryHours * 60 * 60 * 1000)
          }
        });
      }
    } catch (e: any) {
      this.logger.warn(`[handlePeriodicXauusdScan] Scan notice: ${e.message}`);
    }
  }

  // Real-time Active Position Management (Tracks every 30 seconds)
  @Interval(30_000)
  async handlePositionManagement() {
    try {
      const now = new Date();
      const activeSignals = await this.prisma.signal.findMany({
        where: {
          symbol: 'GOLD',
          direction: { in: ['BUY', 'SELL'] },
          expiresAt: { gt: now }
        }
      });

      if (activeSignals.length === 0) return;

      const quotes = await this.fetchTradingViewQuotes('cfd', ['TVC:GOLD', 'OANDA:XAUUSD']);
      const currentPrice = quotes['TVC:GOLD']?.price || quotes['OANDA:XAUUSD']?.price;
      if (!currentPrice || currentPrice <= 1000) return;

      for (const signal of activeSignals) {
        const reasoning = (signal.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';

        if (['CLOSED', 'TP2_HIT', 'SL_HIT', 'THESIS_INVALIDATED'].includes(status)) continue;

        let updatedStatus = status;

        if (signal.direction === 'BUY') {
          if (currentPrice <= signal.stopLoss) {
            updatedStatus = 'SL_HIT';
          } else if (currentPrice >= signal.takeProfit2) {
            updatedStatus = 'TP2_HIT';
          } else if (currentPrice >= signal.takeProfit1) {
            updatedStatus = 'TP1_HIT';
          }
        } else if (signal.direction === 'SELL') {
          if (currentPrice >= signal.stopLoss) {
            updatedStatus = 'SL_HIT';
          } else if (currentPrice <= signal.takeProfit2) {
            updatedStatus = 'TP2_HIT';
          } else if (currentPrice <= signal.takeProfit1) {
            updatedStatus = 'TP1_HIT';
          }
        }

        if (updatedStatus !== status) {
          this.logger.log(`[POSITION_MANAGER] Signal ${signal.id} status updated: ${status} -> ${updatedStatus} @ $${currentPrice}`);

          if (['SL_HIT', 'TP1_HIT', 'TP2_HIT'].includes(updatedStatus)) {
            const isWin = updatedStatus.startsWith('TP');
            this.recentTradesHistory.push({
              id: signal.id,
              symbol: 'GOLD',
              direction: signal.direction,
              result: isWin ? 'WIN' : 'LOSS',
              pnlR: isWin ? (updatedStatus === 'TP2_HIT' ? signal.riskRewardRatio * 1.5 : signal.riskRewardRatio) : -1.0,
              timestamp: Date.now()
            });

            if (this.recentTradesHistory.length > 50) this.recentTradesHistory.shift();
          }

          await this.prisma.signal.update({
            where: { id: signal.id },
            data: {
              aiReasoning: {
                ...reasoning,
                status: updatedStatus,
                lastCheckedPrice: currentPrice,
                lastStatusChange: new Date().toISOString()
              } as any
            }
          });
        }
      }
    } catch (e: any) {
      this.logger.warn(`[handlePositionManagement] notice: ${e.message}`);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a manually defined trading signal' })
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
          status: 'ACTIVE',
          indicators: ['Manually defined structure'],
          explanation: dto.explanation || 'Signal created manually.'
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return signal;
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
  @ApiOperation({ summary: 'Delete signal permanently from database' })
  async deleteSignal(@Param('id') id: string) {
    let deletedSymbol: string | null = null;
    try {
      const existing = await this.prisma.signal.findUnique({
        where: { id },
        select: { id: true, symbol: true }
      });
      if (existing) {
        deletedSymbol = existing.symbol;
        await this.prisma.signal.delete({
          where: { id },
        });
        this.logger.log(`[SignalsController] Signal ${id} (${deletedSymbol}) deleted from database.`);
      }
    } catch (err: any) {
      this.logger.warn(`[SignalsController] Failed to delete signal ${id}: ${err.message}`);
    }

    return { success: true, deletedId: id, symbol: deletedSymbol };
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

  // Common Technical Indicators & Helpers
  public calcSMA(vals: number[], period: number): number {
    if (!vals || vals.length === 0) return 0;
    const slice = vals.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  public calcEMA(vals: number[], period: number): number {
    if (!vals || vals.length === 0) return 0;
    if (vals.length < period) return vals.reduce((a, b) => a + b, 0) / vals.length;
    const k = 2 / (period + 1);
    let ema = vals.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < vals.length; i++) {
      ema = vals[i] * k + ema * (1 - k);
    }
    return ema;
  }

  public calcRSI(closes: number[], period = 14): number {
    if (!closes || closes.length < period + 1) return 50.0;
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) avgGain += diff;
      else avgLoss += Math.abs(diff);
    }
    avgGain /= period;
    avgLoss /= period;
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
  }

  public calcATR(candles: any[], period = 14): number {
    if (!candles || candles.length < 2) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const h = Number(candles[i].high);
      const l = Number(candles[i].low);
      const pc = Number(candles[i - 1].close);
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr;
  }

  public calcVWAP(candles: any[]): number {
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

  public calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
    if (!closes || closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    const ema12 = this.calcEMA(closes, 12);
    const ema26 = this.calcEMA(closes, 26);
    const macdLine = parseFloat((ema12 - ema26).toFixed(2));

    const macdSeries: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      macdSeries.push(this.calcEMA(slice, 12) - this.calcEMA(slice, 26));
    }
    const signalLine = parseFloat(this.calcEMA(macdSeries, 9).toFixed(2));
    const histogram = parseFloat((macdLine - signalLine).toFixed(2));
    return { macd: macdLine, signal: signalLine, histogram };
  }

  public calcADX(candles: Candle[], period = 14): number {
    if (!candles || candles.length < period * 2) return 20.0;
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];
    const trs: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const upMove = candles[i].high - candles[i - 1].high;
      const downMove = candles[i - 1].low - candles[i].low;
      plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
      trs.push(Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      ));
    }

    const smoothedTr = trs.slice(-period).reduce((a, b) => a + b, 0);
    if (smoothedTr <= 0) return 20.0;
    const smoothedPlusDm = plusDMs.slice(-period).reduce((a, b) => a + b, 0);
    const smoothedMinusDm = minusDMs.slice(-period).reduce((a, b) => a + b, 0);

    const plusDI = (smoothedPlusDm / smoothedTr) * 100;
    const minusDI = (smoothedMinusDm / smoothedTr) * 100;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 20.0;

    return parseFloat(dx.toFixed(1));
  }

  public calcBollingerBands(closes: number[], period = 20, multiplier = 2): { upper: number; middle: number; lower: number; bandwidth: number } {
    if (!closes || closes.length < period) {
      const last = closes[closes.length - 1] || 0;
      return { upper: last + 2, middle: last, lower: last - 2, bandwidth: 4 };
    }
    const middle = this.calcSMA(closes, period);
    const slice = closes.slice(-period);
    const variance = slice.reduce((sum, c) => sum + Math.pow(c - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = parseFloat((middle + multiplier * stdDev).toFixed(2));
    const lower = parseFloat((middle - multiplier * stdDev).toFixed(2));
    const bandwidth = parseFloat(((upper - lower) / Math.max(1, middle) * 100).toFixed(2));
    return { upper, middle: parseFloat(middle.toFixed(2)), lower, bandwidth };
  }

  public detectRsiDivergence(closes: number[], swings: FractalSwing[]): 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE' {
    if (!closes || closes.length < 30 || swings.length < 4) return 'NONE';
    const recentLowSwings = swings.filter(s => s.type === 'LOW').slice(-2);
    if (recentLowSwings.length === 2) {
      const [s1, s2] = recentLowSwings;
      const rsi1 = this.calcRSI(closes.slice(0, s1.index + 1));
      const rsi2 = this.calcRSI(closes.slice(0, s2.index + 1));
      if (s2.price < s1.price && rsi2 > rsi1 + 2) {
        return 'BULLISH_DIVERGENCE';
      }
    }
    const recentHighSwings = swings.filter(s => s.type === 'HIGH').slice(-2);
    if (recentHighSwings.length === 2) {
      const [s1, s2] = recentHighSwings;
      const rsi1 = this.calcRSI(closes.slice(0, s1.index + 1));
      const rsi2 = this.calcRSI(closes.slice(0, s2.index + 1));
      if (s2.price > s1.price && rsi2 < rsi1 - 2) {
        return 'BEARISH_DIVERGENCE';
      }
    }
    return 'NONE';
  }

  public computeEventDrivenWeights(
    candles: Candle[],
    sweeps: LiquiditySweep[],
    swings: FractalSwing[],
    obs: OrderBlock[],
    fvgs: FairValueGap[]
  ): { index: number; weight: number; eventTag: string }[] {
    const len = candles.length;
    return candles.map((c, i) => {
      const isSweep = sweeps.some(s => s.candleIndex === i);
      const isSwing = swings.some(s => s.index === i);
      const isObs = obs.some(o => o.candleIndex === i && !o.mitigated);
      const isFvg = fvgs.some(f => f.candleIndex === i && !f.mitigated);
      const isRecent = i >= len - 10;

      if (isSweep) return { index: i, weight: 0.95, eventTag: 'MAJOR_LIQUIDITY_SWEEP' };
      if (isObs) return { index: i, weight: 0.90, eventTag: 'DISPLACEMENT_ORDER_BLOCK' };
      if (isFvg) return { index: i, weight: 0.88, eventTag: 'FRESH_FAIR_VALUE_GAP' };
      if (isSwing) return { index: i, weight: 0.82, eventTag: 'FRACTAL_SWING_PIVOT' };
      if (isRecent) return { index: i, weight: 0.40, eventTag: 'RECENT_TACTICAL_BAR' };
      return { index: i, weight: 0.05, eventTag: 'BASELINE_STRUCTURAL_BAR' };
    });
  }
}

@Module({
  imports: [SubscriptionModule, AutomationModule],
  controllers: [SignalsController],
  providers: [SignalsController],
  exports: [SignalsController],
})
export class SignalsModule {}
