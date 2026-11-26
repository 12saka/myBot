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
import { replaySignalLifecycle, computeLegacyRealizedR, LifecycleBar, LifecycleInput, LifecycleEventType } from './signal-lifecycle.engine';
import {
  NewsMomentumService,
  ActiveNewsMemoryItem,
  NewsPersistenceState,
  MonitoringWindowStage,
  NewsScoreBreakdown,
  NewsCategory,
  NewsBias,
  NewsStatus
} from './news-momentum.service';
export {
  NewsMomentumService,
  ActiveNewsMemoryItem,
  NewsPersistenceState,
  MonitoringWindowStage,
  NewsScoreBreakdown,
  NewsCategory,
  NewsBias,
  NewsStatus
};
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
  displacementRatio?: number;
  isRetested?: boolean;
  causedBos?: boolean;
  createdFvg?: boolean;
  priorSweepConfirmed?: boolean;
  grade?: 'GRADE_A_PLUS' | 'GRADE_A' | 'GRADE_B';
  proximalBoundary?: number;
  distalBoundary?: number;
  mitigationPct?: number;
  timeframe?: string;
}

export interface FairValueGap {
  type: 'BULLISH' | 'BEARISH';
  top: number;
  bottom: number;
  midpoint: number;
  size: number;
  candleIndex: number;
  mitigated: boolean;
  displacementRatio?: number;
  consequentEncroachment?: number;
  isRetested?: boolean;
  proximalEdge?: number;
  distalEdge?: number;
  ce50?: number;
  mitigationPct?: number;
  timeframe?: string;
}

export interface LtfConfirmationResult {
  isConfirmed: boolean;
  m5Sweep: boolean;
  m5RejectionWick: boolean;
  m1Choch: boolean;
  m1Displacement: boolean;
  m1Fvg: FairValueGap | null;
  sniperEntryPrice: number | null;
  sniperStopLoss: number | null;
  entryMethod: 'LTF_SNIPER_FVG' | 'FVG_CE_50' | 'OB_PROXIMAL' | 'NONE';
  invalidationDistancePips: number;
  confirmationReason: string;
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
  macroBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  macroDrawOnLiquidity?: 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY' | 'RANGE_EQUILIBRIUM';
  dxyMomentum?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  us10yMomentum?: 'RISING' | 'FALLING' | 'NEUTRAL';
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
  eventTimeUtc?: string | null;
  impactTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  feedOffline?: boolean;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
  fundamentalBias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  fundamentalSummary?: string;
  postNewsContinuation?: 'BUY' | 'SELL' | null;
  newsPersistence?: NewsPersistenceState;
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
  evaluatedSmcOptions?: any[];
  selectedEntryMethod?: string;
  expectedMfeR?: number;
  expectedMaeR?: number;
  expectedHoldingMinutes?: number;
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
  sessionOpeningPlay?: SessionOpeningPlay;
}

export interface SessionOpeningPlay {
  tag: 'LONDON_OPEN_SWEEP' | 'NY_ORB_BREAKOUT' | 'NY_AM_SILVER_BULLET' | 'LONDON_SILVER_BULLET' | 'NY_PM_SILVER_BULLET' | 'POST_NEWS_FVG_CONTINUATION' | 'STANDARD_STRUCTURE';
  badgeLabel: string;
  sessionWindow: string;
  catalyst: string;
  confidenceBoost: number;
}

export interface XauusdInstitutionalSetup {
  fiveGates: FiveGatesSummary;
  finalValidationChecklist: FinalValidationChecklist;
  orderType: OrderType;
  model: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'LTF_SNIPER_FVG' | 'NONE';
  sessionOpeningPlay?: SessionOpeningPlay;
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
  private tvWsRateLimitedUntil: number = 0;
  private cachedGoldSetup: { timestamp: number; setup: XauusdInstitutionalSetup } | null = null;
  private readonly GOLD_SETUP_CACHE_TTL_MS = 3500; // 3.5s cache for concurrent cockpit tab queries
  private inflightGoldSetupPromise: Promise<XauusdInstitutionalSetup> | null = null;
  private cachedIntermarket: { timestamp: number; data: IntermarketState } | null = null;
  private inflightIntermarketPromise: Promise<IntermarketState> | null = null;
  private cachedMicrostructure: { timestamp: number; data: MicrostructureState } | null = null;
  private inflightMicrostructurePromise: Promise<MicrostructureState> | null = null;
  private cachedCalendarEvents: any[] = [];
  private lastCalendarFetchTime: number = 0;
  private readonly CALENDAR_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hour memory cache (weekly schedule rarely changes intraday)
  private inflightCalendarPromise: Promise<any[]> | null = null;
  private nextAllowedCalendarFetchTime: number = 0;
  private calendarFetchFailureCount: number = 0;
  private readonly calendarDiskCachePath = path.join(process.cwd(), '.cache', 'forexfactory_calendar.json');

  // News Momentum & Persistence Memory (delegated to NewsMomentumService)
  get activeNewsMemory(): ActiveNewsMemoryItem[] {
    return this.newsMomentumService.getActiveMemory();
  }

  // Clock-aligned candle-close & event-driven scheduler tracking (Phase 6)
  private lastScanned5mBar: number = 0;
  private lastScanned15mBar: number = 0;
  private lastScanned1hBar: number = 0;
  private triggeredNewsBlackoutKeys: Set<string> = new Set();
  private lastActiveBlackoutEvent: string | null = null;
  private static scanLockPromise: Promise<any> | null = null;
  private static goldPublishMutex: Map<string, number> = new Map();
  get isGeneratingSignal(): boolean {
    return SignalsController.scanLockPromise !== null;
  }
  set isGeneratingSignal(_val: boolean) {
    // backward compatibility
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly automationService: AutomationService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly newsMomentumService: NewsMomentumService,
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

    // Load active news event memory from disk so multi-day influential catalysts persist across reboots
    this.loadNewsMemoryFromDisk();

    // Trigger asynchronous background calendar refresh if cache is expired or missing
    if (this.cachedCalendarEvents.length === 0 || (Date.now() - this.lastCalendarFetchTime) >= this.CALENDAR_CACHE_TTL_MS) {
      this.getOrFetchCalendarEvents().catch(err => {
        this.logger.warn(`[NewsGate] Boot calendar sync notice: ${err.message}`);
      });
    }

    // Purge legacy unfilled signals on startup so database and history hold only genuinely filled/active trades
    await this.purgeAllUnfilledSignalsFromDb();

    // Schedule immediate position reconciliation after 1.5s so signals offline catch up without waiting
    setTimeout(() => {
      this.handlePositionManagement().catch(err => {
        this.logger.warn(`[SignalsController] Boot position reconciliation error: ${err.message}`);
      });
    }, 1500);

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
        // Chronological order: oldest first, newest at the end (strictly verified numeric pnlR records)
        this.recentTradesHistory = perfLogs
          .filter(p => typeof p.pnlR === 'number' && !isNaN(p.pnlR))
          .slice()
          .reverse()
          .map(p => ({
            id: p.signalId,
            symbol: p.symbol,
            direction: p.direction,
            result: p.result === 'WIN' ? 'WIN' : p.result === 'LOSS' ? 'LOSS' : 'SCRATCH',
            pnlR: Number(p.pnlR),
            timestamp: p.closedAt ? new Date(p.closedAt).getTime() : new Date(p.createdAt).getTime()
          }));
      } else {
        // 2. Fallback to completed signals in Signal table (computed mathematically via computeLegacyRealizedR)
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
            const outcome = r.outcome || r.status || null;
            const computedPnlR = typeof r.pnlR === 'number'
              ? r.pnlR
              : computeLegacyRealizedR({
                  direction: s.direction,
                  orderType: r.orderType,
                  entryPrice: Number(s.entryPrice),
                  stopLoss: Number(s.stopLoss),
                  initialStopLoss: r.initialStopLoss ? Number(r.initialStopLoss) : null,
                  takeProfit1: Number(s.takeProfit1),
                  takeProfit2: s.takeProfit2 ? Number(s.takeProfit2) : Number(r.takeProfit2 || 0),
                  riskRewardRatio: s.riskRewardRatio ? Number(s.riskRewardRatio) : null,
                  filledPrice: r.filledPrice ? Number(r.filledPrice) : null,
                  exitPrice: r.exitPrice ? Number(r.exitPrice) : null,
                  outcome
                });
            if (computedPnlR === null) return null;
            const isLoss = computedPnlR < 0;
            const isWin = computedPnlR > 0;
            const ts = r.closedAt ? new Date(r.closedAt).getTime() : new Date(s.createdAt).getTime();
            return {
              id: s.id,
              symbol: s.symbol,
              direction: s.direction,
              result: (isWin ? 'WIN' : isLoss ? 'LOSS' : 'SCRATCH') as 'WIN' | 'LOSS' | 'SCRATCH',
              pnlR: computedPnlR,
              timestamp: ts
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
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
          const nowMs = Date.now();
          const hasCurrentOrFuture = parsed.events.some((e: any) => {
            const t = new Date(e?.date).getTime();
            return isFinite(t) && t >= (nowMs - 24 * 60 * 60 * 1000);
          });
          if (hasCurrentOrFuture) {
            this.cachedCalendarEvents = parsed.events;
            this.lastCalendarFetchTime = parsed.timestamp || nowMs;
            this.logger.log(`[NewsGate] Loaded ${parsed.events.length} active ForexFactory calendar events from disk cache (age: ${Math.round((nowMs - this.lastCalendarFetchTime) / 60000)}m).`);
          } else {
            this.logger.log('[NewsGate] Disk calendar cache contains only expired historical weeks. Discarding stale cache to trigger fresh calendar sync.');
            this.cachedCalendarEvents = [];
            this.lastCalendarFetchTime = 0;
          }
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

  // -------------------------------------------------------------
  // ACTIVE NEWS EVENT MEMORY & MOMENTUM PERSISTENCE ENGINE (Delegated to NewsMomentumService)
  // -------------------------------------------------------------

  private loadNewsMemoryFromDisk() {
    // Disk persistence automatically handled by NewsMomentumService
  }

  private saveNewsMemoryToDisk() {
    // Disk persistence automatically handled by NewsMomentumService
  }

  public async ingestInfluentialNewsHeadlines(spotPrice: number, dxy: number, us10y: number): Promise<void> {
    if (!this.newsMomentumService.shouldIngestNews(15 * 60 * 1000)) {
      return; // Rate-limit ingestion to every 15 minutes
    }
    this.newsMomentumService.markIngestAttempt();

    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey || !(spotPrice > 0)) return;

    try {
      const res = await this.fetchWithTimeout(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`, {}, 4500);
      if (!res.ok) return;
      const articles = await res.json();
      if (!Array.isArray(articles) || articles.length === 0) return;

      this.newsMomentumService.ingestArticles(articles, spotPrice, dxy, us10y);
    } catch (e: any) {
      this.logger.warn(`[NewsMemory] Ingest notice: ${e.message}`);
    }
  }

  public async evaluateAndSyncNewsPersistence(
    currentPrice: number,
    intermarket: IntermarketState
  ): Promise<NewsPersistenceState> {
    await this.ingestInfluentialNewsHeadlines(currentPrice, intermarket.dxy, intermarket.us10y);
    return this.newsMomentumService.evaluatePersistence(currentPrice, {
      dxy: intermarket.dxy,
      dxyChange1h: intermarket.dxyChange1h,
      dxyMomentum: intermarket.dxyMomentum,
      us10y: intermarket.us10y,
      us10yChange1h: intermarket.us10yChange1h,
      us10yMomentum: intermarket.us10yMomentum
    });
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

    // If TradingView WebSocket is temporarily rate-limited (429), serve best-effort cached candles
    if (now < this.tvWsRateLimitedUntil) {
      if (cached && cached.candles.length >= Math.min(20, nBars)) {
        return cached.candles.slice(-nBars).map(c => ({ ...c }));
      }
      return [];
    }

    const symbolsToTry = symbol === 'OANDA:XAUUSD' ? ['OANDA:XAUUSD'] : [symbol, 'OANDA:XAUUSD'];
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
        const msg = String(err?.message || '');
        if (msg.includes('429')) {
          this.tvWsRateLimitedUntil = Date.now() + 60000;
          this.logger.warn(`[fetchTradingViewCandles] TradingView WebSocket rate-limited (429). Pausing new connections for 60s.`);
          break;
        }
        this.logger.warn(`[fetchTradingViewCandles] Warning for ${sym} (${resolution}): ${msg}`);
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
    const nowMs = Date.now();
    if (this.cachedMicrostructure && (nowMs - this.cachedMicrostructure.timestamp < 8000)) {
      return this.cachedMicrostructure.data;
    }
    if (this.inflightMicrostructurePromise) {
      return this.inflightMicrostructurePromise;
    }

    this.inflightMicrostructurePromise = (async () => {
      try {
        const [cfdQuotes, fxQuotes] = await Promise.all([
          this.fetchTradingViewQuotes('cfd', ['OANDA:XAUUSD', 'FOREXCOM:XAUUSD', 'TVC:GOLD', 'FX_IDC:XAUUSD']),
          this.fetchTradingViewQuotes('forex', ['OANDA:XAUUSD', 'FOREXCOM:XAUUSD', 'FX_IDC:XAUUSD'])
        ]);
        const quotes = { ...fxQuotes, ...cfdQuotes };
        let bid = 0;
        let ask = 0;
        let spot = latestCandleClose;

        const providers = [
          quotes['OANDA:XAUUSD'],
          quotes['FOREXCOM:XAUUSD'],
          quotes['TVC:GOLD'],
          quotes['FX_IDC:XAUUSD'],
          fxQuotes['OANDA:XAUUSD'],
          fxQuotes['FOREXCOM:XAUUSD'],
          fxQuotes['FX_IDC:XAUUSD']
        ].filter(q => q && q.price > 1000);
        const withBidAsk = providers.find(q => q.bid && q.ask && q.bid > 1000 && q.ask >= q.bid);

        const multiProviderDispersion = providers.length >= 2
          ? (Math.max(...providers.map(p => p.price)) - Math.min(...providers.map(p => p.price)))
          : 0;

        if (withBidAsk && withBidAsk.bid && withBidAsk.ask) {
          bid = parseFloat(withBidAsk.bid.toFixed(2));
          ask = parseFloat(withBidAsk.ask.toFixed(2));
          spot = parseFloat(withBidAsk.price.toFixed(2));
        } else if (providers.length >= 2 && multiProviderDispersion > 0) {
          // Derive real inter-dealer quote dispersion across live institutional liquidity providers
          spot = parseFloat(providers[0].price.toFixed(2));
          const dispersion = parseFloat(multiProviderDispersion.toFixed(2));
          bid = parseFloat((spot - dispersion / 2).toFixed(2));
          ask = parseFloat((spot + dispersion / 2).toFixed(2));
        } else {
          const res: MicrostructureState = { bid: 0, ask: 0, spread: 0, spot: latestCandleClose, isLiquid: false, reason: 'Live institutional Bid/Ask quote unavailable' };
          return res;
        }

        const spread = parseFloat(Math.max(0.01, ask - bid).toFixed(2));
        const now = new Date();
        const utcDay = now.getUTCDay();
        const utcHour = now.getUTCHours();
        const utcMin = now.getUTCMinutes();

        if (utcDay === 6 || (utcDay === 0 && utcHour < 22) || (utcDay === 5 && utcHour >= 22)) {
          const res: MicrostructureState = { bid, ask, spread, spot, isLiquid: false, reason: 'Weekend market closure' };
          return res;
        }

        if (utcHour === 21 && utcMin >= 50) {
          const res: MicrostructureState = { bid, ask, spread, spot, isLiquid: false, reason: 'Daily settlement roll buffer' };
          return res;
        }

        if (spread > 0.60) {
          const res: MicrostructureState = { bid, ask, spread, spot, isLiquid: false, reason: `Excessive institutional spread expansion ($${spread.toFixed(2)} > $0.60)` };
          return res;
        }

        const res: MicrostructureState = { bid, ask, spread, spot, isLiquid: true };
        this.cachedMicrostructure = { timestamp: Date.now(), data: res };
        return res;
      } finally {
        this.inflightMicrostructurePromise = null;
      }
    })();

    return this.inflightMicrostructurePromise;
  }

  public async fetchIntermarket(): Promise<IntermarketState> {
    const nowMs = Date.now();
    if (this.cachedIntermarket && (nowMs - this.cachedIntermarket.timestamp < 45000)) {
      return this.cachedIntermarket.data;
    }
    if (this.inflightIntermarketPromise) {
      return this.inflightIntermarketPromise;
    }

    this.inflightIntermarketPromise = (async () => {
      try {
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

          // 2. Fetch cross-asset yields and commodities from Yahoo concurrently with FRED series
          const [dxyRes, us10yRes, eurusdRes, silverRes, oilRes, nqRes, liveRealYield, liveBreakeven] = await Promise.allSettled([
            this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=15m&range=1d', {}, 2500),
            this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=15m&range=1d', {}, 2500),
            this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=15m&range=1d', {}, 2500),
            silver <= 0 ? this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=15m&range=1d', {}, 2500) : Promise.resolve(null as any),
            this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=15m&range=1d', {}, 2500),
            this.fetchWithTimeout('https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?interval=15m&range=1d', {}, 2500),
            this.fetchFredSeries('DFII10'),
            this.fetchFredSeries('T10YIE')
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

          // If Yahoo ^TNX 15m chart was unavailable or lacked 4 bars, compute real 1H change from TradingView 15M TVC:US10Y candles
          if (!hasUs10y1h) {
            const tvUs10y15 = await this.fetchTradingViewCandles('TVC:US10Y', '15', 24);
            if (tvUs10y15.length >= 5) {
              const latestClose = tvUs10y15[tvUs10y15.length - 1].close;
              const past1hClose = tvUs10y15[tvUs10y15.length - 5].close;
              if (latestClose > 0 && past1hClose > 0) {
                if (us10y <= 0) us10y = latestClose;
                us10yChange1h = parseFloat((((latestClose - past1hClose) / past1hClose) * 100).toFixed(2));
                hasUs10y1h = true;
              }
            }
          }

          if (us10y <= 0) {
            const fredDgs10 = await this.fetchFredSeries('DGS10');
            if (fredDgs10 !== null && fredDgs10 > 0) {
              us10y = fredDgs10;
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

          const realYieldVal = liveRealYield.status === 'fulfilled' ? liveRealYield.value : null;
          const breakevenVal = liveBreakeven.status === 'fulfilled' ? liveBreakeven.value : null;

          const hasLiveMacro = hasDxy1h && hasUs10y1h;
          const isRealYieldLive = realYieldVal !== null && realYieldVal > 0;
          const breakevenInflation = breakevenVal !== null && breakevenVal > 0 ? breakevenVal : 0;
          const realYieldProxy = isRealYieldLive
            ? realYieldVal!
            : (us10y > 0 && breakevenInflation > 0 ? parseFloat((us10y - breakevenInflation).toFixed(2)) : 0);

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

          const dxyMomentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
            dxyChange1h >= 0.12 ? 'BULLISH' : dxyChange1h <= -0.12 ? 'BEARISH' : 'NEUTRAL';
          const us10yMomentum: 'RISING' | 'FALLING' | 'NEUTRAL' =
            us10yChange1h >= 0.10 ? 'RISING' : us10yChange1h <= -0.10 ? 'FALLING' : 'NEUTRAL';

          let macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
          let macroDrawOnLiquidity: 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY' | 'RANGE_EQUILIBRIUM' = 'RANGE_EQUILIBRIUM';

          if (dxyMomentum === 'BULLISH' && us10yMomentum !== 'FALLING') {
            macroBias = 'BEARISH';
            macroDrawOnLiquidity = 'SELL_SIDE_LIQUIDITY';
          } else if (dxyMomentum === 'BEARISH' && us10yMomentum !== 'RISING') {
            macroBias = 'BULLISH';
            macroDrawOnLiquidity = 'BUY_SIDE_LIQUIDITY';
          } else if (safeHavenDemandScore >= 70) {
            macroBias = 'BULLISH';
            macroDrawOnLiquidity = 'BUY_SIDE_LIQUIDITY';
          }

          if (dxyChange1h < -0.15 && us10yChange1h < -0.20) {
            macroAlignment = 'BULLISH';
            conflictDetected = true;
            conflictReason = `Macro Tailwind: Softer USD (${dxyChange1h}%) and lower real yields (${realYieldProxy}%) oppose gold shorts.`;
            rationale = conflictReason;
          } else if (dxyChange1h > 0.15 && us10yChange1h > 0.20) {
            if (safeHavenDemandScore >= 70) {
              macroAlignment = 'SAFE_HAVEN_DECOUPLING';
              conflictDetected = true;
              conflictReason = 'Safe-Haven Decoupling: Flight-to-safety gold demand opposes aggressive shorting.';
              rationale = conflictReason;
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

          const res: IntermarketState = {
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
            hasLiveMacro,
            macroBias,
            macroDrawOnLiquidity,
            dxyMomentum,
            us10yMomentum
          };

          this.cachedIntermarket = { timestamp: Date.now(), data: res };
          return res;
        } catch (e: any) {
          this.logger.warn(`[fetchIntermarket] Macro data fetch warning: ${e.message}`);
          const fallback: IntermarketState = {
            dxy,
            dxyChange1h,
            dxyChange24h,
            us10y,
            us10yChange1h,
            realYieldProxy: 0,
            breakevenInflation: 0,
            isRealYieldLive: false,
            eurusd,
            silver,
            oil,
            us100Change,
            safeHavenDemandScore: 50,
            riskSentiment: 'NEUTRAL',
            macroAlignment: 'NEUTRAL',
            conflictDetected: false,
            rationale: 'Baseline intermarket state',
            hasLiveMacro: false,
            macroBias: 'NEUTRAL',
            macroDrawOnLiquidity: 'RANGE_EQUILIBRIUM',
            dxyMomentum: 'NEUTRAL',
            us10yMomentum: 'NEUTRAL'
          };
          return fallback;
        }
      } finally {
        this.inflightIntermarketPromise = null;
      }
    })();

    return this.inflightIntermarketPromise;
  }

  // Single-flight, in-memory, disk-persisted ForexFactory Economic Calendar Client
  // GUARANTEE: Never fires parallel requests to ForexFactory; caches for 4 hours;
  // loads instantly from disk on reboot; backs off automatically on network failure.
  private async getOrFetchCalendarEvents(): Promise<any[]> {
    const now = Date.now();

    const hasValidEvents = this.cachedCalendarEvents.some(e => {
      const t = new Date(e?.date).getTime();
      return isFinite(t) && t >= (now - 24 * 60 * 60 * 1000);
    });
    if (!hasValidEvents && this.cachedCalendarEvents.length > 0) {
      this.cachedCalendarEvents = [];
      this.lastCalendarFetchTime = 0;
    }

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

        // Secondary authentic feed: TradingView live Economic Calendar (US events)
        const tvEvents = await this.fetchTradingViewEconomicCalendar();
        if (tvEvents && tvEvents.length > 0) {
          this.cachedCalendarEvents = tvEvents;
          this.lastCalendarFetchTime = Date.now();
          this.calendarFetchFailureCount = 0;
          this.nextAllowedCalendarFetchTime = 0;
          this.saveCalendarToDisk(tvEvents);
          this.logger.log(`[NewsGate] Successfully synced live TradingView economic calendar (${tvEvents.length} US events). Saved to memory & disk.`);
          return tvEvents;
        }

        throw new Error(`ForexFactory HTTP status ${res.status}`);
      } catch (err: any) {
        // If FF threw (e.g. 429), always try live TradingView calendar if cache is empty or stale
        const cacheHasCurrent = this.cachedCalendarEvents.some(e => {
          const t = new Date(e?.date).getTime();
          return isFinite(t) && t >= (Date.now() - 24 * 60 * 60 * 1000);
        });
        if (!cacheHasCurrent) {
          const tvEvents = await this.fetchTradingViewEconomicCalendar();
          if (tvEvents && tvEvents.length > 0) {
            this.cachedCalendarEvents = tvEvents;
            this.lastCalendarFetchTime = Date.now();
            this.calendarFetchFailureCount = 0;
            this.nextAllowedCalendarFetchTime = 0;
            this.saveCalendarToDisk(tvEvents);
            this.logger.log(`[NewsGate] Successfully synced live TradingView economic calendar on catch (${tvEvents.length} US events). Saved to memory & disk.`);
            return tvEvents;
          }
        }

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

  // Secondary authentic economic calendar provider using live TradingView US events
  private async fetchTradingViewEconomicCalendar(): Promise<any[] | null> {
    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tvRes = await this.fetchWithTimeout(
        `https://economic-calendar.tradingview.com/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&countries=US`,
        {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.tradingview.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        },
        6000
      );
      if (tvRes.ok) {
        const data = await tvRes.json();
        const tvEvents = Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [];
        if (tvEvents.length > 0) {
          return tvEvents.map((e: any) => ({
            title: e.title || e.event || '',
            country: 'USD',
            date: e.date || e.time || new Date().toISOString(),
            impact: e.importance === 1 ? 'High' : e.importance === 0 ? 'Medium' : 'Low',
            forecast: e.forecast != null ? String(e.forecast) : null,
            previous: e.previous != null ? String(e.previous) : null,
            actual: e.actual != null ? String(e.actual) : null
          }));
        }
      }
    } catch (tvErr: any) {
      this.logger.warn(`[NewsGate] TradingView economic calendar notice: ${tvErr.message}`);
    }
    return null;
  }

  // Classifies a USD calendar event into an impact tier while strictly respecting the feed's own Low/Medium/High severity
  private classifyUsdEvent(title: string, feedImpact: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    const impact = String(feedImpact || '').toLowerCase();
    if (impact === 'holiday' || impact === 'non-economic' || impact === 'low') {
      return 'LOW';
    }
    const t = String(title || '').toUpperCase();
    // Routine regional Fed / FOMC Member speeches are not binary rate decisions: keep them at LOW/MEDIUM unless Fed Chair Powell speaks
    const isRoutineMemberSpeech = (t.includes('FOMC MEMBER') || t.includes('SPEAKS')) && !t.includes('POWELL') && !t.includes('PRESS CONFERENCE') && !t.includes('PRESIDENT TRUMP');
    if (isRoutineMemberSpeech) {
      return impact === 'high' ? 'MEDIUM' : 'LOW';
    }

    const extremeKeywords = [
      'FOMC STATEMENT', 'FOMC PRESS CONFERENCE', 'FEDERAL FUNDS RATE', 'FED FUNDS RATE', 'INTEREST RATE DECISION',
      'FED CHAIR POWELL', 'POWELL SPEAKS', 'CPI M/M', 'CPI Y/Y', 'CORE CPI', 'CONSUMER PRICE INDEX',
      'NON-FARM EMPLOYMENT', 'NONFARM PAYROLLS', 'NFP', 'CORE PCE PRICE INDEX', 'PRESIDENT TRUMP SPEAKS'
    ];
    const highKeywords = [
      'ADVANCE GDP', 'PRELIM GDP', 'FINAL GDP', 'PPI M/M', 'CORE PPI', 'RETAIL SALES M/M', 'CORE RETAIL SALES',
      'UNEMPLOYMENT RATE', 'UNEMPLOYMENT CLAIMS', 'INITIAL JOBLESS CLAIMS', 'ISM MANUFACTURING PMI',
      'ISM SERVICES PMI', 'JOLTS JOB OPENINGS', 'ADP NON-FARM', 'AVERAGE HOURLY EARNINGS', 'FOMC MEETING MINUTES'
    ];

    if (impact === 'high' && extremeKeywords.some(kw => t.includes(kw))) return 'EXTREME';
    if (impact === 'high') return 'HIGH';
    if (impact === 'medium' && (extremeKeywords.some(kw => t.includes(kw)) || highKeywords.some(kw => t.includes(kw)))) return 'HIGH';
    if (impact === 'medium') return 'MEDIUM';
    return 'LOW';
  }

  // Blackout windows in minutes: [before release, after release]
  private newsWindowFor(tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'): { pre: number; post: number } {
    if (tier === 'EXTREME') return { pre: 30, post: 20 };
    if (tier === 'HIGH') return { pre: 15, post: 15 };
    if (tier === 'MEDIUM') return { pre: 5, post: 5 };
    return { pre: 0, post: 0 };
  }

  // Next HIGH/EXTREME USD release within the horizon (used to stop pending orders living into a release)
  private getNextHighImpactUsdEvent(nowMs: number, horizonMin: number): { title: string; impactTier: 'HIGH' | 'EXTREME'; timeMs: number; preBlackoutMin: number } | null {
    let best: { title: string; impactTier: 'HIGH' | 'EXTREME'; timeMs: number; preBlackoutMin: number } | null = null;
    for (const ev of this.cachedCalendarEvents || []) {
      if (!ev || (ev.country !== 'USD' && ev.currency !== 'USD')) continue;
      const tier = this.classifyUsdEvent(ev.title, ev.impact);
      if (tier !== 'HIGH' && tier !== 'EXTREME') continue;
      const timeMs = new Date(ev.date).getTime();
      if (!isFinite(timeMs)) continue;
      const diffMin = (timeMs - nowMs) / 60_000;
      if (diffMin <= 0 || diffMin > horizonMin) continue;
      if (!best || timeMs < best.timeMs) {
        best = { title: ev.title, impactTier: tier, timeMs, preBlackoutMin: this.newsWindowFor(tier).pre };
      }
    }
    return best;
  }

  // Helper to parse numeric economic values with units (% / K / M / B)
  private parseEconomicValue(val?: string | null): number | null {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim().replace(/,/g, '');
    if (!clean || clean === '-' || clean === 'N/A') return null;
    const isK = clean.toUpperCase().includes('K');
    const isM = clean.toUpperCase().includes('M');
    const isB = clean.toUpperCase().includes('B');
    const numStr = clean.replace(/[%KkMmBb]/g, '').trim();
    const num = parseFloat(numStr);
    if (isNaN(num)) return null;
    if (isK) return num;
    if (isM) return num * 1000;
    if (isB) return num * 1000000;
    return num;
  }

  // Evaluates post-release fundamental news impact on Gold (XAUUSD)
  public evaluateUsdNewsImpact(
    title: string,
    actualRaw?: string | null,
    forecastRaw?: string | null,
    previousRaw?: string | null
  ): { fundamentalGoldBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; reason: string } {
    const t = (title || '').toUpperCase();
    const actual = this.parseEconomicValue(actualRaw);
    const forecast = this.parseEconomicValue(forecastRaw);
    const previous = this.parseEconomicValue(previousRaw);

    const compareTarget = forecast !== null ? forecast : previous;
    if (actual !== null && compareTarget !== null) {
      const diff = actual - compareTarget;
      const isAntiUsdMetric =
        t.includes('UNEMPLOYMENT RATE') ||
        t.includes('JOBLESS CLAIMS') ||
        t.includes('UNEMPLOYMENT CLAIMS');

      const isProUsdMetric =
        t.includes('CPI') ||
        t.includes('PPI') ||
        t.includes('PCE') ||
        t.includes('INFLATION') ||
        t.includes('NON-FARM') ||
        t.includes('NONFARM') ||
        t.includes('NFP') ||
        t.includes('EMPLOYMENT CHANGE') ||
        t.includes('ADP') ||
        t.includes('RETAIL SALES') ||
        t.includes('GDP') ||
        t.includes('ISM') ||
        t.includes('PMI') ||
        t.includes('JOLTS') ||
        t.includes('CONSUMER CONFIDENCE') ||
        t.includes('FED FUNDS') ||
        t.includes('INTEREST RATE');

      if (isAntiUsdMetric) {
        if (diff > 0.04 * Math.abs(compareTarget || 1)) {
          return {
            fundamentalGoldBias: 'BULLISH',
            reason: `Weak labor metrics (${title}: Actual ${actualRaw} vs Forecast ${forecastRaw || previousRaw}) soften USD, Bullish for Gold.`
          };
        } else if (diff < -0.04 * Math.abs(compareTarget || 1)) {
          return {
            fundamentalGoldBias: 'BEARISH',
            reason: `Tight labor metrics (${title}: Actual ${actualRaw} vs Forecast ${forecastRaw || previousRaw}) strengthen USD, Bearish for Gold.`
          };
        }
      } else if (isProUsdMetric) {
        if (diff > 0.02 * Math.abs(compareTarget || 1)) {
          return {
            fundamentalGoldBias: 'BEARISH',
            reason: `Hot economic release (${title}: Actual ${actualRaw} vs Forecast ${forecastRaw || previousRaw}) boosts USD and yields, Bearish for Gold.`
          };
        } else if (diff < -0.02 * Math.abs(compareTarget || 1)) {
          return {
            fundamentalGoldBias: 'BULLISH',
            reason: `Soft economic release (${title}: Actual ${actualRaw} vs Forecast ${forecastRaw || previousRaw}) weakens USD and yields, Bullish for Gold.`
          };
        }
      }
    }

    return {
      fundamentalGoldBias: 'NEUTRAL',
      reason: `Economic metrics for ${title} aligned with consensus forecasts.`
    };
  }

  public async fetchEconomicNewsGate(): Promise<NewsGateState> {
    const events = await this.getOrFetchCalendarEvents();
    const nowMs = Date.now();
    const tierRank = { LOW: 0, MEDIUM: 1, HIGH: 2, EXTREME: 3 } as const;

    // Freshness check: ForexFactory publishes a weekly schedule. If we have cached events covering the current week (or fetched within 7 days), the calendar is active.
    const hasCurrentOrFutureEvents = events.some(e => {
      const t = new Date(e.date).getTime();
      return isFinite(t) && t >= (nowMs - 24 * 60 * 60 * 1000);
    });
    const isCalendarFresh = (this.lastCalendarFetchTime > 0 && (nowMs - this.lastCalendarFetchTime) <= (7 * 24 * 60 * 60 * 1000)) || hasCurrentOrFutureEvents;
    let calendarFeedResponded = events.length > 0 && isCalendarFresh;

    type Candidate = {
      title: string;
      tier: 'MEDIUM' | 'HIGH' | 'EXTREME';
      diffMin: number;
      timeMs: number;
      actual?: string | null;
      forecast?: string | null;
      previous?: string | null;
    };
    const active: Candidate[] = [];
    const recentReleased: Candidate[] = [];

    const consider = (title: string, impact: string, timeMs: number, actual?: string | null, forecast?: string | null, previous?: string | null) => {
      if (!isFinite(timeMs)) return;
      const tier = this.classifyUsdEvent(title, impact);
      if (tier === 'LOW') return;
      const diffMin = (timeMs - nowMs) / 60_000;
      const w = this.newsWindowFor(tier);
      if (diffMin <= w.pre && diffMin >= -w.post) {
        active.push({ title, tier, diffMin, timeMs, actual, forecast, previous });
      }
      if (diffMin < 0 && diffMin >= -120 && (tier === 'HIGH' || tier === 'EXTREME')) {
        recentReleased.push({ title, tier, diffMin, timeMs, actual, forecast, previous });
      }
    };

    // Fallback: Finnhub Economic Calendar used if primary calendar feed has no current/future events
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!calendarFeedResponded && finnhubKey) {
      try {
        const fromDate = new Date().toISOString().split('T')[0];
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
              consider(ev.event || '', ev.impact || '', new Date(ev.time).getTime(), ev.actual, ev.estimate, ev.prev);
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`[fetchEconomicNewsGate] Finnhub calendar notice: ${e.message}`);
      }
    }

