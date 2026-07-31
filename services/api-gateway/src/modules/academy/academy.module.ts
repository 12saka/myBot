import { Module } from '@nestjs/common';
import { AcademyController } from './academy.controller';
import { AcademyService } from './academy.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AcademyController],
  providers: [AcademyService],
  exports: [AcademyService],
})
export class AcademyModule {}
