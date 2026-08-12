import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { InstructorCommunityService } from './instructor-community.service';

@Module({
  imports: [PrismaModule],
  controllers: [InstructorController],
  providers: [InstructorService, InstructorCommunityService],
  exports: [InstructorService, InstructorCommunityService],
})
export class InstructorModule {}
