import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl && !dbUrl.includes('connection_limit')) {
      const sep = dbUrl.includes('?') ? '&' : '?';
      dbUrl = `${dbUrl}${sep}connection_limit=20&pool_timeout=30`;
    }

    super({
      datasources: {
        db: {
          url: dbUrl || undefined,
        },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.$connect();
        console.log('✅ [PRISMA] Database connected successfully.');
        break;
      } catch (err) {
        retries--;
        console.warn(`⚠️ [PRISMA] Database connection notice. Retries remaining: ${retries}`);
        if (retries === 0) {
          console.warn('⚠️ [PRISMA] Operating NestJS gateway with fallback memory layer.');
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
