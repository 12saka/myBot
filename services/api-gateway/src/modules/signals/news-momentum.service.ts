import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type NewsCategory = 'TARIFFS' | 'GEOPOLITICAL' | 'MONETARY_POLICY' | 'MACRO_DATA' | 'TRADE_WAR';
export type NewsBias = 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL';
export type NewsStatus = 'ACTIVE' | 'PRICED_IN' | 'FADING' | 'REVERSED' | 'EXPIRED';
export type MonitoringWindowStage =
  | 'IMMEDIATE_SHOCK'         // 0–5 minutes
  | 'DIRECTIONAL_DISCOVERY'   // 5–30 minutes
  | 'INTERMARKET_ALIGNMENT'   // 30 min–2 hours
  | 'INSTITUTIONAL_HOLD'      // 2–6 hours
  | 'MULTI_DAY_REPRICING';    // > 6 hours

export interface NewsScoreBreakdown {
  newsImportance: number;          // 0-10
  goldRelevance: number;           // 0-10
  priceConfirmation: number;       // 0-10
  dxyConfirmation: number;         // 0-10
  yieldConfirmation: number;       // 0-10
  momentumPersistence: number;     // 0-10
}

export interface ActiveNewsMemoryItem {
  id: string;
  title: string;
  category: NewsCategory;
  source: string;
  detectedAt: string;
  eventTimeUtc?: string;
  expectedGoldBias: NewsBias;
  importanceScore: number;
  goldRelevance: number;
  initialGoldPrice: number;
  initialDxy: number;
  initialUs10y: number;
  persistenceScore: number; // 0-100
  status: NewsStatus;
  windowStage: MonitoringWindowStage;
  scoreBreakdown: NewsScoreBreakdown;
  priceConfirmation: number;
  dxyConfirmation: number;
  yieldConfirmation: number;
  momentumPersistence: number;
  decayHoursElapsed: number;
  halfLifeHours: number;
  lastEvaluatedAt: string;
  summary: string;
  reversalReason?: string;
  pricingInEvidence?: string;
}

export interface NewsPersistenceState {
  activeThemes: ActiveNewsMemoryItem[];
  topTheme: ActiveNewsMemoryItem | null;
  overallNewsScore: number;
  macroDriver: string;
  isReactionPersisting: boolean;
  isReactionWeakening: boolean;
  isMarketReversed: boolean;
  isPricedIn: boolean;
  windowStage: MonitoringWindowStage;
  recommendedAction: 'AMPLIFY_FLOW' | 'STAND_ASIDE' | 'FADE_FAILED_HEADLINE' | 'NEUTRAL';
}

export interface IntermarketSnapshot {
  dxy: number;
  dxyChange1h: number;
  dxyMomentum?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  us10y: number;
  us10yChange1h: number;
  us10yMomentum?: 'RISING' | 'FALLING' | 'NEUTRAL';
}

@Injectable()
export class NewsMomentumService {
  private readonly logger = new Logger(NewsMomentumService.name);
  private readonly diskCachePath = path.join(process.cwd(), '.cache', 'news_event_memory.json');
  private activeNewsMemory: ActiveNewsMemoryItem[] = [];
  private lastIngestTime: number = 0;

  constructor() {
    this.loadFromDisk();
  }

  public getActiveMemory(): ActiveNewsMemoryItem[] {
    return [...this.activeNewsMemory];
  }

  public getLastIngestTime(): number {
    return this.lastIngestTime;
  }

  public shouldIngestNews(minIntervalMs = 15 * 60 * 1000): boolean {
    return (Date.now() - this.lastIngestTime) >= minIntervalMs;
  }

