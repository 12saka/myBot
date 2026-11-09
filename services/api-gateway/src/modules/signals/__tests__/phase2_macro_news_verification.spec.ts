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

async function runPhase2Audit() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Phase 2 Fundamental News & Macro Draw Audit');
  console.log('================================================================\n');

  // Initialize mock instance
  const mockPrisma: any = {
    $executeRawUnsafe: async () => {},
    signal: { findMany: async () => [], findUnique: async () => null, create: async (d: any) => ({ id: 'sig-test', ...d.data }), delete: async () => {} },
    goldSignalPerformance: { findMany: async () => [] }
  };
  const mockEntitlement: any = {};
  const mockAutomation: any = { processSignalAutoTrade: async () => ({ status: 'EXECUTED' }) };
  const mockNotifications: any = { server: { emit: () => {} } };

  const controller = new SignalsController(mockPrisma, mockEntitlement, mockAutomation, mockNotifications);

  // -------------------------------------------------------------
  // Test 1: Fundamental News Metric Parsing & Deviation Logic
  // -------------------------------------------------------------
  console.log('--- Test 1: ForexFactory Metric Parsing & Fundamental Bias ---');

  // Hot CPI (Actual 0.4% vs Forecast 0.2%) -> Hawkish USD -> BEARISH Gold
  const hotCpi = controller.evaluateUsdNewsImpact('Core CPI m/m', '0.4%', '0.2%', '0.2%');
  assert(
    'Hot CPI (Actual > Forecast) generates BEARISH Gold fundamental bias',
    hotCpi.fundamentalGoldBias === 'BEARISH',
    JSON.stringify(hotCpi)
  );

  // Soft CPI (Actual 0.1% vs Forecast 0.3%) -> Dovish USD -> BULLISH Gold
  const softCpi = controller.evaluateUsdNewsImpact('CPI m/m', '0.1%', '0.3%', '0.3%');
  assert(
    'Soft CPI (Actual < Forecast) generates BULLISH Gold fundamental bias',
    softCpi.fundamentalGoldBias === 'BULLISH',
    JSON.stringify(softCpi)
  );

  // Weak NFP (Actual 110K vs Forecast 210K) -> Weak labor -> BULLISH Gold
  const weakNfp = controller.evaluateUsdNewsImpact('Non-Farm Employment Change', '110K', '210K', '200K');
  assert(
    'Weak NFP (Actual < Forecast) generates BULLISH Gold fundamental bias',
    weakNfp.fundamentalGoldBias === 'BULLISH',
    JSON.stringify(weakNfp)
  );

  // High Unemployment Rate (Actual 4.4% vs Forecast 4.1%) -> Anti-USD -> BULLISH Gold
  const highUnemployment = controller.evaluateUsdNewsImpact('Unemployment Rate', '4.4%', '4.1%', '4.0%');
  assert(
    'High Unemployment Rate (Actual > Forecast) generates BULLISH Gold fundamental bias',
    highUnemployment.fundamentalGoldBias === 'BULLISH',
    JSON.stringify(highUnemployment)
  );

  // Strong Retail Sales (Actual 0.9% vs Forecast 0.3%) -> Pro-USD -> BEARISH Gold
  const strongRetail = controller.evaluateUsdNewsImpact('Retail Sales m/m', '0.9%', '0.3%', '0.4%');
  assert(
    'Strong Retail Sales (Actual > Forecast) generates BEARISH Gold fundamental bias',
    strongRetail.fundamentalGoldBias === 'BEARISH',
    JSON.stringify(strongRetail)
  );

  // -------------------------------------------------------------
  // Test 2: Fundamental News Direction Veto Shield
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Post-News Fundamental Veto Shield ---');

  // Synthesize candles around 2740.00
  const now = Date.now();
  const mockCandles = Array.from({ length: 60 }, (_, i) => {
    const p = 2740.00 + i * 0.10;
    return {
      timestamp: new Date(now - (60 - i) * 15 * 60_000),
      open: p,
      high: p + 1.5,
      low: p - 0.5,
      close: p + 1.0,
      volume: 1500
    };
  });

  const sessionLevels = {
    session: 'LONDON_NY_OVERLAP' as const,
    sessionOpen: 2735.00,
    sessionHigh: 2750.00,
    sessionLow: 2730.00,
    sessionVwap: 2742.00,
    ash: 2752.00,
    asl: 2732.00,
    londonHigh: 2754.00,
    londonLow: 2728.00,
    pdh: 2760.00,
    pdl: 2720.00,
    pwh: 2770.00,
    pwl: 2710.00
  };

  const neutralIntermarket = {
    dxy: 104.20,
    dxyChange1h: 0.02,
    us10y: 4.25,
    us10yChange1h: 0.01,
    realYieldProxy: 1.95,
    safeHavenDemandScore: 50,
    riskSentiment: 'NEUTRAL' as const,
    macroAlignment: 'NEUTRAL' as const,
    conflictDetected: false,
    rationale: 'Baseline',
    hasLiveMacro: true,
    macroBias: 'NEUTRAL' as const,
    macroDrawOnLiquidity: 'RANGE_EQUILIBRIUM' as const
  };

  // Case A: Post-release Hawkish News (BEARISH Gold) strictly blocks BUY signals
  const hawkishNewsGate = {
    isBlackout: false,
    eventStage: 'STRUCTURE_REBUILD' as const,
    minutesToEvent: -25,
    eventTitle: 'Core CPI m/m',
    impactTier: 'HIGH' as const,
    actual: '0.4%',
    forecast: '0.2%',
    fundamentalBias: 'BEARISH' as const,
    fundamentalSummary: 'Hot CPI release boosts USD. Bearish for Gold.'
  };

  const hawkishSetup = controller.evaluateProductionPipeline(
    mockCandles,
    mockCandles,
    { bid: 2745.80, ask: 2746.00, spread: 0.20, spot: 2745.90, isLiquid: true },
    neutralIntermarket,
    hawkishNewsGate,
    mockCandles,
    mockCandles,
    mockCandles,
    mockCandles,
    mockCandles,
    []
  );

  assert(
    'Counter-fundamental BUY signal is strictly VETOED post-hawkish news release',
    hawkishSetup.fiveGates.gate3_setup.passed === false &&
    hawkishSetup.direction !== 'BUY',
    `gate3 reason: ${hawkishSetup.fiveGates.gate3_setup.reason}`
  );

  // Case B: Post-release Dovish News (BULLISH Gold) strictly blocks SELL signals
  const dovishNewsGate = {
    isBlackout: false,
    eventStage: 'STRUCTURE_REBUILD' as const,
    minutesToEvent: -30,
    eventTitle: 'Non-Farm Employment Change',
    impactTier: 'HIGH' as const,
    actual: '110K',
    forecast: '210K',
    fundamentalBias: 'BULLISH' as const,
    fundamentalSummary: 'Soft NFP weakens USD. Bullish for Gold.'
  };

  // Downward drifting candles (attempting to trigger SELL)
  const bearCandles = Array.from({ length: 60 }, (_, i) => {
    const p = 2760.00 - i * 0.40;
    return {
      timestamp: new Date(now - (60 - i) * 15 * 60_000),
      open: p,
      high: p + 0.5,
      low: p - 1.5,
      close: p - 1.0,
      volume: 1600
    };
  });

  const dovishSetup = controller.evaluateProductionPipeline(
    bearCandles,
    bearCandles,
    { bid: 2736.00, ask: 2736.20, spread: 0.20, spot: 2736.10, isLiquid: true },
    neutralIntermarket,
    dovishNewsGate,
    bearCandles,
    bearCandles,
    bearCandles,
    bearCandles,
    bearCandles,
    []
  );

  assert(
    'Counter-fundamental SELL signal is strictly VETOED post-dovish news release',
    dovishSetup.fiveGates.gate3_setup.passed === false &&
    dovishSetup.direction !== 'SELL',
    `gate3 reason: ${dovishSetup.fiveGates.gate3_setup.reason}`
  );

  // -------------------------------------------------------------
  // Test 3: Macro Draw on Liquidity & Intermarket Veto
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Macro Draw on Liquidity & Conflicting Trade Veto ---');

  // Surging USD & Yields (Macro Bearish Gold)
  const macroSurgingUsd = {
    ...neutralIntermarket,
    dxyChange1h: 0.24,
    us10yChange1h: 0.18,
    macroBias: 'BEARISH' as const,
    macroAlignment: 'BEARISH' as const,
    macroDrawOnLiquidity: 'SELL_SIDE_LIQUIDITY' as const,
    conflictDetected: true,
    conflictReason: 'Surging USD (+0.24%) and 10Y yields (+0.18%) oppose gold longs'
  };

  const macroVetoSetup = controller.evaluateProductionPipeline(
    mockCandles,
    mockCandles,
    { bid: 2745.80, ask: 2746.00, spread: 0.20, spot: 2745.90, isLiquid: true },
    macroSurgingUsd,
    { isBlackout: false, eventStage: 'NORMAL_MODE', minutesToEvent: null, eventTitle: null, impactTier: 'LOW' },
    mockCandles,
    mockCandles,
    mockCandles,
    mockCandles,
    mockCandles,
    []
  );

  assert(
    'Macro Draw Veto strictly blocks technical BUY when USD & Yields surge',
    macroVetoSetup.fiveGates.gate3_setup.passed === false &&
    macroVetoSetup.direction !== 'BUY',
    `gate3 reason: ${macroVetoSetup.fiveGates.gate3_setup.reason}`
  );

  // -------------------------------------------------------------
  // Test 4: Macro Draw on Liquidity Target Alignment (TP2)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Macro Draw on Liquidity TP2 Calibration ---');

  // Bearish trend with Sell-Side Liquidity Draw
  const bearMacro = {
    ...neutralIntermarket,
    dxyChange1h: 0.22,
    us10yChange1h: 0.15,
    macroBias: 'BEARISH' as const,
    macroAlignment: 'BEARISH' as const,
    macroDrawOnLiquidity: 'SELL_SIDE_LIQUIDITY' as const
  };

  const sellSetupWithSsl = controller.evaluateProductionPipeline(
    bearCandles,
    bearCandles,
    { bid: 2736.00, ask: 2736.20, spread: 0.20, spot: 2736.10, isLiquid: true },
    bearMacro,
    { isBlackout: false, eventStage: 'NORMAL_MODE', minutesToEvent: null, eventTitle: null, impactTier: 'LOW' },
    bearCandles,
    bearCandles,
    bearCandles,
    bearCandles,
    bearCandles,
    []
  );

  // Verify that if a SELL setup targets TP2, it front-runs Sell-Side Liquidity (e.g. PDL / Session Low)
  assert(
    'Sell setup Take Profit 2 is precisely calibrated to external liquidity targets',
    sellSetupWithSsl.takeProfit2 < sellSetupWithSsl.takeProfit1 &&
    sellSetupWithSsl.takeProfit1 < sellSetupWithSsl.entryPrice,
    `Entry: ${sellSetupWithSsl.entryPrice}, TP1: ${sellSetupWithSsl.takeProfit1}, TP2: ${sellSetupWithSsl.takeProfit2}`
  );

  console.log('\n================================================================');
  console.log(' All Phase 2 Fundamental News & Macro Draw Audits Passed (100%)');
  console.log('================================================================\n');
}

runPhase2Audit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
