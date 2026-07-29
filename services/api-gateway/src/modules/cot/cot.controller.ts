import { Controller, Get, Query } from '@nestjs/common';
import { CotService } from './cot.service';

@Controller('cot')
export class CotController {
  constructor(private readonly cotService: CotService) {}

  @Get('summary')
  async getCotSummary(@Query('symbol') symbol?: string) {
    if (symbol) {
      return this.cotService.getCotSummary(symbol);
    }
    return this.cotService.getAllCotSummaries();
  }
}
