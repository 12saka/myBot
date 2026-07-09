import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { PlanType } from '@prisma/client';

class ActivateSubscriptionDto {
  plan!: PlanType;
  paymentMethod?: 'mpesa' | 'visa';
  phoneNumber?: string;
  billingCycle?: 'monthly' | 'yearly';
}

@ApiTags('subscription')
@ApiBearerAuth()
@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('status')
  async getStatus(@Request() req: any) {
    return this.subscriptionService.getSubscriptionStatus(req.user.id);
  }

  @Post('activate')
  async activate(
    @Request() req: any,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.subscriptionService.activateSubscription(
      req.user.id,
      dto.plan,
      dto.paymentMethod,
      dto.phoneNumber,
      dto.billingCycle,
    );
  }
}
