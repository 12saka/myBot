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

async function runPhase3Audit() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Phase 3 True SMC Displacement & FVG Re-Test Audit');
  console.log('================================================================\n');

  const mockPrisma: any = {
    $executeRawUnsafe: async () => {},
    signal: { findMany: async () => [], findUnique: async () => null, create: async (d: any) => ({ id: 'sig-test', ...d.data }), delete: async () => {} },
    goldSignalPerformance: { findMany: async () => [] }
  };
  const mockEntitlement: any = {};
  const mockAutomation: any = { processSignalAutoTrade: async () => ({ status: 'EXECUTED' }) };
  const mockNotifications: any = { server: { emit: () => {} } };

  const controller = new SignalsController(mockPrisma, mockEntitlement, mockAutomation, mockNotifications);
  const atr15m = 4.0; // Benchmark $4.00 ATR for Gold

  // -------------------------------------------------------------
  // Test 1: Order Block Displacement Filter (>= 65% Body-to-Range)
  // -------------------------------------------------------------
  console.log('--- Test 1: Order Block Displacement Filter ---');

  // Case A: Weak wick candle after down-bar (body ratio 30% < 65% threshold)
  const weakWickCandles = [
    { timestamp: new Date(1), open: 2740, high: 2742, low: 2738, close: 2739, volume: 1000 }, // c (down candle)
    { timestamp: new Date(2), open: 2739, high: 2745, low: 2738, close: 2741, volume: 1000 }, // next1 (long upper wick: body $2, range $7 -> 28%)
    { timestamp: new Date(3), open: 2741, high: 2742, low: 2740, close: 2741.5, volume: 1000 },
    { timestamp: new Date(4), open: 2741.5, high: 2742, low: 2740, close: 2741, volume: 1000 }
  ];
  const weakObs = controller.detectOrderBlocks(weakWickCandles, atr15m);
  assert(
    'Weak wick candles (<65% body ratio) are REJECTED from creating fake Order Blocks',
    weakObs.length === 0,
    `Found ${weakObs.length} order blocks`
  );

  // Case B: True Institutional Displacement Candle (body $4.50, range $5.00 -> 90% body ratio >= 65%)
  const trueDisplacementCandles = [
    { timestamp: new Date(1), open: 2742, high: 2742.5, low: 2738, close: 2738.5, volume: 1000 }, // c (last down-bar)
    { timestamp: new Date(2), open: 2738.5, high: 2744.0, low: 2738.0, close: 2743.5, volume: 2200 }, // next1 (aggressive displacement: body 5.0, range 6.0 = 83%)
    { timestamp: new Date(3), open: 2743.5, high: 2746.0, low: 2743.0, close: 2745.5, volume: 1800 },
    { timestamp: new Date(4), open: 2745.5, high: 2746.0, low: 2744.5, close: 2745.0, volume: 1200 }
  ];
  const trueBullObs = controller.detectOrderBlocks(trueDisplacementCandles, atr15m);
  assert(
    'Strong displacement candle (>=65% body ratio) successfully identifies Institutional Bullish OB',
    trueBullObs.length >= 1 && trueBullObs[0].type === 'BULLISH',
    `Found ${trueBullObs.length} order blocks`
  );
  assert(
    'Order Block records displacement ratio and quality score >= 75',
    trueBullObs[0].displacementRatio !== undefined && trueBullObs[0].displacementRatio >= 0.70 && trueBullObs[0].qualityScore >= 75,
    `Displacement ratio: ${trueBullObs[0].displacementRatio}, Quality: ${trueBullObs[0].qualityScore}`
  );

  // -------------------------------------------------------------
  // Test 2: Order Block Retest vs Mitigation Logic
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Order Block Retest vs Mitigation ---');

  // Retest: Candle 3 wicks into the OB (between low 2738.0 and high 2742.5) and closes above low (2741.0)
  const retestedCandles = [
    { timestamp: new Date(1), open: 2742, high: 2742.5, low: 2738.0, close: 2738.5, volume: 1000 },
    { timestamp: new Date(2), open: 2738.5, high: 2745.0, low: 2738.0, close: 2744.5, volume: 2200 }, // displacement
    { timestamp: new Date(3), open: 2744.5, high: 2745.0, low: 2740.0, close: 2742.0, volume: 1100 }  // retest wick touches 2740, closes 2742
  ];
  const retestObs = controller.detectOrderBlocks(retestedCandles, atr15m);
  assert(
    'Order Block properly detects institutional re-test when wick enters zone and respects low',
    retestObs.length >= 1 && retestObs[0].isRetested === true && retestObs[0].mitigated === false,
    `isRetested: ${retestObs[0]?.isRetested}, mitigated: ${retestObs[0]?.mitigated}`
  );

  // Mitigation / Invalidation: Candle closes below the OB low (2737.0 < 2738.0)
  const mitigatedCandles = [
    { timestamp: new Date(1), open: 2742, high: 2742.5, low: 2738.0, close: 2738.5, volume: 1000 },
    { timestamp: new Date(2), open: 2738.5, high: 2745.0, low: 2738.0, close: 2744.5, volume: 2200 },
    { timestamp: new Date(3), open: 2744.5, high: 2744.5, low: 2736.0, close: 2736.5, volume: 1900 }  // closes below low
  ];
  const mitigatedObs = controller.detectOrderBlocks(mitigatedCandles, atr15m);
  assert(
    'Order Block is marked mitigated/invalidated when candle closes through the base',
    mitigatedObs.length >= 1 && mitigatedObs[0].mitigated === true,
    `mitigated: ${mitigatedObs[0]?.mitigated}`
  );

  // -------------------------------------------------------------
  // Test 3: Fair Value Gap (FVG) Consequent Encroachment (CE) & Re-Test
  // -------------------------------------------------------------
  console.log('\n--- Test 3: FVG Consequent Encroachment & Re-Test Detection ---');

  // Bullish FVG: Candle 0 high = 2735.0, Candle 1 displacement (2735.0 to 2745.0), Candle 2 low = 2738.5
  // Gap = [2735.0, 2738.5], Consequent Encroachment (50% CE) = 2736.75
  const fvgCandles = [
    { timestamp: new Date(1), open: 2733, high: 2735.0, low: 2732.5, close: 2734.5, volume: 1000 }, // cPast
    { timestamp: new Date(2), open: 2734.5, high: 2744.0, low: 2734.0, close: 2743.5, volume: 2400 }, // cImpulse (displacement)
    { timestamp: new Date(3), open: 2743.5, high: 2746.0, low: 2738.5, close: 2745.0, volume: 1500 }, // cCurrent (gap from 2735.0 to 2738.5)
    { timestamp: new Date(4), open: 2745.0, high: 2745.5, low: 2736.5, close: 2740.0, volume: 1200 }  // probe wicks into FVG touching CE (2736.5), closes 2740.0
  ];

  const fvgs = controller.detectFairValueGaps(fvgCandles, atr15m);
  assert(
    'True SMC Bullish FVG identified with middle displacement candle',
    fvgs.length >= 1 && fvgs[0].type === 'BULLISH',
    `Found ${fvgs.length} FVGs`
  );
  assert(
    'Consequent Encroachment (50% CE) is accurately computed as midpoint of the gap',
    fvgs[0].consequentEncroachment === 2736.75,
    `Expected 2736.75, got ${fvgs[0].consequentEncroachment}`
  );
  assert(
    'FVG Re-Test is confirmed when probe candle tests CE and respects gap bottom',
    fvgs[0].isRetested === true && fvgs[0].mitigated === false,
    `isRetested: ${fvgs[0].isRetested}, mitigated: ${fvgs[0].mitigated}`
  );

  // -------------------------------------------------------------
  // Test 4: Pipeline Execution Trigger on FVG / OB Re-Test
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Execution Pipeline FVG/OB Re-Test Integration ---');

  // Build a 60-candle dataset where an FVG/OB was formed and price is re-testing it
  const now = Date.now();
  const pipelineCandles = Array.from({ length: 60 }, (_, i) => {
    let p = 2730.00 + i * 0.20;
    // Embed a strong bullish displacement at index 45
    if (i === 45) {
      return { timestamp: new Date(now - (60 - i) * 15 * 60_000), open: 2739.0, high: 2740.0, low: 2738.5, close: 2739.0, volume: 1000 };
    }
    if (i === 46) {
      return { timestamp: new Date(now - (60 - i) * 15 * 60_000), open: 2739.0, high: 2747.0, low: 2739.0, close: 2746.5, volume: 3000 };
    }
    if (i === 47) {
      return { timestamp: new Date(now - (60 - i) * 15 * 60_000), open: 2746.5, high: 2749.0, low: 2743.0, close: 2748.0, volume: 2000 };
    }
    // Pullback to re-test the FVG/OB at the end
    if (i >= 58) {
      p = 2741.00;
    }
    return {
      timestamp: new Date(now - (60 - i) * 15 * 60_000),
      open: p,
      high: p + 1.2,
      low: p - 0.4,
      close: p + 0.8,
      volume: 1400
    };
  });

  const setup = controller.evaluateProductionPipeline(
    pipelineCandles,
    pipelineCandles,
    { bid: 2741.40, ask: 2741.60, spread: 0.20, spot: 2741.50, isLiquid: true },
    {
      dxy: 103.80,
      dxyChange1h: -0.16,
      us10y: 4.18,
      us10yChange1h: -0.12,
      realYieldProxy: 1.88,
      safeHavenDemandScore: 60,
      riskSentiment: 'NEUTRAL' as const,
      macroAlignment: 'BULLISH' as const,
      conflictDetected: false,
      rationale: 'Bullish macro',
      hasLiveMacro: true,
      macroBias: 'BULLISH' as const,
      macroDrawOnLiquidity: 'BUY_SIDE_LIQUIDITY' as const
    },
    { isBlackout: false, eventStage: 'NORMAL_MODE', minutesToEvent: null, eventTitle: null, impactTier: 'LOW' },
    pipelineCandles,
    pipelineCandles,
    pipelineCandles,
    pipelineCandles,
    pipelineCandles,
    []
  );

  assert(
    'SMC Re-test triggers Institutional BUY setup approval (Gate 3 Passed with BUY Bias)',
    setup.fiveGates.gate3_setup.passed === true && setup.fiveGates.gate3_setup.telemetry.bias === 'BUY',
    `Gate 3: ${setup.fiveGates.gate3_setup.passed}, Bias: ${setup.fiveGates.gate3_setup.telemetry.bias}, Reason: ${setup.fiveGates.gate3_setup.reason}`
  );

  console.log('\n================================================================');
  console.log(' All Phase 3 True SMC Displacement & FVG Re-Test Audits Passed (100%)');
  console.log('================================================================\n');
}

runPhase3Audit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
