import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MarketsModule } from './modules/markets/markets.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { SignalsModule } from './modules/signals/signals.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { CotModule } from './modules/cot/cot.module';
import { BrokersModule } from './modules/brokers/brokers.module';
import { AcademyModule } from './modules/academy/academy.module';
import { StrategiesModule } from './modules/strategies/strategies.module';
import { AutomationModule } from './modules/automation/automation.module';
import { AdminModule } from './modules/admin/admin.module';
import { InstructorModule } from './modules/instructor/instructor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    MarketsModule,
    PortfolioModule,
    SignalsModule,
    WalletModule,
    SubscriptionModule,
    CopilotModule,
    NotificationsModule,
    CalendarModule,
    CotModule,
    BrokersModule,
    AcademyModule,
    StrategiesModule,
    AutomationModule,
    AdminModule,
    InstructorModule,
  ],
})
export class AppModule {}
