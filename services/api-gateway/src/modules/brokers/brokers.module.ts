import { Module } from '@nestjs/common';
import { BrokersController } from './brokers.controller';
import { BrokersService } from './brokers.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BrokersController],
  providers: [BrokersService],
  exports: [BrokersService],
})
export class BrokersModule {}
