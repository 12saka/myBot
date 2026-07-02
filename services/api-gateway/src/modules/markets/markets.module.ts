import { Module, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  @Get('tickers')
  getTickers(@Query('type') type?: string) {
    return { message: 'Live tickers — integrate with market data provider', type };
  }

  @Get('ticker/:symbol')
  getTicker(@Param('symbol') symbol: string) {
    return { message: `Ticker for ${symbol}`, symbol };
  }

  @Get('orderbook/:symbol')
  getOrderBook(@Param('symbol') symbol: string) {
    return { message: `Order book for ${symbol}`, symbol };
  }
}

@Module({ controllers: [MarketsController] })
export class MarketsModule {}
