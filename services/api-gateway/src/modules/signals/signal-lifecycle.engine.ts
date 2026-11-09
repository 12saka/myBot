/**
 * Signal Lifecycle Replay Engine (pure, deterministic, side-effect free)
 *
 * Replays real OHLC bars (bid-based, as charted by OANDA:XAUUSD on TradingView) against a
 * published signal to determine fills, partial take-profit, stop-outs, expiries and realized R.
 *
 * Why a replay engine instead of 30-second price snapshots:
 *  - Snapshots miss wicks between polls (a stop or target touched for 10 seconds is never seen).
 *  - Snapshots cannot reconcile what happened while the server was asleep / restarting, which
 *    left signals frozen in WAITING_FOR_ENTRY / POSITION_OPEN forever.
 *
 * Execution model (documented assumptions, no synthetic data):
 *  - Bars are bid prices. Ask = bid + spread.
 *  - BUY_LIMIT fills only when ASK <= limit price. SELL_LIMIT fills only when BID >= limit price.
 *    Fill price is the limit price, or the bar open if the market gapped through the limit (better fill).
 *  - BUY positions exit at BID, SELL positions exit at ASK.
 *  - If a bar touches both the stop and a target, the STOP is assumed first (conservative),
 *    unless the bar opened beyond the target.
 *  - 50% of the position is banked at TP1, stop moves to breakeven, runner targets TP2.
 *  - R is measured against the PLANNED risk |entry - initial stop|.
 */

export interface LifecycleBar {
  time: number; // bar open time (ms)
  open: number;
  high: number;
  low: number;
  close: number;
}

export type LifecycleState = 'WAITING_FOR_ENTRY' | 'POSITION_OPEN' | 'PARTIALLY_FILLED' | 'CLOSED';

export type LifecycleEventType =
  | 'FILLED'
  | 'TP1_PARTIAL'
  | 'TP2_HIT'
  | 'SL_HIT'
  | 'BREAKEVEN_EXIT'
  | 'PENDING_SL_INVALIDATED'
  | 'ENTRY_MISSED'
  | 'ORDER_EXPIRED'
  | 'TIME_EXIT';

export interface LifecycleEngineEvent {
  type: LifecycleEventType;
  time: number;
  price: number;
}

export interface LifecycleInput {
  direction: 'BUY' | 'SELL';
  orderType: string;
  entryPrice: number;
  initialStopLoss: number;
  currentStopLoss: number;
  tp1: number;
  tp2: number;
  state: Exclude<LifecycleState, 'CLOSED'>;
  filledPrice: number | null;
  filledAt: number | null;
  /** banked R from a TP1 partial already realised (0 if none) */
  bankedR: number;
  /** remaining open fraction of the position (1 before TP1, 0.5 after) */
  remainingFraction: number;
  orderExpiresAt: number;
  maxHoldMs: number;
  spread: number;
  /** only bars whose open time is >= this are processed */
  processFromTime: number;
  barMs: number;
  /** fraction of distance to TP1 that retires an unfilled limit order */
  runawayFraction?: number;
  tp1PartialFraction?: number;
}

