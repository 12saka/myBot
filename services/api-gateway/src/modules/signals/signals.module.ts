import { Module, Controller, Get, Post, Body, Param, Query, UseGuards, Req, Delete, OnModuleInit, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Interval } from '@nestjs/schedule';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AutomationModule } from '../automation/automation.module';
import { AutomationService } from '../automation/automation.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { XAUUSD_ENGINE_CONFIG } from './engine/config/xauusd.config';
import { SignalLifecycleEvent, SignalLifecycleState, SignalLifecycleOutcome } from '@trademind/shared';
import * as WS from 'ws';
import * as fs from 'fs';
import * as path from 'path';

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
  londonHigh: number;
  londonLow: number;
  sessionVwap: number;
  anchoredVwapAsia: number;
}

export interface MicrostructureState {
  bid: number;
  ask: number;
  spread: number;
  spot?: number;
  isLiquid: boolean;
  reason?: string;
}

export interface IntermarketState {
  dxy: number;
  dxyChange1h: number;
  dxyChange24h?: number;
  us10y: number;
  us10yChange1h: number;
  realYieldProxy: number;
  breakevenInflation?: number;
  isRealYieldLive?: boolean;
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
  hasLiveMacro: boolean;
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
    tf1m: {
      spreadImpactPips: number;
      candleCount: number;
      refinedBy1m?: boolean;
      refinedEntry?: number;
      refinementReason?: string;
    };
  };
}

export interface FiveLevelFactorHierarchy {
  level1_marketEnvironment: {
    regime: MarketRegimeType;
    volatilityRegime: VolatilityRegimeType;
    atrPercentile: number;
    session: string;
    dayOfWeek: string;
    approachingDecisionArea?: boolean;
    decisionAreaDetails?: string;
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
    refinedBy1m?: boolean;
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
  feedOffline?: boolean;
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
  riskPercent?: number;
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

export interface FinalValidationChecklist {
  dataIsFresh: boolean;
  setupStillValid: boolean;
  entryNotMissed: boolean;
  stopIsStructural: boolean;
  targetsRealistic: boolean;
  rrAcceptable: boolean;
  newsRiskAcceptable: boolean;
  spreadAcceptable: boolean;
  notDuplicate: boolean;
  withinExposureCap: boolean;
  orderTypeSupported: boolean;
  allPassed: boolean;
  reasons: string[];
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
  finalValidationChecklist?: FinalValidationChecklist;
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
  finalValidationChecklist: FinalValidationChecklist;
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
    londonHigh: number;
    londonLow: number;
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
  unmitigatedOrderBlocks?: OrderBlock[];
  fairValueGaps?: FairValueGap[];
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

  private lastStopLossHit: {
    direction: 'BUY' | 'SELL';
    stopLossPrice: number;
    timestamp: number;
  } | null = null;

  private candleCache: Map<string, { timestamp: number; candles: Candle[] }> = new Map();
  private cachedGoldSetup: { timestamp: number; setup: XauusdInstitutionalSetup } | null = null;
  private readonly GOLD_SETUP_CACHE_TTL_MS = 3500; // 3.5s cache for concurrent cockpit tab queries
  private cachedCalendarEvents: any[] = [];
  private lastCalendarFetchTime: number = 0;
  private readonly CALENDAR_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hour memory cache (weekly schedule rarely changes intraday)
  private inflightCalendarPromise: Promise<any[]> | null = null;
  private nextAllowedCalendarFetchTime: number = 0;
  private calendarFetchFailureCount: number = 0;
  private readonly calendarDiskCachePath = path.join(process.cwd(), '.cache', 'forexfactory_calendar.json');

  // Clock-aligned candle-close & event-driven scheduler tracking (Phase 6)
  private lastScanned5mBar: number = 0;
  private lastScanned15mBar: number = 0;
  private lastScanned1hBar: number = 0;
  private triggeredNewsBlackoutKeys: Set<string> = new Set();
  private lastActiveBlackoutEvent: string | null = null;
  private isGeneratingSignal: boolean = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly automationService: AutomationService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async onModuleInit() {
    this.logger.log(`[SignalsController] Production TradeMind ${this.ENGINE_VERSION} Initialized.`);
    try {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "confluenceScore" DOUBLE PRECISION;`);
    } catch (e: any) {
      this.logger.warn(`[SignalsController] DB check note: ${e.message}`);
    }

    // Restore Gate 5 Risk Memory & circuit breakers from historical closed signals in database
    await this.hydrateRiskMemoryFromDb();

    // Load persisted calendar cache from disk on boot so engine is immediately ready without network delay
    this.loadCalendarFromDisk();

    // Trigger asynchronous background calendar refresh if cache is expired or missing
    if (this.cachedCalendarEvents.length === 0 || (Date.now() - this.lastCalendarFetchTime) >= this.CALENDAR_CACHE_TTL_MS) {
      this.getOrFetchCalendarEvents().catch(err => {
        this.logger.warn(`[NewsGate] Boot calendar sync notice: ${err.message}`);
      });
    }

    // Schedule immediate automated scan after 3 seconds so signals exist automatically without user interaction
    setTimeout(() => {
      this.handlePeriodicXauusdScan().catch(err => {
        this.logger.warn(`[SignalsController] Initial background scan error: ${err.message}`);
      });
    }, 3000);
  }

  private async hydrateRiskMemoryFromDb() {
    try {
      // 1. First attempt to load structured trade performance logs from GoldSignalPerformance
      const perfLogs = await this.prisma.goldSignalPerformance.findMany({
        where: { symbol: 'GOLD' },
        orderBy: { closedAt: 'desc' },
        take: 50
      });

      if (perfLogs.length > 0) {
        // Chronological order: oldest first, newest at the end
        this.recentTradesHistory = perfLogs
          .slice()
          .reverse()
          .map(p => ({
            id: p.signalId,
            symbol: p.symbol,
            direction: p.direction,
            result: p.result === 'WIN' ? 'WIN' : p.result === 'LOSS' ? 'LOSS' : 'SCRATCH',
            pnlR: p.pnlR ?? (p.result === 'WIN' ? 1.5 : p.result === 'LOSS' ? -1.0 : 0.0),
            timestamp: p.closedAt ? new Date(p.closedAt).getTime() : new Date(p.createdAt).getTime()
          }));
      } else {
        // 2. Fallback to completed signals in Signal table
        const closedSignals = await this.prisma.signal.findMany({
          where: { symbol: 'GOLD' },
          orderBy: { createdAt: 'desc' },
          take: 60
        });

        const completed = closedSignals.filter(s => {
          const r = (s.aiReasoning as any) || {};
          const status = r.status || '';
          const lifecycle = r.lifecycleState || status;
          const outcome = r.outcome || '';
          return (
            ['CLOSED', 'TP1_HIT', 'TP2_HIT', 'SL_HIT'].includes(status) ||
            ['CLOSED', 'TP1_HIT', 'TP2_HIT', 'SL_HIT'].includes(lifecycle) ||
            ['TP1_HIT', 'TP2_HIT', 'SL_HIT', 'BREAKEVEN'].includes(outcome)
          ) && Boolean(r.isOrderFilled || status === 'POSITION_OPEN' || status.startsWith('TP') || status === 'SL_HIT' || outcome);
        });

        this.recentTradesHistory = completed
          .slice(0, 50)
          .reverse()
          .map(s => {
            const r = (s.aiReasoning as any) || {};
            const outcome = r.outcome || r.status || '';
            const isLoss = outcome === 'SL_HIT' || (r.pnlR !== undefined && r.pnlR < 0);
            const isWin = outcome.startsWith('TP') || (r.pnlR !== undefined && r.pnlR > 0);
            const pnlR = r.pnlR ?? (isWin ? (outcome === 'TP2_HIT' ? s.riskRewardRatio * 1.5 : s.riskRewardRatio) : isLoss ? -1.0 : 0.0);
            const ts = r.closedAt ? new Date(r.closedAt).getTime() : new Date(s.createdAt).getTime();
            return {
              id: s.id,
              symbol: s.symbol,
              direction: s.direction,
              result: isWin ? 'WIN' : isLoss ? 'LOSS' : 'SCRATCH',
              pnlR,
              timestamp: ts
            };
          });
      }

      // Check if the most recent completed trade was a stop-loss within the last 15 minutes
      const lastTrade = this.recentTradesHistory[this.recentTradesHistory.length - 1];
      if (lastTrade && lastTrade.result === 'LOSS' && (Date.now() - lastTrade.timestamp) < 15 * 60 * 1000) {
        const matchingSignal = await this.prisma.signal.findUnique({
          where: { id: lastTrade.id },
          select: { direction: true, stopLoss: true }
        });
        if (matchingSignal) {
          this.lastStopLossHit = {
            direction: matchingSignal.direction as 'BUY' | 'SELL',
            stopLossPrice: matchingSignal.stopLoss,
            timestamp: lastTrade.timestamp
          };
          this.logger.log(`[Gate5] Restored active Post-SL cooldown from DB for ${matchingSignal.direction} at $${matchingSignal.stopLoss} (${Math.round((Date.now() - lastTrade.timestamp) / 60000)}m ago).`);
        }
      }

      this.logger.log(`[SignalsController] Hydrated ${this.recentTradesHistory.length} historical completed trades into Gate 5 memory.`);
    } catch (err: any) {
      this.logger.warn(`[hydrateRiskMemoryFromDb] Notice: ${err.message}`);
    }
  }

  private loadCalendarFromDisk() {
    try {
      if (fs.existsSync(this.calendarDiskCachePath)) {
        const raw = fs.readFileSync(this.calendarDiskCachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.events) && parsed.events.length > 0) {
          this.cachedCalendarEvents = parsed.events;
          this.lastCalendarFetchTime = parsed.timestamp || Date.now();
          this.logger.log(`[NewsGate] Loaded ${parsed.events.length} ForexFactory calendar events from disk cache (age: ${Math.round((Date.now() - this.lastCalendarFetchTime) / 60000)}m).`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[NewsGate] Disk cache notice: ${e.message}`);
    }
  }

  private saveCalendarToDisk(events: any[]) {
    try {
      const dir = path.dirname(this.calendarDiskCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.calendarDiskCachePath, JSON.stringify({
        timestamp: Date.now(),
        events
      }), 'utf8');
    } catch (e: any) {
      this.logger.warn(`[NewsGate] Could not write calendar disk cache: ${e.message}`);
    }
  }

  private fredSeriesCache: Map<string, { timestamp: number; value: number }> = new Map();

  public async fetchFredSeries(seriesId: string): Promise<number | null> {
    const cached = this.fredSeriesCache.get(seriesId);
    const now = Date.now();
    // Cache for 4 hours (FRED daily series updates once a day)
    if (cached && (now - cached.timestamp < 4 * 60 * 60 * 1000)) {
      return cached.value;
    }

    try {
      const res = await this.fetchWithTimeout(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, {}, 3500);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n');
        for (let i = lines.length - 1; i >= 1; i--) {
          const parts = lines[i].split(',');
          if (parts.length >= 2) {
            const val = parseFloat(parts[1].trim());
            if (!isNaN(val) && val > 0) {
              this.fredSeriesCache.set(seriesId, { timestamp: now, value: val });
              return val;
            }
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`[fetchFredSeries] FRED fetch notice for ${seriesId}: ${e.message}`);
    }
    return cached?.value ?? null;
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
    let cached = this.candleCache.get(cacheKey);
    const now = Date.now();
    // Adaptive institutional TTLs: short for lower timeframes, extended for HTF to eliminate WS overhead & rate limits
    let ttl = 30000;
    if (resolution === '1') ttl = 10000;
    else if (resolution === '5') ttl = 30000;
    else if (resolution === '15') ttl = 60000;
    else if (resolution === '60') ttl = 300000; // 5m cache for 1H
    else if (resolution === '240') ttl = 900000; // 15m cache for 4H
    else if (resolution === 'D' || resolution === '1D') ttl = 3600000; // 1h cache for Daily
    else if (resolution === 'W' || resolution === '1W') ttl = 14400000; // 4h cache for Weekly

    // If exact nBars key is not in cache, check if a larger dataset for the same symbol & resolution is cached
    if (!cached) {
      for (const [key, val] of this.candleCache.entries()) {
        if (key.startsWith(`${symbol}:${resolution}:`) && val.candles.length >= nBars && (now - val.timestamp < ttl)) {
          if (!cached || val.timestamp > cached.timestamp) {
            cached = val;
          }
        }
      }
    }

    if (cached && now - cached.timestamp < ttl && cached.candles.length >= Math.min(20, nBars)) {
      return cached.candles.slice(-nBars).map(c => ({ ...c }));
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
                      volume: Number(b.v[5] || 0)
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

  public async fetchXauusdCandles(interval: '1min' | '5min' | '15min' | '1h' | '4h' | '1day' | '1week', outputsize = 120): Promise<Candle[]> {
    let resolution = '15';
    if (interval === '1min') resolution = '1';
    else if (interval === '5min') resolution = '5';
    else if (interval === '15min') resolution = '15';
    else if (interval === '1h') resolution = '60';
    else if (interval === '4h') resolution = '240';
    else if (interval === '1day') resolution = 'D';
    else if (interval === '1week') resolution = 'W';

    // 1. Primary institutional source: TradingView WebSocket (Spot Gold OANDA:XAUUSD with real tick volume, then TVC:GOLD)
    const oandaCandles = await this.fetchTradingViewCandles('OANDA:XAUUSD', resolution, outputsize);
    if (oandaCandles.length >= 20) {
      return oandaCandles;
    }

    const tvCandles = await this.fetchTradingViewCandles('TVC:GOLD', resolution, outputsize);
    if (tvCandles.length >= 20) {
      return tvCandles;
    }

    // 2. Secondary source: Twelve Data ONLY if API key exists and quota allows (never synthetic futures)
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
              volume: parseFloat(v.volume || '0'),
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
    const quotes = await this.fetchTradingViewQuotes('cfd', ['OANDA:XAUUSD', 'FOREXCOM:XAUUSD', 'TVC:GOLD', 'FX_IDC:XAUUSD']);
    let bid = 0;
    let ask = 0;
    let spot = latestCandleClose;

    const providers = [quotes['OANDA:XAUUSD'], quotes['FOREXCOM:XAUUSD'], quotes['TVC:GOLD'], quotes['FX_IDC:XAUUSD']].filter(
      q => q && q.price > 1000
    );
    const withBidAsk = providers.find(q => q.bid && q.ask && q.bid > 1000 && q.ask >= q.bid);

    if (withBidAsk && withBidAsk.bid && withBidAsk.ask) {
      bid = parseFloat(withBidAsk.bid.toFixed(2));
      ask = parseFloat(withBidAsk.ask.toFixed(2));
      spot = parseFloat(withBidAsk.price.toFixed(2));
    } else {
      // ZERO DUMMY FALLBACKS: If real bid/ask quotes are missing across all institutional feeds, do NOT synthesize fake spreads!
      const fallbackSpot = providers[0]?.price ? parseFloat(providers[0].price.toFixed(2)) : latestCandleClose;
      return { bid: 0, ask: 0, spread: 0, spot: fallbackSpot, isLiquid: false, reason: 'Live institutional bid/ask quote unavailable' };
    }

    const spread = parseFloat(Math.max(0.01, ask - bid).toFixed(2));
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();

    if (utcDay === 6 || (utcDay === 0 && utcHour < 22) || (utcDay === 5 && utcHour >= 22)) {
      return { bid, ask, spread, spot, isLiquid: false, reason: 'Weekend market closure' };
    }

    if (utcHour === 21 && utcMin >= 50) {
      return { bid, ask, spread, spot, isLiquid: false, reason: 'Daily settlement roll buffer' };
    }

    if (spread > 0.60) {
      return { bid, ask, spread, spot, isLiquid: false, reason: `Excessive institutional spread expansion ($${spread.toFixed(2)} > $0.60)` };
    }

    return { bid, ask, spread, spot, isLiquid: true };
  }

  public async fetchIntermarket(): Promise<IntermarketState> {
    let dxy = 0;
    let dxyChange1h = 0.0;
    let dxyChange24h = 0.0;
    let us10y = 0;
    let us10yChange1h = 0.0;
    let eurusd = 0;
    let silver = 0;
    let oil = 0;
    let us100Change = 0.0;
    let hasDxy1h = false;
    let hasUs10y1h = false;

    try {
      // 1. Fetch TradingView CFD Scanner for institutional macro benchmarks (DXY, Silver)
      const tvQuotes = await this.fetchTradingViewQuotes('cfd', ['TVC:DXY', 'TVC:SILVER']);
      if (tvQuotes['TVC:DXY']?.price) {
        dxy = tvQuotes['TVC:DXY'].price;
        dxyChange24h = parseFloat(tvQuotes['TVC:DXY'].changePct.toFixed(2));
      }
      if (tvQuotes['TVC:SILVER']?.price) {
        silver = tvQuotes['TVC:SILVER'].price;
      }

      // 2. Fetch cross-asset yields and commodities from Yahoo
      const [dxyRes, us10yRes, eurusdRes, silverRes, oilRes, nqRes] = await Promise.allSettled([
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=15m&range=1d', {}, 3000),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=15m&range=1d', {}, 3000),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=15m&range=1d', {}, 3000),
        silver <= 0 ? this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=15m&range=1d', {}, 3000) : Promise.resolve(null as any),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=15m&range=1d', {}, 3000),
        this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=15m&range=1d', {}, 3000)
      ]);

      if (dxyRes.status === 'fulfilled' && dxyRes.value && dxyRes.value.ok) {
        const dxyData = await dxyRes.value.json();
        const meta = dxyData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          dxy = Number(meta.regularMarketPrice);
          const prevClose = Number(meta?.chartPreviousClose || 0);
          if (dxyChange24h === 0 && prevClose > 0) {
            dxyChange24h = parseFloat((((dxy - prevClose) / prevClose) * 100).toFixed(2));
          }
          const rawCloses: any[] = dxyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const validCloses = rawCloses.filter((c: any) => typeof c === 'number' && !isNaN(c) && c > 0);
          if (validCloses.length >= 4) {
            const past4 = validCloses[validCloses.length - 4];
            if (past4 > 0) {
              dxyChange1h = parseFloat((((dxy - past4) / past4) * 100).toFixed(2));
              hasDxy1h = true;
            }
          }
        }
      }

      // If Yahoo DX-Y.NYB 15m chart was unavailable or lacked 4 bars, compute real 1H change from TradingView 15M TVC:DXY candles
      if (!hasDxy1h) {
        const tvDxy15 = await this.fetchTradingViewCandles('TVC:DXY', '15', 24);
        if (tvDxy15.length >= 5) {
          const latestClose = tvDxy15[tvDxy15.length - 1].close;
          const past1hClose = tvDxy15[tvDxy15.length - 5].close;
          if (latestClose > 0 && past1hClose > 0) {
            if (dxy <= 0) dxy = latestClose;
            dxyChange1h = parseFloat((((latestClose - past1hClose) / past1hClose) * 100).toFixed(2));
            hasDxy1h = true;
          }
        }
      }

      if (us10yRes.status === 'fulfilled' && us10yRes.value && us10yRes.value.ok) {
        const yData = await us10yRes.value.json();
        const meta = yData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          us10y = Number(meta.regularMarketPrice);
          const rawCloses: any[] = yData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const validCloses = rawCloses.filter((c: any) => typeof c === 'number' && !isNaN(c) && c > 0);
          if (validCloses.length >= 4) {
            const past4 = validCloses[validCloses.length - 4];
            if (past4 > 0) {
              us10yChange1h = parseFloat((((us10y - past4) / past4) * 100).toFixed(2));
              hasUs10y1h = true;
            }
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
    } catch (e: any) {
      this.logger.warn(`[fetchIntermarket] Macro data fetch warning: ${e.message}`);
    }

    const hasLiveMacro = hasDxy1h && hasUs10y1h;

    // Fetch Live 10-Year Real Yield (DFII10) and Live 10-Year Breakeven Inflation (T10YIE) from St. Louis Fed (FRED)
    const [liveRealYield, liveBreakeven] = await Promise.all([
      this.fetchFredSeries('DFII10'),
      this.fetchFredSeries('T10YIE')
    ]);

    const isRealYieldLive = liveRealYield !== null && liveRealYield > 0;
    const breakevenInflation = liveBreakeven !== null && liveBreakeven > 0 ? liveBreakeven : 2.30;
    const realYieldProxy = isRealYieldLive
      ? liveRealYield!
      : (us10y > 0 ? parseFloat((us10y - breakevenInflation).toFixed(2)) : 0);

    // Calculate Safe-Haven Demand Score (0 - 100) dynamically based on verified macro risk-off flow
    let safeHavenScore = 50;
    if (hasLiveMacro) {
      if (us100Change < -0.75) safeHavenScore += 20;
      else if (us100Change < -0.30) safeHavenScore += 10;
      else if (us100Change > 0.75) safeHavenScore -= 15;

      if (oil > 90) safeHavenScore += 10;
      if (dxyChange1h > 0.15 && us10yChange1h < -0.15) safeHavenScore += 12; // Simultaneous flight to cash and bonds
      else if (dxyChange1h > 0.15 && us10yChange1h > 0.15) safeHavenScore -= 10; // Hawkish tightening flow (bearish gold)
    }

    const safeHavenDemandScore = Math.max(10, Math.min(95, safeHavenScore));

    const riskSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' = 
      us100Change < -0.60 || safeHavenDemandScore >= 75 ? 'RISK_OFF' :
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
      dxyChange24h,
      us10y,
      us10yChange1h,
      realYieldProxy,
      breakevenInflation,
      isRealYieldLive,
      eurusd,
      silver,
      oil,
      us100Change,
      safeHavenDemandScore,
      riskSentiment,
      macroAlignment,
      conflictDetected,
      conflictReason,
      rationale,
      hasLiveMacro
    };
  }

  // Single-flight, in-memory, disk-persisted ForexFactory Economic Calendar Client
  // GUARANTEE: Never fires parallel requests to ForexFactory; caches for 4 hours;
  // loads instantly from disk on reboot; backs off automatically on network failure.
  private async getOrFetchCalendarEvents(): Promise<any[]> {
    const now = Date.now();

    // 1. In-memory cache is valid (within 4 hours) -> zero network requests!
    if (this.cachedCalendarEvents.length > 0 && (now - this.lastCalendarFetchTime) < this.CALENDAR_CACHE_TTL_MS) {
      return this.cachedCalendarEvents;
    }

    // 2. Exponential backoff active after previous network failure -> return cached data without hammering FF!
    if (now < this.nextAllowedCalendarFetchTime && this.cachedCalendarEvents.length > 0) {
      return this.cachedCalendarEvents;
    }

    // 3. Single-flight guarantee: if a request is already running, await that exact same request!
    if (this.inflightCalendarPromise) {
      return this.inflightCalendarPromise;
    }

    // 4. Fire exactly ONE network request
    this.inflightCalendarPromise = (async () => {
      try {
        const res = await this.fetchWithTimeout(
          'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
          {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Cache-Control': 'no-cache',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          },
          7000
        );

        if (res.ok) {
          const fetched = await res.json();
          if (Array.isArray(fetched) && fetched.length > 0) {
            this.cachedCalendarEvents = fetched;
            this.lastCalendarFetchTime = Date.now();
            this.calendarFetchFailureCount = 0;
            this.nextAllowedCalendarFetchTime = 0;
            this.saveCalendarToDisk(fetched);
            this.logger.log(`[NewsGate] Successfully synced ForexFactory calendar (${fetched.length} events). Saved to memory & disk.`);
            return fetched;
          }
        }
        throw new Error(`ForexFactory HTTP status ${res.status}`);
      } catch (err: any) {
        this.calendarFetchFailureCount++;
        const backoffMinutesList = [5, 15, 30, 60];
        const backoffMinutes = backoffMinutesList[Math.min(this.calendarFetchFailureCount - 1, backoffMinutesList.length - 1)];
        this.nextAllowedCalendarFetchTime = Date.now() + backoffMinutes * 60 * 1000;
        this.logger.warn(`[NewsGate] ForexFactory sync notice (${err.message}). Backing off for ${backoffMinutes}m. Using ${this.cachedCalendarEvents.length} cached events.`);
        return this.cachedCalendarEvents;
      } finally {
        this.inflightCalendarPromise = null;
      }
    })();

    return this.inflightCalendarPromise;
  }

  public async fetchEconomicNewsGate(): Promise<NewsGateState> {
    const extremeKeywords = [
      'FOMC', 'POWELL', 'CPI', 'CONSUMER PRICE', 'NFP', 'NON-FARM', 'NONFARM', 'EMPLOYMENT CHANGE',
      'PCE', 'FED RATE', 'FEDERAL FUNDS', 'INTEREST RATE DECISION', 'CORE CPI', 'CORE PCE'
    ];
    const highKeywords = [
      'GDP', 'PPI', 'RETAIL SALES', 'RATE', 'UNEMPLOYMENT RATE', 'INITIAL JOBLESS', 'JOBLESS CLAIMS',
      'ISM MANUFACTURING', 'ISM SERVICES', 'JOLTS'
    ];

    const events = await this.getOrFetchCalendarEvents();
    const nowMs = Date.now();

    // Freshness check: if cached calendar events are older than 24 hours or missing, feed is offline
    const isCalendarFresh = this.lastCalendarFetchTime > 0 && (nowMs - this.lastCalendarFetchTime) <= (24 * 60 * 60 * 1000);
    let calendarFeedResponded = events.length > 0 && isCalendarFresh;

    // 3. Fallback: Finnhub Economic Calendar used ONLY if there is no cached calendar at all
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (this.cachedCalendarEvents.length === 0 && finnhubKey) {
      try {
        const now = new Date();
        const fromDate = now.toISOString().split('T')[0];
        const toDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const res = await this.fetchWithTimeout(
          `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${finnhubKey}`,
          {},
          4500
        );
        if (res.ok) {
          const data = await res.json();
          const finnhubEvents = data?.economicCalendar || [];
          if (Array.isArray(finnhubEvents) && finnhubEvents.length > 0) {
            calendarFeedResponded = true;
            for (const ev of finnhubEvents) {
              if (ev.country !== 'US') continue;
              const titleUpper = (ev.event || '').toUpperCase();
              let impactTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
              if (extremeKeywords.some(kw => titleUpper.includes(kw))) impactTier = 'EXTREME';
              else if (ev.impact === 'high' || highKeywords.some(kw => titleUpper.includes(kw))) impactTier = 'HIGH';
              else if (ev.impact === 'medium') impactTier = 'MEDIUM';

              if (impactTier === 'LOW') continue;

              const evDate = new Date(ev.time).getTime();
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
                  eventTitle: ev.event,
                  impactTier,
                  feedOffline: false
                };
              }
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`[fetchEconomicNewsGate] Finnhub calendar notice: ${e.message}`);
      }
    }

    // 4. Parse events from primary ForexFactory feed
    if (calendarFeedResponded && events.length > 0) {
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
            impactTier,
            feedOffline: false
          };
        }
      }
    }

    return {
      isBlackout: false,
      eventStage: 'NORMAL_MODE',
      minutesToEvent: null,
      eventTitle: null,
      impactTier: 'LOW',
      feedOffline: !calendarFeedResponded
    };
  }

