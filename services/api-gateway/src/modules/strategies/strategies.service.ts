import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StrategiesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.tradingStrategy.count();
      if (count === 0) {
        await this.seedDefaultStrategies();
      }
    } catch (err: any) {
      console.warn(`[StrategiesService] Initial strategy boot check: ${err.message}`);
    }
  }

  private async seedDefaultStrategies() {
    const defaultStrategies = [
      {
        name: 'Trend Following',
        description: 'Ensemble EMA 20/50/200 cross alignment with ADX trend confirmation (>25) and ATR trailing stops.',
        historicalReturn: 28.4,
        winRate: 74.2,
        riskScore: 2,
        maxDrawdown: 6.5,
        isActive: true
      },
      {
        name: 'Smart Money Concept (SMC)',
        description: 'Institutional Fair Value Gap (FVG) retest, Liquidity Sweeps, and Order Block mitigation entries.',
        historicalReturn: 42.1,
        winRate: 81.5,
        riskScore: 3,
        maxDrawdown: 8.2,
        isActive: true
      },
      {
        name: 'Mean Reversion',
        description: 'Bollinger Band 2.5 std dev overextensions with RSI dynamic oversold/overbought momentum reversals.',
        historicalReturn: 19.8,
        winRate: 68.4,
        riskScore: 2,
        maxDrawdown: 5.1,
        isActive: true
      },
      {
        name: 'Breakout Strategy',
        description: 'Volume-backed Opening Range Breakout (ORB) on 15m candle closes with high relative volume (>1.5x RVOL).',
        historicalReturn: 34.6,
        winRate: 72.8,
        riskScore: 4,
        maxDrawdown: 9.8,
        isActive: true
      },
      {
        name: 'AI Signal Following',
        description: 'Autonomous execution of 10-step institutional AI ensemble signal outputs across Forex, Metals & Crypto.',
        historicalReturn: 38.9,
        winRate: 79.4,
        riskScore: 3,
        maxDrawdown: 7.4,
        isActive: true
      }
    ];

    for (const s of defaultStrategies) {
      await this.prisma.tradingStrategy.create({ data: s });
    }
    console.log('[StrategiesService] Successfully seeded 5 institutional trading strategies.');
  }

  async getAllStrategies() {
    try {
      return await this.prisma.tradingStrategy.findMany({
        where: { isActive: true },
        orderBy: { winRate: 'desc' }
      });
    } catch (err) {
      return [];
    }
  }

  async getStrategyById(id: string) {
    try {
      const strategy = await this.prisma.tradingStrategy.findUnique({ where: { id } });
      if (!strategy) throw new NotFoundException('Strategy not found');
      return strategy;
    } catch (err) {
      throw new NotFoundException('Strategy not found');
    }
  }

  async createStrategy(body: any) {
    return this.prisma.tradingStrategy.create({ data: body });
  }

  async updateStrategy(id: string, body: any) {
    return this.prisma.tradingStrategy.update({ where: { id }, data: body });
  }

  async deleteStrategy(id: string) {
    return this.prisma.tradingStrategy.update({ where: { id }, data: { isActive: false } });
  }
}
