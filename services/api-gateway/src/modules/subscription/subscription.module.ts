import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PayHeroService } from './payhero.service';
import { EntitlementService } from './entitlement.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PayHeroService, EntitlementService],
  exports: [SubscriptionService, PayHeroService, EntitlementService],
})
export class SubscriptionModule {}