  // -------------------------------------------------------------
  // VOLATILITY & VOLUME PROFILE
  // -------------------------------------------------------------

  public computeVolatilityMetrics(candles15m: Candle[]): VolatilityMetrics {
    if (!candles15m || candles15m.length === 0) {
      return {
        regime: 'NORMAL',
        atr15m: 0,
        atrPercentile: 0,
        realizedVolatility: 0,
        rangeExpansionRatio: 0,
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

  public computeSessionLevels(candles15m: Candle[], completedDaily: Candle[] = [], completedWeekly: Candle[] = []): SessionLevels {
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

    // Zero dummy fallbacks: if Asian session hasn't occurred today, return 0 (never borrow arbitrary trailing bars)
    const ash = asiaCandles.length > 0 ? Math.max(...asiaCandles.map(c => c.high)) : 0;
    const asl = asiaCandles.length > 0 ? Math.min(...asiaCandles.map(c => c.low)) : 0;

    // Genuine London Session High / Low (07:00 - 13:00 UTC)
    const todayLondonCandles = candles15m.filter(c => {
      const d = c.timestamp;
      return d.getUTCFullYear() === todayYear &&
             d.getUTCMonth() === todayMonth &&
             d.getUTCDate() === todayUtcDate &&
             d.getUTCHours() >= 7 && d.getUTCHours() < 13;
    });
    const londonHigh = todayLondonCandles.length > 0 ? Math.max(...todayLondonCandles.map(c => c.high)) : 0;
    const londonLow = todayLondonCandles.length > 0 ? Math.min(...todayLondonCandles.map(c => c.low)) : 0;

    const prevDayCandles = candles15m.filter(c => {
      const d = c.timestamp;
      return d.getUTCDate() !== todayUtcDate || d.getUTCMonth() !== todayMonth;
    }).slice(-96);

    let pdh = 0;
    let pdl = 0;
    if (completedDaily && completedDaily.length > 0) {
      const prevDailyBar = completedDaily[completedDaily.length - 1];
      pdh = prevDailyBar.high;
      pdl = prevDailyBar.low;
    } else if (prevDayCandles.length > 0) {
      pdh = Math.max(...prevDayCandles.map(c => c.high));
      pdl = Math.min(...prevDayCandles.map(c => c.low));
    } else if (candles15m.length > 0) {
      const olderCandles = candles15m.slice(0, Math.max(1, candles15m.length - 24));
      pdh = Math.max(...olderCandles.map(c => c.high));
      pdl = Math.min(...olderCandles.map(c => c.low));
    }

    let pwh = pdh;
    let pwl = pdl;
    if (completedWeekly && completedWeekly.length > 0) {
      const prevWeeklyBar = completedWeekly[completedWeekly.length - 1];
      pwh = prevWeeklyBar.high;
      pwl = prevWeeklyBar.low;
    } else if (candles15m.length > 0) {
      pwh = Math.max(...candles15m.slice(0, Math.max(1, candles15m.length - 20)).map(c => c.high));
      pwl = Math.min(...candles15m.slice(0, Math.max(1, candles15m.length - 20)).map(c => c.low));
    }

    const sessionCandles = candles15m.filter(c => {
      const d = c.timestamp;
      const isToday = d.getUTCFullYear() === todayYear &&
                     d.getUTCMonth() === todayMonth &&
                     d.getUTCDate() === todayUtcDate;
      if (!isToday) return false;
      if (session === 'ASIA') return d.getUTCHours() >= 0 && d.getUTCHours() < 7;
      if (session === 'LONDON') return d.getUTCHours() >= 7 && d.getUTCHours() < 13;
      if (session === 'NEW_YORK') return d.getUTCHours() >= 13 && d.getUTCHours() < 21;
      return d.getUTCHours() >= 21;
    });

    const sessionVwap = this.calcVWAP(sessionCandles.length >= 4 ? sessionCandles : candles15m.slice(-20));
    const anchoredVwapAsia = this.calcVWAP(asiaCandles.length >= 2 ? asiaCandles : candles15m.slice(-28));

    return { session, pdh, pdl, pwh, pwl, ash, asl, londonHigh, londonLow, sessionVwap, anchoredVwapAsia };
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
        confluenceFactors: ['Consolidating Range Equilibrium'],
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
    let weightedSum = 0;
    let totalW = 0;
    bestCluster.forEach(c => {
      weightedSum += c.price * c.weight;
      totalW += c.weight;
    });
    const preferredEntry = parseFloat((weightedSum / Math.max(1, totalW)).toFixed(2));
    const minHalfBand = Math.max(0.65, parseFloat((atr15m * 0.18).toFixed(2)));
    const zoneLow = parseFloat(Math.min(Math.min(...prices), preferredEntry - minHalfBand).toFixed(2));
    const zoneHigh = parseFloat(Math.max(Math.max(...prices), preferredEntry + minHalfBand).toFixed(2));
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
    candles1m: Candle[] = [],
    candles1day: Candle[] = [],
    candles1week: Candle[] = [],
    activeSignals: any[] = []
  ): XauusdInstitutionalSetup {
    const len15 = candles15m.length;
    const rawCandleClose = candles15m[len15 - 1]?.close || 0;
    const close1m = candles1m.length > 0 ? candles1m[candles1m.length - 1]?.close : 0;
    const tvSpotPrice = (microstructure.spot && microstructure.spot > 1000)
      ? parseFloat(microstructure.spot.toFixed(2))
      : microstructure.bid
        ? parseFloat(microstructure.bid.toFixed(2))
        : (close1m > 1000 ? close1m : rawCandleClose);

    let currentPrice = rawCandleClose;
    if (tvSpotPrice > 1000 && rawCandleClose > 1000 && Math.abs(rawCandleClose - tvSpotPrice) / rawCandleClose <= 0.004) {
      currentPrice = parseFloat(tvSpotPrice.toFixed(2));
    }

    // -------------------------------------------------------------
    // COMPLETED CANDLES vs LIVE SPOT SEPARATION (Quality over Frequency)
    // All technical indicators (EMAs, MACD, RSI, ADX, Bollinger Bands),
    // market structure (swings, BOS/CHoCH, Order Blocks, FVGs, sweeps)
    // are calculated STRICTLY on COMPLETED (closed) candles.
    // The live tick/spot is used ONLY for real-time spread, liquidity & fills.
    // -------------------------------------------------------------
    const completed15m = candles15m.length > 1 ? candles15m.slice(0, -1) : candles15m;
    const completed1h = candles1h.length > 1 ? candles1h.slice(0, -1) : candles1h;
    const completed4h = candles4h && candles4h.length > 1 ? candles4h.slice(0, -1) : (candles4h || []);
    const completed5m = candles5m && candles5m.length > 1 ? candles5m.slice(0, -1) : (candles5m || []);
    const completedDaily = candles1day && candles1day.length > 1 ? candles1day.slice(0, -1) : (candles1day || []);
    const completedWeekly = candles1week && candles1week.length > 1 ? candles1week.slice(0, -1) : (candles1week || []);

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

      if (tvSpotPrice > 1000 && rawCandleClose > 1000) {
        const deltaPct = Math.abs(rawCandleClose - tvSpotPrice) / rawCandleClose * 100;
        if (deltaPct > 0.40) {
          gate1Passed = false;
          gate1Score = 20;
          gate1Code = 'PRICE_CONFLICT';
          gate1Reason = `TradingView Candle ($${rawCandleClose.toFixed(2)}) vs Live Scanner ($${tvSpotPrice.toFixed(2)}) delta: ${deltaPct.toFixed(2)}% exceeds allowed 0.40% tolerance.`;
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

    // Analytical models across memory layers (15M, 1H, 4H, Daily, Weekly) strictly on completed candles
    const volMetrics = this.computeVolatilityMetrics(completed15m);
    const sessionLevels = this.computeSessionLevels(completed15m, completedDaily, completedWeekly);
    const volumeProfile = this.computeVolumeProfile(completed15m);
    const swings15 = this.detectFractalSwings(completed15m);
    const swings1h = this.detectFractalSwings(completed1h);
    const swings4h = completed4h && completed4h.length >= 10 ? this.detectFractalSwings(completed4h) : [];
    const obs15 = this.detectOrderBlocks(completed15m, volMetrics.atr15m);
    const obs1h = completed1h && completed1h.length >= 10 ? this.detectOrderBlocks(completed1h, volMetrics.atr15m * 1.8) : [];
    const fvgs15 = this.detectFairValueGaps(completed15m, volMetrics.atr15m);

    // Classical Technical Indicators on completed 15M candles
    const closes15 = completed15m.map(c => c.close);
    const ema20 = this.calcEMA(closes15, 20);
    const ema50 = this.calcEMA(closes15, 50);
    const ema100 = this.calcEMA(closes15, 100);
    const ema200 = this.calcEMA(closes15, 200);
    const rsi14 = this.calcRSI(closes15, 14);
    const rsiDiv = this.detectRsiDivergence(closes15, swings15);
    const macd = this.calcMACD(closes15);
    const adx14 = this.calcADX(completed15m, 14);
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
      { name: 'London High (LNH)', price: sessionLevels.londonHigh },
      { name: 'London Low (LNL)', price: sessionLevels.londonLow },
      { name: 'Previous Day High (PDH)', price: sessionLevels.pdh },
      { name: 'Previous Day Low (PDL)', price: sessionLevels.pdl }
    ].filter(l => l.price > 0);
    swings15.filter(s => s.type === 'HIGH').slice(-3).forEach(s => keyLevels.push({ name: `15M Swing High ($${s.price.toFixed(1)})`, price: s.price }));
    swings15.filter(s => s.type === 'LOW').slice(-3).forEach(s => keyLevels.push({ name: `15M Swing Low ($${s.price.toFixed(1)})`, price: s.price }));
    swings1h.filter(s => s.type === 'HIGH').slice(-2).forEach(s => keyLevels.push({ name: `1H Swing High ($${s.price.toFixed(1)})`, price: s.price }));
    swings1h.filter(s => s.type === 'LOW').slice(-2).forEach(s => keyLevels.push({ name: `1H Swing Low ($${s.price.toFixed(1)})`, price: s.price }));
    const sweeps = this.detectAdaptiveLiquiditySweeps(completed15m, keyLevels, volMetrics.atr15m);

    // Event-driven candle importance weighting on completed candles (strictly includes verified sweeps)
    const eventWeights = this.computeEventDrivenWeights(completed15m, sweeps, swings15, obs15, fvgs15);

    // 1H Trend (Primary Structure via Swings on completed 1H candles)
    let htfTrend: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    if (swings1h.length >= 4) {
      const last2Highs = swings1h.filter(s => s.type === 'HIGH').slice(-2);
      const last2Lows = swings1h.filter(s => s.type === 'LOW').slice(-2);
      if (last2Highs.length === 2 && last2Lows.length === 2) {
        if (last2Highs[1].price > last2Highs[0].price && last2Lows[1].price > last2Lows[0].price) htfTrend = 'BULLISH';
        else if (last2Highs[1].price < last2Highs[0].price && last2Lows[1].price < last2Lows[0].price) htfTrend = 'BEARISH';
      }
    }

    // 4H Trend (Structural Memory Environment via Dual EMA on completed 4H candles)
    let trend4h: 'BULLISH' | 'BEARISH' | 'RANGING' = htfTrend;
    if (completed4h && completed4h.length >= 20) {
      const closes4h = completed4h.map(c => c.close);
      const ema20_4h = this.calcEMA(closes4h, 20);
      const ema50_4h = this.calcEMA(closes4h, 50);
      const lastClose4h = closes4h[closes4h.length - 1];
      if (lastClose4h > ema20_4h && ema20_4h > ema50_4h) trend4h = 'BULLISH';
      else if (lastClose4h < ema20_4h && ema20_4h < ema50_4h) trend4h = 'BEARISH';
      else trend4h = 'RANGING';
    }

    // Daily Macro Trend (Stage 1: D1 Context)
    let trendDaily: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    if (completedDaily && completedDaily.length >= 20) {
      const closesDaily = completedDaily.map(c => c.close);
      const ema20Daily = this.calcEMA(closesDaily, 20);
      const ema50Daily = this.calcEMA(closesDaily, 50);
      const lastDailyClose = closesDaily[closesDaily.length - 1];
      if (lastDailyClose > ema20Daily && ema20Daily > ema50Daily) trendDaily = 'BULLISH';
      else if (lastDailyClose < ema20Daily && ema20Daily < ema50Daily) trendDaily = 'BEARISH';
      else trendDaily = 'RANGING';
    }

    // Weekly Macro Trend (Stage 1: W1 Context)
    let trendWeekly: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    if (completedWeekly && completedWeekly.length >= 10) {
      const closesWeekly = completedWeekly.map(c => c.close);
      const ema20Weekly = this.calcEMA(closesWeekly, 20);
      const lastWeeklyClose = closesWeekly[closesWeekly.length - 1];
      if (lastWeeklyClose > ema20Weekly) trendWeekly = 'BULLISH';
      else if (lastWeeklyClose < ema20Weekly) trendWeekly = 'BEARISH';
      else trendWeekly = 'RANGING';
    }

    let marketRegime: MarketRegimeType = 'EXPANSION_RANGE';
    if (newsGate.isBlackout && newsGate.eventStage === 'EVENT_SHOCK') marketRegime = 'NEWS_SHOCK';
    else if (volMetrics.regime === 'EXTREME') marketRegime = 'VOLATILITY_EXPANSION';
    else if (htfTrend === 'BULLISH' && trend4h === 'BULLISH') marketRegime = 'STRONG_BULL_TREND';
    else if (htfTrend === 'BEARISH' && trend4h === 'BEARISH') marketRegime = 'STRONG_BEAR_TREND';
    else if (volMetrics.regime === 'LOW') marketRegime = 'COMPRESSION_RANGE';

    // Stage 1: Market Context Key S/R & Liquidity Proximity (Approaching Decision Area Flag)
    const majorHtfLevels = [
      { name: 'PWH', price: sessionLevels.pwh },
      { name: 'PWL', price: sessionLevels.pwl },
      { name: 'PDH', price: sessionLevels.pdh },
      { name: 'PDL', price: sessionLevels.pdl },
      ...swings4h.map(s => ({ name: `4H Swing ${s.type}`, price: s.price }))
    ].filter(l => l.price > 1000);

    const nearestDecisionLevel = majorHtfLevels.length > 0
      ? majorHtfLevels
          .map(l => ({ ...l, dist: Math.abs(currentPrice - l.price) }))
          .sort((a, b) => a.dist - b.dist)[0]
      : null;

    const approachingDecisionArea = !!nearestDecisionLevel && nearestDecisionLevel.dist <= (0.50 * volMetrics.atr15m);
    const decisionAreaDetails = approachingDecisionArea
      ? `Approaching key decision area: spot is within $${nearestDecisionLevel!.dist.toFixed(2)} of ${nearestDecisionLevel!.name} ($${nearestDecisionLevel!.price.toFixed(2)})`
      : `Clear operational zone: nearest major HTF decision level is ${nearestDecisionLevel?.name || 'none'} ($${nearestDecisionLevel ? nearestDecisionLevel.dist.toFixed(2) : '0'} away)`;

    // =========================================================
    // GATE 2 — MARKET ENVIRONMENT GATE
    // =========================================================
    let gate2Passed = true;
    let gate2Score = 90;
    let gate2Code = 'MARKET_HEALTHY';
    let gate2Reason = 'Active session with tight institutional spread and normal volatility.';

    if (!microstructure.isLiquid) {
      gate2Passed = false;
      gate2Score = 0;
      gate2Code = 'MICROSTRUCTURE_HALT';
      gate2Reason = microstructure.reason || 'Spread expanded beyond $0.60 institutional threshold or rollover halt.';
    } else if (newsGate.feedOffline) {
      gate2Passed = false;
      gate2Score = 15;
      gate2Code = 'NEWS_FEED_OFFLINE';
      gate2Reason = 'Fail-Closed Safety: Economic calendar feed is currently unreachable or stale. Trading halted to prevent news slippage on high-impact USD events.';
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
    } else {
      const spreadPenalty = Math.max(0, Math.round((microstructure.spread - 0.25) * 20));
      const volBonus = volMetrics.regime === 'NORMAL' ? 10 : volMetrics.regime === 'HIGH' ? 5 : 0;
      gate2Score = Math.max(50, Math.min(98, 90 - spreadPenalty + volBonus));
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
        volatilityRegime: volMetrics.regime,
        approachingDecisionArea,
        decisionAreaDetails
      }
    };

    // =========================================================
    // GATE 3 — SETUP STATISTICAL PROBABILITY & CONFLICT GATE
    // =========================================================
    // True latest sweeps (most recent candle index in window)
    const latestBullishSweep = sweeps.filter(s => s.direction === 'BULLISH').slice(-1)[0];
    const latestBearishSweep = sweeps.filter(s => s.direction === 'BEARISH').slice(-1)[0];

    // Pre-calculate 5M Tactical Market Structure Shift (MSS) strictly on COMPLETED 5M candles
    let mss5mBuy = false;
    let mss5mSell = false;
    if (completed5m && completed5m.length >= 10) {
      const swings5m = this.detectFractalSwings(completed5m);
      const lastSwingHigh5m = swings5m.filter(s => s.type === 'HIGH').slice(-1)[0];
      const lastSwingLow5m = swings5m.filter(s => s.type === 'LOW').slice(-1)[0];
      const recentClosed5m = completed5m.slice(-3);

      if (lastSwingHigh5m) {
        mss5mBuy = recentClosed5m.some(
          c => c.close > lastSwingHigh5m.price && c.close > c.open && (c.close - c.open) >= 0.35 * (c.high - c.low)
        );
      }
      if (lastSwingLow5m) {
        mss5mSell = recentClosed5m.some(
          c => c.close < lastSwingLow5m.price && c.close < c.open && (c.open - c.close) >= 0.35 * (c.high - c.low)
        );
      }
    }

    // 15M Closed-Candle Break of Structure (BOS) / Change of Character (CHoCH)
    let bos15mBuy = false;
    let bos15mSell = false;
    const lastSwingHigh15 = swings15.filter(s => s.type === 'HIGH').slice(-1)[0];
    const lastSwingLow15 = swings15.filter(s => s.type === 'LOW').slice(-1)[0];
    const recentClosed15m = completed15m.slice(-3);
    if (lastSwingHigh15) {
      bos15mBuy = recentClosed15m.some(c => c.close > lastSwingHigh15.price && c.close > c.open);
    }
    if (lastSwingLow15) {
      bos15mSell = recentClosed15m.some(c => c.close < lastSwingLow15.price && c.close < c.open);
    }

    const activeBullishObs = obs15.filter(o => o.type === 'BULLISH' && !o.mitigated).slice(-2);
    const activeBearishObs = obs15.filter(o => o.type === 'BEARISH' && !o.mitigated).slice(-2);
    const activeBullishFvgs = fvgs15.filter(f => f.type === 'BULLISH' && !f.mitigated).slice(-2);
    const activeBearishFvgs = fvgs15.filter(f => f.type === 'BEARISH' && !f.mitigated).slice(-2);

    // Symmetrical Institutional Evidence Engine (0 - 100)
    let bullEvidence = 0;
    let bearEvidence = 0;

    // 1. Local Range Position: Premium vs Discount (Smart Money Concept)
    const recentCandleHigh15 = completed15m.length > 0 ? Math.max(...completed15m.slice(-24).map(c => c.high)) : currentPrice;
    const recentCandleLow15 = completed15m.length > 0 ? Math.min(...completed15m.slice(-24).map(c => c.low)) : currentPrice;
    const recentHighs15 = swings15.filter(s => s.type === 'HIGH').slice(-3).map(s => s.price);
    const recentLows15 = swings15.filter(s => s.type === 'LOW').slice(-3).map(s => s.price);
    const localRangeHigh = recentHighs15.length > 0 ? Math.max(...recentHighs15) : (sessionLevels.ash > 0 ? sessionLevels.ash : recentCandleHigh15);
    const localRangeLow = recentLows15.length > 0 ? Math.min(...recentLows15) : (sessionLevels.asl > 0 ? sessionLevels.asl : recentCandleLow15);
    const localRangeSpan = Math.max(1.0, localRangeHigh - localRangeLow);
    const localLocationPct = ((currentPrice - localRangeLow) / localRangeSpan) * 100;

    // 15M Swing Structure (Higher Highs / Higher Lows vs Lower Highs / Lower Lows)
    let trend15m: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    const last2Highs15 = swings15.filter(s => s.type === 'HIGH').slice(-2);
    const last2Lows15 = swings15.filter(s => s.type === 'LOW').slice(-2);
    if (last2Highs15.length === 2 && last2Lows15.length === 2) {
      if (last2Highs15[1].price < last2Highs15[0].price && (last2Lows15[1].price <= last2Lows15[0].price || currentPrice < ema20)) {
        trend15m = 'BEARISH';
      } else if (last2Highs15[1].price > last2Highs15[0].price && (last2Lows15[1].price >= last2Lows15[0].price || currentPrice > ema20)) {
        trend15m = 'BULLISH';
      } else if (currentPrice < last2Lows15[1].price) {
        trend15m = 'BEARISH';
      } else if (currentPrice > last2Highs15[1].price) {
        trend15m = 'BULLISH';
      }
    } else if (currentPrice < ema20 && ema20 < ema50) {
      trend15m = 'BEARISH';
    } else if (currentPrice > ema20 && ema20 > ema50) {
      trend15m = 'BULLISH';
    }

    // Detect if a verified institutional liquidity sweep + structural confirmation indicates trend exhaustion/reversal
    const isBullishReversalContext = !!latestBullishSweep && latestBullishSweep.qualityScore >= 70 && (mss5mBuy || bos15mBuy || rsiDiv === 'BULLISH_DIVERGENCE');
    const isBearishReversalContext = !!latestBearishSweep && latestBearishSweep.qualityScore >= 70 && (mss5mSell || bos15mSell || rsiDiv === 'BEARISH_DIVERGENCE');

    // 2. 4H Macro Structure (Background context — max 10 pts)
    if (trend4h === 'BULLISH') {
      bullEvidence += isBearishReversalContext ? 3 : 10;
    } else if (trend4h === 'BEARISH') {
      bearEvidence += isBullishReversalContext ? 3 : 10;
    } else {
      bullEvidence += 4;
      bearEvidence += 4;
    }

    // 3. 1H Primary Structure (Intermediate context — max 14 pts)
    if (htfTrend === 'BULLISH') {
      bullEvidence += isBearishReversalContext ? 4 : 14;
    } else if (htfTrend === 'BEARISH') {
      bearEvidence += isBullishReversalContext ? 4 : 14;
    } else {
      bullEvidence += 5;
      bearEvidence += 5;
    }

    // 3.5. 15M Tactical Structure & EMA/MACD Momentum (Primary Execution Horizon — up to 24 pts)
    if (trend15m === 'BULLISH') bullEvidence += 14;
    else if (trend15m === 'BEARISH') bearEvidence += 14;

    if (currentPrice < ema20) {
      bearEvidence += 8;
      if (ema20 < ema50) bearEvidence += 6;
    } else if (currentPrice > ema20) {
      bullEvidence += 8;
      if (ema20 > ema50) bullEvidence += 6;
    }

    if (macd.histogram < 0) bearEvidence += 6;
    else if (macd.histogram > 0) bullEvidence += 6;

    // 4. Actionable Execution Triggers (Sweeps, MSS/BOS, Price Retesting Active OB/FVG, or EMA20-50 Pullbacks)
    const isBullTrend = trend15m === 'BULLISH' || (htfTrend === 'BULLISH' && currentPrice >= ema50) || (ema20 > ema50 && currentPrice >= ema50);
    const isBearTrend = trend15m === 'BEARISH' || (htfTrend === 'BEARISH' && currentPrice <= ema50) || (ema20 < ema50 && currentPrice <= ema50) || (currentPrice < ema20 && currentPrice < sessionLevels.sessionVwap);

    // Pullbacks must be genuine retracements into the EMA20-EMA50 zone in the direction of the 15M/1H trend
    const isBullPullback = isBullTrend && currentPrice >= ema50 - 0.35 * volMetrics.atr15m && currentPrice <= ema20 + 0.45 * volMetrics.atr15m && trend15m !== 'BEARISH';
    const isBearPullback = isBearTrend && currentPrice <= ema50 + 0.35 * volMetrics.atr15m && currentPrice >= ema20 - 0.45 * volMetrics.atr15m && trend15m !== 'BULLISH';

    const priceNearBullObOrFvg =
      activeBullishObs.some(o => currentPrice >= o.low - 0.35 * volMetrics.atr15m && currentPrice <= o.high + 0.60 * volMetrics.atr15m) ||
      activeBullishFvgs.some(f => currentPrice >= f.bottom - 0.35 * volMetrics.atr15m && currentPrice <= f.top + 0.60 * volMetrics.atr15m);
    const priceNearBearObOrFvg =
      activeBearishObs.some(o => currentPrice >= o.low - 0.60 * volMetrics.atr15m && currentPrice <= o.high + 0.35 * volMetrics.atr15m) ||
      activeBearishFvgs.some(f => currentPrice >= f.bottom - 0.60 * volMetrics.atr15m && currentPrice <= f.top + 0.35 * volMetrics.atr15m);

    // Multi-Timeframe Trend Continuation Detection (15M aligned with 1H or 4H structure)
    const isBullContinuation =
      isBullTrend &&
      (htfTrend === 'BULLISH' || trend4h === 'BULLISH') &&
      (bos15mBuy || isBullPullback || priceNearBullObOrFvg || mss5mBuy);
    const isBearContinuation =
      isBearTrend &&
      (htfTrend === 'BEARISH' || trend4h === 'BEARISH') &&
      (bos15mSell || isBearPullback || priceNearBearObOrFvg || mss5mSell);

    // Strict Trigger Requirement: must have an actual institutional catalyst (Continuation OR Reversal)
    const hasBullishTrigger =
      isBullContinuation ||
      !!latestBullishSweep ||
      mss5mBuy ||
      bos15mBuy ||
      isBullPullback ||
      (priceNearBullObOrFvg && trend15m !== 'BEARISH') ||
      rsiDiv === 'BULLISH_DIVERGENCE';
    const hasBearishTrigger =
      isBearContinuation ||
      !!latestBearishSweep ||
      mss5mSell ||
      bos15mSell ||
      isBearPullback ||
      (priceNearBearObOrFvg && trend15m !== 'BULLISH') ||
      rsiDiv === 'BEARISH_DIVERGENCE';

    if (isBullPullback) bullEvidence += 12;
    if (isBearPullback) bearEvidence += 12;
    if (bos15mBuy) bullEvidence += 10;
    if (bos15mSell) bearEvidence += 10;
    if (isBullContinuation) bullEvidence += 14;
    if (isBearContinuation) bearEvidence += 14;

    // Compare recency of Bullish vs Bearish Liquidity Sweeps so an older sweep never cancels a newer opposite sweep
    const bullSweepIdx = latestBullishSweep ? latestBullishSweep.candleIndex : -1;
    const bearSweepIdx = latestBearishSweep ? latestBearishSweep.candleIndex : -1;

    if (latestBullishSweep && bullSweepIdx >= bearSweepIdx) {
      const sweepPts = Math.min(26, Math.round(latestBullishSweep.qualityScore * 0.28));
      bullEvidence += sweepPts;
      if (mss5mBuy) bullEvidence += 14;
    } else if (latestBullishSweep) {
      bullEvidence += 8;
    }

    if (latestBearishSweep && bearSweepIdx >= bullSweepIdx) {
      const sweepPts = Math.min(26, Math.round(latestBearishSweep.qualityScore * 0.28));
      bearEvidence += sweepPts;
      if (mss5mSell) bearEvidence += 14;
    } else if (latestBearishSweep) {
      bearEvidence += 8;
    }

    if (activeBullishObs.length > 0) bullEvidence += priceNearBullObOrFvg ? 12 : 6;
    if (activeBearishObs.length > 0) bearEvidence += priceNearBearObOrFvg ? 12 : 6;
    if (activeBullishFvgs.length > 0) bullEvidence += priceNearBullObOrFvg ? 8 : 4;
    if (activeBearishFvgs.length > 0) bearEvidence += priceNearBearObOrFvg ? 8 : 4;

    if (currentPrice > sessionLevels.sessionVwap) bullEvidence += 5;
    else if (currentPrice < sessionLevels.sessionVwap) bearEvidence += 5;

    // 5. Value Area / Location Edge (Discount favors accumulation ONLY when not in a strong bearish breakdown; Premium favors distribution ONLY when not in a strong bullish breakout)
    const isStrongBearBreakdown = isBearTrend && adx14 >= 25 && !isBullishReversalContext;
    const isStrongBullBreakout = isBullTrend && adx14 >= 25 && !isBearishReversalContext;

    if (localLocationPct <= 35 && !isStrongBearBreakdown) {
      bullEvidence += 12;
      if (!isBearTrend || isBullishReversalContext) {
        bearEvidence -= 12;
      }
    } else if (localLocationPct >= 65 && !isStrongBullBreakout) {
      bearEvidence += 12;
      if (!isBullTrend || isBearishReversalContext) {
        bullEvidence -= 12;
      }
    }

    // 6. Immediate Candlestick Displacement & Rejection Check (on completed 15M bar)
    const lastCandle15 = completed15m[completed15m.length - 1];
    if (lastCandle15) {
      const lastBody = Math.abs(lastCandle15.close - lastCandle15.open);
      const lastRange = Math.max(0.1, lastCandle15.high - lastCandle15.low);
      const isBearDisplacement = lastCandle15.close < lastCandle15.open && (lastBody / lastRange) > 0.50 && lastBody > 0.45 * volMetrics.atr15m;
      const isBullDisplacement = lastCandle15.close > lastCandle15.open && (lastBody / lastRange) > 0.50 && lastBody > 0.45 * volMetrics.atr15m;

      if (isBearDisplacement) {
        bullEvidence -= 16;
        bearEvidence += 14;
      }
      if (isBullDisplacement) {
        bearEvidence -= 16;
        bullEvidence += 14;
      }
    }

    // 7. RSI Overextension & Divergences:
    // Do NOT penalize trend continuation when ADX >= 25 unless an opposing RSI divergence or verified reversal sweep is present!
    if (rsi14 >= 68 && (!isBullContinuation || rsiDiv === 'BEARISH_DIVERGENCE' || isBearishReversalContext)) {
      bullEvidence -= 14;
      bearEvidence += 12;
    } else if (rsi14 <= 32 && (!isBearContinuation || rsiDiv === 'BULLISH_DIVERGENCE' || isBullishReversalContext)) {
      bearEvidence -= 14;
      bullEvidence += 12;
    }

    if (rsiDiv === 'BULLISH_DIVERGENCE') {
      bullEvidence += 16;
      bearEvidence -= 14;
    }
    if (rsiDiv === 'BEARISH_DIVERGENCE') {
      bearEvidence += 16;
      bullEvidence -= 14;
    }

    // 8. Intermarket Macro Alignment (Award points only if real live macro data exists)
    if (intermarket.hasLiveMacro) {
      if (intermarket.macroAlignment === 'BULLISH') bullEvidence += 12;
      else if (intermarket.macroAlignment === 'BEARISH') bearEvidence += 12;
      else if (intermarket.macroAlignment === 'SAFE_HAVEN_DECOUPLING') bullEvidence += 8;
      else { bullEvidence += 4; bearEvidence += 4; }
    }

    // 8.5. Top-Down Macro Context Alignment (W1 + D1 Higher Timeframe Confirmation)
    if (trendWeekly === 'BULLISH' && trendDaily === 'BULLISH') {
      bullEvidence += 8;
    } else if (trendWeekly === 'BEARISH' && trendDaily === 'BEARISH') {
      bearEvidence += 8;
    } else {
      bullEvidence += 3;
      bearEvidence += 3;
    }

    // Clamp scores
    bullEvidence = Math.max(0, Math.min(100, bullEvidence));
    bearEvidence = Math.max(0, Math.min(100, bearEvidence));

    // Symmetrical Direction Stability Filter (Quality over Frequency)
    // Requires minimum score of 58, an evidence margin of at least 15 points, AND an active trigger
    let bias: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
    let counterTrendBlockedReason: string | null = null;

    // Stage 2: Directional Bias (4H -> 1H Multi-Timeframe Alignment)
    // Part D Rule: If 4H and 1H trends are in conflict or ranging without an active range-deviation model,
    // the directional bias must be strictly NEUTRAL / NO_TRADE.
    const isRangeDeviationEligible = (localLocationPct <= 28 && (mss5mBuy || !!latestBullishSweep)) || (localLocationPct >= 72 && (mss5mSell || !!latestBearishSweep));
    const bothRanging = htfTrend === 'RANGING' && trend4h === 'RANGING';
    const htfConflicted = (htfTrend === 'BULLISH' && trend4h === 'BEARISH') || (htfTrend === 'BEARISH' && trend4h === 'BULLISH');

    if (bearEvidence >= 58 && (bearEvidence - bullEvidence) >= 15 && hasBearishTrigger) {
      // HTF Counter-Trend Protection: If both 1H and 4H are BULLISH, do not short unless verified sweep + (5M MSS / 15M BOS / Bearish Divergence)
      if (htfTrend === 'BULLISH' && trend4h === 'BULLISH' && !isBearishReversalContext) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Counter-trend SELL blocked: 1H and 4H structure are aligned BULLISH without a verified high-grade liquidity sweep + CHoCH/MSS reversal.';
      } else if (bothRanging && !isRangeDeviationEligible) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Directional Bias Neutral: 4H and 1H are in equilibrium range-bound chop without an active range-deviation or sweep reclaim.';
      } else if (htfConflicted && trend4h === 'BULLISH' && !isBearishReversalContext && !(localLocationPct >= 70 && mss5mSell)) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Conflicting Multi-Timeframe Bias: 1H Bearish vs 4H Bullish trend conflict without verified institutional reversal sweep + MSS.';
      } else {
        bias = 'SELL';
      }
    } else if (bullEvidence >= 58 && (bullEvidence - bearEvidence) >= 15 && hasBullishTrigger) {
      // HTF Counter-Trend Protection: If both 1H and 4H are BEARISH, do not buy unless verified sweep + (5M MSS / 15M BOS / Bullish Divergence)
      if (htfTrend === 'BEARISH' && trend4h === 'BEARISH' && !isBullishReversalContext) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Counter-trend BUY blocked: 1H and 4H structure are aligned BEARISH without a verified high-grade liquidity sweep + CHoCH/MSS reversal.';
      } else if (bothRanging && !isRangeDeviationEligible) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Directional Bias Neutral: 4H and 1H are in equilibrium range-bound chop without an active range-deviation or sweep reclaim.';
      } else if (htfConflicted && trend4h === 'BEARISH' && !isBullishReversalContext && !(localLocationPct <= 30 && mss5mBuy)) {
        bias = 'NO_TRADE';
        counterTrendBlockedReason = 'Conflicting Multi-Timeframe Bias: 1H Bullish vs 4H Bearish trend conflict without verified institutional reversal sweep + MSS.';
      } else {
        bias = 'BUY';
      }
    } else {
      bias = 'NO_TRADE';
    }

    const structuralDirection: 'BUY' | 'SELL' = bias !== 'NO_TRADE' ? bias : (bearEvidence > bullEvidence ? 'SELL' : 'BUY');

    let gate3Passed = true;
    let gate3Score = 75;
    let gate3Code = 'SETUP_VALID';
    let gate3Reason = 'Statistical setup matches market regime with directional edge.';

    if (bias === 'BUY') {
      gate3Score = Math.min(96, Math.max(70, bullEvidence));
      if (intermarket.conflictDetected && bullEvidence < 78) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'MACRO_TECHNICAL_CONFLICT';
        gate3Reason = `Technical long vetoed by Macro Conflict: ${intermarket.conflictReason || 'Surging USD and Yields oppose gold'}`;
      }
    } else if (bias === 'SELL') {
      gate3Score = Math.min(96, Math.max(70, bearEvidence));
      if (intermarket.safeHavenDemandScore >= 88 && intermarket.macroAlignment === 'BULLISH' && bearEvidence < 78) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'MACRO_TECHNICAL_CONFLICT';
        gate3Reason = `Technical short vetoed: Extreme Safe-Haven Demand (Score: ${intermarket.safeHavenDemandScore}) creates upward breakout risk.`;
      }
    } else {
      gate3Passed = false;
      gate3Score = Math.max(bullEvidence, bearEvidence);
      gate3Code = counterTrendBlockedReason ? 'HTF_COUNTER_TREND_BLOCKED' : 'NO_DIRECTIONAL_BIAS';
      gate3Reason = counterTrendBlockedReason
        ? counterTrendBlockedReason
        : (!hasBullishTrigger && !hasBearishTrigger
          ? `No actionable institutional trigger (Awaiting liquidity sweep, MSS/BOS, or order block retest).`
          : `Market structure is neutral/balanced without sufficient statistical edge (Bull: ${bullEvidence} vs Bear: ${bearEvidence}).`);
    }

    const gate3: GateCheck = {
      gateId: 'GATE_3_SETUP',
      passed: gate3Passed,
      score: gate3Score,
      code: gate3Code,
      reason: gate3Reason,
      telemetry: {
        bias,
        structuralDirection,
        bullEvidence,
        bearEvidence,
        trend15m,
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
    const swingLow = swings15.filter(s => s.type === 'LOW').slice(-1)[0]?.price || (sessionLevels.asl > 0 ? sessionLevels.asl : recentCandleLow15);
    const swingHigh = swings15.filter(s => s.type === 'HIGH').slice(-1)[0]?.price || (sessionLevels.ash > 0 ? sessionLevels.ash : recentCandleHigh15);
    const rangeHigh = Math.max(swingHigh, currentPrice);
    const rangeLow = Math.min(swingLow, currentPrice);
    const dealingSpan = Math.max(volMetrics.atr15m * 1.2, rangeHigh - rangeLow);
    const equilibrium = parseFloat(((rangeLow + rangeHigh) / 2).toFixed(2));
    const maxCandidateDist = 2.6 * volMetrics.atr15m;

    if (structuralDirection === 'BUY') {
      const maxBuyLevel = currentPrice + 0.05 * volMetrics.atr15m;
      const minBuyLevel = currentPrice - maxCandidateDist;

      activeBullishObs
        .filter(ob => ob.midpoint <= maxBuyLevel && ob.midpoint >= minBuyLevel)
        .forEach(ob => {
          candidates.push({ source: '15M Bullish Order Block Midpoint', price: ob.midpoint, weight: 4 });
          if (ob.high <= maxBuyLevel) {
            candidates.push({ source: '15M Bullish Order Block Edge', price: ob.high, weight: 3 });
          }
        });
      obs1h
        .filter(ob => !ob.mitigated && ob.type === 'BULLISH' && ob.midpoint <= maxBuyLevel && ob.midpoint >= currentPrice - 3.0 * volMetrics.atr15m)
        .forEach(ob => {
          candidates.push({ source: '1H Institutional Bullish OB', price: ob.midpoint, weight: 5 });
          if (ob.high <= maxBuyLevel) {
            candidates.push({ source: '1H Bullish OB Upper Edge', price: ob.high, weight: 3 });
          }
        });
      activeBullishFvgs
        .filter(fvg => fvg.midpoint <= maxBuyLevel && fvg.midpoint >= minBuyLevel)
        .forEach(fvg => {
          candidates.push({ source: 'Fair Value Gap (FVG) 50%', price: fvg.midpoint, weight: 4 });
          if (fvg.top <= maxBuyLevel) {
            candidates.push({ source: 'Fair Value Gap (FVG) Upper Edge', price: fvg.top, weight: 2 });
          }
        });
      if (sessionLevels.sessionVwap <= maxBuyLevel && sessionLevels.sessionVwap >= minBuyLevel) {
        candidates.push({ source: 'Session VWAP Support', price: sessionLevels.sessionVwap, weight: 3 });
      }
      if (volumeProfile.poc <= maxBuyLevel && volumeProfile.poc >= minBuyLevel) {
        candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 3 });
      }
      if (volumeProfile.val <= maxBuyLevel && volumeProfile.val >= minBuyLevel) {
        candidates.push({ source: 'Value Area Low (VAL)', price: volumeProfile.val, weight: 2 });
      }
      if (equilibrium <= maxBuyLevel && equilibrium >= minBuyLevel) {
        candidates.push({ source: 'Discount Equilibrium (50%)', price: equilibrium, weight: 3 });
      }
      const fib618Buy = parseFloat((rangeHigh - 0.618 * dealingSpan).toFixed(2));
      const fib705Buy = parseFloat((rangeHigh - 0.705 * dealingSpan).toFixed(2));
      if (fib618Buy <= maxBuyLevel && fib618Buy >= minBuyLevel) {
        candidates.push({ source: 'Institutional OTE (61.8% Retracement)', price: fib618Buy, weight: 4 });
      }
      if (fib705Buy <= maxBuyLevel && fib705Buy >= minBuyLevel) {
        candidates.push({ source: 'Institutional OTE (70.5% Optimal Zone)', price: fib705Buy, weight: 3 });
      }
      if (latestBullishSweep && latestBullishSweep.levelPrice <= maxBuyLevel && latestBullishSweep.levelPrice >= minBuyLevel) {
        candidates.push({ source: 'Liquidity Sweep Retest', price: latestBullishSweep.levelPrice, weight: 4 });
      }

      // Trend Continuation Confluence Candidates (EMA20, EMA50, Shallow 38.2% Fib, & Broken Swing High Breaker Flip)
      if (isBullTrend) {
        const ema20Rounded = parseFloat(ema20.toFixed(2));
        const ema50Rounded = parseFloat(ema50.toFixed(2));
        if (ema20Rounded <= maxBuyLevel && ema20Rounded >= minBuyLevel) {
          candidates.push({ source: '15M EMA-20 Dynamic Trend Support', price: ema20Rounded, weight: 3 });
        }
        if (ema50Rounded <= maxBuyLevel && ema50Rounded >= minBuyLevel) {
          candidates.push({ source: '15M EMA-50 Institutional Pullback', price: ema50Rounded, weight: 3 });
        }
        const fib382Buy = parseFloat((rangeHigh - 0.382 * dealingSpan).toFixed(2));
        if (fib382Buy <= maxBuyLevel && fib382Buy >= minBuyLevel) {
          candidates.push({ source: 'Trend Continuation Fib (38.2%)', price: fib382Buy, weight: 3 });
        }
        const brokenHighsBelow = swings15.filter(s => s.type === 'HIGH' && s.price <= maxBuyLevel && s.price >= minBuyLevel).slice(-2);
        brokenHighsBelow.forEach(bh => {
          candidates.push({ source: `15M Bullish Breaker / S-R Flip ($${bh.price.toFixed(2)})`, price: bh.price, weight: 4 });
        });
      }
    } else {
      const minSellLevel = currentPrice - 0.05 * volMetrics.atr15m;
      const maxSellLevel = currentPrice + maxCandidateDist;

      activeBearishObs
        .filter(ob => ob.midpoint >= minSellLevel && ob.midpoint <= maxSellLevel)
        .forEach(ob => {
          candidates.push({ source: '15M Bearish Order Block Midpoint', price: ob.midpoint, weight: 4 });
          if (ob.low >= minSellLevel) {
            candidates.push({ source: '15M Bearish Order Block Edge', price: ob.low, weight: 3 });
          }
        });
      obs1h
        .filter(ob => !ob.mitigated && ob.type === 'BEARISH' && ob.midpoint >= minSellLevel && ob.midpoint <= currentPrice + 3.0 * volMetrics.atr15m)
        .forEach(ob => {
          candidates.push({ source: '1H Institutional Bearish OB', price: ob.midpoint, weight: 5 });
          if (ob.low >= minSellLevel) {
            candidates.push({ source: '1H Bearish OB Lower Edge', price: ob.low, weight: 3 });
          }
        });
      activeBearishFvgs
        .filter(fvg => fvg.midpoint >= minSellLevel && fvg.midpoint <= maxSellLevel)
        .forEach(fvg => {
          candidates.push({ source: 'Fair Value Gap (FVG) 50%', price: fvg.midpoint, weight: 4 });
          if (fvg.bottom >= minSellLevel) {
            candidates.push({ source: 'Fair Value Gap (FVG) Lower Edge', price: fvg.bottom, weight: 2 });
          }
        });
      if (sessionLevels.sessionVwap >= minSellLevel && sessionLevels.sessionVwap <= maxSellLevel) {
        candidates.push({ source: 'Session VWAP Resistance', price: sessionLevels.sessionVwap, weight: 3 });
      }
      if (volumeProfile.poc >= minSellLevel && volumeProfile.poc <= maxSellLevel) {
        candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 3 });
      }
      if (volumeProfile.vah >= minSellLevel && volumeProfile.vah <= maxSellLevel) {
        candidates.push({ source: 'Value Area High (VAH)', price: volumeProfile.vah, weight: 2 });
      }
      if (equilibrium >= minSellLevel && equilibrium <= maxSellLevel) {
        candidates.push({ source: 'Premium Equilibrium (50%)', price: equilibrium, weight: 3 });
      }
      const fib618Sell = parseFloat((rangeLow + 0.618 * dealingSpan).toFixed(2));
      const fib705Sell = parseFloat((rangeLow + 0.705 * dealingSpan).toFixed(2));
      if (fib618Sell >= minSellLevel && fib618Sell <= maxSellLevel) {
        candidates.push({ source: 'Institutional OTE (61.8% Retracement)', price: fib618Sell, weight: 4 });
      }
      if (fib705Sell >= minSellLevel && fib705Sell <= maxSellLevel) {
        candidates.push({ source: 'Institutional OTE (70.5% Optimal Zone)', price: fib705Sell, weight: 3 });
      }
      if (latestBearishSweep && latestBearishSweep.levelPrice >= minSellLevel && latestBearishSweep.levelPrice <= maxSellLevel) {
        candidates.push({ source: 'Liquidity Sweep Retest', price: latestBearishSweep.levelPrice, weight: 4 });
      }

      // Trend Continuation Confluence Candidates (EMA20, EMA50, Shallow 38.2% Fib, & Broken Swing Low Breaker Flip)
      if (isBearTrend) {
        const ema20Rounded = parseFloat(ema20.toFixed(2));
        const ema50Rounded = parseFloat(ema50.toFixed(2));
        if (ema20Rounded >= minSellLevel && ema20Rounded <= maxSellLevel) {
          candidates.push({ source: '15M EMA-20 Dynamic Trend Resistance', price: ema20Rounded, weight: 3 });
        }
        if (ema50Rounded >= minSellLevel && ema50Rounded <= maxSellLevel) {
          candidates.push({ source: '15M EMA-50 Institutional Pullback', price: ema50Rounded, weight: 3 });
        }
        const fib382Sell = parseFloat((rangeLow + 0.382 * dealingSpan).toFixed(2));
        if (fib382Sell >= minSellLevel && fib382Sell <= maxSellLevel) {
          candidates.push({ source: 'Trend Continuation Fib (38.2%)', price: fib382Sell, weight: 3 });
        }
        const brokenLowsAbove = swings15.filter(s => s.type === 'LOW' && s.price >= minSellLevel && s.price <= maxSellLevel).slice(-2);
        brokenLowsAbove.forEach(bl => {
          candidates.push({ source: `15M Bearish Breaker / S-R Flip ($${bl.price.toFixed(2)})`, price: bl.price, weight: 4 });
        });
      }
    }

    const highImpactCandles = (eventWeights || []).filter(ew => ew.weight >= 0.88).slice(-2);
    highImpactCandles.forEach(hic => {
      const c = completed15m[hic.index];
      if (c) {
        const mid = parseFloat(((c.open + c.close) / 2).toFixed(2));
        const validSide = structuralDirection === 'BUY'
          ? (mid <= currentPrice + 0.05 * volMetrics.atr15m && mid >= currentPrice - maxCandidateDist)
          : (mid >= currentPrice - 0.05 * volMetrics.atr15m && mid <= currentPrice + maxCandidateDist);
        if (validSide) {
          candidates.push({
            source: `Event Impulse Level (${hic.eventTag})`,
            price: mid,
            weight: 3
          });
        }
      }
    });

    // ZERO SYNTHETIC FALLBACKS: Do not fabricate synthetic OTE candidates if candidates.length < 2.
    // If fewer than 2 real structural confluence levels exist, computeInstitutionalConfluenceZone
    // returns zoneRank = 'WEAK', and Gate 4 rejects the trade.
    const icz = this.computeInstitutionalConfluenceZone(structuralDirection, currentPrice, candidates, volMetrics.atr15m);

    let orderType: OrderType = 'WAIT';
    let selectedModel: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'NONE' = 'NONE';
    // Strictly check if currentPrice is physically inside the Institutional Confluence Zone [zoneLow, zoneHigh]
    const isInsideIcz = currentPrice >= (icz.zoneLow - 0.12 * volMetrics.atr15m) && currentPrice <= (icz.zoneHigh + 0.12 * volMetrics.atr15m);

    if (bias === 'BUY') {
      if (isBullContinuation || (isBullTrend && (htfTrend === 'BULLISH' || trend4h === 'BULLISH'))) {
        selectedModel = 'BOS_PULLBACK_CONTINUATION';
      } else if (latestBullishSweep) {
        selectedModel = 'SWEEP_CHOCH_REVERSAL';
      } else if (isBullTrend) {
        selectedModel = 'BOS_PULLBACK_CONTINUATION';
      } else {
        selectedModel = 'RANGE_DEVIATION_RECLAIM';
      }

      // Allow MARKET_BUY when inside ICZ in discount/equilibrium (or up to 68% of range during strong trend continuation)
      const maxMarketLocation = selectedModel === 'BOS_PULLBACK_CONTINUATION' ? 68 : 62;
      orderType = (isInsideIcz && localLocationPct <= maxMarketLocation) ? 'MARKET_BUY' : 'BUY_LIMIT';
    } else if (bias === 'SELL') {
      if (isBearContinuation || (isBearTrend && (htfTrend === 'BEARISH' || trend4h === 'BEARISH'))) {
        selectedModel = 'BOS_PULLBACK_CONTINUATION';
      } else if (latestBearishSweep) {
        selectedModel = 'SWEEP_CHOCH_REVERSAL';
      } else if (isBearTrend) {
        selectedModel = 'BOS_PULLBACK_CONTINUATION';
      } else {
        selectedModel = 'RANGE_DEVIATION_RECLAIM';
      }

      // Allow MARKET_SELL when inside ICZ in premium/equilibrium (or down to 32% of range during strong trend continuation)
      const minMarketLocation = selectedModel === 'BOS_PULLBACK_CONTINUATION' ? 32 : 38;
      orderType = (isInsideIcz && localLocationPct >= minMarketLocation) ? 'MARKET_SELL' : 'SELL_LIMIT';
    }

    // Entry Price is ALWAYS anchored to the Institutional Confluence Zone (icz.preferredEntry)
    let entryPrice = parseFloat(icz.preferredEntry.toFixed(2));

    // Stage 4: 1M Microstructure Entry Refinement inside Institutional Confluence Zone (ICZ)
    // CANNOT OVERRIDE STAGES 1-3: Refinement is strictly constrained within [icz.zoneLow, icz.zoneHigh]
    let refinedBy1m = false;
    let refinementReason = 'Anchored to 15M/1H ICZ Preferred Entry';

    if (candles1m && candles1m.length >= 10) {
      const completed1m = candles1m.slice(0, -1);
      const swings1m = this.detectFractalSwings(completed1m);
      if (structuralDirection === 'BUY') {
        const microLows = swings1m
          .filter(s => s.type === 'LOW' && s.price >= icz.zoneLow && s.price <= icz.zoneHigh)
          .map(s => s.price);
        if (microLows.length > 0) {
          const bestMicroLow = microLows[microLows.length - 1];
          entryPrice = parseFloat(Math.max(icz.zoneLow, Math.min(icz.zoneHigh, bestMicroLow + 0.10)).toFixed(2));
          refinedBy1m = true;
          refinementReason = `1M Micro Swing Low ($${bestMicroLow.toFixed(2)}) refinement inside ICZ`;
        }
      } else {
        const microHighs = swings1m
          .filter(s => s.type === 'HIGH' && s.price >= icz.zoneLow && s.price <= icz.zoneHigh)
          .map(s => s.price);
        if (microHighs.length > 0) {
          const bestMicroHigh = microHighs[microHighs.length - 1];
          entryPrice = parseFloat(Math.max(icz.zoneLow, Math.min(icz.zoneHigh, bestMicroHigh - 0.10)).toFixed(2));
          refinedBy1m = true;
          refinementReason = `1M Micro Swing High ($${bestMicroHigh.toFixed(2)}) refinement inside ICZ`;
        }
      }
    }

    // Strict Structural Invalidation (SL) Calculation with Anti-Wick-Hunt Protection:
    // NEVER clamp Stop Loss tighter than the structural invalidation level + adaptiveBuffer!
    // If the true structural stop is too wide (> 2.2x ATR), Gate 4 rejects the trade via EXCESSIVE_STRUCTURAL_RISK.
    const adaptiveBuffer = parseFloat(Math.max(1.25, volMetrics.atr15m * 0.45).toFixed(2));
    const minStopDist = Math.max(3.20, parseFloat((1.05 * volMetrics.atr15m).toFixed(2)));
    let exactStopLoss = 0;
    let structuralInvalidationLevel = 0;

    if (structuralDirection === 'BUY') {
      const nearestSwingLowBelow = swings15
        .filter(s => s.type === 'LOW' && s.price < entryPrice && s.price >= entryPrice - 2.20 * volMetrics.atr15m)
        .map(s => s.price)
        .slice(-1)[0];

      const structuralLowsBelow: number[] = [];
      if (nearestSwingLowBelow !== undefined) structuralLowsBelow.push(nearestSwingLowBelow);
      if (latestBullishSweep && latestBullishSweep.wickExtreme < entryPrice && latestBullishSweep.wickExtreme >= entryPrice - 2.20 * volMetrics.atr15m) {
        structuralLowsBelow.push(latestBullishSweep.wickExtreme);
      }
      if (icz.zoneLow <= entryPrice) {
        structuralLowsBelow.push(icz.zoneLow);
      }

      structuralInvalidationLevel = structuralLowsBelow.length > 0
        ? Math.min(...structuralLowsBelow)
        : parseFloat((Math.min(entryPrice, icz.zoneLow) - 0.85 * volMetrics.atr15m).toFixed(2));

      const rawSl = Math.min(structuralInvalidationLevel, icz.zoneLow) - adaptiveBuffer;
      const unClampedDist = Math.max(minStopDist, entryPrice - rawSl);
      exactStopLoss = parseFloat((entryPrice - unClampedDist).toFixed(2));
    } else {
      const nearestSwingHighAbove = swings15
        .filter(s => s.type === 'HIGH' && s.price > entryPrice && s.price <= entryPrice + 2.20 * volMetrics.atr15m)
        .map(s => s.price)
        .slice(-1)[0];

      const structuralHighsAbove: number[] = [];
      if (nearestSwingHighAbove !== undefined) structuralHighsAbove.push(nearestSwingHighAbove);
      if (latestBearishSweep && latestBearishSweep.wickExtreme > entryPrice && latestBearishSweep.wickExtreme <= entryPrice + 2.20 * volMetrics.atr15m) {
        structuralHighsAbove.push(latestBearishSweep.wickExtreme);
      }
      if (icz.zoneHigh >= entryPrice) {
        structuralHighsAbove.push(icz.zoneHigh);
      }

      structuralInvalidationLevel = structuralHighsAbove.length > 0
        ? Math.max(...structuralHighsAbove)
        : parseFloat((Math.max(entryPrice, icz.zoneHigh) + 0.85 * volMetrics.atr15m).toFixed(2));

      const rawSl = Math.max(structuralInvalidationLevel, icz.zoneHigh) + adaptiveBuffer;
      const unClampedDist = Math.max(minStopDist, rawSl - entryPrice);
      exactStopLoss = parseFloat((entryPrice + unClampedDist).toFixed(2));
    }

    const directionalRisk = structuralDirection === 'BUY'
      ? parseFloat((entryPrice - exactStopLoss).toFixed(2))
      : parseFloat((exactStopLoss - entryPrice).toFixed(2));

    const isGeometryValid = directionalRisk >= Math.max(2.0, 0.6 * volMetrics.atr15m);
    const risk = isGeometryValid ? directionalRisk : Math.max(3.5, volMetrics.atr15m);

    // Multi-Timeframe Named Liquidity-Anchored Take Profit Targets (15M, 1H, 4H) with Front-Running Buffer
    let tp1Price = 0;
    let tp2Price = 0;
    let tp3Price = 0;
    let tp1LiquiditySource = '1.45R Structural Projection';
    let tp2LiquiditySource = '2.35R Structural Projection';
    let tp3LiquiditySource = '3.40R Structural Projection';
    let opposingObstacleReason: string | null = null;

    if (structuralDirection === 'BUY') {
      const allHighPools: { price: number; source: string }[] = [
        ...swings15.filter(s => s.type === 'HIGH').map(s => ({ price: s.price, source: `15M Swing High ($${s.price.toFixed(2)})` })),
        ...swings1h.filter(s => s.type === 'HIGH').map(s => ({ price: s.price, source: `1H Swing High ($${s.price.toFixed(2)})` })),
        ...swings4h.filter(s => s.type === 'HIGH').map(s => ({ price: s.price, source: `4H Swing High ($${s.price.toFixed(2)})` })),
        { price: sessionLevels.ash, source: 'Asian Session High (ASH)' },
        { price: sessionLevels.londonHigh, source: 'London Session High (LNH)' },
        { price: sessionLevels.pdh, source: 'Previous Day High (PDH)' },
        { price: sessionLevels.pwh, source: 'Previous Week High (PWH)' },
        { price: volumeProfile.vah, source: 'Volume Profile VAH' },
        ...obs1h.filter(o => !o.mitigated && o.type === 'BEARISH').map(o => ({ price: o.low, source: `1H Bearish Order Block ($${o.low.toFixed(2)})` }))
      ].filter(p => p.price && !isNaN(p.price) && p.price > entryPrice);

      // Check if an unmitigated 1H Bearish OB or PDH blocks the path to 1.15R
      const majorObstacles = [
        ...obs1h.filter(o => !o.mitigated && o.type === 'BEARISH').map(o => ({ price: o.low, name: `1H Bearish OB ($${o.low.toFixed(2)})` })),
        ...(sessionLevels.pdh > entryPrice ? [{ price: sessionLevels.pdh, name: `PDH ($${sessionLevels.pdh.toFixed(2)})` }] : [])
      ].filter(o => o.price > entryPrice + 0.25 * risk && o.price < entryPrice + 1.15 * risk);
      if (majorObstacles.length > 0) {
        opposingObstacleReason = `Opposing HTF resistance (${majorObstacles[0].name}) sits at +${((majorObstacles[0].price - entryPrice) / risk).toFixed(2)}R before 1.3R minimum target.`;
      }

      const tp1Candidates = allHighPools
        .filter(p => p.price >= entryPrice + 1.35 * risk && p.price <= entryPrice + 1.95 * risk)
        .sort((a, b) => a.price - b.price);
      if (tp1Candidates.length > 0) {
        tp1Price = parseFloat(Math.max(entryPrice + 1.35 * risk, tp1Candidates[0].price - 0.20).toFixed(2));
        tp1LiquiditySource = tp1Candidates[0].source;
      } else {
        tp1Price = parseFloat((entryPrice + Math.max(4.2, risk * 1.45)).toFixed(2));
      }

      const tp2Candidates = allHighPools
        .filter(p => p.price >= Math.max(tp1Price + 0.5 * risk, entryPrice + 2.10 * risk) && p.price <= entryPrice + 3.10 * risk)
        .sort((a, b) => a.price - b.price);
      if (tp2Candidates.length > 0) {
        tp2Price = parseFloat((tp2Candidates[0].price - 0.25).toFixed(2));
        tp2LiquiditySource = tp2Candidates[0].source;
      } else {
        tp2Price = parseFloat((entryPrice + Math.max(7.2, risk * 2.35)).toFixed(2));
      }

      const tp3Candidates = allHighPools
        .filter(p => p.price >= Math.max(tp2Price + 0.6 * risk, entryPrice + 3.20 * risk) && p.price <= entryPrice + 4.80 * risk)
        .sort((a, b) => a.price - b.price);
      if (tp3Candidates.length > 0) {
        tp3Price = parseFloat((tp3Candidates[0].price - 0.30).toFixed(2));
        tp3LiquiditySource = tp3Candidates[0].source;
      } else {
        tp3Price = parseFloat((entryPrice + Math.max(10.5, risk * 3.40)).toFixed(2));
      }
    } else {
      const allLowPools: { price: number; source: string }[] = [
        ...swings15.filter(s => s.type === 'LOW').map(s => ({ price: s.price, source: `15M Swing Low ($${s.price.toFixed(2)})` })),
        ...swings1h.filter(s => s.type === 'LOW').map(s => ({ price: s.price, source: `1H Swing Low ($${s.price.toFixed(2)})` })),
        ...swings4h.filter(s => s.type === 'LOW').map(s => ({ price: s.price, source: `4H Swing Low ($${s.price.toFixed(2)})` })),
        { price: sessionLevels.asl, source: 'Asian Session Low (ASL)' },
        { price: sessionLevels.londonLow, source: 'London Session Low (LNL)' },
        { price: sessionLevels.pdl, source: 'Previous Day Low (PDL)' },
        { price: sessionLevels.pwl, source: 'Previous Week Low (PWL)' },
        { price: volumeProfile.val, source: 'Volume Profile VAL' },
        ...obs1h.filter(o => !o.mitigated && o.type === 'BULLISH').map(o => ({ price: o.high, source: `1H Bullish Order Block ($${o.high.toFixed(2)})` }))
      ].filter(p => p.price && !isNaN(p.price) && p.price < entryPrice);

      // Check if an unmitigated 1H Bullish OB or PDL blocks the path to 1.15R
      const majorObstacles = [
        ...obs1h.filter(o => !o.mitigated && o.type === 'BULLISH').map(o => ({ price: o.high, name: `1H Bullish OB ($${o.high.toFixed(2)})` })),
        ...(sessionLevels.pdl > 0 && sessionLevels.pdl < entryPrice ? [{ price: sessionLevels.pdl, name: `PDL ($${sessionLevels.pdl.toFixed(2)})` }] : [])
      ].filter(o => o.price < entryPrice - 0.25 * risk && o.price > entryPrice - 1.15 * risk);
      if (majorObstacles.length > 0) {
        opposingObstacleReason = `Opposing HTF demand (${majorObstacles[0].name}) sits at +${((entryPrice - majorObstacles[0].price) / risk).toFixed(2)}R before 1.3R minimum target.`;
      }

      const tp1Candidates = allLowPools
        .filter(p => p.price <= entryPrice - 1.35 * risk && p.price >= entryPrice - 1.95 * risk)
        .sort((a, b) => b.price - a.price);
      if (tp1Candidates.length > 0) {
        tp1Price = parseFloat(Math.min(entryPrice - 1.35 * risk, tp1Candidates[0].price + 0.20).toFixed(2));
        tp1LiquiditySource = tp1Candidates[0].source;
      } else {
        tp1Price = parseFloat((entryPrice - Math.max(4.2, risk * 1.45)).toFixed(2));
      }

      const tp2Candidates = allLowPools
        .filter(p => p.price <= Math.min(tp1Price - 0.5 * risk, entryPrice - 2.10 * risk) && p.price >= entryPrice - 3.10 * risk)
        .sort((a, b) => b.price - a.price);
      if (tp2Candidates.length > 0) {
        tp2Price = parseFloat((tp2Candidates[0].price + 0.25).toFixed(2));
        tp2LiquiditySource = tp2Candidates[0].source;
      } else {
        tp2Price = parseFloat((entryPrice - Math.max(7.2, risk * 2.35)).toFixed(2));
      }

      const tp3Candidates = allLowPools
        .filter(p => p.price <= Math.min(tp2Price - 0.6 * risk, entryPrice - 3.20 * risk) && p.price >= entryPrice - 4.80 * risk)
        .sort((a, b) => b.price - a.price);
      if (tp3Candidates.length > 0) {
        tp3Price = parseFloat((tp3Candidates[0].price + 0.30).toFixed(2));
        tp3LiquiditySource = tp3Candidates[0].source;
      } else {
        tp3Price = parseFloat((entryPrice - Math.max(10.5, risk * 3.40)).toFixed(2));
      }
    }

    const r1 = parseFloat((Math.abs(tp1Price - entryPrice) / risk).toFixed(2));
    const r2 = parseFloat((Math.abs(tp2Price - entryPrice) / risk).toFixed(2));
    const r3 = parseFloat((Math.abs(tp3Price - entryPrice) / risk).toFixed(2));

    const compositeFactor = (gate1.score * 0.15) + (gate2.score * 0.15) + (gate3Score * 0.40) + (icz.zoneRank === 'TIER_1_PRIME' ? 25 : icz.zoneRank === 'TIER_2_STRONG' ? 18 : icz.zoneRank === 'TIER_3_MODERATE' ? 10 : 0);
    const baseWinRate = bias === 'NO_TRADE' ? 0 : Math.max(0.42, Math.min(0.80, (compositeFactor / 100) * 0.85));
    const pTp1 = bias === 'NO_TRADE' ? 0 : parseFloat(Math.max(0.35, Math.min(0.80, baseWinRate - (r1 - 1.4) * 0.08)).toFixed(2));
    const pTp2 = bias === 'NO_TRADE' ? 0 : parseFloat(Math.max(0.22, Math.min(0.65, pTp1 * 0.74 - (r2 - 2.2) * 0.04)).toFixed(2));
    const pTp3 = bias === 'NO_TRADE' ? 0 : parseFloat(Math.max(0.12, Math.min(0.45, pTp2 * 0.62 - (r3 - 3.4) * 0.03)).toFixed(2));
    const pSl = bias === 'NO_TRADE' ? 0 : parseFloat((1.0 - pTp1).toFixed(2));
    const spreadCostR = risk > 0 ? (microstructure.spread / risk) : 0;
    const ev = bias === 'NO_TRADE'
      ? 0
      : parseFloat(((((pTp1 * 0.5 * r1) + (pTp2 * 0.3 * r2) + (pTp3 * 0.2 * r3)) - (pSl * 1.0)) - spreadCostR).toFixed(2));

    // Stage 3 Check: Entry Missed (Runaway Protection)
    let entryMissed = false;
    let entryMissedReason: string | null = null;
    if (bias === 'BUY') {
      if (currentPrice >= entryPrice + 0.50 * risk) {
        entryMissed = true;
        entryMissedReason = `Entry missed: Spot price ($${currentPrice.toFixed(2)}) has moved +${((currentPrice - entryPrice) / risk).toFixed(2)}R toward TP1 without filling preferred entry ($${entryPrice.toFixed(2)}). Late chase prohibited.`;
      }
    } else if (bias === 'SELL') {
      if (currentPrice <= entryPrice - 0.50 * risk) {
        entryMissed = true;
        entryMissedReason = `Entry missed: Spot price ($${currentPrice.toFixed(2)}) has declined +${((entryPrice - currentPrice) / risk).toFixed(2)}R toward TP1 without filling preferred entry ($${entryPrice.toFixed(2)}). Late chase prohibited.`;
      }
    }

    let gate4Passed = true;
    let gate4Score = 80;
    let gate4Code = 'TRADE_LOCATION_OK';
    let gate4Reason = `Institutional Confluence Zone verified with positive spread-adjusted EV (+${ev}R).`;

    if (!isGeometryValid || (structuralDirection === 'BUY' && exactStopLoss >= entryPrice) || (structuralDirection === 'SELL' && exactStopLoss <= entryPrice)) {
      gate4Passed = false;
      gate4Score = 10;
      gate4Code = 'INVERTED_GEOMETRY';
      gate4Reason = `Fatal geometric error: ${structuralDirection} stop loss ($${exactStopLoss}) is on the wrong side of entry ($${entryPrice}).`;
    } else if (entryMissed) {
      gate4Passed = false;
      gate4Score = 30;
      gate4Code = 'ENTRY_MISSED';
      gate4Reason = entryMissedReason!;
      orderType = 'WAIT';
    } else if (icz.zoneRank === 'WEAK') {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'WEAK_CONFLUENCE_ZONE';
      gate4Reason = 'Fewer than 2 overlapping institutional structural levels in range.';
    } else if (directionalRisk > Math.max(8.0, 2.2 * volMetrics.atr15m)) {
      gate4Passed = false;
      gate4Score = 25;
      gate4Code = 'EXCESSIVE_STRUCTURAL_RISK';
      gate4Reason = `Required structural invalidation distance ($${directionalRisk.toFixed(2)}) exceeds 2.2x ATR ($${(2.2 * volMetrics.atr15m).toFixed(2)}). Setup rejected rather than artificially clamping stop loss.`;
    } else if (opposingObstacleReason) {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'OPPOSING_HTF_OBSTACLE';
      gate4Reason = opposingObstacleReason;
    } else if (orderType === 'WAIT') {
      gate4Passed = false;
      gate4Score = 40;
      gate4Code = 'AWAITING_PULLBACK';
      gate4Reason = `Price ($${currentPrice.toFixed(2)}) is outside the executable zone for preferred entry ($${entryPrice.toFixed(2)}).`;
    } else if (r1 < 1.3) {
      gate4Passed = false;
      gate4Score = 30;
      gate4Code = 'INSUFFICIENT_RR';
      gate4Reason = `R:R1 is ${r1} (< 1.3 institutional minimum). Opposing structural target is too close to entry.`;
    } else if (ev < 0.25) {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'NEGATIVE_EXPECTANCY';
      gate4Reason = `Spread-adjusted Expected Value is ${ev}R (< +0.25R required statistical edge).`;
    } else {
      gate4Score = Math.min(96, Math.round(
        (icz.zoneRank === 'TIER_1_PRIME' ? 95 : icz.zoneRank === 'TIER_2_STRONG' ? 85 : 72) * 0.45 +
        Math.min(100, r1 * 45) * 0.35 +
        Math.min(100, Math.max(30, ev * 50)) * 0.20
      ));
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

    // 1. Post-SL Structural Re-Anchoring Cooldown:
    // Prevent immediate same-direction re-entry right after a Stop Loss hit unless price has structurally reclaimed the broken level
    if (this.lastStopLossHit && (Date.now() - this.lastStopLossHit.timestamp) < 15 * 60 * 1000) {
      if (structuralDirection === this.lastStopLossHit.direction) {
        const reclaimedBrokenSl = structuralDirection === 'BUY'
          ? currentPrice >= this.lastStopLossHit.stopLossPrice + 0.45 * volMetrics.atr15m
          : currentPrice <= this.lastStopLossHit.stopLossPrice - 0.45 * volMetrics.atr15m;
        if (!reclaimedBrokenSl) {
          gate5Passed = false;
          gate5Score = 35;
          gate5Code = 'POST_SL_COOLDOWN';
          gate5Reason = `Post-SL protection active: awaiting structural reclaim after recent ${this.lastStopLossHit.direction} stop-out at $${this.lastStopLossHit.stopLossPrice.toFixed(2)}.`;
          killSwitchActive = true;
          killSwitchTier = 'RISK_KILL';
          killSwitchReason = gate5Reason;
        }
      }
    }

    // 2. Consecutive Stop-Loss Circuit Breaker (Last 3 Trades):
    // If 2+ consecutive losses occurred recently, require TIER_1_PRIME confluence; if 3 consecutive losses within 2 hours, pause for model recalibration
    const recent3 = this.recentTradesHistory.slice(-3);
    const consecutiveLosses = recent3.length >= 2 && recent3.slice(-2).every(t => t.result === 'LOSS');
    const threeConsecutiveLosses = recent3.length === 3 && recent3.every(t => t.result === 'LOSS' && (Date.now() - t.timestamp) < 2 * 60 * 60 * 1000);
    if (threeConsecutiveLosses) {
      gate5Passed = false;
      gate5Score = 25;
      gate5Code = 'CONSECUTIVE_SL_CIRCUIT_BREAKER';
      gate5Reason = 'Circuit breaker engaged after 3 consecutive stop-outs: awaiting fresh higher-timeframe structural displacement.';
      killSwitchActive = true;
      killSwitchTier = 'RISK_KILL';
      killSwitchReason = gate5Reason;
    } else if (consecutiveLosses && icz.zoneRank !== 'TIER_1_PRIME') {
      gate5Passed = false;
      gate5Score = 45;
      gate5Code = 'HIGH_SELECTIVITY_AFTER_SL';
      gate5Reason = 'Elevated selectivity after consecutive stop-outs: only Tier-1 Prime confluence setups are permitted.';
    }

    // 3. Check rolling drift: if win rate in recent 20 trades < 40%
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

    // =========================================================
    // STAGE 7 — MANDATORY FINAL VALIDATION CHECKLIST (Part D)
    // =========================================================
    let isDuplicate = false;
    let duplicateReason: string | null = null;
    if (activeSignals && activeSignals.length > 0 && bias !== 'NO_TRADE') {
      const match = activeSignals.find(s => {
        if (s.direction !== bias) return false;
        const sZone = (s.aiReasoning as any)?.entryZone || [s.entryPrice - 0.5, s.entryPrice + 0.5];
        const entryOverlap = (entryPrice >= sZone[0] - 0.50 * volMetrics.atr15m && entryPrice <= sZone[1] + 0.50 * volMetrics.atr15m);
        const slOverlap = (s.stopLoss && Math.abs(exactStopLoss - s.stopLoss) <= 0.50 * volMetrics.atr15m);
        return entryOverlap || slOverlap;
      });
      if (match) {
        isDuplicate = true;
        duplicateReason = `Duplicate signal suppressed: matches active signal #${match.id} (${match.direction} at $${match.entryPrice}) with overlapping entry/invalidation zone.`;
      }
    }

    const withinExposureCap = (activeSignals?.length || 0) < 3;
    const exposureCapReason = !withinExposureCap
      ? `Exposure limit reached: 3 active signals already in progress (${activeSignals.length}/3). Slots are never filled for their own sake.`
      : null;

    const checklistReasons: string[] = [];
    const dataIsFresh = gate1Passed;
    if (!dataIsFresh) checklistReasons.push(gate1Reason);

    const setupStillValid = gate3Passed;
    if (!setupStillValid) checklistReasons.push(gate3Reason);

    const entryNotMissed = !entryMissed;
    if (!entryNotMissed && entryMissedReason) checklistReasons.push(entryMissedReason);

    const stopIsStructural = isGeometryValid && directionalRisk <= Math.max(8.0, 2.2 * volMetrics.atr15m) &&
      ((structuralDirection === 'BUY' && exactStopLoss < entryPrice) || (structuralDirection === 'SELL' && exactStopLoss > entryPrice));
    if (!stopIsStructural) checklistReasons.push('Stop loss is not structural or violates invalidation geometry.');

    const targetsRealistic = !opposingObstacleReason && tp1Price > 0;
    if (!targetsRealistic && opposingObstacleReason) checklistReasons.push(opposingObstacleReason);

    const rrAcceptable = r1 >= 1.3 && ev >= 0.25;
    if (!rrAcceptable) checklistReasons.push(`R:R (${r1}) or EV (+${ev}R) below institutional thresholds.`);

    const newsRiskAcceptable = !newsGate.isBlackout && !newsGate.feedOffline && marketRegime !== 'NEWS_SHOCK';
    if (!newsRiskAcceptable) checklistReasons.push(newsGate.feedOffline ? 'News calendar feed is offline.' : 'Active economic news blackout or post-news shock.');

    const spreadAcceptable = microstructure.isLiquid && microstructure.spread <= 0.60;
    if (!spreadAcceptable) checklistReasons.push(`Institutional spread threshold exceeded (${microstructure.spread.toFixed(2)} > $0.60).`);

    const notDuplicate = !isDuplicate;
    if (!notDuplicate && duplicateReason) checklistReasons.push(duplicateReason);

    const orderTypeSupported = ['BUY_LIMIT', 'SELL_LIMIT', 'MARKET_BUY', 'MARKET_SELL'].includes(orderType);
    if (!orderTypeSupported) checklistReasons.push(`Order type ${orderType} is non-executable.`);

    const finalValidationAllPassed =
      dataIsFresh &&
      setupStillValid &&
      entryNotMissed &&
      stopIsStructural &&
      targetsRealistic &&
      rrAcceptable &&
      newsRiskAcceptable &&
      spreadAcceptable &&
      notDuplicate &&
      withinExposureCap &&
      orderTypeSupported;

    const finalValidationChecklist: FinalValidationChecklist = {
      dataIsFresh,
      setupStillValid,
      entryNotMissed,
      stopIsStructural,
      targetsRealistic,
      rrAcceptable,
      newsRiskAcceptable,
      spreadAcceptable,
      notDuplicate,
      withinExposureCap,
      orderTypeSupported,
      allPassed: finalValidationAllPassed,
      reasons: checklistReasons
    };

    if (gate1Passed && gate2Passed && gate3Passed && gate4Passed && gate5Passed && !finalValidationAllPassed) {
      gate5Passed = false;
      gate5Score = 35;
      gate5Code = !withinExposureCap ? 'EXPOSURE_CAP_REACHED' : !notDuplicate ? 'DUPLICATE_SIGNAL' : 'FINAL_VALIDATION_FAILED';
      gate5Reason = checklistReasons.join('; ');
    }

    const gate5: GateCheck = {
      gateId: 'GATE_5_EXECUTION',
      passed: gate5Passed,
      score: gate5Score,
      code: gate5Code,
      reason: gate5Reason,
      telemetry: { killSwitchActive, killSwitchTier, killSwitchReason, finalValidationChecklist }
    };

    // Aggregate 5 Gates + Stage 7 Final Validation Checklist
    const allPassed = gate1.passed && gate2.passed && gate3.passed && gate4.passed && gate5.passed && finalValidationAllPassed;
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
      else grade = 'B+';
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
      tp1LiquiditySource,
      tp1RiskReward: r1,
      probTp1BeforeSl: pTp1,
      tp2Price,
      tp2LiquiditySource,
      tp2RiskReward: r2,
      probTp2BeforeSl: pTp2,
      tp3Price,
      tp3LiquiditySource,
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
      confidenceAdjustment: confidenceMultiplier,
      riskPercent: 1.0
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
      finalValidationChecklist,
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
    const mss5mConfirmed = finalDirection === 'BUY' ? mss5mBuy : finalDirection === 'SELL' ? mss5mSell : false;

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
        tf5m: { mssTriggered: mss5mConfirmed, candleCount: candles5m?.length || 0 }
      },
      execution: {
        tf1m: {
          spreadImpactPips,
          candleCount: candles1m?.length || 0,
          refinedBy1m,
          refinedEntry: entryPrice,
          refinementReason
        }
      }
    };

    const hierarchy: FiveLevelFactorHierarchy = {
      level1_marketEnvironment: {
        regime: marketRegime,
        volatilityRegime: volMetrics.regime,
        atrPercentile: volMetrics.atrPercentile,
        session: sessionLevels.session,
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getUTCDay()],
        approachingDecisionArea,
        decisionAreaDetails
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
        preferredEntry: entryPrice,
        refinedBy1m
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
      finalValidationChecklist,
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
        londonHigh: parseFloat(sessionLevels.londonHigh.toFixed(2)),
        londonLow: parseFloat(sessionLevels.londonLow.toFixed(2)),
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
      memory,
      unmitigatedOrderBlocks: obs15,
      fairValueGaps: fvgs15
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

  // Helper method to compute complete institutional setup snapshot
  private async getOrComputeGoldSetup(): Promise<XauusdInstitutionalSetup> {
    const now = Date.now();
    if (this.cachedGoldSetup && (now - this.cachedGoldSetup.timestamp < this.GOLD_SETUP_CACHE_TTL_MS)) {
      return this.cachedGoldSetup.setup;
    }

    const [candles1week, candles1day, candles4h, candles1h, candles15m, candles5m, candles1m] = await Promise.all([
      this.fetchXauusdCandles('1week', 60),
      this.fetchXauusdCandles('1day', 100),
      this.fetchXauusdCandles('4h', 100),
      this.fetchXauusdCandles('1h', 120),
      this.fetchXauusdCandles('15min', 160),
      this.fetchXauusdCandles('5min', 200),
      this.fetchXauusdCandles('1min', 200)
    ]);

    const latestPrice = (candles15m.length > 0 ? candles15m[candles15m.length - 1]?.close : 0) || 0;
    const [microstructure, intermarket, newsGate, activeSignals] = await Promise.all([
      this.fetchGoldMicrostructure(latestPrice),
      this.fetchIntermarket(),
      this.fetchEconomicNewsGate(),
      this.getActiveGoldSignals(3)
    ]);

    const setup = this.evaluateProductionPipeline(
      candles15m,
      candles1h,
      microstructure,
      intermarket,
      newsGate,
      candles4h,
      candles5m,
      candles1m,
      candles1day,
      candles1week,
      activeSignals
    );

    this.cachedGoldSetup = { timestamp: now, setup };
    return setup;
  }

  // Check if a signal record is in an active (non-terminal) lifecycle state
  private isSignalActive(signal: any): boolean {
    if (!signal) return false;
    // Check if the signal has explicitly expired by time
    if (signal.expiresAt && new Date(signal.expiresAt).getTime() <= Date.now()) {
      return false;
    }
    const reasoning = (signal.aiReasoning as any) || {};
    const status = reasoning.status || 'ACTIVE';
    const lifecycleState = reasoning.lifecycleState || status;
    const terminalStates = ['CLOSED', 'CANCELLED', 'EXPIRED', 'INVALIDATED', 'TP2_HIT', 'SL_HIT'];
    if (terminalStates.includes(lifecycleState) || terminalStates.includes(status)) return false;
    if (status === 'TP1_HIT' && (reasoning.runnerClosedAtBreakeven || reasoning.closedAt)) return false;
    // Check order validity expiry for unfilled pending orders
    const orderValidityExpiresAt = reasoning.orderValidityExpiresAt ? new Date(reasoning.orderValidityExpiresAt).getTime() : 0;
    if (!reasoning.isOrderFilled && orderValidityExpiresAt > 0 && Date.now() > orderValidityExpiresAt) {
      return false;
    }
    return true;
  }

  // Retrieves active Gold signals from the database (up to limit, default 3)
  private async getActiveGoldSignals(limit = 3) {
    const candidateSignals = await this.prisma.signal.findMany({
      where: {
        symbol: 'GOLD',
        direction: { in: ['BUY', 'SELL'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return candidateSignals.filter(s => this.isSignalActive(s)).slice(0, limit);
  }

  // Retrieves the primary active Gold signal (read-only, never mutates levels or direction)
  private async getActiveGoldSignal() {
    const active = await this.getActiveGoldSignals(1);
    return active.length > 0 ? active[0] : null;
  }

  // Purely returns active signal or null. Never creates phantom signals or mutates entry/SL/TP levels.
  private async syncActiveGoldSignalWithLiveSetup(setup?: XauusdInstitutionalSetup) {
    return this.getActiveGoldSignal();
  }

  // Part F Rule 1: Generate Human-Readable Institutional Signal ID (e.g. G-20261030-001)
  private async generateInstitutionalSignalId(now: Date): Promise<string> {
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${dd}`;

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const countToday = await this.prisma.signal.count({
      where: {
        symbol: 'GOLD',
        createdAt: { gte: startOfDay }
      }
    });

    const seq = String(countToday + 1).padStart(3, '0');
    return `G-${yyyymmdd}-${seq}`;
  }

  // Part F & G: Appends a new lifecycle event to the signal's immutable audit history
  private appendLifecycleEvent(reasoning: any, event: SignalLifecycleEvent): SignalLifecycleEvent[] {
    const existing: SignalLifecycleEvent[] = Array.isArray(reasoning?.lifecycleEvents) ? reasoning.lifecycleEvents : [];
    return [...existing, event];
  }

  // Part F Rule 2: 3-rule duplicate setup suppression
  // Matches open signal in direction and any of: (1) entry zones overlap, (2) invalidation levels within 0.5 ATR, (3) same swing/OB origin
  private checkIsDuplicateCandidate(
    setup: XauusdInstitutionalSetup,
    activeSignals: any[]
  ): { isDuplicate: boolean; matchingSignal?: any; reason?: string } {
    const atr15m = Math.max(1, setup.volatilityMetrics?.atr15m || 5);
    for (const s of activeSignals) {
      if (s.direction !== setup.direction) continue;

      const sReasoning = (s.aiReasoning as any) || {};
      const sZone: [number, number] = Array.isArray(sReasoning.entryZone) && sReasoning.entryZone.length === 2
        ? sReasoning.entryZone
        : [Number(s.entryPrice) - 0.5, Number(s.entryPrice) + 0.5];

      // Rule 2a: Entry zones overlap
      const zonesOverlap = Math.max(setup.entryZone[0], sZone[0]) <= Math.min(setup.entryZone[1], sZone[1]) ||
        (setup.entryPrice >= sZone[0] - 0.5 * atr15m && setup.entryPrice <= sZone[1] + 0.5 * atr15m);

      // Rule 2b: Invalidation levels are within 0.5 * ATR15m
      const sStop = Number(s.stopLoss);
      const slDiff = Math.abs(setup.stopLoss - sStop);
      const invalidationClose = slDiff <= 0.5 * atr15m;

      // Rule 2c: Originates from same originating swing/OB model
      const sameModel = sReasoning.strategy === setup.model;

      if (zonesOverlap) {
        return { isDuplicate: true, matchingSignal: s, reason: `Entry zone overlap ($${setup.entryZone[0].toFixed(2)}-$${setup.entryZone[1].toFixed(2)} vs $${sZone[0].toFixed(2)}-$${sZone[1].toFixed(2)})` };
      }
      if (invalidationClose) {
        return { isDuplicate: true, matchingSignal: s, reason: `Invalidation levels within 0.5 ATR15m ($${setup.stopLoss.toFixed(2)} vs $${sStop.toFixed(2)}, diff: $${slDiff.toFixed(2)})` };
      }
      if (sameModel && (zonesOverlap || invalidationClose)) {
        return { isDuplicate: true, matchingSignal: s, reason: `Same model origin (${setup.model}) with structural proximity` };
      }
    }

    return { isDuplicate: false };
  }

  @Get('gold/overview')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Comprehensive Cockpit Snapshot' })
  async getGoldOverview() {
    try {
      const setup = await this.getOrComputeGoldSetup();
      const activeSignal = await this.syncActiveGoldSignalWithLiveSetup(setup);
      const activeSignals = await this.getActiveGoldSignals(3);
      const gate3Tel = setup.fiveGates.gate3_setup.telemetry || {};

      // Strictly preserve WAIT when no live setup and no active signal exist (zero fake BUY/SELL coercion)
      const effectiveDirection: 'BUY' | 'SELL' | 'WAIT' = setup.direction !== 'WAIT'
        ? setup.direction
        : (activeSignal?.direction === 'BUY' || activeSignal?.direction === 'SELL')
          ? activeSignal.direction
          : 'WAIT';

      const effectiveOrderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET_BUY' | 'MARKET_SELL' | 'WAIT' = setup.orderType !== 'WAIT'
        ? setup.orderType
        : ((activeSignal?.aiReasoning as any)?.orderType || 'WAIT');

      const effectiveGrade: string = setup.grade !== 'WAIT'
        ? setup.grade
        : ((activeSignal?.aiReasoning as any)?.signalGrade || 'WAIT');

      const auditGates = [
        {
          gateId: 'GATE_1_DATA' as const,
          name: 'Data Integrity & Freshness',
          passed: setup.fiveGates.gate1_data.passed,
          score: setup.fiveGates.gate1_data.score,
          code: setup.fiveGates.gate1_data.code,
          reason: setup.fiveGates.gate1_data.reason,
          telemetry: setup.fiveGates.gate1_data.telemetry
        },
        {
          gateId: 'GATE_2_MARKET' as const,
          name: 'Regime & Volatility Filter',
          passed: setup.fiveGates.gate2_market.passed,
          score: setup.fiveGates.gate2_market.score,
          code: setup.fiveGates.gate2_market.code,
          reason: setup.fiveGates.gate2_market.reason,
          telemetry: setup.fiveGates.gate2_market.telemetry
        },
        {
          gateId: 'GATE_3_SETUP' as const,
          name: 'Liquidity & Structural Alignment',
          passed: setup.fiveGates.gate3_setup.passed,
          score: setup.fiveGates.gate3_setup.score,
          code: setup.fiveGates.gate3_setup.code,
          reason: setup.fiveGates.gate3_setup.reason,
          telemetry: setup.fiveGates.gate3_setup.telemetry
        },
        {
          gateId: 'GATE_4_TRADE' as const,
          name: 'Asymmetric Expectancy & R:R',
          passed: setup.fiveGates.gate4_trade.passed,
          score: setup.fiveGates.gate4_trade.score,
          code: setup.fiveGates.gate4_trade.code,
          reason: setup.fiveGates.gate4_trade.reason,
          telemetry: setup.fiveGates.gate4_trade.telemetry
        },
        {
          gateId: 'GATE_5_EXECUTION' as const,
          name: 'Execution Liquidity & Event Shield',
          passed: setup.fiveGates.gate5_execution.passed,
          score: setup.fiveGates.gate5_execution.score,
          code: setup.fiveGates.gate5_execution.code,
          reason: setup.fiveGates.gate5_execution.reason,
          telemetry: setup.fiveGates.gate5_execution.telemetry
        }
      ];

      // Calculate real 24h price change from completed 1H candles AND real 4H ATR from completed 4H candles
      const lastCandle = setup.levels.currentPrice;
      const [candlesFor24h, candlesFor4hAtr] = await Promise.all([
        this.fetchXauusdCandles('1h', 30),
        this.fetchXauusdCandles('4h', 30)
      ]);
      let change24h = 0;
      let change24hPct = 0;
      if (candlesFor24h.length >= 24) {
        const candle24hAgo = candlesFor24h[candlesFor24h.length - 24];
        if (candle24hAgo && candle24hAgo.close > 0) {
          change24h = parseFloat((lastCandle - candle24hAgo.close).toFixed(2));
          change24hPct = parseFloat((((lastCandle - candle24hAgo.close) / candle24hAgo.close) * 100).toFixed(2));
        }
      }

      const completed4hForAtr = candlesFor4hAtr.length > 1 ? candlesFor4hAtr.slice(0, -1) : candlesFor4hAtr;
      const real4hAtr = completed4hForAtr.length >= 5
        ? this.computeVolatilityMetrics(completed4hForAtr).atr15m
        : setup.volatilityMetrics.atr15m;

      // Find next upcoming high/medium impact USD event from cached ForexFactory calendar even when outside blackout
      let nextHighImpactEvent: { title: string; currency: string; timeUtc: string; minutesRemaining: number } | undefined;
      if (setup.newsGate.eventTitle) {
        nextHighImpactEvent = {
          title: setup.newsGate.eventTitle,
          currency: 'USD',
          timeUtc: new Date(Date.now() + (setup.newsGate.minutesToEvent || 60) * 60000).toISOString(),
          minutesRemaining: setup.newsGate.minutesToEvent || 0
        };
      } else if (Array.isArray(this.cachedCalendarEvents) && this.cachedCalendarEvents.length > 0) {
        const nowMs = Date.now();
        const upcomingUsdEvents = this.cachedCalendarEvents
          .filter((ev: any) => {
            if (!ev || (ev.country !== 'USD' && ev.currency !== 'USD')) return false;
            const impact = String(ev.impact || '').toLowerCase();
            if (impact !== 'high' && impact !== 'medium') return false;
            const evTime = new Date(ev.date).getTime();
            return !isNaN(evTime) && evTime > nowMs;
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (upcomingUsdEvents.length > 0) {
          const nextEv = upcomingUsdEvents[0];
          const evTimeMs = new Date(nextEv.date).getTime();
          nextHighImpactEvent = {
            title: nextEv.title,
            currency: 'USD',
            timeUtc: new Date(evTimeMs).toISOString(),
            minutesRemaining: Math.max(0, Math.round((evTimeMs - nowMs) / 60000))
          };
        }
      }

      // If an active signal is open, top-level entry & risk telemetry MUST unify with the active signal!
      const effectiveEntry = activeSignal ? Number(activeSignal.entryPrice) : setup.entryPrice;
      const effectiveSl = activeSignal ? Number(activeSignal.stopLoss) : setup.stopLoss;
      const effectiveTp1 = activeSignal ? Number(activeSignal.takeProfit1) : setup.takeProfit1;
      const effectiveTp2 = activeSignal ? Number(activeSignal.takeProfit2 || (activeSignal.aiReasoning as any)?.takeProfit2 || setup.takeProfit2) : setup.takeProfit2;
      const effectiveTp3 = activeSignal ? Number((activeSignal.aiReasoning as any)?.takeProfit3 || setup.takeProfit3) : setup.takeProfit3;
      const effectiveZone: [number, number] = activeSignal && (activeSignal.aiReasoning as any)?.entryZone
        ? (activeSignal.aiReasoning as any).entryZone
        : setup.entryZone;
      const effectiveR1 = activeSignal ? Number(activeSignal.riskRewardRatio || setup.riskReward1) : setup.riskReward1;
      const effectiveConfidence = activeSignal ? (activeSignal.winProbability ?? setup.opportunityScore) : setup.opportunityScore;
      const effectiveStrategy = activeSignal
        ? ((activeSignal.aiReasoning as any)?.strategy || activeSignal.strategyKey || setup.model)
        : setup.model;

      // Filter Order Blocks & FVGs: prioritize unmitigated zones near spot price (within 5x ATR)
      const spotP = setup.levels.currentPrice;
      const atrVal = Math.max(1, setup.volatilityMetrics.atr15m || 5);
      const allObs = setup.unmitigatedOrderBlocks || [];
      const unmitigatedObs = allObs.filter(ob => !ob.mitigated && Math.abs(ob.midpoint - spotP) <= 5 * atrVal);
      const sortedObs = (unmitigatedObs.length > 0 ? unmitigatedObs : allObs)
        .slice()
        .sort((a, b) => Math.abs(a.midpoint - spotP) - Math.abs(b.midpoint - spotP))
        .slice(0, 8);

      const realOrderBlocks = sortedObs.map(ob => ({
        type: ob.type,
        high: parseFloat(ob.high.toFixed(2)),
        low: parseFloat(ob.low.toFixed(2)),
        midpoint: parseFloat(ob.midpoint.toFixed(2)),
        timeframe: '15m',
        isMitigated: ob.mitigated
      }));

      const allFvgs = setup.fairValueGaps || [];
      const unmitigatedFvgs = allFvgs.filter(f => !f.mitigated && Math.abs(f.midpoint - spotP) <= 5 * atrVal);
      const sortedFvgs = (unmitigatedFvgs.length > 0 ? unmitigatedFvgs : allFvgs)
        .slice()
        .sort((a, b) => Math.abs(a.midpoint - spotP) - Math.abs(b.midpoint - spotP))
        .slice(0, 8);

      const realFairValueGaps = sortedFvgs.map(fvg => ({
        type: fvg.type,
        top: parseFloat(fvg.top.toFixed(2)),
        bottom: parseFloat(fvg.bottom.toFixed(2)),
        midpoint: parseFloat(fvg.midpoint.toFixed(2)),
        atrRatio: parseFloat((Math.abs(fvg.top - fvg.bottom) / Math.max(0.1, setup.volatilityMetrics.atr15m)).toFixed(2)),
        isFilled: fvg.mitigated
      }));

      const trend4hNorm = setup.hierarchy?.level3_technicalStructure?.htfTrend4h === 'BULLISH'
        ? 'BULLISH'
        : setup.hierarchy?.level3_technicalStructure?.htfTrend4h === 'BEARISH'
          ? 'BEARISH'
          : 'NEUTRAL';
      const trend1hNorm = setup.hierarchy?.level3_technicalStructure?.primaryStructure1h === 'BULLISH'
        ? 'BULLISH'
        : setup.hierarchy?.level3_technicalStructure?.primaryStructure1h === 'BEARISH'
          ? 'BEARISH'
          : 'NEUTRAL';
      const trend15mNorm = gate3Tel.trend15m === 'BULLISH'
        ? 'BULLISH'
        : gate3Tel.trend15m === 'BEARISH'
          ? 'BEARISH'
          : 'NEUTRAL';

      return {
        timestamp: new Date().toISOString(),
        symbol: 'GOLD',
        currentPrice: setup.levels.currentPrice,
        change24h,
        change24hPct,
        spread: setup.microstructure.spread,
        marketRegime: setup.marketRegime,
        volatilityAtr15m: setup.volatilityMetrics.atr15m,
        volatilityPercentile: setup.volatilityMetrics.atrPercentile,
        sessionName: (setup.hierarchy?.level1_marketEnvironment?.session) || 'Active Session',
        dataQuality: setup.fiveGates.gate1_data.passed ? 'PRIME' : 'DEGRADED',
        confidence: effectiveConfidence,
        confluenceScore: effectiveConfidence,
        direction: effectiveDirection,
        signalGrade: effectiveGrade,
        activeSignal: activeSignal || null,
        activeSignals,
        fiveGatesAudit: auditGates,
        macro: {
          dxyPrice: setup.intermarket.dxy,
          dxyChange1h: setup.intermarket.dxyChange1h,
          dxyChange24h: setup.intermarket.dxyChange24h ?? 0,
          dxyTrend: setup.intermarket.dxyChange1h > 0.05 ? 'STRENGTHENING' : setup.intermarket.dxyChange1h < -0.05 ? 'WEAKENING' : 'NEUTRAL',
          us10yYield: setup.intermarket.us10y,
          us10yChange1h: setup.intermarket.us10yChange1h,
          realYieldProxy: setup.intermarket.realYieldProxy,
          breakevenInflationBenchmark: setup.intermarket.breakevenInflation ?? 2.30,
          isRealYieldLive: setup.intermarket.isRealYieldLive ?? false,
          safeHavenDemandScore: setup.intermarket.safeHavenDemandScore,
          macroAlignment: setup.intermarket.macroAlignment,
          forexFactoryGate: setup.newsGate.feedOffline
            ? 'FEED_OFFLINE'
            : setup.newsGate.isBlackout
              ? 'BLACKOUT_ACTIVE'
              : setup.newsGate.eventStage === 'PRICE_DISCOVERY'
                ? 'POST_NEWS_STABILIZATION'
                : 'CLEAR',
          lastNewsSyncTime: this.lastCalendarFetchTime ? new Date(this.lastCalendarFetchTime).toISOString() : undefined,
          calendarEventsLoaded: this.cachedCalendarEvents.length,
          nextHighImpactEvent
        },
        multiTf: {
          trend4h: trend4hNorm,
          trend1h: trend1hNorm,
          trend15m: trend15mNorm,
          concordanceStatus: (trend4hNorm === trend1hNorm && trend1hNorm === trend15mNorm && trend1hNorm !== 'NEUTRAL')
            ? 'FULL_ALIGNMENT'
            : (trend4hNorm === trend1hNorm || trend1hNorm === trend15mNorm)
              ? 'PARTIAL_ALIGNMENT'
              : 'COUNTER_TREND_CHOP',
          displacement4hAtr: real4hAtr,
          volumeProfilePoc: setup.levels.poc,
          sessionVwap: setup.levels.sessionVwap
        },
        structure: {
          currentPrice: setup.levels.currentPrice,
          asianHigh: setup.levels.ash,
          asianLow: setup.levels.asl,
          londonHigh: setup.levels.londonHigh,
          londonLow: setup.levels.londonLow,
          previousDayHigh: setup.levels.pdh,
          previousDayLow: setup.levels.pdl,
          approachingDecisionArea: setup.hierarchy?.level1_marketEnvironment?.approachingDecisionArea ?? false,
          decisionAreaDetails: setup.hierarchy?.level1_marketEnvironment?.decisionAreaDetails ?? '',
          unmitigatedOrderBlocks: realOrderBlocks,
          fairValueGaps: realFairValueGaps
        },
        entryPlan: {
          eligibleStrategies: [effectiveStrategy !== 'NONE' ? effectiveStrategy : 'AWAITING_SETUP'],
          selectedStrategy: effectiveStrategy !== 'NONE' ? effectiveStrategy : 'AWAITING_SETUP',
          orderType: effectiveOrderType,
          preferredEntry: effectiveEntry,
          entryZone: effectiveZone,
          currentDistancePips: Math.round(Math.abs(setup.levels.currentPrice - effectiveEntry) * 10),
          entryConditions: setup.confluenceReasons.map((reason, idx) => ({
            name: `Confluence Factor #${idx + 1}`,
            status: 'PASSED',
            detail: reason
          }))
        },
        riskPlan: {
          exactStopLoss: effectiveSl,
          stopDistancePips: Math.round(Math.abs(effectiveEntry - effectiveSl) * 10),
          takeProfit1: effectiveTp1,
          takeProfit2: effectiveTp2,
          takeProfit3: effectiveTp3,
          riskReward1: effectiveR1,
          riskReward2: setup.riskReward2,
          expectedValueR: setup.tradePath.expectedValueR,
          recommendedLots: setup.positionSizing.recommendedLots,
          recommendedUnitsOz: Number((setup.positionSizing.recommendedLots * 100).toFixed(1)),
          riskBudgetUsd: setup.positionSizing.riskBudgetUsd,
          trailingStopBeActive: (activeSignal?.aiReasoning as any)?.trailingStopBe || false,
          spread: setup.microstructure.spread,
          maxSpreadAllowed: 0.50,
          executionEligibility: !setup.microstructure.isLiquid
            ? 'SPREAD_HALTED'
            : (setup.newsGate.isBlackout || setup.newsGate.feedOffline)
              ? 'EVENT_BLOCKED'
              : setup.fiveGates.allPassed
                ? 'APPROVED'
                : 'WAITING_TRIGGER'
        },
        finalValidationChecklist: setup.finalValidationChecklist
      };
    } catch (e: any) {
      this.logger.error(`[getGoldOverview] Failed to assemble overview: ${e.message}`);
      throw e;
    }
  }

  @Get('gold/analysis')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Multi-Timeframe Structural Analysis' })
  async getGoldAnalysis() {
    const overview = await this.getGoldOverview();
    return {
      symbol: overview.symbol,
      currentPrice: overview.currentPrice,
      multiTf: overview.multiTf,
      structure: overview.structure,
      volatilityAtr15m: overview.volatilityAtr15m,
      volatilityPercentile: overview.volatilityPercentile,
      marketRegime: overview.marketRegime,
      gateAudit: overview.fiveGatesAudit
    };
  }

  @Get('gold/entries')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Strategy Selection & Entry Desk' })
  async getGoldEntries() {
    const overview = await this.getGoldOverview();
    return {
      symbol: overview.symbol,
      currentPrice: overview.currentPrice,
      entryPlan: overview.entryPlan,
      gateAudit: overview.fiveGatesAudit,
      marketRegime: overview.marketRegime,
      finalValidationChecklist: overview.finalValidationChecklist
    };
  }

  @Get('gold/fundamentals')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Macro & Fundamental Barometer' })
  async getGoldFundamentals() {
    const overview = await this.getGoldOverview();
    return {
      symbol: overview.symbol,
      macro: overview.macro,
      sessionName: overview.sessionName
    };
  }

  @Get('gold/risk')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Monetary Risk & Position Sizing' })
  async getGoldRisk() {
    const overview = await this.getGoldOverview();
    return {
      symbol: overview.symbol,
      currentPrice: overview.currentPrice,
      riskPlan: overview.riskPlan,
      activeSignal: overview.activeSignal
    };
  }

  @Get('gold/history')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Historical Signal Audits & Performance' })
  async getGoldHistory(@Query('limit') limitQuery?: string, @Query('days') daysQuery?: string) {
    const take = Math.min(Math.max(parseInt(limitQuery || '50', 10) || 50, 1), 100);
    const daysLimit = daysQuery ? parseInt(daysQuery, 10) : 90;
    const sinceDate = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);

    const rawSignals = await this.prisma.signal.findMany({
      where: {
        symbol: 'GOLD',
        createdAt: { gte: sinceDate }
      },
      orderBy: { createdAt: 'desc' },
      take
    });

    const mappedSignals = rawSignals.map(s => {
      const reasoning = (s.aiReasoning as any) || {};
      const rawStatus = reasoning.status || 'ACTIVE';
      let lifecycleState: string = reasoning.lifecycleState || rawStatus;
      let outcome: string | null = reasoning.outcome || null;

      // Normalize legacy or raw status into 9-state lifecycle
      if (['TP1_HIT', 'TP2_HIT', 'SL_HIT'].includes(rawStatus)) {
        lifecycleState = 'CLOSED';
        outcome = rawStatus;
      } else if (reasoning.runnerClosedAtBreakeven) {
        lifecycleState = 'CLOSED';
        outcome = 'BREAKEVEN';
      } else if (rawStatus === 'CLOSED' && !outcome) {
        outcome = reasoning.closeReason || 'CLOSED';
      }

      const isFilled = Boolean(
        reasoning.isOrderFilled ||
        outcome?.startsWith('TP') ||
        outcome === 'SL_HIT' ||
        outcome === 'BREAKEVEN' ||
        lifecycleState === 'POSITION_OPEN' ||
        lifecycleState === 'PARTIALLY_FILLED'
      );

      const fillPrice = reasoning.filledPrice || (isFilled ? s.entryPrice : null);
      const exitPrice = reasoning.exitPrice || reasoning.lastCheckedPrice || null;

      let realizedR = reasoning.pnlR;
      if (realizedR === undefined || realizedR === null) {
        if (outcome === 'TP2_HIT') realizedR = parseFloat((s.riskRewardRatio * 1.5).toFixed(2));
        else if (outcome === 'TP1_HIT') realizedR = parseFloat(s.riskRewardRatio.toFixed(2));
        else if (outcome === 'BREAKEVEN') realizedR = parseFloat((s.riskRewardRatio * 0.5).toFixed(2));
        else if (outcome === 'SL_HIT') realizedR = -1.0;
        else realizedR = null;
      }

      return {
        ...s,
        lifecycleState,
        outcome,
        isFilled,
        closeReason: reasoning.closeReason || null,
        filledAt: reasoning.filledAt || null,
        fillPrice,
        closedAt: reasoning.closedAt || null,
        exitPrice,
        realizedR,
        publicId: reasoning.publicId || null,
        lastValidatedAt: reasoning.lastValidatedAt || null,
        lifecycleEvents: reasoning.lifecycleEvents || [],
        strategy: reasoning.strategy || s.strategyKey || 'SMC_INSTITUTIONAL'
      };
    });

    // Win rate and performance metrics are computed STRICTLY from filled, closed signals
    const evaluatedSignals = mappedSignals.filter(s => s.lifecycleState === 'CLOSED' && s.isFilled && s.realizedR !== null);

    const wins = evaluatedSignals.filter(s => (s.realizedR ?? 0) > 0);
    const losses = evaluatedSignals.filter(s => (s.realizedR ?? 0) < 0);
    const breakevens = evaluatedSignals.filter(s => (s.realizedR ?? 0) === 0);

    const winRate = (wins.length + losses.length) > 0
      ? Math.round((wins.length / (wins.length + losses.length)) * 100)
      : null;

    let totalGainR = 0;
    let totalLossR = 0;
    evaluatedSignals.forEach(s => {
      const r = s.realizedR || 0;
      if (r > 0) totalGainR += r;
      else if (r < 0) totalLossR += Math.abs(r);
    });

    const profitFactor = totalLossR > 0
      ? parseFloat((totalGainR / totalLossR).toFixed(2))
      : totalGainR > 0 ? parseFloat(totalGainR.toFixed(2)) : null;

    const totalPnlR = parseFloat((totalGainR - totalLossR).toFixed(1));
    const avgRiskReward = evaluatedSignals.length > 0
      ? parseFloat((evaluatedSignals.reduce((acc, s) => acc + s.riskRewardRatio, 0) / evaluatedSignals.length).toFixed(2))
      : null;

    const metrics = {
      totalSignals: mappedSignals.length,
      activeSignals: mappedSignals.filter(s => ['WAITING_FOR_ENTRY', 'ACTIVE_ORDER', 'POSITION_OPEN', 'PARTIALLY_FILLED', 'ACTIVE'].includes(s.lifecycleState)).length,
      unfilledSignals: mappedSignals.filter(s => ['EXPIRED', 'CANCELLED', 'INVALIDATED'].includes(s.lifecycleState)).length,
      evaluatedSignals: evaluatedSignals.length,
      wins: wins.length,
      losses: losses.length,
      breakevens: breakevens.length,
      winRate,
      avgRiskReward,
      profitFactor,
      totalPnlR: evaluatedSignals.length > 0 ? totalPnlR : 0
    };

    return {
      metrics,
      signals: mappedSignals
    };
  }

  @Get('gold/annotations')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Real-time SMC/ICT Chart Annotations' })
  async getGoldAnnotations(@Query('timeframe') tfQuery?: string) {
    const timeframe = tfQuery === '1h' ? '1h' : tfQuery === '4h' ? '4h' : '15m';
    
    const setup = await this.getOrComputeGoldSetup();
    const activeSignal = await this.getActiveGoldSignal();

    const rawTargetCandles = await this.fetchXauusdCandles(timeframe === '4h' ? '4h' : timeframe === '1h' ? '1h' : '15min', 120);
    // Strictly evaluate annotations on COMPLETED candles (exclude forming candle at index -1)
    const targetCandles = rawTargetCandles.length > 1 ? rawTargetCandles.slice(0, -1) : rawTargetCandles;
    const targetVol = this.computeVolatilityMetrics(targetCandles);
    const swings = this.detectFractalSwings(targetCandles);
    const obs = this.detectOrderBlocks(targetCandles, targetVol.atr15m);
    const fvgs = this.detectFairValueGaps(targetCandles, targetVol.atr15m);

    const levelsToTest: { name: string; price: number }[] = [
      { name: 'PDH', price: setup.levels.pdh },
      { name: 'PDL', price: setup.levels.pdl },
      { name: 'ASH', price: setup.levels.ash },
      { name: 'ASL', price: setup.levels.asl },
      { name: 'LNH', price: setup.levels.londonHigh },
      { name: 'LNL', price: setup.levels.londonLow },
    ].filter(l => l.price > 0);
    swings.filter(s => s.type === 'HIGH').slice(-4).forEach(s => levelsToTest.push({ name: 'Swing High', price: s.price }));
    swings.filter(s => s.type === 'LOW').slice(-4).forEach(s => levelsToTest.push({ name: 'Swing Low', price: s.price }));

    const sweeps = this.detectAdaptiveLiquiditySweeps(targetCandles, levelsToTest, targetVol.atr15m);

    // Compute true BOS & CHoCH chronologically from completed candle closes breaking prior confirmed Swing Highs / Swing Lows
    const bosEvents: { index: number; type: 'BULLISH_BOS' | 'BEARISH_BOS'; price: number; isChoch: boolean }[] = [];
    let priorStructureTrend: string = 'NEUTRAL';
    let lastConfirmedHigh: FractalSwing | null = null;
    let lastConfirmedLow: FractalSwing | null = null;

    for (let i = 0; i < swings.length; i++) {
      const currSwing = swings[i];
      if (currSwing.type === 'HIGH') {
        if (lastConfirmedHigh) {
          const brokenByClose = targetCandles
            .slice(lastConfirmedHigh.index + 1, Math.min(targetCandles.length, currSwing.index + 3))
            .some(c => c.close > lastConfirmedHigh!.price && c.close > c.open);
          if (brokenByClose) {
            const isChoch = priorStructureTrend === 'BEARISH';
            bosEvents.push({ index: currSwing.index, type: 'BULLISH_BOS', price: lastConfirmedHigh.price, isChoch });
            priorStructureTrend = 'BULLISH';
          }
        }
        lastConfirmedHigh = currSwing;
      } else {
        if (lastConfirmedLow) {
          const brokenByClose = targetCandles
            .slice(lastConfirmedLow.index + 1, Math.min(targetCandles.length, currSwing.index + 3))
            .some(c => c.close < lastConfirmedLow!.price && c.close < c.open);
          if (brokenByClose) {
            const isChoch = priorStructureTrend === 'BULLISH';
            bosEvents.push({ index: currSwing.index, type: 'BEARISH_BOS', price: lastConfirmedLow.price, isChoch });
            priorStructureTrend = 'BEARISH';
          }
        }
        lastConfirmedLow = currSwing;
      }
    }

    const annotations: any[] = [];
    const spotPrice = setup.levels.currentPrice;
    const atrLevel = Math.max(1, targetVol.atr15m || 5);

    // 1. Order Blocks (OB) - Prioritize UNMITIGATED zones within 6x ATR of current spot price
    const unmitObs = obs.filter(o => !o.mitigated && Math.abs(o.midpoint - spotPrice) <= 6 * atrLevel);
    const candidateObs = unmitObs.length >= 3 ? unmitObs : obs;
    const sortedTargetObs = candidateObs
      .slice()
      .sort((a, b) => Math.abs(a.midpoint - spotPrice) - Math.abs(b.midpoint - spotPrice))
      .slice(0, 6);

    sortedTargetObs.forEach((ob: OrderBlock, idx: number) => {
      annotations.push({
        id: `ob_${timeframe}_${idx}_${ob.candleIndex}`,
        type: ob.type === 'BULLISH' ? 'DEMAND_ZONE' : 'SUPPLY_ZONE',
        direction: ob.type,
        price: ob.midpoint,
        upperPrice: ob.high,
        lowerPrice: ob.low,
        timeframe,
        status: ob.mitigated ? 'MITIGATED' : 'UNMITIGATED',
        label: `${ob.type === 'BULLISH' ? 'Bullish OB' : 'Bearish OB'} (${timeframe.toUpperCase()})`,
        description: `Institutional Order Block at $${ob.low.toFixed(2)} - $${ob.high.toFixed(2)} (Mid: $${ob.midpoint.toFixed(2)})`
      });
    });

    // 2. Fair Value Gaps (FVG) - Prioritize UNMITIGATED gaps within 6x ATR of current spot price
    const unmitFvgs = fvgs.filter(f => !f.mitigated && Math.abs(f.midpoint - spotPrice) <= 6 * atrLevel);
    const candidateFvgs = unmitFvgs.length >= 3 ? unmitFvgs : fvgs;
    const sortedTargetFvgs = candidateFvgs
      .slice()
      .sort((a, b) => Math.abs(a.midpoint - spotPrice) - Math.abs(b.midpoint - spotPrice))
      .slice(0, 6);

    sortedTargetFvgs.forEach((fvg: FairValueGap, idx: number) => {
      annotations.push({
        id: `fvg_${timeframe}_${idx}_${fvg.candleIndex}`,
        type: 'FVG',
        direction: fvg.type,
        price: fvg.midpoint,
        upperPrice: fvg.top,
        lowerPrice: fvg.bottom,
        timeframe,
        status: fvg.mitigated ? 'MITIGATED' : 'UNMITIGATED',
        label: `FVG-${timeframe.toUpperCase()}`,
        description: `${fvg.type} Imbalance: $${fvg.bottom.toFixed(2)} - $${fvg.top.toFixed(2)}`
      });
    });

    // 3. Break of Structure (BOS) & Change of Character (CHoCH)
    bosEvents.slice(-4).forEach((bos: { index: number; type: 'BULLISH_BOS' | 'BEARISH_BOS'; price: number; isChoch: boolean }, idx: number) => {
      annotations.push({
        id: `bos_${timeframe}_${idx}_${bos.index}`,
        type: bos.isChoch ? 'CHOCH' : 'BOS',
        direction: bos.type === 'BULLISH_BOS' ? 'BULLISH' : 'BEARISH',
        price: bos.price,
        timeframe,
        status: 'CONFIRMED',
        label: bos.isChoch ? 'CHoCH' : 'BOS',
        description: `${bos.isChoch ? 'Change of Character' : 'Break of Structure'} (closed candle break) at $${bos.price.toFixed(2)}`
      });
    });

    // 4. Liquidity Sweeps ("Turtle Soup")
    sweeps.slice(-4).forEach((sweep: LiquiditySweep, idx: number) => {
      annotations.push({
        id: `sweep_${timeframe}_${idx}_${sweep.candleIndex}`,
        type: 'TURTLE_SOUP',
        direction: sweep.direction,
        price: sweep.levelPrice,
        timeframe,
        status: 'SWEPT',
        label: sweep.direction === 'BULLISH' ? 'Sell-Side Sweep (Turtle Soup)' : 'Buy-Side Sweep',
        description: `Liquidity sweep of ${sweep.direction === 'BULLISH' ? 'SSL' : 'BSL'} ($${sweep.levelPrice.toFixed(2)}) with rejection wick at $${sweep.wickExtreme.toFixed(2)}`
      });
    });

    // 5. Session Liquidity Pools
    annotations.push({
      id: `liq_pdh_${timeframe}`,
      type: 'LIQUIDITY_POOL',
      direction: 'BEARISH',
      price: setup.levels.pdh,
      timeframe,
      status: 'ACTIVE',
      label: 'Buy-Side Liquidity (PDH)',
      description: `Previous Day High resting buy stops at $${setup.levels.pdh.toFixed(2)}`
    });

    annotations.push({
      id: `liq_pdl_${timeframe}`,
      type: 'LIQUIDITY_POOL',
      direction: 'BULLISH',
      price: setup.levels.pdl,
      timeframe,
      status: 'ACTIVE',
      label: 'Sell-Side Liquidity (PDL)',
      description: `Previous Day Low resting sell stops at $${setup.levels.pdl.toFixed(2)}`
    });

    if (setup.levels.ash > 0) {
      annotations.push({
        id: `liq_ash_${timeframe}`,
        type: 'LIQUIDITY_POOL',
        direction: 'BEARISH',
        price: setup.levels.ash,
        timeframe,
        status: 'ACTIVE',
        label: 'Asian High Liquidity',
        description: `Asian Session High liquidity at $${setup.levels.ash.toFixed(2)}`
      });
    }

    if (setup.levels.asl > 0) {
      annotations.push({
        id: `liq_asl_${timeframe}`,
        type: 'LIQUIDITY_POOL',
        direction: 'BULLISH',
        price: setup.levels.asl,
        timeframe,
        status: 'ACTIVE',
        label: 'Asian Low Liquidity',
        description: `Asian Session Low liquidity at $${setup.levels.asl.toFixed(2)}`
      });
    }

    // 6. Active Trade Levels: Prioritize primary active signal when active, otherwise live candidate setup
    const hasExecutableTrade = !!activeSignal || setup.direction !== 'WAIT';
    const direction: 'BUY' | 'SELL' | 'WAIT' = activeSignal?.direction
      ? activeSignal.direction
      : setup.direction !== 'WAIT'
        ? setup.direction
        : 'WAIT';
    const activeOrderType = ((activeSignal?.aiReasoning as any)?.orderType || (activeSignal?.direction === 'BUY' ? 'BUY_LIMIT' : activeSignal?.direction === 'SELL' ? 'SELL_LIMIT' : 'WAIT')) !== 'WAIT'
      ? (activeSignal?.aiReasoning as any)?.orderType || (activeSignal?.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT')
      : setup.orderType;

    const activeEntry = activeSignal
      ? Number(activeSignal.entryPrice)
      : setup.direction !== 'WAIT' ? setup.entryPrice : 0;
    const activeSl = activeSignal
      ? Number(activeSignal.stopLoss)
      : setup.direction !== 'WAIT' ? setup.stopLoss : 0;
    const activeTp1 = activeSignal
      ? Number(activeSignal.takeProfit1)
      : setup.direction !== 'WAIT' ? setup.takeProfit1 : 0;
    const activeTp2 = activeSignal
      ? Number(activeSignal.takeProfit2 || (activeSignal.aiReasoning as any)?.takeProfit2 || 0)
      : setup.direction !== 'WAIT' ? setup.takeProfit2 : 0;
    const activeTp3 = activeSignal
      ? Number((activeSignal.aiReasoning as any)?.takeProfit3 || 0)
      : setup.direction !== 'WAIT' ? setup.takeProfit3 : 0;
    const activeZone = activeSignal && (activeSignal.aiReasoning as any)?.entryZone
      ? (activeSignal.aiReasoning as any).entryZone
      : setup.entryZone;
    const activeR1 = activeSignal
      ? Number(activeSignal.riskRewardRatio || setup.riskReward1)
      : setup.riskReward1;
    const activeR2 = setup.riskReward2;
    const activeR3 = setup.riskReward3;
    const annotationDir = direction === 'BUY' ? 'BULLISH' : 'BEARISH';

    if (hasExecutableTrade && direction !== 'WAIT') {
      if (activeEntry > 0) {
        annotations.push({
          id: 'trade_entry',
          type: 'ENTRY_LEVEL',
          direction: annotationDir,
          price: activeEntry,
          upperPrice: activeZone[1],
          lowerPrice: activeZone[0],
          timeframe,
          status: 'ACTIVE',
          label: `ENTRY ($${activeEntry.toFixed(2)})`,
          description: `Institutional Entry Zone (${activeOrderType.replace(/_/g, ' ')}): $${activeZone[0].toFixed(2)} - $${activeZone[1].toFixed(2)}`
        });
      }

      if (activeSl > 0) {
        annotations.push({
          id: 'trade_sl',
          type: 'STOP_LOSS',
          direction: annotationDir,
          price: activeSl,
          timeframe,
          status: 'ACTIVE',
          label: `STOP LOSS ($${activeSl.toFixed(2)})`,
          description: `Structural Invalidation Stop Loss: $${activeSl.toFixed(2)}`
        });
      }

      if (activeTp1 > 0) {
        annotations.push({
          id: 'trade_tp1',
          type: 'TAKE_PROFIT_1',
          direction: annotationDir,
          price: activeTp1,
          timeframe,
          status: 'ACTIVE',
          label: `TP1 ($${activeTp1.toFixed(2)}) [${activeR1}R]`,
          description: `Take Profit 1 (${setup.tradePath.tp1LiquiditySource}): $${activeTp1.toFixed(2)}`
        });
      }

      if (activeTp2 > 0) {
        annotations.push({
          id: 'trade_tp2',
          type: 'TAKE_PROFIT_2',
          direction: annotationDir,
          price: activeTp2,
          timeframe,
          status: 'ACTIVE',
          label: `TP2 ($${activeTp2.toFixed(2)}) [${activeR2}R]`,
          description: `Take Profit 2 (${setup.tradePath.tp2LiquiditySource}): $${activeTp2.toFixed(2)}`
        });
      }

      if (activeTp3 > 0) {
        annotations.push({
          id: 'trade_tp3',
          type: 'TAKE_PROFIT_3',
          direction: annotationDir,
          price: activeTp3,
          timeframe,
          status: 'ACTIVE',
          label: `TP3 ($${activeTp3.toFixed(2)}) [${activeR3}R]`,
          description: `Take Profit 3 (${setup.tradePath.tp3LiquiditySource}): $${activeTp3.toFixed(2)}`
        });
      }
    }

    return {
      symbol: 'GOLD',
      timeframe,
      currentPrice: setup.levels.currentPrice,
      tradeLevels: {
        entry: activeEntry || null,
        stopLoss: activeSl || null,
        takeProfit1: activeTp1 || null,
        takeProfit2: activeTp2 || null,
        takeProfit3: activeTp3 || null,
        direction,
        orderType: activeOrderType
      },
      annotations,
      lastUpdated: new Date().toISOString()
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all active trading signals' })
  async getSignals(@Query('forceFresh') forceFreshQuery?: string) {
    try {
      const now = new Date();
      // Signals are never deleted on GET. Expired/closed signals are preserved in database for audit history.
      const recentSignals = await this.prisma.signal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const actionableSignals = recentSignals.filter(s => {
        return (s.direction === 'BUY' || s.direction === 'SELL') && this.isSignalActive(s);
      });

      return actionableSignals;
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

    if (this.isGeneratingSignal) {
      this.logger.log('[SignalsController] Signal generation request received while another scan is in-flight. Awaiting resolution...');
      let waited = 0;
      while (this.isGeneratingSignal && waited < 3000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      const existing = await this.getActiveGoldSignal();
      if (existing) return existing;
    }

    this.isGeneratingSignal = true;

    try {
      if (dto.forceFresh) {
        // Force fresh requested: safely retire only pending unfilled limit orders
        // NEVER cancel live active market positions (POSITION_OPEN / PARTIALLY_FILLED)
        const candidateSignals = await this.prisma.signal.findMany({
          where: {
            symbol: 'GOLD',
            direction: { in: ['BUY', 'SELL'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        for (const sig of candidateSignals) {
          const r = (sig.aiReasoning as any) || {};
          const isFilled = Boolean(r.isOrderFilled || r.status === 'POSITION_OPEN' || r.status === 'PARTIALLY_FILLED' || r.lifecycleState === 'POSITION_OPEN' || r.lifecycleState === 'PARTIALLY_FILLED');
          if (!isFilled && this.isSignalActive(sig)) {
            const updatedSig = await this.prisma.signal.update({
              where: { id: sig.id },
              data: {
                expiresAt: new Date(),
                aiReasoning: {
                  ...r,
                  status: 'CLOSED',
                  lifecycleState: 'CANCELLED',
                  outcome: 'CANCELLED',
                  closeReason: 'SUPERSEDED_BY_FRESH_SCAN',
                  closedAt: new Date().toISOString(),
                  lastStatusChange: new Date().toISOString(),
                  cancellationDetail: 'Pending limit order retired by manual force-fresh signal generation request.'
                }
              }
            });
            this.notificationsGateway.server.emit('signal:updated', updatedSig);
            this.logger.log(`[SignalsController] Pending signal ${sig.id} retired via forceFresh.`);
          }
        }
      }

      // 1. Ingest Multi-timeframe Candles & Evaluate 5-Gate Decision Pipeline across W1, D1, 4H, 1H, 15M, 5M, 1M
      const setup = await this.getOrComputeGoldSetup();

      // 4. Contextual AI Reviewer (Gemini Context Layer - Auditable explainability)
      let aiExplanation = setup.summary;
      let aiVerdict = setup.fiveGates.allPassed ? 'APPROVED' : 'HOLD';
      let aiReviewStatus: 'AI_REVIEWED' | 'AI_SERVICE_OFFLINE' = 'AI_SERVICE_OFFLINE';

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
              confluence_reasons: setup.fiveGates.allPassed
                ? setup.confluenceReasons
                : [setup.fiveGates.gate3_setup.reason || setup.summary || 'Awaiting clean session liquidity sweep and displacement.'],
            },
            session: setup.hierarchy?.level1_marketEnvironment?.session || (setup.levels as any)?.session || 'Active Session',
            intermarket: setup.intermarket,
            microstructure: setup.microstructure,
            news_gate: setup.newsGate,
            market_regime: setup.marketRegime,
            volatility_metrics: setup.volatilityMetrics,
            volume_profile: setup.volumeProfile,
            expectancy: {
              ...setup.tradePath,
              calibratedWinRateTp1: setup.tradePath.probTp1BeforeSl
            },
            position_sizing: setup.positionSizing
          })
        }, 5000);

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          if (aiJson && aiJson.ai_explanation) {
            aiExplanation = aiJson.ai_explanation;
            aiVerdict = aiJson.ai_review_verdict || aiVerdict;
            aiReviewStatus = 'AI_REVIEWED';
          }
        }
      } catch (e: any) {
        this.logger.warn(`[SignalsController] AI service review notice: ${e.message}`);
      }

      // 5. Senior AI Desk Reviewer (Gemini) VETO & Fail-Closed Enforcement:
      // If Gemini issues a VETO or the AI service is offline, fail closed and downgrade direction
      if (aiVerdict === 'VETOED' || aiReviewStatus !== 'AI_REVIEWED' || aiVerdict !== 'APPROVED') {
        const reason = aiVerdict === 'VETOED'
          ? `Vetoed by Senior AI Desk Reviewer: ${aiExplanation}`
          : `Held at Desk: Senior AI Desk Review service is offline or unreachable. Fail-closed safety active.`;
        this.logger.warn(`[SignalsController] Gold candidate held: ${reason}`);
        setup.direction = 'WAIT';
        setup.orderType = 'WAIT';
        setup.fiveGates.allPassed = false;
        setup.fiveGates.failingGate = 'GEMINI_DESK_VETO';
        setup.fiveGates.failingReason = reason;
      }

      if (!dto.forceFresh) {
        const syncedExisting = await this.syncActiveGoldSignalWithLiveSetup(setup);
        if (syncedExisting) {
          return syncedExisting;
        }
      }

      if (setup.fiveGates.allPassed && aiReviewStatus === 'AI_REVIEWED' && aiVerdict === 'APPROVED' && (setup.direction === 'BUY' || setup.direction === 'SELL') && setup.opportunityScore >= 70) {
        const isImmediateMarket = setup.orderType.includes('MARKET');
        const initialLifecycleState = isImmediateMarket ? 'POSITION_OPEN' : 'WAITING_FOR_ENTRY';
        const orderValidityExpiresAt = new Date(Date.now() + setup.invalidationAndExpiry.orderExpiryHours * 60 * 60 * 1000).toISOString();

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
            confluenceScore: setup.opportunityScore,
            durationEstimate: '4-8 hours',
            aiReasoning: {
              status: initialLifecycleState,
              lifecycleState: initialLifecycleState,
              isOrderFilled: isImmediateMarket,
              filledAt: isImmediateMarket ? new Date().toISOString() : null,
              filledPrice: isImmediateMarket ? setup.entryPrice : null,
              orderValidityExpiresAt,
              orderType: setup.orderType,
              entryZone: setup.entryZone,
              strategy: setup.model,
              signalGrade: setup.grade,
              opportunityScore: setup.opportunityScore,
              confluenceScore: setup.opportunityScore,
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
              aiReviewStatus,
              levels: setup.levels,
              marketRegime: setup.marketRegime,
              volatilityMetrics: setup.volatilityMetrics,
              volumeProfile: setup.volumeProfile,
              microstructure: setup.microstructure,
              intermarket: setup.intermarket,
              timeframe: '15m'
            } as any,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          }
        });

        // Instant Real-Time WebSocket Delivery to all active users & clients
        this.notificationsGateway.server.emit('signal:created', createdSignal);
        await this.notificationsGateway.broadcastTradeSignalNotification(
          `⚡ Live Institutional Gold Signal (${setup.grade})`,
          `${setup.direction} XAU/USD ${setup.orderType.replace(/_/g, ' ')} at $${setup.entryPrice.toFixed(2)} | TP1: $${setup.takeProfit1.toFixed(2)} | SL: $${setup.stopLoss.toFixed(2)}`,
          '/dashboard/engines/gold'
        );

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
    } finally {
      this.isGeneratingSignal = false;
    }
  }

  // Clock-Aligned Candle-Close Engine Heartbeat (Every 5 seconds check)
  // Aligns execution to true candle boundaries (HH:00:05, HH:05:05, HH:10:05 ...)
  // Refreshes HTF on 1H/4H/D1 close, refreshes 15M setup on 15M close,
  // runs entry analysis on closed 5M candle, and handles material news event shockwaves.
  @Interval(5_000)
  async handleClockAlignedEngineHeartbeat() {
    try {
      const now = new Date();
      const day = now.getUTCDay();
      const hour = now.getUTCHours();
      // Market closed on weekends (Friday 22:00 UTC through Sunday 22:00 UTC)
      if (day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 22)) return;

      const nowMs = now.getTime();

      // 1. Check for Material Economic News Event Shockwaves & Blackout Breaches
      await this.checkAndHandleNewsEventTriggers(nowMs);

      // 2. 1H / Higher-Timeframe Candle Close Alignment
      const current1hBar = Math.floor(nowMs / (60 * 60 * 1000)) * (60 * 60 * 1000);
      if (current1hBar > this.lastScanned1hBar) {
        this.lastScanned1hBar = current1hBar;
        // Invalidate higher timeframe candle caches on 1H close so fresh bar closes are fetched
        for (const key of this.candleCache.keys()) {
          if (key.includes(':60') || key.includes(':240') || key.includes(':D') || key.includes(':W')) {
            this.candleCache.delete(key);
          }
        }
        this.logger.log(`[ENGINE_SCHEDULER] 1H candle closed at ${now.toISOString()}. Refreshed HTF context cache.`);
      }

      // 3. 15M Setup Candle Close Alignment
      const current15mBar = Math.floor(nowMs / (15 * 60 * 1000)) * (15 * 60 * 1000);
      if (current15mBar > this.lastScanned15mBar) {
        this.lastScanned15mBar = current15mBar;
        for (const key of this.candleCache.keys()) {
          if (key.includes(':15')) {
            this.candleCache.delete(key);
          }
        }
        this.logger.log(`[ENGINE_SCHEDULER] 15M candle closed at ${now.toISOString()}. Refreshed 15M setup cache.`);
      }

      // 4. 5M Entry Analysis Candle Close Alignment
      // A 5M bar closes at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55.
      // We trigger between 3 and 45 seconds after the exact boundary to ensure data feed has delivered the completed candle.
      const current5mBar = Math.floor(nowMs / (5 * 60 * 1000)) * (5 * 60 * 1000);
      const secondsInto5mBar = Math.floor((nowMs - current5mBar) / 1000);

      if (current5mBar > this.lastScanned5mBar && secondsInto5mBar >= 3) {
        this.lastScanned5mBar = current5mBar;
        this.logger.log(`[ENGINE_SCHEDULER] Closed 5M bar boundary reached (${now.toISOString()}). Initiating revalidation & scan...`);
        await this.revalidateActiveGoldSignals(nowMs);
        await this.handlePeriodicXauusdScan();
      }

      // 5. Background Economic Calendar Maintenance (Every 4h or 30m before imminent tier-1 event)
      await this.checkAndPerformCalendarMaintenance(nowMs);
    } catch (e: any) {
      this.logger.warn(`[handleClockAlignedEngineHeartbeat] Heartbeat notice: ${e.message}`);
    }
  }

  // Scheduled background calendar maintenance: refreshes every 4 hours or 30m before high-impact USD events
  private async checkAndPerformCalendarMaintenance(nowMs: number) {
    try {
      const isDueFor4hRefresh = (nowMs - this.lastCalendarFetchTime) >= this.CALENDAR_CACHE_TTL_MS;

      let isDueForPreEventRefresh = false;
      if (this.cachedCalendarEvents.length > 0 && (nowMs - this.lastCalendarFetchTime) >= 30 * 60 * 1000) {
        const upcomingHighImpact = this.cachedCalendarEvents.find((ev: any) => {
          if (!ev || (ev.country !== 'USD' && ev.currency !== 'USD')) return false;
          const impact = String(ev.impact || '').toLowerCase();
          if (impact !== 'high') return false;
          const evTime = new Date(ev.date).getTime();
          const diffMin = (evTime - nowMs) / 60000;
          return diffMin > 0 && diffMin <= 30;
        });
        if (upcomingHighImpact) {
          isDueForPreEventRefresh = true;
          this.logger.log(`[NewsGate] Upcoming tier-1 event in <=30m (${upcomingHighImpact.title}). Triggering pre-event calendar refresh.`);
        }
      }

      if ((isDueFor4hRefresh || isDueForPreEventRefresh) && !this.inflightCalendarPromise) {
        this.getOrFetchCalendarEvents().catch(err => {
          this.logger.warn(`[NewsGate] Background calendar maintenance notice: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.warn(`[checkAndPerformCalendarMaintenance] Notice: ${err.message}`);
    }
  }

  // Material News Event Handler: Immediately revalidates open signals and protects pending orders
  private async checkAndHandleNewsEventTriggers(nowMs: number) {
    try {
      const newsGate = await this.fetchEconomicNewsGate();

      // Event-driven: check if a previous blackout has just concluded
      if (this.lastActiveBlackoutEvent && (!newsGate.isBlackout || newsGate.eventStage === 'STRUCTURE_REBUILD' || newsGate.eventStage === 'NORMAL_MODE')) {
        const finishedEvent = this.lastActiveBlackoutEvent;
        this.lastActiveBlackoutEvent = null;
        this.logger.log(`[ENGINE_SCHEDULER] News blackout concluded for ${finishedEvent}. Event state RELEASED. Triggering immediate structural re-analysis.`);
        // Invalidate short-term candle cache so fresh post-event candles are ingested immediately
        for (const key of this.candleCache.keys()) {
          if (key.includes(':5') || key.includes(':15') || key.includes(':1')) {
            this.candleCache.delete(key);
          }
        }
        setTimeout(() => {
          this.handlePeriodicXauusdScan().catch(err => {
            this.logger.warn(`[ENGINE_SCHEDULER] Post-news re-scan notice: ${err.message}`);
          });
        }, 3000);
      }

      if (newsGate.isBlackout && newsGate.eventTitle) {
        this.lastActiveBlackoutEvent = newsGate.eventTitle;
      } else {
        return;
      }

      const triggerKey = `${newsGate.eventTitle}_${newsGate.eventStage}_${Math.floor(nowMs / (30 * 60 * 1000))}`;
      if (this.triggeredNewsBlackoutKeys.has(triggerKey)) return;
      this.triggeredNewsBlackoutKeys.add(triggerKey);

      this.logger.warn(`[ENGINE_SCHEDULER] High-Impact News Trigger: ${newsGate.eventTitle} (${newsGate.impactTier}, Stage: ${newsGate.eventStage}, ${newsGate.minutesToEvent}m). Revalidating pending orders.`);

      // Part F Rule 5: news blackout cancels pending unfilled orders (WAITING_FOR_ENTRY) with NEWS_RISK
      const pendingSignals = await this.prisma.signal.findMany({
        where: {
          symbol: 'GOLD',
          direction: { in: ['BUY', 'SELL'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      for (const sig of pendingSignals) {
        const reasoning = (sig.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';
        const isFilled = reasoning.isOrderFilled || status === 'POSITION_OPEN' || status === 'PARTIALLY_FILLED';

        if (status === 'WAITING_FOR_ENTRY' && !isFilled) {
          const newsCancelEvent: SignalLifecycleEvent = {
            timestamp: new Date().toISOString(),
            state: 'CANCELLED',
            reason: 'NEWS_RISK',
            details: `Cancelled before entry due to high-impact economic news event: ${newsGate.eventTitle} (${newsGate.impactTier})`
          };
          const updatedSig = await this.prisma.signal.update({
            where: { id: sig.id },
            data: {
              aiReasoning: {
                ...reasoning,
                status: 'CLOSED',
                lifecycleState: 'CANCELLED',
                outcome: 'CANCELLED',
                closeReason: 'NEWS_RISK',
                closedAt: new Date().toISOString(),
                lastValidatedAt: new Date().toISOString(),
                lastStatusChange: new Date().toISOString(),
                cancellationDetail: `Cancelled before entry due to high-impact economic news event: ${newsGate.eventTitle} (${newsGate.impactTier})`,
                lifecycleEvents: this.appendLifecycleEvent(reasoning, newsCancelEvent)
              }
            }
          });
          this.notificationsGateway.server.emit('signal:updated', updatedSig);
          await this.notificationsGateway.broadcastTradeSignalNotification(
            `⚠️ Pending Order Cancelled: ${sig.direction} Gold`,
            `Pending entry cancelled due to high-impact event (${newsGate.eventTitle}). Capital preserved.`,
            '/dashboard/engines/gold',
            'ORDER_CANCELLED'
          );
          this.logger.log(`[ENGINE_SCHEDULER] Signal ${sig.id} CANCELLED with NEWS_RISK due to ${newsGate.eventTitle}.`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[checkAndHandleNewsEventTriggers] Notice: ${err.message}`);
    }
  }

  // Part F Rule 5: 5M Revalidation of pending signals on completed 15M structure
  private async revalidateActiveGoldSignals(nowMs: number) {
    try {
      const activeSignals = await this.getActiveGoldSignals(3);
      if (activeSignals.length === 0) return;

      const candles15m = await this.fetchXauusdCandles('15min', 50);
      const completed15m = candles15m.length > 1 ? candles15m[candles15m.length - 2] : null;
      const completedClose = completed15m ? completed15m.close : 0;

      for (const sig of activeSignals) {
        const reasoning = (sig.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';
        const isFilled = reasoning.isOrderFilled || status === 'POSITION_OPEN' || status === 'PARTIALLY_FILLED';

        if (status === 'WAITING_FOR_ENTRY' && !isFilled) {
          const sl = Number(sig.stopLoss);
          const invalidationLevel = Number(reasoning.invalidationAndExpiry?.invalidationLevel || sl);
          let structurallyInvalidated = false;

          if (completed15m) {
            if (sig.direction === 'BUY' && completedClose <= invalidationLevel) {
              structurallyInvalidated = true;
            } else if (sig.direction === 'SELL' && completedClose >= invalidationLevel) {
              structurallyInvalidated = true;
            }
          }

          if (structurallyInvalidated) {
            const invEvent: SignalLifecycleEvent = {
              timestamp: new Date(nowMs).toISOString(),
              state: 'INVALIDATED',
              price: completedClose,
              reason: 'THESIS_INVALIDATED_BY_15M_CLOSE',
              details: `Completed 15M candle closed beyond invalidation level ($${invalidationLevel.toFixed(2)}) at $${completedClose.toFixed(2)}.`
            };
            const updatedSig = await this.prisma.signal.update({
              where: { id: sig.id },
              data: {
                aiReasoning: {
                  ...reasoning,
                  status: 'CLOSED',
                  lifecycleState: 'INVALIDATED',
                  outcome: 'CANCELLED',
                  closeReason: 'THESIS_INVALIDATED_BY_15M_CLOSE',
                  closedAt: new Date(nowMs).toISOString(),
                  lastValidatedAt: new Date(nowMs).toISOString(),
                  lastStatusChange: new Date(nowMs).toISOString(),
                  cancellationDetail: `Completed 15M candle closed beyond invalidation level ($${invalidationLevel.toFixed(2)}).`,
                  lifecycleEvents: this.appendLifecycleEvent(reasoning, invEvent)
                }
              }
            });
            this.notificationsGateway.server.emit('signal:updated', updatedSig);
            await this.notificationsGateway.broadcastTradeSignalNotification(
              `⚠️ Pending Order Invalidated: ${sig.direction} Gold`,
              `Structure shifted: 15M bar closed beyond invalidation level ($${invalidationLevel.toFixed(2)}). Order cancelled safely.`,
              '/dashboard/engines/gold',
              'ORDER_CANCELLED'
            );
            this.logger.log(`[LIFECYCLE] Signal ${sig.id} INVALIDATED on 15M candle close at $${completedClose.toFixed(2)}.`);
            continue;
          }

          // Otherwise, refresh lastValidatedAt on the pending signal
          await this.prisma.signal.update({
            where: { id: sig.id },
            data: {
              aiReasoning: {
                ...reasoning,
                lastValidatedAt: new Date(nowMs).toISOString()
              }
            }
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[revalidateActiveGoldSignals] Notice: ${err.message}`);
    }
  }

  // Completed-Candle Gold Analysis Scanner (Triggered on completed 5M candle close)
  async handlePeriodicXauusdScan() {
    if (this.isGeneratingSignal) {
      this.logger.log('[AUTOMATION] Periodic scan skipped: generation mutex is locked by in-flight scan.');
      return;
    }

    this.isGeneratingSignal = true;

    try {
      const now = new Date();
      const day = now.getUTCDay();
      const hour = now.getUTCHours();
      if (day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 22)) return;

      const setup = await this.getOrComputeGoldSetup();

      // Cap at configured max concurrent active signals (default 3)
      const maxSignals = XAUUSD_ENGINE_CONFIG.signalManagement.maxActiveSignalsPerAsset || 3;
      const activeSignals = await this.getActiveGoldSignals(maxSignals);
      if (activeSignals.length >= maxSignals) {
        this.logger.log(`[AUTOMATION] Scan complete: Active signal ceiling reached (${activeSignals.length}/${maxSignals}).`);
        return;
      }

      // Portfolio Exposure Cap (Part F Rule 4 & Part B)
      const maxCombinedRiskR = XAUUSD_ENGINE_CONFIG.signalManagement.maxCombinedRiskR || 2.0;
      const currentCombinedRiskR = activeSignals.reduce((acc, s) => {
        const posRisk = (s.aiReasoning as any)?.positionSizing?.riskPercent || 1.0;
        return acc + posRisk;
      }, 0);
      const candidateRiskR = setup.positionSizing?.riskPercent || 1.0;
      if (currentCombinedRiskR + candidateRiskR > maxCombinedRiskR) {
        this.logger.log(`[AUTOMATION] Scan complete: Exposure cap reached (${currentCombinedRiskR.toFixed(1)}R + ${candidateRiskR.toFixed(1)}R > ${maxCombinedRiskR}R max).`);
        return;
      }

      // Part F Rule 2: 3-rule duplicate setup suppression
      const dupCheck = this.checkIsDuplicateCandidate(setup, activeSignals);
      if (dupCheck.isDuplicate && dupCheck.matchingSignal) {
        const matchingSig = dupCheck.matchingSignal;
        const matchingReasoning = (matchingSig.aiReasoning as any) || {};
        const revalEvent: SignalLifecycleEvent = {
          timestamp: now.toISOString(),
          state: matchingReasoning.lifecycleState || matchingReasoning.status || 'WAITING_FOR_ENTRY',
          price: setup.levels.currentPrice,
          reason: 'REVALIDATED',
          details: `Candidate setup matched active signal (${dupCheck.reason}). Refreshed lastValidatedAt.`
        };
        const updated = await this.prisma.signal.update({
          where: { id: matchingSig.id },
          data: {
            aiReasoning: {
              ...matchingReasoning,
              lastValidatedAt: now.toISOString(),
              lifecycleEvents: this.appendLifecycleEvent(matchingReasoning, revalEvent)
            }
          }
        });
        this.notificationsGateway.server.emit('signal:updated', updated);
        this.logger.log(`[LIFECYCLE] Duplicate setup suppressed. Refreshed lastValidatedAt on ${matchingSig.id} (${matchingReasoning.publicId || matchingSig.id}) due to ${dupCheck.reason}.`);
        return;
      }

      // Part F Rule 6: Opposing-Signal Policy (INVALIDATE_OLD_THESIS_BEFORE_REVERSAL)
      const opposing = activeSignals.find(s => s.direction !== setup.direction);
      if (opposing) {
        const opReasoning = (opposing.aiReasoning as any) || {};
        const opStatus = opReasoning.status || 'ACTIVE';
        const isOpFilled = opReasoning.isOrderFilled || opStatus === 'POSITION_OPEN' || opStatus === 'PARTIALLY_FILLED';

        if (isOpFilled) {
          this.logger.warn(`[LIFECYCLE] Active opposing ${opposing.direction} position (${opposing.id}) is live. Blocking executable ${setup.direction} signal per portfolio risk policy.`);
          return;
        }

        // Opposing is WAITING_FOR_ENTRY (unfilled)
        // Check if market structure shift or gate clearance invalidates the old thesis
        const opSl = Number(opposing.stopLoss);
        const opInvalidated = (opposing.direction === 'BUY' && setup.levels.currentPrice <= opSl) ||
                              (opposing.direction === 'SELL' && setup.levels.currentPrice >= opSl);

        if (opInvalidated || (setup.fiveGates.allPassed && setup.finalValidationChecklist?.allPassed)) {
          const opInvEvent: SignalLifecycleEvent = {
            timestamp: now.toISOString(),
            state: 'INVALIDATED',
            price: setup.levels.currentPrice,
            reason: 'OPPOSING_THESIS_INVALIDATION',
            details: `Pending ${opposing.direction} order invalidated by structural shift into ${setup.direction}.`
          };
          const updatedOp = await this.prisma.signal.update({
            where: { id: opposing.id },
            data: {
              aiReasoning: {
                ...opReasoning,
                status: 'CLOSED',
                lifecycleState: 'INVALIDATED',
                outcome: 'CANCELLED',
                closeReason: 'OPPOSING_THESIS_INVALIDATION',
                closedAt: now.toISOString(),
                lastValidatedAt: now.toISOString(),
                lastStatusChange: now.toISOString(),
                lifecycleEvents: this.appendLifecycleEvent(opReasoning, opInvEvent)
              }
            }
          });
          this.notificationsGateway.server.emit('signal:updated', updatedOp);
          await this.notificationsGateway.broadcastTradeSignalNotification(
            `🔄 Pending Order Invalidated: ${opposing.direction} Gold`,
            `Pending ${opposing.direction} order cancelled due to structural trend reversal into ${setup.direction}.`,
            '/dashboard/engines/gold',
            'ORDER_CANCELLED'
          );
          this.logger.log(`[LIFECYCLE] Opposing pending signal ${opposing.id} marked INVALIDATED before publishing new ${setup.direction} signal.`);
        } else {
          this.logger.log(`[LIFECYCLE] Opposing pending signal ${opposing.id} is still valid. Blocking publication of conflicting ${setup.direction} signal.`);
          return;
        }
      }

      if (setup.fiveGates.allPassed && setup.finalValidationChecklist?.allPassed && (setup.direction === 'BUY' || setup.direction === 'SELL') && setup.opportunityScore >= 70) {
        // Run AI Desk Review before automated publishing
        let aiVerdict = setup.fiveGates.allPassed ? 'APPROVED' : 'HOLD';
        let aiExplanation = setup.summary;
        let aiReviewStatus: 'AI_REVIEWED' | 'AI_SERVICE_OFFLINE' = 'AI_SERVICE_OFFLINE';
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
              session: setup.hierarchy?.level1_marketEnvironment?.session || (setup.levels as any)?.session || 'Active Session',
              intermarket: setup.intermarket,
              microstructure: setup.microstructure,
              news_gate: setup.newsGate,
              market_regime: setup.marketRegime,
              volatility_metrics: setup.volatilityMetrics,
              volume_profile: setup.volumeProfile,
              expectancy: {
                ...setup.tradePath,
                calibratedWinRateTp1: setup.tradePath.probTp1BeforeSl
              },
              position_sizing: setup.positionSizing
            })
          }, 5000);

          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            if (aiJson && aiJson.ai_review_verdict) {
              aiVerdict = aiJson.ai_review_verdict;
              aiExplanation = aiJson.ai_explanation || aiExplanation;
              aiReviewStatus = 'AI_REVIEWED';
            }
          }
        } catch (e: any) {
          this.logger.warn(`[AUTOMATION] AI service desk review check notice: ${e.message}`);
        }

        if (aiVerdict === 'VETOED') {
          this.logger.warn(`[AUTOMATION] Candidate signal vetoed by Senior AI Desk Reviewer: ${aiExplanation}`);
          return;
        }

        // FAIL-CLOSED REQUIREMENT: Senior AI Desk Review must explicitly be AI_REVIEWED and APPROVED
        if (aiReviewStatus !== 'AI_REVIEWED' || aiVerdict !== 'APPROVED') {
          this.logger.warn(`[AUTOMATION] Candidate signal publishing blocked: Senior AI Desk Review requires explicit APPROVED status (status: ${aiReviewStatus}, verdict: ${aiVerdict})`);
          return;
        }

        this.logger.log(`[AUTOMATION] 5-Gate Cleared & Gemini AI Approved ${setup.grade} ${setup.orderType} on XAUUSD (Score: ${setup.opportunityScore}, EV: +${setup.tradePath.expectedValueR}R)`);

        const isImmediateMarket = setup.orderType.includes('MARKET');
        const initialLifecycleState = isImmediateMarket ? 'POSITION_OPEN' : 'WAITING_FOR_ENTRY';
        const orderValidityExpiresAt = new Date(Date.now() + setup.invalidationAndExpiry.orderExpiryHours * 60 * 60 * 1000).toISOString();

        // Part F Rule 1: Generate Human-Readable Institutional Public ID (e.g. G-20261030-001)
        const publicId = await this.generateInstitutionalSignalId(now);
        const initialEvent: SignalLifecycleEvent = {
          timestamp: now.toISOString(),
          state: initialLifecycleState,
          price: setup.entryPrice,
          reason: 'SIGNAL_PUBLISHED',
          details: `Published ${setup.grade} ${setup.orderType} (Score: ${setup.opportunityScore}, EV: +${setup.tradePath.expectedValueR}R)`
        };

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
            confluenceScore: setup.opportunityScore,
            durationEstimate: '4-8 hours',
            aiReasoning: {
              publicId,
              status: initialLifecycleState,
              lifecycleState: initialLifecycleState,
              isOrderFilled: isImmediateMarket,
              filledAt: isImmediateMarket ? new Date().toISOString() : null,
              filledPrice: isImmediateMarket ? setup.entryPrice : null,
              orderValidityExpiresAt,
              orderType: setup.orderType,
              entryZone: setup.entryZone,
              strategy: setup.model,
              signalGrade: setup.grade,
              opportunityScore: setup.opportunityScore,
              confluenceScore: setup.opportunityScore,
              marketBiasScore: setup.marketBiasScore,
              entryQualityScore: setup.entryQualityScore,
              fiveGates: setup.fiveGates,
              finalValidationChecklist: setup.finalValidationChecklist,
              tradePath: setup.tradePath,
              invalidationAndExpiry: setup.invalidationAndExpiry,
              positionSizing: setup.positionSizing,
              auditTrail: setup.auditTrail,
              indicators: setup.confluenceReasons,
              explanation: aiExplanation,
              aiReviewVerdict: aiVerdict,
              aiReviewStatus,
              levels: setup.levels,
              marketRegime: setup.marketRegime,
              volatilityMetrics: setup.volatilityMetrics,
              volumeProfile: setup.volumeProfile,
              microstructure: setup.microstructure,
              intermarket: setup.intermarket,
              lastValidatedAt: now.toISOString(),
              lifecycleEvents: [initialEvent],
              timeframe: '15m'
            } as any,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          }
        });

        // Broadcast automated signal instantly to all connected WebSocket users
        this.notificationsGateway.server.emit('signal:created', createdSignal);
        await this.notificationsGateway.broadcastTradeSignalNotification(
          `⚡ Live Institutional Gold Signal (${setup.grade}) [${publicId}]`,
          `${setup.direction} XAU/USD ${setup.orderType.replace(/_/g, ' ')} @ $${setup.entryPrice.toFixed(2)} | TP1: $${setup.takeProfit1.toFixed(2)} | SL: $${setup.stopLoss.toFixed(2)}`,
          '/dashboard/engines/gold'
        );
      }
    } catch (e: any) {
      this.logger.warn(`[handlePeriodicXauusdScan] Scan notice: ${e.message}`);
    } finally {
      this.isGeneratingSignal = false;
    }
  }

  // Real-time Active Position Management (Tracks every 30 seconds)
  @Interval(30_000)
  async handlePositionManagement() {
    try {
      const now = new Date();
      const candidateSignals = await this.prisma.signal.findMany({
        where: {
          symbol: 'GOLD',
          direction: { in: ['BUY', 'SELL'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      const activeSignals = candidateSignals.filter(s => this.isSignalActive(s));
      if (activeSignals.length === 0) return;

      const quotes = await this.fetchTradingViewQuotes('cfd', ['OANDA:XAUUSD', 'FOREXCOM:XAUUSD', 'TVC:GOLD', 'FX_IDC:XAUUSD']);
      const providers = [quotes['OANDA:XAUUSD'], quotes['FOREXCOM:XAUUSD'], quotes['TVC:GOLD'], quotes['FX_IDC:XAUUSD']].filter(
        q => q && q.price > 1000
      );
      const withBidAsk = providers.find(q => q.bid && q.ask && q.bid > 1000 && q.ask >= q.bid);
      const currentPrice = withBidAsk?.price || providers[0]?.price;
      if (!currentPrice || currentPrice <= 1000) return;

      const currentBid = withBidAsk?.bid || currentPrice;
      const currentAsk = withBidAsk?.ask || currentPrice;

      for (const signal of activeSignals) {
        const reasoning = (signal.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';

        if (['CLOSED', 'TP2_HIT', 'SL_HIT', 'THESIS_INVALIDATED', 'CANCELLED', 'EXPIRED', 'INVALIDATED'].includes(status)) continue;

        const orderType: string = reasoning.orderType || (signal.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT');
        const entryZone: [number, number] = Array.isArray(reasoning.entryZone) && reasoning.entryZone.length === 2
          ? reasoning.entryZone
          : [signal.entryPrice - 0.5, signal.entryPrice + 0.5];

        let isOrderFilled = Boolean(
          reasoning.isOrderFilled ||
          status === 'TP1_HIT' ||
          status === 'POSITION_OPEN' ||
          status === 'PARTIALLY_FILLED' ||
          reasoning.trailingStopBe ||
          orderType === 'MARKET_BUY' ||
          orderType === 'MARKET_SELL'
        );
        let newlyFilled = false;

        if (!isOrderFilled) {
          // 1. Pre-fill Thesis Invalidation: If market trades through Stop Loss before limit order fills,
          // cancel the pending order immediately so capital is not exposed to an invalidated thesis!
          const stopLossHitPreFill =
            (signal.direction === 'BUY' && currentBid <= signal.stopLoss) ||
            (signal.direction === 'SELL' && currentAsk >= signal.stopLoss);

          if (stopLossHitPreFill) {
            const breachPrice = signal.direction === 'BUY' ? currentBid : currentAsk;
            const cancelEvent: SignalLifecycleEvent = {
              timestamp: now.toISOString(),
              state: 'CANCELLED',
              price: breachPrice,
              reason: 'THESIS_INVALIDATED_PRE_FILL',
              details: `Price breached structural stop loss level ($${breachPrice.toFixed(2)}) before limit entry was filled.`
            };
            const updatedSig = await this.prisma.signal.update({
              where: { id: signal.id },
              data: {
                aiReasoning: {
                  ...reasoning,
                  status: 'CLOSED',
                  lifecycleState: 'CANCELLED',
                  outcome: 'CANCELLED',
                  closeReason: 'THESIS_INVALIDATED_PRE_FILL',
                  closedAt: now.toISOString(),
                  lastCheckedPrice: currentPrice,
                  lastValidatedAt: now.toISOString(),
                  lastStatusChange: now.toISOString(),
                  cancellationDetail: `Price breached structural stop loss level ($${breachPrice.toFixed(2)}) before limit entry was filled.`,
                  lifecycleEvents: this.appendLifecycleEvent(reasoning, cancelEvent)
                }
              }
            });
            this.notificationsGateway.server.emit('signal:updated', updatedSig);
            await this.notificationsGateway.broadcastTradeSignalNotification(
              `⚠️ Pending Order Cancelled: ${signal.direction} Gold`,
              `Limit entry cancelled: Price breached stop loss ($${signal.stopLoss.toFixed(2)}) before order was filled. Thesis invalidated.`,
              '/dashboard/engines/gold',
              'ORDER_CANCELLED'
            );
            continue;
          }

          // 2. Realistic Institutional Fill Execution (Buy at Ask, Sell at Bid)
          if (signal.direction === 'BUY' && currentAsk <= Math.max(signal.entryPrice, entryZone[1])) {
            isOrderFilled = true;
            newlyFilled = true;
          } else if (signal.direction === 'SELL' && currentBid >= Math.min(signal.entryPrice, entryZone[0])) {
            isOrderFilled = true;
            newlyFilled = true;
          }
        }

        // 3. Unfilled Limit Order Expiration & Ran-Away Handlers
        if (!isOrderFilled) {
          const entryVal = Number(signal.entryPrice);
          const tp1Val = Number(signal.takeProfit1);
          const tpDistance = Math.abs(tp1Val - entryVal);
          const thresholdDistance = tpDistance * 0.70;

          const ranAwayToTp1 =
            (signal.direction === 'BUY' && currentBid >= (entryVal + thresholdDistance)) ||
            (signal.direction === 'SELL' && currentAsk <= (entryVal - thresholdDistance));

          if (ranAwayToTp1) {
            const missedEvent: SignalLifecycleEvent = {
              timestamp: now.toISOString(),
              state: 'EXPIRED',
              price: currentPrice,
              reason: 'ENTRY_MISSED',
              details: `Price moved 70%+ to TP1 without filling limit order entry zone.`
            };
            const updatedSig = await this.prisma.signal.update({
              where: { id: signal.id },
              data: {
                aiReasoning: {
                  ...reasoning,
                  status: 'CLOSED',
                  lifecycleState: 'EXPIRED',
                  outcome: 'UNFILLED',
                  closeReason: 'ENTRY_MISSED',
                  closedAt: now.toISOString(),
                  lastCheckedPrice: currentPrice,
                  lastValidatedAt: now.toISOString(),
                  lastStatusChange: now.toISOString(),
                  cancellationDetail: `Price moved 70%+ to TP1 without filling limit order entry zone.`,
                  lifecycleEvents: this.appendLifecycleEvent(reasoning, missedEvent)
                }
              }
            });
            this.notificationsGateway.server.emit('signal:updated', updatedSig);
            await this.notificationsGateway.broadcastTradeSignalNotification(
              `⏱️ Pending Order Expired: ${signal.direction} Gold`,
              `Limit entry retired (Entry missed: price rallied 70%+ towards TP1 without pullback).`,
              '/dashboard/engines/gold',
              'ORDER_CANCELLED'
            );
            continue;
          }

          const orderValidityExpiresAt = reasoning.orderValidityExpiresAt ? new Date(reasoning.orderValidityExpiresAt).getTime() : 0;
          if (orderValidityExpiresAt > 0 && now.getTime() >= orderValidityExpiresAt) {
            const expiredEvent: SignalLifecycleEvent = {
              timestamp: now.toISOString(),
              state: 'EXPIRED',
              price: currentPrice,
              reason: 'ORDER_EXPIRED',
              details: `Limit entry expired after ${reasoning.invalidationAndExpiry?.orderExpiryHours || 4} hours.`
            };
            const updatedSig = await this.prisma.signal.update({
              where: { id: signal.id },
              data: {
                aiReasoning: {
                  ...reasoning,
                  status: 'CLOSED',
                  lifecycleState: 'EXPIRED',
                  outcome: 'UNFILLED',
                  closeReason: 'ORDER_EXPIRED',
                  closedAt: now.toISOString(),
                  lastCheckedPrice: currentPrice,
                  lastValidatedAt: now.toISOString(),
                  lastStatusChange: now.toISOString(),
                  lifecycleEvents: this.appendLifecycleEvent(reasoning, expiredEvent)
                }
              }
            });
            this.notificationsGateway.server.emit('signal:updated', updatedSig);
            await this.notificationsGateway.broadcastTradeSignalNotification(
              `⏱️ Pending Order Expired: ${signal.direction} Gold`,
              `Limit entry expired after ${reasoning.invalidationAndExpiry?.orderExpiryHours || 4} hours.`,
              '/dashboard/engines/gold',
              'ORDER_CANCELLED'
            );
            continue;
          }
          continue;
        }

        let updatedStatus = status;
        let shouldMoveSlToBe = false;
        let runnerClosedAtBreakeven = false;
        const isAlreadyTp1OrBe = status === 'TP1_HIT' || status === 'PARTIALLY_FILLED' || Boolean(reasoning.trailingStopBe);

        // Execution pricing:
        // BUY positions close at BID
        // SELL positions close at ASK
        const exitPrice = signal.direction === 'BUY' ? currentBid : currentAsk;
        const fillExecutionPrice = signal.direction === 'BUY' ? currentAsk : currentBid;

        if (signal.direction === 'BUY') {
          if (currentBid >= signal.takeProfit2) {
            updatedStatus = 'TP2_HIT';
          } else if (currentBid >= signal.takeProfit1 && status !== 'TP1_HIT' && status !== 'PARTIALLY_FILLED') {
            updatedStatus = 'TP1_HIT';
            if (signal.stopLoss < signal.entryPrice) shouldMoveSlToBe = true;
          } else if (currentBid <= signal.stopLoss) {
            // CRITICAL: If TP1 was already hit and SL is at Breakeven, hitting Breakeven closes the runner as a TP1_HIT WIN, NEVER SL_HIT!
            if (isAlreadyTp1OrBe) {
              updatedStatus = 'TP1_HIT';
              runnerClosedAtBreakeven = true;
            } else {
              updatedStatus = 'SL_HIT';
            }
          }
        } else if (signal.direction === 'SELL') {
          if (currentAsk <= signal.takeProfit2) {
            updatedStatus = 'TP2_HIT';
          } else if (currentAsk <= signal.takeProfit1 && status !== 'TP1_HIT' && status !== 'PARTIALLY_FILLED') {
            updatedStatus = 'TP1_HIT';
            if (signal.stopLoss > signal.entryPrice) shouldMoveSlToBe = true;
          } else if (currentAsk >= signal.stopLoss) {
            // CRITICAL: If TP1 was already hit and SL is at Breakeven, hitting Breakeven closes the runner as a TP1_HIT WIN, NEVER SL_HIT!
            if (isAlreadyTp1OrBe) {
              updatedStatus = 'TP1_HIT';
              runnerClosedAtBreakeven = true;
            } else {
              updatedStatus = 'SL_HIT';
            }
          }
        }

        if (newlyFilled && updatedStatus === status && !shouldMoveSlToBe && !runnerClosedAtBreakeven) {
          const fillEvent: SignalLifecycleEvent = {
            timestamp: now.toISOString(),
            state: 'POSITION_OPEN',
            price: fillExecutionPrice,
            reason: 'ORDER_FILLED',
            details: `Limit order filled at $${fillExecutionPrice.toFixed(2)}. Position is now LIVE.`
          };
          const updatedSig = await this.prisma.signal.update({
            where: { id: signal.id },
            data: {
              aiReasoning: {
                ...reasoning,
                status: 'POSITION_OPEN',
                lifecycleState: 'POSITION_OPEN',
                isOrderFilled: true,
                filledAt: now.toISOString(),
                filledPrice: fillExecutionPrice,
                lastCheckedPrice: currentPrice,
                lastValidatedAt: now.toISOString(),
                lastStatusChange: now.toISOString(),
                lifecycleEvents: this.appendLifecycleEvent(reasoning, fillEvent)
              }
            }
          });
          this.notificationsGateway.server.emit('signal:updated', updatedSig);
          await this.notificationsGateway.broadcastTradeSignalNotification(
            `🚀 Limit Order Filled: ${signal.direction} Gold`,
            `Gold entry filled @ $${fillExecutionPrice.toFixed(2)}. Position is now LIVE.`,
            '/dashboard/engines/gold',
            'ORDER_FILLED'
          );
          continue;
        }

        if (updatedStatus !== status || shouldMoveSlToBe || runnerClosedAtBreakeven) {
          this.logger.log(`[POSITION_MANAGER] Signal ${signal.id} status updated: ${status} -> ${updatedStatus}${runnerClosedAtBreakeven ? ' (Runner closed at BE)' : ''} @ $${exitPrice}`);

          const isFinalExit = ['SL_HIT', 'TP2_HIT'].includes(updatedStatus) || runnerClosedAtBreakeven;

          if (updatedStatus === 'SL_HIT') {
            this.lastStopLossHit = {
              direction: signal.direction as 'BUY' | 'SELL',
              stopLossPrice: signal.stopLoss,
              timestamp: Date.now()
            };
          } else if (updatedStatus.startsWith('TP')) {
            this.lastStopLossHit = null;
          }

          let pnlR = 0;
          let finalOutcome = 'CLOSED';
          if (runnerClosedAtBreakeven) {
            finalOutcome = 'BREAKEVEN';
            pnlR = parseFloat((signal.riskRewardRatio * 0.5).toFixed(2));
          } else if (updatedStatus === 'SL_HIT') {
            finalOutcome = 'SL_HIT';
            pnlR = -1.0;
          } else if (updatedStatus === 'TP2_HIT') {
            finalOutcome = 'TP2_HIT';
            pnlR = parseFloat((signal.riskRewardRatio * 1.5).toFixed(2));
          } else {
            finalOutcome = updatedStatus;
            pnlR = parseFloat(signal.riskRewardRatio.toFixed(2));
          }

          if ((['SL_HIT', 'TP2_HIT'].includes(updatedStatus) || (updatedStatus === 'TP1_HIT' && !runnerClosedAtBreakeven))) {
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

          let transitionEvent: SignalLifecycleEvent;
          if (runnerClosedAtBreakeven) {
            transitionEvent = {
              timestamp: now.toISOString(),
              state: 'CLOSED',
              price: exitPrice,
              reason: 'RUNNER_BREAKEVEN',
              details: `Runner closed safely at entry price ($${signal.entryPrice.toFixed(2)}) after securing TP1.`
            };
          } else if (shouldMoveSlToBe) {
            transitionEvent = {
              timestamp: now.toISOString(),
              state: 'PARTIALLY_FILLED',
              price: exitPrice,
              reason: 'TP1_HIT_SL_MOVED_TO_BE',
              details: `TP1 reached at $${exitPrice.toFixed(2)}. Stop loss moved to Breakeven ($${signal.entryPrice.toFixed(2)}).`
            };
          } else if (isFinalExit) {
            transitionEvent = {
              timestamp: now.toISOString(),
              state: 'CLOSED',
              price: exitPrice,
              reason: updatedStatus === 'SL_HIT' ? 'STOP_LOSS_REACHED' : 'FULL_TARGET_2_REACHED',
              details: `Trade closed: ${updatedStatus} at $${exitPrice.toFixed(2)} (PnL: ${pnlR >= 0 ? '+' : ''}${pnlR}R).`
            };
          } else {
            transitionEvent = {
              timestamp: now.toISOString(),
              state: updatedStatus,
              price: exitPrice,
              reason: 'STATUS_UPDATE',
              details: `Status transition to ${updatedStatus} at $${exitPrice.toFixed(2)}.`
            };
          }

          const updateData: any = {
            aiReasoning: {
              ...reasoning,
              status: isFinalExit ? 'CLOSED' : (updatedStatus === 'TP1_HIT' ? 'PARTIALLY_FILLED' : updatedStatus),
              lifecycleState: isFinalExit ? 'CLOSED' : (updatedStatus === 'TP1_HIT' ? 'PARTIALLY_FILLED' : 'POSITION_OPEN'),
              outcome: isFinalExit ? finalOutcome : (updatedStatus === 'TP1_HIT' ? 'TP1_HIT' : null),
              isOrderFilled: true,
              runnerClosedAtBreakeven: runnerClosedAtBreakeven || reasoning.runnerClosedAtBreakeven,
              lastCheckedPrice: currentPrice,
              lastValidatedAt: now.toISOString(),
              exitPrice: isFinalExit ? exitPrice : undefined,
              pnlR: isFinalExit ? pnlR : undefined,
              lastStatusChange: now.toISOString(),
              trailingStopBe: shouldMoveSlToBe || reasoning.trailingStopBe,
              lifecycleEvents: this.appendLifecycleEvent(reasoning, transitionEvent)
            }
          };

          if (shouldMoveSlToBe) {
            updateData.stopLoss = signal.entryPrice; // Trailing Stop moved to Breakeven after TP1 hit!
          }

          if (isFinalExit) {
            // Concludes active lifecycle without shortening 90-day retention
            updateData.aiReasoning.closedAt = now.toISOString();
            updateData.aiReasoning.closeReason = runnerClosedAtBreakeven
              ? 'RUNNER_BREAKEVEN'
              : updatedStatus === 'SL_HIT'
              ? 'STOP_LOSS_REACHED'
              : updatedStatus === 'TP2_HIT'
              ? 'FULL_TARGET_2_REACHED'
              : 'POSITION_CLOSED';

            // Sync with GoldSignalPerformance for persistent analytics
            try {
              await this.prisma.goldSignalPerformance.upsert({
                where: { signalId: signal.id },
                update: {
                  exitPrice: exitPrice,
                  result: pnlR > 0 ? 'WIN' : pnlR === 0 ? 'BREAKEVEN' : 'LOSS',
                  pnlR,
                  exitReason: updateData.aiReasoning.closeReason,
                  closedAt: now
                },
                create: {
                  signalId: signal.id,
                  symbol: 'GOLD',
                  direction: signal.direction,
                  entryPrice: reasoning.filledPrice || signal.entryPrice,
                  exitPrice: exitPrice,
                  result: pnlR > 0 ? 'WIN' : pnlR === 0 ? 'BREAKEVEN' : 'LOSS',
                  pnlR,
                  exitReason: updateData.aiReasoning.closeReason,
                  createdAt: signal.createdAt,
                  closedAt: now
                }
              });
            } catch (perfErr: any) {
              this.logger.warn(`[handlePositionManagement] GoldSignalPerformance sync notice: ${perfErr.message}`);
            }
          }

          const updatedSig = await this.prisma.signal.update({
            where: { id: signal.id },
            data: updateData
          });

          // Broadcast real-time position status update to client charts
          this.notificationsGateway.server.emit('signal:updated', updatedSig);

          if (!runnerClosedAtBreakeven) {
            const notifSubType: 'TARGET_HIT' | 'STOP_HIT' = updatedStatus.startsWith('TP') ? 'TARGET_HIT' : 'STOP_HIT';
            const title = updatedStatus === 'TP2_HIT'
              ? '🎯 Take Profit 2 Hit! Trade Complete'
              : updatedStatus === 'TP1_HIT'
              ? '🎯 Take Profit 1 Hit (SL Moved to Breakeven)'
              : '🛑 Stop Loss Hit';
            const message = `Gold ${signal.direction} reached ${updatedStatus.replace(/_/g, ' ')} @ $${exitPrice.toFixed(2)}${shouldMoveSlToBe ? ' (SL moved to breakeven)' : ''}`;

            await this.notificationsGateway.broadcastTradeSignalNotification(
              title,
              message,
              '/dashboard/engines/gold',
              notifSubType
            );
          } else {
            await this.notificationsGateway.broadcastTradeSignalNotification(
              '🛡️ Runner Closed at Breakeven',
              `Gold ${signal.direction} runner closed safely at entry ($${signal.entryPrice.toFixed(2)}) after securing TP1 profit.`,
              '/dashboard/engines/gold',
              'TARGET_HIT'
            );
          }

          // ONCE REACHED: Wait 60s after SL_HIT (or 5s after TP) so the stop-sweep candle settles before scanning next setup
          if (isFinalExit) {
            const delayMs = updatedStatus === 'SL_HIT' ? 60_000 : 5_000;
            this.logger.log(`[POSITION_MANAGER] Trade complete on Gold (${updatedStatus}). Scheduling next structural scan in ${delayMs / 1000}s...`);
            setTimeout(() => {
              this.handlePeriodicXauusdScan().catch(err => {
                this.logger.warn(`[POSITION_MANAGER] Next signal auto-regeneration notice: ${err.message}`);
              });
            }, delayMs);
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`[handlePositionManagement] notice: ${e.message}`);
    }
  }

  // Daily maintenance job: prune signals older than 90 days
  @Interval(24 * 60 * 60 * 1000)
  async pruneOldSignalHistory() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const res = await this.prisma.signal.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo }
        }
      });
      if (res.count > 0) {
        this.logger.log(`[RETENTION] Pruned ${res.count} signals older than 90 days.`);
      }
    } catch (e: any) {
      this.logger.warn(`[RETENTION] Signal retention prune error: ${e.message}`);
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
  @ApiOperation({ summary: 'Archive signal (retains audit trail without deleting from database)' })
  async deleteSignal(@Param('id') id: string) {
    let deletedSymbol: string | null = null;
    try {
      const existing = await this.prisma.signal.findUnique({
        where: { id },
        select: { id: true, symbol: true, aiReasoning: true }
      });
      if (existing) {
        deletedSymbol = existing.symbol;
        await this.prisma.signal.update({
          where: { id },
          data: {
            expiresAt: new Date(),
            aiReasoning: {
              ...((existing.aiReasoning as any) || {}),
              status: 'CANCELLED',
              closeReason: 'MANUAL_ARCHIVE',
              closedAt: new Date().toISOString()
            } as any
          }
        });
        this.logger.log(`[SignalsController] Signal ${id} (${deletedSymbol}) archived cleanly.`);
      }
    } catch (err: any) {
      this.logger.warn(`[SignalsController] Failed to archive signal ${id}: ${err.message}`);
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

    if (trs.length < period * 2) return 20.0;

    // 1. Initial 14-period sum for Wilder's smoothing baseline
    let trSmooth = trs.slice(0, period).reduce((a, b) => a + b, 0);
    let plusDMSmooth = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
    let minusDMSmooth = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

    const dxValues: number[] = [];
    const calcDx = (pDm: number, mDm: number, tr: number): number => {
      if (tr <= 0) return 0;
      const pDi = (pDm / tr) * 100;
      const mDi = (mDm / tr) * 100;
      const sum = pDi + mDi;
      return sum > 0 ? (Math.abs(pDi - mDi) / sum) * 100 : 0;
    };

    dxValues.push(calcDx(plusDMSmooth, minusDMSmooth, trSmooth));

    // 2. Wilder's running smoothing across remaining bars to build true DX series
    for (let i = period; i < trs.length; i++) {
      trSmooth = trSmooth - (trSmooth / period) + trs[i];
      plusDMSmooth = plusDMSmooth - (plusDMSmooth / period) + plusDMs[i];
      minusDMSmooth = minusDMSmooth - (minusDMSmooth / period) + minusDMs[i];
      dxValues.push(calcDx(plusDMSmooth, minusDMSmooth, trSmooth));
    }

    if (dxValues.length < period) {
      return parseFloat((dxValues[dxValues.length - 1] || 20.0).toFixed(1));
    }

    // 3. Smooth the DX series using Wilder's smoothing to obtain canonical ADX
    let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxValues.length; i++) {
      adx = (adx * (period - 1) + dxValues[i]) / period;
    }

    return parseFloat(adx.toFixed(1));
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
  imports: [SubscriptionModule, AutomationModule, NotificationsModule],
  controllers: [SignalsController],
  providers: [SignalsController],
  exports: [SignalsController],
})
export class SignalsModule {}