export interface LifecycleResult {
  state: LifecycleState;
  events: LifecycleEngineEvent[];
  filledPrice: number | null;
  filledAt: number | null;
  currentStopLoss: number;
  bankedR: number;
  remainingFraction: number;
  closed: boolean;
  outcome: 'TP2_HIT' | 'SL_HIT' | 'BREAKEVEN' | 'UNFILLED' | 'CANCELLED' | 'TIME_EXIT' | null;
  closeReason: string | null;
  exitPrice: number | null;
  realizedR: number | null;
  /** open time of the next bar that still needs processing */
  nextProcessFromTime: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function replaySignalLifecycle(input: LifecycleInput, bars: LifecycleBar[]): LifecycleResult {
  const dir = input.direction === 'BUY' ? 1 : -1;
  const spread = Math.max(0, input.spread || 0);
  const plannedRisk = Math.abs(input.entryPrice - input.initialStopLoss);
  const runawayFraction = input.runawayFraction ?? 0.9;
  const partial = input.tp1PartialFraction ?? 0.5;
  const isMarket = input.orderType.includes('MARKET');
  const isStop = input.orderType.includes('STOP');

  let state: LifecycleState = input.state;
  let filledPrice = input.filledPrice;
  let filledAt = input.filledAt;
  let currentStop = input.currentStopLoss;
  let bankedR = input.bankedR || 0;
  let remaining = input.remainingFraction > 0 ? input.remainingFraction : 1;
  const events: LifecycleEngineEvent[] = [];
  let nextFrom = input.processFromTime;

  const rOf = (exit: number) => {
    if (!filledPrice || plannedRisk <= 0) return 0;
    return (dir * (exit - filledPrice)) / plannedRisk;
  };

  const finish = (
    type: LifecycleEventType,
    time: number,
    price: number,
    outcome: LifecycleResult['outcome'],
    closeReason: string,
    realizedR: number | null
  ): LifecycleResult => {
    events.push({ type, time, price: round2(price) });
    return {
      state: 'CLOSED',
      events,
      filledPrice,
      filledAt,
      currentStopLoss: currentStop,
      bankedR,
      remainingFraction: 0,
      closed: true,
      outcome,
      closeReason,
      exitPrice: round2(price),
      realizedR: realizedR === null ? null : round2(realizedR),
      nextProcessFromTime: time + input.barMs
    };
  };

  const sorted = [...bars]
    .filter(b => b && isFinite(b.high) && isFinite(b.low) && b.time >= input.processFromTime)
    .sort((a, b) => a.time - b.time);

  for (const bar of sorted) {
    nextFrom = bar.time + input.barMs;
    const askHigh = bar.high + spread;
    const askLow = bar.low + spread;
    const askOpen = bar.open + spread;
    let filledThisBar = false;

    // ---------------- Pending order ----------------
    if (state === 'WAITING_FOR_ENTRY') {
      if (!isMarket && input.orderExpiresAt > 0 && bar.time >= input.orderExpiresAt) {
        return finish('ORDER_EXPIRED', input.orderExpiresAt, bar.open, 'UNFILLED', 'ORDER_EXPIRED', null);
      }

      let fill: number | null = null;
      if (isMarket) {
        fill = dir === 1 ? askOpen : bar.open;
      } else if (isStop) {
        if (dir === 1 && askHigh >= input.entryPrice) fill = Math.max(input.entryPrice, askOpen);
        if (dir === -1 && bar.low <= input.entryPrice) fill = Math.min(input.entryPrice, bar.open);
      } else {
        // LIMIT: Buy at ask <= limit, Sell at bid >= limit
        if (dir === 1 && askLow <= input.entryPrice) fill = askOpen <= input.entryPrice ? askOpen : input.entryPrice;
        if (dir === -1 && bar.high >= input.entryPrice) fill = bar.open >= input.entryPrice ? bar.open : input.entryPrice;
      }

      if (fill === null) {
        // Not filled: stop traded through first => thesis invalidated pre-fill
        const slTouched = dir === 1 ? bar.low <= input.initialStopLoss : askHigh >= input.initialStopLoss;
        if (slTouched) {
          return finish('PENDING_SL_INVALIDATED', bar.time, input.initialStopLoss, 'CANCELLED', 'THESIS_INVALIDATED_PRE_FILL', null);
        }
        const runawayLevel = input.entryPrice + dir * Math.abs(input.tp1 - input.entryPrice) * runawayFraction;
        const ranAway = dir === 1 ? bar.high >= runawayLevel : askLow <= runawayLevel;
        if (ranAway) {
          return finish('ENTRY_MISSED', bar.time, runawayLevel, 'UNFILLED', 'ENTRY_MISSED', null);
        }
        continue;
      }

      filledPrice = round2(fill);
      filledAt = bar.time;
      state = 'POSITION_OPEN';
      filledThisBar = true;
      events.push({ type: 'FILLED', time: bar.time, price: filledPrice });
    }

    // ---------------- Open position ----------------
    if (state === 'POSITION_OPEN' || state === 'PARTIALLY_FILLED') {
      if (filledAt && input.maxHoldMs > 0 && bar.time >= filledAt + input.maxHoldMs && !filledThisBar) {
        const exit = dir === 1 ? bar.open : askOpen;
        return finish('TIME_EXIT', bar.time, exit, 'TIME_EXIT', 'MAX_HOLD_TIME_EXIT', bankedR + remaining * rOf(exit));
      }

      // Exit-side extremes: BUY exits at bid, SELL exits at ask
      const favExtreme = dir === 1 ? bar.high : askLow;
      const advExtreme = dir === 1 ? bar.low : askHigh;
      const exitOpen = dir === 1 ? bar.open : askOpen;

      const hit = (level: number, favourable: boolean) =>
        favourable ? dir * (favExtreme - level) >= 0 : dir * (advExtreme - level) <= 0;

      const openedBeyondTp1 = dir * (exitOpen - input.tp1) >= 0;
      const stopHit = hit(currentStop, false);
      const tp1Hit = hit(input.tp1, true);
      const tp2Hit = hit(input.tp2, true);

      if (state === 'POSITION_OPEN') {
        // Conservative intrabar ordering: stop first unless the bar opened beyond TP1
        if (stopHit && !openedBeyondTp1) {
          const gapped = dir * (exitOpen - currentStop) < 0 && !filledThisBar;
          const exit = gapped ? exitOpen : currentStop;
          return finish('SL_HIT', bar.time, exit, 'SL_HIT', 'STOP_LOSS_REACHED', rOf(exit));
        }
        // On the bar a LIMIT/STOP order fills, the favourable extreme may have printed BEFORE the fill.
        // Never credit a target on that bar (prevents phantom TP hits).
        if (filledThisBar && !isMarket) continue;
        if (tp1Hit) {
          bankedR += partial * rOf(input.tp1);
          remaining = 1 - partial;
          currentStop = filledPrice!;
          state = 'PARTIALLY_FILLED';
          events.push({ type: 'TP1_PARTIAL', time: bar.time, price: round2(input.tp1) });
          if (tp2Hit) {
            return finish('TP2_HIT', bar.time, input.tp2, 'TP2_HIT', 'FULL_TARGET_2_REACHED', bankedR + remaining * rOf(input.tp2));
          }
          // Breakeven stop is evaluated from the next bar (intrabar order after TP1 unknown)
          continue;
        }
        continue;
      }

      // PARTIALLY_FILLED (runner)
      const openedBeyondTp2 = dir * (exitOpen - input.tp2) >= 0;
      if (stopHit && !openedBeyondTp2) {
        const gapped = dir * (exitOpen - currentStop) < 0;
        const exit = gapped ? exitOpen : currentStop;
        return finish('BREAKEVEN_EXIT', bar.time, exit, 'BREAKEVEN', 'RUNNER_BREAKEVEN', bankedR + remaining * rOf(exit));
      }
      if (tp2Hit) {
        return finish('TP2_HIT', bar.time, input.tp2, 'TP2_HIT', 'FULL_TARGET_2_REACHED', bankedR + remaining * rOf(input.tp2));
      }
    }
  }

  return {
    state,
    events,
    filledPrice,
    filledAt,
    currentStopLoss: currentStop,
    bankedR: round2(bankedR),
    remainingFraction: remaining,
    closed: false,
    outcome: null,
    closeReason: null,
    exitPrice: null,
    realizedR: null,
    nextProcessFromTime: nextFrom
  };
}

/**
 * Computes realized R for records written before the replay engine existed.
 * Legacy code booked TP2 as `R1 x 1.5` (fabricated) and recorded limit fills away from the limit price.
 * This recomputes from the stored price levels using the same 50/50 partial model.
 */
export function computeLegacyRealizedR(params: {
  direction: string;
  orderType?: string;
  entryPrice: number;
  stopLoss: number;
  initialStopLoss?: number | null;
  takeProfit1: number;
  takeProfit2?: number | null;
  riskRewardRatio?: number | null;
  filledPrice?: number | null;
  exitPrice?: number | null;
  outcome: string | null;
}): number | null {
  const { outcome } = params;
  if (!outcome) return null;
  const dir = params.direction === 'BUY' ? 1 : -1;
  const entry = Number(params.entryPrice);
  const tp1 = Number(params.takeProfit1);
  const tp2 = Number(params.takeProfit2 || 0);

  let risk = 0;
  if (params.initialStopLoss && Math.abs(entry - params.initialStopLoss) > 0.01) {
    risk = Math.abs(entry - params.initialStopLoss);
  } else if (Math.abs(entry - Number(params.stopLoss)) > 0.01) {
    risk = Math.abs(entry - Number(params.stopLoss));
  } else if (params.riskRewardRatio && params.riskRewardRatio > 0) {
    risk = Math.abs(tp1 - entry) / params.riskRewardRatio;
  }
  if (!(risk > 0)) return null;

  // Limit orders fill at the limit price; market orders use recorded fill if any
  const isLimit = (params.orderType || '').includes('LIMIT');
  const fill = isLimit ? entry : Number(params.filledPrice || entry);
  const r = (px: number) => (dir * (px - fill)) / risk;

  let value: number | null = null;
  if (outcome === 'TP2_HIT' && tp2) value = 0.5 * r(tp1) + 0.5 * r(tp2);
  else if (outcome === 'BREAKEVEN') value = 0.5 * r(tp1);
  else if (outcome === 'SL_HIT') value = r(params.initialStopLoss || Number(params.stopLoss));
  else if (outcome === 'TIME_EXIT' && params.exitPrice) value = r(params.exitPrice);
  return value === null ? null : round2(value);
}
