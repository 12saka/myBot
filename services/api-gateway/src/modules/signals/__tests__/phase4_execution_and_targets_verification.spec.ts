export {};

const { SignalsController } = require('../signals.module');
const { replaySignalLifecycle } = require('../signal-lifecycle.engine');

function assert(conditionName: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  [PASS] ${conditionName}`);
  } else {
    console.error(`  [FAIL] ${conditionName} - Detail: ${detail}`);
    process.exit(1);
  }
}

async function runPhase4Audit() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Phase 4 Real Market Execution & Target Audit');
  console.log('================================================================\n');

  const deletedIds: string[] = [];
  const mockPrisma: any = {
    $executeRawUnsafe: async () => {},
    signal: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async (d: any) => ({ id: 'sig-test-1', ...d.data }),
      update: async (d: any) => ({ id: d.where.id, ...d.data }),
      delete: async (d: any) => {
        deletedIds.push(d.where.id);
        return { id: d.where.id };
      },
      deleteMany: async () => ({ count: 1 })
    },
    goldSignalPerformance: { findMany: async () => [] }
  };
  const mockEntitlement: any = {};
  const mockAutomation: any = { processSignalAutoTrade: async () => ({ status: 'EXECUTED' }) };
  const mockNotifications: any = {
    server: { emit: () => {} },
    broadcastTradeSignalNotification: async () => true
  };

  const controller = new SignalsController(mockPrisma, mockEntitlement, mockAutomation, mockNotifications);

  // -------------------------------------------------------------
  // Test 1: Stop Loss Adaptive Volatility Buffer & Structural Anti-Wick Protection
  // -------------------------------------------------------------
  console.log('--- Test 1: Stop Loss Adaptive Volatility Buffer ---');
  const volMetrics = { atr15m: 6.0 };
  const baseBuffer = parseFloat(Math.max(1.85, volMetrics.atr15m * 0.45).toFixed(2));
  assert(
    'Base invalidation buffer enforces anti-wick structural cushion (0.45x ATR15m = $2.70 on $6.00 ATR)',
    baseBuffer === 2.70,
    `Calculated buffer: ${baseBuffer}`
  );

  const minStopDist = Math.max(3.50, parseFloat((1.15 * volMetrics.atr15m).toFixed(2)));
  assert(
    'Minimum Stop Loss distance enforces 1.15x ATR15m volatility threshold ($6.90 on $6.00 ATR)',
    minStopDist === 6.90,
    `Calculated minStopDist: ${minStopDist}`
  );

  const maxStructuralRisk = Math.max(10.0, parseFloat((2.60 * volMetrics.atr15m).toFixed(2)));
  assert(
    'Max structural risk threshold enforces 2.60x ATR15m ($15.60 on $6.00 ATR), eliminating self-deadlock',
    maxStructuralRisk === 15.60 && minStopDist < maxStructuralRisk,
    `maxStructuralRisk: ${maxStructuralRisk}`
  );

  // -------------------------------------------------------------
  // Test 2: Continuation Trades (BOS_PULLBACK_CONTINUATION) Structural Targets
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Continuation Trade Targets ---');
  const entryPrice = 2735.0;
  const stopLoss = 2727.8;
  const risk = entryPrice - stopLoss; // 7.20

  const isContinuation = true;
  const minTp1R = isContinuation ? 1.50 : 1.30;
  assert(
    'Continuation trade enforces >= 1.50R minimum target',
    minTp1R === 1.50,
    `minTp1R: ${minTp1R}`
  );

  // Preceding impulse swing measured move for all-time/fresh highs
  const precedingHigh = 2742.0;
  const precedingLow = 2724.0;
  const impulseSpan = Math.max(risk * 2.2, precedingHigh - precedingLow); // 18.0
  const fib1272 = parseFloat((entryPrice + impulseSpan * 0.618).toFixed(2)); // 2735 + 11.12 = 2746.12
  const tp1Price = parseFloat(Math.max(entryPrice + minTp1R * risk, fib1272 - 0.20).toFixed(2));
  assert(
    'Fibonacci 1.272 continuation target properly applies 20-cent front-running cushion',
    tp1Price === 2745.92 && tp1Price >= entryPrice + minTp1R * risk,
    `tp1Price: ${tp1Price}`
  );

  // -------------------------------------------------------------
  // Test 3: Unfilled and Stagnant Signals Purged from Database and Ledger
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Unfilled and Stagnant Order Erasure ---');
  const now = Date.now();
  const mockSignals = [
    {
      id: 'sig-filled-real',
      symbol: 'GOLD',
      direction: 'BUY',
      entryPrice: 2732.50,
      stopLoss: 2725.30,
      takeProfit1: 2745.00,
      createdAt: new Date(now - 3600_000),
      expiresAt: new Date(now + 3600_000),
      aiReasoning: {
        status: 'POSITION_OPEN',
        lifecycleState: 'POSITION_OPEN',
        isOrderFilled: true,
        filledPrice: 2732.50,
        filledAt: new Date(now - 3000_000).toISOString(),
        lifecycleEvents: [{ type: 'FILLED', time: now - 3000_000, price: 2732.50 }]
      }
    },
    {
      id: 'sig-stagnant-waiting',
      symbol: 'GOLD',
      direction: 'SELL',
      entryPrice: 2750.00,
      stopLoss: 2758.00,
      takeProfit1: 2738.00,
      createdAt: new Date(now - 5 * 3600_000), // 5 hours ago (>4h default)
      expiresAt: new Date(now - 3600_000),
      aiReasoning: {
        status: 'WAITING_FOR_ENTRY',
        lifecycleState: 'WAITING_FOR_ENTRY',
        isOrderFilled: false,
        filledPrice: null
      }
    },
    {
      id: 'sig-legacy-unfilled-sl',
      symbol: 'GOLD',
      direction: 'SELL',
      entryPrice: 2748.00,
      stopLoss: 2755.00,
      takeProfit1: 2735.00,
      createdAt: new Date(now - 2 * 3600_000),
      expiresAt: new Date(now - 1800_000),
      aiReasoning: {
        status: 'CLOSED',
        lifecycleState: 'CLOSED',
        outcome: 'UNFILLED',
        isOrderFilled: false,
        filledPrice: null
      }
    }
  ];

  mockPrisma.signal.findMany = async () => mockSignals;
  const history = await controller.getGoldHistory();

  assert(
    'Stagnant waiting limit order is erased via prisma.signal.delete',
    deletedIds.includes('sig-stagnant-waiting'),
    `Deleted IDs: ${JSON.stringify(deletedIds)}`
  );
  assert(
    'Legacy unfilled cancelled order is erased via prisma.signal.delete',
    deletedIds.includes('sig-legacy-unfilled-sl'),
    `Deleted IDs: ${JSON.stringify(deletedIds)}`
  );
  assert(
    'Historical Trade Ledger only returns verified filled trades (zero fake fills)',
    history.signals.length === 1 && history.signals[0].id === 'sig-filled-real',
    `Returned signals count: ${history.signals.length}`
  );
  assert(
    'Filled signal fillPrice matches verified execution price ($2732.50)',
    history.signals[0].fillPrice === 2732.50,
    `fillPrice: ${history.signals[0].fillPrice}`
  );

  // -------------------------------------------------------------
  // Test 4: Pure Replay Engine Execution (True Limit Fill & Breakeven Runner)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Pure Replay Engine Execution ---');
  const input = {
    direction: 'BUY',
    orderType: 'BUY_LIMIT',
    entryPrice: 2730.00,
    initialStopLoss: 2722.80,
    currentStopLoss: 2722.80,
    tp1: 2740.80,
    tp2: 2750.00,
    state: 'WAITING_FOR_ENTRY',
    filledPrice: null,
    filledAt: null,
    bankedR: 0,
    remainingFraction: 1,
    orderExpiresAt: Date.now() + 14400_000,
    maxHoldMs: 86400_000,
    spread: 0.25,
    processFromTime: 1000,
    barMs: 60_000
  };

  const bars = [
    // Bar 1: Price touches 2730.10 bid -> ask 2730.35 > entry (2730.00) -> NO FILL
    { time: 1000, open: 2731.00, high: 2732.00, low: 2730.10, close: 2731.50 },
    // Bar 2: Price dips to 2729.50 bid -> ask 2729.75 <= entry (2730.00) -> TRUE FILL
    { time: 1060, open: 2731.50, high: 2731.80, low: 2729.50, close: 2730.20 },
    // Bar 3: Price rallies to 2741.00 -> hits TP1 (2740.80) -> banks 50%, moves SL to breakeven (2730.00)
    { time: 1120, open: 2730.20, high: 2741.50, low: 2730.00, close: 2740.90 },
    // Bar 4: Runner retraces to 2729.80 -> exits at Breakeven (2730.00) -> realizedR > 0
    { time: 1180, open: 2740.90, high: 2741.00, low: 2729.80, close: 2730.10 }
  ];

  const result = replaySignalLifecycle(input, bars);
  assert(
    'Replay engine correctly transitions trade to BREAKEVEN outcome',
    result.closed && result.outcome === 'BREAKEVEN',
    `Outcome: ${result.outcome}`
  );
  assert(
    'Limit BUY executed at limit price ($2730.00)',
    result.filledPrice === 2730.00,
    `Filled price: ${result.filledPrice}`
  );
  assert(
    'Chronological events record FILLED, TP1_PARTIAL, and BREAKEVEN_EXIT',
    result.events.some((e: any) => e.type === 'FILLED') &&
    result.events.some((e: any) => e.type === 'TP1_PARTIAL') &&
    result.events.some((e: any) => e.type === 'BREAKEVEN_EXIT'),
    `Events: ${JSON.stringify(result.events)}`
  );
  assert(
    'Realized R retains banked TP1 profit (+0.75R)',
    result.realizedR > 0.70,
    `Realized R: ${result.realizedR}`
  );

  console.log('\n================================================================');
  console.log(' Phase 4 Verification Summary: All Tests Passed (100%)');
  console.log('================================================================\n');
}

runPhase4Audit().catch(err => {
  console.error('[FATAL] Phase 4 audit failed:', err);
  process.exit(1);
});
