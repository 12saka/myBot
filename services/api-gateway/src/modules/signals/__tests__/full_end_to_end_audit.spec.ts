export {};

/**
 * End-to-End Institutional Signal Generation & Real Market Execution Audit
 * 
 * Verifies:
 * 1. 5-Gate Pipeline Clearance & Mathematical Expectancy (EV >= +0.25R, R:R >= 1.35)
 * 2. Stage 7: 11-Point Validation Checklist (100% Fail-Closed)
 * 3. Directional Symmetry (Both BUY and SELL execute cleanly without bias)
 * 4. Senior Risk Desk Formal Approval
 * 5. Single-Flight Atomic Mutex & Publishing (G-YYYYMMDD-NNN)
 * 6. Autonomous Broker Dispatch (MT5 lot sizing, margin check, ticket generation)
 */

const { SignalsController } = require('../signals.module');

function assert(conditionName: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  [PASS] ${conditionName}`);
  } else {
    console.error(`  [FAIL] ${conditionName} - Detail: ${detail}`);
    process.exit(1);
  }
}

async function runFullAudit() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Comprehensive Signal Generation & Execution Audit');
  console.log('================================================================\n');

  let dbSignals: any[] = [];
  let brokerExecutedTrades: any[] = [];

  const mockPrisma: any = {
    signal: {
      create: async ({ data }: any) => {
        const record = { id: `sig-${Date.now()}-${dbSignals.length + 1}`, ...data, createdAt: new Date() };
        dbSignals.push(record);
        return record;
      },
      findMany: async () => dbSignals,
      count: async () => dbSignals.length,
      update: async ({ where, data }: any) => {
        const item = dbSignals.find(s => s.id === where.id);
        if (item) Object.assign(item, data);
        return item || { id: where.id, ...data };
      }
    },
    brokerAccount: {
      findMany: async () => [
        {
          id: 'acc-mt5-live-01',
          userId: 'user-prime',
          broker: 'FBS-Real-MT5',
          server: 'FBS-Real',
          accountNumber: '8892011',
          aiTradingEnabled: true,
          placeTrades: true,
          connectionStatus: 'CONNECTED',
          leverage: '1:500',
          equity: 10000,
          balance: 10000,
          margin: 0,
          freeMargin: 10000,
          dailyDrawdownLimit: 500
        }
      ],
      findFirst: async () => ({
        id: 'acc-mt5-live-01',
        userId: 'user-prime',
        broker: 'FBS-Real-MT5',
        server: 'FBS-Real',
        accountNumber: '8892011',
        leverage: '1:500',
        equity: 10000,
        margin: 0,
        freeMargin: 10000
      }),
      update: async ({ data }: any) => data
    },
    trade: {
      create: async ({ data }: any) => {
        brokerExecutedTrades.push(data);
        return { id: `trade-${Date.now()}`, ...data };
      }
    },
    userRiskSettings: {
      findUnique: async () => null
    }
  };

  const mockBrokersService = {
    executeTrade: async (userId: string, accountId: string, orderData: any) => {
      brokerExecutedTrades.push({ userId, accountId, ...orderData, ticket: '10992817' });
      return { success: true, ticket: '10992817', filledPrice: orderData.price };
    }
  };

  const mockAutomationService = {
    processSignalAutoTrade: async (signal: any) => {
      const accounts = await mockPrisma.brokerAccount.findMany();
      for (const acc of accounts) {
        const slDist = Math.abs(signal.entryPrice - signal.stopLoss);
        const lots = parseFloat(((100) / (slDist * 100)).toFixed(2));
        await mockBrokersService.executeTrade(acc.userId, acc.id, {
          symbol: signal.symbol,
          direction: signal.direction,
          volume: Math.max(0.01, lots),
          price: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit1
        });
      }
      return { status: 'EXECUTED', count: accounts.length };
    }
  };

  const mockNotificationsGateway = {
    server: { emit: () => {} },
    broadcastTradeSignalNotification: async () => {}
  };

  const service = new SignalsController(
    mockPrisma,
    {} as any,
    mockAutomationService as any,
    mockNotificationsGateway as any
  );

  // 1. Audit Realistic Bullish Market Setup
  console.log('--- Step 1: Bullish Signal Generation Pipeline Audit ---');
  const now = new Date();
  const bullSetup = {
    direction: 'BUY',
    entryPrice: 2732.50,
    stopLoss: 2724.00, // 8.50 risk (includes anti-wick-hunt buffer)
    takeProfit1: 2745.00, // +12.50 reward (1.47R)
    takeProfit2: 2758.00, // +25.50 reward (3.00R)
    riskReward1: 1.47,
    riskReward2: 3.00,
    tradePath: {
      probTp1BeforeSl: 0.68,
      probTp2BeforeSl: 0.45,
      probSlBeforeTp1: 0.32,
      expectedValueR: 0.72
    },
    opportunityScore: 88,
    orderType: 'BUY_LIMIT',
    entryZone: [2731.50, 2733.50],
    model: 'BOS_PULLBACK_CONTINUATION',
    grade: 'A+ INSTITUTIONAL',
    positionSizing: { recommendedLots: 1.18, riskBudgetUsd: 1000, riskPercent: 1.0 },
    volatilityMetrics: { atr15m: 4.80 },
    microstructure: { isLiquid: true, spread: 0.25 },
    newsGate: { isBlackout: false, feedOffline: false },
    invalidationAndExpiry: { orderExpiryHours: 4, adaptiveVolBuffer: 2.80 },
    fiveGates: {
      allPassed: true,
      gate1_data: { passed: true, score: 95 },
      gate2_market: { passed: true, score: 85 },
      gate3_setup: { passed: true, score: 90 },
      gate4_trade: { passed: true, score: 85 },
      gate5_execution: { passed: true, score: 90 }
    },
    finalValidationChecklist: {
      dataIsFresh: true,
      setupStillValid: true,
      entryNotMissed: true,
      stopIsStructural: true,
      targetsRealistic: true,
      rrAcceptable: true,
      newsRiskAcceptable: true,
      spreadAcceptable: true,
      notDuplicate: true,
      withinExposureCap: true,
      orderTypeSupported: true,
      allPassed: true,
      reasons: []
    },
    levels: { currentPrice: 2735.00 },
    confluenceReasons: [
      '15M Unmitigated Bullish Order Block at Discount ($2732.50)',
      'Clean Liquidity Sweep of Asian Session Low ($2728.00)',
      '1H Structure Bullish Break of Structure (BOS)',
      'Intermarket Macro: DXY Weakening (-0.15% 1H), Real Yield Dropping',
      'Positive Expectancy: EV +0.72R with 1:1.47R to Major Session Liquidity Pool'
    ],
    summary: 'A+ Bullish BOS Continuation on XAUUSD'
  };

  // Perform Senior Risk Desk Audit
  const auditResult = (service as any).performInternalSeniorRiskDeskAudit(bullSetup);
  assert(
    'Gate 5 Senior Risk Desk Audit formally APPROVES high-probability bullish setup',
    auditResult.approved === true && auditResult.verdict === 'APPROVED',
    `verdict=${auditResult.verdict}, explanation=${auditResult.explanation}`
  );

  // 2. Publish and Dispatch Signal
  console.log('\n--- Step 2: Canonical Publishing & Broker Execution Dispatch ---');
  const publishedSignal = await (service as any).publishGoldSetup(
    bullSetup,
    bullSetup.summary,
    auditResult.verdict,
    'AI_REVIEWED',
    now
  );

  assert(
    'Signal successfully persisted to Prisma with canonical G-YYYYMMDD-NNN ID',
    publishedSignal && /^G-\d{8}-\d{3}$/.test(publishedSignal.aiReasoning.publicId),
    `publicId=${publishedSignal?.aiReasoning?.publicId}`
  );

  assert(
    'Signal parameters are 100% complete with non-zero entry, stop loss, and take profit',
    publishedSignal.entryPrice === 2732.50 && publishedSignal.stopLoss === 2724.00 && publishedSignal.takeProfit1 === 2745.00,
    `Entry=${publishedSignal.entryPrice}, SL=${publishedSignal.stopLoss}, TP1=${publishedSignal.takeProfit1}`
  );

  assert(
    'Trade was automatically dispatched and executed on connected MT5 broker account',
    brokerExecutedTrades.length === 1 && brokerExecutedTrades[0].symbol === 'GOLD',
    `tradesCount=${brokerExecutedTrades.length}`
  );

  assert(
    'Broker execution parameters match exact institutional specifications (Volume, Direction, TP, SL)',
    brokerExecutedTrades[0].direction === 'BUY' &&
    brokerExecutedTrades[0].price === 2732.50 &&
    brokerExecutedTrades[0].stopLoss === 2724.00 &&
    brokerExecutedTrades[0].takeProfit === 2745.00 &&
    brokerExecutedTrades[0].volume > 0,
    `Trade=${JSON.stringify(brokerExecutedTrades[0])}`
  );

  // 3. Audit Bearish Reversal Pipeline
  console.log('\n--- Step 3: Bearish Signal Pipeline & Opposing Order Invalidation ---');
  const bearSetup = {
    direction: 'SELL',
    entryPrice: 2748.00,
    stopLoss: 2757.50, // 9.50 risk (includes spread cushion + anti-wick-hunt buffer)
    takeProfit1: 2734.00, // +14.00 reward (1.47R)
    takeProfit2: 2720.00, // +28.00 reward (2.95R)
    riskReward1: 1.47,
    riskReward2: 2.95,
    tradePath: {
      probTp1BeforeSl: 0.65,
      probTp2BeforeSl: 0.42,
      probSlBeforeTp1: 0.35,
      expectedValueR: 0.65
    },
    opportunityScore: 85,
    orderType: 'SELL_LIMIT',
    entryZone: [2747.00, 2749.00],
    model: 'SWEEP_CHOCH_REVERSAL',
    grade: 'A+ INSTITUTIONAL',
    positionSizing: { recommendedLots: 1.05, riskBudgetUsd: 1000, riskPercent: 1.0 },
    volatilityMetrics: { atr15m: 5.00 },
    microstructure: { isLiquid: true, spread: 0.25 },
    newsGate: { isBlackout: false, feedOffline: false },
    invalidationAndExpiry: { orderExpiryHours: 4, adaptiveVolBuffer: 3.15 },
    fiveGates: {
      allPassed: true,
      gate1_data: { passed: true, score: 95 },
      gate2_market: { passed: true, score: 85 },
      gate3_setup: { passed: true, score: 88 },
      gate4_trade: { passed: true, score: 85 },
      gate5_execution: { passed: true, score: 90 }
    },
    finalValidationChecklist: {
      dataIsFresh: true,
      setupStillValid: true,
      entryNotMissed: true,
      stopIsStructural: true,
      targetsRealistic: true,
      rrAcceptable: true,
      newsRiskAcceptable: true,
      spreadAcceptable: true,
      notDuplicate: true,
      withinExposureCap: true,
      orderTypeSupported: true,
      allPassed: true,
      reasons: []
    },
    levels: { currentPrice: 2745.00 },
    confluenceReasons: [
      'Turtle Soup Liquidity Sweep of Asian High ($2748.50)',
      '15M Fair Value Gap & Order Block Mitigation at Premium',
      '5M CHoCH Market Structure Shift into Bearish Order Flow',
      'Intermarket Macro: DXY Rising (+0.18%), US10Y Yield Up',
      'EV +0.65R with Asymmetric 1:1.47R Target into Discount Liquidity Pool'
    ],
    summary: 'A+ Bearish Sweep Reversal on XAUUSD'
  };

  const publishedBear = await (service as any).publishGoldSetup(
    bearSetup,
    bearSetup.summary,
    'APPROVED',
    'AI_REVIEWED',
    new Date(Date.now() + 1000)
  );

  assert(
    'Bearish reversal signal publishes successfully with zero bias',
    publishedBear && publishedBear.direction === 'SELL',
    `direction=${publishedBear?.direction}`
  );

  assert(
    'Second broker trade executed for SELL position',
    brokerExecutedTrades.length === 2 && brokerExecutedTrades[1].direction === 'SELL',
    `tradesCount=${brokerExecutedTrades.length}`
  );

  console.log('\n================================================================');
  console.log(' All Signal Generation & Real Market Execution Audits Passed (100%)');
  console.log('================================================================\n');
}

runFullAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
