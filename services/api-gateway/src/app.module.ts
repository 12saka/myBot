import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MarketsModule } from './modules/markets/markets.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { SignalsModule } from './modules/signals/signals.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    HealthModule,
    AuthModule,
    UsersModule,
    MarketsModule,
    PortfolioModule,
    SignalsModule,
    WalletModule,
    NotificationsModule,
  ],
})
export class AppModule {}
