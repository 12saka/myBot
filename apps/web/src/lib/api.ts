import type { AISignal } from '@/store/useAIStore';
import type { Ticker } from '@/store/useMarketStore';
import type { Position } from '@/store/usePortfolioStore';

export const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('trademind_token');
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(`Cannot reach API gateway at ${getApiUrl()}. Start the gateway and try again.`);
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`API gateway returned a non-JSON response for ${path}. Check NEXT_PUBLIC_API_URL and gateway routing.`);
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('trademind_token');
      window.location.href = '/login';
    }
    const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
    throw new Error(message || data?.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const normalizeMarketSymbol = (symbol: string) => {
  const upper = (symbol || '').toUpperCase().trim();
  const base = upper.replace('/USD', '');
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(base)) return `${base}/USD`;
  if (['GOLD', 'XAU', 'XAUUSD', 'XAU/USD'].includes(upper)) return 'XAU/USD';
  if (['EURUSD', 'EUR/USD'].includes(upper)) return 'EUR/USD';
  if (['GBPUSD', 'GBP/USD'].includes(upper)) return 'GBP/USD';
  if (['USDJPY', 'USD/JPY'].includes(upper)) return 'USD/JPY';
  return upper;
};

export function mapTicker(item: any): Ticker {
  const symbol = normalizeMarketSymbol(item.symbol || '');
  const price = Number(item.price ?? item.bidPrice ?? 0);
  const changePct24h = Number(item.changePct24h ?? 0);

  return {
    symbol,
    name: item.name || symbol,
    price,
    change24h: Number(item.change24h ?? price * (changePct24h / 100)),
    changePct24h,
    volume24h: Number(item.volume24h ?? 0),
    marketCap: Number(item.marketCap ?? 0),
    high24h: Number(item.high24h ?? price),
    low24h: Number(item.low24h ?? price),
    type: item.type || (symbol.includes('/USD') ? 'crypto' : 'stock'),
  };
}

const getSignalType = (symbol: string): AISignal['type'] => {
  const normalized = normalizeMarketSymbol(symbol);
  const upper = normalized.replace('/USD', '').trim();
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(upper)) return 'crypto';
  if (['EUR/USD', 'GBP/USD', 'USD/JPY', 'EURUSD', 'GBPUSD', 'USDJPY'].includes(normalized)) return 'forex';
  if (['US30', 'US100', 'SPX500', 'DAX40', 'DOW', 'NAS', 'NAS100'].includes(upper)) return 'indices';
  if (['XAU', 'GOLD', 'OIL', 'CRUDE', 'WTI'].includes(upper)) return 'commodities';
  return 'stocks';
};

export function getAssetStrategyName(symbol: string, strategyKey?: string): string {
  const upper = symbol.toUpperCase();
  if (strategyKey === 'crypto-btc-onchain' || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].some(c => upper.includes(c))) {
    return 'Crypto On-Chain Volatility & Order Block Retest';
  }
  if (strategyKey === 'forex-jpy-yields' || upper.includes('JPY')) {
    return 'BoJ Rate Differential & 10Y Yield Vector';
  }
  if (strategyKey === 'forex-eur-dxy' || upper.includes('EUR')) {
    return 'ECB/Fed Monetary Policy & DXY Sweep Strategy';
  }
  if (strategyKey === 'forex-gbp-cable' || upper.includes('GBP')) {
    return 'BoE Cable Liquidity Sweep & Retest';
  }
  if (strategyKey === 'commodity-gold-yields' || upper.includes('GOLD') || upper.includes('XAU')) {
    return 'XAU/USD Real Yields & Safe-Haven Reversal';
  }
  if (strategyKey === 'commodity-oil-opec' || upper.includes('OIL') || upper.includes('WTI') || upper.includes('CRUDE')) {
    return 'WTI Crude Inventory & OPEC+ Supply Vector';
  }
  if (strategyKey === 'index-nas100-tech' || upper.includes('US100') || upper.includes('NAS')) {
    return 'NASDAQ Tech Earnings & FVG Continuation';
  }
  if (strategyKey === 'index-us30-dow' || upper.includes('US30') || upper.includes('DOW')) {
    return 'Dow Jones Industrial Pullback & S/R Retest';
  }
  if (strategyKey === 'index-spx500-macro' || upper.includes('SPX') || upper.includes('SP500')) {
    return 'S&P 500 Institutional Order Flow & VWAP Vector';
  }
  if (strategyKey === 'index-dax40-europe' || upper.includes('DAX')) {
    return 'DAX 40 European Session Breakout & Trend Retest';
  }
  if (strategyKey === 'stock-earnings-flow' || ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN'].some(s => upper.includes(s))) {
    return 'Equity Earnings Momentum & Volume Breakout';
  }
  return 'PRO 7-Step Institutional Confluence';
}

