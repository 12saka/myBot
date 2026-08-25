import { Module } from '@nestjs/common';
import { AcademyController } from './academy.controller';
import { AcademyService } from './academy.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InstructorModule } from '../instructor/instructor.module';

@Module({
  imports: [PrismaModule, InstructorModule],
  controllers: [AcademyController],
  providers: [AcademyService],
  exports: [AcademyService],
})
export class AcademyModule {}