  public markIngestAttempt(): void {
    this.lastIngestTime = Date.now();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.diskCachePath)) {
        const raw = fs.readFileSync(this.diskCachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.activeNewsMemory)) {
          this.activeNewsMemory = parsed.activeNewsMemory;
          this.logger.log(`[NewsMomentumService] Loaded ${this.activeNewsMemory.length} persistent news catalyst(s) from disk cache.`);
        }
      }
    } catch (e: any) {
      this.logger.warn(`[NewsMomentumService] Disk load notice: ${e.message}`);
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(this.diskCachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.diskCachePath, JSON.stringify({
        timestamp: Date.now(),
        activeNewsMemory: this.activeNewsMemory
      }, null, 2), 'utf8');
    } catch (e: any) {
      this.logger.warn(`[NewsMomentumService] Disk write notice: ${e.message}`);
    }
  }

  /**
   * Evaluates headline text to classify category, expected gold bias, importance, and relevance.
   */
  public classifyHeadline(headline: string, summary: string = ''): {
    matchedCategory: NewsCategory | null;
    expectedGoldBias: NewsBias;
    importanceScore: number;
    goldRelevance: number;
  } {
    const text = `${headline} ${summary}`.toLowerCase();
    let matchedCategory: NewsCategory | null = null;
    let expectedGoldBias: NewsBias = 'NEUTRAL';
    let importanceScore = 5;
    let goldRelevance = 5;

    // 1. Tariffs & Trade War (Trump announcements, tariffs, trade protectionism)
    if (text.includes('tariff') || text.includes('trade war') || text.includes('trade barriers') || text.includes('import dut') || text.includes('protectionism')) {
      matchedCategory = text.includes('trade war') ? 'TRADE_WAR' : 'TARIFFS';
      expectedGoldBias = 'BULLISH'; // Inflationary friction & safe-haven hedging
      importanceScore = text.includes('trump') || text.includes('white house') || text.includes('across the board') ? 9 : 8;
      goldRelevance = 9;
    }
    // 2. Geopolitical Escalation (Military action, missile strikes, Middle East, Taiwan, war)
    else if (text.includes('military strike') || text.includes('missile') || text.includes('invasion') || text.includes('escalation') || text.includes('nuclear') || text.includes('ceasefire collapse')) {
      matchedCategory = 'GEOPOLITICAL';
      expectedGoldBias = 'BULLISH'; // Flight to quality
      importanceScore = 9;
      goldRelevance = 9;
    }
    // 3. Monetary Policy & Central Banks (Fed, Powell, interest rate cuts/hikes)
    else if (text.includes('fed cut') || text.includes('rate cut') || text.includes('rate reduction') || text.includes('dovish fed')) {
      matchedCategory = 'MONETARY_POLICY';
      expectedGoldBias = 'BULLISH';
      importanceScore = 8;
      goldRelevance = 9;
    } else if (text.includes('fed hike') || text.includes('rate hike') || text.includes('hawkish fed') || text.includes('higher for longer')) {
      matchedCategory = 'MONETARY_POLICY';
      expectedGoldBias = 'BEARISH';
      importanceScore = 8;
      goldRelevance = 9;
    }
    // 4. Macro Surprises (CPI, Inflation, NFP shocks)
    else if (text.includes('inflation surge') || text.includes('cpi jump') || text.includes('inflation spike')) {
      matchedCategory = 'MACRO_DATA';
      expectedGoldBias = 'BULLISH'; // Gold as ultimate inflation hedge
      importanceScore = 8;
      goldRelevance = 8;
    }

    return { matchedCategory, expectedGoldBias, importanceScore, goldRelevance };
  }

  /**
   * Ingests external news articles, parses for influential catalysts, and seeds the memory pool.
   * Strictly requires live spotPrice > 0 (zero dummy fallback prices).
   */
  public ingestArticles(
    articles: Array<{ id?: string | number; headline?: string; summary?: string; source?: string; datetime?: number }>,
    spotPrice: number,
    dxy: number,
    us10y: number
  ): number {
    this.lastIngestTime = Date.now();
    if (!(spotPrice > 0)) {
      this.logger.warn('[NewsMomentumService] Skipped headline ingestion because live Gold spotPrice is unavailable (no dummy prices allowed).');
      return 0;
    }
    let ingestedCount = 0;

    for (const item of articles.slice(0, 30)) {
      if (!item.headline) continue;
      const { matchedCategory, expectedGoldBias, importanceScore, goldRelevance } = this.classifyHeadline(item.headline, item.summary);

      if (matchedCategory) {
        const headlineId = `news_${item.id || Buffer.from(item.headline).toString('base64').slice(0, 16)}`;
        const existing = this.activeNewsMemory.find(n => n.id === headlineId || n.title.toLowerCase() === item.headline!.toLowerCase());

        if (!existing) {
          const halfLifeHours = this.getCategoryHalfLifeHours(matchedCategory);
          const detectedAt = new Date(item.datetime ? item.datetime * 1000 : Date.now()).toISOString();

          const scoreBreakdown: NewsScoreBreakdown = {
            newsImportance: importanceScore,
            goldRelevance,
            priceConfirmation: 6.0,
            dxyConfirmation: 6.0,
            yieldConfirmation: 6.0,
            momentumPersistence: 6.0
          };

          const newItem: ActiveNewsMemoryItem = {
            id: headlineId,
            title: item.headline,
            category: matchedCategory,
            source: item.source || 'FINNHUB',
            detectedAt,
            eventTimeUtc: detectedAt,
            expectedGoldBias,
            importanceScore,
            goldRelevance,
            initialGoldPrice: spotPrice,
            initialDxy: dxy > 0 ? dxy : 0,
            initialUs10y: us10y > 0 ? us10y : 0,
            persistenceScore: 82,
            status: 'ACTIVE',
            windowStage: 'IMMEDIATE_SHOCK',
            scoreBreakdown,
            priceConfirmation: 6.0,
            dxyConfirmation: 6.0,
            yieldConfirmation: 6.0,
            momentumPersistence: 6.0,
            decayHoursElapsed: 0,
            halfLifeHours,
            lastEvaluatedAt: new Date().toISOString(),
            summary: (item.summary || item.headline).slice(0, 280)
          };

          this.activeNewsMemory.push(newItem);
          ingestedCount++;
          this.logger.log(`[NewsMomentumService] Ingested influential catalyst: "${newItem.title}" (${newItem.category}, Bias: ${newItem.expectedGoldBias}, Spot: $${spotPrice.toFixed(2)})`);
        }
      }
    }

    if (ingestedCount > 0) {
      this.saveToDisk();
    }
    return ingestedCount;
  }

  private getCategoryHalfLifeHours(category: NewsCategory): number {
    switch (category) {
      case 'TARIFFS':
      case 'TRADE_WAR':
        return 120; // 5 days persistence
      case 'GEOPOLITICAL':
        return 96;  // 4 days persistence
      case 'MONETARY_POLICY':
        return 48;  // 2 days persistence
      case 'MACRO_DATA':
        return 24;  // 1 day persistence
      default:
        return 48;
    }
  }

  /**
   * Core News Momentum & Persistence Evaluation Engine
   * Calculates the 6-dimension dynamic score, tracks the 5-phase chronological monitoring schedule,
   * handles half-life time decay, and detects failed headline traps / market reversals.
   */
  public evaluatePersistence(
    currentPrice: number,
    intermarket: IntermarketSnapshot
  ): NewsPersistenceState {
    const now = Date.now();

    for (const item of this.activeNewsMemory) {
      const elapsedMs = Math.max(1000, now - new Date(item.detectedAt).getTime());
      const elapsedMinutes = elapsedMs / 60000;
      const elapsedHours = Math.max(0.01, elapsedMs / (3600 * 1000));
      item.decayHoursElapsed = parseFloat(elapsedHours.toFixed(1));

      // 1. Chronological Monitoring Window Stage
      let windowStage: MonitoringWindowStage = 'IMMEDIATE_SHOCK';
      if (elapsedMinutes <= 5) {
        windowStage = 'IMMEDIATE_SHOCK';
      } else if (elapsedMinutes <= 30) {
        windowStage = 'DIRECTIONAL_DISCOVERY';
      } else if (elapsedMinutes <= 120) {
        windowStage = 'INTERMARKET_ALIGNMENT';
      } else if (elapsedMinutes <= 360) {
        windowStage = 'INSTITUTIONAL_HOLD';
      } else {
        windowStage = 'MULTI_DAY_REPRICING';
      }
      item.windowStage = windowStage;

      // 2. Exponential half-life decay factor (floor at 0.15 for long-tail structural repricing)
      const halfLife = item.halfLifeHours || this.getCategoryHalfLifeHours(item.category);
      const timeDecayFactor = Math.max(0.15, Math.exp(-0.693 * (elapsedHours / halfLife)));

      // 3. Price Confirmation Dimension (0 - 10)
      if (currentPrice > 0 && (item.initialGoldPrice <= 0 || Math.abs(currentPrice - item.initialGoldPrice) > 500)) {
        item.initialGoldPrice = currentPrice;
      }
      const priceDiff = currentPrice > 0 && item.initialGoldPrice > 0 ? (currentPrice - item.initialGoldPrice) : 0;
      let priceConf = 5.0;
      if (item.expectedGoldBias === 'BULLISH') {
        if (priceDiff >= 15) priceConf = 10.0;
        else if (priceDiff >= 8) priceConf = 8.5;
        else if (priceDiff >= 2) priceConf = 7.0;
        else if (priceDiff >= -3) priceConf = 5.0;
        else if (priceDiff >= -10) priceConf = 3.0;
        else priceConf = 1.0; // Market sold off heavily against bullish news
      } else if (item.expectedGoldBias === 'BEARISH') {
        if (priceDiff <= -15) priceConf = 10.0;
        else if (priceDiff <= -8) priceConf = 8.5;
        else if (priceDiff <= -2) priceConf = 7.0;
        else if (priceDiff <= 3) priceConf = 5.0;
        else if (priceDiff <= 10) priceConf = 3.0;
        else priceConf = 1.0;
      }
      item.priceConfirmation = priceConf;

      // 4. DXY Inverse Confirmation Dimension (0 - 10)
      let dxyConf = 5.0;
      if (item.expectedGoldBias === 'BULLISH') {
        if (intermarket.dxyMomentum === 'BEARISH' || intermarket.dxyChange1h <= -0.10) dxyConf = 9.0;
        else if (intermarket.dxyMomentum === 'NEUTRAL') dxyConf = 5.5;
        else dxyConf = 2.0; // Rising dollar dampening gold buying
      } else if (item.expectedGoldBias === 'BEARISH') {
        if (intermarket.dxyMomentum === 'BULLISH' || intermarket.dxyChange1h >= 0.10) dxyConf = 9.0;
        else if (intermarket.dxyMomentum === 'NEUTRAL') dxyConf = 5.5;
        else dxyConf = 2.0;
      }
      item.dxyConfirmation = dxyConf;

      // 5. Yield Confirmation Dimension (0 - 10)
      let yConf = 5.0;
      if (item.expectedGoldBias === 'BULLISH') {
        if (intermarket.us10yMomentum === 'FALLING' || intermarket.us10yChange1h <= -0.10) yConf = 8.5;
        else if (intermarket.us10yMomentum === 'NEUTRAL') yConf = 5.5;
        else yConf = 2.5; // Surging yields opposing gold rally
      } else if (item.expectedGoldBias === 'BEARISH') {
        if (intermarket.us10yMomentum === 'RISING' || intermarket.us10yChange1h >= 0.10) yConf = 8.5;
        else if (intermarket.us10yMomentum === 'NEUTRAL') yConf = 5.5;
        else yConf = 2.5;
      }
      item.yieldConfirmation = yConf;

      // 6. Institutional Momentum Persistence Dimension (0 - 10)
      const momConf = parseFloat(((priceConf * 0.6) + (dxyConf * 0.4)).toFixed(1));
      item.momentumPersistence = momConf;

      // Update Breakdown
      item.scoreBreakdown = {
        newsImportance: item.importanceScore,
        goldRelevance: item.goldRelevance,
        priceConfirmation: priceConf,
        dxyConfirmation: dxyConf,
        yieldConfirmation: yConf,
        momentumPersistence: momConf
      };

      // Composite Persistence Score Calculation (0 - 100)
      const rawComposite = (
        (item.importanceScore * 2.0) +
        (item.goldRelevance * 2.0) +
        (priceConf * 2.5) +
        (dxyConf * 1.5) +
        (yConf * 1.0) +
        (momConf * 1.0)
      );
      item.persistenceScore = Math.max(0, Math.min(100, Math.round(rawComposite * timeDecayFactor)));

      // Dynamic State Transitions
      if (elapsedHours >= 1.0 && priceConf <= 2.5 && (dxyConf <= 3.5 || yConf <= 3.5)) {
        item.status = 'REVERSED'; // Market completely faded initial headline impulse (trap/fakeout identified)
        item.reversalReason = `Price rejected initial announcement ($${item.initialGoldPrice.toFixed(2)}) by ${Math.abs(priceDiff).toFixed(2)} pts with opposing yields/DXY. Market faded the news.`;
      } else if (elapsedHours >= 4.0 && priceConf >= 7.0 && elapsedHours > halfLife * 0.65) {
        item.status = 'PRICED_IN';
        item.pricingInEvidence = `Headline impulse fully reflected in price (+${priceDiff.toFixed(2)} pts). Momentum leveling off into baseline.`;
      } else if (item.persistenceScore < 30 || elapsedHours > halfLife * 1.5) {
        item.status = 'FADING';
      } else if (elapsedHours > 7 * 24) {
        item.status = 'EXPIRED';
      } else {
        item.status = 'ACTIVE';
      }

      item.lastEvaluatedAt = new Date().toISOString();
    }

    // Retain relevant themes up to 7 days; prune expired ones
    this.activeNewsMemory = this.activeNewsMemory.filter(item => {
      const ageHours = (now - new Date(item.detectedAt).getTime()) / (3600 * 1000);
      return ageHours <= 7 * 24 && item.status !== 'EXPIRED';
    });

    this.saveToDisk();

    const activeThemes = this.activeNewsMemory.filter(i => i.status === 'ACTIVE' || i.status === 'REVERSED' || i.status === 'PRICED_IN');
    const sorted = [...activeThemes].sort((a, b) => b.persistenceScore - a.persistenceScore);
    const topTheme = sorted[0] || null;

    const isReactionPersisting = Boolean(topTheme && topTheme.status === 'ACTIVE' && topTheme.persistenceScore >= 55);
    const isReactionWeakening = Boolean(topTheme && (topTheme.status === 'FADING' || (topTheme.status === 'ACTIVE' && topTheme.persistenceScore < 50)));
    const isMarketReversed = Boolean(topTheme && topTheme.status === 'REVERSED');
    const isPricedIn = Boolean(topTheme && topTheme.status === 'PRICED_IN');

    let recommendedAction: NewsPersistenceState['recommendedAction'] = 'NEUTRAL';
    if (isMarketReversed) {
      recommendedAction = 'FADE_FAILED_HEADLINE';
    } else if (isReactionPersisting) {
      recommendedAction = 'AMPLIFY_FLOW';
    } else if (isPricedIn || isReactionWeakening) {
      recommendedAction = 'STAND_ASIDE';
    }

    return {
      activeThemes: this.activeNewsMemory,
      topTheme,
      overallNewsScore: topTheme ? topTheme.persistenceScore : 50,
      macroDriver: topTheme
        ? `${topTheme.title} [${topTheme.status}: ${topTheme.persistenceScore}% | ${topTheme.windowStage}]`
        : 'Macro Equilibrium',
      isReactionPersisting,
      isReactionWeakening,
      isMarketReversed,
      isPricedIn,
      windowStage: topTheme?.windowStage || 'MULTI_DAY_REPRICING',
      recommendedAction
    };
  }
}
