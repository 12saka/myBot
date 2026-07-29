import { Module } from '@nestjs/common';
import { CotService } from './cot.service';
import { CotController } from './cot.controller';

@Module({
  controllers: [CotController],
  providers: [CotService],
  exports: [CotService],
})
export class CotModule {}
