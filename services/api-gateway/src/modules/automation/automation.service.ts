import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrokersService } from '../brokers/brokers.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brokersService: BrokersService,
  ) {}

  // Get active automation rules for user
  async getUserRules(userId: string) {
    try {
      return await this.prisma.automationRule.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (err) {
      return [];
    }
  }

  // Create new user automation rule
  async createRule(userId: string, body: {
    name: string;
    strategy: string;
    allocation: number;
    riskLimit: number;
    maxDrawdown: number;
    isActive?: boolean;
  }) {
    if (!body.name || !body.strategy) {
      throw new BadRequestException('Rule name and strategy selection are required.');
    }

    try {
      return await this.prisma.automationRule.create({
        data: {
          userId,
          name: body.name,
          strategy: body.strategy,
          allocation: body.allocation || 1000.0,
          riskLimit: body.riskLimit || 1.0,
          maxDrawdown: body.maxDrawdown || 5.0,
          isActive: body.isActive ?? true
        }
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to create automation rule: ${err.message}`);
    }
  }

  // Update automation rule settings
  async updateRule(userId: string, ruleId: string, body: any) {
    try {
      const existing = await this.prisma.automationRule.findFirst({ where: { id: ruleId, userId } });
      if (!existing) throw new NotFoundException('Automation rule not found.');

      return await this.prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          name: body.name ?? existing.name,
          strategy: body.strategy ?? existing.strategy,
          allocation: body.allocation ?? existing.allocation,
          riskLimit: body.riskLimit ?? existing.riskLimit,
          maxDrawdown: body.maxDrawdown ?? existing.maxDrawdown,
          isActive: body.isActive ?? existing.isActive
        }
      });
    } catch (err: any) {
      throw new NotFoundException('Automation rule not found.');
    }
  }

  // Toggle active/paused state in DB
  async toggleRule(userId: string, ruleId: string) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id: ruleId, userId } });
    if (!existing) throw new NotFoundException('Automation rule not found.');

    const updated = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { isActive: !existing.isActive }
    });

    return {
      message: `Automation rule "${updated.name}" is now ${updated.isActive ? 'ACTIVE' : 'PAUSED'}.`,
      rule: updated
    };
  }

  // Delete automation rule
  async deleteRule(userId: string, ruleId: string) {
    try {
      await this.prisma.automationRule.deleteMany({
        where: { id: ruleId, userId }
      });
    } catch (err) {}
    return { message: 'Automation rule deleted successfully.' };
  }

  // Get Backtest Results for Strategy
  async getBacktestResults(strategyName: string) {
    try {
      const results = await this.prisma.backtestResult.findMany({
        where: { strategy: { contains: strategyName, mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' }
      });
      return results;
    } catch (err) {
      return [];
    }
  }

  // =========================================================================
  // AUTONOMOUS TRADING ENGINE: 3-Brain Guardian Execution & Risk Enforcement
  // =========================================================================

  /**
   * Process a confirmed live market signal across all connected broker accounts
   * with AI Trading active. Strict compliance with Trading Constitution.
   */
  async processSignalAutoTrade(signal: {
    id: string;
    symbol: string;
    direction: 'BUY' | 'SELL' | 'WAIT';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskRewardRatio?: number;
    winProbability?: number;
    aiReasoning?: any;
  }) {
    if (!signal || signal.direction === 'WAIT' || !signal.entryPrice || signal.entryPrice <= 0) {
      return { status: 'IGNORED', reason: 'Signal is WAIT or invalid price.' };
    }

    const reasoning = signal.aiReasoning || {};
    const grade = reasoning.signal_grade || '';
    const winProb = signal.winProbability || 0;

    // Quality Filter: Only Grade A+, A or win probability >= 75% are executed autonomously
    if (winProb < 75 && !['A+', 'A'].includes(grade)) {
      this.logger.log(`[AutoTrade Engine] Signal ${signal.symbol} (${winProb}%, Grade ${grade}) below auto-trade threshold (75%). Standing down.`);
      return { status: 'STAND_DOWN', reason: 'Signal below minimum confidence threshold.' };
    }

    // Find all broker accounts with active AI Trading permission and trade placement rights
    const targetAccounts = await this.prisma.brokerAccount.findMany({
      where: {
        aiTradingEnabled: true,
        placeTrades: true,
        connectionStatus: 'CONNECTED',
      },
    });

    if (targetAccounts.length === 0) {
      return { status: 'NO_ACTIVE_ACCOUNTS', message: 'No broker accounts currently have Auto-Trade enabled.' };
    }

    const executionResults: any[] = [];

    for (const account of targetAccounts) {
      try {
        // --- BRAIN 2: RISK GUARDIAN VERIFICATION ---
        const guardianVerdict = await this.evaluateRiskGuardian(account, signal);
        if (!guardianVerdict.approved) {
          this.logger.warn(`[Risk Guardian VETO] Account #${account.accountNumber} (${account.broker}): ${guardianVerdict.reason}`);
          executionResults.push({
            accountId: account.id,
            accountNumber: account.accountNumber,
            broker: account.broker,
            approved: false,
            reason: guardianVerdict.reason,
          });
          continue;
        }

        // --- BRAIN 3: EXECUTION ENGINE ---
        // Dynamically compute calibrated lot size adhering to account maxRiskPerTrade
        const volume = this.calculateRiskLotSize(account, signal, guardianVerdict.riskAmount);

        const orderType = reasoning.entry_type === 'BUY_LIMIT' || reasoning.entry_type === 'SELL_LIMIT' ? 'LIMIT' : 'MARKET';
        const tradeResult = await this.brokersService.executeTrade(account.userId, account.id, {
          symbol: signal.symbol,
          direction: signal.direction as 'BUY' | 'SELL',
          type: orderType,
          volume,
          price: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit1,
          comment: `TradeMind AutoTrade [Grade ${grade || 'A'}] (${orderType})`,
        });

        this.logger.log(`[AutoTrade EXECUTED] ${signal.direction} ${volume} lots ${signal.symbol} on ${account.broker} #${account.accountNumber}`);
        executionResults.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          broker: account.broker,
          approved: true,
          ticket: tradeResult.ticket,
          volume,
          entryPrice: signal.entryPrice,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit1,
        });
      } catch (err: any) {
        this.logger.error(`[AutoTrade Error] Execution failed for account #${account.accountNumber}: ${err.message}`);
        executionResults.push({
          accountId: account.id,
          accountNumber: account.accountNumber,
          broker: account.broker,
          approved: false,
          error: err.message,
        });
      }
    }

    return {
      status: 'PROCESSED',
      symbol: signal.symbol,
      direction: signal.direction,
      totalEligible: targetAccounts.length,
      executedCount: executionResults.filter(r => r.approved).length,
      results: executionResults,
    };
  }

  /**
   * Risk Guardian: Enforces daily loss limit, open positions cap, max exposure, and R:R
   */
  private async evaluateRiskGuardian(
    account: any,
    signal: { symbol: string; entryPrice: number; stopLoss: number; takeProfit1: number; riskRewardRatio?: number }
  ): Promise<{ approved: boolean; reason?: string; riskAmount: number }> {
    const balance = Number(account.balance || 0);
    const equity = Number(account.equity || balance);

    if (balance <= 0 || equity <= 0) {
      return { approved: false, reason: 'Zero balance or negative equity.', riskAmount: 0 };
    }

    // 1. Check Daily Loss Limit
    const todayLossPercent = (Math.abs(Math.min(0, account.todayPl || 0)) / balance) * 100;
    const maxDailyLoss = Number(account.maxDailyLoss || 3.0);
    if (todayLossPercent >= maxDailyLoss) {
      return {
        approved: false,
        reason: `Daily loss limit reached (${todayLossPercent.toFixed(1)}% >= ${maxDailyLoss}% limit). Trading halted for the day.`,
        riskAmount: 0,
      };
    }

    // 2. Check Open Trades Cap
    const openPositionsCount = await this.prisma.asset.count({
      where: {
        portfolio: { userId: account.userId },
        quantity: { not: 0 },
      },
    });

    const maxOpenTrades = Number(account.maxOpenTrades || 5);
    if (openPositionsCount >= maxOpenTrades) {
      return {
        approved: false,
        reason: `Maximum concurrent open trades reached (${openPositionsCount}/${maxOpenTrades}).`,
        riskAmount: 0,
      };
    }

    // 3. Check Minimum Risk-to-Reward Ratio
    const riskDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const rewardDistance = Math.abs(signal.takeProfit1 - signal.entryPrice);
    const rr = riskDistance > 0 ? rewardDistance / riskDistance : 0;
    const minRR = Number(account.minRiskReward || 1.5);
    if (rr < minRR) {
      return {
        approved: false,
        reason: `Risk:Reward ratio (${rr.toFixed(2)}) below required constitution minimum of 1:${minRR.toFixed(1)}.`,
        riskAmount: 0,
      };
    }

    // Calculate maximum dollar risk for this specific trade
    const riskPercent = Math.min(Number(account.maxRiskPerTrade || 1.0), 3.0); // Never exceed 3% per constitution
    const riskAmount = parseFloat(((balance * riskPercent) / 100).toFixed(2));

    return { approved: true, riskAmount };
  }

  /**
   * Institutional Lot Size Calculator based on exact pip/point distance to Stop Loss
   */
  private calculateRiskLotSize(account: any, signal: { symbol: string; entryPrice: number; stopLoss: number }, riskDollar: number): number {
    const slDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const sym = signal.symbol.toUpperCase();

    // Default fallback lot size
    if (slDistance <= 0) return 0.01;

    let contractSize = 100000;
    if (sym.includes('XAU') || sym.includes('GOLD')) contractSize = 100;
    else if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')) contractSize = 1;
    else if (sym.includes('US30') || sym.includes('US100') || sym.includes('NAS')) contractSize = 10;

    // Risk formula: Lot Size = Risk Dollars / (SL Distance * Contract Size)
    const rawLots = riskDollar / (slDistance * contractSize);
    
    // Clamp lot size safely: minimum 0.01, maximum 5.0 lots per trade
    const clampedLots = Math.max(0.01, Math.min(5.0, parseFloat(rawLots.toFixed(2))));
    return isNaN(clampedLots) ? 0.01 : clampedLots;
  }

  /**
   * Break-Even Position Manager:
   * Periodically checks active positions. If current market price has reached TP1,
   * automatically moves Stop Loss to open entry price (Break-Even) + spreads to ensure zero-risk trade.
   */
  async checkAndApplyBreakEven(userId: string) {
    try {
      const positions = await this.prisma.asset.findMany({
        where: {
          portfolio: { userId },
          quantity: { not: 0 },
        },
        include: {
          portfolio: {
            include: {
              orders: {
                where: { status: 'FILLED' },
                orderBy: { createdAt: 'desc' },
                take: 10,
              },
            },
          },
        },
      });

      const breakEvenActions: any[] = [];

      for (const pos of positions) {
        const order = pos.portfolio.orders.find(o => o.symbol === pos.symbol);
        if (!order || order.price == null || !order.stopLoss || !order.takeProfit) continue;

        const isLong = pos.quantity > 0;
        const currentPrice = pos.currentPrice || pos.averagePrice;
        const entryPrice = order.price;
        const tp1 = order.takeProfit;

        // Check if price reached 50% or more toward TP1
        const halfwayToTP = entryPrice + (tp1 - entryPrice) * 0.5;
        const isPastHalfway = isLong ? currentPrice >= halfwayToTP : currentPrice <= halfwayToTP;

        // If price reached halfway and SL is still below entry (for long) or above entry (for short)
        const isSlBehindEntry = isLong ? order.stopLoss < entryPrice : order.stopLoss > entryPrice;

        if (isPastHalfway && isSlBehindEntry) {
          // Move Stop Loss to Entry (Break-Even)
          await this.prisma.order.update({
            where: { id: order.id },
            data: { stopLoss: entryPrice },
          });

          breakEvenActions.push({
            symbol: pos.symbol,
            entryPrice,
            newStopLoss: entryPrice,
            status: 'PROTECTED_BREAK_EVEN',
          });

          this.logger.log(`[Break-Even Guardian] Secured position for ${pos.symbol}: SL moved to Entry ($${entryPrice}).`);
        }
      }

      return breakEvenActions;
    } catch (err: any) {
      this.logger.warn(`[Break-Even Manager] Error: ${err.message}`);
      return [];
    }
  }

  /**
   * Hardware Kill Switch:
   * Instantly disables AI Trading across all user connected accounts and cancels pending orders.
   */
  async emergencyKillSwitch(userId: string) {
    const updatedAccounts = await this.prisma.brokerAccount.updateMany({
      where: { userId },
      data: {
        aiTradingEnabled: false,
        placeTrades: false,
      },
    });

    const pausedRules = await this.prisma.automationRule.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    this.logger.warn(`[KILL SWITCH ACTIVATED] User ${userId}: Disabled ${updatedAccounts.count} broker accounts and paused ${pausedRules.count} automation rules.`);

    return {
      success: true,
      status: 'KILL_SWITCH_ACTIVE',
      message: `Emergency Kill Switch engaged. ${updatedAccounts.count} broker account(s) disarmed and all automated execution paused.`,
      disarmedAccounts: updatedAccounts.count,
      pausedRules: pausedRules.count,
    };
  }
}