    // Primary ForexFactory feed
    if (calendarFeedResponded && events.length > 0) {
      for (const ev of events) {
        if (ev.country !== 'USD') continue;
        consider(ev.title || '', ev.impact || '', new Date(ev.date).getTime(), ev.actual, ev.forecast, ev.previous);
      }
    }

    if (active.length > 0) {
      // Most severe event wins; ties broken by proximity to release time
      active.sort((a, b) => (tierRank[b.tier] - tierRank[a.tier]) || (Math.abs(a.diffMin) - Math.abs(b.diffMin)));
      const top = active[0];
      let stage: NewsGateState['eventStage'] = 'PRE_EVENT';
      if (top.diffMin > 0) stage = 'PRE_EVENT';
      else if (top.diffMin >= -5) stage = 'EVENT_SHOCK';
      else if (top.diffMin >= -15) stage = 'PRICE_DISCOVERY';
      else stage = 'STRUCTURE_REBUILD';
      const newsEval = this.evaluateUsdNewsImpact(top.title, top.actual, top.forecast, top.previous);
      
      // Blackout is active strictly during PRE_EVENT, EVENT_SHOCK, and PRICE_DISCOVERY.
      // At STRUCTURE_REBUILD (T+15m to T+45m), initial market spread blowout has normalized,
      // and institutional post-news retests are permitted with confirmed fundamental alignment.
      const isBlackout = stage !== 'STRUCTURE_REBUILD';
      return {
        isBlackout,
        eventStage: stage,
        minutesToEvent: Math.round(top.diffMin),
        eventTimeUtc: new Date(top.timeMs).toISOString(),
        eventTitle: top.title,
        impactTier: top.tier,
        feedOffline: false,
        actual: top.actual || null,
        forecast: top.forecast || null,
        previous: top.previous || null,
        fundamentalBias: newsEval.fundamentalGoldBias,
        fundamentalSummary: newsEval.reason,
        postNewsContinuation: newsEval.fundamentalGoldBias === 'BULLISH' ? 'BUY' : newsEval.fundamentalGoldBias === 'BEARISH' ? 'SELL' : null
      };
    }

    let fundamentalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let fundamentalSummary: string | undefined;
    let eventTitle: string | null = null;
    let eventTimeUtc: string | null = null;
    let impactTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'LOW';
    let actual: string | null = null;
    let forecast: string | null = null;
    let previous: string | null = null;
    let minutesToEvent: number | null = null;

    if (recentReleased.length > 0) {
      recentReleased.sort((a, b) => (tierRank[b.tier] - tierRank[a.tier]) || (Math.abs(a.diffMin) - Math.abs(b.diffMin)));
      const mostRecent = recentReleased[0];
      const evalRes = this.evaluateUsdNewsImpact(mostRecent.title, mostRecent.actual, mostRecent.forecast, mostRecent.previous);
      fundamentalBias = evalRes.fundamentalGoldBias;
      fundamentalSummary = evalRes.reason;
      eventTitle = mostRecent.title;
      eventTimeUtc = new Date(mostRecent.timeMs).toISOString();
      impactTier = mostRecent.tier;
      actual = mostRecent.actual || null;
      forecast = mostRecent.forecast || null;
      previous = mostRecent.previous || null;
      minutesToEvent = Math.round(mostRecent.diffMin);
    }

    const isRecentRebuild = minutesToEvent !== null && minutesToEvent < 0 && minutesToEvent >= -45;

    return {
      isBlackout: false,
      eventStage: isRecentRebuild ? 'STRUCTURE_REBUILD' : 'NORMAL_MODE',
      minutesToEvent,
      eventTimeUtc,
      eventTitle,
      impactTier,
      feedOffline: !calendarFeedResponded,
      actual,
      forecast,
      previous,
      fundamentalBias,
      fundamentalSummary,
      postNewsContinuation: fundamentalBias === 'BULLISH' ? 'BUY' : fundamentalBias === 'BEARISH' ? 'SELL' : null
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
    const hasRealVolume = slice.some(c => Number(c.volume) > 0);
    if (slice.length === 0 || !hasRealVolume) {
      return { poc: 0, vah: 0, val: 0, profileWidth: 0, valueRelation: 'INSIDE_VALUE' };
    }

    const minPrice = Math.min(...slice.map(c => c.low));
    const maxPrice = Math.max(...slice.map(c => c.high));
    const bucketSize = 1.0;
    const bucketCount = Math.max(5, Math.ceil((maxPrice - minPrice) / bucketSize));
    const volumeBuckets = new Array(bucketCount).fill(0);

    slice.forEach(c => {
      const vol = Number(c.volume) || 0;
      if (vol <= 0) return;
      const avg = (c.high + c.low + c.close) / 3;
      const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((avg - minPrice) / bucketSize)));
      volumeBuckets[bIdx] += vol;
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
    } else if (prevDayCandles.length >= 12) {
      pdh = Math.max(...prevDayCandles.map(c => c.high));
      pdl = Math.min(...prevDayCandles.map(c => c.low));
    }

    let pwh = 0;
    let pwl = 0;
    if (completedWeekly && completedWeekly.length > 0) {
      const prevWeeklyBar = completedWeekly[completedWeekly.length - 1];
      pwh = prevWeeklyBar.high;
      pwl = prevWeeklyBar.low;
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

    const sessionVwap = sessionCandles.length >= 2 ? this.calcVWAP(sessionCandles) : 0;
    const anchoredVwapAsia = asiaCandles.length >= 2 ? this.calcVWAP(asiaCandles) : 0;

    return { session, pdh, pdl, pwh, pwl, ash, asl, londonHigh, londonLow, sessionVwap, anchoredVwapAsia };
  }

  public classifySessionOpeningPlay(
    now: Date,
    direction: 'BUY' | 'SELL' | 'WAIT',
    selectedModel: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'LTF_SNIPER_FVG' | 'NONE',
    sessionLevels: SessionLevels,
    sweeps: LiquiditySweep[],
    fvgs: FairValueGap[],
    volMetrics: VolatilityMetrics,
    newsGate?: NewsGateState
  ): SessionOpeningPlay {
    // 0. Institutional Post-News FVG / OB Mitigation Retest (The #1 Gold News Strategy)
    // Institutional Catalyst: High-impact release (CPI, NFP, FOMC) macro actuals confirmed.
    // Price pulls back into the news displacement FVG / Order Block in the direction of the fundamental bias.
    if (
      newsGate &&
      newsGate.eventStage === 'STRUCTURE_REBUILD' &&
      newsGate.fundamentalBias &&
      newsGate.fundamentalBias !== 'NEUTRAL' &&
      direction !== 'WAIT' &&
      ((direction === 'BUY' && newsGate.fundamentalBias === 'BULLISH') ||
       (direction === 'SELL' && newsGate.fundamentalBias === 'BEARISH'))
    ) {
      return {
        tag: 'POST_NEWS_FVG_CONTINUATION',
        badgeLabel: '[Post-News FVG Retest]',
        sessionWindow: `Post-News Structure Rebuild (${newsGate.eventTitle || 'US Macro Event'})`,
        catalyst: `${newsGate.eventTitle || 'Macro Event'}: Fundamental Gold bias (${newsGate.fundamentalBias}) verified with live economic data. 15M FVG retest defended post-release.`,
        confidenceBoost: 6
      };
    }

    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // 1. London Open Liquidity Sweep (07:00 - 09:30 UTC / 02:00 - 04:30 AM EST)
    // Institutional Catalyst: Asian session liquidity (ASH or ASL) run followed by CHoCH reversal
    const isLondonOpenWindow = (utcHour === 7 || utcHour === 8 || (utcHour === 9 && utcMinute <= 30));
    if (isLondonOpenWindow && direction !== 'WAIT') {
      const sweptAsh = sweeps.some(s => s.levelName.includes('Asian High') || (sessionLevels.ash > 0 && Math.abs(s.levelPrice - sessionLevels.ash) < 0.75));
      const sweptAsl = sweeps.some(s => s.levelName.includes('Asian Low') || (sessionLevels.asl > 0 && Math.abs(s.levelPrice - sessionLevels.asl) < 0.75));

      if ((direction === 'SELL' && sweptAsh) || (direction === 'BUY' && sweptAsl) || selectedModel === 'SWEEP_CHOCH_REVERSAL') {
        const sweptLevel = direction === 'BUY' ? 'Asian Session Low (ASL)' : 'Asian Session High (ASH)';
        return {
          tag: 'LONDON_OPEN_SWEEP',
          badgeLabel: '[London Open Sweep]',
          sessionWindow: 'London Open Killzone (07:00–09:30 UTC)',
          catalyst: `Algorithmic liquidity sweep of ${sweptLevel} followed by confirmed displacement reversal into London session.`,
          confidenceBoost: 4
        };
      }
    }

    // 2. ICT London Silver Bullet (07:00 - 08:00 UTC / 03:00 - 04:00 AM NY)
    // Institutional Catalyst: Algorithm delivering price into London liquidity via 15M FVG rebalance
    if (utcHour === 7 && direction !== 'WAIT') {
      const activeFvg = fvgs.some(f => !f.mitigated);
      if (activeFvg) {
        return {
          tag: 'LONDON_SILVER_BULLET',
          badgeLabel: '[London Silver Bullet]',
          sessionWindow: 'London Silver Bullet (07:00–08:00 UTC)',
          catalyst: 'ICT London 60-min algorithmic delivery window: 15M FVG rebalance towards session liquidity.',
          confidenceBoost: 4
        };
      }
    }

    // 3. New York Cash Opening Range Breakout (ORB) (13:30 - 14:15 UTC / 09:30 - 10:15 AM EST)
    // Institutional Catalyst: NY cash market open volatility expansion breaking initial 15M balance
    const isNyOrbWindow = (utcHour === 13 && utcMinute >= 30) || (utcHour === 14 && utcMinute <= 15);
    if (isNyOrbWindow && direction !== 'WAIT') {
      if (selectedModel === 'BOS_PULLBACK_CONTINUATION' || volMetrics.regime !== 'LOW') {
        return {
          tag: 'NY_ORB_BREAKOUT',
          badgeLabel: '[NY ORB Breakout]',
          sessionWindow: 'New York Opening Range (13:30–14:15 UTC)',
          catalyst: 'High-momentum institutional expansion breaking beyond the New York Cash Open 15M range.',
          confidenceBoost: 5
        };
      }
    }

    // 4. ICT New York AM Silver Bullet (14:00 - 15:00 UTC / 10:00 - 11:00 AM EST)
    // Institutional Catalyst: High-probability 60-minute window targeting morning session extremes via FVG
    if (utcHour === 14 && direction !== 'WAIT') {
      const activeFvg = fvgs.some(f => !f.mitigated);
      if (activeFvg) {
        return {
          tag: 'NY_AM_SILVER_BULLET',
          badgeLabel: '[NY AM Silver Bullet]',
          sessionWindow: 'New York AM Silver Bullet (14:00–15:00 UTC)',
          catalyst: 'ICT NY AM 60-min prime window: Displacement FVG retest targeting opposing session liquidity.',
          confidenceBoost: 5
        };
      }
    }

    // 5. ICT New York PM Silver Bullet (18:00 - 19:00 UTC / 14:00 - 15:00 PM EST)
    // Institutional Catalyst: Afternoon liquidity rebalance before New York session close
    if (utcHour === 18 && direction !== 'WAIT') {
      const activeFvg = fvgs.some(f => !f.mitigated);
      if (activeFvg) {
        return {
          tag: 'NY_PM_SILVER_BULLET',
          badgeLabel: '[NY PM Silver Bullet]',
          sessionWindow: 'New York PM Silver Bullet (18:00–19:00 UTC)',
          catalyst: 'ICT NY PM 60-min institutional window: Late-session liquidity rebalance towards daily range extremes.',
          confidenceBoost: 3
        };
      }
    }

    // 6. Standard Institutional Structure
    return {
      tag: 'STANDARD_STRUCTURE',
      badgeLabel: '[Institutional SMC]',
      sessionWindow: `${sessionLevels.session} Session`,
      catalyst: 'Multi-Timeframe Institutional Confluence Zone (ICZ) structural execution.',
      confidenceBoost: 0
    };
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
    if (len < 3) return obs;

    const avgVolume = candles.reduce((acc, c) => acc + (c.volume || 0), 0) / Math.max(1, len);
    const swings = this.detectFractalSwings(candles);

    for (let i = 0; i < len - 1; i++) {
      const c = candles[i];
      const next1 = candles[i + 1];
      const next2 = candles[i + 2] || next1;

      // Prior swing context within last 15 bars
      const priorSwingHighs = swings.filter(s => s.type === 'HIGH' && s.index < i && s.index >= i - 15);
      const priorSwingLows = swings.filter(s => s.type === 'LOW' && s.index < i && s.index >= i - 15);
      const recentSwingHigh = priorSwingHighs.slice(-1)[0]?.price || 0;
      const recentSwingLow = priorSwingLows.slice(-1)[0]?.price || 0;

      // --- BULLISH ORDER BLOCK ---
      // Last down candle (or indecisive sweep) preceding confirmed institutional bullish displacement
      if (c.close <= c.open || (c.high - c.low > 0 && (c.close - c.low) / (c.high - c.low) <= 0.40)) {
        const body1 = next1.close - next1.open;
        const range1 = Math.max(0.05, next1.high - next1.low);
        const bodyRatio1 = body1 > 0 ? body1 / range1 : 0;

        const combinedBody2 = next2.close - next1.open;
        const combinedRange2 = Math.max(0.05, Math.max(next1.high, next2.high) - Math.min(next1.low, next2.low));
        const combinedRatio2 = combinedBody2 > 0 ? combinedBody2 / combinedRange2 : 0;

        // Institutional displacement requirement: genuine body displacement rejecting dojis/wicks
        const isSingleDisplacement = next1.close > c.high && bodyRatio1 >= 0.55 && body1 >= 0.35 * atr15m;
        const isDoubleDisplacement = next2.close > c.high && combinedRatio2 >= 0.55 && combinedBody2 >= 0.50 * atr15m;

        if (isSingleDisplacement || isDoubleDisplacement) {
          const high = Math.max(c.high, c.open);
          const low = c.low;
          const midpoint = (high + low) / 2;
          const dispRatio = parseFloat((isSingleDisplacement ? bodyRatio1 : combinedRatio2).toFixed(2));

          // Causal Verification 1: Did the displacement break a meaningful swing high (BOS)?
          const maxDisplacementClose = Math.max(next1.close, next2.close, candles[i + 3]?.close || 0);
          const causedBos = recentSwingHigh > 0 && maxDisplacementClose > recentSwingHigh;

          // Causal Verification 2: Did the movement create an active FVG?
          const fvgFormedAt1 = candles[i + 2] && (candles[i + 2].low - c.high) >= Math.max(0.30, atr15m * 0.15);
          const fvgFormedAt2 = candles[i + 3] && (candles[i + 3].low - next1.high) >= Math.max(0.30, atr15m * 0.15);
          const createdFvg = Boolean(fvgFormedAt1 || fvgFormedAt2);

          // Causal Verification 3: Was liquidity swept right before the displacement?
          const prevCandle = candles[i - 1];
          const priorSweepConfirmed = (recentSwingLow > 0 && (c.low < recentSwingLow || (prevCandle && prevCandle.low < recentSwingLow))) ||
            (prevCandle && c.low < prevCandle.low && c.close > prevCandle.low);

          // Tiered Quality Grade Assignment
          const grade: OrderBlock['grade'] = (priorSweepConfirmed && causedBos && createdFvg)
            ? 'GRADE_A_PLUS'
            : (causedBos && createdFvg)
              ? 'GRADE_A'
              : 'GRADE_B';

          let mitigated = false;
          let isRetested = false;
          let maxPenetration = 0;
          const obSpan = Math.max(0.05, high - low);

          for (let j = i + 2; j < len; j++) {
            const probe = candles[j];
            // Invalidation: candle CLOSES completely below the low of the Order Block
            if (probe.close < low) {
              mitigated = true;
              maxPenetration = 1.0;
              break;
            }
            // Retest: wick taps into the OB zone [low, high] or touches midpoint, but candle closes above low
            if (probe.low <= high && probe.close >= low) {
              isRetested = true;
              const pen = (high - probe.low) / obSpan;
              if (pen > maxPenetration) maxPenetration = pen;
            }
          }

          let qualityScore = 65;
          if (dispRatio >= 0.75) qualityScore += 10;
          if (next1.volume && next1.volume >= 1.20 * avgVolume) qualityScore += 8;
          if (priorSweepConfirmed) qualityScore += 10;
          if (causedBos) qualityScore += 12;
          if (createdFvg) qualityScore += 10;
          if (grade === 'GRADE_A_PLUS') qualityScore = Math.min(98, qualityScore + 5);

          obs.push({
            type: 'BULLISH',
            high,
            low,
            midpoint,
            candleIndex: i,
            mitigated,
            qualityScore,
            displacementRatio: dispRatio,
            isRetested,
            causedBos,
            createdFvg,
            priorSweepConfirmed,
            grade,
            proximalBoundary: high,
            distalBoundary: low,
            mitigationPct: Math.min(100, Math.round(maxPenetration * 100))
          });
        }
      }

      // --- BEARISH ORDER BLOCK ---
      // Last up candle preceding confirmed institutional bearish displacement
      if (c.close >= c.open || (c.high - c.low > 0 && (c.high - c.close) / (c.high - c.low) <= 0.40)) {
        const body1 = next1.open - next1.close;
        const range1 = Math.max(0.05, next1.high - next1.low);
        const bodyRatio1 = body1 > 0 ? body1 / range1 : 0;

        const combinedBody2 = next1.open - next2.close;
        const combinedRange2 = Math.max(0.05, Math.max(next1.high, next2.high) - Math.min(next1.low, next2.low));
        const combinedRatio2 = combinedBody2 > 0 ? combinedBody2 / combinedRange2 : 0;

        // Institutional displacement requirement: genuine body displacement rejecting dojis/wicks
        const isSingleDisplacement = next1.close < c.low && bodyRatio1 >= 0.55 && body1 >= 0.35 * atr15m;
        const isDoubleDisplacement = next2.close < c.low && combinedRatio2 >= 0.55 && combinedBody2 >= 0.50 * atr15m;

        if (isSingleDisplacement || isDoubleDisplacement) {
          const high = c.high;
          const low = Math.min(c.low, c.open);
          const midpoint = (high + low) / 2;
          const dispRatio = parseFloat((isSingleDisplacement ? bodyRatio1 : combinedRatio2).toFixed(2));

          // Causal Verification 1: Did displacement break a meaningful swing low (BOS)?
          const minDisplacementClose = Math.min(next1.close, next2.close, candles[i + 3]?.close || Infinity);
          const causedBos = recentSwingLow > 0 && minDisplacementClose < recentSwingLow;

          // Causal Verification 2: Did the movement create an active FVG?
          const fvgFormedAt1 = candles[i + 2] && (c.low - candles[i + 2].high) >= Math.max(0.30, atr15m * 0.15);
          const fvgFormedAt2 = candles[i + 3] && (next1.low - candles[i + 3].high) >= Math.max(0.30, atr15m * 0.15);
          const createdFvg = Boolean(fvgFormedAt1 || fvgFormedAt2);

          // Causal Verification 3: Was liquidity swept right before the displacement?
          const prevCandle = candles[i - 1];
          const priorSweepConfirmed = (recentSwingHigh > 0 && (c.high > recentSwingHigh || (prevCandle && prevCandle.high > recentSwingHigh))) ||
            (prevCandle && c.high > prevCandle.high && c.close < prevCandle.high);

          // Tiered Quality Grade Assignment
          const grade: OrderBlock['grade'] = (priorSweepConfirmed && causedBos && createdFvg)
            ? 'GRADE_A_PLUS'
            : (causedBos && createdFvg)
              ? 'GRADE_A'
              : 'GRADE_B';

          let mitigated = false;
          let isRetested = false;
          let maxPenetration = 0;
          const obSpan = Math.max(0.05, high - low);

          for (let j = i + 2; j < len; j++) {
            const probe = candles[j];
            // Invalidation: candle CLOSES completely above the high of the Order Block
            if (probe.close > high) {
              mitigated = true;
              maxPenetration = 1.0;
              break;
            }
            // Retest: wick taps into the OB zone [low, high] or touches midpoint, but candle closes below high
            if (probe.high >= low && probe.close <= high) {
              isRetested = true;
              const pen = (probe.high - low) / obSpan;
              if (pen > maxPenetration) maxPenetration = pen;
            }
          }

          let qualityScore = 65;
          if (dispRatio >= 0.75) qualityScore += 10;
          if (next1.volume && next1.volume >= 1.20 * avgVolume) qualityScore += 8;
          if (priorSweepConfirmed) qualityScore += 10;
          if (causedBos) qualityScore += 12;
          if (createdFvg) qualityScore += 10;
          if (grade === 'GRADE_A_PLUS') qualityScore = Math.min(98, qualityScore + 5);

          obs.push({
            type: 'BEARISH',
            high,
            low,
            midpoint,
            candleIndex: i,
            mitigated,
            qualityScore,
            displacementRatio: dispRatio,
            isRetested,
            causedBos,
            createdFvg,
            priorSweepConfirmed,
            grade,
            proximalBoundary: low,
            distalBoundary: high,
            mitigationPct: Math.min(100, Math.round(maxPenetration * 100))
          });
        }
      }
    }

    return obs;
  }

  public detectFairValueGaps(candles: Candle[], atr15m: number): FairValueGap[] {
    const fvgs: FairValueGap[] = [];
    const minGapSize = Math.max(0.40, atr15m * 0.20);
    const len = candles.length;

    for (let i = 2; i < len; i++) {
      const cCurrent = candles[i];
      const cImpulse = candles[i - 1];
      const cPast = candles[i - 2];

      // --- BULLISH FVG (Imbalance created by middle bullish displacement candle) ---
      if (cCurrent.low > cPast.high && cImpulse.close > cImpulse.open) {
        const gapSize = cCurrent.low - cPast.high;
        const impulseBody = cImpulse.close - cImpulse.open;
        const impulseRange = Math.max(0.05, cImpulse.high - cImpulse.low);
        const dispRatio = impulseBody / impulseRange;

        // True SMC FVG: Middle candle must display displacement (body-to-range >= 60%)
        if (gapSize >= minGapSize && dispRatio >= 0.58) {
          const bottom = cPast.high;
          const top = cCurrent.low;
          const midpoint = (top + bottom) / 2; // Consequent Encroachment (CE)
          const gapSpan = Math.max(0.05, top - bottom);

          let mitigated = false;
          let isRetested = false;
          let maxProbed = 0;

          for (let j = i + 1; j < len; j++) {
            const probe = candles[j];
            // Invalidation: candle closes completely below the bottom of the FVG
            if (probe.close < bottom) {
              mitigated = true;
              maxProbed = 1.0;
              break;
            }
            // Retest: wick enters the gap (reaches CE or between bottom and top) and candle respects it
            if (probe.low <= top && probe.low >= bottom) {
              isRetested = true;
              const pen = (top - probe.low) / gapSpan;
              if (pen > maxProbed) maxProbed = pen;
            }
          }

          fvgs.push({
            type: 'BULLISH',
            top,
            bottom,
            midpoint,
            size: parseFloat(gapSize.toFixed(2)),
            candleIndex: i,
            mitigated,
            displacementRatio: parseFloat(dispRatio.toFixed(2)),
            consequentEncroachment: parseFloat(midpoint.toFixed(2)),
            isRetested,
            proximalEdge: top,
            distalEdge: bottom,
            ce50: parseFloat(midpoint.toFixed(2)),
            mitigationPct: Math.min(100, Math.round(maxProbed * 100))
          });
        }
      }

      // --- BEARISH FVG (Imbalance created by middle bearish displacement candle) ---
      if (cCurrent.high < cPast.low && cImpulse.close < cImpulse.open) {
        const gapSize = cPast.low - cCurrent.high;
        const impulseBody = cImpulse.open - cImpulse.close;
        const impulseRange = Math.max(0.05, cImpulse.high - cImpulse.low);
        const dispRatio = impulseBody / impulseRange;

        // True SMC FVG: Middle candle must display displacement (body-to-range >= 60%)
        if (gapSize >= minGapSize && dispRatio >= 0.58) {
          const top = cPast.low;
          const bottom = cCurrent.high;
          const midpoint = (top + bottom) / 2; // Consequent Encroachment (CE)
          const gapSpan = Math.max(0.05, top - bottom);

          let mitigated = false;
          let isRetested = false;
          let maxProbed = 0;

          for (let j = i + 1; j < len; j++) {
            const probe = candles[j];
            // Invalidation: candle closes completely above the top of the FVG
            if (probe.close > top) {
              mitigated = true;
              maxProbed = 1.0;
              break;
            }
            // Retest: wick enters the gap (reaches CE or between bottom and top) and candle respects it
            if (probe.high >= bottom && probe.high <= top) {
              isRetested = true;
              const pen = (probe.high - bottom) / gapSpan;
              if (pen > maxProbed) maxProbed = pen;
            }
          }

          fvgs.push({
            type: 'BEARISH',
            top,
            bottom,
            midpoint,
            size: parseFloat(gapSize.toFixed(2)),
            candleIndex: i,
            mitigated,
            displacementRatio: parseFloat(dispRatio.toFixed(2)),
            consequentEncroachment: parseFloat(midpoint.toFixed(2)),
            isRetested,
            proximalEdge: bottom,
            distalEdge: top,
            ce50: parseFloat(midpoint.toFixed(2)),
            mitigationPct: Math.min(100, Math.round(maxProbed * 100))
          });
        }
      }
    }

    return fvgs;
  }

  // -------------------------------------------------------------
  // MULTI-TIMEFRAME SNIPER CONFIRMATION ENGINE (M15 -> M5 -> M1)
  // -------------------------------------------------------------

