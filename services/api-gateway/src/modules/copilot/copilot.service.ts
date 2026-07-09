import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmacSignature } from '../../utils/hmac-signer';
import axios from 'axios';

@Injectable()
export class CopilotService {
  constructor(private readonly prisma: PrismaService) {}

  async chatWithCopilot(userId: string, userMessage: string, history: any[]) {
    // 1. Fetch user portfolio assets and wallet balance for AI context
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    const balance = wallet?.balance || 0.0;

    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId },
      include: { assets: true },
    });
    const assets = (portfolio?.assets || []).map((a: any) => ({
      symbol: a.symbol,
      quantity: a.quantity,
      averagePrice: a.averagePrice,
      currentPrice: a.currentPrice,
    }));

    // 2. Prepare payload for the Python AI Service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const apiKey = process.env.AI_SERVICE_API_KEY || 'internal-secret-key';

    const messages = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      content: h.content,
    }));
    messages.push({ role: 'user', content: userMessage });

    const body = {
      messages,
      portfolioContext: {
        balance,
        assets,
      },
    };

    try {
      const signatureHeaders = generateHmacSignature(body, apiKey);

      const response = await axios.post(`${aiServiceUrl}/ai/chat`, body, {
        headers: {
          'X-AI-API-Key': apiKey,
          ...signatureHeaders,
        },
      });

      return {
        reply: response.data.reply,
        timestamp: response.data.timestamp,
      };
    } catch (err: any) {
      console.error('[CopilotService] Python AI call failed, returning fallback.', err.message);
      return {
        reply: "I am having difficulty connecting to my analytical backend. Market sentiment remains bullish. Please try again shortly.",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
