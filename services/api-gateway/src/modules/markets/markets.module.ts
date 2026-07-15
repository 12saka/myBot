import { Module, Controller, Get, Param, Query, Injectable } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MarketsService } from './markets.service';
import { PrismaModule } from '../prisma/prisma.module';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketsService: MarketsService
  ) {}

  @Get('tickers')
  async getTickers() {
    const list = await this.prisma.marketData.findMany({
      orderBy: { symbol: 'asc' },
    });

    const stats = this.marketsService.getTickerStats();

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
      const cache = stats[item.symbol] || { price: item.bidPrice, changePct24h: 0.0, volume24h: item.volume24h };

      return {
        symbol: item.symbol,
        price: item.bidPrice,
        changePct24h: cache.changePct24h,
        volume24h: cache.volume24h,
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
  async getHistory(
    @Param('symbol') symbol: string,
    @Query('interval') interval = '1h'
  ) {
    return this.marketsService.getOrFetchCandles(symbol, interval);
  }

  @Get('news')
  async getNews() {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return this.fallbackNews();
    }
    try {
      const response = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          return data.slice(0, 15).map(item => ({
            id: item.id,
            headline: item.headline,
            summary: item.summary,
            source: item.source,
            url: item.url,
            image: item.image,
            datetime: item.datetime,
            related: item.related
          }));
        }
      }
    } catch (err: any) {
      console.warn(`[MarketsController] Finnhub news request failed: ${err.message}`);
    }
    return this.fallbackNews();
  }

  private fallbackNews() {
    return [
      {
        id: 1,
        headline: "Federal Reserve hints at interest rate cuts as inflation moderates to target ranges",
        summary: "The Federal Reserve's recent meetings suggest a growing consensus towards interest rate cuts later this quarter. Policymakers noted encouraging progress on consumer prices index stats.",
        source: "Bloomberg Financial",
        url: "https://bloomberg.com",
        image: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=600&q=80",
        datetime: Math.floor(Date.now() / 1000) - 3600,
        related: "Macro Economy"
      },
      {
        id: 2,
        headline: "Tech giants lead NASDAQ breakout as AI services expand institutional adoption",
        summary: "Institutional inflows into major technology and AI-associated stocks have driven indices to fresh multi-month highs. Investors remain bullish on enterprise software integrations.",
        source: "Reuters Market Wire",
        url: "https://reuters.com",
        image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=600&q=80",
        datetime: Math.floor(Date.now() / 1000) - 7200,
        related: "Technology"
      },
      {
        id: 3,
        headline: "Crypto markets consolidate near key support levels ahead of weekly close",
        summary: "Bitcoin and Ethereum continue to trade within narrow ranges. Volume profiles indicate strategic accumulation by larger wallet entities, while retail volumes remain steady.",
        source: "CoinDesk Analysis",
        url: "https://coindesk.com",
        image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=600&q=80",
        datetime: Math.floor(Date.now() / 1000) - 10800,
        related: "Crypto"
      },
      {
        id: 4,
        headline: "European market indices show mixed performance amid regional currency fluctuations",
        summary: "European equities traded lower as the Euro stabilized against the USD. Analysts point to manufacturing indicators showing moderate contractions in core economic zones.",
        source: "Financial Times",
        url: "https://ft.com",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
        datetime: Math.floor(Date.now() / 1000) - 14400,
        related: "Forex"
      }
    ];
  }

  @Get('orderbook/:symbol')
  async getOrderBook(@Param('symbol') symbol: string) {
    const cleanSymbol = symbol.toUpperCase().replace('/USD', '').trim();
    
    // If crypto, query Binance
    const isCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'].includes(cleanSymbol);
    if (isCrypto) {
      const binanceSym = `${cleanSymbol}USDT`;
      try {
        const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${binanceSym}&limit=5`);
        if (response.ok) {
          const data = await response.json();
          const bids = (data.bids || []).map((b: any) => ({ price: parseFloat(b[0]), size: parseFloat(b[1]) }));
          const asks = (data.asks || []).map((a: any) => ({ price: parseFloat(a[0]), size: parseFloat(a[1]) }));
          return { symbol: symbol.toUpperCase(), bids, asks };
        }
      } catch (err) {}
    }

    // Fallback/Non-crypto: generate high-fidelity spread-based bids/asks around active market price
    const item = await this.prisma.marketData.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    const bidPrice = item ? item.bidPrice : 100.0;
    const askPrice = item ? item.askPrice : 100.05;
    const spread = askPrice - bidPrice;
    
    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: parseFloat((bidPrice - i * (spread * 0.5) - Math.random() * (spread * 0.1)).toFixed(4)),
      size: parseFloat((Math.random() * 2 + 0.1).toFixed(2))
    }));
    
    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: parseFloat((askPrice + i * (spread * 0.5) + Math.random() * (spread * 0.1)).toFixed(4)),
      size: parseFloat((Math.random() * 2 + 0.1).toFixed(2))
    }));

    return { symbol: symbol.toUpperCase(), bids, asks };
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
