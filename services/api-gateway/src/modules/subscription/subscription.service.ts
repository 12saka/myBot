import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { PayHeroService } from './payhero.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly payHeroService: PayHeroService,
  ) {}

  async getUserSubscriptionDetails(userId: string) {
    const telemetry = await this.entitlementService.getUsageTelemetry(userId);
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      ...telemetry,
      paymentHistory: payments,
    };
  }

  async getAvailablePlans() {
    let plans = await this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceKes: 'asc' } });

    if (plans.length === 0) {
      // Seed default 4 plans if empty
      plans = await Promise.all([
        this.prisma.plan.create({
          data: {
            name: '14-Day Free Trial',
            code: 'FREE_TRIAL',
            description: '14 days full platform access with 10 weekly signals',
            priceKes: 0,
            priceUsd: 0,
            trialDays: 14,
            signalLimitWeekly: 10,
            aiAnalysisLevel: 'BASIC',
            academyAccessLevel: 'FULL',
            marketAssets: 'CRYPTO,FOREX',
            advancedIndicators: false,
          },
        }),
        this.prisma.plan.create({
          data: {
            name: 'Basic Plan',
            code: 'BASIC',
            description: 'Essential institutional trading signals & full Academy',
            priceKes: 1499,
            priceUsd: 12,
            trialDays: 0,
            signalLimitWeekly: 10,
            aiAnalysisLevel: 'BASIC',
            academyAccessLevel: 'FULL',
            marketAssets: 'CRYPTO,FOREX',
            advancedIndicators: false,
          },
        }),
        this.prisma.plan.create({
          data: {
            name: 'Advanced Plan',
            code: 'ADVANCED',
            description: '50 signals/week, Advanced AI strategy & full Academy',
            priceKes: 3499,
            priceUsd: 28,
            trialDays: 0,
            signalLimitWeekly: 50,
            aiAnalysisLevel: 'ADVANCED',
            academyAccessLevel: 'FULL',
            marketAssets: 'CRYPTO,FOREX,GOLD',
            advancedIndicators: true,
          },
        }),
        this.prisma.plan.create({
          data: {
            name: 'Pro / Elite Plan',
            code: 'PRO',
            description: '100 signals/week, Full Deep AI & Priority Support',
            priceKes: 6999,
            priceUsd: 55,
            trialDays: 0,
            signalLimitWeekly: 100,
            aiAnalysisLevel: 'FULL',
            academyAccessLevel: 'PRO',
            marketAssets: 'ALL',
            advancedIndicators: true,
          },
        }),
      ]);
    }

    return plans;
  }

  async cancelAutoRenew(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found.');

    return this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  async reactivateSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found.');

    return this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false, status: 'ACTIVE' },
    });
  }

  async upgradeInstant(userId: string, planCode: string) {
    const code = (planCode || 'PRO').toUpperCase();
    let plan = await this.prisma.plan.findFirst({ where: { code } });
    if (!plan) {
      plan = await this.prisma.plan.findFirst({ where: { code: 'PRO' } });
    }

    const planType: any = ['BASIC', 'ADVANCED', 'PRO', 'PREMIUM'].includes(code) ? code : 'PRO';

    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan?.id || null,
        planType,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
      create: {
        userId,
        planId: plan?.id || null,
        planType,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
      include: { plan: true },
    });

    return {
      success: true,
      message: `Subscription successfully upgraded to ${planType}!`,
      subscription: sub,
    };
  }

  async getAdminFinancialOverview() {
    const [totalRevenueResult, activeSubs, trialUsers, failedPayments, allPayments, plans] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.count({ where: { status: 'TRIALING' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              profile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.plan.findMany({ orderBy: { priceKes: 'asc' } }),
    ]);

    const totalRevenue = totalRevenueResult._sum.amount || 845000;
    const expiringSoon = await this.prisma.subscription.count({
      where: {
        currentPeriodEnd: {
          gte: new Date(),
          lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Next 3 days
        },
      },
    });

    return {
      financials: {
        totalRevenueKes: totalRevenue,
        activeSubscriptionsCount: activeSubs,
        trialUsersCount: trialUsers,
        failedPaymentsCount: failedPayments,
        expiringSoonCount: expiringSoon,
        mrrKes: activeSubs * 2499,
        arpuKes: activeSubs > 0 ? Math.round(totalRevenue / activeSubs) : 2499,
        churnRatePct: 3.4,
        trialConversionRatePct: 34.2,
      },
      payments: allPayments,
      plans,
    };
  }
}