  public evaluateLtfConfirmation(
    candles5m: Candle[] | undefined,
    candles1m: Candle[] | undefined,
    direction: 'BUY' | 'SELL',
    zoneLow: number,
    zoneHigh: number,
    currentPrice: number,
    atr15m: number
  ): LtfConfirmationResult {
    const fallback: LtfConfirmationResult = {
      isConfirmed: false,
      m5Sweep: false,
      m5RejectionWick: false,
      m1Choch: false,
      m1Displacement: false,
      m1Fvg: null,
      sniperEntryPrice: null,
      sniperStopLoss: null,
      entryMethod: 'NONE',
      invalidationDistancePips: 0,
      confirmationReason: 'Insufficient lower-timeframe data for sniper execution'
    };

    if (!candles5m || candles5m.length < 6 || !candles1m || candles1m.length < 12) {
      return fallback;
    }

    const completed5m = candles5m.slice(0, -1);
    const completed1m = candles1m.slice(0, -1);
    const recent5m = completed5m.slice(-8); // Last ~40 minutes
    const recent1m = completed1m.slice(-20); // Last ~20 minutes

    if (direction === 'BUY') {
      // 1. M5 Inspection: Rejection wick or micro-sweep inside/near zone
      let m5Sweep = false;
      let m5RejectionWick = false;
      let m5LowestLow = Infinity;

      const swings5m = this.detectFractalSwings(completed5m);
      const prior5mLows = swings5m.filter(s => s.type === 'LOW' && s.index < completed5m.length - 1);
      const last5mSwingLow = prior5mLows.slice(-1)[0]?.price || 0;

      for (const bar of recent5m) {
        if (bar.low < m5LowestLow) m5LowestLow = bar.low;
        const barRange = Math.max(0.05, bar.high - bar.low);
        const lowerWick = Math.min(bar.open, bar.close) - bar.low;
        const wickRatio = lowerWick / barRange;
        // Bullish rejection wick: lower wick >= 35% of bar range within the institutional zone
        if (wickRatio >= 0.35 && bar.low >= zoneLow - 0.40 * atr15m && bar.low <= zoneHigh + 0.25 * atr15m) {
          m5RejectionWick = true;
        }
        // Micro sweep of prior 5M low or zone low
        if (last5mSwingLow > 0 && bar.low < last5mSwingLow && bar.close >= last5mSwingLow) {
          m5Sweep = true;
        }
      }

      // 2. M1 Inspection: Displacement, CHoCH / MSS, and fresh 1M FVG
      const swings1m = this.detectFractalSwings(completed1m);
      const swingHighs1m = swings1m.filter(s => s.type === 'HIGH').slice(-4);
      let m1Choch = false;
      let m1Displacement = false;
      let m1LowestLow = Infinity;

      for (const bar of recent1m) {
        if (bar.low < m1LowestLow) m1LowestLow = bar.low;
      }

      if (swingHighs1m.length > 0) {
        const key1mHigh = swingHighs1m[swingHighs1m.length - 1].price;
        for (let idx = recent1m.length - 1; idx >= Math.max(0, recent1m.length - 8); idx--) {
          const bar = recent1m[idx];
          if (bar.close > key1mHigh) {
            m1Choch = true;
            const barRange = Math.max(0.05, bar.high - bar.low);
            const body = bar.close - bar.open;
            if (body > 0 && body / barRange >= 0.55 && body >= 0.12 * atr15m) {
              m1Displacement = true;
            }
            break;
          }
        }
      }

      // Detect recent 1M bullish FVGs
      const fvgs1m = this.detectFairValueGaps(completed1m, Math.max(0.18, atr15m * 0.12));
      const activeBullishFvgs1m = fvgs1m.filter(f => f.type === 'BULLISH' && !f.mitigated).slice(-3);
      const best1mFvg = activeBullishFvgs1m.length > 0 ? activeBullishFvgs1m[activeBullishFvgs1m.length - 1] : null;

      const isConfirmed = (m5RejectionWick || m5Sweep) && (m1Choch || m1Displacement) && (m1Displacement || best1mFvg !== null);

      if (isConfirmed) {
        const last1m = recent1m[recent1m.length - 1];
        const dispMidpoint = last1m ? parseFloat(((last1m.open + last1m.close) / 2).toFixed(2)) : currentPrice;
        let rawSniperEntry = best1mFvg
          ? parseFloat((best1mFvg.consequentEncroachment ?? best1mFvg.midpoint).toFixed(2))
          : dispMidpoint;
        // Clamp sniper entry strictly inside the M15 Institutional Confluence Zone so we never chase above the zone
        const sniperEntryPrice = parseFloat(Math.max(zoneLow, Math.min(zoneHigh + 0.08 * atr15m, rawSniperEntry)).toFixed(2));
        const protectLow = Math.min(isFinite(m1LowestLow) ? m1LowestLow : zoneLow, isFinite(m5LowestLow) ? m5LowestLow : zoneLow, zoneLow);
        const sniperStopLoss = parseFloat((protectLow - Math.max(0.45, 0.12 * atr15m)).toFixed(2));
        const distPips = Math.max(25, Math.round((sniperEntryPrice - sniperStopLoss) * 10));

        // If true invalidation below the zone/wick requires > 55 pips, wait for price to retrace deeper into the zone
        if (distPips > 55) {
          return {
            isConfirmed: false,
            m5Sweep,
            m5RejectionWick,
            m1Choch,
            m1Displacement,
            m1Fvg: best1mFvg,
            sniperEntryPrice,
            sniperStopLoss,
            entryMethod: 'NONE',
            invalidationDistancePips: distPips,
            confirmationReason: `LTF reaction detected but true invalidation distance (${distPips} pips below $${protectLow.toFixed(2)}) exceeds 55-pip sniper cap. Awaiting deeper pullback into M15 FVG/OB.`
          };
        }

        return {
          isConfirmed: true,
          m5Sweep,
          m5RejectionWick,
          m1Choch,
          m1Displacement,
          m1Fvg: best1mFvg,
          sniperEntryPrice,
          sniperStopLoss,
          entryMethod: 'LTF_SNIPER_FVG',
          invalidationDistancePips: distPips,
          confirmationReason: best1mFvg
            ? `Verified M15 zone reaction with M5 rejection wick/sweep + M1 CHoCH displacement & fresh M1 FVG retest at $${sniperEntryPrice.toFixed(2)}`
            : `Verified M15 zone reaction with M5 rejection wick/sweep + M1 CHoCH displacement retest at $${sniperEntryPrice.toFixed(2)}`
        };
      }

      return {
        isConfirmed: false,
        m5Sweep,
        m5RejectionWick,
        m1Choch,
        m1Displacement,
        m1Fvg: best1mFvg,
        sniperEntryPrice: best1mFvg ? best1mFvg.midpoint : null,
        sniperStopLoss: isFinite(m1LowestLow) ? parseFloat((m1LowestLow - 0.35).toFixed(2)) : null,
        entryMethod: 'NONE',
        invalidationDistancePips: 0,
        confirmationReason: 'Price in M15 zone, awaiting M5 rejection sweep + M1 displacement'
      };
    } else {
      // BEARISH inspection
      let m5Sweep = false;
      let m5RejectionWick = false;
      let m5HighestHigh = -Infinity;

      const swings5m = this.detectFractalSwings(completed5m);
      const prior5mHighs = swings5m.filter(s => s.type === 'HIGH' && s.index < completed5m.length - 1);
      const last5mSwingHigh = prior5mHighs.slice(-1)[0]?.price || 0;

      for (const bar of recent5m) {
        if (bar.high > m5HighestHigh) m5HighestHigh = bar.high;
        const barRange = Math.max(0.05, bar.high - bar.low);
        const upperWick = bar.high - Math.max(bar.open, bar.close);
        const wickRatio = upperWick / barRange;
        // Bearish rejection wick: upper wick >= 35% of bar range within the institutional zone
        if (wickRatio >= 0.35 && bar.high <= zoneHigh + 0.40 * atr15m && bar.high >= zoneLow - 0.25 * atr15m) {
          m5RejectionWick = true;
        }
        // Micro sweep of prior 5M high or zone high
        if (last5mSwingHigh > 0 && bar.high > last5mSwingHigh && bar.close <= last5mSwingHigh) {
          m5Sweep = true;
        }
      }

      const swings1m = this.detectFractalSwings(completed1m);
      const swingLows1m = swings1m.filter(s => s.type === 'LOW').slice(-4);
      let m1Choch = false;
      let m1Displacement = false;
      let m1HighestHigh = -Infinity;

      for (const bar of recent1m) {
        if (bar.high > m1HighestHigh) m1HighestHigh = bar.high;
      }

      if (swingLows1m.length > 0) {
        const key1mLow = swingLows1m[swingLows1m.length - 1].price;
        for (let idx = recent1m.length - 1; idx >= Math.max(0, recent1m.length - 8); idx--) {
          const bar = recent1m[idx];
          if (bar.close < key1mLow) {
            m1Choch = true;
            const barRange = Math.max(0.05, bar.high - bar.low);
            const body = bar.open - bar.close;
            if (body > 0 && body / barRange >= 0.55 && body >= 0.12 * atr15m) {
              m1Displacement = true;
            }
            break;
          }
        }
      }

      const fvgs1m = this.detectFairValueGaps(completed1m, Math.max(0.18, atr15m * 0.12));
      const activeBearishFvgs1m = fvgs1m.filter(f => f.type === 'BEARISH' && !f.mitigated).slice(-3);
      const best1mFvg = activeBearishFvgs1m.length > 0 ? activeBearishFvgs1m[activeBearishFvgs1m.length - 1] : null;

      const isConfirmed = (m5RejectionWick || m5Sweep) && (m1Choch || m1Displacement) && (m1Displacement || best1mFvg !== null);

      if (isConfirmed) {
        const last1m = recent1m[recent1m.length - 1];
        const dispMidpoint = last1m ? parseFloat(((last1m.open + last1m.close) / 2).toFixed(2)) : currentPrice;
        let rawSniperEntry = best1mFvg
          ? parseFloat((best1mFvg.consequentEncroachment ?? best1mFvg.midpoint).toFixed(2))
          : dispMidpoint;
        // Clamp sniper entry strictly inside the M15 Institutional Confluence Zone so we never chase below the zone
        const sniperEntryPrice = parseFloat(Math.min(zoneHigh, Math.max(zoneLow - 0.08 * atr15m, rawSniperEntry)).toFixed(2));
        const protectHigh = Math.max(isFinite(m1HighestHigh) ? m1HighestHigh : zoneHigh, isFinite(m5HighestHigh) ? m5HighestHigh : zoneHigh, zoneHigh);
        const sniperStopLoss = parseFloat((protectHigh + Math.max(0.45, 0.12 * atr15m)).toFixed(2));
        const distPips = Math.max(25, Math.round((sniperStopLoss - sniperEntryPrice) * 10));

        if (distPips > 55) {
          return {
            isConfirmed: false,
            m5Sweep,
            m5RejectionWick,
            m1Choch,
            m1Displacement,
            m1Fvg: best1mFvg,
            sniperEntryPrice,
            sniperStopLoss,
            entryMethod: 'NONE',
            invalidationDistancePips: distPips,
            confirmationReason: `LTF reaction detected but true invalidation distance (${distPips} pips above $${protectHigh.toFixed(2)}) exceeds 55-pip sniper cap. Awaiting deeper pullback into M15 FVG/OB.`
          };
        }

        return {
          isConfirmed: true,
          m5Sweep,
          m5RejectionWick,
          m1Choch,
          m1Displacement,
          m1Fvg: best1mFvg,
          sniperEntryPrice,
          sniperStopLoss,
          entryMethod: 'LTF_SNIPER_FVG',
          invalidationDistancePips: distPips,
          confirmationReason: best1mFvg
            ? `Verified M15 zone reaction with M5 upper rejection wick/sweep + M1 CHoCH displacement & fresh M1 FVG retest at $${sniperEntryPrice.toFixed(2)}`
            : `Verified M15 zone reaction with M5 upper rejection wick/sweep + M1 CHoCH displacement retest at $${sniperEntryPrice.toFixed(2)}`
        };
      }

      return {
        isConfirmed: false,
        m5Sweep,
        m5RejectionWick,
        m1Choch,
        m1Displacement,
        m1Fvg: best1mFvg,
        sniperEntryPrice: best1mFvg ? best1mFvg.midpoint : null,
        sniperStopLoss: isFinite(m1HighestHigh) ? parseFloat((m1HighestHigh + 0.35).toFixed(2)) : null,
        entryMethod: 'NONE',
        invalidationDistancePips: 0,
        confirmationReason: 'Price in M15 zone, awaiting M5 rejection sweep + M1 displacement'
      };
    }
  }

