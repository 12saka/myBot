export type GoldMarketRegime =
  | 'STRONG_BULL_TREND'
  | 'STRONG_BEAR_TREND'
  | 'RANGE_BOUND_EQUILIBRIUM'
  | 'VOLATILITY_COMPRESSION'
  | 'NEWS_SHOCK_DISPERSION';

export type GoldStrategyType =
  | 'SWEEP_CHOCH_REVERSAL'
  | 'BOS_PULLBACK_CONTINUATION'
  | 'RANGE_DEVIATION_RECLAIM'
  | 'AWAITING_SETUP';

export type GateCheckStatus = 'PASSED' | 'HELD' | 'BLOCKED';

export interface GoldGateAudit {
  gateId: 'GATE_1_DATA' | 'GATE_2_MARKET' | 'GATE_3_SETUP' | 'GATE_4_TRADE' | 'GATE_5_EXECUTION';
  name: string;
  passed: boolean;
  score: number;
  code: string;
  reason: string;
  telemetry?: Record<string, any>;
}

export interface GoldMultiTimeframeConcordance {
  trend4h: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trend1h: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trend15m: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  concordanceStatus: 'FULL_ALIGNMENT' | 'PARTIAL_ALIGNMENT' | 'COUNTER_TREND_CHOP';
  displacement4hAtr: number;
  volumeProfilePoc: number;
  sessionVwap: number;
}

export interface GoldStructuralLevels {
  currentPrice: number;
  asianHigh: number;
  asianLow: number;
  londonHigh: number;
  londonLow: number;
  previousDayHigh: number;
  previousDayLow: number;
  unmitigatedOrderBlocks: {
    type: 'BULLISH' | 'BEARISH';
    high: number;
    low: number;
    midpoint: number;
    timeframe: string;
    isMitigated: boolean;
  }[];
  fairValueGaps: {
    type: 'BULLISH' | 'BEARISH';
    top: number;
    bottom: number;
    midpoint: number;
    atrRatio: number;
    isFilled: boolean;
  }[];
}

export interface GoldMacroBarometer {
  dxyPrice: number;
  dxyChange1h: number;
  dxyChange24h: number;
  dxyTrend: 'STRENGTHENING' | 'WEAKENING' | 'NEUTRAL';
  us10yYield: number;
  us10yChange1h: number;
  realYieldProxy: number;
  safeHavenDemandScore: number; // 0 - 100
  macroAlignment: 'BULLISH_DECOUPLING' | 'BEARISH_PRESSURE' | 'CONCORDANT_BULL' | 'NEUTRAL_FLOW';
  forexFactoryGate: 'CLEAR' | 'BLACKOUT_ACTIVE' | 'POST_NEWS_STABILIZATION';
  nextHighImpactEvent?: {
    title: string;
    currency: string;
    timeUtc: string;
    minutesRemaining: number;
  };
}

export interface GoldEntryIntelligence {
  eligibleStrategies: GoldStrategyType[];
  selectedStrategy: GoldStrategyType;
  orderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET_BUY' | 'MARKET_SELL' | 'WAIT';
  preferredEntry: number;
  entryZone: [number, number];
  currentDistancePips: number;
  entryConditions: {
    name: string;
    status: 'PASSED' | 'PENDING' | 'FAILED';
    detail: string;
  }[];
}

export interface GoldRiskParameters {
  exactStopLoss: number;
  stopDistancePips: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward1: number;
  riskReward2: number;
  expectedValueR: number;
  recommendedLots: number;
  recommendedUnitsOz: number;
  riskBudgetUsd: number;
  trailingStopBeActive: boolean;
  spread: number;
  maxSpreadAllowed: number;
  executionEligibility: 'APPROVED' | 'SPREAD_HALTED' | 'EVENT_BLOCKED' | 'WAITING_TRIGGER';
}

export interface GoldOverviewData {
  timestamp: string;
  symbol: 'GOLD' | 'XAU/USD';
  currentPrice: number;
  change24h: number;
  change24hPct: number;
  spread: number;
  marketRegime: GoldMarketRegime;
  volatilityAtr15m: number;
  volatilityPercentile: number;
  sessionName: string;
  dataQuality: 'PRIME' | 'DEGRADED' | 'OFFLINE';
  confidence?: number;
  direction?: 'BUY' | 'SELL' | 'WAIT';
  signalGrade?: string;
  activeSignal: any | null;
  fiveGatesAudit: GoldGateAudit[];
  macro: GoldMacroBarometer;
  multiTf: GoldMultiTimeframeConcordance;
  structure: GoldStructuralLevels;
  entryPlan: GoldEntryIntelligence;
  riskPlan: GoldRiskParameters;
}

export type AnnotationType =
  | 'BOS'
  | 'CHOCH'
  | 'MSS'
  | 'ORDER_BLOCK'
  | 'FVG'
  | 'LIQUIDITY_SWEEP'
  | 'LIQUIDITY_POOL'
  | 'ENTRY_LEVEL'
  | 'STOP_LOSS'
  | 'TAKE_PROFIT_1'
  | 'TAKE_PROFIT_2'
  | 'TAKE_PROFIT_3'
  | 'TURTLE_SOUP'
  | 'DEMAND_ZONE'
  | 'SUPPLY_ZONE';

export interface GoldChartAnnotation {
  id: string;
  type: AnnotationType;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  price: number;
  upperPrice?: number;
  lowerPrice?: number;
  startTime?: string | number;
  endTime?: string | number;
  timeframe: '15m' | '1h' | '4h';
  status: 'CONFIRMED' | 'UNMITIGATED' | 'MITIGATED' | 'ACTIVE' | 'SWEPT';
  label: string;
  description: string;
}

export interface GoldAnnotationsResponse {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  tradeLevels: {
    entry: number | null;
    stopLoss: number | null;
    takeProfit1: number | null;
    takeProfit2: number | null;
    takeProfit3: number | null;
    direction: 'BUY' | 'SELL' | 'WAIT';
    orderType: string;
  };
  annotations: GoldChartAnnotation[];
  lastUpdated: string;
}
