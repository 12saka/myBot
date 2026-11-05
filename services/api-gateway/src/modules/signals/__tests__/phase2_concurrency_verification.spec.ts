/**
 * Phase 2 Verification Test:
 * 1. Single-Flight Concurrency Mutex (Coalescing parallel triggers into a single scan)
 * 2. Database 15-Minute Idempotency Barrier (Suppressing twin signals)
 * 3. Unified Signal Publishing & Canonical Audit Trail
 * 4. Opposing Signal Invalidation
 */

export {};
const { SignalsController } = require('../signals.module');

function assert(conditionName: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  [PASS] ${conditionName}`);
  } else {
    console.error(`  [FAIL] ${conditionName} - Detail: ${detail}`);
    process.exit(1);
  }
}

async function runPhase2Tests() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Phase 2 Concurrency & Single-Flight Mutex Tests');
  console.log('================================================================\n');

  let createCallsCount = 0;
  const createdRecords: any[] = [];
  const dbRecords: any[] = [];

  const mockPrisma = {
    signal: {
      create: async ({ data }: any) => {
        createCallsCount++;
        const record = { id: `mock-sig-${createCallsCount}`, ...data, createdAt: new Date() };
        createdRecords.push(record);
        dbRecords.push(record);
        return record;
      },
      findMany: async ({ where }: any) => {
        if (where?.direction?.in) {
          return dbRecords.filter(r => where.direction.in.includes(r.direction));
        }
        if (where?.direction && where?.createdAt?.gte) {
          return dbRecords.filter(r => r.direction === where.direction && r.createdAt >= where.createdAt.gte);
        }
        return dbRecords;
      },
      count: async () => dbRecords.length,
      update: async ({ where, data }: any) => {
        const item = dbRecords.find(r => r.id === where.id);
        if (item) {
          Object.assign(item, data);
          return item;
        }
        return { id: where.id, ...data };
      }
    }
  };

  const mockNotificationsGateway = {
    server: {
      emit: () => {}
    },
    broadcastTradeSignalNotification: async () => {}
  };

  const service = new SignalsController(
    mockPrisma as any,
    {} as any,
    {} as any,
    mockNotificationsGateway as any
  );

  // 1. Single-Flight Concurrency Mutex Test
  console.log('--- Test 1: Atomic Single-Flight Coalescing (5 Concurrent Triggers) ---');
  let computeCount = 0;
  (service as any).executeGoldScan = async (opts?: any) => {
    computeCount++;
    // Simulate async network/compute latency (50ms)
    await new Promise(r => setTimeout(r, 50));
    return { id: `scan-result-${computeCount}`, success: true };
  };

  // Fire 5 simultaneous scan requests
  const triggers = [
    service.runAtomicGoldScan(),
    service.runAtomicGoldScan(),
    service.runAtomicGoldScan(),
    service.runAtomicGoldScan(),
    service.runAtomicGoldScan()
  ];

  const results = await Promise.all(triggers);

  assert(
    'All 5 concurrent triggers coalesced into a single execution',
    computeCount === 1,
    `computeCount=${computeCount} (expected 1)`
  );

  assert(
    'All 5 callers received identical scan result object',
    results.every(r => r.id === 'scan-result-1'),
    `results=${JSON.stringify(results)}`
  );

  // 2. Sequential scan runs cleanly after mutex release
  console.log('\n--- Test 2: Mutex Lifecycle Release ---');
  const sequentialResult = await service.runAtomicGoldScan();
  assert(
    'Second scan executes independently after initial promise completes',
    computeCount === 2 && sequentialResult.id === 'scan-result-2',
    `computeCount=${computeCount}, result=${sequentialResult.id}`
  );

  // 3. Database 15-Minute Safety Barrier (Preventing Twin Signals)
  console.log('\n--- Test 3: 15-Minute Database Safety Barrier ---');
  const mockSetup = {
    direction: 'BUY',
    entryPrice: 2730.0,
    stopLoss: 2722.0,
    takeProfit1: 2742.0,
    takeProfit2: 2755.0,
    riskReward1: 1.5,
    tradePath: { probTp1BeforeSl: 0.65, expectedValueR: 0.8 },
    opportunityScore: 85,
    orderType: 'BUY_LIMIT',
    entryZone: [2729.0, 2731.0],
    model: 'BOS_PULLBACK_CONTINUATION',
    grade: 'A+ INSTITUTIONAL',
    positionSizing: { riskPercent: 1.0 },
    volatilityMetrics: { atr15m: 4.0 },
    invalidationAndExpiry: { orderExpiryHours: 4 },
    fiveGates: { allPassed: true },
    finalValidationChecklist: { allPassed: true },
    levels: { currentPrice: 2732.0 },
    confluenceReasons: ['Bullish test']
  };

  // Publish first signal
  const sig1 = await (service as any).publishGoldSetup(mockSetup, 'First valid setup', 'APPROVED');
  assert(
    'First signal publishes and commits to database',
    createCallsCount === 1 && sig1.id === 'mock-sig-1',
    `createCallsCount=${createCallsCount}`
  );

  // Attempt to publish an identical twin signal 1 minute later
  const twinAttempt = await (service as any).publishGoldSetup(
    { ...mockSetup, entryPrice: 2730.5 }, // within 0.5 ATR
    'Twin attempt within 15m',
    'APPROVED'
  );

  assert(
    'Database 15-minute safety barrier suppresses twin record creation',
    createCallsCount === 1,
    `createCallsCount=${createCallsCount} (expected 1, twin blocked)`
  );

  assert(
    'Suppressed call returns existing record instead of creating duplicate',
    twinAttempt.id === 'mock-sig-1',
    `returned id=${twinAttempt?.id}`
  );

  // 4. Opposing Signal Invalidation
  console.log('\n--- Test 4: Opposing Signal Invalidation on Reversal ---');
  // Currently db has mock-sig-1 (BUY WAITING_FOR_ENTRY)
  const sellSetup = {
    direction: 'SELL',
    entryPrice: 2720.0,
    stopLoss: 2728.0,
    takeProfit1: 2708.0,
    takeProfit2: 2695.0,
    riskReward1: 1.5,
    tradePath: { probTp1BeforeSl: 0.65, expectedValueR: 0.8 },
    opportunityScore: 85,
    orderType: 'SELL_LIMIT',
    entryZone: [2719.0, 2721.0],
    model: 'BOS_PULLBACK_CONTINUATION',
    grade: 'A+ INSTITUTIONAL',
    positionSizing: { riskPercent: 1.0 },
    volatilityMetrics: { atr15m: 4.0 },
    invalidationAndExpiry: { orderExpiryHours: 4 },
    fiveGates: { allPassed: true },
    finalValidationChecklist: { allPassed: true },
    levels: { currentPrice: 2721.0 },
    confluenceReasons: ['Bearish reversal test']
  };

  const sellSig = await (service as any).publishGoldSetup(sellSetup, 'Bearish reversal', 'APPROVED');

  assert(
    'Reversal SELL signal is published',
    createCallsCount === 2 && sellSig.direction === 'SELL',
    `createCallsCount=${createCallsCount}, direction=${sellSig.direction}`
  );

  const originalBuy = dbRecords.find(r => r.id === 'mock-sig-1');
  assert(
    'Original opposing BUY order was invalidated in database',
    originalBuy.aiReasoning.status === 'CLOSED' && originalBuy.aiReasoning.lifecycleState === 'INVALIDATED',
    `buyStatus=${originalBuy?.aiReasoning?.status}, lifecycleState=${originalBuy?.aiReasoning?.lifecycleState}`
  );

  console.log('\n================================================================');
  console.log(' Phase 2 Concurrency & Mutex Tests Passed Successfully!');
  console.log('================================================================\n');
}

runPhase2Tests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
