import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  private getWeekStartDate(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  async getUserSubscriptionAndPlan(userId: string) {
    let sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    // Auto-create 14-Day Free Trial if no subscription record exists
    if (!sub) {
      let freePlan = await this.prisma.plan.findUnique({ where: { code: 'FREE_TRIAL' } });
      if (!freePlan) {
        freePlan = await this.prisma.plan.create({
          data: {
            name: '14-Day Free Trial',
            code: 'FREE_TRIAL',
            description: 'Full access 14-day trial with 10 weekly signals',
            priceKes: 0,
            priceUsd: 0,
            trialDays: 14,
            signalLimitWeekly: 10,
            aiAnalysisLevel: 'BASIC',
            academyAccessLevel: 'FULL',
            marketAssets: 'CRYPTO,FOREX',
            advancedIndicators: false,
          },
        });
      }

      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      sub = await this.prisma.subscription.create({
        data: {
          userId,
          planId: freePlan.id,
          planType: 'FREE_TRIAL',
          status: 'TRIALING',
          trialStart,
          trialEnd,
          currentPeriodStart: trialStart,
          currentPeriodEnd: trialEnd,
          nextBillingDate: trialEnd,
          autoRenew: true,
          paymentMethod: 'MPESA',
        },
        include: { plan: true },
      });
    }

    return sub;
  }

  async getUsageTelemetry(userId: string) {
    const sub = await this.getUserSubscriptionAndPlan(userId);
    const weekStartDate = this.getWeekStartDate();

    let usage = await this.prisma.usageLimit.findUnique({
      where: { userId_weekStartDate: { userId, weekStartDate } },
    });

    if (!usage) {
      usage = await this.prisma.usageLimit.create({
        data: { userId, weekStartDate, signalCount: 0, aiAnalysisCount: 0 },
      });
    }

    const weeklyLimit = sub.plan?.signalLimitWeekly ?? (sub.planType === 'ADVANCED' ? 50 : sub.planType === 'PRO' ? 100 : 10);
    const signalsUsed = usage.signalCount;
    const signalsRemaining = Math.max(0, weeklyLimit - signalsUsed);

    return {
      subscription: sub,
      weeklySignalsUsed: signalsUsed,
      weeklySignalLimit: weeklyLimit,
      signalsRemaining,
      aiAnalysisCount: usage.aiAnalysisCount,
      aiAnalysisLevel: sub.plan?.aiAnalysisLevel || 'BASIC',
      academyAccessLevel: sub.plan?.academyAccessLevel || 'FULL',
      isLimitReached: signalsUsed >= weeklyLimit,
    };
  }

  async checkAndConsumeSignal(userId: string) {
    const telemetry = await this.getUsageTelemetry(userId);

    if (telemetry.isLimitReached) {
      throw new ForbiddenException(
        `Weekly signal limit reached (${telemetry.weeklySignalsUsed}/${telemetry.weeklySignalLimit}). Upgrade to Advanced or Pro for higher signal capacity!`
      );
    }

    const weekStartDate = this.getWeekStartDate();
    await this.prisma.usageLimit.update({
      where: { userId_weekStartDate: { userId, weekStartDate } },
      data: { signalCount: { increment: 1 } },
    });

    return {
      consumed: 1,
      weeklySignalsUsed: telemetry.weeklySignalsUsed + 1,
      weeklySignalLimit: telemetry.weeklySignalLimit,
      signalsRemaining: telemetry.signalsRemaining - 1,
    };
  }
}