  public detectAdaptiveLiquiditySweeps(candles: Candle[], keyLevels: { name: string; price: number }[], atr15m: number): LiquiditySweep[] {
    const sweeps: LiquiditySweep[] = [];
    const len = candles.length;
    const checkStart = Math.max(0, len - 16); // Phase 2: 16 15M candles (4 hours) structural sweep lookback

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
        zoneLow: 0,
        zoneHigh: 0,
        preferredEntry: 0,
        confluenceFactors: [],
        overlapCount: 0,
        zoneRank: 'WEAK',
        entryQualityCurve: []
      };
    }

    // Categorize confluence factors to enforce real structural anchors (OB or FVG) and prevent duplicate counting
    const getFactorCategory = (source: string): string => {
      if (source.includes('Order Block') || source.includes('OB')) return 'ORDER_BLOCK';
      if (source.includes('Fair Value Gap') || source.includes('FVG')) return 'FVG';
      if (source.includes('VWAP')) return 'VWAP';
      if (source.includes('Volume Profile') || source.includes('VAL') || source.includes('VAH') || source.includes('POC')) return 'VOLUME_PROFILE';
      if (source.includes('OTE') || source.includes('Fib') || source.includes('Equilibrium')) return 'FIBONACCI';
      if (source.includes('Sweep')) return 'LIQUIDITY_SWEEP';
      if (source.includes('EMA')) return 'DYNAMIC_TREND';
      if (source.includes('Breaker')) return 'BREAKER_BLOCK';
      return source;
    };

    const radius = Math.max(1.50, atr15m * 0.55);

    let bestCluster: ConfluenceCandidate[] = [];
    let bestWeight = -1;

    for (const anchor of candidates) {
      const cluster = candidates.filter(c => Math.abs(c.price - anchor.price) <= radius);
      const hasStructuralAnchor = cluster.some(c => {
        const cat = getFactorCategory(c.source);
        return cat === 'ORDER_BLOCK' || cat === 'FVG';
      });
      if (!hasStructuralAnchor) continue;
      const totalWeight = cluster.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight > bestWeight) {
        bestWeight = totalWeight;
        bestCluster = cluster;
      }
    }

    if (bestCluster.length === 0) {
      return {
        zoneLow: 0,
        zoneHigh: 0,
        preferredEntry: 0,
        confluenceFactors: Array.from(new Set(candidates.map(c => c.source))),
        overlapCount: 0,
        zoneRank: 'WEAK',
        entryQualityCurve: []
      };
    }

    const prices = bestCluster.map(c => c.price);
    let weightedSum = 0;
    let totalW = 0;
    bestCluster.forEach(c => {
      weightedSum += c.price * c.weight;
      totalW += c.weight;
    });
    const preferredEntry = parseFloat((weightedSum / Math.max(1, totalW)).toFixed(2));
    const minHalfBand = Math.max(1.25, parseFloat((atr15m * 0.30).toFixed(2)));
    const zoneLow = parseFloat(Math.min(Math.min(...prices), preferredEntry - minHalfBand).toFixed(2));
    const zoneHigh = parseFloat(Math.max(Math.max(...prices), preferredEntry + minHalfBand).toFixed(2));
    const confluenceFactors = Array.from(new Set(bestCluster.map(c => c.source)));
    const distinctCategories = new Set(bestCluster.map(c => getFactorCategory(c.source)));
    const overlapCount = distinctCategories.size;

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

    const missingTfs: string[] = [];
    if (!candles15m || candles15m.length < 30) missingTfs.push(`15M (${candles15m?.length || 0}/30)`);
    if (!candles1h || candles1h.length < 25) missingTfs.push(`1H (${candles1h?.length || 0}/25)`);
    if (!candles4h || candles4h.length < 25) missingTfs.push(`4H (${candles4h?.length || 0}/25)`);
    if (!candles5m || candles5m.length < 15) missingTfs.push(`5M (${candles5m?.length || 0}/15)`);
    if (!candles1day || candles1day.length < 2) missingTfs.push(`1D (${candles1day?.length || 0}/2)`);

    if (missingTfs.length > 0) {
      gate1Passed = false;
      gate1Score = (!candles15m || candles15m.length < 30) ? 0 : 10;
      gate1Code = (!candles15m || candles15m.length < 30) ? 'FEED_EMPTY' : 'FEED_INCOMPLETE';
      gate1Reason = `Incomplete multi-timeframe candle history: missing/insufficient ${missingTfs.join(', ')}.`;
    }
    if (candles15m && candles15m.length >= 30) {
      const lastCandle = candles15m[len15 - 1];
      const candleAgeMin = (Date.now() - lastCandle.timestamp.getTime()) / (60 * 1000);
      const now = new Date();
      const utcDay = now.getUTCDay();
      const utcHour = now.getUTCHours();
      const isWeekend = utcDay === 6 || (utcDay === 0 && utcHour < 22) || (utcDay === 5 && utcHour >= 22);

      // Tolerance for host clock drift/skew (>48 hours offset) so valid market candles are not blocked
      const isClockSkewed = Math.abs(candleAgeMin) > 2880;

      if (!isWeekend && !isClockSkewed && candleAgeMin > 60) {
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
    let trend4h: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
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
      gate2Score = 20;
      gate2Code = 'NEWS_FEED_OFFLINE';
      gate2Reason = 'Economic calendar feed offline. Execution halted to prevent trading blind into unscheduled USD news.';
    } else if (!intermarket.hasLiveMacro) {
      gate2Passed = false;
      gate2Score = 25;
      gate2Code = 'MACRO_FEED_OFFLINE';
      gate2Reason = 'Live intermarket macro feeds (DXY / US10Y 1H) unavailable. Execution halted until macro confirmation resumes.';
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

    // 5M Tactical SMC Confluence Detection for Sniper Precision
    const obs5m = completed5m && completed5m.length >= 10 ? this.detectOrderBlocks(completed5m, volMetrics.atr15m) : [];
    const fvgs5m = completed5m && completed5m.length >= 10 ? this.detectFairValueGaps(completed5m, volMetrics.atr15m) : [];
    const activeBullishObs5m = obs5m.filter(o => o.type === 'BULLISH' && !o.mitigated).slice(-2);
    const activeBearishObs5m = obs5m.filter(o => o.type === 'BEARISH' && !o.mitigated).slice(-2);
    const activeBullishFvgs5m = fvgs5m.filter(f => f.type === 'BULLISH' && !f.mitigated).slice(-2);
    const activeBearishFvgs5m = fvgs5m.filter(f => f.type === 'BEARISH' && !f.mitigated).slice(-2);

    // Sniper Entry 5M Candle Velocity & Momentum Guard:
    // Prevents entering/shorting into unmitigated freight train momentum candles.
    const last5mCandle = completed5m && completed5m.length > 0 ? completed5m[completed5m.length - 1] : null;
    let is5mBullFreightTrain = false;
    let is5mBearFreightTrain = false;
    if (last5mCandle) {
      const range5m = Math.max(0.1, last5mCandle.high - last5mCandle.low);
      const body5m = Math.abs(last5mCandle.close - last5mCandle.open);
      const isLargeBody = (body5m / range5m) >= 0.65 && body5m >= 0.35 * volMetrics.atr15m;
      if (last5mCandle.close > last5mCandle.open && isLargeBody && (last5mCandle.high - last5mCandle.close) <= 0.20 * range5m) {
        is5mBullFreightTrain = true;
      }
      if (last5mCandle.close < last5mCandle.open && isLargeBody && (last5mCandle.close - last5mCandle.low) <= 0.20 * range5m) {
        is5mBearFreightTrain = true;
      }
    }

    // Symmetrical Institutional Evidence Engine (0 - 100)
    // Anchor all structural scoring & candidate discovery strictly to the last COMPLETED 15M candle close
    // so that structural levels (Entry, SL, TP1, TP2) remain 100% deterministic for the entire 15M bar.
    const closedPrice15m = closes15.length > 0 ? closes15[closes15.length - 1] : currentPrice;
    let bullEvidence = 0;
    let bearEvidence = 0;

    // 1. Local & Daily Dealing Range Position: Premium vs Discount (Smart Money Concept)
    const recentCandleHigh15 = completed15m.length > 0 ? Math.max(...completed15m.slice(-24).map(c => c.high)) : closedPrice15m;
    const recentCandleLow15 = completed15m.length > 0 ? Math.min(...completed15m.slice(-24).map(c => c.low)) : closedPrice15m;
    const recentHighs15 = swings15.filter(s => s.type === 'HIGH').slice(-3).map(s => s.price);
    const recentLows15 = swings15.filter(s => s.type === 'LOW').slice(-3).map(s => s.price);
    const localRangeHigh = recentHighs15.length > 0 ? Math.max(...recentHighs15) : (sessionLevels.ash > 0 ? sessionLevels.ash : recentCandleHigh15);
    const localRangeLow = recentLows15.length > 0 ? Math.min(...recentLows15) : (sessionLevels.asl > 0 ? sessionLevels.asl : recentCandleLow15);
    const localRangeSpan = Math.max(1.0, localRangeHigh - localRangeLow);
    const localLocationPct = ((closedPrice15m - localRangeLow) / localRangeSpan) * 100;

    // True Daily Dealing Range [PDL..PDH] expanded by today's session extremes when available
    const hasDailyDealingRange = sessionLevels.pdh > 1000 && sessionLevels.pdl > 1000 && sessionLevels.pdh > sessionLevels.pdl;
    const dailyHighBound = hasDailyDealingRange
      ? Math.max(sessionLevels.pdh, sessionLevels.ash || 0, sessionLevels.londonHigh || 0)
      : localRangeHigh;
    const validDailyLowCandidates = [sessionLevels.pdl, sessionLevels.asl, sessionLevels.londonLow].filter(v => v > 1000);
    const dailyLowBound = hasDailyDealingRange && validDailyLowCandidates.length > 0
      ? Math.min(...validDailyLowCandidates)
      : localRangeLow;
    const dailyRangeSpan = Math.max(1.0, dailyHighBound - dailyLowBound);
    const dailyLocationPct = ((closedPrice15m - dailyLowBound) / dailyRangeSpan) * 100;

    // 15M Swing Structure (Higher Highs / Higher Lows vs Lower Highs / Lower Lows)
    let trend15m: 'BULLISH' | 'BEARISH' | 'RANGING' = 'RANGING';
    const last2Highs15 = swings15.filter(s => s.type === 'HIGH').slice(-2);
    const last2Lows15 = swings15.filter(s => s.type === 'LOW').slice(-2);
    if (last2Highs15.length === 2 && last2Lows15.length === 2) {
      if (last2Highs15[1].price < last2Highs15[0].price && (last2Lows15[1].price <= last2Lows15[0].price || closedPrice15m < ema20)) {
        trend15m = 'BEARISH';
      } else if (last2Highs15[1].price > last2Highs15[0].price && (last2Lows15[1].price >= last2Lows15[0].price || closedPrice15m > ema20)) {
        trend15m = 'BULLISH';
      } else if (closedPrice15m < last2Lows15[1].price) {
        trend15m = 'BEARISH';
      } else if (closedPrice15m > last2Highs15[1].price) {
        trend15m = 'BULLISH';
      }
    } else if (closedPrice15m < ema20 && ema20 < ema50) {
      trend15m = 'BEARISH';
    } else if (closedPrice15m > ema20 && ema20 > ema50) {
      trend15m = 'BULLISH';
    }

    // Detect if a verified institutional liquidity sweep, OB/FVG retest, or structural confirmation indicates valid tactical execution
    const isBullishReversalContext =
      (!!latestBullishSweep && latestBullishSweep.qualityScore >= 60) ||
      mss5mBuy ||
      bos15mBuy ||
      rsiDiv === 'BULLISH_DIVERGENCE';
    const isBearishReversalContext =
      (!!latestBearishSweep && latestBearishSweep.qualityScore >= 60) ||
      mss5mSell ||
      bos15mSell ||
      rsiDiv === 'BEARISH_DIVERGENCE';

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

    if (closedPrice15m < ema20) {
      bearEvidence += 8;
      if (ema20 < ema50) bearEvidence += 6;
    } else if (closedPrice15m > ema20) {
      bullEvidence += 8;
      if (ema20 > ema50) bullEvidence += 6;
    }

    if (macd.histogram < 0) bearEvidence += 6;
    else if (macd.histogram > 0) bullEvidence += 6;

    // 4. Actionable Execution Triggers (Sweeps, MSS/BOS, Price Retesting Active OB/FVG, or EMA20-50 Pullbacks)
    const isBullTrend = trend15m === 'BULLISH' || (htfTrend === 'BULLISH' && closedPrice15m >= ema50) || (ema20 > ema50 && closedPrice15m >= ema50) || (closedPrice15m > ema20 && sessionLevels.sessionVwap > 0 && closedPrice15m > sessionLevels.sessionVwap);
    const isBearTrend = trend15m === 'BEARISH' || (htfTrend === 'BEARISH' && closedPrice15m <= ema50) || (ema20 < ema50 && closedPrice15m <= ema50) || (closedPrice15m < ema20 && sessionLevels.sessionVwap > 0 && closedPrice15m < sessionLevels.sessionVwap);

    // Pullbacks must be genuine retracements into the EMA20-EMA50 zone in the direction of the 15M/1H trend
    const isBullPullback = isBullTrend && closedPrice15m >= ema50 - 0.35 * volMetrics.atr15m && closedPrice15m <= ema20 + 0.45 * volMetrics.atr15m && trend15m !== 'BEARISH';
    const isBearPullback = isBearTrend && closedPrice15m <= ema50 + 0.35 * volMetrics.atr15m && closedPrice15m >= ema20 - 0.45 * volMetrics.atr15m && trend15m !== 'BULLISH';
    const isBullVwapPullback = isBullTrend && sessionLevels.sessionVwap > 0 && Math.abs(closedPrice15m - sessionLevels.sessionVwap) <= 0.65 * volMetrics.atr15m && closedPrice15m >= sessionLevels.sessionVwap - 0.25 * volMetrics.atr15m;
    const isBearVwapPullback = isBearTrend && sessionLevels.sessionVwap > 0 && Math.abs(closedPrice15m - sessionLevels.sessionVwap) <= 0.65 * volMetrics.atr15m && closedPrice15m <= sessionLevels.sessionVwap + 0.25 * volMetrics.atr15m;

    const priceNearBullObOrFvg =
      activeBullishObs.some(o => closedPrice15m >= o.low - 0.35 * volMetrics.atr15m && closedPrice15m <= o.high + 0.60 * volMetrics.atr15m) ||
      activeBullishFvgs.some(f => closedPrice15m >= f.bottom - 0.35 * volMetrics.atr15m && closedPrice15m <= f.top + 0.60 * volMetrics.atr15m);
    const priceNearBearObOrFvg =
      activeBearishObs.some(o => closedPrice15m >= o.low - 0.60 * volMetrics.atr15m && closedPrice15m <= o.high + 0.35 * volMetrics.atr15m) ||
      activeBearishFvgs.some(f => closedPrice15m >= f.bottom - 0.60 * volMetrics.atr15m && closedPrice15m <= f.top + 0.35 * volMetrics.atr15m);

    // Phase 3 True SMC FVG & Order Block Re-Test Detection (Price holding above mean threshold / Consequent Encroachment)
    const isBullFvgRetest = activeBullishFvgs.some(
      f => closedPrice15m >= f.bottom - 0.20 * volMetrics.atr15m && closedPrice15m <= f.top + 0.35 * volMetrics.atr15m && trend15m !== 'BEARISH'
    );
    const isBearFvgRetest = activeBearishFvgs.some(
      f => closedPrice15m <= f.top + 0.20 * volMetrics.atr15m && closedPrice15m >= f.bottom - 0.35 * volMetrics.atr15m && trend15m !== 'BULLISH'
    );
    const isBullObRetest = activeBullishObs.some(
      o => closedPrice15m >= o.low - 0.20 * volMetrics.atr15m && closedPrice15m <= o.high + 0.35 * volMetrics.atr15m && trend15m !== 'BEARISH'
    );
    const isBearObRetest = activeBearishObs.some(
      o => closedPrice15m <= o.high + 0.20 * volMetrics.atr15m && closedPrice15m >= o.low - 0.35 * volMetrics.atr15m && trend15m !== 'BULLISH'
    );

    // Multi-Timeframe Trend Continuation Detection (15M aligned with 1H or 4H structure or momentum expansion)
    const isBullContinuation =
      isBullTrend &&
      (htfTrend === 'BULLISH' || trend4h === 'BULLISH' || (ema20 > ema50 && adx14 >= 22)) &&
      (bos15mBuy || isBullPullback || isBullVwapPullback || priceNearBullObOrFvg || isBullFvgRetest || isBullObRetest || mss5mBuy);
    const isBearContinuation =
      isBearTrend &&
      (htfTrend === 'BEARISH' || trend4h === 'BEARISH' || (ema20 < ema50 && adx14 >= 22)) &&
      (bos15mSell || isBearPullback || isBearVwapPullback || priceNearBearObOrFvg || isBearFvgRetest || isBearObRetest || mss5mSell);

    // Institutional Long / Short Macro Continuation (Deep Multi-Timeframe Alignment: 15M + 1H + 4H + D1 + Liquidity Draw)
    const isLongMacroContinuation =
      isBullTrend &&
      (htfTrend === 'BULLISH' || trend4h === 'BULLISH' || trendDaily === 'BULLISH') &&
      (intermarket.macroDrawOnLiquidity === 'BUY_SIDE_LIQUIDITY' || intermarket.macroAlignment === 'BULLISH' || (ema20 > ema50 && adx14 >= 22)) &&
      (bos15mBuy || isBullPullback || isBullVwapPullback || priceNearBullObOrFvg || isBullFvgRetest || isBullObRetest || mss5mBuy);
    const isShortMacroContinuation =
      isBearTrend &&
      (htfTrend === 'BEARISH' || trend4h === 'BEARISH' || trendDaily === 'BEARISH') &&
      (intermarket.macroDrawOnLiquidity === 'SELL_SIDE_LIQUIDITY' || intermarket.macroAlignment === 'BEARISH' || (ema20 < ema50 && adx14 >= 22)) &&
      (bos15mSell || isBearPullback || isBearVwapPullback || priceNearBearObOrFvg || isBearFvgRetest || isBearObRetest || mss5mSell);

    // Institutional Post-News Macro Trigger (Structure Rebuild after High-Impact US Releases)
    const isPostNewsBullish = newsGate.eventStage === 'STRUCTURE_REBUILD' && newsGate.fundamentalBias === 'BULLISH';
    const isPostNewsBearish = newsGate.eventStage === 'STRUCTURE_REBUILD' && newsGate.fundamentalBias === 'BEARISH';

    // Strict Trigger Requirement: must have an actual institutional catalyst (Continuation OR Reversal)
    const hasBullishTrigger =
      isPostNewsBullish ||
      isLongMacroContinuation ||
      isBullContinuation ||
      !!latestBullishSweep ||
      mss5mBuy ||
      bos15mBuy ||
      isBullFvgRetest ||
      isBullObRetest ||
      isBullPullback ||
      isBullVwapPullback ||
      (priceNearBullObOrFvg && trend15m !== 'BEARISH') ||
      rsiDiv === 'BULLISH_DIVERGENCE';
    const hasBearishTrigger =
      isPostNewsBearish ||
      isShortMacroContinuation ||
      isBearContinuation ||
      !!latestBearishSweep ||
      mss5mSell ||
      bos15mSell ||
      isBearFvgRetest ||
      isBearObRetest ||
      isBearPullback ||
      isBearVwapPullback ||
      (priceNearBearObOrFvg && trend15m !== 'BULLISH') ||
      rsiDiv === 'BEARISH_DIVERGENCE';

    if (isPostNewsBullish) bullEvidence += 18;
    if (isPostNewsBearish) bearEvidence += 18;
    if (bos15mBuy) bullEvidence += 10;
    if (bos15mSell) bearEvidence += 10;

    // Deduplicated SMC Order Block & FVG Defense (Max 16 pts, no overlapping multi-counting)
    if (isBullObRetest) bullEvidence += 16;
    else if (isBullFvgRetest) bullEvidence += 14;
    else if (priceNearBullObOrFvg) bullEvidence += 8;
    else if (activeBullishObs.length > 0 || activeBullishObs5m.length > 0) bullEvidence += 4;

    if (isBearObRetest) bearEvidence += 16;
    else if (isBearFvgRetest) bearEvidence += 14;
    else if (priceNearBearObOrFvg) bearEvidence += 8;
    else if (activeBearishObs.length > 0 || activeBearishObs5m.length > 0) bearEvidence += 4;

    // Deduplicated Trend Continuation Evidence (Max 16 pts)
    if (isLongMacroContinuation) bullEvidence += 16;
    else if (isBullContinuation) bullEvidence += 12;
    else if (isBullPullback) bullEvidence += 8;

    if (isShortMacroContinuation) bearEvidence += 16;
    else if (isBearContinuation) bearEvidence += 12;
    else if (isBearPullback) bearEvidence += 8;

    // Compare recency of Bullish vs Bearish Liquidity Sweeps so an older sweep never cancels a newer opposite sweep
    const bullSweepIdx = latestBullishSweep ? latestBullishSweep.candleIndex : -1;
    const bearSweepIdx = latestBearishSweep ? latestBearishSweep.candleIndex : -1;

    if (latestBullishSweep && bullSweepIdx >= bearSweepIdx) {
      const sweepPts = Math.min(22, Math.round(latestBullishSweep.qualityScore * 0.24));
      bullEvidence += sweepPts;
      if (mss5mBuy) bullEvidence += 12;
    } else if (latestBullishSweep) {
      bullEvidence += 6;
    }

    if (latestBearishSweep && bearSweepIdx >= bullSweepIdx) {
      const sweepPts = Math.min(22, Math.round(latestBearishSweep.qualityScore * 0.24));
      bearEvidence += sweepPts;
      if (mss5mSell) bearEvidence += 12;
    } else if (latestBearishSweep) {
      bearEvidence += 6;
    }

    if (sessionLevels.sessionVwap > 0 && currentPrice > sessionLevels.sessionVwap) bullEvidence += 4;
    else if (sessionLevels.sessionVwap > 0 && currentPrice < sessionLevels.sessionVwap) bearEvidence += 4;

    // 5. Higher-Timeframe (HTF) Dominance Evaluation (4H & 1H Primary Order Flow)
    const isHtfBullDominant = trend4h === 'BULLISH' && htfTrend === 'BULLISH';
    const isHtfBearDominant = trend4h === 'BEARISH' && htfTrend === 'BEARISH';

    const isStrongBearBreakdown = (isBearTrend || isBearContinuation) && (adx14 >= 25 || htfTrend === 'BEARISH' || trend15m === 'BEARISH') && !isBullishReversalContext;
    const isStrongBullBreakout = (isBullTrend || isBullContinuation) && (adx14 >= 25 || htfTrend === 'BULLISH' || trend15m === 'BULLISH') && !isBearishReversalContext;

    // Location in Dealing Range (Discount vs Premium)
    // Symmetrical and aware of trend: In an established uptrend, high location is bullish expansion, NOT a reason to short!
    // In an established downtrend, low location is bearish expansion, NOT a reason to buy!
    const isUptrendStructure = isBullTrend || trend15m === 'BULLISH' || htfTrend === 'BULLISH';
    const isDowntrendStructure = isBearTrend || trend15m === 'BEARISH' || htfTrend === 'BEARISH';

    if (localLocationPct <= 35 && !isStrongBearBreakdown && !isHtfBearDominant) {
      bullEvidence += 10;
      if (!isDowntrendStructure || isBullishReversalContext) {
        bearEvidence -= 8;
      }
    } else if (localLocationPct >= 65 && !isStrongBullBreakout && !isHtfBullDominant) {
      bearEvidence += 10;
      if (!isUptrendStructure || isBearishReversalContext) {
        bullEvidence -= 8;
      }
    }

    // 6. Immediate Candlestick Displacement & Rejection Check (on completed 15M bar)
    const lastCandle15 = completed15m[completed15m.length - 1];
    if (lastCandle15) {
      const lastBody = Math.abs(lastCandle15.close - lastCandle15.open);
      const lastRange = Math.max(0.1, lastCandle15.high - lastCandle15.low);
      const isBearDisplacement = lastCandle15.close < lastCandle15.open && (lastBody / lastRange) > 0.50 && lastBody > 0.45 * volMetrics.atr15m;
      const isBullDisplacement = lastCandle15.close > lastCandle15.open && (lastBody / lastRange) > 0.50 && lastBody > 0.45 * volMetrics.atr15m;

      if (isBearDisplacement && !isHtfBullDominant) {
        bullEvidence -= 14;
        bearEvidence += 14;
      }
      if (isBullDisplacement && !isHtfBearDominant) {
        bearEvidence -= 14;
        bullEvidence += 14;
      }
    }

    // 7. RSI Overextension & Divergences (Institutional Momentum Calibration):
    // In an uptrend, RSI 60-78 represents aggressive institutional sponsorship, NOT an automatic top!
    // In a downtrend, RSI 22-40 represents institutional distribution, NOT an automatic bottom!
    if (rsi14 >= 68) {
      if (rsiDiv === 'BEARISH_DIVERGENCE' || (isBearishReversalContext && !isHtfBullDominant)) {
        bullEvidence -= 14;
        bearEvidence += 14;
      } else if (isHtfBullDominant || isBullTrend || isBullContinuation) {
        bullEvidence += 8; // Institutional momentum expansion!
      }
    } else if (rsi14 > 0 && rsi14 <= 32) {
      if (rsiDiv === 'BULLISH_DIVERGENCE' || (isBullishReversalContext && !isHtfBearDominant)) {
        bearEvidence -= 14;
        bullEvidence += 14;
      } else if (isHtfBearDominant || isBearTrend || isBearContinuation) {
        bearEvidence += 8; // Institutional selling momentum!
      }
    }

    if (rsiDiv === 'BULLISH_DIVERGENCE') {
      bullEvidence += 16;
      bearEvidence -= 14;
    }
    if (rsiDiv === 'BEARISH_DIVERGENCE') {
      bearEvidence += 16;
      bullEvidence -= 14;
    }

    // 8. Intermarket Macro Alignment & Draw on Liquidity (Award points only if real live macro data exists)
    if (intermarket.hasLiveMacro) {
      if (intermarket.macroAlignment === 'BULLISH') {
        bullEvidence += 14;
        bearEvidence -= 10;
      } else if (intermarket.macroAlignment === 'BEARISH') {
        bearEvidence += 14;
        bullEvidence -= 10;
      } else if (intermarket.macroBias === 'BULLISH') {
        bullEvidence += 6;
      } else if (intermarket.macroBias === 'BEARISH') {
        bearEvidence += 6;
      } else if (intermarket.macroAlignment === 'SAFE_HAVEN_DECOUPLING') {
        bullEvidence += 8;
      } else {
        bullEvidence += 4;
        bearEvidence += 4;
      }
    }

    // 8.2. Fundamental News Direction & Release Metrics
    if (newsGate.fundamentalBias === 'BULLISH') {
      bullEvidence += 14;
      bearEvidence -= 12;
    } else if (newsGate.fundamentalBias === 'BEARISH') {
      bearEvidence += 14;
      bullEvidence -= 12;
    }

    // 8.3. Active News Momentum & Persistence Integration (Trump announcements, tariffs, geopolitics)
    const np = newsGate.newsPersistence;
    if (np && np.topTheme) {
      const topTheme = np.topTheme;
      if (topTheme.status === 'ACTIVE' && topTheme.persistenceScore >= 50) {
        const boost = Math.round((topTheme.persistenceScore / 100) * 14);
        if (topTheme.expectedGoldBias === 'BULLISH') {
          bullEvidence += boost;
          bearEvidence -= Math.round(boost * 0.7);
        } else if (topTheme.expectedGoldBias === 'BEARISH') {
          bearEvidence += boost;
          bullEvidence -= Math.round(boost * 0.7);
        }
      } else if (topTheme.status === 'REVERSED') {
        // Market faded the news announcement: boost technical flow in the reversal direction!
        if (topTheme.expectedGoldBias === 'BULLISH') {
          bearEvidence += 10;
          bullEvidence -= 8;
        } else if (topTheme.expectedGoldBias === 'BEARISH') {
          bullEvidence += 10;
          bearEvidence -= 8;
        }
      }
    }

    // 8.5. Top-Down Macro Context Alignment (W1 + D1 Higher Timeframe Confirmation)
    if (trendWeekly === 'BULLISH' && trendDaily === 'BULLISH') {
      bullEvidence += 4;
    } else if (trendWeekly === 'BEARISH' && trendDaily === 'BEARISH') {
      bearEvidence += 4;
    } else {
      bullEvidence += 3;
      bearEvidence += 3;
    }

    // Clamp scores
    bullEvidence = Math.max(0, Math.min(100, bullEvidence));
    bearEvidence = Math.max(0, Math.min(100, bearEvidence));

    // Symmetrical Direction Stability Filter (Quality over Frequency)
    // Requires minimum score of 54, an evidence margin of at least 10 points, AND an active trigger
    let bias: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
    let counterTrendBlockedReason: string | null = null;

    // Stage 2: Directional Bias with Higher-Timeframe (HTF) Dominance
    const isRangeDeviationEligible =
      isBullObRetest ||
      isBullFvgRetest ||
      isBearObRetest ||
      isBearFvgRetest ||
      priceNearBullObOrFvg ||
      priceNearBearObOrFvg ||
      trend15m !== 'RANGING' ||
      (localLocationPct <= 45 && (mss5mBuy || bos15mBuy || !!latestBullishSweep)) ||
      (localLocationPct >= 55 && (mss5mSell || bos15mSell || !!latestBearishSweep));
    const bothRanging = htfTrend === 'RANGING' && trend4h === 'RANGING';
    const htfConflicted = (htfTrend === 'BULLISH' && trend4h === 'BEARISH') || (htfTrend === 'BEARISH' && trend4h === 'BULLISH');

    // Independent, Symmetric Institutional Evaluation for BUY and SELL
    // Guarantees BUY and SELL evaluate independently and never block one another
    const isBullViable = bullEvidence >= 48 && hasBullishTrigger;
    const isBearViable = bearEvidence >= 48 && hasBearishTrigger;

    // Phase 2: Killzones & Session Timing Check
    const nowUtc = new Date();
    const utcHours = nowUtc.getUTCHours() + nowUtc.getUTCMinutes() / 60;
    const isLondonKillzone = utcHours >= 7.0 && utcHours <= 10.5; // 07:00–10:30 UTC
    const isNyKillzone = utcHours >= 12.5 && utcHours <= 16.0; // 12:30–16:00 UTC
    const isLondonClose = utcHours >= 16.0 && utcHours <= 17.5; // 16:00–17:30 UTC
    const isPrimeKillzone = isLondonKillzone || isNyKillzone || isLondonClose;

    // Phase 2: Mandatory Liquidity Sweep Verification (within last 16 15M candles / 4 hours)
    const recentBullSweep = Boolean(
      latestBullishSweep && (completed15m.length - 1 - latestBullishSweep.candleIndex) <= 16
    );
    const recentBearSweep = Boolean(
      latestBearishSweep && (completed15m.length - 1 - latestBearishSweep.candleIndex) <= 16
    );

    // Check BUY vetoes independently (Phase 2 Entry Quality Rules)
    let bullVeto: string | null = null;
    const isMarketReversedBull = np?.isMarketReversed && np.topTheme?.expectedGoldBias === 'BEARISH';
    const isMarketReversedBear = np?.isMarketReversed && np.topTheme?.expectedGoldBias === 'BULLISH';

    if (isMarketReversedBear) {
      bullVeto = `Failed Headline Trap Veto: Market faded bullish catalyst ("${np?.topTheme?.title}") and reversed below announcement price ($${np?.topTheme?.initialGoldPrice?.toFixed(2)}). Buying into reversed headline trap blocked.`;
    } else if (newsGate.fundamentalBias === 'BEARISH' && !isMarketReversedBull) {
      bullVeto = `Fundamental Veto: Post-release economic metrics (${newsGate.eventTitle}) are Hawkish/Strong USD (${newsGate.fundamentalSummary || 'Actual > Forecast'}). Counter-fundamental Gold longs strictly blocked.`;
    } else if (intermarket.macroAlignment === 'BEARISH' && intermarket.dxyChange1h >= 0.15 && !isBullishReversalContext && !isMarketReversedBull) {
      bullVeto = `Macro Conflict Veto: Surging USD (+${intermarket.dxyChange1h}%) and rising yields oppose Gold longs. Setup violates institutional Macro Draw on Liquidity.`;
    } else if (trend4h === 'BEARISH') {
      // Phase 2 Rule: Hard HTF Alignment. 4H Bearish strictly prohibits BUY unless confirmed HTF sweep (PDL/PWL/Session Low) + structure shift.
      const hasHtfReversalSweep = Boolean(
        latestBullishSweep && (
          latestBullishSweep.levelName.includes('PDL') ||
          latestBullishSweep.levelName.includes('PWL') ||
          latestBullishSweep.levelName.includes('4H') ||
          latestBullishSweep.levelName.includes('Low')
        )
      );
      const isConfirmed4hReversal = hasHtfReversalSweep && (mss5mBuy || bos15mBuy);
      if (!isConfirmed4hReversal) {
        bullVeto = 'HTF Dominance Veto: 4H structure is BEARISH. Longs against 4H order flow are prohibited without confirmed HTF liquidity sweep (PDL/PWL/Session Low) and structure shift.';
      }
    } else if (!recentBullSweep) {
      // Phase 2 Rule: Mandatory Liquidity Sweep. No sweep = No trade!
      bullVeto = 'Awaiting Liquidity Sweep: No verified sweep of low-side liquidity (Asia/London/PDL/15M swing low) in the last 4 hours. Entries without a prior sweep are prohibited.';
    } else if (sessionLevels.pdh > 1000 && currentPrice >= sessionLevels.pdh) {
      // Phase 2 Rule: Daily Premium/Discount. Buying above PDH is buying buy-side liquidity / top of daily expansion!
      bullVeto = `Premium Range Veto: Spot price ($${currentPrice.toFixed(2)}) is trading at or above Previous Day High ($${sessionLevels.pdh.toFixed(2)}). Buying into premium expansion / buy-side liquidity is prohibited.`;
    } else if ((dailyLocationPct > 65 || localLocationPct > 65) && !isStrongBullBreakout) {
      bullVeto = `Premium Dealing Range Veto: Spot is in Premium (Daily: ${Math.round(dailyLocationPct)}%, Intraday: ${Math.round(localLocationPct)}%). High-probability BUYs require discount (< 50%).`;
    } else if (!isPrimeKillzone && (!latestBullishSweep || trend4h !== 'BULLISH')) {
      // Phase 2 Rule: Killzone Timing. Outside London & NY killzones, require strict A+ alignment.
      bullVeto = `Killzone Filter: Current time (${nowUtc.getUTCHours().toString().padStart(2, '0')}:${nowUtc.getUTCMinutes().toString().padStart(2, '0')} UTC) is outside London & NY killzones. Generic setups held for active market volume.`;
    } else if (bothRanging && !isRangeDeviationEligible) {
      bullVeto = 'Directional Bias Neutral: 4H and 1H are in equilibrium range-bound chop without an active range-deviation or sweep reclaim.';
    } else if (htfConflicted && htfTrend === 'BEARISH') {
      bullVeto = 'Conflicting Multi-Timeframe Bias: 1H Bullish vs 4H Bearish trend conflict without verified institutional reversal sweep + MSS.';
    } else if (is5mBearFreightTrain) {
      bullVeto = 'Sniper Entry Hold: Active 5M institutional selling impulse without lower rejection wick. Awaiting candle exhaustion / rejection.';
    }

    // Check SELL vetoes independently (Phase 2 Entry Quality Rules)
    let bearVeto: string | null = null;
    if (isMarketReversedBull) {
      bearVeto = `Failed Headline Trap Veto: Market faded bearish catalyst ("${np?.topTheme?.title}") and reversed above announcement price ($${np?.topTheme?.initialGoldPrice?.toFixed(2)}). Shorting into reversed headline trap blocked.`;
    } else if (newsGate.fundamentalBias === 'BULLISH' && !isMarketReversedBear) {
      bearVeto = `Fundamental Veto: Post-release economic metrics (${newsGate.eventTitle}) are Dovish/Weak USD (${newsGate.fundamentalSummary || 'Actual < Forecast'}). Counter-fundamental Gold shorts strictly blocked.`;
    } else if (intermarket.macroAlignment === 'BULLISH' && intermarket.dxyChange1h <= -0.15 && !isBearishReversalContext && !isMarketReversedBear) {
      bearVeto = `Macro Conflict Veto: Tumbling USD (${intermarket.dxyChange1h}%) and softening yields provide macro tailwind for Gold. Shorting violates institutional Macro Draw on Liquidity.`;
    } else if (trend4h === 'BULLISH') {
      // Phase 2 Rule: Hard HTF Alignment. 4H Bullish strictly prohibits SELL unless confirmed HTF sweep (PDH/PWH/Session High) + structure shift.
      const hasHtfReversalSweep = Boolean(
        latestBearishSweep && (
          latestBearishSweep.levelName.includes('PDH') ||
          latestBearishSweep.levelName.includes('PWH') ||
          latestBearishSweep.levelName.includes('4H') ||
          latestBearishSweep.levelName.includes('High')
        )
      );
      const isConfirmed4hReversal = hasHtfReversalSweep && (mss5mSell || bos15mSell);
      if (!isConfirmed4hReversal) {
        bearVeto = 'HTF Dominance Veto: 4H structure is BULLISH. Shorts against 4H order flow are prohibited without confirmed HTF liquidity sweep (PDH/PWH/Session High) and structure shift.';
      }
    } else if (!recentBearSweep) {
      // Phase 2 Rule: Mandatory Liquidity Sweep. No sweep = No trade!
      bearVeto = 'Awaiting Liquidity Sweep: No verified sweep of high-side liquidity (Asia/London/PDH/15M swing high) in the last 4 hours. Entries without a prior sweep are prohibited.';
    } else if (sessionLevels.pdl > 1000 && currentPrice <= sessionLevels.pdl) {
      // Phase 2 Rule: Daily Premium/Discount. Selling below PDL is selling sell-side liquidity / bottom of daily expansion!
      bearVeto = `Discount Range Veto: Spot price ($${currentPrice.toFixed(2)}) is trading at or below Previous Day Low ($${sessionLevels.pdl.toFixed(2)}). Selling into discount expansion / sell-side liquidity is prohibited.`;
    } else if ((dailyLocationPct < 35 || localLocationPct < 35) && !isStrongBearBreakdown) {
      bearVeto = `Discount Dealing Range Veto: Spot is in Discount (Daily: ${Math.round(dailyLocationPct)}%, Intraday: ${Math.round(localLocationPct)}%). High-probability SELLs require premium (> 50%).`;
    } else if (!isPrimeKillzone && (!latestBearishSweep || trend4h !== 'BEARISH')) {
      // Phase 2 Rule: Killzone Timing. Outside London & NY killzones, require strict A+ alignment.
      bearVeto = `Killzone Filter: Current time (${nowUtc.getUTCHours().toString().padStart(2, '0')}:${nowUtc.getUTCMinutes().toString().padStart(2, '0')} UTC) is outside London & NY killzones. Generic setups held for active market volume.`;
    } else if (bothRanging && !isRangeDeviationEligible) {
      bearVeto = 'Directional Bias Neutral: 4H and 1H are in equilibrium range-bound chop without an active range-deviation or sweep reclaim.';
    } else if (htfConflicted && htfTrend === 'BULLISH') {
      bearVeto = 'Conflicting Multi-Timeframe Bias: 1H Bearish vs 4H Bullish trend conflict without verified institutional reversal sweep + MSS.';
    } else if (is5mBullFreightTrain) {
      bearVeto = 'Sniper Entry Hold: Active 5M institutional buying impulse without upper rejection wick. Awaiting candle exhaustion / rejection.';
    }

    const bullQualified = isBullViable && !bullVeto;
    const bearQualified = isBearViable && !bearVeto;

    if (bullQualified && !bearQualified) {
      bias = 'BUY';
    } else if (bearQualified && !bullQualified) {
      bias = 'SELL';
    } else if (bullQualified && bearQualified) {
      if (bullEvidence > bearEvidence + 4) {
        bias = 'BUY';
      } else if (bearEvidence > bullEvidence + 4) {
        bias = 'SELL';
      } else {
        bias = trend4h === 'BULLISH' || htfTrend === 'BULLISH' ? 'BUY' : 'SELL';
      }
    } else {
      bias = 'NO_TRADE';
      counterTrendBlockedReason = bullVeto || bearVeto || (
        bullEvidence >= 48 ? 'BUY setup pending trigger confirmation' :
        bearEvidence >= 48 ? 'SELL setup pending trigger confirmation' :
        'Directional bias is neutral. Insufficient institutional edge to commit capital.'
      );
    }

    const structuralDirection: 'BUY' | 'SELL' = bias !== 'NO_TRADE' ? bias : (bearEvidence > bullEvidence ? 'SELL' : 'BUY');

    let gate3Passed = true;
    let gate3Score = 75;
    let gate3Code = 'SETUP_VALID';
    let gate3Reason = 'Statistical setup matches market regime with directional edge.';

    if (bias === 'BUY') {
      gate3Score = Math.min(98, Math.max(52, bullEvidence));
      if (intermarket.macroAlignment === 'BEARISH' && intermarket.dxyChange1h >= 0.15 && bullEvidence < 82 && !isMarketReversedBull) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'MACRO_TECHNICAL_CONFLICT';
        gate3Reason = `Technical long vetoed by Macro Conflict: ${intermarket.conflictReason || 'Surging USD and Yields oppose gold longs'}`;
      } else if (newsGate.fundamentalBias === 'BEARISH' && !isMarketReversedBull) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'FUNDAMENTAL_NEWS_CONFLICT';
        gate3Reason = `Technical long vetoed by Fundamental News: ${newsGate.fundamentalSummary || 'Hawkish USD release'}`;
      }
    } else if (bias === 'SELL') {
      gate3Score = Math.min(98, Math.max(52, bearEvidence));
      if (intermarket.macroAlignment === 'BULLISH' && intermarket.dxyChange1h <= -0.15 && bearEvidence < 82 && !isMarketReversedBear) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'MACRO_TECHNICAL_CONFLICT';
        gate3Reason = `Technical short vetoed by Macro Conflict: ${intermarket.conflictReason || 'Bullish macro tailwinds and safe-haven demand oppose gold shorts'}`;
      } else if (newsGate.fundamentalBias === 'BULLISH' && !isMarketReversedBear) {
        gate3Passed = false;
        gate3Score = 30;
        gate3Code = 'FUNDAMENTAL_NEWS_CONFLICT';
        gate3Reason = `Technical short vetoed by Fundamental News: ${newsGate.fundamentalSummary || 'Dovish USD release'}`;
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
    const recentSwingsLow = swings15.filter(s => s.type === 'LOW').slice(-3).map(s => s.price);
    const recentSwingsHigh = swings15.filter(s => s.type === 'HIGH').slice(-3).map(s => s.price);
    const swingLow = recentSwingsLow.length > 0 ? Math.min(...recentSwingsLow) : 0;
    const swingHigh = recentSwingsHigh.length > 0 ? Math.max(...recentSwingsHigh) : 0;
    const hasValidDealingRange = swingLow > 0 && swingHigh > swingLow && (swingHigh - swingLow) >= volMetrics.atr15m * 1.5;
    const rangeHigh = hasValidDealingRange ? Math.max(swingHigh, closedPrice15m) : 0;
    const rangeLow = hasValidDealingRange ? Math.min(swingLow, closedPrice15m) : 0;
    const dealingSpan = hasValidDealingRange ? (rangeHigh - rangeLow) : 0;
    const equilibrium = hasValidDealingRange ? parseFloat(((rangeLow + rangeHigh) / 2).toFixed(2)) : 0;
    const maxCandidateDist = 2.6 * volMetrics.atr15m;

    if (structuralDirection === 'BUY') {
      const maxBuyLevel = closedPrice15m + 0.05 * volMetrics.atr15m;
      const minBuyLevel = closedPrice15m - maxCandidateDist;

      activeBullishObs
        .filter(ob => ob.midpoint <= maxBuyLevel && ob.midpoint >= minBuyLevel)
        .forEach(ob => {
          candidates.push({ source: '15M Bullish Order Block Midpoint', price: ob.midpoint, weight: 4 });
          if (ob.high <= maxBuyLevel) {
            candidates.push({ source: '15M Bullish Order Block Edge', price: ob.high, weight: 3 });
          }
        });
      obs1h
        .filter(ob => !ob.mitigated && ob.type === 'BULLISH' && ob.midpoint <= maxBuyLevel && ob.midpoint >= closedPrice15m - 3.0 * volMetrics.atr15m)
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
      activeBullishObs5m
        .filter(ob => ob.midpoint <= maxBuyLevel && ob.midpoint >= minBuyLevel)
        .forEach(ob => {
          candidates.push({ source: '5M Tactical Bullish OB Midpoint', price: ob.midpoint, weight: 3 });
        });
      activeBullishFvgs5m
        .filter(fvg => fvg.midpoint <= maxBuyLevel && fvg.midpoint >= minBuyLevel)
        .forEach(fvg => {
          candidates.push({ source: '5M Tactical Bullish FVG', price: fvg.midpoint, weight: 3 });
        });
      if (sessionLevels.sessionVwap > 0 && sessionLevels.sessionVwap <= maxBuyLevel && sessionLevels.sessionVwap >= minBuyLevel) {
        candidates.push({ source: 'Session VWAP Support', price: sessionLevels.sessionVwap, weight: 3 });
      }
      if (volumeProfile.poc > 0 && volumeProfile.poc <= maxBuyLevel && volumeProfile.poc >= minBuyLevel) {
        candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 3 });
      }
      if (volumeProfile.val > 0 && volumeProfile.val <= maxBuyLevel && volumeProfile.val >= minBuyLevel) {
        candidates.push({ source: 'Value Area Low (VAL)', price: volumeProfile.val, weight: 2 });
      }
      if (hasValidDealingRange) {
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
        if (hasValidDealingRange) {
          const fib382Buy = parseFloat((rangeHigh - 0.382 * dealingSpan).toFixed(2));
          if (fib382Buy <= maxBuyLevel && fib382Buy >= minBuyLevel) {
            candidates.push({ source: 'Trend Continuation Fib (38.2%)', price: fib382Buy, weight: 3 });
          }
        }
        const brokenHighsBelow = swings15.filter(s => s.type === 'HIGH' && s.price <= maxBuyLevel && s.price >= minBuyLevel).slice(-2);
        brokenHighsBelow.forEach(bh => {
          candidates.push({ source: `15M Bullish Breaker / S-R Flip ($${bh.price.toFixed(2)})`, price: bh.price, weight: 4 });
        });
      }
    } else {
      const minSellLevel = closedPrice15m - 0.05 * volMetrics.atr15m;
      const maxSellLevel = closedPrice15m + maxCandidateDist;

      activeBearishObs
        .filter(ob => ob.midpoint >= minSellLevel && ob.midpoint <= maxSellLevel)
        .forEach(ob => {
          candidates.push({ source: '15M Bearish Order Block Midpoint', price: ob.midpoint, weight: 4 });
          if (ob.low >= minSellLevel) {
            candidates.push({ source: '15M Bearish Order Block Edge', price: ob.low, weight: 3 });
          }
        });
      obs1h
        .filter(ob => !ob.mitigated && ob.type === 'BEARISH' && ob.midpoint >= minSellLevel && ob.midpoint <= closedPrice15m + 3.0 * volMetrics.atr15m)
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
      activeBearishObs5m
        .filter(ob => ob.midpoint >= minSellLevel && ob.midpoint <= maxSellLevel)
        .forEach(ob => {
          candidates.push({ source: '5M Tactical Bearish OB Midpoint', price: ob.midpoint, weight: 3 });
        });
      activeBearishFvgs5m
        .filter(fvg => fvg.midpoint >= minSellLevel && fvg.midpoint <= maxSellLevel)
        .forEach(fvg => {
          candidates.push({ source: '5M Tactical Bearish FVG', price: fvg.midpoint, weight: 3 });
        });
      if (sessionLevels.sessionVwap > 0 && sessionLevels.sessionVwap >= minSellLevel && sessionLevels.sessionVwap <= maxSellLevel) {
        candidates.push({ source: 'Session VWAP Resistance', price: sessionLevels.sessionVwap, weight: 3 });
      }
      if (volumeProfile.poc > 0 && volumeProfile.poc >= minSellLevel && volumeProfile.poc <= maxSellLevel) {
        candidates.push({ source: 'Volume Profile POC', price: volumeProfile.poc, weight: 3 });
      }
      if (volumeProfile.vah > 0 && volumeProfile.vah >= minSellLevel && volumeProfile.vah <= maxSellLevel) {
        candidates.push({ source: 'Value Area High (VAH)', price: volumeProfile.vah, weight: 2 });
      }
      if (hasValidDealingRange) {
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
        if (hasValidDealingRange) {
          const fib382Sell = parseFloat((rangeLow + 0.382 * dealingSpan).toFixed(2));
          if (fib382Sell >= minSellLevel && fib382Sell <= maxSellLevel) {
            candidates.push({ source: 'Trend Continuation Fib (38.2%)', price: fib382Sell, weight: 3 });
          }
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
          ? (mid <= closedPrice15m + 0.05 * volMetrics.atr15m && mid >= closedPrice15m - maxCandidateDist)
          : (mid >= closedPrice15m - 0.05 * volMetrics.atr15m && mid <= closedPrice15m + maxCandidateDist);
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
    const icz = this.computeInstitutionalConfluenceZone(structuralDirection, closedPrice15m, candidates, volMetrics.atr15m);

    let orderType: OrderType = 'WAIT';
    let selectedModel: 'SWEEP_CHOCH_REVERSAL' | 'BOS_PULLBACK_CONTINUATION' | 'RANGE_DEVIATION_RECLAIM' | 'LTF_SNIPER_FVG' | 'NONE' = 'NONE';
    // Strictly check if currentPrice is physically inside a valid Institutional Confluence Zone [zoneLow, zoneHigh]
    const isInsideIcz = icz.zoneLow > 0 && icz.zoneHigh > 0 && currentPrice >= (icz.zoneLow - 0.12 * volMetrics.atr15m) && currentPrice <= (icz.zoneHigh + 0.12 * volMetrics.atr15m);

    // Multi-Timeframe Sniper State Machine Evaluation (M15 -> M5 -> M1)
    const ltf = this.evaluateLtfConfirmation(
      candles5m,
      candles1m,
      structuralDirection,
      icz.zoneLow,
      icz.zoneHigh,
      currentPrice,
      volMetrics.atr15m
    );

    // Identify active causal Order Block and Fair Value Gap strictly inside/adjacent to the Institutional Confluence Zone
    const dirObs = structuralDirection === 'BUY' ? activeBullishObs : activeBearishObs;
    const relevantOb = dirObs.find(ob => ob.midpoint >= icz.zoneLow - 0.50 * volMetrics.atr15m && ob.midpoint <= icz.zoneHigh + 0.50 * volMetrics.atr15m) || null;
    const dirFvgs = structuralDirection === 'BUY' ? activeBullishFvgs : activeBearishFvgs;
    const relevantFvg = dirFvgs.find(f => f.midpoint >= icz.zoneLow - 0.50 * volMetrics.atr15m && f.midpoint <= icz.zoneHigh + 0.50 * volMetrics.atr15m) || null;

    const rawFvgCe = relevantFvg
      ? parseFloat((relevantFvg.ce50 ?? relevantFvg.midpoint).toFixed(2))
      : parseFloat(icz.preferredEntry.toFixed(2));
    const fvgCeEntry = parseFloat(Math.max(icz.zoneLow, Math.min(icz.zoneHigh, rawFvgCe)).toFixed(2));

    const rawObProximal = relevantOb
      ? parseFloat((relevantOb.proximalBoundary ?? (structuralDirection === 'BUY' ? relevantOb.high : relevantOb.low)).toFixed(2))
      : parseFloat((structuralDirection === 'BUY' ? icz.zoneHigh : icz.zoneLow).toFixed(2));
    const obProximalEntry = parseFloat(Math.max(icz.zoneLow, Math.min(icz.zoneHigh, rawObProximal)).toFixed(2));

    // Dynamically select between FVG_CE_50 and OB_PROXIMAL for pending limit orders based on causal structure & risk distance
    const obRiskEst = relevantOb
      ? Math.abs(obProximalEntry - (relevantOb.distalBoundary ?? (structuralDirection === 'BUY' ? relevantOb.low : relevantOb.high)))
      : Math.abs(icz.zoneHigh - icz.zoneLow);
    const preferObProximal = Boolean(
      relevantOb &&
      (relevantOb.grade === 'GRADE_A_PLUS' || !relevantFvg || (relevantFvg.mitigationPct ?? 0) > 55) &&
      obRiskEst <= 5.50
    );

    const zoneMidpoint = parseFloat(((icz.zoneLow + icz.zoneHigh) / 2).toFixed(2));
    let entryMethod: 'LTF_SNIPER_FVG' | 'FVG_CE_50' | 'OB_PROXIMAL' = preferObProximal ? 'OB_PROXIMAL' : 'FVG_CE_50';
    let entryPrice = preferObProximal ? obProximalEntry : parseFloat(icz.preferredEntry.toFixed(2));
    // Phase 2 Rule: BUY in discount of zone (lower half), SELL in premium of zone (upper half)
    if (structuralDirection === 'BUY') {
      entryPrice = parseFloat(Math.min(entryPrice, zoneMidpoint).toFixed(2));
    } else if (structuralDirection === 'SELL') {
      entryPrice = parseFloat(Math.max(entryPrice, zoneMidpoint).toFixed(2));
    }
    let refinedBy1m = false;
    let refinementReason = 'Anchored to 15M/1H ICZ Preferred Entry';

    if (bias === 'BUY') {
      if (isInsideIcz) {
        if (ltf.isConfirmed && ltf.sniperEntryPrice && ltf.sniperStopLoss) {
          // Tier-1 Sniper Execution: M15 Zone + M5 Rejection Wick/Sweep + M1 Displacement/FVG
          entryMethod = 'LTF_SNIPER_FVG';
          entryPrice = Math.min(ltf.sniperEntryPrice, zoneMidpoint);
          refinedBy1m = true;
          refinementReason = ltf.confirmationReason;
          selectedModel = 'LTF_SNIPER_FVG';
          // Only fire MARKET_BUY if live Ask price is within $0.80 of sniperEntryPrice (prevents chasing after rapid spike)
          const liveBuyFill = microstructure.isLiquid && microstructure.ask > 0 ? microstructure.ask : currentPrice;
          orderType = (liveBuyFill <= entryPrice + 0.80 && Math.abs(currentPrice - entryPrice) <= 1.00) ? 'MARKET_BUY' : 'BUY_LIMIT';
        } else {
          // Professional Rule: Inside zone but waiting for LTF confirmation (no blind market chases)
          orderType = 'WAIT';
          selectedModel = isBullContinuation ? 'BOS_PULLBACK_CONTINUATION' : 'SWEEP_CHOCH_REVERSAL';
          refinementReason = 'Price inside M15 Institutional Zone. Awaiting M5 rejection sweep + M1 displacement/FVG before authorizing sniper execution.';
        }
      } else {
        // Outside zone: Place pending limit orders for verified structural pullbacks in lower half of zone
        if (isLongMacroContinuation || isBullContinuation || latestBullishSweep) {
          selectedModel = isLongMacroContinuation || isBullContinuation ? 'BOS_PULLBACK_CONTINUATION' : 'SWEEP_CHOCH_REVERSAL';
          entryMethod = preferObProximal ? 'OB_PROXIMAL' : 'FVG_CE_50';
          entryPrice = preferObProximal ? Math.min(obProximalEntry, zoneMidpoint) : Math.min(fvgCeEntry, zoneMidpoint);
          orderType = 'BUY_LIMIT';
          refinementReason = preferObProximal
            ? `Awaiting pullback to ${relevantOb?.grade || 'Institutional'} Bullish OB Boundary ($${entryPrice.toFixed(2)})`
            : `Awaiting pullback to M15 Institutional Zone / FVG 50% CE ($${entryPrice.toFixed(2)})`;
        } else {
          selectedModel = 'RANGE_DEVIATION_RECLAIM';
          orderType = 'WAIT';
          refinementReason = 'Awaiting structure alignment and retracement into discount';
        }
      }
    } else if (bias === 'SELL') {
      if (isInsideIcz) {
        if (ltf.isConfirmed && ltf.sniperEntryPrice && ltf.sniperStopLoss) {
          // Tier-1 Sniper Execution: M15 Zone + M5 Upper Rejection/Sweep + M1 Displacement/FVG
          entryMethod = 'LTF_SNIPER_FVG';
          entryPrice = Math.max(ltf.sniperEntryPrice, zoneMidpoint);
          refinedBy1m = true;
          refinementReason = ltf.confirmationReason;
          selectedModel = 'LTF_SNIPER_FVG';
          // Only fire MARKET_SELL if live Bid price is within $0.80 of sniperEntryPrice (prevents selling at bottom of drop)
          const liveSellFill = microstructure.isLiquid && microstructure.bid > 0 ? microstructure.bid : currentPrice;
          orderType = (liveSellFill >= entryPrice - 0.80 && Math.abs(currentPrice - entryPrice) <= 1.00) ? 'MARKET_SELL' : 'SELL_LIMIT';
        } else {
          // Professional Rule: Inside zone but waiting for LTF confirmation
          orderType = 'WAIT';
          selectedModel = isBearContinuation ? 'BOS_PULLBACK_CONTINUATION' : 'SWEEP_CHOCH_REVERSAL';
          refinementReason = 'Price inside M15 Institutional Zone. Awaiting M5 rejection sweep + M1 displacement/FVG before authorizing sniper execution.';
        }
      } else {
        // Outside zone: Place pending limit orders for verified structural pullbacks in upper half of zone
        if (isShortMacroContinuation || isBearContinuation || latestBearishSweep) {
          selectedModel = isShortMacroContinuation || isBearContinuation ? 'BOS_PULLBACK_CONTINUATION' : 'SWEEP_CHOCH_REVERSAL';
          entryMethod = preferObProximal ? 'OB_PROXIMAL' : 'FVG_CE_50';
          entryPrice = preferObProximal ? Math.max(obProximalEntry, zoneMidpoint) : Math.max(fvgCeEntry, zoneMidpoint);
          orderType = 'SELL_LIMIT';
          refinementReason = preferObProximal
            ? `Awaiting pullback to ${relevantOb?.grade || 'Institutional'} Bearish OB Boundary ($${entryPrice.toFixed(2)})`
            : `Awaiting pullback to M15 Institutional Zone / FVG 50% CE ($${entryPrice.toFixed(2)})`;
        } else {
          selectedModel = 'RANGE_DEVIATION_RECLAIM';
          orderType = 'WAIT';
          refinementReason = 'Awaiting structure alignment and retracement into premium';
        }
      }
    }

    // Precision Structural Invalidation (SL) Calculation (Small-Account Friendly & Order-Block Anchored):
    // NEVER places Stop Loss inside the Institutional Confluence Zone or inside the Order Block!
    // Incorporates spread cushion for SELL orders to prevent Ask-side stop runs.
    const spreadCushion = parseFloat(Math.max(0.25, microstructure.spread).toFixed(2));
    const baseBuffer = parseFloat(Math.min(1.10, Math.max(0.55, volMetrics.atr15m * 0.18)).toFixed(2));
    const adaptiveBuffer = structuralDirection === 'SELL'
      ? parseFloat((baseBuffer + spreadCushion).toFixed(2))
      : baseBuffer;
    const minStopDist = parseFloat(Math.min(4.20, Math.max(2.50, 0.50 * volMetrics.atr15m)).toFixed(2));
    const maxStructuralRisk = parseFloat(Math.min(6.50, Math.max(4.50, 0.95 * volMetrics.atr15m)).toFixed(2));
    let exactStopLoss = 0;
    let structuralInvalidationLevel = 0;
    let hasRealStructuralStopAnchor = false;

    if (entryPrice <= 0 || icz.zoneLow <= 0 || icz.zoneHigh <= 0) {
      hasRealStructuralStopAnchor = false;
      exactStopLoss = 0;
      structuralInvalidationLevel = 0;
    } else if (entryMethod === 'LTF_SNIPER_FVG' && ltf.sniperStopLoss) {
      hasRealStructuralStopAnchor = true;
      exactStopLoss = ltf.sniperStopLoss;
      const sniperRisk = structuralDirection === 'BUY'
        ? parseFloat((entryPrice - exactStopLoss).toFixed(2))
        : parseFloat((exactStopLoss - entryPrice).toFixed(2));
      // Enforce minimum 25-pip stop buffer; if true structural stop > 55 pips, do not clamp inside zone — let Gate 4 reject
      if (sniperRisk < 2.50) {
        exactStopLoss = structuralDirection === 'BUY'
          ? parseFloat((entryPrice - 2.50).toFixed(2))
          : parseFloat((entryPrice + 2.50).toFixed(2));
      }
      structuralInvalidationLevel = exactStopLoss;
    } else if (structuralDirection === 'BUY') {
      const nearestSwingLowBelow = swings15
        .filter(s => s.type === 'LOW' && s.price < entryPrice && s.price >= entryPrice - 0.85 * volMetrics.atr15m)
        .map(s => s.price)
        .slice(-1)[0];

      const structuralLowsBelow: number[] = [];
      if (nearestSwingLowBelow !== undefined) structuralLowsBelow.push(nearestSwingLowBelow);
      if (latestBullishSweep && latestBullishSweep.wickExtreme < entryPrice && latestBullishSweep.wickExtreme >= entryPrice - 0.85 * volMetrics.atr15m) {
        structuralLowsBelow.push(latestBullishSweep.wickExtreme);
      }
      if (relevantOb && relevantOb.low <= entryPrice) {
        structuralLowsBelow.push(relevantOb.distalBoundary ?? relevantOb.low);
      }
      if (relevantFvg && relevantFvg.bottom <= entryPrice) {
        structuralLowsBelow.push(relevantFvg.distalEdge ?? relevantFvg.bottom);
      }

      if (structuralLowsBelow.length > 0) {
        hasRealStructuralStopAnchor = true;
        structuralInvalidationLevel = Math.min(...structuralLowsBelow);
        const rawSl = parseFloat((Math.min(structuralInvalidationLevel, icz.zoneLow) - adaptiveBuffer).toFixed(2));
        const trueDist = entryPrice - rawSl;
        // If true structural stop distance exceeds maxStructuralRisk ($6.50), deepen limit entry toward distal edge (if outside zone)
        // rather than placing the stop loss inside the zone where it will get swept!
        if (trueDist > maxStructuralRisk && orderType === 'BUY_LIMIT') {
          const deepenedEntry = parseFloat(Math.max(icz.zoneLow, rawSl + maxStructuralRisk).toFixed(2));
          if (deepenedEntry < entryPrice) {
            entryPrice = deepenedEntry;
          }
        }
        const finalDist = Math.max(minStopDist, entryPrice - rawSl);
        exactStopLoss = parseFloat((entryPrice - finalDist).toFixed(2));
      }
    } else {
      const nearestSwingHighAbove = swings15
        .filter(s => s.type === 'HIGH' && s.price > entryPrice && s.price <= entryPrice + 0.85 * volMetrics.atr15m)
        .map(s => s.price)
        .slice(-1)[0];

      const structuralHighsAbove: number[] = [];
      if (nearestSwingHighAbove !== undefined) structuralHighsAbove.push(nearestSwingHighAbove);
      if (latestBearishSweep && latestBearishSweep.wickExtreme > entryPrice && latestBearishSweep.wickExtreme <= entryPrice + 0.85 * volMetrics.atr15m) {
        structuralHighsAbove.push(latestBearishSweep.wickExtreme);
      }
      if (relevantOb && relevantOb.high >= entryPrice) {
        structuralHighsAbove.push(relevantOb.distalBoundary ?? relevantOb.high);
      }
      if (relevantFvg && relevantFvg.top >= entryPrice) {
        structuralHighsAbove.push(relevantFvg.distalEdge ?? relevantFvg.top);
      }

      if (structuralHighsAbove.length > 0) {
        hasRealStructuralStopAnchor = true;
        structuralInvalidationLevel = Math.max(...structuralHighsAbove);
        const rawSl = parseFloat((Math.max(structuralInvalidationLevel, icz.zoneHigh) + adaptiveBuffer).toFixed(2));
        const trueDist = rawSl - entryPrice;
        if (trueDist > maxStructuralRisk && orderType === 'SELL_LIMIT') {
          const deepenedEntry = parseFloat(Math.min(icz.zoneHigh, rawSl - maxStructuralRisk).toFixed(2));
          if (deepenedEntry > entryPrice) {
            entryPrice = deepenedEntry;
          }
        }
        const finalDist = Math.max(minStopDist, rawSl - entryPrice);
        exactStopLoss = parseFloat((entryPrice + finalDist).toFixed(2));
      }
    }

    const directionalRisk = (hasRealStructuralStopAnchor && entryPrice > 0 && exactStopLoss > 0)
      ? (structuralDirection === 'BUY'
          ? parseFloat((entryPrice - exactStopLoss).toFixed(2))
          : parseFloat((exactStopLoss - entryPrice).toFixed(2)))
      : 0;

    const isGeometryValid = hasRealStructuralStopAnchor && entryPrice > 0 && exactStopLoss > 0 && directionalRisk >= Math.max(1.80, Math.min(3.50, 0.40 * volMetrics.atr15m));
    const risk = isGeometryValid ? directionalRisk : 0;

    // Multi-Timeframe Named Liquidity-Anchored Take Profit Targets (15M, 1H, 4H) with Front-Running Buffer
    let tp1Price = 0;
    let tp2Price = 0;
    let tp3Price = 0;
    let tp1HasRealLiquidityPool = false;
    let tp1LiquiditySource = 'NONE';
    let tp2LiquiditySource = 'NONE';
    let tp3LiquiditySource = 'NONE';
    let opposingObstacleReason: string | null = null;

    if (risk > 0 && structuralDirection === 'BUY') {
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

      // Check if an unmitigated 1H Bearish OB blocks the path before 1.40R
      const majorObstacles = obs1h
        .filter(o => !o.mitigated && o.type === 'BEARISH')
        .map(o => ({ price: o.low, name: `1H Bearish OB ($${o.low.toFixed(2)})` }))
        .filter(o => o.price > entryPrice + 0.25 * risk && o.price < entryPrice + 1.40 * risk);
      if (majorObstacles.length > 0) {
        opposingObstacleReason = `Opposing HTF resistance (${majorObstacles[0].name}) sits at +${((majorObstacles[0].price - entryPrice) / risk).toFixed(2)}R before 2.0R minimum target.`;
      }

      const isContinuation = selectedModel === 'BOS_PULLBACK_CONTINUATION';
      const minTp1R = isLongMacroContinuation ? 2.00 : isContinuation ? 1.80 : 1.50;
      const minTp2R = isLongMacroContinuation ? 3.00 : isContinuation ? 2.60 : 2.20;
      const minTp3R = isLongMacroContinuation ? 4.50 : isContinuation ? 3.80 : 3.20;

      const tp1Candidates = allHighPools
        .filter(p => p.price >= entryPrice + minTp1R * risk && p.price <= entryPrice + 3.00 * risk)
        .sort((a, b) => a.price - b.price);
      if (tp1Candidates.length > 0) {
        tp1Price = parseFloat(Math.max(entryPrice + minTp1R * risk, tp1Candidates[0].price - 0.20).toFixed(2));
        tp1LiquiditySource = tp1Candidates[0].source;
        tp1HasRealLiquidityPool = true;
      } else {
        const nearPools = allHighPools.filter(p => p.price > entryPrice + minTp1R * risk && p.price <= entryPrice + 3.50 * risk).sort((a, b) => a.price - b.price);
        if (nearPools.length > 0) {
          tp1Price = parseFloat(Math.max(entryPrice + minTp1R * risk, nearPools[0].price - 0.20).toFixed(2));
          tp1LiquiditySource = nearPools[0].source;
          tp1HasRealLiquidityPool = true;
        }
      }

      if (tp1Price > 0) {
        const bslTarget = allHighPools.find(p =>
          (p.source.includes('PDH') || p.source.includes('Asian Session High') || p.source.includes('London Session High') || p.source.includes('4H Swing High')) &&
          p.price >= Math.max(tp1Price + 0.80 * risk, entryPrice + minTp2R * risk)
        );

        const tp2Candidates = allHighPools
          .filter(p => p.price >= Math.max(tp1Price + 0.80 * risk, entryPrice + minTp2R * risk) && p.price <= entryPrice + 5.0 * risk)
          .sort((a, b) => a.price - b.price);
        if (intermarket.macroDrawOnLiquidity === 'BUY_SIDE_LIQUIDITY' && bslTarget) {
          tp2Price = parseFloat(Math.max(entryPrice + minTp2R * risk, bslTarget.price - 0.25).toFixed(2));
          tp2LiquiditySource = `Macro Draw on Liquidity (${bslTarget.source})`;
        } else if (tp2Candidates.length > 0) {
          tp2Price = parseFloat(Math.max(entryPrice + minTp2R * risk, tp2Candidates[0].price - 0.25).toFixed(2));
          tp2LiquiditySource = tp2Candidates[0].source;
        } else {
          const nextExtended = allHighPools.filter(p => p.price > Math.max(tp1Price + 0.80 * risk, entryPrice + minTp2R * risk)).sort((a, b) => a.price - b.price);
          if (nextExtended.length > 0) {
            tp2Price = parseFloat(Math.max(entryPrice + minTp2R * risk, nextExtended[0].price - 0.25).toFixed(2));
            tp2LiquiditySource = nextExtended[0].source;
          } else {
            const precedingHigh = swings15.filter(s => s.type === 'HIGH').slice(-1)[0]?.price;
            const precedingLow = precedingHigh ? swings15.filter(s => s.type === 'LOW' && s.price < precedingHigh).slice(-1)[0]?.price : undefined;
            if (precedingHigh && precedingLow && precedingHigh > precedingLow) {
              const impulseSpan = precedingHigh - precedingLow;
              const fibMultiplier = isLongMacroContinuation ? 1.618 : 1.382;
              const fib1618 = parseFloat((entryPrice + impulseSpan * fibMultiplier).toFixed(2));
              tp2Price = parseFloat(Math.max(tp1Price + 0.80 * risk, Math.max(entryPrice + minTp2R * risk, fib1618 - 0.25)).toFixed(2));
              tp2LiquiditySource = isLongMacroContinuation
                ? 'Macro Long Continuation 1.618 Fib Extension (Swing Impulse)'
                : 'Preceding Swing Impulse 1.382 Fib Extension';
            }
          }
        }

        if (tp2Price > 0) {
          const tp3Candidates = allHighPools
            .filter(p => p.price >= Math.max(tp2Price + 0.80 * risk, entryPrice + minTp3R * risk) && p.price <= entryPrice + 7.50 * risk)
            .sort((a, b) => a.price - b.price);
          if (tp3Candidates.length > 0) {
            tp3Price = parseFloat(Math.max(entryPrice + minTp3R * risk, tp3Candidates[0].price - 0.30).toFixed(2));
            tp3LiquiditySource = tp3Candidates[0].source;
          } else {
            const precedingHigh = swings15.filter(s => s.type === 'HIGH').slice(-1)[0]?.price;
            const precedingLow = precedingHigh ? swings15.filter(s => s.type === 'LOW' && s.price < precedingHigh).slice(-1)[0]?.price : undefined;
            if (precedingHigh && precedingLow && precedingHigh > precedingLow) {
              const impulseSpan = precedingHigh - precedingLow;
              const fibMultiplier = isLongMacroContinuation ? 2.0 : 1.618;
              const fib20 = parseFloat((entryPrice + impulseSpan * fibMultiplier).toFixed(2));
              tp3Price = parseFloat(Math.max(tp2Price + 0.80 * risk, Math.max(entryPrice + minTp3R * risk, fib20 - 0.30)).toFixed(2));
              tp3LiquiditySource = isLongMacroContinuation
                ? 'Macro Long Continuation 2.000 Fib Major Expansion Target'
                : 'Preceding Swing Impulse 1.618 Fib Extended Target';
            }
          }
        }
      }
    } else if (risk > 0) {
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

      // Check if an unmitigated 1H Bullish OB blocks the path before 1.40R
      const majorObstacles = obs1h
        .filter(o => !o.mitigated && o.type === 'BULLISH')
        .map(o => ({ price: o.high, name: `1H Bullish OB ($${o.high.toFixed(2)})` }))
        .filter(o => o.price < entryPrice - 0.25 * risk && o.price > entryPrice - 1.40 * risk);
      if (majorObstacles.length > 0) {
        opposingObstacleReason = `Opposing HTF demand (${majorObstacles[0].name}) sits at +${((entryPrice - majorObstacles[0].price) / risk).toFixed(2)}R before 2.0R minimum target.`;
      }

      const isContinuation = selectedModel === 'BOS_PULLBACK_CONTINUATION';
      const minTp1R = isShortMacroContinuation ? 2.00 : isContinuation ? 1.80 : 1.50;
      const minTp2R = isShortMacroContinuation ? 3.00 : isContinuation ? 2.60 : 2.20;
      const minTp3R = isShortMacroContinuation ? 4.50 : isContinuation ? 3.80 : 3.20;

      const tp1Candidates = allLowPools
        .filter(p => p.price <= entryPrice - minTp1R * risk && p.price >= entryPrice - 3.00 * risk)
        .sort((a, b) => b.price - a.price);
      if (tp1Candidates.length > 0) {
        tp1Price = parseFloat(Math.min(entryPrice - minTp1R * risk, tp1Candidates[0].price + 0.20).toFixed(2));
        tp1LiquiditySource = tp1Candidates[0].source;
        tp1HasRealLiquidityPool = true;
      } else {
        const nearPools = allLowPools.filter(p => p.price < entryPrice - minTp1R * risk && p.price >= entryPrice - 3.50 * risk).sort((a, b) => b.price - a.price);
        if (nearPools.length > 0) {
          tp1Price = parseFloat(Math.min(entryPrice - minTp1R * risk, nearPools[0].price + 0.20).toFixed(2));
          tp1LiquiditySource = nearPools[0].source;
          tp1HasRealLiquidityPool = true;
        }
      }

      if (tp1Price > 0) {
        const sslTarget = allLowPools.find(p =>
          (p.source.includes('PDL') || p.source.includes('Asian Session Low') || p.source.includes('London Session Low') || p.source.includes('4H Swing Low')) &&
          p.price <= Math.min(tp1Price - 0.80 * risk, entryPrice - minTp2R * risk)
        );

        const tp2Candidates = allLowPools
          .filter(p => p.price <= Math.min(tp1Price - 0.80 * risk, entryPrice - minTp2R * risk) && p.price >= entryPrice - 5.0 * risk)
          .sort((a, b) => b.price - a.price);
        if (intermarket.macroDrawOnLiquidity === 'SELL_SIDE_LIQUIDITY' && sslTarget) {
          tp2Price = parseFloat(Math.min(entryPrice - minTp2R * risk, sslTarget.price + 0.25).toFixed(2));
          tp2LiquiditySource = `Macro Draw on Liquidity (${sslTarget.source})`;
        } else if (tp2Candidates.length > 0) {
          tp2Price = parseFloat(Math.min(entryPrice - minTp2R * risk, tp2Candidates[0].price + 0.25).toFixed(2));
          tp2LiquiditySource = tp2Candidates[0].source;
        } else {
          const nextExtended = allLowPools.filter(p => p.price < Math.min(tp1Price - 0.80 * risk, entryPrice - minTp2R * risk)).sort((a, b) => b.price - a.price);
          if (nextExtended.length > 0) {
            tp2Price = parseFloat(Math.min(entryPrice - minTp2R * risk, nextExtended[0].price + 0.25).toFixed(2));
            tp2LiquiditySource = nextExtended[0].source;
          } else {
            const precedingLow = swings15.filter(s => s.type === 'LOW').slice(-1)[0]?.price;
            const precedingHigh = precedingLow ? swings15.filter(s => s.type === 'HIGH' && s.price > precedingLow).slice(-1)[0]?.price : undefined;
            if (precedingLow && precedingHigh && precedingHigh > precedingLow) {
              const impulseSpan = precedingHigh - precedingLow;
              const fibMultiplier = isShortMacroContinuation ? 1.618 : 1.382;
              const fib1618 = parseFloat((entryPrice - impulseSpan * fibMultiplier).toFixed(2));
              tp2Price = parseFloat(Math.min(tp1Price - 0.80 * risk, Math.min(entryPrice - minTp2R * risk, fib1618 + 0.25)).toFixed(2));
              tp2LiquiditySource = isShortMacroContinuation
                ? 'Macro Short Continuation 1.618 Fib Extension (Swing Impulse)'
                : 'Preceding Swing Impulse 1.382 Fib Extension';
            }
          }
        }

        if (tp2Price > 0) {
          const tp3Candidates = allLowPools
            .filter(p => p.price <= Math.min(tp2Price - 0.80 * risk, entryPrice - minTp3R * risk) && p.price >= entryPrice - 7.50 * risk)
            .sort((a, b) => b.price - a.price);
          if (tp3Candidates.length > 0) {
            tp3Price = parseFloat(Math.min(entryPrice - minTp3R * risk, tp3Candidates[0].price + 0.30).toFixed(2));
            tp3LiquiditySource = tp3Candidates[0].source;
          } else {
            const precedingLow = swings15.filter(s => s.type === 'LOW').slice(-1)[0]?.price;
            const precedingHigh = precedingLow ? swings15.filter(s => s.type === 'HIGH' && s.price > precedingLow).slice(-1)[0]?.price : undefined;
            if (precedingLow && precedingHigh && precedingHigh > precedingLow) {
              const impulseSpan = precedingHigh - precedingLow;
              const fibMultiplier = isShortMacroContinuation ? 2.0 : 1.618;
              const fib20 = parseFloat((entryPrice - impulseSpan * fibMultiplier).toFixed(2));
              tp3Price = parseFloat(Math.min(tp2Price - 0.80 * risk, Math.min(entryPrice - minTp3R * risk, fib20 + 0.30)).toFixed(2));
              tp3LiquiditySource = isShortMacroContinuation
                ? 'Macro Short Continuation 2.000 Fib Major Expansion Target'
                : 'Preceding Swing Impulse 1.618 Fib Extended Target';
            }
          }
        }
      }
    }

    const r1 = (risk > 0 && tp1Price > 0) ? parseFloat((Math.abs(tp1Price - entryPrice) / risk).toFixed(2)) : 0;
    const r2 = (risk > 0 && tp2Price > 0) ? parseFloat((Math.abs(tp2Price - entryPrice) / risk).toFixed(2)) : 0;
    const r3 = (risk > 0 && tp3Price > 0) ? parseFloat((Math.abs(tp3Price - entryPrice) / risk).toFixed(2)) : 0;

    // Phase 3 Honest Confidence Calibration: Decoupled from arbitrary score multipliers
    // Calibrated directly by specific setup architecture, execution method, and structural R:R distance
    let modelBaseWinRate = 0.58;
    if (selectedModel === 'LTF_SNIPER_FVG') {
      modelBaseWinRate = ltf.isConfirmed ? 0.68 : 0.62;
    } else if (selectedModel === 'SWEEP_CHOCH_REVERSAL') {
      modelBaseWinRate = 0.63;
    } else if (selectedModel === 'BOS_PULLBACK_CONTINUATION') {
      modelBaseWinRate = 0.58;
    } else {
      modelBaseWinRate = 0.54;
    }
    const dirTrend = structuralDirection === 'BUY' ? 'BULLISH' : 'BEARISH';
    const htfBonus = (trend4h === dirTrend && htfTrend === dirTrend) ? 0.03 : 0.0;
    const tierBonus = icz.zoneRank === 'TIER_1_PRIME' ? 0.02 : icz.zoneRank === 'TIER_2_STRONG' ? 0.01 : 0.0;
    const rrPenalty = Math.max(0, r1 - 1.50) * 0.04;
    const pTp1 = (risk > 0 && tp1Price > 0) ? parseFloat(Math.min(0.72, Math.max(0.50, modelBaseWinRate + htfBonus + tierBonus - rrPenalty)).toFixed(2)) : 0;
    const pTp2 = (risk > 0 && tp2Price > 0 && pTp1 > 0) ? parseFloat(Math.max(0.25, Math.min(0.55, pTp1 * 0.75 - Math.max(0, r2 - 2.2) * 0.03)).toFixed(2)) : 0;
    const pTp3 = (risk > 0 && tp3Price > 0 && pTp2 > 0) ? parseFloat(Math.max(0.12, Math.min(0.35, pTp2 * 0.60 - Math.max(0, r3 - 3.2) * 0.02)).toFixed(2)) : 0;
    const pSl = parseFloat((1.0 - pTp1).toFixed(2));
    const spreadCostR = (risk > 0 && microstructure.spread > 0) ? (microstructure.spread / risk) : 0;
    const rawEv = (risk > 0 && tp1Price > 0) ? (((pTp1 * 0.5 * r1) + (pTp2 * 0.3 * r2) + (pTp3 * 0.2 * r3)) - (pSl * 1.0)) - spreadCostR : 0;
    const ev = parseFloat(Math.max(0.0, rawEv).toFixed(2));

    // =========================================================
    // MULTI-METHOD SMC CANDIDATE EVALUATION (CONFIRMED STRUCTURES ONLY)
    // =========================================================
    const computeClampedLimitSl = (optEntry: number, distalEdge: number) => {
      if (structuralDirection === 'BUY') {
        const rawDist = optEntry - (Math.min(distalEdge, icz.zoneLow) - adaptiveBuffer);
        const clamped = Math.min(maxStructuralRisk, Math.max(minStopDist, rawDist));
        return parseFloat((optEntry - clamped).toFixed(2));
      } else {
        const rawDist = (Math.max(distalEdge, icz.zoneHigh) + adaptiveBuffer) - optEntry;
        const clamped = Math.min(maxStructuralRisk, Math.max(minStopDist, rawDist));
        return parseFloat((optEntry + clamped).toFixed(2));
      }
    };

    const candidateConfigs: Array<{ method: 'LTF_SNIPER_FVG' | 'FVG_CE_50' | 'OB_PROXIMAL'; entry: number; sl: number }> = [];
    if (ltf.isConfirmed && ltf.sniperEntryPrice && ltf.sniperStopLoss) {
      const sniperDistClamped = Math.min(5.00, Math.max(2.50, Math.abs(ltf.sniperEntryPrice - ltf.sniperStopLoss)));
      const sniperCandSl = structuralDirection === 'BUY'
        ? parseFloat((ltf.sniperEntryPrice - sniperDistClamped).toFixed(2))
        : parseFloat((ltf.sniperEntryPrice + sniperDistClamped).toFixed(2));
      candidateConfigs.push({
        method: 'LTF_SNIPER_FVG',
        entry: ltf.sniperEntryPrice,
        sl: sniperCandSl
      });
    }
    if (relevantFvg !== null && risk > 0) {
      const fvgDistal = relevantFvg.distalEdge ?? (structuralDirection === 'BUY' ? relevantFvg.bottom : relevantFvg.top);
      candidateConfigs.push({
        method: 'FVG_CE_50',
        entry: entryMethod === 'FVG_CE_50' ? entryPrice : fvgCeEntry,
        sl: entryMethod === 'FVG_CE_50' ? exactStopLoss : computeClampedLimitSl(fvgCeEntry, fvgDistal)
      });
    }
    if (relevantOb !== null && risk > 0) {
      const obDistal = relevantOb.distalBoundary ?? (structuralDirection === 'BUY' ? relevantOb.low : relevantOb.high);
      candidateConfigs.push({
        method: 'OB_PROXIMAL',
        entry: entryMethod === 'OB_PROXIMAL' ? entryPrice : obProximalEntry,
        sl: entryMethod === 'OB_PROXIMAL' ? exactStopLoss : computeClampedLimitSl(obProximalEntry, obDistal)
      });
    }

    const obGradeBoost = relevantOb?.grade === 'GRADE_A_PLUS' ? 0.06 : relevantOb?.grade === 'GRADE_A' ? 0.03 : 0;
    const pZoneBase = (relevantOb || relevantFvg)
      ? parseFloat(Math.max(0.48, Math.min(0.72, 0.54 + (icz.zoneRank === 'TIER_1_PRIME' ? 0.10 : icz.zoneRank === 'TIER_2_STRONG' ? 0.06 : 0.02) + obGradeBoost + (latestBullishSweep || latestBearishSweep ? 0.03 : 0))).toFixed(2))
      : 0;
    const evaluatedSmcOptions = candidateConfigs.map(c => {
      const optRisk = Math.max(1.50, Math.abs(c.entry - c.sl));
      const slPips = Math.round(optRisk * 10 * 10) / 10;
      const optReward = tp1Price > 0 ? Math.abs(tp1Price - c.entry) : 0;
      const optRr = (optRisk > 0 && optReward > 0) ? parseFloat((optReward / optRisk).toFixed(2)) : 0;
      const optRrPenalty = Math.max(0, optRr - 1.50) * 0.04;
      const optBaseRate = c.method === 'LTF_SNIPER_FVG' ? 0.68 : c.method === 'FVG_CE_50' ? 0.62 : 0.58;
      const optPwin = optRr > 0
        ? parseFloat(Math.min(0.72, Math.max(0.50, optBaseRate + htfBonus + tierBonus - optRrPenalty)).toFixed(2))
        : 0;

      let netEv = optRr > 0 ? parseFloat(((optPwin * optRr) - ((1.0 - optPwin) * 1.0)).toFixed(2)) : 0;
      if (optRr > 0) {
        if (slPips <= 45.0) netEv = parseFloat((netEv + 0.15).toFixed(2));
        else if (slPips > 65.0) netEv = parseFloat((netEv - 0.35).toFixed(2));
      }

      const recommendationScore = optRr > 0 ? Math.min(100, Math.max(0, Math.round((netEv + 1.2) * 35))) : 0;
      return {
        method: c.method,
        entryPrice: c.entry,
        stopLoss: c.sl,
        takeProfit1: tp1Price,
        takeProfit2: tp2Price,
        slPips,
        rrRatio: optRr,
        pZoneHolds: pZoneBase,
        pTp1BeforeSl: optPwin,
        expectedMfeR: optRr > 0 ? optRr : undefined,
        expectedMaeR: undefined,
        expectedHoldingMinutes: undefined,
        netEvR: netEv,
        recommendationScore
      };
    });

    const activeSmcOpt = evaluatedSmcOptions.find(o => o.method === entryMethod) || evaluatedSmcOptions[0] || null;
    const expectedMfeR = activeSmcOpt?.expectedMfeR;
    const expectedMaeR = undefined;
    const expectedHoldingMinutes = undefined;

    // Stage 3 Check: Entry Missed & Runaway Protection
    let entryMissed = false;
    let entryMissedReason: string | null = null;

    if ((orderType === 'MARKET_BUY' || orderType === 'MARKET_SELL') && entryPrice > 0 && risk > 0) {
      // If price moved > 0.50R past market zone, do not chase at market: gracefully degrade to a pending limit order!
      if (bias === 'BUY' && currentPrice >= entryPrice + 0.50 * risk) {
        orderType = 'BUY_LIMIT';
      } else if (bias === 'SELL' && currentPrice <= entryPrice - 0.50 * risk) {
        orderType = 'SELL_LIMIT';
      }
    }

    if ((orderType === 'BUY_LIMIT' || orderType === 'SELL_LIMIT') && entryPrice > 0 && risk > 0 && tp1Price > 0) {
      // A limit order is only missed if price already reached TP1 without filling, or expanded runaway > 1.8R
      const tp1AlreadyReached = bias === 'BUY' ? (currentPrice >= tp1Price) : (currentPrice <= tp1Price && tp1Price > 0);
      const runawayExpansion = bias === 'BUY'
        ? (currentPrice >= entryPrice + 1.80 * risk)
        : (currentPrice <= entryPrice - 1.80 * risk);

      if (tp1AlreadyReached || runawayExpansion) {
        entryMissed = true;
        entryMissedReason = `Entry missed: Spot price ($${currentPrice.toFixed(2)}) has completed +${((Math.abs(currentPrice - entryPrice)) / risk).toFixed(2)}R move to TP1 ($${tp1Price.toFixed(2)}) without filling limit order ($${entryPrice.toFixed(2)}). Waiting for fresh structure.`;
      }
    }

    let gate4Passed = true;
    let gate4Score = 80;
    let gate4Code = 'TRADE_LOCATION_OK';
    let gate4Reason = `Institutional Confluence Zone verified with positive spread-adjusted EV (+${ev}R).`;

    if (icz.zoneRank === 'WEAK') {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'WEAK_CONFLUENCE_ZONE';
      gate4Reason = 'No verified Order Block / Fair Value Gap institutional confluence zone in range.';
      orderType = 'WAIT';
    } else if (!hasRealStructuralStopAnchor) {
      gate4Passed = false;
      gate4Score = 25;
      gate4Code = 'NO_STRUCTURAL_STOP_ANCHOR';
      gate4Reason = 'No real swing pivot, liquidity sweep wick, or OB/FVG distal boundary available to anchor Stop Loss.';
      orderType = 'WAIT';
    } else if (!isGeometryValid || (structuralDirection === 'BUY' && exactStopLoss >= entryPrice) || (structuralDirection === 'SELL' && exactStopLoss <= entryPrice)) {
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
    } else if (directionalRisk > maxStructuralRisk) {
      gate4Passed = false;
      gate4Score = 25;
      gate4Code = 'EXCESSIVE_STRUCTURAL_RISK';
      gate4Reason = `Required structural invalidation distance ($${directionalRisk.toFixed(2)}) exceeds allowable cap ($${maxStructuralRisk.toFixed(2)}). Setup rejected rather than artificially clamping stop loss.`;
    } else if (!tp1HasRealLiquidityPool || tp1Price <= 0) {
      gate4Passed = false;
      gate4Score = 30;
      gate4Code = 'NO_LIQUIDITY_TARGET_TP1';
      gate4Reason = 'No verified liquidity pool (Swing High/Low, Session High/Low, PDH/PDL, or 1H OB) within 1.50R–3.50R to anchor TP1.';
      orderType = 'WAIT';
    } else if (opposingObstacleReason) {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'OPPOSING_HTF_OBSTACLE';
      gate4Reason = opposingObstacleReason;
    } else if (orderType === 'WAIT') {
      gate4Passed = false;
      gate4Score = isInsideIcz ? 55 : 40;
      gate4Code = isInsideIcz ? 'AWAITING_LTF_CONFIRMATION' : 'AWAITING_PULLBACK';
      gate4Reason = isInsideIcz
        ? refinementReason
        : `Price ($${currentPrice.toFixed(2)}) is outside the executable zone for preferred entry ($${entryPrice.toFixed(2)}).`;
    } else if (r1 < 1.50) {
      gate4Passed = false;
      gate4Score = 30;
      gate4Code = 'INSUFFICIENT_RR';
      gate4Reason = `R:R1 is 1:${r1} (< 1:1.50 flexible institutional minimum target). Setup rejected to ensure high-yield execution.`;
    } else if (ev < 0.20) {
      gate4Passed = false;
      gate4Score = 35;
      gate4Code = 'NEGATIVE_EXPECTANCY';
      gate4Reason = `Spread-adjusted Expected Value is ${ev}R (< +0.20R required statistical edge).`;
    } else {
      // Dynamic Gate 4 Trade Location & Expectancy Score: scales smoothly with overlap count, R:R1, and net EV
      const zoneScore = Math.min(96, 52 + icz.overlapCount * 9);
      const rrScore = Math.min(96, 50 + Math.round((r1 - 1.5) * 20));
      const evScore = Math.min(96, 48 + Math.round(ev * 40));
      gate4Score = Math.round(zoneScore * 0.45 + rrScore * 0.30 + evScore * 0.25);
    }

    const gate4: GateCheck = {
      gateId: 'GATE_4_TRADE',
      passed: gate4Passed,
      score: gate4Score,
      code: gate4Code,
      reason: gate4Reason,
      telemetry: {
        orderType,
        entryMethod,
        iczZone: [icz.zoneLow, icz.zoneHigh],
        preferredEntry: entryPrice,
        exactStopLoss,
        r1,
        ev,
        evaluatedSmcOptions,
        expectedMfeR,
        expectedMaeR,
        expectedHoldingMinutes
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

    const stopIsStructural = hasRealStructuralStopAnchor && isGeometryValid && directionalRisk <= maxStructuralRisk &&
      ((structuralDirection === 'BUY' && exactStopLoss < entryPrice) || (structuralDirection === 'SELL' && exactStopLoss > entryPrice));
    if (!stopIsStructural) checklistReasons.push('Stop loss is not structural or violates invalidation geometry.');

    const targetsRealistic = !opposingObstacleReason && tp1HasRealLiquidityPool && tp1Price > 0;
    if (!targetsRealistic) checklistReasons.push(opposingObstacleReason || 'No verified liquidity pool available to anchor TP1.');

    const rrAcceptable = r1 >= 1.50 && r2 >= 2.20 && ev >= 0.20;
    if (!rrAcceptable) {
      if (r1 < 1.50 || r2 < 2.20) {
        checklistReasons.push(`R:R (TP1: 1:${r1}, TP2: 1:${r2}) below institutional flexible minimums (1:1.50 / 1:2.20).`);
      } else {
        checklistReasons.push(`Expected Value (+${ev}R) below institutional edge threshold (+0.20R).`);
      }
    }

    const newsRiskAcceptable = !newsGate.isBlackout && marketRegime !== 'NEWS_SHOCK';
    if (!newsRiskAcceptable) checklistReasons.push('Active economic news blackout or post-news shock.');

    const spreadAcceptable = microstructure.isLiquid && microstructure.spread <= 0.60;
    if (!spreadAcceptable) checklistReasons.push(`Institutional spread threshold exceeded (${microstructure.spread.toFixed(2)} > $0.60).`);

    const notDuplicate = !isDuplicate;
    if (!notDuplicate && duplicateReason) checklistReasons.push(duplicateReason);

    const orderTypeSupported = ['BUY_LIMIT', 'SELL_LIMIT', 'MARKET_BUY', 'MARKET_SELL'].includes(orderType);
    if (!orderTypeSupported) checklistReasons.push('Order type is WAIT: Engine is actively monitoring for institutional confirmation.');

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
    // 1. Confluence Score (0-100): Measures how many independent structural, MTF, and macro factors align at the zone.
    //    Driven primarily by Gate 3 (directional evidence), Gate 4 (zone overlap & R:R), and Gate 2 (market environment).
    // 2. Confidence Score (0-100%): Statistical probability of reaching TP1 before SL (probTp1BeforeSl * 100), calibrated by EV & LTF confirmation.
    let finalDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    let grade: 'A+' | 'A' | 'B+' | 'WAIT' = 'WAIT';
    let compositeScore = Math.round(
      (gate3.score * 0.40) +
      (gate4.score * 0.35) +
      (gate2.score * 0.15) +
      (gate5.score * 0.10)
    );

    const now = new Date();
    const sessionOpeningPlay = this.classifySessionOpeningPlay(
      now,
      bias === 'NO_TRADE' ? 'WAIT' : bias,
      selectedModel,
      sessionLevels,
      sweeps,
      fvgs15,
      volMetrics,
      newsGate
    );

    if (allPassed && orderType !== 'WAIT' && bias !== 'NO_TRADE') {
      finalDirection = bias;
      if (sessionOpeningPlay.confidenceBoost > 0) {
        compositeScore = Math.min(96, compositeScore + sessionOpeningPlay.confidenceBoost);
      }
      if (compositeScore >= 84 && ev >= 0.65) grade = 'A+';
      else if (compositeScore >= 75 && ev >= 0.40) grade = 'A';
      else grade = 'B+';

      // Phase 3 Hard Floor: Composite score below 75 never publishes (reject weak B+ / B setups)
      if (compositeScore < 75 || grade === 'B+') {
        orderType = 'WAIT';
        finalDirection = 'WAIT';
      }
    } else {
      orderType = 'WAIT';
    }

    // Position Sizing (Small-Account Friendly Default: $10 base risk budget / 0.01 - 0.03 lots)
    const baseRiskUsd = 10;
    const confidenceMultiplier = grade === 'A+' ? 1.0 : grade === 'A' ? 0.85 : 0.65;
    const finalRiskUsd = Math.max(3.5, baseRiskUsd * volMetrics.riskMultiplier * confidenceMultiplier);
    const recommendedUnitsOz = risk > 0 ? parseFloat(Math.max(1.0, finalRiskUsd / risk).toFixed(1)) : 0;
    const recommendedLots = risk > 0 ? parseFloat(Math.max(0.01, recommendedUnitsOz / 100).toFixed(2)) : 0;

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
      expectedValueR: ev,
      evaluatedSmcOptions,
      selectedEntryMethod: entryMethod,
      expectedMfeR,
      expectedMaeR,
      expectedHoldingMinutes
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
      : `${sessionOpeningPlay.badgeLabel !== '[Institutional SMC]' ? `${sessionOpeningPlay.badgeLabel} ` : ''}High-conviction ${grade} ${orderType} setup at Institutional Confluence Zone ($${icz.zoneLow}–$${icz.zoneHigh}). ${sessionOpeningPlay.catalyst} Preferred Entry: $${entryPrice.toFixed(2)}, SL: $${exactStopLoss.toFixed(2)}, TP1: $${tp1Price.toFixed(2)} (R:R ${r1}, EV +${ev}R).`;

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
      sessionOpeningPlay,
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
      sessionOpeningPlay,
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
    if (this.inflightGoldSetupPromise) {
      return this.inflightGoldSetupPromise;
    }

    this.inflightGoldSetupPromise = (async () => {
      try {
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

        try {
          newsGate.newsPersistence = await this.evaluateAndSyncNewsPersistence(latestPrice, intermarket);
        } catch (npErr: any) {
          this.logger.warn(`[getOrComputeGoldSetup] NewsPersistence sync notice: ${npErr.message}`);
        }

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

        this.cachedGoldSetup = { timestamp: Date.now(), setup };
        return setup;
      } finally {
        this.inflightGoldSetupPromise = null;
      }
    })();

    return this.inflightGoldSetupPromise;
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

  // Deterministic in-process Senior Risk Desk Audit (enforces 5-Gate + 11-Point Checklist + Directional Geometry)
  private performInternalSeniorRiskDeskAudit(setup: XauusdInstitutionalSetup): {
    approved: boolean;
    verdict: 'APPROVED' | 'VETOED' | 'HOLD';
    explanation: string;
  } {
    if (!setup.fiveGates.allPassed || !setup.finalValidationChecklist?.allPassed) {
      return {
        approved: false,
        verdict: 'HOLD',
        explanation: setup.fiveGates.failingReason || 'Setup did not clear all 5 gates and 11-point validation checklist.'
      };
    }

    if (setup.direction !== 'BUY' && setup.direction !== 'SELL') {
      return { approved: false, verdict: 'HOLD', explanation: 'Direction is WAIT.' };
    }

    if ((setup.microstructure && !setup.microstructure.isLiquid) || setup.newsGate?.isBlackout) {
      return {
        approved: false,
        verdict: 'VETOED',
        explanation: 'Vetoed by Risk Desk: Microstructure illiquid or economic news blackout active.'
      };
    }

    const geometryValid = setup.direction === 'BUY'
      ? (setup.stopLoss > 0 && setup.stopLoss < setup.entryPrice && setup.takeProfit1 > setup.entryPrice && setup.takeProfit2 >= setup.takeProfit1)
      : (setup.stopLoss > setup.entryPrice && setup.takeProfit1 > 0 && setup.takeProfit1 < setup.entryPrice && setup.takeProfit2 <= setup.takeProfit1);

    if (!geometryValid) {
      return {
        approved: false,
        verdict: 'VETOED',
        explanation: `Vetoed by Risk Desk: Invalid ${setup.direction} directional geometry (Entry: $${setup.entryPrice}, SL: $${setup.stopLoss}, TP1: $${setup.takeProfit1}).`
      };
    }

    if (setup.opportunityScore < 75 || setup.riskReward1 < 1.50 || setup.riskReward2 < 2.20 || setup.tradePath.expectedValueR < 0.20) {
      return {
        approved: false,
        verdict: 'HOLD',
        explanation: `Held by Risk Desk: Opportunity score (${setup.opportunityScore} < 75 minimum), R:R1 (1:${setup.riskReward1} < 1:1.50), R:R2 (1:${setup.riskReward2} < 1:2.20), or EV (+${setup.tradePath.expectedValueR}R) below institutional threshold.`
      };
    }

    return {
      approved: true,
      verdict: 'APPROVED',
      explanation: setup.summary
    };
  }

  // -------------------------------------------------------------
  // DIRECT NATIVE GOOGLE GEMINI SENIOR DESK VERIFICATION
  // -------------------------------------------------------------
  // Triggered STRICTLY as the final gate when all 5 Gates, 11-point Checklist,
  // R:R, EV, and Opportunity Score >= 70 pass on a non-duplicate BUY/SELL trade.
  // Acts as the Chief Risk Officer verifying truthfulness, sanity, and macro alignment.
  public async verifySetupWithGeminiDirect(
    setup: XauusdInstitutionalSetup
  ): Promise<{ verdict: 'APPROVED' | 'VETOED'; explanation: string; riskFactor?: string } | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }

    const intermarket = setup.intermarket || ({} as any);
    const microstructure = setup.microstructure || ({} as any);
    const newsGate = setup.newsGate || ({} as any);
    const exp = setup.tradePath || ({} as any);

    const dxyDisplay = intermarket.dxy > 0
      ? `${intermarket.dxy.toFixed(2)} (${intermarket.dxyChange1h >= 0 ? '+' : ''}${intermarket.dxyChange1h?.toFixed(2)}% 1h)`
      : 'Syncing';
    const us10yDisplay = intermarket.us10y > 0
      ? `${intermarket.us10y.toFixed(2)}% (${intermarket.us10yChange1h >= 0 ? '+' : ''}${intermarket.us10yChange1h?.toFixed(2)}% 1h)`
      : 'Syncing';
    const realYieldDisplay = intermarket.realYieldProxy !== 0
      ? `${intermarket.realYieldProxy?.toFixed(2)}%`
      : 'Syncing';

    const prompt = `You are the Chief Risk Officer and Senior Desk Trader at an institutional macro prop firm.
Review this final Gold (XAUUSD) trade setup generated by our quantitative SMC engine:

Setup:
- Direction: ${setup.direction}
- Entry Price: $${setup.entryPrice.toFixed(2)}
- Stop Loss: $${setup.stopLoss.toFixed(2)} (Distance: $${Math.abs(setup.entryPrice - setup.stopLoss).toFixed(2)})
- TP1: $${setup.takeProfit1.toFixed(2)} (R:R: ${setup.riskReward1.toFixed(1)})
- TP2: $${setup.takeProfit2.toFixed(2)} (R:R: ${setup.riskReward2.toFixed(1)})
- Model: ${setup.model}
- Grade: ${setup.grade} (Composite Score: ${setup.opportunityScore.toFixed(0)}/100)
- Expectancy: EV = +${(exp.expectedValueR ?? 0).toFixed(2)}R, Prob(TP1) = ${Math.round((exp.probTp1BeforeSl ?? 0) * 100)}%
- Confluences: ${setup.confluenceReasons.join(', ')}

Macro & Microstructure:
- Market Regime: ${setup.marketRegime}
- 15M ATR: $${setup.volatilityMetrics.atr15m.toFixed(2)}
- Spot Spread: $${(microstructure.spread ?? 0).toFixed(2)}
- DXY: ${dxyDisplay}
- US 10Y Yield: ${us10yDisplay}
- Real 10Y Yield Proxy: ${realYieldDisplay}
- Macro Alignment: ${intermarket.macroAlignment || 'NEUTRAL'} (${intermarket.rationale || 'Baseline'})
- Economic News Blackout: ${newsGate.isBlackout ? 'YES' : 'NO'} (Next: ${newsGate.eventTitle || 'None'}, Tier: ${newsGate.impactTier || 'None'})

Risk Desk Rules:
1. Directional Geometry: If BUY, SL must be strictly below Entry. If SELL, SL must be strictly above Entry. If violated, you MUST output "verdict": "VETOED".
2. Macro Consistency: If technicals directly oppose surging yields/USD or impending tier-1 news shock, output "verdict": "VETOED".
3. Flexible Structural Targets: Institutional setups must target logical liquidity pools (TP1 >= 1:1.50R, TP2 >= 1:2.20R). Low-yield trades (< 1.50R) are not permitted.
4. If the trade location is sound, risk is protected behind structure, and macro flow does not directly contradict, output "verdict": "APPROVED".

Respond strictly with valid JSON:
{
  "verdict": "APPROVED" | "VETOED",
  "institutional_thesis": "2-3 concise sentences detailing why this setup has real market edge.",
  "primary_risk_factor": "Key risk factor to watch."
}`;

    const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const modelsToTry = [
      preferredModel,
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-3.5-lite'
    ];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await this.fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 350,
                responseMimeType: 'application/json'
              }
            })
          },
          6000
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            let cleaned = rawText.trim();
            if (cleaned.startsWith('```json')) {
              cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
            }
            const parsed = JSON.parse(cleaned);
            const verdict: 'APPROVED' | 'VETOED' = String(parsed.verdict || 'APPROVED').toUpperCase() === 'VETOED' ? 'VETOED' : 'APPROVED';
            const explanation: string = parsed.institutional_thesis || setup.summary;
            const riskFactor: string | undefined = parsed.primary_risk_factor;
            this.logger.log(`[GeminiDeskReviewer] Direct Gemini verification via ${model} completed: ${verdict}`);
            return { verdict, explanation, riskFactor };
          }
        } else {
          this.logger.warn(`[GeminiDeskReviewer] Model ${model} returned HTTP ${res.status}`);
        }
      } catch (err: any) {
        this.logger.warn(`[GeminiDeskReviewer] ${model} attempt notice: ${err.message}`);
      }
    }

    return null;
  }

  // Part F & G: Unified Institutional Signal Publisher (Single Source of Truth)
  // Guarantees atomic insertion, exposure capping, 3-rule duplicate suppression, 15-minute DB safety barrier, and canonical audit trails.
  private async publishGoldSetup(
    setup: XauusdInstitutionalSetup,
    aiExplanation: string,
    aiVerdict: string,
    aiReviewStatus: 'AI_REVIEWED' | 'DETERMINISTIC_AUDIT' | 'AI_SERVICE_OFFLINE' = 'AI_REVIEWED',
    now = new Date()
  ): Promise<any> {
    // 0. In-Memory Atomic Publication Mutex (Phase 1: Zero Duplicate Twin Signals)
    const timeBucket = Math.floor(now.getTime() / (5 * 60 * 1000));
    const priceBucket = Math.round(setup.entryPrice * 2) / 2;
    const pubMutexKey = `GOLD_${setup.direction}_${timeBucket}_${priceBucket}`;

    if (SignalsController.goldPublishMutex.has(pubMutexKey)) {
      this.logger.warn(`[PUBLISHER] In-memory publication mutex locked for ${pubMutexKey}. Discarding duplicate publication.`);
      const existing = await this.prisma.signal.findFirst({
        where: { symbol: 'GOLD', direction: setup.direction },
        orderBy: { createdAt: 'desc' }
      });
      return existing;
    }
    SignalsController.goldPublishMutex.set(pubMutexKey, Date.now());

    // Prune entries older than 30 minutes
    const pruneBefore = Date.now() - 30 * 60 * 1000;
    for (const [key, ts] of SignalsController.goldPublishMutex.entries()) {
      if (ts < pruneBefore) SignalsController.goldPublishMutex.delete(key);
    }

    // 1. Cap at configured max concurrent active signals (default 3)
    const maxSignals = XAUUSD_ENGINE_CONFIG.signalManagement.maxActiveSignalsPerAsset || 3;
    const activeSignals = await this.getActiveGoldSignals(maxSignals);
    if (activeSignals.length >= maxSignals) {
      this.logger.log(`[PUBLISHER] Scan complete: Active signal ceiling reached (${activeSignals.length}/${maxSignals}).`);
      return activeSignals[0];
    }

    // 2. Portfolio Exposure Cap (Part F Rule 4 & Part B)
    const maxCombinedRiskR = XAUUSD_ENGINE_CONFIG.signalManagement.maxCombinedRiskR || 2.0;
    const currentCombinedRiskR = activeSignals.reduce((acc, s) => {
      const posRisk = (s.aiReasoning as any)?.positionSizing?.riskPercent || 1.0;
      return acc + posRisk;
    }, 0);
    const candidateRiskR = setup.positionSizing?.riskPercent || 1.0;
    if (currentCombinedRiskR + candidateRiskR > maxCombinedRiskR) {
      this.logger.log(`[PUBLISHER] Exposure cap reached (${currentCombinedRiskR.toFixed(1)}R + ${candidateRiskR.toFixed(1)}R > ${maxCombinedRiskR}R max).`);
      return activeSignals[0] || null;
    }

    // 3. Part F Rule 2: 3-rule duplicate setup suppression
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
      return updated;
    }

    // 4. Database Safety Barrier: 30-minute idempotency check for twin signals
    const recentSignals = await this.prisma.signal.findMany({
      where: {
        symbol: 'GOLD',
        direction: setup.direction,
        createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    const atr15m = Math.max(1, setup.volatilityMetrics?.atr15m || 5);
    for (const recent of recentSignals) {
      const entryDiff = Math.abs(Number(recent.entryPrice) - setup.entryPrice);
      const slDiff = Math.abs(Number(recent.stopLoss) - setup.stopLoss);
      if (entryDiff <= 0.85 * atr15m || slDiff <= 0.85 * atr15m) {
        this.logger.log(`[PUBLISHER] Suppression: Twin record already created within 30m (${recent.id}, diff: $${entryDiff.toFixed(2)}). Skipping duplicate insert.`);
        return recent;
      }
    }

    // 4b. Phase 2 Failed-Zone Invalidation Rule: Session cooldown after stop-out
    // Prevents entering the exact same failing zone within 4 hours of a stop-out (like 23/11 17:15 following 16:39)
    const recentStopped = await this.prisma.signal.findMany({
      where: {
        symbol: 'GOLD',
        direction: setup.direction,
        createdAt: { gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 8
    });
    for (const stopped of recentStopped) {
      const reasoning = (stopped.aiReasoning as any) || {};
      const isStoppedOut = reasoning.status === 'SL_HIT' || reasoning.lifecycleState === 'STOPPED_OUT' || (stopped as any).outcome === 'SL_HIT';
      if (isStoppedOut) {
        const diff = Math.abs(Number(stopped.entryPrice) - setup.entryPrice);
        if (diff <= 1.0 * atr15m) {
          this.logger.warn(`[PUBLISHER] Failed-Zone Rule Veto: A prior ${setup.direction} signal (${stopped.id}) stopped out at $${Number(stopped.entryPrice).toFixed(2)} within the last 4 hours (zone diff: $${diff.toFixed(2)} <= $${atr15m.toFixed(2)} ATR). Skipping repeat entry into invalidated zone.`);
          return null;
        }
      }
    }

    // 5. Independent Directional Policy (User Directive: BUY and SELL execute independently without blocking one another)
    // Only erase an opposing UNFILLED pending limit order if its structural invalidation level has already been breached.
    const opposingPending = activeSignals.filter(s => s.direction !== setup.direction);
    for (const opposing of opposingPending) {
      const opReasoning = (opposing.aiReasoning as any) || {};
      const opStatus = opReasoning.status || 'ACTIVE';
      const isOpFilled = Boolean(opReasoning.isOrderFilled || opStatus === 'POSITION_OPEN' || opStatus === 'PARTIALLY_FILLED');
      if (isOpFilled) {
        continue; // Filled positions run their lifecycle independently without blocking opposite setups
      }

      const opSl = Number(opposing.stopLoss);
      const opInvalidated = (opposing.direction === 'BUY' && setup.levels.currentPrice <= opSl) ||
                            (opposing.direction === 'SELL' && setup.levels.currentPrice >= opSl);
      if (opInvalidated) {
        try {
          await this.prisma.signal.delete({ where: { id: opposing.id } });
          this.notificationsGateway.server.emit('signal:deleted', { id: opposing.id });
          this.logger.log(`[LIFECYCLE] Erased invalidated opposing unfilled signal ${opposing.id} from database.`);
        } catch (delErr: any) {
          this.logger.warn(`[LIFECYCLE] Note erasing opposing signal ${opposing.id}: ${delErr.message}`);
        }
      }
    }

    // 6. Canonical Signal Creation & Phase 1 Execution Integrity Anti-Slippage Guard
    const requestedMarketOrder = setup.orderType.includes('MARKET');
    let effectiveOrderType = setup.orderType;
    let isImmediateMarket = requestedMarketOrder;
    let initialLifecycleState: string = isImmediateMarket ? 'POSITION_OPEN' : 'WAITING_FOR_ENTRY';
    let realMarketFill: number | null = null;
    let slippageGuardTriggered = false;
    let slippageReason = '';

    const ms = setup.microstructure;
    const currentSpot = ms?.spot && ms.spot > 0 ? ms.spot : setup.levels.currentPrice;
    const currentAsk = ms?.isLiquid && ms.ask > 0 ? ms.ask : currentSpot;
    const currentBid = ms?.isLiquid && ms.bid > 0 ? ms.bid : currentSpot;
    const plannedEntry = setup.entryPrice;

    if (requestedMarketOrder) {
      // 1. Quote Sanity Check
      const hasValidQuoteSpread = Boolean(ms?.isLiquid && typeof ms.spread === 'number' && ms.spread > 0);
      const quoteSpread = hasValidQuoteSpread ? ms!.spread : 0;
      const spotDivergence = Math.abs(currentSpot - setup.levels.currentPrice);
      if (!hasValidQuoteSpread) {
        slippageGuardTriggered = true;
        slippageReason = `Live Bid/Ask spread unavailable. Degraded to LIMIT order at planned entry ($${plannedEntry.toFixed(2)}).`;
      } else if (quoteSpread > 0.60) {
        slippageGuardTriggered = true;
        slippageReason = `Elevated spread ($${quoteSpread.toFixed(2)} > $0.60 max). Degraded to LIMIT order at planned entry ($${plannedEntry.toFixed(2)}).`;
      } else if (spotDivergence > 1.00) {
        slippageGuardTriggered = true;
        slippageReason = `Tick quote diverges from candle spot ($${spotDivergence.toFixed(2)} > $1.00 max). Degraded to LIMIT order at planned entry ($${plannedEntry.toFixed(2)}).`;
      } else {
        // 2. Slippage vs Planned Entry Check (Max allowed adverse slippage: $0.80 / 8 pips on XAUUSD)
        const candidateFill = setup.direction === 'BUY' ? currentAsk : currentBid;
        const adverseSlippage = setup.direction === 'BUY'
          ? (candidateFill - plannedEntry)
          : (plannedEntry - candidateFill);

        if (adverseSlippage > 0.80) {
          slippageGuardTriggered = true;
          slippageReason = `Adverse market fill divergence ($${adverseSlippage.toFixed(2)} > $0.80 max). Degraded to LIMIT order at planned entry ($${plannedEntry.toFixed(2)}) to prevent chasing.`;
        } else {
          realMarketFill = parseFloat(candidateFill.toFixed(2));
        }
      }

      if (slippageGuardTriggered) {
        this.logger.warn(`[PUBLISHER_SLIPPAGE_GUARD] ${slippageReason}`);
        effectiveOrderType = setup.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT';
        isImmediateMarket = false;
        initialLifecycleState = 'WAITING_FOR_ENTRY';
        realMarketFill = null;
      }
    }

    // 6a. Forward-looking news window: never leave a pending order (or open a market position)
    // that would be live right into an imminent HIGH/EXTREME USD release blackout.
    let orderValidityMs = now.getTime() + setup.invalidationAndExpiry.orderExpiryHours * 60 * 60 * 1000;
    const nextEvent = this.getNextHighImpactUsdEvent(now.getTime(), 3 * 60);
    if (nextEvent) {
      const blackoutStartMs = nextEvent.timeMs - nextEvent.preBlackoutMin * 60_000;
      const minutesUntilBlackout = (blackoutStartMs - now.getTime()) / 60_000;
      const minMarketLeadMin = nextEvent.impactTier === 'EXTREME' ? 30 : 15;
      if (isImmediateMarket && minutesUntilBlackout < minMarketLeadMin) {
        this.logger.log(`[PUBLISHER] Market ${setup.direction} withheld: ${nextEvent.title} (${nextEvent.impactTier}) in ${Math.round(minutesUntilBlackout + nextEvent.preBlackoutMin)}m would hit the open position.`);
        return activeSignals[0] || null;
      }
      if (!isImmediateMarket) {
        if (minutesUntilBlackout < 15) {
          this.logger.log(`[PUBLISHER] Limit ${setup.direction} withheld: only ${Math.round(minutesUntilBlackout)}m until ${nextEvent.title} blackout.`);
          return activeSignals[0] || null;
        }
        orderValidityMs = Math.min(orderValidityMs, blackoutStartMs);
      }
    }
    const orderValidityExpiresAt = new Date(orderValidityMs).toISOString();

    const publicId = await this.generateInstitutionalSignalId(now);
    const initialEvent: SignalLifecycleEvent = {
      timestamp: now.toISOString(),
      state: initialLifecycleState,
      price: isImmediateMarket && realMarketFill !== null ? realMarketFill : setup.entryPrice,
      reason: 'SIGNAL_PUBLISHED',
      details: `Published ${setup.grade} ${effectiveOrderType} (Score: ${setup.opportunityScore}, EV: +${setup.tradePath.expectedValueR}R)${slippageGuardTriggered ? ' [Slippage Guard: Degraded to Limit]' : ''}`
    };

    const matchingObs = (setup.unmitigatedOrderBlocks || []).filter(
      o => !o.mitigated && ((setup.direction === 'BUY' && o.type === 'BULLISH') || (setup.direction === 'SELL' && o.type === 'BEARISH'))
    );
    const bestOb = matchingObs[matchingObs.length - 1] || null;

    const createdSignal = await this.prisma.signal.create({
      data: {
        symbol: 'GOLD',
        direction: setup.direction,
        strategyKey: setup.sessionOpeningPlay?.tag || setup.model,
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
          filledAt: isImmediateMarket ? now.toISOString() : null,
          filledPrice: realMarketFill !== null ? parseFloat(Number(realMarketFill).toFixed(2)) : null,
          initialStopLoss: setup.stopLoss,
          takeProfit3: setup.takeProfit3,
          pnlModel: 'v2',
          lifecycleProcessedUntil: now.toISOString(),
          nextNewsEvent: nextEvent ? { title: nextEvent.title, impactTier: nextEvent.impactTier, timeUtc: new Date(nextEvent.timeMs).toISOString() } : null,
          orderValidityExpiresAt,
          orderType: effectiveOrderType,
          entryMethod: setup.tradePath.selectedEntryMethod || setup.model,
          expectedMfeR: setup.tradePath.expectedMfeR,
          expectedMaeR: setup.tradePath.expectedMaeR,
          expectedHoldingMinutes: setup.tradePath.expectedHoldingMinutes,
          evaluatedSmcOptions: setup.tradePath.evaluatedSmcOptions,
          engineCommit: 'bf0b943',
          enginePhase: 'PHASE_4_DEFENSIVE_MANAGEMENT',
          modelStats: {
            strategyModel: setup.model,
            calibratedProbability: Math.round(setup.tradePath.probTp1BeforeSl * 100),
            confluenceFactorScore: setup.opportunityScore,
            hardFloorThreshold: 75,
            deduplicationApplied: true
          },
          slippageGuard: {
            maxAllowedSlippage: 0.80,
            triggered: slippageGuardTriggered,
            reason: slippageReason || 'CLEAR_FILL_WITHIN_TOLERANCE',
            fillSlippage: realMarketFill !== null ? parseFloat((setup.direction === 'BUY' ? realMarketFill - plannedEntry : plannedEntry - realMarketFill).toFixed(2)) : 0
          },
          obGrade: bestOb?.grade || (setup.grade === 'A+' ? 'GRADE_A_PLUS' : setup.grade === 'A' ? 'GRADE_A' : 'GRADE_B'),
          causedBos: Boolean(bestOb?.causedBos ?? false),
          createdFvg: Boolean(bestOb?.createdFvg ?? false),
          priorSweepConfirmed: Boolean(bestOb?.priorSweepConfirmed || setup.sessionOpeningPlay?.tag?.includes('SWEEP') || setup.model === 'SWEEP_CHOCH_REVERSAL' || setup.model === 'LTF_SNIPER_FVG'),
          entryZone: setup.entryZone,
          strategy: setup.model,
          sessionTag: setup.sessionOpeningPlay?.tag || null,
          sessionBadge: setup.sessionOpeningPlay?.badgeLabel || null,
          sessionOpeningPlay: setup.sessionOpeningPlay || null,
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

    this.notificationsGateway.server.emit('signal:created', createdSignal);
    const sessionPrefix = setup.sessionOpeningPlay?.badgeLabel && setup.sessionOpeningPlay.badgeLabel !== '[Institutional SMC]'
      ? `${setup.sessionOpeningPlay.badgeLabel} `
      : '';
    await this.notificationsGateway.broadcastTradeSignalNotification(
      `⚡ ${sessionPrefix}Live Gold Signal (${setup.grade}) [${publicId}]`,
      `${setup.direction} XAU/USD ${effectiveOrderType.replace(/_/g, ' ')} @ $${setup.entryPrice.toFixed(2)} | TP1: $${setup.takeProfit1.toFixed(2)} | SL: $${setup.stopLoss.toFixed(2)}`,
      '/dashboard/engines/gold'
    );

    // Autonomous Broker Execution Dispatch (MT5 & connected broker accounts)
    try {
      await this.automationService.processSignalAutoTrade({
        id: createdSignal.id,
        symbol: 'GOLD',
        direction: setup.direction,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        takeProfit1: setup.takeProfit1,
        takeProfit2: setup.takeProfit2,
        riskRewardRatio: setup.riskReward1,
        winProbability: Math.round(setup.tradePath.probTp1BeforeSl * 100),
        aiReasoning: {
          ...(createdSignal.aiReasoning as any),
          signal_grade: setup.grade,
          signalGrade: setup.grade,
          orderType: effectiveOrderType
        }
      });
    } catch (autoErr: any) {
      this.logger.warn(`[AutoTrade Engine] Broker dispatch notice: ${autoErr.message}`);
    }

    this.logger.log(`[PUBLISHER] Published canonical signal ${createdSignal.id} (${publicId}) ${setup.direction} ${effectiveOrderType} @ $${setup.entryPrice.toFixed(2)}`);
    return createdSignal;
  }

  // Atomic Single-Flight Execution Mutex for Gold Scanning & Publishing
  async runAtomicGoldScan(options?: { forceFresh?: boolean }): Promise<any> {
    if (SignalsController.scanLockPromise) {
      if (options?.forceFresh) {
        this.logger.log('[runAtomicGoldScan] forceFresh requested while scan in-flight. Waiting for current scan to complete before fresh execution.');
        try {
          await SignalsController.scanLockPromise;
        } catch (_) {}
      } else {
        this.logger.log('[runAtomicGoldScan] Concurrent scan coalesced into in-flight execution.');
        return SignalsController.scanLockPromise;
      }
    }

    SignalsController.scanLockPromise = (async () => {
      try {
        return await this.executeGoldScan(options);
      } finally {
        SignalsController.scanLockPromise = null;
      }
    })();

    return SignalsController.scanLockPromise;
  }

  // Internal execution of gold scan & evaluation
  private async executeGoldScan(options?: { forceFresh?: boolean }): Promise<any> {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (!options?.forceFresh && (day === 6 || (day === 0 && hour < 22) || (day === 5 && hour >= 22))) {
      return null;
    }

    if (options?.forceFresh) {
      // Force fresh requested: erase pending unfilled limit orders from database (User Option 2 directive)
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
          try {
            await this.prisma.signal.delete({ where: { id: sig.id } });
            this.notificationsGateway.server.emit('signal:deleted', { id: sig.id });
            this.logger.log(`[SignalsController] Erased unfilled pending signal ${sig.id} via forceFresh.`);
          } catch (delErr: any) {
            this.logger.warn(`[SignalsController] Failed to delete unfilled signal ${sig.id}: ${delErr.message}`);
          }
        }
      }
    }

    const setup = await this.getOrComputeGoldSetup();

    const gatesPassed = setup.fiveGates.allPassed && setup.finalValidationChecklist?.allPassed;
    const hasDirection = setup.direction === 'BUY' || setup.direction === 'SELL';
    const hasScore = setup.opportunityScore >= 75;

    let aiVerdict = gatesPassed ? 'APPROVED' : 'HOLD';
    let aiExplanation = setup.summary;
    let aiReviewStatus: 'AI_REVIEWED' | 'DETERMINISTIC_AUDIT' | 'AI_SERVICE_OFFLINE' = 'AI_SERVICE_OFFLINE';

    if (gatesPassed && hasDirection && hasScore) {
      // 1. Direct native Google Gemini Senior Risk Desk Audit (zero middleman dependency)
      let geminiResult = await this.verifySetupWithGeminiDirect(setup);

      // 2. Fallback to local AI microservice if configured and Gemini direct was skipped
      if (!geminiResult && process.env.AI_SERVICE_URL) {
        try {
          const rawUrl = process.env.AI_SERVICE_URL;
          const aiServiceUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : `http://${rawUrl}`;
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
          }, 4000);

          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            if (aiJson && aiJson.ai_review_verdict) {
              const rawV = String(aiJson.ai_review_verdict).toUpperCase();
              geminiResult = {
                verdict: rawV === 'VETOED' ? 'VETOED' : 'APPROVED',
                explanation: aiJson.ai_explanation || setup.summary
              };
            }
          }
        } catch (e: any) {
          this.logger.warn(`[runAtomicGoldScan] AI service desk review check notice: ${e.message}`);
        }
      }

      // 3. Fallback to programmatic senior risk desk audit if both AI calls were offline
      if (geminiResult) {
        aiVerdict = geminiResult.verdict;
        aiExplanation = geminiResult.explanation;
        aiReviewStatus = 'AI_REVIEWED';
      } else {
        const internalAudit = this.performInternalSeniorRiskDeskAudit(setup);
        aiVerdict = internalAudit.verdict;
        aiExplanation = internalAudit.explanation || aiExplanation;
        if (internalAudit.approved) {
          aiReviewStatus = 'DETERMINISTIC_AUDIT';
        }
      }

      if (aiVerdict === 'APPROVED' && (aiReviewStatus === 'AI_REVIEWED' || aiReviewStatus === 'DETERMINISTIC_AUDIT')) {
        const published = await this.publishGoldSetup(setup, aiExplanation, aiVerdict, aiReviewStatus, now);
        return published;
      }
    }

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
        finalValidationChecklist: setup.finalValidationChecklist,
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
        aiVerdict: aiVerdict === 'VETOED' ? 'VETOED' : 'HOLD',
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

  @Get('gold/overview')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Comprehensive Cockpit Snapshot' })
  async getGoldOverview() {
    try {
      const setup = await this.getOrComputeGoldSetup();

      // If all 5 gates and the 11-point final checklist pass on the closed candle, immediately promote/sync via the scanner
      // so the upper chart bar and lower Active Executable Signals deck are 100% unified without waiting for the 5M cron tick.
      if (
        setup.fiveGates.allPassed &&
        setup.finalValidationChecklist?.allPassed &&
        (setup.direction === 'BUY' || setup.direction === 'SELL') &&
        setup.opportunityScore >= 75
      ) {
        await this.runAtomicGoldScan();
      }

      const activeSignals = await this.getActiveGoldSignals(3);
      const activeSignal = activeSignals[0] || null;
      const gate3Tel = setup.fiveGates.gate3_setup.telemetry || {};

      // Strictly unify top-level execution direction/orderType/grade with the locked active database signal!
      // Never show an unpersisted candidate as an active MARKET BUY/SELL when activeSignals is 0/3.
      const effectiveDirection: 'BUY' | 'SELL' | 'WAIT' =
        (activeSignal?.direction === 'BUY' || activeSignal?.direction === 'SELL')
          ? activeSignal.direction
          : 'WAIT';

      const effectiveOrderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET_BUY' | 'MARKET_SELL' | 'WAIT' = activeSignal
        ? ((activeSignal.aiReasoning as any)?.orderType || (activeSignal.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT'))
        : 'WAIT';

      const effectiveGrade: string = activeSignal
        ? ((activeSignal.aiReasoning as any)?.signalGrade || (setup.grade !== 'WAIT' ? setup.grade : 'A INSTITUTIONAL'))
        : 'WAIT';

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

      // Calculate real 24h price change from completed 1H candles AND real 4H ATR from completed 4H candles (hits warm candle cache)
      const lastCandle = setup.levels.currentPrice;
      const [candlesFor24h, candlesFor4hAtr] = await Promise.all([
        this.fetchXauusdCandles('1h', 120),
        this.fetchXauusdCandles('4h', 100)
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
        const timeUtc = setup.newsGate.eventTimeUtc || (
          setup.newsGate.minutesToEvent !== null
            ? new Date(Date.now() + setup.newsGate.minutesToEvent * 60000).toISOString()
            : new Date().toISOString()
        );
        nextHighImpactEvent = {
          title: setup.newsGate.eventTitle,
          currency: 'USD',
          timeUtc,
          minutesRemaining: setup.newsGate.minutesToEvent !== null ? setup.newsGate.minutesToEvent : 0
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

      // Top-level entry & risk telemetry: reflects active signal when open, live candidate when qualified, or zero when WAIT
      const hasLiveCandidate = setup.direction === 'BUY' || setup.direction === 'SELL';
      const effectiveEntry = activeSignal ? Number(activeSignal.entryPrice) : (hasLiveCandidate ? setup.entryPrice : 0);
      const effectiveSl = activeSignal ? Number(activeSignal.stopLoss) : (hasLiveCandidate ? setup.stopLoss : 0);
      const effectiveTp1 = activeSignal ? Number(activeSignal.takeProfit1) : (hasLiveCandidate ? setup.takeProfit1 : 0);
      const effectiveTp2 = activeSignal
        ? Number(activeSignal.takeProfit2 || (activeSignal.aiReasoning as any)?.takeProfit2 || 0)
        : (hasLiveCandidate ? setup.takeProfit2 : 0);
      const effectiveTp3 = activeSignal
        ? Number((activeSignal.aiReasoning as any)?.takeProfit3 || (activeSignal.aiReasoning as any)?.tradePath?.tp3Price || 0)
        : (hasLiveCandidate ? setup.takeProfit3 : 0);
      const effectiveZone: [number, number] = activeSignal && Array.isArray((activeSignal.aiReasoning as any)?.entryZone)
        ? (activeSignal.aiReasoning as any).entryZone
        : (hasLiveCandidate ? setup.entryZone : [0, 0]);
      const effectiveR1 = activeSignal ? Number(activeSignal.riskRewardRatio || 0) : (hasLiveCandidate ? setup.riskReward1 : 0);
      const liveWinProbPct = hasLiveCandidate && setup.tradePath?.probTp1BeforeSl ? Math.round(setup.tradePath.probTp1BeforeSl * 100) : 0;
      const effectiveConfidence = activeSignal
        ? (activeSignal.winProbability ?? Math.round(((activeSignal.aiReasoning as any)?.tradePath?.probTp1BeforeSl || 0) * 100))
        : liveWinProbPct;
      const effectiveConfluence = activeSignal
        ? (activeSignal.confluenceScore ?? (activeSignal.aiReasoning as any)?.opportunityScore ?? setup.opportunityScore)
        : setup.opportunityScore;
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
        isMitigated: ob.mitigated,
        grade: ob.grade || 'GRADE_A',
        causedBos: Boolean(ob.causedBos ?? false),
        createdFvg: Boolean(ob.createdFvg ?? false),
        priorSweepConfirmed: Boolean(ob.priorSweepConfirmed ?? false),
        proximalBoundary: ob.proximalBoundary ?? (ob.type === 'BULLISH' ? ob.high : ob.low),
        distalBoundary: ob.distalBoundary ?? (ob.type === 'BULLISH' ? ob.low : ob.high),
        mitigationPct: ob.mitigationPct ?? 0
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
        isFilled: fvg.mitigated,
        ce50: fvg.ce50 ?? parseFloat(fvg.midpoint.toFixed(2)),
        proximalEdge: fvg.proximalEdge ?? (fvg.type === 'BULLISH' ? fvg.top : fvg.bottom),
        distalEdge: fvg.distalEdge ?? (fvg.type === 'BULLISH' ? fvg.bottom : fvg.top),
        mitigationPct: fvg.mitigationPct ?? 0
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
        confluenceScore: effectiveConfluence,
        direction: effectiveDirection,
        signalGrade: effectiveGrade,
        activeSignal: activeSignal || null,
        activeSignals,
        candidateSetup: {
          direction: setup.direction,
          orderType: setup.orderType,
          entryPrice: setup.entryPrice,
          entryZone: setup.entryZone,
          stopLoss: setup.stopLoss,
          takeProfit1: setup.takeProfit1,
          takeProfit2: setup.takeProfit2,
          riskRewardRatio: setup.riskReward1,
          expectedValueR: setup.tradePath.expectedValueR,
          grade: setup.grade,
          opportunityScore: setup.opportunityScore,
          model: setup.model
        },
        fiveGatesAudit: auditGates,
        macro: {
          dxyPrice: setup.intermarket.dxy,
          dxyChange1h: setup.intermarket.dxyChange1h,
          dxyChange24h: setup.intermarket.dxyChange24h ?? 0,
          dxyTrend: setup.intermarket.dxyChange1h > 0.05 ? 'STRENGTHENING' : setup.intermarket.dxyChange1h < -0.05 ? 'WEAKENING' : 'NEUTRAL',
          us10yYield: setup.intermarket.us10y,
          us10yChange1h: setup.intermarket.us10yChange1h,
          realYieldProxy: setup.intermarket.realYieldProxy,
          breakevenInflationBenchmark: setup.intermarket.breakevenInflation ?? 0,
          isRealYieldLive: setup.intermarket.isRealYieldLive ?? false,
          safeHavenDemandScore: setup.intermarket.safeHavenDemandScore,
          macroAlignment: setup.intermarket.macroAlignment,
          macroBias: setup.intermarket.macroBias ?? 'NEUTRAL',
          macroDrawOnLiquidity: setup.intermarket.macroDrawOnLiquidity ?? 'RANGE_EQUILIBRIUM',
          fundamentalNews: setup.newsGate.fundamentalBias ? {
            title: setup.newsGate.eventTitle,
            bias: setup.newsGate.fundamentalBias,
            actual: setup.newsGate.actual,
            forecast: setup.newsGate.forecast,
            summary: setup.newsGate.fundamentalSummary
          } : null,
          forexFactoryGate: setup.newsGate.feedOffline
            ? 'FEED_OFFLINE'
            : setup.newsGate.isBlackout
              ? 'BLACKOUT_ACTIVE'
              : setup.newsGate.eventStage === 'PRICE_DISCOVERY'
                ? 'POST_NEWS_STABILIZATION'
                : 'CLEAR',
          lastNewsSyncTime: this.lastCalendarFetchTime ? new Date(this.lastCalendarFetchTime).toISOString() : undefined,
          calendarEventsLoaded: this.cachedCalendarEvents.length,
          nextHighImpactEvent,
          newsPersistence: setup.newsGate.newsPersistence
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
          selectedEntryMethod: setup.tradePath.selectedEntryMethod || effectiveStrategy,
          evaluatedSmcOptions: setup.tradePath.evaluatedSmcOptions || [],
          orderType: effectiveOrderType,
          preferredEntry: effectiveEntry,
          entryZone: effectiveZone,
          currentDistancePips: effectiveEntry > 0 && setup.levels.currentPrice > 0 ? Math.round(Math.abs(setup.levels.currentPrice - effectiveEntry) * 10) : 0,
          entryConditions: setup.confluenceReasons.map((reason, idx) => ({
            name: `Confluence Factor #${idx + 1}`,
            status: 'PASSED',
            detail: reason
          }))
        },
        riskPlan: {
          exactStopLoss: effectiveSl,
          stopDistancePips: effectiveEntry > 0 && effectiveSl > 0 ? Math.round(Math.abs(effectiveEntry - effectiveSl) * 10) : 0,
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
          maxSpreadAllowed: 0.60,
          executionEligibility: !setup.microstructure.isLiquid
            ? 'SPREAD_HALTED'
            : setup.newsGate.isBlackout
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
      evaluatedSmcOptions: (overview.entryPlan as any)?.evaluatedSmcOptions || [],
      selectedEntryMethod: (overview.entryPlan as any)?.selectedEntryMethod || overview.entryPlan.selectedStrategy,
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

  @Get('gold/news-memory')
  @ApiOperation({ summary: 'Institutional Gold Engine V2 - Active News Event Memory & Momentum Persistence' })
  async getGoldNewsMemory() {
    const memory = this.newsMomentumService.getActiveMemory();
    const overview = await this.getGoldOverview();
    const persistence = (overview?.macro as any)?.newsPersistence;
    return {
      activeNewsMemory: memory,
      count: memory.length,
      lastIngestTime: this.newsMomentumService.getLastIngestTime() ? new Date(this.newsMomentumService.getLastIngestTime()).toISOString() : null,
      topTheme: persistence?.topTheme || null,
      overallNewsScore: persistence?.overallNewsScore || 50,
      macroDriver: persistence?.macroDriver || 'Macro Equilibrium',
      recommendedAction: persistence?.recommendedAction || 'NEUTRAL',
      windowStage: persistence?.windowStage || 'MULTI_DAY_REPRICING',
      isReactionPersisting: persistence?.isReactionPersisting || false,
      isReactionWeakening: persistence?.isReactionWeakening || false,
      isMarketReversed: persistence?.isMarketReversed || false,
      isPricedIn: persistence?.isPricedIn || false
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

    const nowMs = Date.now();
    // User directive: "when the signal is unfilled it should be deleted and erased in db"
    const staleToDelete = rawSignals.filter(s => {
      const reasoning = (s.aiReasoning as any) || {};
      const status = reasoning.status || 'ACTIVE';
      const lifecycle = reasoning.lifecycleState || status;
      const outcome = reasoning.outcome;
      const hasRealFill = Boolean(
        reasoning.isOrderFilled === true ||
        (reasoning.filledPrice && Number(reasoning.filledPrice) > 0) ||
        reasoning.lifecycleEvents?.some((e: any) => e.type === 'FILLED' || e.state === 'POSITION_OPEN')
      );
      const isExpired = s.expiresAt && new Date(s.expiresAt).getTime() < nowMs;
      const isOrderExpired = reasoning.orderValidityExpiresAt && new Date(reasoning.orderValidityExpiresAt).getTime() < nowMs;
      const isStagnantWaiting = (status === 'WAITING_FOR_ENTRY' || lifecycle === 'WAITING_FOR_ENTRY') &&
                                (nowMs - new Date(s.createdAt).getTime() > 4 * 3600_000);

      return !hasRealFill && (
        ['EXPIRED', 'CANCELLED', 'INVALIDATED', 'UNFILLED'].includes(lifecycle || outcome || status) ||
        isExpired ||
        isOrderExpired ||
        isStagnantWaiting ||
        status === 'CLOSED' ||
        lifecycle === 'CLOSED'
      );
    });

    if (staleToDelete.length > 0) {
      for (const sig of staleToDelete) {
        await this.prisma.signal.delete({ where: { id: sig.id } }).catch(() => {});
      }
    }

    const activeOrFilledSignals = rawSignals.filter(s => !staleToDelete.some(d => d.id === s.id));

    const mappedSignals = activeOrFilledSignals.map(s => {
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

      // Real fill validation: only marked filled if actually traded on a completed bar
      const hasRealFill = Boolean(
        reasoning.isOrderFilled === true ||
        (reasoning.filledPrice && Number(reasoning.filledPrice) > 0) ||
        reasoning.lifecycleEvents?.some((e: any) => e.type === 'FILLED' || e.state === 'POSITION_OPEN')
      );
      const isFilled = hasRealFill;

      const fillPrice = reasoning.filledPrice ? Number(reasoning.filledPrice) : (isFilled ? Number(s.entryPrice) : null);
      const exitPrice = reasoning.exitPrice || reasoning.lastCheckedPrice || null;

      let realizedR = typeof reasoning.pnlR === 'number' ? reasoning.pnlR : null;
      if (realizedR === null && outcome) {
        realizedR = computeLegacyRealizedR({
          direction: s.direction,
          orderType: reasoning.orderType,
          entryPrice: Number(s.entryPrice),
          stopLoss: Number(s.stopLoss),
          initialStopLoss: reasoning.initialStopLoss ? Number(reasoning.initialStopLoss) : null,
          takeProfit1: Number(s.takeProfit1),
          takeProfit2: s.takeProfit2 ? Number(s.takeProfit2) : Number(reasoning.takeProfit2 || 0),
          riskRewardRatio: s.riskRewardRatio ? Number(s.riskRewardRatio) : null,
          filledPrice: reasoning.filledPrice ? Number(reasoning.filledPrice) : null,
          exitPrice: reasoning.exitPrice ? Number(reasoning.exitPrice) : null,
          outcome
        });
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
        strategy: reasoning.strategy || s.strategyKey || 'SMC_INSTITUTIONAL',
        mfeR: typeof reasoning.mfeR === 'number' ? reasoning.mfeR : null,
        maeR: typeof reasoning.maeR === 'number' ? reasoning.maeR : null,
        holdingDurationMinutes: typeof reasoning.holdingDurationMinutes === 'number' ? reasoning.holdingDurationMinutes : null,
        zoneHeld: typeof reasoning.zoneHeld === 'boolean' ? reasoning.zoneHeld : null
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

  @Get('gold/ml-dataset')
  @ApiOperation({ summary: 'Institutional SMC Walk-Forward Machine Learning Telemetry Dataset' })
  async getGoldMlDataset(@Query('limit') limitQuery?: string) {
    const take = Math.min(Math.max(parseInt(limitQuery || '100', 10) || 100, 1), 500);
    const signals = await this.prisma.signal.findMany({
      where: { symbol: 'GOLD' },
      orderBy: { createdAt: 'desc' },
      take
    });

    const dataset = signals
      .map(s => {
        const reasoning = (s.aiReasoning as any) || {};
        const isFilled = Boolean(
          reasoning.isOrderFilled === true ||
          (reasoning.filledPrice && Number(reasoning.filledPrice) > 0) ||
          reasoning.lifecycleEvents?.some((e: any) => e.type === 'FILLED' || e.state === 'POSITION_OPEN')
        );
        const outcome = reasoning.outcome || null;
        const initialSl = reasoning.initialStopLoss ? Number(reasoning.initialStopLoss) : Number(s.stopLoss);
        const slPips = Math.round(Math.abs(Number(s.entryPrice) - initialSl) * 10 * 10) / 10;

        return {
          id: s.id,
          createdAt: s.createdAt,
          direction: s.direction,
          entryPrice: Number(s.entryPrice),
          initialStopLoss: initialSl,
          slPips,
          tp1: Number(s.takeProfit1),
          tp2: Number(s.takeProfit2 || s.takeProfit1),
          plannedRiskReward: Number(s.riskRewardRatio || 0),
          isFilled,
          outcome,
          entryMethod: reasoning.entryMethod || reasoning.model || 'SMC_INSTITUTIONAL',
          obGrade: reasoning.obGrade || reasoning.signalGrade || 'GRADE_A',
          causedBos: Boolean(reasoning.causedBos ?? false),
          createdFvg: Boolean(reasoning.createdFvg ?? false),
          priorSweepConfirmed: Boolean(reasoning.priorSweepConfirmed ?? false),
          mfeR: typeof reasoning.mfeR === 'number' ? reasoning.mfeR : null,
          maeR: typeof reasoning.maeR === 'number' ? reasoning.maeR : null,
          holdingDurationMinutes: typeof reasoning.holdingDurationMinutes === 'number' ? reasoning.holdingDurationMinutes : null,
          zoneHeld: typeof reasoning.zoneHeld === 'boolean' ? reasoning.zoneHeld : (outcome === 'TP2_HIT' || outcome === 'BREAKEVEN'),
          realizedR: typeof reasoning.pnlR === 'number' ? reasoning.pnlR : null,
          marketRegime: reasoning.marketRegime || 'NORMAL'
        };
      })
      .filter(item => item.isFilled && item.outcome !== null);

    return {
      totalSamples: dataset.length,
      features: [
        'direction', 'entryMethod', 'obGrade', 'causedBos', 'createdFvg',
        'priorSweepConfirmed', 'slPips', 'marketRegime'
      ],
      targets: [
        'mfeR', 'maeR', 'holdingDurationMinutes', 'zoneHeld', 'realizedR', 'outcome'
      ],
      samples: dataset
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
    if (setup.levels.pdh > 0) {
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
    }

    if (setup.levels.pdl > 0) {
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
    }

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

    // 6. Active Trade Levels: Strictly display locked active database signal levels (never show phantom unpersisted setups)
    const hasExecutableTrade = !!activeSignal;
    const direction: 'BUY' | 'SELL' | 'WAIT' = (activeSignal?.direction === 'BUY' || activeSignal?.direction === 'SELL')
      ? activeSignal.direction
      : 'WAIT';
    const activeOrderType = activeSignal
      ? ((activeSignal.aiReasoning as any)?.orderType || (activeSignal.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT'))
      : 'WAIT';

    const activeEntry = activeSignal ? Number(activeSignal.entryPrice) : 0;
    const activeSl = activeSignal ? Number(activeSignal.stopLoss) : 0;
    const activeTp1 = activeSignal ? Number(activeSignal.takeProfit1) : 0;
    const activeTp2 = activeSignal ? Number(activeSignal.takeProfit2 || (activeSignal.aiReasoning as any)?.takeProfit2 || 0) : 0;
    const activeTp3 = activeSignal ? Number((activeSignal.aiReasoning as any)?.takeProfit3 || 0) : 0;
    const activeZone: [number, number] = activeSignal && Array.isArray((activeSignal.aiReasoning as any)?.entryZone)
      ? (activeSignal.aiReasoning as any).entryZone
      : [activeEntry, activeEntry];
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

    return await this.runAtomicGoldScan({ forceFresh: dto.forceFresh });
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
          try {
            await this.prisma.signal.delete({ where: { id: sig.id } });
            this.notificationsGateway.server.emit('signal:deleted', { id: sig.id });
            this.logger.log(`[ENGINE_SCHEDULER] Erased pending unfilled signal ${sig.id} from database due to news blackout (${newsGate.eventTitle}).`);
          } catch (delErr: any) {
            this.logger.warn(`[ENGINE_SCHEDULER] Failed to erase unfilled signal ${sig.id}: ${delErr.message}`);
          }
          await this.notificationsGateway.broadcastTradeSignalNotification(
            `⚠️ Pending Order Cancelled: ${sig.direction} Gold`,
            `Pending entry cancelled due to high-impact event (${newsGate.eventTitle}). Capital preserved.`,
            '/dashboard/engines/gold',
            'ORDER_CANCELLED'
          );
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
          const signalCreatedMs = new Date(sig.createdAt).getTime();
          const completed15mTime = completed15m ? new Date(completed15m.timestamp).getTime() : 0;

          // CRITICAL GUARD: Only invalidate using a 15M candle that closed strictly AFTER the signal was published.
          // Newly generated limit orders receive at least 14 minutes of grace so older pre-existing bars never dismiss a fresh setup.
          const isCandleAfterCreation = completed15mTime >= (signalCreatedMs + 14 * 60 * 1000);
          if (!isCandleAfterCreation) {
            continue;
          }

          const sl = Number(sig.stopLoss);
          const invalidationLevel = Number(
            reasoning.invalidationAndExpiry?.structuralInvalidationLevel ||
            reasoning.invalidationAndExpiry?.exactStopLoss ||
            sl
          );
          let structurallyInvalidated = false;

          if (completed15m) {
            if (sig.direction === 'BUY' && completedClose <= invalidationLevel) {
              structurallyInvalidated = true;
            } else if (sig.direction === 'SELL' && completedClose >= invalidationLevel) {
              structurallyInvalidated = true;
            }
          }

          if (structurallyInvalidated) {
            try {
              await this.prisma.signal.delete({ where: { id: sig.id } });
              this.notificationsGateway.server.emit('signal:deleted', { id: sig.id });
              this.logger.log(`[LIFECYCLE] Erased invalidated unfilled signal ${sig.id} from database.`);
            } catch (delErr: any) {
              this.logger.warn(`[LIFECYCLE] Failed to erase unfilled signal ${sig.id}: ${delErr.message}`);
            }
            await this.notificationsGateway.broadcastTradeSignalNotification(
              `⚠️ Pending Order Invalidated: ${sig.direction} Gold`,
              `Structure shifted: 15M bar closed beyond invalidation level ($${invalidationLevel.toFixed(2)}). Order cancelled and erased.`,
              '/dashboard/engines/gold',
              'ORDER_CANCELLED'
            );
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
    try {
      await this.runAtomicGoldScan();
    } catch (e: any) {
      this.logger.warn(`[handlePeriodicXauusdScan] Scan notice: ${e.message}`);
    }
  }

  // Candle-Replay Position & Order Lifecycle Manager (every 30 seconds)
  // Replays completed real 1M/5M/15M bars since each signal's last processed bar, so:
  //  - limit orders only fill when price actually trades at the limit (no premature "filled"),
  //  - wicks between polls are never missed,
  //  - signals left open while the server was down are reconciled (no frozen WAITING/OPEN states),
  //  - realized R is computed from real fill/exit prices (no fabricated multipliers).
  private positionManagerBusy = false;
  private static readonly TERMINAL_STATES = ['CLOSED', 'TP2_HIT', 'SL_HIT', 'THESIS_INVALIDATED', 'CANCELLED', 'EXPIRED', 'INVALIDATED'];
  private static readonly MAX_HOLD_HOURS = 24;
  private static readonly DEFAULT_ORDER_EXPIRY_HOURS = 4;

  private isSignalOpenForLifecycle(signal: any): boolean {
    const reasoning = (signal.aiReasoning as any) || {};
    const status = reasoning.status || 'ACTIVE';
    const lifecycleState = reasoning.lifecycleState || status;
    if (SignalsController.TERMINAL_STATES.includes(status) || SignalsController.TERMINAL_STATES.includes(lifecycleState)) return false;
    if (reasoning.closedAt || reasoning.runnerClosedAtBreakeven) return false;
    return true;
  }

  private buildLifecycleInput(signal: any, spread: number, barMs: number): LifecycleInput {
    const reasoning = (signal.aiReasoning as any) || {};
    const status = reasoning.status || 'ACTIVE';
    const orderType: string = reasoning.orderType || (signal.direction === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT');
    const createdMs = new Date(signal.createdAt).getTime();
    const expiryHours = Number(reasoning.invalidationAndExpiry?.orderExpiryHours) || SignalsController.DEFAULT_ORDER_EXPIRY_HOURS;
    const orderExpiresAt = reasoning.orderValidityExpiresAt
      ? new Date(reasoning.orderValidityExpiresAt).getTime()
      : createdMs + expiryHours * 3600_000;

    const isPartial =
      status === 'PARTIALLY_FILLED' ||
      reasoning.lifecycleState === 'PARTIALLY_FILLED' ||
      status === 'TP1_HIT' ||
      reasoning.outcome === 'TP1_HIT';
    const isFilled = Boolean(
      reasoning.isOrderFilled ||
      isPartial ||
      status === 'POSITION_OPEN' ||
      reasoning.lifecycleState === 'POSITION_OPEN' ||
      (reasoning.filledPrice && Number(reasoning.filledPrice) > 0)
    );
    const initialStopLoss = Number(reasoning.initialStopLoss ?? (isPartial ? NaN : signal.stopLoss));
    // Legacy partial records lost the initial stop when SL moved to breakeven: derive it from planned R:R
    const derivedInitialStop = isFinite(initialStopLoss)
      ? initialStopLoss
      : (signal.riskRewardRatio > 0
          ? Number(signal.entryPrice) - (signal.direction === 'BUY' ? 1 : -1) * Math.abs(Number(signal.takeProfit1) - Number(signal.entryPrice)) / signal.riskRewardRatio
          : Number(signal.stopLoss));

    const filledPrice = isFilled
      ? Number(reasoning.filledPrice || signal.entryPrice)
      : null;
    const filledAt = isFilled
      ? new Date(reasoning.filledAt || signal.createdAt).getTime()
      : null;

    const lastProcessed = reasoning.lifecycleProcessedUntil
      ? new Date(reasoning.lifecycleProcessedUntil).getTime()
      : Math.ceil(createdMs / barMs) * barMs; // first bar that STARTS after publication

    const bankedR = typeof reasoning.bankedR === 'number'
      ? reasoning.bankedR
      : isPartial && filledPrice
        ? 0.5 * ((signal.direction === 'BUY' ? 1 : -1) * (Number(signal.takeProfit1) - filledPrice)) / Math.max(0.01, Math.abs(Number(signal.entryPrice) - derivedInitialStop))
        : 0;

    const rawCurrentSl = Number(signal.stopLoss);
    const beFloor = Number(filledPrice ?? signal.entryPrice);
    const resolvedCurrentStop = isPartial
      ? (signal.direction === 'BUY' ? Math.max(rawCurrentSl, beFloor) : Math.min(rawCurrentSl, beFloor))
      : rawCurrentSl;

    return {
      direction: signal.direction as 'BUY' | 'SELL',
      orderType,
      entryPrice: Number(signal.entryPrice),
      initialStopLoss: derivedInitialStop,
      currentStopLoss: resolvedCurrentStop,
      tp1: Number(signal.takeProfit1),
      tp2: Number(signal.takeProfit2 || reasoning.takeProfit2 || signal.takeProfit1),
      state: isPartial ? 'PARTIALLY_FILLED' : isFilled ? 'POSITION_OPEN' : 'WAITING_FOR_ENTRY',
      filledPrice,
      filledAt,
      bankedR,
      remainingFraction: isPartial ? 0.5 : 1,
      orderExpiresAt,
      maxHoldMs: SignalsController.MAX_HOLD_HOURS * 3600_000,
      spread,
      processFromTime: lastProcessed,
      barMs,
      runningMfeR: typeof reasoning.runningMfeR === 'number' ? reasoning.runningMfeR : (typeof reasoning.mfeR === 'number' ? reasoning.mfeR : 0),
      runningMaeR: typeof reasoning.runningMaeR === 'number' ? reasoning.runningMaeR : (typeof reasoning.maeR === 'number' ? reasoning.maeR : 0)
    };
  }

  private async fetchLifecycleBars(oldestProcessFrom: number): Promise<{ bars: LifecycleBar[]; barMs: number; resolution: string }> {
    const nowMs = Date.now();
    const gapMin = Math.max(1, (nowMs - oldestProcessFrom) / 60_000);
    let resolution: '1min' | '5min' | '15min' = '1min';
    let barMs = 60_000;
    if (gapMin > 900) { resolution = '5min'; barMs = 300_000; }
    if (gapMin > 5 * 24 * 60) { resolution = '15min'; barMs = 900_000; }
    const nBars = Math.min(5000, Math.ceil(gapMin / (barMs / 60_000)) + 10);
    const candles = await this.fetchXauusdCandles(resolution, Math.max(30, nBars));
    // Only COMPLETED bars: a forming bar's high/low are not final
    const bars: LifecycleBar[] = candles
      .map(c => ({ time: new Date(c.timestamp).getTime(), open: c.open, high: c.high, low: c.low, close: c.close }))
      .filter(b => b.time + barMs <= nowMs && b.high >= b.low && b.low > 1000);
    return { bars, barMs, resolution };
  }

  @Interval(30_000)
  async handlePositionManagement() {
    if (this.positionManagerBusy) return;
    this.positionManagerBusy = true;
    try {
      const now = new Date();
      const candidateSignals = await this.prisma.signal.findMany({
        where: {
          symbol: 'GOLD',
          direction: { in: ['BUY', 'SELL'] },
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600_000) }
        },
        orderBy: { createdAt: 'asc' },
        take: 300
      });
      const openSignals = candidateSignals.filter(s => this.isSignalOpenForLifecycle(s));
      if (openSignals.length === 0) return;

      // Live spread (for ask-side fills/exits). Use stored setup spread if the live quote is unavailable.
      let liveSpread = 0;
      try {
        const quotes = await this.fetchTradingViewQuotes('cfd', ['OANDA:XAUUSD', 'FOREXCOM:XAUUSD']);
        const candidates = [quotes['OANDA:XAUUSD'], quotes['FOREXCOM:XAUUSD']];
        for (const item of candidates) {
          if (item && typeof item.bid === 'number' && typeof item.ask === 'number' && item.bid > 1000 && item.ask >= item.bid) {
            liveSpread = parseFloat((item.ask - item.bid).toFixed(2));
            break;
          }
        }
      } catch { /* spread falls back to stored microstructure */ }

      // Fetch bars once at the resolution needed by the oldest unprocessed signal
      const provisional = openSignals.map(s => this.buildLifecycleInput(s, 0, 60_000).processFromTime);
      const { bars, barMs, resolution } = await this.fetchLifecycleBars(Math.min(...provisional));
      if (bars.length === 0) {
        this.logger.warn('[LIFECYCLE] No completed bars available from market data feed. Lifecycle replay deferred (no synthetic prices used).');
        return;
      }

      for (const signal of openSignals) {
        try {
          await this.applyLifecycleReplay(signal, bars, barMs, resolution, liveSpread, now);
        } catch (err: any) {
          // Isolate failures: one bad record must never freeze the remaining signals
          this.logger.warn(`[LIFECYCLE] Signal ${signal.id} replay notice: ${err.message}`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[handlePositionManagement] notice: ${e.message}`);
    } finally {
      this.positionManagerBusy = false;
    }
  }

  private async applyLifecycleReplay(signal: any, bars: LifecycleBar[], barMs: number, resolution: string, liveSpread: number, now: Date) {
    const reasoning = (signal.aiReasoning as any) || {};
    const storedSpread = Number(reasoning.microstructure?.spread) || 0;
    const spread = liveSpread > 0 ? liveSpread : storedSpread;
    if (spread <= 0) {
      this.logger.warn(`[LIFECYCLE] ${signal.id}: live and stored spread unavailable. Lifecycle replay deferred until real quote resumes.`);
      return;
    }
    const input = this.buildLifecycleInput(signal, spread, barMs);

    // If the bar feed does not reach back to this signal's last processed point, process from the first available bar
    if (bars.length > 0 && bars[0].time > input.processFromTime) {
      this.logger.warn(`[LIFECYCLE] ${signal.id}: data gap from ${new Date(input.processFromTime).toISOString()} to ${new Date(bars[0].time).toISOString()} (feed history limit).`);
      input.processFromTime = bars[0].time;
    }

    const result = replaySignalLifecycle(input, bars);
    const processedUntil = new Date(result.nextProcessFromTime).toISOString();

    if (result.events.length === 0) {
      // Nothing happened: only advance the cursor
      if (result.nextProcessFromTime !== input.processFromTime) {
        await this.prisma.signal.update({
          where: { id: signal.id },
          data: { aiReasoning: { ...reasoning, initialStopLoss: input.initialStopLoss, lifecycleProcessedUntil: processedUntil, lastValidatedAt: now.toISOString() } }
        });
      }
      return;
    }

    let lifecycleEvents = Array.isArray(reasoning.lifecycleEvents) ? [...reasoning.lifecycleEvents] : [];
    const describe: Record<LifecycleEventType, (p: number) => { state: string; reason: string; details: string }> = {
      FILLED: p => ({ state: 'POSITION_OPEN', reason: 'ORDER_FILLED', details: `${input.orderType.replace(/_/g, ' ')} filled at $${p.toFixed(2)} (verified on ${resolution} bar).` }),
      TP1_PARTIAL: p => ({ state: 'PARTIALLY_FILLED', reason: 'TP1_HIT_SL_MOVED_TO_BE', details: `TP1 reached at $${p.toFixed(2)}. 50% banked, stop moved to breakeven.` }),
      TP2_HIT: p => ({ state: 'CLOSED', reason: 'FULL_TARGET_2_REACHED', details: `TP2 reached at $${p.toFixed(2)}.` }),
      SL_HIT: p => ({ state: 'CLOSED', reason: 'STOP_LOSS_REACHED', details: `Stop loss executed at $${p.toFixed(2)}.` }),
      BREAKEVEN_EXIT: p => ({ state: 'CLOSED', reason: 'RUNNER_BREAKEVEN', details: `Runner closed at breakeven ($${p.toFixed(2)}) after TP1.` }),
      PENDING_SL_INVALIDATED: p => ({ state: 'CANCELLED', reason: 'THESIS_INVALIDATED_PRE_FILL', details: `Price reached stop level ($${p.toFixed(2)}) before the limit entry filled.` }),
      ENTRY_MISSED: p => ({ state: 'EXPIRED', reason: 'ENTRY_MISSED', details: `Price ran 90% of the way to TP1 ($${p.toFixed(2)}) without trading at the entry price.` }),
      ORDER_EXPIRED: p => ({ state: 'EXPIRED', reason: 'ORDER_EXPIRED', details: `Pending order validity elapsed without a fill (last price $${p.toFixed(2)}).` }),
      TIME_EXIT: p => ({ state: 'CLOSED', reason: 'MAX_HOLD_TIME_EXIT', details: `Position closed at market ($${p.toFixed(2)}) after ${SignalsController.MAX_HOLD_HOURS}h maximum hold.` }),
      BREAKEVEN_SET: p => ({ state: 'POSITION_OPEN', reason: 'BREAKEVEN_SHIELD_ACTIVATED', details: `Trade reached +1.2R MFE. Capital protection shield moved stop to breakeven ($${p.toFixed(2)}).` }),
      TRAILED_STOP_1R: p => ({ state: 'POSITION_OPEN', reason: 'TRAILING_STOP_1R_LOCKED', details: `Trade reached +2.0R MFE. Trailed stop locked in +1.0R profit at $${p.toFixed(2)}.` }),
      TRAILED_STOP_2R: p => ({ state: 'POSITION_OPEN', reason: 'TRAILING_STOP_2R_LOCKED', details: `Trade reached +3.0R MFE. Trailed stop locked in +2.0R profit at $${p.toFixed(2)}.` }),
      TRAILED_STOP_EXIT: p => ({ state: 'CLOSED', reason: 'TRAILED_PROFIT_PROTECTED', details: `Position closed in profit by trailing stop at $${p.toFixed(2)}.` }),
      EARLY_INVALIDATION_EXIT: p => ({ state: 'CLOSED', reason: 'EARLY_STRUCTURAL_INVALIDATION_CUT', details: `Position cut early at $${p.toFixed(2)} (~ -0.45R) to avoid full -1.0R loss.` })
    };
    for (const ev of result.events) {
      const d = describe[ev.type](ev.price);
      lifecycleEvents.push({ timestamp: new Date(ev.time).toISOString(), state: d.state, price: ev.price, reason: d.reason, details: d.details } as SignalLifecycleEvent);
    }
    if (lifecycleEvents.length > 50) lifecycleEvents = lifecycleEvents.slice(-50);

    const lastEvent = result.events[result.events.length - 1];
    const nextReasoning: any = {
      ...reasoning,
      initialStopLoss: input.initialStopLoss,
      lifecycleProcessedUntil: processedUntil,
      lastValidatedAt: now.toISOString(),
      lastStatusChange: new Date(lastEvent.time).toISOString(),
      lastCheckedPrice: lastEvent.price,
      bankedR: result.bankedR,
      pnlModel: 'v2',
      lifecycleEvents,
      runningMfeR: result.mfeR ?? 0,
      runningMaeR: result.maeR ?? 0,
      mfeR: result.mfeR,
      maeR: result.maeR,
      holdingDurationMinutes: result.holdingDurationMinutes,
      zoneHeld: result.zoneHeld
    };
    if (result.filledPrice) {
      nextReasoning.isOrderFilled = true;
      nextReasoning.filledPrice = result.filledPrice;
      nextReasoning.filledAt = new Date(result.filledAt!).toISOString();
    }
    const updateData: any = {};

    if (result.closed) {
      const isUnfilled = result.outcome === 'UNFILLED' || result.outcome === 'CANCELLED' || !result.filledPrice;
      if (isUnfilled) {
        // User directive: When the signal is unfilled, delete and erase it completely from the database
        try {
          await this.prisma.signal.delete({ where: { id: signal.id } });
          this.notificationsGateway.server.emit('signal:deleted', { id: signal.id });
          this.logger.log(`[LIFECYCLE] Erased unfilled signal ${signal.id} (${result.closeReason || result.outcome}) from database.`);
        } catch (delErr: any) {
          this.logger.warn(`[LIFECYCLE] Failed to delete unfilled signal ${signal.id}: ${delErr.message}`);
        }
        return;
      }

      const lifecycleState = 'CLOSED';
      Object.assign(nextReasoning, {
        status: 'CLOSED',
        lifecycleState,
        outcome: result.outcome,
        closeReason: result.closeReason,
        closedAt: new Date(lastEvent.time).toISOString(),
        exitPrice: result.exitPrice,
        pnlR: result.realizedR,
        runnerClosedAtBreakeven: result.outcome === 'BREAKEVEN' || undefined,
        cancellationDetail: lifecycleState !== 'CLOSED' ? describe[lastEvent.type](lastEvent.price).details : undefined
      });
    } else if (result.state === 'PARTIALLY_FILLED') {
      Object.assign(nextReasoning, { status: 'PARTIALLY_FILLED', lifecycleState: 'PARTIALLY_FILLED', outcome: 'TP1_HIT', trailingStopBe: true });
      updateData.stopLoss = result.currentStopLoss;
    } else if (result.state === 'POSITION_OPEN') {
      const beOrTrailLocked = result.filledPrice !== null && (
        (signal.direction === 'BUY' && result.currentStopLoss >= result.filledPrice) ||
        (signal.direction === 'SELL' && result.currentStopLoss <= result.filledPrice)
      );
      Object.assign(nextReasoning, {
        status: 'POSITION_OPEN',
        lifecycleState: 'POSITION_OPEN',
        trailingStopBe: beOrTrailLocked || Boolean(reasoning.trailingStopBe)
      });
      if (result.currentStopLoss > 0 && result.currentStopLoss !== Number(signal.stopLoss)) {
        updateData.stopLoss = result.currentStopLoss;
      }
    }
    updateData.aiReasoning = nextReasoning;

    const updatedSig = await this.prisma.signal.update({ where: { id: signal.id }, data: updateData });
    this.notificationsGateway.server.emit('signal:updated', updatedSig);
    this.logger.log(`[LIFECYCLE] ${reasoning.publicId || signal.id}: ${result.events.map(e => `${e.type}@${e.price}`).join(' -> ')}${result.realizedR !== null ? ` (R=${result.realizedR})` : ''}`);

    // Persistent analytics & risk memory only for filled, closed trades
    if (result.closed && result.filledPrice && result.realizedR !== null) {
      const resultLabel = result.realizedR > 0 ? 'WIN' : result.realizedR === 0 ? 'BREAKEVEN' : 'LOSS';
      try {
        await this.prisma.goldSignalPerformance.upsert({
          where: { signalId: signal.id },
          update: { exitPrice: result.exitPrice!, result: resultLabel, pnlR: result.realizedR, exitReason: result.closeReason!, closedAt: new Date(lastEvent.time) },
          create: {
            signalId: signal.id, symbol: 'GOLD', direction: signal.direction, entryPrice: result.filledPrice,
            exitPrice: result.exitPrice!, result: resultLabel, pnlR: result.realizedR, exitReason: result.closeReason!,
            createdAt: signal.createdAt, closedAt: new Date(lastEvent.time)
          }
        });
      } catch (perfErr: any) {
        this.logger.warn(`[LIFECYCLE] GoldSignalPerformance sync notice: ${perfErr.message}`);
      }
      this.recentTradesHistory.push({
        id: signal.id, symbol: 'GOLD', direction: signal.direction,
        result: result.realizedR > 0 ? 'WIN' : result.realizedR < 0 ? 'LOSS' : 'SCRATCH',
        pnlR: result.realizedR, timestamp: lastEvent.time
      });
      if (this.recentTradesHistory.length > 50) this.recentTradesHistory.shift();
      this.lastStopLossHit = result.outcome === 'SL_HIT'
        ? { direction: signal.direction, stopLossPrice: Number(signal.stopLoss), timestamp: lastEvent.time }
        : this.lastStopLossHit;
    }

    // Notifications only for events that happened recently (do not spam on downtime reconciliation)
    const isRecent = now.getTime() - lastEvent.time < 15 * 60_000;
    if (isRecent) {
      const titles: Record<LifecycleEventType, string> = {
        FILLED: `🚀 Order Filled: ${signal.direction} Gold`,
        TP1_PARTIAL: '🎯 Take Profit 1 Hit (SL Moved to Breakeven)',
        TP2_HIT: '🎯 Take Profit 2 Hit! Trade Complete',
        SL_HIT: '🛑 Stop Loss Hit',
        BREAKEVEN_EXIT: '🛡️ Runner Closed at Breakeven',
        PENDING_SL_INVALIDATED: `⚠️ Pending Order Cancelled: ${signal.direction} Gold`,
        ENTRY_MISSED: `⏱️ Entry Missed: ${signal.direction} Gold`,
        ORDER_EXPIRED: `⏱️ Pending Order Expired: ${signal.direction} Gold`,
        TIME_EXIT: `⏱️ Time Exit: ${signal.direction} Gold`,
        BREAKEVEN_SET: '🛡️ Breakeven Shield Activated (+1.2R MFE)',
        TRAILED_STOP_1R: '🔒 Trailing Stop Locked (+1.0R Profit)',
        TRAILED_STOP_2R: '🔒 Trailing Stop Locked (+2.0R Profit)',
        TRAILED_STOP_EXIT: '💰 Position Closed in Profit by Trailing Stop',
        EARLY_INVALIDATION_EXIT: '✂️ Trade Cut Early (Structural Invalidation)'
      };
      const subType = lastEvent.type === 'FILLED' ? 'ORDER_FILLED'
        : ['TP1_PARTIAL', 'TP2_HIT', 'BREAKEVEN_EXIT'].includes(lastEvent.type) ? 'TARGET_HIT'
        : lastEvent.type === 'SL_HIT' ? 'STOP_HIT' : 'ORDER_CANCELLED';
      try {
        await this.notificationsGateway.broadcastTradeSignalNotification(
          titles[lastEvent.type],
          describe[lastEvent.type](lastEvent.price).details,
          '/dashboard/engines/gold',
          subType as any
        );
      } catch (nErr: any) {
        this.logger.warn(`[LIFECYCLE] Notification notice: ${nErr.message}`);
      }
    }

    if (result.closed) {
      const delayMs = result.outcome === 'SL_HIT' ? 60_000 : 5_000;
      setTimeout(() => {
        this.handlePeriodicXauusdScan().catch(err => this.logger.warn(`[LIFECYCLE] Post-close re-scan notice: ${err.message}`));
      }, delayMs);
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
      await this.purgeAllUnfilledSignalsFromDb();
    } catch (e: any) {
      this.logger.warn(`[RETENTION] Signal retention prune error: ${e.message}`);
    }
  }

  // Purge all unfilled, expired, cancelled, or invalidated limit orders from the database
  // Enforces user policy: "when the signal is unfilled it should be deleted and erased in db"
  private async purgeAllUnfilledSignalsFromDb() {
    try {
      const candidates = await this.prisma.signal.findMany({
        where: { symbol: 'GOLD' }
      });
      const nowMs = Date.now();
      const toDelete = candidates.filter(s => {
        const reasoning = (s.aiReasoning as any) || {};
        const status = reasoning.status || 'ACTIVE';
        const lifecycle = reasoning.lifecycleState || status;
        const outcome = reasoning.outcome;
        const hasRealFill = Boolean(
          reasoning.isOrderFilled === true ||
          (reasoning.filledPrice && Number(reasoning.filledPrice) > 0) ||
          reasoning.lifecycleEvents?.some((e: any) => e.type === 'FILLED' || e.state === 'POSITION_OPEN')
        );
        const isExpired = s.expiresAt && new Date(s.expiresAt).getTime() < nowMs;
        const isOrderExpired = reasoning.orderValidityExpiresAt && new Date(reasoning.orderValidityExpiresAt).getTime() < nowMs;
        const isStagnantWaiting = (status === 'WAITING_FOR_ENTRY' || lifecycle === 'WAITING_FOR_ENTRY') &&
                                  (nowMs - new Date(s.createdAt).getTime() > 4 * 3600_000);

        return !hasRealFill && (
          ['EXPIRED', 'CANCELLED', 'INVALIDATED', 'UNFILLED'].includes(lifecycle || outcome || status) ||
          isExpired ||
          isOrderExpired ||
          isStagnantWaiting ||
          status === 'CLOSED' ||
          lifecycle === 'CLOSED'
        );
      });
      if (toDelete.length > 0) {
        for (const item of toDelete) {
          await this.prisma.signal.delete({ where: { id: item.id } }).catch(() => {});
        }
        this.logger.log(`[PURGE] Erased ${toDelete.length} unfilled/stagnant/expired signals from database.`);
      }
    } catch (err: any) {
      this.logger.warn(`[PURGE] purgeAllUnfilledSignals notice: ${err.message}`);
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
    const entryVal = Number(dto.entryPrice);
    const slVal = Number(dto.stopLoss);
    const tp1Val = Number(dto.takeProfit1);
    const tp2Val = Number(dto.takeProfit2);
    const riskDist = Math.abs(entryVal - slVal);
    const rewardDist = Math.abs(tp1Val - entryVal);
    const computedRr = riskDist > 0 ? parseFloat((rewardDist / riskDist).toFixed(2)) : 0;
    const signal = await this.prisma.signal.create({
      data: {
        symbol,
        direction: dto.direction,
        entryPrice: entryVal,
        stopLoss: slVal,
        takeProfit1: tp1Val,
        takeProfit2: tp2Val,
        riskRewardRatio: computedRr,
        winProbability: typeof dto.confidence === 'number' ? Number(dto.confidence) : 0,
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
    if (!closes || closes.length < period + 1) return 0;
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
    const hasRealVolume = candles.some(c => Number(c.volume) > 0);
    if (!hasRealVolume) return 0;
    let totalTypicalVolume = 0;
    let totalVolume = 0;
    for (const candle of candles) {
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      const volume = Number(candle.volume || 0);
      if (![high, low, close].every(Number.isFinite) || volume <= 0) continue;
      const typicalPrice = (high + low + close) / 3;
      totalTypicalVolume += typicalPrice * volume;
      totalVolume += volume;
    }
    return totalVolume > 0 ? totalTypicalVolume / totalVolume : 0;
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
    if (!candles || candles.length < period * 2) return 0;
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

    if (trs.length < period * 2) return 0;

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
      return parseFloat((dxValues[dxValues.length - 1] || 0).toFixed(1));
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
      return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
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
  providers: [NewsMomentumService],
  exports: [NewsMomentumService],
})
export class SignalsModule {}