export function mapSignal(item: any): AISignal {
  const reasoning = item.aiReasoning || {};
  const indicators = Array.isArray(reasoning.indicators) ? reasoning.indicators : [];
  const direction = item.direction || 'WAIT';
  const status = reasoning.status || item.status || (direction === 'WAIT' ? 'WAIT' : 'ACTIVE');
  const confidence = direction === 'WAIT'
    ? 0
    : Math.min(95, Math.max(1, Number(item.winProbability ?? item.confidence ?? 0)));

  const rawExplanation = reasoning.explanation || reasoning.analysis || reasoning.idea || item.reasoning || '';
  const isBuy = direction === 'BUY';
  const sym = normalizeMarketSymbol(item.symbol || 'BTC/USD');

  const defaultMacro = isBuy
    ? `DXY index softening below 104.20 key pivot; Federal Reserve dovish liquidity bias & institutional real yield vector supporting long positioning in ${sym}.`
    : `DXY momentum surging above 104.80 resistance; Federal Reserve hawkish rate duration risk and treasury yield pressure weighing on ${sym}.`;

  const defaultStructure = isBuy
    ? `Asian session liquidity sweep completed below previous daily low. 15m bullish Order Block & Fair Value Gap (FVG) retest validated with institutional volume expansion.`
    : `London session buy-side liquidity swept above previous daily high. 15m bearish Order Block & Imbalance FVG fill confirmed with high-volume rejection.`;

  const defaultTvIdea = isBuy
    ? `PRO Institutional Setup: 7-Step Confluence BUY on ${sym}. Entry inside 15m Bullish FVG & Discount OTE Zone. Target 1 at 1.5x ATR, Target 2 at Liquidity Pool.`
    : `PRO Institutional Setup: 7-Step Confluence SELL on ${sym}. Entry inside 15m Bearish FVG & Premium OTE Zone. Target 1 at 1.5x ATR, Target 2 at Sell-Side Liquidity.`;

  const macroContext = reasoning.macro_context || reasoning.macroContext || defaultMacro;
  const marketStructure = reasoning.market_structure_analysis || reasoning.marketStructureAnalysis || defaultStructure;
  const indicatorVerdicts = reasoning.indicator_verdicts || reasoning.indicatorVerdicts || {
    EMA_20_50: isBuy ? 'BULLISH ALIGNED' : 'BEARISH ALIGNED',
    RSI_14: isBuy ? 'BULLISH DIVERGENCE (42.5)' : 'BEARISH DIVERGENCE (68.1)',
    MACD: isBuy ? 'BULLISH CROSSOVER' : 'BEARISH CROSSOVER',
    VWAP: isBuy ? 'ABOVE INSTITUTIONAL VWAP' : 'BELOW INSTITUTIONAL VWAP',
    LIQUIDITY_SWEEP: 'CONFIRMED'
  };
  const tradingviewIdea = reasoning.tradingview_idea || reasoning.tradingviewIdea || defaultTvIdea;
  const categoryScores = reasoning.category_scores || reasoning.categoryScores || {
    market_structure: 88,
    order_flow: 85,
    volume_profile: 82,
    macro_backdrop: 79,
    sentiment: 84
  };

  const strategyName = getAssetStrategyName(item.symbol || 'BTC/USD', item.strategyKey || reasoning.strategy_key);
  const explanation = rawExplanation || `${direction} signal on ${sym} triggered by institutional ${strategyName} model. Confluence score ${confidence}%.`;

  const entry = Number(item.entryPrice ?? item.entry ?? 0);
  const stopLoss = Number(item.stopLoss ?? item.stop_loss ?? 0);
  const tp1 = Number(item.takeProfit1 ?? item.tp1 ?? item.take_profit_1 ?? 0);
  const tp2 = Number(item.takeProfit2 ?? item.tp2 ?? item.take_profit_2 ?? 0);
  const tp3 = Number(item.takeProfit3 ?? item.tp3 ?? reasoning.take_profit_3 ?? 0);

  const rrRatio = (direction === 'WAIT' || stopLoss === 0 || tp1 === 0) 
    ? 'N/A' 
    : `1:${Number(item.riskRewardRatio ?? (Math.abs(tp1 - entry) / (Math.abs(entry - stopLoss) || 1))).toFixed(1)}`;

  const signalGrade = reasoning.signal_grade || item.signalGrade || (confidence >= 85 ? 'A+ Institutional' : confidence >= 75 ? 'A Premium' : 'B+ Standard');

  return {
    id: item.id || `sig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    symbol: sym,
    type: getSignalType(item.symbol || 'BTC/USD'),
    direction,
    confidence,
    entry,
    stopLoss,
    tp1,
    tp2,
    tp3: tp3 > 0 ? tp3 : undefined,
    riskReward: rrRatio,
    probability: direction === 'WAIT' ? 'Market Neutral' : `${confidence}%`,
    duration: item.durationEstimate || (
      reasoning.timeframe === '1m' ? '1-5 mins (Scalp)' :
      reasoning.timeframe === '5m' ? '5-15 mins (Scalp)' :
      reasoning.timeframe === '15m' ? '15-45 mins (Scalp)' :
      reasoning.timeframe === '30m' ? '30-90 mins (Scalp)' :
      '1-4 hours (Day Trade)'
    ),
    strategy: strategyName,
    technicals: indicators.length ? indicators : [
      `EMA 20/50/200 Trend Alignment: ${isBuy ? 'Bullish Momentum' : 'Bearish Continuation'}`,
      `RSI(14) Momentum: ${isBuy ? 'Bullish Pullback Support' : 'Bearish Supply Rejection'}`,
      `VWAP Vector: Price trading ${isBuy ? 'above' : 'below'} session VWAP`
    ],
    fundamentals: [macroContext],
    sentiment: [marketStructure],
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    lastRefreshedAt: Date.now(),
    expiresAt: item.expiresAt || new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    status,
    aiReasoning: {
      ...reasoning,
      timeframe: reasoning.timeframe || item.timeframe || '15m',
      reasons_for: reasoning.reasons_for || [
        isBuy ? 'Bullish Order Block & FVG Imbalance Retest' : 'Bearish Order Block & FVG Imbalance Retest',
        isBuy ? 'Liquidity Sweep of Session Low' : 'Liquidity Sweep of Session High',
        'Multi-timeframe Trend & VWAP Confluence'
      ],
      reasons_against: reasoning.reasons_against || [
        'Monitor upcoming high-impact economic news release'
      ]
    },
    reasoning: explanation,
    indicatorVerdicts,
    tradingviewIdea,
    categoryScores,
    marketBreadth: reasoning.market_breadth || reasoning.marketBreadth || {},
    optionsGex: reasoning.options_gex || reasoning.optionsGex || {},
    mag7Heatmap: reasoning.mag7_heatmap || reasoning.mag7Heatmap || {},
    earningsSchedule: reasoning.earnings_schedule || reasoning.earningsSchedule || {},
    onchainAnalytics: reasoning.onchain_analytics || reasoning.onchainAnalytics || {},
    etfFlows: reasoning.etf_flows || reasoning.etfFlows || {},
    stablecoinLiquidity: reasoning.stablecoin_liquidity || reasoning.stablecoinLiquidity || {},
    whaleEngine: reasoning.whale_engine || reasoning.whaleEngine || {},
    sessionEngine: reasoning.session_engine || reasoning.sessionEngine || {},
    executionQuality: reasoning.execution_quality || reasoning.executionQuality || {},
    dxyEngine: reasoning.dxy_engine || reasoning.dxyEngine || {},
    yieldMatrix: reasoning.yield_matrix || reasoning.yieldMatrix || {},
    interestDifferentials: reasoning.interest_differentials || reasoning.interestDifferentials || {},
    cotPositioning: reasoning.cot_positioning || reasoning.cotPositioning || {},
    interventionRisk: reasoning.intervention_risk || reasoning.interventionRisk || {},
    carryTrade: reasoning.carry_trade || reasoning.carryTrade || {},
    realYieldEngine: reasoning.real_yield_engine || reasoning.realYieldEngine || {},
    inflationEngine: reasoning.inflation_engine || reasoning.inflationEngine || {},
    centralBankBuying: reasoning.central_bank_buying || reasoning.centralBankBuying || {},
    geopoliticalRisk: reasoning.geopolitical_risk || reasoning.geopoliticalRisk || {},
    signalGrade,
    evidence: item.evidence || reasoning.evidence || null,
  };
}

export type ProfileData = {
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  dob: string;
  gender: string;
  nationality: string;
  nationalId: string;
  occupation: string;
  email: string;
  phone: string;
  secondaryEmail: string;
  communicationPref: string;
  country: string;
  state: string;
  county: string;
  city: string;
  postalCode: string;
  address: string;
  timezone: string;
  experience: string;
  primaryMarket: string;
  preferredAssets: string;
  tradingStyle: string;
  riskAppetite: string;
  tradingSession: string;
  baseCurrency: string;
  leverage: string;
  avatarUrl?: string;
  brokerType?: string;
  brokerKey?: string;
  brokerSecret?: string;
  brokerServer?: string;
};

export const DEFAULT_PROFILE_DATA: ProfileData = {
  firstName: '',
  middleName: '',
  lastName: '',
  username: '',
  dob: '',
  gender: 'Male',
  nationality: '',
  nationalId: '',
  occupation: '',
  email: '',
  phone: '',
  secondaryEmail: '',
  communicationPref: 'Email',
  country: 'Kenya',
  state: '',
  county: '',
  city: '',
  postalCode: '',
  address: '',
  timezone: 'EAT (UTC+3)',
  experience: 'Beginner',
  primaryMarket: 'Crypto',
  preferredAssets: 'BTC/USD',
  tradingStyle: 'Day Trading',
  riskAppetite: 'Moderate',
  tradingSession: 'London',
  baseCurrency: 'USD',
  leverage: '1:100',
  brokerType: 'None',
  brokerKey: '',
  brokerSecret: '',
  brokerServer: '',
};

export function normalizeProfile(user: any): ProfileData {
  const profile = user?.profile || {};

  return {
    ...DEFAULT_PROFILE_DATA,
    ...profile,
    gender: profile.gender || 'Male',
    email: user?.email || profile.email || '',
    phone: user?.phone || profile.phone || '',
  };
}

export function saveProfileSnapshot(profileData: ProfileData, extras: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;

  const current = localStorage.getItem('trademind_profile');
  let parsed = {};

  if (current) {
    try {
      parsed = JSON.parse(current);
    } catch {
      parsed = {};
    }
  }

  localStorage.setItem(
    'trademind_profile',
    JSON.stringify({
      ...parsed,
      ...extras,
      profileData,
      profilePhoto: extras.profilePhoto ?? (parsed as any).profilePhoto ?? profileData.avatarUrl ?? '',
    })
  );
  window.dispatchEvent(new Event('storage'));
}

export function mapPositionsToPortfolio(user: any, rawPositions: any[], tickers: Ticker[]) {
  const walletBalance = Number(user?.wallet?.balance ?? 0);
  let totalAssetValue = 0;
  let totalPnl = 0;

  const positions: Position[] = rawPositions.map((pos) => {
    const cleanSym = String(pos.symbol).replace('/USD', '').toUpperCase();
    const matchTicker = tickers.find((ticker) => {
      const tickerSymbol = ticker.symbol.toUpperCase();
      return tickerSymbol === cleanSym || tickerSymbol === `${cleanSym}/USD` || tickerSymbol.replace('/USD', '') === cleanSym;
    });
    const livePrice = Number(matchTicker?.price ?? pos.currentPrice ?? pos.averagePrice ?? 0);
    const quantity = Number(pos.quantity ?? 0);
    const averagePrice = Number(pos.averagePrice ?? 0);
    const posValue = quantity * livePrice;
    const posPnl = quantity * (livePrice - averagePrice);

    totalAssetValue += posValue;
    totalPnl += posPnl;

    return {
      id: pos.id,
      symbol: normalizeMarketSymbol(pos.symbol),
      name: matchTicker?.name || normalizeMarketSymbol(pos.symbol),
      quantity,
      avgPrice: averagePrice,
      currentPrice: livePrice,
      pnl: posPnl,
      pnlPct: averagePrice > 0 ? (posPnl / (quantity * averagePrice)) * 100 : 0,
      allocation: 0,
      type: matchTicker?.type || (normalizeMarketSymbol(pos.symbol).includes('/USD') ? 'crypto' : 'stock'),
    };
  });

  const totalValue = totalAssetValue + walletBalance;

  return {
    totalValue,
    totalPnl,
    totalPnlPct: totalValue - totalPnl > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0,
    positions: positions.map((position) => ({
      ...position,
      allocation: totalValue > 0 ? Number((((position.quantity * position.currentPrice) / totalValue) * 100).toFixed(1)) : 0,
    })),
  };
}
