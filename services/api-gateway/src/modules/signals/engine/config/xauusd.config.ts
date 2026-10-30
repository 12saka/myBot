import { AssetEngineConfig } from '@trademind/shared';

export const XAUUSD_ENGINE_CONFIG: AssetEngineConfig = {
  symbol: 'GOLD',
  profile: 'DAY_TRADING',
  signalManagement: {
    maxActiveSignalsPerAsset: 3,          // Institutional ceiling, never a target
    duplicateSetupSuppression: true,
    maxExposureEnforcement: true,
    maxCombinedRiskR: 2.0,                // 2.0R portfolio risk cap across concurrent positions
    opposingSignalPolicy: 'INVALIDATE_OLD_THESIS_BEFORE_REVERSAL',
    allowConditionalAlternativeScenarios: true, // Shown as CANDIDATE only, never executable
  },
  history: {
    dashboardDefaultLimit: 50,
    detailedRetentionDays: 90,
    retainPerformanceAggregates: true
  },
  analysis: {
    contextTimeframes: ['1week', '1day', '4h'],
    biasTimeframes: ['4h', '1h'],
    setupTimeframes: ['15min', '5min'],
    precisionTimeframe: '1min',          // Optional refinement inside ICZ
    useCompletedCandles: true,
    refreshOnTimeframeClose: true,
    reanalyzeOnMaterialNewsEvent: true,
  },
  entry: {
    requireValidatedSetup: true,
    requireEntryExpiry: true,
    preventStaleEntries: true,
    preventDuplicateSignals: true
  },
  risk: {
    requireStructuralStop: true,
    requireValidatedTargets: true,
    requirePositionSizing: true,
    enforceAccountRiskLimits: true,
    rejectUnacceptableExecutionCosts: true
  },
  safety: {
    blockOnCriticalStaleData: true,
    blockOnInvalidTradeStructure: true,
    blockOnRiskLimitBreach: true,
    requireFinalValidation: true
  },
};
