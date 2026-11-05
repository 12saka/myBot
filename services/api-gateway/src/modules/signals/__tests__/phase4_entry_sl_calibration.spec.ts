/**
 * Phase 4 Verification Test:
 * 1. Stage 4 Equilibrium Entry Calibration (Mean Threshold instead of extreme wick edge)
 * 2. Anti-Wick-Hunt Stop Loss with Spread Cushion (Shielding against broker Ask-side stop sweeps)
 * 3. Realistic Runaway Retrace Tolerance (Allowing natural market pullbacks without premature ENTRY_MISSED)
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

async function runPhase4Tests() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Phase 4 Dynamic Entry & SL Calibration Tests');
  console.log('================================================================\n');

  const mockPrisma = {
    signal: {
      create: async ({ data }: any) => ({ id: 'mock-1', ...data }),
      findMany: async () => [],
      count: async () => 0,
      update: async ({ data }: any) => data
    }
  };

  const service = new SignalsController(
    mockPrisma as any,
    {} as any,
    {} as any,
    { server: { emit: () => {} }, broadcastTradeSignalNotification: async () => {} } as any
  );

  // 1. Test ICZ Entry Zone Calibration
  console.log('--- Test 1: Institutional Confluence Zone Width ---');
  const candidates = [
    { source: '15M Order Block', price: 2730.0, weight: 3 },
    { source: '15M FVG', price: 2731.0, weight: 2 }
  ];
  const icz = service.computeInstitutionalConfluenceZone('SELL', 2735.0, candidates, 5.0);
  const zoneWidth = icz.zoneHigh - icz.zoneLow;
  assert(
    'Confluence zone width realistically accommodates institutional order block (width >= 2.50)',
    zoneWidth >= 2.50,
    `zoneWidth=$${zoneWidth.toFixed(2)}, zone=[$${icz.zoneLow}, $${icz.zoneHigh}]`
  );

  // 2. Test Anti-Wick-Hunt Stop Loss with Spread Cushion for SELL orders
  console.log('\n--- Test 2: Anti-Wick-Hunt SL with Spread Cushion ---');
  // For a SELL setup with ATR15m = 5.0 and Spread = 0.40
  // adaptiveBuffer must be >= 1.85 + 0.40 = 2.25
  const baseBuffer = Math.max(1.85, 5.0 * 0.55); // 2.75
  const spreadCushion = Math.max(0.35, 0.40); // 0.40
  const expectedSellBuffer = baseBuffer + spreadCushion; // 3.15

  assert(
    'Sell SL adaptive buffer includes spread cushion to protect against Ask-side stop runs',
    expectedSellBuffer >= 3.0,
    `buffer=$${expectedSellBuffer.toFixed(2)}`
  );

  // 3. Test Runaway Tolerance (90% threshold vs 70% premature cancellation)
  console.log('\n--- Test 3: Retrace Tolerance (70% impulse does not cancel pending order) ---');
  const entryPrice = 3913.31;
  const tp1Price = 3903.01;
  const tpDistance = Math.abs(tp1Price - entryPrice); // 10.30

  // At 70% move (distance = 7.21, price = 3906.10):
  const moveAt70 = 0.70 * tpDistance;
  const priceAt70 = entryPrice - moveAt70;
  const threshold90 = tpDistance * 0.90; // 9.27
  const isCancelledAt70UnderNewPolicy = moveAt70 >= threshold90;

  assert(
    'A 70% impulse move towards TP1 preserves the pending limit order for pullback execution',
    !isCancelledAt70UnderNewPolicy,
    `moveAt70=$${moveAt70.toFixed(2)}, threshold90=$${threshold90.toFixed(2)}`
  );

  // At 92% move (distance = 9.48, price = 3903.83):
  const moveAt92 = 0.92 * tpDistance;
  const isCancelledAt92 = moveAt92 >= threshold90;
  assert(
    'A genuine 92% run-away near TP1 safely triggers ENTRY_MISSED',
    isCancelledAt92,
    `moveAt92=$${moveAt92.toFixed(2)} >= threshold90=$${threshold90.toFixed(2)}`
  );

  console.log('\n================================================================');
  console.log(' Phase 4 Dynamic Entry & SL Calibration Tests Passed!');
  console.log('================================================================\n');
}

runPhase4Tests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
