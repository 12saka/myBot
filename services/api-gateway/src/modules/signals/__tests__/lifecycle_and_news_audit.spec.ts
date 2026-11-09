export {};

const { replaySignalLifecycle, computeLegacyRealizedR } = require('../signal-lifecycle.engine');

function assert(conditionName: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  [PASS] ${conditionName}`);
  } else {
    console.error(`  [FAIL] ${conditionName} - Detail: ${detail}`);
    process.exit(1);
  }
}

async function runAudit() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Lifecycle Replay & Zero-Dummy Realized R Audit');
  console.log('================================================================\n');

  // Test 1: No premature fill on SELL Limit
  console.log('--- Test 1: Limit Order Fill Integrity ---');
  const now = Date.now();
  const sellLimitInput = {
    direction: 'SELL',
    orderType: 'SELL_LIMIT',
    entryPrice: 2750.00,
    initialStopLoss: 2758.00,
    currentStopLoss: 2758.00,
    tp1: 2738.00,
    tp2: 2725.00,
    state: 'WAITING_FOR_ENTRY',
    filledPrice: null,
    filledAt: null,
    bankedR: 0,
    remainingFraction: 1,
    orderExpiresAt: now + 4 * 3600_000,
    maxHoldMs: 24 * 3600_000,
    spread: 0.25,
    processFromTime: now,
    barMs: 60_000
  };

  // Bar 1: Market trades at 2748.00 - 2749.50 (does NOT reach 2750.00)
  const barNoTouch = [
    { time: now, open: 2748.50, high: 2749.50, low: 2748.00, close: 2749.00 }
  ];
  const resNoTouch = replaySignalLifecycle(sellLimitInput, barNoTouch);
  assert(
    'SELL limit remains UNFILLED when high does not reach entry price',
    resNoTouch.state === 'WAITING_FOR_ENTRY' && resNoTouch.filledPrice === null
  );

  // Bar 2: Market trades up to 2751.20 (touches and fills at exact limit 2750.00)
  const barTouch = [
    { time: now + 60_000, open: 2749.00, high: 2751.20, low: 2748.50, close: 2750.80 }
  ];
  const resTouch = replaySignalLifecycle({ ...sellLimitInput, processFromTime: now + 60_000 }, barTouch);
  assert(
    'SELL limit fills at exact limit price or better (never below entry)',
    resTouch.state === 'POSITION_OPEN' && resTouch.filledPrice === 2750.00
  );

  // Test 2: Unprocessed signals caught up after downtime (no frozen/stuck signals)
  console.log('\n--- Test 2: Downtime Catchup & Target Execution ---');
  const barsSequence = [
    // Fill bar
    { time: now, open: 2749.00, high: 2751.00, low: 2748.50, close: 2750.50 },
    // Subsequent bar reaches TP1 (2738.00)
    { time: now + 60_000, open: 2749.00, high: 2749.50, low: 2737.50, close: 2738.20 },
    // Subsequent bar reaches TP2 (2725.00)
    { time: now + 120_000, open: 2738.00, high: 2738.50, low: 2724.00, close: 2724.50 }
  ];
  const catchupRes = replaySignalLifecycle(sellLimitInput, barsSequence);
  assert(
    'Multi-bar sequence cleanly navigates FILLED -> TP1_PARTIAL -> TP2_HIT to CLOSED',
    catchupRes.closed === true && catchupRes.outcome === 'TP2_HIT'
  );
  assert(
    'Realized R accurately computed for multi-target scaling without fabrication',
    catchupRes.realizedR !== null && catchupRes.realizedR > 1.5
  );

  // Test 3: Zero-Dummy Legacy Realized R calculation
  console.log('\n--- Test 3: Zero-Dummy Mathematical Realized R Calculation ---');
  const legacyWin = computeLegacyRealizedR({
    direction: 'BUY',
    orderType: 'BUY_LIMIT',
    entryPrice: 2730.00,
    stopLoss: 2722.00, // 8.00 risk
    initialStopLoss: 2722.00,
    takeProfit1: 2742.00, // +12.00 reward (1.5R)
    takeProfit2: 2754.00, // +24.00 reward (3.0R)
    riskRewardRatio: 1.5,
    outcome: 'TP2_HIT'
  });
  // 50% at 1.5R + 50% at 3.0R = 2.25R (exact mathematical value, not fake hardcoded 1.5 multiplier)
  assert(
    'Legacy TP2 Realized R computed strictly as 50/50 partial mathematical expectation (2.25R)',
    legacyWin === 2.25,
    `Expected 2.25, received ${legacyWin}`
  );

  const legacyBreakeven = computeLegacyRealizedR({
    direction: 'BUY',
    orderType: 'BUY_LIMIT',
    entryPrice: 2730.00,
    stopLoss: 2730.00,
    initialStopLoss: 2722.00,
    takeProfit1: 2742.00,
    takeProfit2: 2754.00,
    riskRewardRatio: 1.5,
    outcome: 'BREAKEVEN'
  });
  // 50% banked at 1.5R + 50% closed at BE = +0.75R
  assert(
    'Legacy Breakeven Realized R correctly retains 50% banked profit at TP1 (+0.75R)',
    legacyBreakeven === 0.75,
    `Expected 0.75, received ${legacyBreakeven}`
  );

  // Test 4: Unfilled / Missed Entry Deletion
  console.log('\n--- Test 4: Unfilled Signal Invalidation & Erasure ---');
  const runawayBars = [
    // Price moves directly down 90%+ to TP1 without touching entry at 2750.00
    { time: now, open: 2745.00, high: 2746.00, low: 2738.50, close: 2739.00 }
  ];
  const runawayRes = replaySignalLifecycle(sellLimitInput, runawayBars);
  assert(
    'Limit order that runs away without filling is marked UNFILLED (ENTRY_MISSED)',
    runawayRes.closed === true && runawayRes.outcome === 'UNFILLED' && runawayRes.closeReason === 'ENTRY_MISSED'
  );

  console.log('\n================================================================');
  console.log(' All Lifecycle Replay & Zero-Dummy Audits Passed (100%)');
  console.log('================================================================\n');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
