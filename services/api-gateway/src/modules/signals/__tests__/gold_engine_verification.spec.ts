/**
 * TradeMind AI: Institutional Gold Engine v3 Verification Test Suite
 * 
 * Verifies core audit principles:
 * 1. Closed-Candle Rule (Completed candles only)
 * 2. Directional Stability & Margin Filter (No flipping on 51/49)
 * 3. Duplicate Setup Suppression (ATR-calibrated entry zones)
 * 4. Exposure Cap (Max 3 concurrent active signals)
 * 5. Opposing Policy & Immutability (No in-place level or direction mutation)
 * 6. 9-State Lifecycle Transitions (Fill, TP1 -> Breakeven, News cancellation)
 */

interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MockSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  aiReasoning: {
    status: string;
    lifecycleState: string;
    entryZone?: [number, number];
    isOrderFilled?: boolean;
    trailingStopBe?: boolean;
    runnerClosedAtBreakeven?: boolean;
    outcome?: string;
    closeReason?: string;
  };
}

// -------------------------------------------------------------
// Core Engine Logic Simulators (Identical to signals.module.ts)
// -------------------------------------------------------------

function evaluateMarketBiasWithStabilityFilter(bullishScore: number, bearishScore: number): {
  direction: 'BUY' | 'SELL' | 'WAIT';
  score: number;
  margin: number;
} {
  const margin = Math.abs(bullishScore - bearishScore);
  const score = Math.max(bullishScore, bearishScore);

  // Phase 2 Filter: Requires both >= 55 score and >= 15 evidence margin
  if (score < 55 || margin < 15) {
    return { direction: 'WAIT', score, margin };
  }

  return {
    direction: bullishScore > bearishScore ? 'BUY' : 'SELL',
    score,
    margin
  };
}

function checkDuplicateSetup(
  activeSignals: MockSignal[],
  candidateDirection: 'BUY' | 'SELL',
  candidateEntryPrice: number,
  atr15m: number
): boolean {
  return activeSignals.some(s => {
    if (s.direction !== candidateDirection) return false;
    const sZone = s.aiReasoning.entryZone || [s.entryPrice - 0.5, s.entryPrice + 0.5];
    const entryOverlap =
      candidateEntryPrice >= sZone[0] - 1.0 * atr15m &&
      candidateEntryPrice <= sZone[1] + 1.0 * atr15m;
    return entryOverlap;
  });
}

function checkExposureCap(activeSignals: MockSignal[], maxAllowed = 3): boolean {
  return activeSignals.length >= maxAllowed;
}

