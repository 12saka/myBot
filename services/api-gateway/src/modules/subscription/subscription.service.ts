import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, SubscriptionStatus } from '@prisma/client';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsGateway,
  ) {}

  async getSubscriptionStatus(userId: string) {
    let sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!sub) {
      sub = await this.prisma.subscription.create({
        data: {
          userId,
          plan: PlanType.STARTER,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    return sub;
  }

  async activateSubscription(
    userId: string,
    plan: PlanType,
    paymentMethod?: 'mpesa' | 'visa',
    phoneNumber?: string,
    billingCycle?: 'monthly' | 'yearly',
  ) {
    if (plan === PlanType.STARTER) {
      return this.prisma.subscription.upsert({
        where: { userId },
        update: {
          plan: PlanType.STARTER,
          status: SubscriptionStatus.ACTIVE,
          endDate: null,
        },
        create: {
          userId,
          plan: PlanType.STARTER,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    if (!paymentMethod) {
      throw new BadRequestException('Payment method is required for Pro or Premium tiers.');
    }

    const isYearly = billingCycle === 'yearly';
    
    // Set prices in Kenyan Shillings (KES) based on user configuration
    let priceKES = 0;
    if (plan === PlanType.PRO) {
      priceKES = isYearly ? 50000 : 5000;
    } else if (plan === PlanType.PREMIUM) {
      priceKES = isYearly ? 200000 : 20000;
    }

    // Exact period duration definition (30 days vs 365 days)
    const durationMs = isYearly ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const endDate = new Date(Date.now() + durationMs);

    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) {
        throw new BadRequestException('M-Pesa phone number is required.');
      }
      console.log(`[SubscriptionService] Dispatching M-Pesa STK prompt of KES ${priceKES} for plan: ${plan} (${billingCycle})`);
    } else {
      console.log(`[SubscriptionService] Charging Visa Card for KES ${priceKES} for plan: ${plan} (${billingCycle})`);
    }

    // Upsert pending subscription
    const sub = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: SubscriptionStatus.TRIAL,
        endDate,
      },
      create: {
        userId,
        plan,
        status: SubscriptionStatus.TRIAL,
        endDate,
      },
    });

    // Simulate callback validation
    setTimeout(async () => {
      try {
        await this.prisma.subscription.update({
          where: { userId },
          data: { status: SubscriptionStatus.ACTIVE },
        });

        // Get or create wallet to retrieve its unique ID
        let wallet = await this.prisma.wallet.findUnique({
          where: { userId },
        });
        if (!wallet) {
          wallet = await this.prisma.wallet.create({
            data: { userId, balance: 0.0 },
          });
        }

        // Add deposit invoice record converted to USD value ledger
        await this.prisma.transaction.create({
          data: {
            amount: priceKES / 130.0,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            paymentId: `KES_SUB_${plan}_${Date.now().toString().slice(-6)}`,
            walletId: wallet.id,
            userId,
          },
        });

        await this.notifications.sendNotification(
          userId,
          'Subscription Activated!',
          `Your TradeMind ${plan} subscription (${billingCycle}) is active in KES currency.`
        );
      } catch (err: any) {
        console.error('[SubscriptionService] Simulation completion failed:', err.message);
      }
    }, 3000);

    return sub;
  }
}
