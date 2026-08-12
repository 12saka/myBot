import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AcademyAnalyticsService } from './academy-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AcademyAnalyticsService, PrismaService],
  exports: [AdminService, AcademyAnalyticsService],
})
export class AdminModule {}