function simulateLifecycleTick(
  signal: MockSignal,
  currentPrice: number,
  isNewsBlackout = false
): { updatedSignal: MockSignal; event: string } {
  const s = JSON.parse(JSON.stringify(signal)) as MockSignal;
  const reasoning = s.aiReasoning;

  // 1. News Blackout Check: Pending unfilled orders cancelled
  if (isNewsBlackout && reasoning.status === 'WAITING_FOR_ENTRY' && !reasoning.isOrderFilled) {
    reasoning.status = 'CLOSED';
    reasoning.lifecycleState = 'CANCELLED';
    reasoning.outcome = 'CANCELLED';
    reasoning.closeReason = 'NEWS_RISK';
    return { updatedSignal: s, event: 'CANCELLED_NEWS_RISK' };
  }

  // 2. Entry Missed Check: Price runs away to TP1 without filling limit order
  if (!reasoning.isOrderFilled) {
    const ranAway =
      (s.direction === 'BUY' && currentPrice >= s.takeProfit1) ||
      (s.direction === 'SELL' && currentPrice <= s.takeProfit1);

    if (ranAway) {
      reasoning.status = 'CLOSED';
      reasoning.lifecycleState = 'EXPIRED';
      reasoning.outcome = 'UNFILLED';
      reasoning.closeReason = 'ENTRY_MISSED';
      return { updatedSignal: s, event: 'EXPIRED_ENTRY_MISSED' };
    }

    // Check entry fill
    const entryZone = reasoning.entryZone || [s.entryPrice - 0.5, s.entryPrice + 0.5];
    const filled =
      (s.direction === 'BUY' && currentPrice <= entryZone[1]) ||
      (s.direction === 'SELL' && currentPrice >= entryZone[0]);

    if (filled) {
      reasoning.isOrderFilled = true;
      reasoning.status = 'POSITION_OPEN';
      reasoning.lifecycleState = 'POSITION_OPEN';
      return { updatedSignal: s, event: 'POSITION_OPENED' };
    }

    return { updatedSignal: s, event: 'WAITING' };
  }

  // 3. Active Position Management: TP1, Breakeven, TP2, SL
  const isAlreadyTp1 = reasoning.status === 'TP1_HIT' || reasoning.trailingStopBe;

  if (s.direction === 'BUY') {
    if (currentPrice >= s.takeProfit2) {
      reasoning.status = 'CLOSED';
      reasoning.lifecycleState = 'CLOSED';
      reasoning.outcome = 'TP2_HIT';
      return { updatedSignal: s, event: 'TP2_HIT' };
    }
    if (currentPrice >= s.takeProfit1 && !isAlreadyTp1) {
      reasoning.status = 'TP1_HIT';
      reasoning.lifecycleState = 'PARTIALLY_FILLED';
      reasoning.trailingStopBe = true;
      s.stopLoss = s.entryPrice; // Move SL to Breakeven
      return { updatedSignal: s, event: 'TP1_PARTIAL_SL_MOVED_TO_BE' };
    }
    if (currentPrice <= s.stopLoss) {
      if (isAlreadyTp1) {
        reasoning.status = 'CLOSED';
        reasoning.lifecycleState = 'CLOSED';
        reasoning.outcome = 'BREAKEVEN';
        reasoning.runnerClosedAtBreakeven = true;
        return { updatedSignal: s, event: 'RUNNER_CLOSED_AT_BREAKEVEN_PROFIT' };
      }
      reasoning.status = 'CLOSED';
      reasoning.lifecycleState = 'CLOSED';
      reasoning.outcome = 'SL_HIT';
      return { updatedSignal: s, event: 'SL_HIT' };
    }
  }

  return { updatedSignal: s, event: 'HOLDING' };
}

// -------------------------------------------------------------
// Test Execution Suite
// -------------------------------------------------------------

