import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService) {}

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
}
