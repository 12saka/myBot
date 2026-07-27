import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        console.log('✅ [PRISMA] Database connected successfully.');
        try {
          await this.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
          await this.$executeRawUnsafe(`ALTER TABLE "Signal" ADD COLUMN IF NOT EXISTS "strategyKey" TEXT;`);
          console.log('✅ [PRISMA] Auto-migrated "Signal" table columns (userId, strategyKey).');
        } catch (e: any) {
          console.warn(`⚠️ [PRISMA] Column migration notice: ${e.message}`);
        }
        break;
      } catch (err) {
        retries--;
        console.warn(`⚠️ [PRISMA] Database connection failed. Retries remaining: ${retries}`);
        if (retries === 0) {
          console.error('❌ [PRISMA] Could not connect to database. Starting NestJS gateway in degraded state.');
        } else {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