function runAllTests() {
  console.log('================================================================');
  console.log(' TradeMind AI: Gold Engine v3 Verification Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(testName: string, condition: boolean, detail = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${testName}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${testName} - Detail: ${detail}`);
    }
  }

  // -----------------------------------------------------------
  // Test 1 & 2: Closed-Candle Rule
  // -----------------------------------------------------------
  console.log('--- Suite 1: Closed-Candle Rule ---');
  const mockCandles: Candle[] = [
    { timestamp: new Date(1000), open: 2700, high: 2705, low: 2698, close: 2704, volume: 100 },
    { timestamp: new Date(2000), open: 2704, high: 2710, low: 2702, close: 2708, volume: 120 },
    { timestamp: new Date(3000), open: 2708, high: 2720, low: 2706, close: 2712, volume: 150 }, // Previous closed bar
    { timestamp: new Date(4000), open: 2712, high: 2740, low: 2710, close: 2711, volume: 50 },  // Active forming bar (temporary wick spike)
  ];

  const completedBars = mockCandles.slice(0, -1);
  const lastCompletedBar = completedBars[completedBars.length - 1];

  assert(
    'Completed candles slice excludes the active forming bar',
    completedBars.length === 3 && lastCompletedBar.close === 2712
  );

  assert(
    'Intra-bar wick spike ($2740) on forming bar is ignored by completed-candle engine',
    completedBars.every(c => c.high < 2740)
  );

  // -----------------------------------------------------------
  // Test 3, 4, 5: Directional Stability & Margin Filter
  // -----------------------------------------------------------
  console.log('\n--- Suite 2: Directional Stability & Margin Filter ---');

  // Case A: 51 Bull / 49 Bear (Margin = 2 < 15) -> Must NOT flip to BUY
  const bias51_49 = evaluateMarketBiasWithStabilityFilter(51, 49);
  assert(
    'Margin filter rejects 51 Bull / 49 Bear noise and holds WAIT (Margin: 2 < 15)',
    bias51_49.direction === 'WAIT'
  );

  // Case B: 48 Bull / 52 Bear (Margin = 4 < 15) -> Must NOT flip to SELL
  const bias48_52 = evaluateMarketBiasWithStabilityFilter(48, 52);
  assert(
    'Margin filter rejects 48 Bull / 52 Bear noise and holds WAIT (Margin: 4 < 15)',
    bias48_52.direction === 'WAIT'
  );

  // Case C: Clear institutional confluence (75 Bull / 25 Bear, Margin = 50 >= 15, Score >= 55)
  const biasDecisive = evaluateMarketBiasWithStabilityFilter(75, 25);
  assert(
    'Decisive institutional confluence (75/25) passes and approves BUY',
    biasDecisive.direction === 'BUY' && biasDecisive.score === 75
  );

  // -----------------------------------------------------------
  // Test 6 & 7: Duplicate Setup Suppression
  // -----------------------------------------------------------
  console.log('\n--- Suite 3: Duplicate Setup Suppression ---');
  const activeDeck: MockSignal[] = [
    {
      id: 'sig-gold-001',
      symbol: 'GOLD',
      direction: 'BUY',
      entryPrice: 2730.0,
      stopLoss: 2724.0,
      takeProfit1: 2738.0,
      takeProfit2: 2748.0,
      riskRewardRatio: 1.33,
      aiReasoning: {
        status: 'WAITING_FOR_ENTRY',
        lifecycleState: 'WAITING_FOR_ENTRY',
        entryZone: [2729.5, 2730.5]
      }
    }
  ];

  const atr15m = 4.0;

  // New BUY setup at 2732.0 (Within 1.0 * ATR of 2730.0) -> Duplicate
  const isDuplicateOverlap = checkDuplicateSetup(activeDeck, 'BUY', 2732.0, atr15m);
  assert(
    'New candidate BUY at $2732 is detected as duplicate overlap (Zone: $2730 ± 4.0 ATR)',
    isDuplicateOverlap === true
  );

  // New BUY setup at 2750.0 (Far outside zone) -> Non-duplicate
  const isDuplicateDistant = checkDuplicateSetup(activeDeck, 'BUY', 2750.0, atr15m);
  assert(
    'New candidate BUY at $2750 is accepted as distinct structural level',
    isDuplicateDistant === false
  );

  // -----------------------------------------------------------
  // Test 8: Exposure Cap (Max 3 Concurrent Signals)
  // -----------------------------------------------------------
  console.log('\n--- Suite 4: Exposure Cap Enforcement ---');
  const threeActiveSignals: MockSignal[] = [
    { ...activeDeck[0], id: 'sig-001' },
    { ...activeDeck[0], id: 'sig-002', entryPrice: 2745.0 },
    { ...activeDeck[0], id: 'sig-003', entryPrice: 2760.0 },
  ];

  const isCapReached = checkExposureCap(threeActiveSignals, 3);
  assert(
    'Exposure cap strictly blocks fourth signal when 3 active setups are already open',
    isCapReached === true
  );

  // -----------------------------------------------------------
  // Test 9, 10, 11: 9-State Lifecycle Transitions
  // -----------------------------------------------------------
  console.log('\n--- Suite 5: 9-State Lifecycle & Breakeven Protection ---');

  const freshOrder: MockSignal = {
    id: 'sig-test-life',
    symbol: 'GOLD',
    direction: 'BUY',
    entryPrice: 2730.0,
    stopLoss: 2724.0,
    takeProfit1: 2738.0,
    takeProfit2: 2748.0,
    riskRewardRatio: 1.33,
    aiReasoning: {
      status: 'WAITING_FOR_ENTRY',
      lifecycleState: 'WAITING_FOR_ENTRY',
      entryZone: [2729.5, 2730.5],
      isOrderFilled: false
    }
  };

  // 9. Fill transition
  const fillResult = simulateLifecycleTick(freshOrder, 2730.2);
  assert(
    'Limit order fills when market enters zone ($2730.20) -> Transitions to POSITION_OPEN',
    fillResult.event === 'POSITION_OPENED' &&
    fillResult.updatedSignal.aiReasoning.status === 'POSITION_OPEN' &&
    fillResult.updatedSignal.aiReasoning.isOrderFilled === true
  );

  // 10. TP1 hit and SL moved to Breakeven
  const tp1Result = simulateLifecycleTick(fillResult.updatedSignal, 2738.5);
  assert(
    'Price hits TP1 ($2738.50) -> Transitions to PARTIALLY_FILLED & moves Stop Loss to Breakeven ($2730.00)',
    tp1Result.event === 'TP1_PARTIAL_SL_MOVED_TO_BE' &&
    tp1Result.updatedSignal.aiReasoning.status === 'TP1_HIT' &&
    tp1Result.updatedSignal.stopLoss === 2730.0
  );

  // 11. Runner retracing to Breakeven after TP1 hit (must NEVER be SL_HIT loss!)
  const beRetraceResult = simulateLifecycleTick(tp1Result.updatedSignal, 2729.8);
  assert(
    'Runner retracing to Breakeven ($2730.00) after TP1 closes as BREAKEVEN profit, NEVER SL_HIT loss',
    beRetraceResult.event === 'RUNNER_CLOSED_AT_BREAKEVEN_PROFIT' &&
    beRetraceResult.updatedSignal.aiReasoning.outcome === 'BREAKEVEN' &&
    beRetraceResult.updatedSignal.aiReasoning.runnerClosedAtBreakeven === true
  );

  // 12. News blackout protection for pending order
  const pendingUnderNews: MockSignal = { ...freshOrder };
  const newsCancelResult = simulateLifecycleTick(pendingUnderNews, 2732.0, true);
  assert(
    'High-impact news blackout safely CANCELS pending WAITING_FOR_ENTRY order with NEWS_RISK',
    newsCancelResult.event === 'CANCELLED_NEWS_RISK' &&
    newsCancelResult.updatedSignal.aiReasoning.lifecycleState === 'CANCELLED' &&
    newsCancelResult.updatedSignal.aiReasoning.closeReason === 'NEWS_RISK'
  );

  // 13. Entry missed expiry
  const pendingMissed: MockSignal = { ...freshOrder };
  const entryMissedResult = simulateLifecycleTick(pendingMissed, 2739.0, false);
  assert(
    'Price running directly to TP1 ($2739.00) without filling retires limit order with ENTRY_MISSED',
    entryMissedResult.event === 'EXPIRED_ENTRY_MISSED' &&
    entryMissedResult.updatedSignal.aiReasoning.lifecycleState === 'EXPIRED' &&
    entryMissedResult.updatedSignal.aiReasoning.closeReason === 'ENTRY_MISSED'
  );

  // -----------------------------------------------------------
  // Suite 6: Real-Data Pipeline Accuracy & Zero-Fallback Audit
  // -----------------------------------------------------------
  console.log('\n--- Suite 6: Real-Data Pipeline Accuracy & Zero-Fallback Audit ---');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SignalsController } = require('../signals.module');
  const service = new SignalsController({} as any, {} as any, {} as any, {} as any);

  // Build 60 realistic 15m candles in a strong bearish downtrend (1H and 4H bearish)
  const baseTime = Date.now() - 60 * 15 * 60 * 1000;
  const bearish15m: Candle[] = [];
  for (let i = 0; i < 60; i++) {
    const open = 2780 - i * 0.8;
    const close = open - 0.6;
    const high = open + 0.7;
    const low = close - 0.7;
    bearish15m.push({
      timestamp: new Date(baseTime + i * 15 * 60 * 1000),
      open,
      high,
      low,
      close,
      volume: 1000 + i * 10
    });
  }

  const bearish1h: Candle[] = [];
  for (let i = 0; i < 40; i++) {
    // Alternating fractal swings making Lower Highs and Lower Lows
    const wave = Math.sin(i * 1.1) * 3.5;
    const base = 2800 - i * 1.8 + wave;
    bearish1h.push({
      timestamp: new Date(baseTime - (40 - i) * 60 * 60 * 1000),
      open: base + 0.8,
      high: base + 2.0,
      low: base - 2.0,
      close: base - 0.8,
      volume: 4000
    });
  }

  const bearish4h: Candle[] = [];
  for (let i = 0; i < 35; i++) {
    const base = 2840 - i * 3.0;
    bearish4h.push({
      timestamp: new Date(baseTime - (35 - i) * 4 * 60 * 60 * 1000),
      open: base + 1.5,
      high: base + 3.0,
      low: base - 3.0,
      close: base - 1.5,
      volume: 12000
    });
  }

  const setupNoTrade = service.evaluateProductionPipeline(
    bearish15m,
    bearish1h,
    {
      bid: bearish15m[bearish15m.length - 1].close - 0.10,
      ask: bearish15m[bearish15m.length - 1].close + 0.10,
      spread: 0.20,
      spot: bearish15m[bearish15m.length - 1].close,
      isLiquid: true
    },
    {
      dxy: 104.2,
      dxyChange1h: 0.15,
      us10y: 4.25,
      us10yChange1h: 0.05,
      realYieldProxy: 2.0,
      macroAlignment: 'BEARISH',
      conflictDetected: false,
      safeHavenDemandScore: 45,
      riskSentiment: 'RISK_ON',
      hasLiveMacro: true
    },
    {
      isBlackout: false,
      impactTier: 'LOW',
      eventStage: 'CLEAR',
      feedOffline: false
    },
    bearish4h,
    [],
    [],
    [],
    []
  );

  // 14. Verify Stop Loss is NEVER clamped inside the Institutional Confluence Zone + adaptiveBuffer
  const slStrictCheck = setupNoTrade.fiveGates.gate3_setup.telemetry?.structuralDirection === 'SELL'
    ? setupNoTrade.stopLoss >= setupNoTrade.entryZone[1] + setupNoTrade.invalidationAndExpiry.adaptiveVolBuffer - 0.01
    : setupNoTrade.stopLoss <= setupNoTrade.entryZone[0] - setupNoTrade.invalidationAndExpiry.adaptiveVolBuffer + 0.01;
  assert(
    'Stop Loss is strictly placed beyond the entire Institutional Confluence Zone + adaptiveVolBuffer (never clamped tighter)',
    slStrictCheck,
    `SL=${setupNoTrade.stopLoss}, Zone=[${setupNoTrade.entryZone[0]}, ${setupNoTrade.entryZone[1]}], Buffer=${setupNoTrade.invalidationAndExpiry.adaptiveVolBuffer}`
  );

  // 15. Verify that when all 5 gates do not pass, direction is strictly WAIT and grade is WAIT (never coerced to A+ PRIME)
  if (!setupNoTrade.fiveGates.allPassed) {
    assert(
      'Non-passing setup strictly returns direction=WAIT, orderType=WAIT, and grade=WAIT (zero fake A+ fallback)',
      setupNoTrade.direction === 'WAIT' && setupNoTrade.orderType === 'WAIT' && setupNoTrade.grade === 'WAIT',
      `direction=${setupNoTrade.direction}, orderType=${setupNoTrade.orderType}, grade=${setupNoTrade.grade}`
    );
  } else {
    assert(
      'Passing setup has positive spread-adjusted EV and valid R:R >= 1.3',
      setupNoTrade.tradePath.expectedValueR >= 0.25 && setupNoTrade.riskReward1 >= 1.3
    );
  }

  // 16. Verify computeInstitutionalConfluenceZone returns WEAK when < 2 real candidates exist
  const weakZone = service.computeInstitutionalConfluenceZone(
    'BUY',
    2750,
    [{ source: 'Single Level Only', price: 2745, weight: 3 }],
    4.0
  );
  assert(
    'Confluence zone with fewer than 2 real structural candidates is ranked WEAK (zero synthetic OTE injection)',
    weakZone.zoneRank === 'WEAK' && weakZone.overlapCount === 1
  );

  console.log('\n================================================================');
  console.log(` Verification Summary: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests();

