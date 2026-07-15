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
  const upper = symbol.toUpperCase();
  return ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(upper) ? `${upper}/USD` : upper;
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
  const upper = normalized.toUpperCase().replace('/USD', '').trim();
  if (['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(upper)) return 'crypto';
  if (['EUR/USD', 'GBP/USD', 'USD/JPY'].includes(normalized)) return 'forex';
  if (['US30', 'US100', 'SPX500', 'DAX40'].includes(upper)) return 'indices';
  if (['GOLD', 'OIL'].includes(upper)) return 'commodities';
  return 'stocks';
};

export function mapSignal(item: any): AISignal {
  const reasoning = item.aiReasoning || {};
  const indicators = Array.isArray(reasoning.indicators) ? reasoning.indicators : [];
  const confidence = Number(item.winProbability ?? item.confidence ?? 0);

  return {
    id: item.id,
    symbol: normalizeMarketSymbol(item.symbol || ''),
    type: getSignalType(item.symbol || ''),
    direction: item.direction,
    confidence,
    entry: Number(item.entryPrice ?? item.entry ?? 0),
    stopLoss: Number(item.stopLoss ?? item.stop_loss ?? 0),
    tp1: Number(item.takeProfit1 ?? item.tp1 ?? item.take_profit_1 ?? 0),
    tp2: Number(item.takeProfit2 ?? item.tp2 ?? item.take_profit_2 ?? 0),
    riskReward: `1:${Number(item.riskRewardRatio ?? 0).toFixed(1)}`,
    probability: `${confidence}%`,
    duration: item.durationEstimate || '4h',
    strategy: item.strategy || 'Gateway AI Signal',
    technicals: indicators.length ? indicators : [reasoning.explanation || 'AI service generated this opportunity from current market context.'],
    fundamentals: ['Live fundamentals feed pending provider connection.'],
    sentiment: [reasoning.explanation || 'Sentiment summary unavailable.'],
    createdAt: item.createdAt || new Date().toISOString(),
    expiresAt: item.expiresAt || new Date().toISOString(),
    aiReasoning: item.aiReasoning,
    reasoning: reasoning.explanation || reasoning.analysis || reasoning.idea || item.reasoning || '',
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
};

export const DEFAULT_PROFILE_DATA: ProfileData = {
  firstName: '',
  middleName: '',
  lastName: '',
  username: '',
  dob: '',
  gender: '',
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
};

export function normalizeProfile(user: any): ProfileData {
  const profile = user?.profile || {};

  return {
    ...DEFAULT_PROFILE_DATA,
    ...profile,
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
