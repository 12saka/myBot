import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayHeroService {
  private readonly logger = new Logger(PayHeroService.name);
  private readonly payheroApiUrl = process.env.PAYHERO_API_URL || 'https://backend.payhero.co.ke/api/v2';
  private readonly payheroAuthHeader = process.env.PAYHERO_AUTH_HEADER || 'Basic YOUR_PAYHERO_AUTH_KEY';

  constructor(private readonly prisma: PrismaService) {}

  async initiateStkPush(userId: string, planId: string, phoneNumber: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Selected subscription plan not found.');

    const externalReference = `TM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create PENDING Payment record
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amount: plan.priceKes > 0 ? plan.priceKes : 1499,
        currency: 'KES',
        provider: 'PAYHERO',
        externalReference,
        status: 'PENDING',
        paymentType: 'SUBSCRIPTION',
        phoneNumber,
      },
    });

    try {
      // In production, invoke PayHero STK Push API
      // Endpoint: POST /api/v2/payments
      this.logger.log(`[PayHero Adapter] Initiating STK Push for ${phoneNumber}, Ref: ${externalReference}, KES ${payment.amount}`);

      // Simulate API call structure
      /*
      const response = await this.http.post(`${this.payheroApiUrl}/payments`, {
        amount: payment.amount,
        phone_number: phoneNumber,
        channel_id: process.env.PAYHERO_CHANNEL_ID || 1,
        provider: 'm-pesa',
        external_reference: externalReference,
        callback_url: `${process.env.API_BASE_URL}/api/v2/subscriptions/payhero/webhook`,
      }, {
        headers: { Authorization: this.payheroAuthHeader },
      });
      */

      return {
        paymentId: payment.id,
        externalReference,
        phoneNumber,
        amount: payment.amount,
        status: 'STK_PUSH_SENT',
        message: `M-Pesa STK Push prompt sent to ${phoneNumber}. Enter your M-Pesa PIN on your phone to complete payment.`,
      };
    } catch (err: any) {
      this.logger.error(`[PayHero Adapter] STK Push failed: ${err.message}`);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: err.message },
      });
      throw new BadRequestException(err.message || 'Failed to initiate PayHero M-Pesa STK Push');
    }
  }

  async handlePayHeroWebhook(payload: any) {
    this.logger.log(`[PayHero Webhook] Received callback: ${JSON.stringify(payload)}`);
    const externalRef = payload?.external_reference || payload?.externalReference;
    const providerTxId = payload?.provider_transaction_id || payload?.transaction_id || payload?.MpesaReceiptNumber;
    const isSuccess = payload?.status === 'SUCCESS' || payload?.status === 'COMPLETED' || payload?.success === true;

    if (!externalRef) return { success: false, reason: 'Missing external_reference' };

    const payment = await this.prisma.payment.findUnique({
      where: { externalReference: externalRef },
    });

    if (!payment) {
      this.logger.warn(`[PayHero Webhook] Payment not found for reference: ${externalRef}`);
      return { success: false, reason: 'Payment record not found' };
    }

    // Idempotency check: if already processed, return success without extending again
    if (payment.status === 'SUCCESS') {
      return { success: true, message: 'Payment already processed (idempotent)' };
    }

    if (isSuccess) {
      // 1. Update Payment status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          providerTransactionId: providerTxId || `MPESA-${Date.now()}`,
          paidAt: new Date(),
        },
      });

      // 2. Update/Activate Subscription
      const sub = await this.prisma.subscription.findUnique({ where: { userId: payment.userId } });
      const currentEnd = sub?.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + 30); // 30 days extension

      await this.prisma.subscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          planId: payment.planId,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: newEnd,
          nextBillingDate: newEnd,
          autoRenew: true,
        },
        update: {
          planId: payment.planId || undefined,
          status: 'ACTIVE',
          currentPeriodEnd: newEnd,
          nextBillingDate: newEnd,
          cancelAtPeriodEnd: false,
        },
      });

      // 3. Dispatch user notification
      try {
        await this.prisma.notification.create({
          data: {
            userId: payment.userId,
            title: '💳 Payment Received & Subscription Active',
            message: `Your payment of KES ${payment.amount} via M-Pesa (Ref: ${providerTxId || externalRef}) was received. Your plan is now ACTIVE until ${newEnd.toLocaleDateString()}.`,
            type: 'PAYMENT',
          },
        });
      } catch (e) {}

      return { success: true, message: 'Subscription activated successfully' };
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: payload?.message || 'M-Pesa payment cancelled or failed',
        },
      });
      return { success: false, reason: 'Payment failed on PayHero' };
    }
  }

  async reconcileTransaction(externalReference: string) {
    const payment = await this.prisma.payment.findUnique({ where: { externalReference } });
    if (!payment) throw new NotFoundException('Payment transaction not found');

    // Simulate PayHero transaction status lookup
    // GET /api/v2/payments/:reference
    this.logger.log(`[PayHero Reconcile] Checking status for ${externalReference}`);
    return {
      payment,
      reconciledStatus: payment.status,
      lastChecked: new Date(),
    };
  }
}
