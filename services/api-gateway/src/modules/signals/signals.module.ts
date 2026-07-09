import { Module, Controller, Get, Post, Body, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import axios from 'axios';

@ApiTags('signals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('signals')
export class SignalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active AI trading signals' })
  async getSignals() {
    // 1. Fetch unexpired signals from database
    const activeSignals = await this.prisma.signal.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSignals.length > 0) {
      return activeSignals;
    }

    // 2. If no active signals are cached, request new signals from Python AI Service
    console.log('[SIGNALS GATEWAY] No active signals in database. Triggering Python AI Service fallback...');
    return [await this.generateSignalRequest('BTC')];
  }

  @Post()
  @ApiOperation({ summary: 'Create a manually generated trading signal' })
  async createSignal(@Body() dto: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    strategy?: string;
    confidence?: number;
    explanation?: string;
  }) {
    const symbol = this.normalizeSymbol(dto.symbol);
    const signal = await this.prisma.signal.create({
      data: {
        symbol,
        direction: dto.direction,
        entryPrice: Number(dto.entryPrice),
        stopLoss: Number(dto.stopLoss),
        takeProfit1: Number(dto.takeProfit1),
        takeProfit2: Number(dto.takeProfit2),
        riskRewardRatio: parseFloat((Math.abs(dto.takeProfit1 - dto.entryPrice) / Math.abs(dto.entryPrice - dto.stopLoss) || 2.0).toFixed(1)),
        winProbability: Number(dto.confidence || 80),
        durationEstimate: '1-2 days',
        aiReasoning: {
          indicators: ['Manually defined structure', 'Support/Resistance breakthrough'],
          explanation: dto.explanation || 'Manual trading signal structured by user analysis.'
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Manual signals last 24h
      },
    });
    return signal;
  }

  @Post('generate')
  @ApiOperation({ summary: 'Request generation of a fresh AI trading signal for a specific market' })
  async generateSignal(@Body() dto: { symbol: string }) {
    const symbol = this.normalizeSymbol(dto.symbol);
    return this.generateSignalRequest(symbol);
  }

  private normalizeSymbol(symbol: string): string {
    const s = symbol.trim().toUpperCase();
    if (['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD'].includes(s)) {
      return s.split('/')[0];
    }
    return s;
  }

  private async generateSignalRequest(symbol: string) {
    // Check if we already have an active unexpired signal for this symbol in database
    const existingSignal = await this.prisma.signal.findFirst({
      where: {
        symbol,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSignal) {
      return existingSignal;
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const apiKey = process.env.AI_SERVICE_API_KEY || 'internal-secret-key';

    // Query recent historical candles cached in database
    let cachedCandles = await this.prisma.historicalCandle.findMany({
      where: { symbol, interval: '1h' },
      orderBy: { timestamp: 'asc' },
      take: 60,
    });

    // If no candles exist for the requested symbol, scale BTC candles as template
    if (cachedCandles.length === 0) {
      const btcCandles = await this.prisma.historicalCandle.findMany({
        where: { symbol: 'BTC', interval: '1h' },
        orderBy: { timestamp: 'asc' },
        take: 60,
      });

      const defaultPrices: Record<string, number> = {
        'BTC': 64200, 'ETH': 3180, 'SOL': 184, 'BNB': 412, 'XRP': 0.62,
        'AAPL': 197, 'TSLA': 248, 'NVDA': 875, 'EUR/USD': 1.085, 'GBP/USD': 1.271, 'USD/JPY': 151.4
      };
      const basePrice = defaultPrices[symbol] || 100.0;

      cachedCandles = btcCandles.map(c => {
        const ratio = basePrice / 64200.0;
        return {
          ...c,
          symbol,
          open: c.open * ratio,
          high: c.high * ratio,
          low: c.low * ratio,
          close: c.close * ratio,
        } as any;
      });
    }

    try {
      const body = {
        symbol,
        timeframe: '1h',
        candles: cachedCandles.map(c => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          timestamp: c.timestamp.toISOString(),
        })),
      };

      const signatureHeaders = generateHmacSignature(body, apiKey);

      const res = await axios.post(`${aiServiceUrl}/ai/predict`, body, {
        headers: { 
          'X-AI-API-Key': apiKey,
          ...signatureHeaders
        },
      });

      // Save the returned prediction and Gemini explanations into the database
      const signal = await this.prisma.signal.create({
        data: {
          symbol: res.data.symbol,
          direction: res.data.direction,
          entryPrice: res.data.entry,
          stopLoss: res.data.stop_loss,
          takeProfit1: res.data.take_profit_1,
          takeProfit2: res.data.take_profit_2,
          riskRewardRatio: 2.5,
          winProbability: parseFloat((res.data.confidence * 100).toFixed(0)), // convert 0.88 -> 88
          durationEstimate: '4h',
          aiReasoning: { 
            indicators: res.data.indicators,
            explanation: res.data.ai_explanation
          },
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // expires in 4h
        },
      });

      return signal;
    } catch (err: any) {
      console.error(`[SIGNALS GATEWAY] Failed to fetch signals for ${symbol} from AI Service:`, err.message);
      throw new Error(`Failed to generate AI signal for ${symbol}`);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a single signal' })
  async getSignal(@Param('id') id: string) {
    const signal = await this.prisma.signal.findUnique({
      where: { id },
    });
    return signal;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or dismiss an active trading signal' })
  async deleteSignal(@Param('id') id: string) {
    await this.prisma.signal.delete({
      where: { id },
    });
    return { success: true };
  }
}

@Module({ controllers: [SignalsController] })
export class SignalsModule {}
