import { Controller, Get, Post, Body, Req, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubscriptionService } from './subscription.service';
import { PayHeroService } from './payhero.service';
import { EntitlementService } from './entitlement.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly payHeroService: PayHeroService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get('my-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription details, usage telemetry & billing history' })
  async getMySubscription(@Req() req: any) {
    return this.subscriptionService.getUserSubscriptionDetails(req.user.userId);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans (Free Trial, Basic, Advanced, Pro)' })
  async getPlans() {
    return this.subscriptionService.getAvailablePlans();
  }

  @Post('payhero/stk-push')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate PayHero M-Pesa STK Push payment for plan subscription' })
  async initiateStkPush(@Req() req: any, @Body() body: { planId: string; phoneNumber: string }) {
    return this.payHeroService.initiateStkPush(req.user.userId, body.planId, body.phoneNumber);
  }

  @Post('payhero/webhook')
  @ApiOperation({ summary: 'PayHero payment notification webhook (Public callback)' })
  async handlePayHeroWebhook(@Body() payload: any) {
    return this.payHeroService.handlePayHeroWebhook(payload);
  }

  @Post('cancel-auto-renew')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription auto-renewal at period end' })
  async cancelAutoRenew(@Req() req: any) {
    return this.subscriptionService.cancelAutoRenew(req.user.userId);
  }

  @Post('reactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate subscription auto-renewal' })
  async reactivateSubscription(@Req() req: any) {
    return this.subscriptionService.reactivateSubscription(req.user.userId);
  }

  @Post('upgrade-instant')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Instant plan upgrade for Superadmin / Admin / Testing' })
  async upgradeInstant(@Req() req: any, @Body() body: { plan?: string; planCode?: string }) {
    return this.subscriptionService.upgradeInstant(req.user.userId, body.planCode || body.plan || 'PRO');
  }

  @Get('admin/financials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Superadmin Financial Command Center & PayHero payment reconciliation table' })
  async getAdminFinancials() {
    return this.subscriptionService.getAdminFinancialOverview();
  }
}
