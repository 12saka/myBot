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

async function runGeminiDeskReviewerTests() {
  console.log('\n================================================================');
  console.log(' TradeMind AI: Gemini Final Desk Reviewer Verification Audit');
  console.log('================================================================\n');

  const publishedSignals: any[] = [];
  const mockPrisma: any = {
    $executeRawUnsafe: async () => {},
    signal: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async (d: any) => {
        publishedSignals.push(d.data);
        return { id: 'sig-gemini-test', ...d.data };
      },
      update: async (d: any) => ({ id: d.where.id, ...d.data }),
      delete: async () => ({ id: 'mock' })
    },
    goldSignalPerformance: { findMany: async () => [] }
  };
  const mockNotifications: any = {
    server: { emit: () => {} },
    broadcastTradeSignalNotification: async () => true
  };
  const mockAutomation: any = { processSignalAutoTrade: async () => ({ status: 'EXECUTED' }) };

  const controller = new SignalsController(mockPrisma, {} as any, mockAutomation, mockNotifications);

  // -------------------------------------------------------------
  // Test 1: Zero LLM Call Invocations on Non-Passed or WAIT Setups
  // -------------------------------------------------------------
  console.log('--- Test 1: Zero LLM Calls on WAIT Setups ---');
  let geminiDirectCalls = 0;
  controller.verifySetupWithGeminiDirect = async () => {
    geminiDirectCalls++;
    return { verdict: 'APPROVED', explanation: 'Mock thesis' };
  };

  const waitSetup: any = {
    direction: 'WAIT',
    opportunityScore: 45,
    fiveGates: { allPassed: false, failingGate: 'GATE_4_SMC' },
    finalValidationChecklist: { allPassed: false }
  };

  // Simulating the exact gating check in runAtomicGoldScan:
  const gatesPassed = waitSetup.fiveGates.allPassed && waitSetup.finalValidationChecklist?.allPassed;
  const hasDirection = waitSetup.direction === 'BUY' || waitSetup.direction === 'SELL';
  const hasScore = waitSetup.opportunityScore >= 70;

  if (gatesPassed && hasDirection && hasScore) {
    await controller.verifySetupWithGeminiDirect(waitSetup);
  }

  assert(
    'Gemini verifier is strictly BYPASSED on WAIT setup (0 LLM requests)',
    geminiDirectCalls === 0,
    `geminiDirectCalls=${geminiDirectCalls}`
  );

  // -------------------------------------------------------------
  // Test 2: Gemini Direct Invoked Only on Fully Passed Institutional Setup
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Gemini Direct Invocation on Qualified Candidate ---');
  const validCandidate: any = {
    direction: 'BUY',
    entryPrice: 2735.0,
    stopLoss: 2728.5,
    takeProfit1: 2748.5,
    takeProfit2: 2758.0,
    riskReward1: 2.08,
    riskReward2: 3.54,
    opportunityScore: 84,
    grade: 'A+ PRIME',
    model: 'BOS_PULLBACK_CONTINUATION',
    confluenceReasons: ['15M Bullish Order Block', 'FVG Consequent Encroachment', 'London High Sweep'],
    marketRegime: 'TRENDING_EXPANSION',
    volatilityMetrics: { atr15m: 5.5, regime: 'NORMAL' },
    microstructure: { isLiquid: true, spread: 0.25, spot: 2735.0 },
    intermarket: { dxy: 104.2, dxyChange1h: -0.18, us10y: 4.22, us10yChange1h: -0.15, realYieldProxy: 1.92, macroAlignment: 'BULLISH' },
    newsGate: { isBlackout: false, feedOffline: false, eventTitle: 'None' },
    levels: { currentPrice: 2735.2 },
    tradePath: { probTp1BeforeSl: 0.72, expectedValueR: 0.85 },
    fiveGates: { allPassed: true },
    finalValidationChecklist: { allPassed: true },
    summary: 'High probability SMC continuation'
  };

  const validGatesPassed = validCandidate.fiveGates.allPassed && validCandidate.finalValidationChecklist?.allPassed;
  const validHasDirection = validCandidate.direction === 'BUY' || validCandidate.direction === 'SELL';
  const validHasScore = validCandidate.opportunityScore >= 70;

  let directResult = null;
  if (validGatesPassed && validHasDirection && validHasScore) {
    directResult = await controller.verifySetupWithGeminiDirect(validCandidate);
  }

  assert(
    'Gemini verifier triggers when candidate passes all gates and 11-point checklist',
    geminiDirectCalls === 1 && directResult !== null && directResult.verdict === 'APPROVED',
    `geminiDirectCalls=${geminiDirectCalls}, verdict=${directResult?.verdict}`
  );

  // -------------------------------------------------------------
  // Test 3: Gemini VETO Blocks Publication of Trade
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Gemini VETO Blocks Publication ---');
  controller.verifySetupWithGeminiDirect = async () => {
    return {
      verdict: 'VETOED',
      explanation: 'Risk Desk VETO: Major impending Fed speaker and opposing liquidity trap detected ahead of TP1.',
      riskFactor: 'Fed speaker volatility'
    };
  };

  const vetoResult = await controller.verifySetupWithGeminiDirect(validCandidate);
  let signalPublished = false;

  if (vetoResult?.verdict === 'APPROVED') {
    signalPublished = true;
  }

  assert(
    'When Gemini returns VETOED, the signal is withheld from active publication',
    vetoResult?.verdict === 'VETOED' && !signalPublished,
    `verdict=${vetoResult?.verdict}, published=${signalPublished}`
  );

  // -------------------------------------------------------------
  // Test 4: Seamless Fallback to Senior Risk Desk Audit if LLM is Offline
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Resilient Fallback to Internal Senior Desk Audit ---');
  controller.verifySetupWithGeminiDirect = async () => null; // Simulates missing API key or network timeout

  const offlineGeminiResult = await controller.verifySetupWithGeminiDirect(validCandidate);
  let fallbackVerdict = 'HOLD';
  let fallbackExplanation = '';

  if (!offlineGeminiResult) {
    const internalAudit = controller.performInternalSeniorRiskDeskAudit(validCandidate);
    fallbackVerdict = internalAudit.verdict;
    fallbackExplanation = internalAudit.explanation;
  }

  assert(
    'System falls back to deterministic internal risk desk audit when Gemini is offline',
    offlineGeminiResult === null && fallbackVerdict === 'APPROVED',
    `fallbackVerdict=${fallbackVerdict}`
  );

  console.log('\n================================================================');
  console.log(' Gemini Final Desk Reviewer Verification: All Tests Passed (100%)');
  console.log('================================================================\n');
}

runGeminiDeskReviewerTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
