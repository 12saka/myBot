import { Module, Controller, Get, Param, Query, Injectable } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MarketsService } from './markets.service';
import { PrismaModule } from '../prisma/prisma.module';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tickers')
  async getTickers() {
    const list = await this.prisma.marketData.findMany({
      orderBy: { symbol: 'asc' },
    });

    const meta: Record<string, { name: string, marketCap: number, type: string }> = {
      'BTC':    { name: 'Bitcoin',          marketCap: 1260000000000, type: 'crypto' },
      'ETH':    { name: 'Ethereum',         marketCap: 380000000000,  type: 'crypto' },
      'SOL':    { name: 'Solana',           marketCap: 82000000000,   type: 'crypto' },
      'BNB':    { name: 'Binance Coin',     marketCap: 64000000000,   type: 'crypto' },
      'XRP':    { name: 'Ripple',           marketCap: 35000000000,   type: 'crypto' },
      'AAPL':   { name: 'Apple Inc.',       marketCap: 3100000000000, type: 'stock' },
      'TSLA':   { name: 'Tesla Inc.',       marketCap: 750000000000,  type: 'stock' },
      'NVDA':   { name: 'NVIDIA Corp.',     marketCap: 2800000000000, type: 'stock' },
      'MSFT':   { name: 'Microsoft Corp.',  marketCap: 3050000000000, type: 'stock' },
      'AMZN':   { name: 'Amazon.com Inc.',  marketCap: 1950000000000, type: 'stock' },
      'US30':   { name: 'Dow Jones (US30)', marketCap: 0, type: 'index' },
      'US100':  { name: 'NASDAQ 100',       marketCap: 0, type: 'index' },
      'SPX500': { name: 'S&P 500',          marketCap: 0, type: 'index' },
      'DAX40':  { name: 'DAX 40',           marketCap: 0, type: 'index' },
      'GOLD':   { name: 'Gold (XAU/USD)',   marketCap: 0, type: 'commodity' },
      'OIL':    { name: 'Crude Oil (WTI)',  marketCap: 0, type: 'commodity' },
      'EUR/USD': { name: 'Euro / US Dollar',     marketCap: 0, type: 'forex' },
      'GBP/USD': { name: 'Pound / US Dollar',    marketCap: 0, type: 'forex' },
      'USD/JPY': { name: 'US Dollar / Yen',      marketCap: 0, type: 'forex' },
    };

    return list.map(item => {
      const info = meta[item.symbol] || { name: item.symbol, marketCap: 0, type: 'crypto' as const };
      
      // Generate a realistic stable dynamic changePct24h using the symbol char codes
      let charSum = 0;
      for (let i = 0; i < item.symbol.length; i++) charSum += item.symbol.charCodeAt(i);
      const mockChange = parseFloat(((charSum % 7) - 3 + (charSum % 10) / 10).toFixed(2));

      return {
        symbol: item.symbol,
        price: item.bidPrice,
        changePct24h: mockChange,
        volume24h: item.volume24h,
        marketCap: info.marketCap,
        type: info.type,
        name: info.name,
      };
    });
  }

  @Get('ticker/:symbol')
  async getTicker(@Param('symbol') symbol: string) {
    const item = await this.prisma.marketData.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    return item;
  }

  @Get('history/:symbol')
  async getHistory(@Param('symbol') symbol: string) {
    const cleanSymbol = symbol.toUpperCase().replace('/USD', '');
    const list = await this.prisma.historicalCandle.findMany({
      where: { symbol: cleanSymbol, interval: '1h' },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
    return list;
  }

  @Get('orderbook/:symbol')
  getOrderBook(@Param('symbol') symbol: string) {
    return {
      symbol: symbol.toUpperCase(),
      bids: [
        { price: 64200.0, size: 0.15 },
        { price: 64195.5, size: 0.84 },
      ],
      asks: [
        { price: 64205.0, size: 0.22 },
        { price: 64210.0, size: 1.15 },
      ],
    };
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
