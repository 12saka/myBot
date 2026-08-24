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
    let aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
    if (!aiServiceUrl.startsWith('http://') && !aiServiceUrl.startsWith('https://')) {
      aiServiceUrl = `https://${aiServiceUrl}`;
    }
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

    let response: any = null;
    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        const signatureHeaders = generateHmacSignature(body, apiKey);

        response = await axios.post(`${aiServiceUrl}/ai/chat`, body, {
          headers: {
            'X-AI-API-Key': apiKey,
            ...signatureHeaders,
          },
          timeout: 45000, // 45s to allow Render Python service to wake up from cold boot
        });
        break; // Success!
      } catch (err: any) {
        const status = err.response?.status;
        console.error(`[CopilotService] Python AI call attempt ${attempt}/${maxAttempts} failed:`, err.message, 'Status:', status);
        
        if ((status === 502 || status === 503 || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') && attempt < maxAttempts) {
          console.warn(`[CopilotService] AI Service is waking up on Render (status ${status || err.code}). Retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
        } else {
          const fallbackDetail = err.response?.data?.reply || err.response?.data?.detail || err.response?.data?.message;
          return {
            reply: fallbackDetail || "⚠️ **TradeMind AI Copilot**: Analytical backend is currently waking up on Render (free tier cold start). Please wait ~15-30 seconds and send your query again.",
            timestamp: new Date().toISOString(),
          };
        }
      }
    }

    if (response && response.data) {
      return {
        reply: response.data.reply,
        timestamp: response.data.timestamp || new Date().toISOString(),
      };
    }

    return {
      reply: "⚠️ **TradeMind AI Copilot**: Analytical backend is currently waking up on Render. Please send your query again in a moment.",
      timestamp: new Date().toISOString(),
    };
  }
}
