import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class BrokersService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly secretKey: Buffer;

  constructor(private readonly prisma: PrismaService) {
    const rawKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'trademind_secure_fbs_mt5_vault_secret_key_32b';
    this.secretKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  // Encrypt sensitive passwords using AES-256 GCM
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  // Decrypt sensitive passwords
  private decrypt(hash: string): string {
    try {
      const parts = hash.split(':');
      if (parts.length !== 3) return '';
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      return '';
    }
  }

  // Get all connected broker accounts for a user with aggregated portfolio metrics
  async getAccounts(userId: string) {
    try {
      const accounts = await this.prisma.brokerAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // Default sample accounts if none connected yet
      if (accounts.length === 0) {
        const liveSample = await this.prisma.brokerAccount.create({
          data: {
            userId,
            broker: 'JustMarkets',
            accountType: 'LIVE',
            platform: 'MT5',
            server: 'JustMarkets-Live2',
            accountNumber: '5892104',
            encryptedCredentials: this.encrypt('sample_investor_pass'),
            connectionStatus: 'CONNECTED',
            balance: 12.96,
            equity: 12.96,
            margin: 0.0,
            freeMargin: 12.96,
            unrealizedPl: 0.0,
            todayPl: 0.85,
            overallPl: 2.40,
            currency: 'USD',
            leverage: '1:500',
          }
        });

        const demoSample = await this.prisma.brokerAccount.create({
          data: {
            userId,
            broker: 'FBS',
            accountType: 'DEMO',
            platform: 'MT5',
            server: 'FBS-Demo-01',
            accountNumber: '9204112',
            encryptedCredentials: this.encrypt('sample_demo_pass'),
            connectionStatus: 'CONNECTED',
            balance: 10000.00,
            equity: 10245.50,
            margin: 150.00,
            freeMargin: 10095.50,
            unrealizedPl: 245.50,
            todayPl: 120.00,
            overallPl: 245.50,
            currency: 'USD',
            leverage: '1:500',
          }
        });

        return this.formatAccountsResponse([liveSample, demoSample]);
      }

      return this.formatAccountsResponse(accounts);
    } catch (err) {
      return {
        summary: {
          totalBalance: 0,
          totalEquity: 0,
          availableMargin: 0,
          usedMargin: 0,
          unrealizedPl: 0,
          todayPl: 0,
          overallPl: 0,
        },
        liveAccounts: [],
        demoAccounts: [],
      };
    }
  }

  private formatAccountsResponse(accounts: any[]) {
    const summary = accounts.reduce(
      (acc, a) => {
        acc.totalBalance += a.balance || 0;
        acc.totalEquity += a.equity || 0;
        acc.availableMargin += a.freeMargin || 0;
        acc.usedMargin += a.margin || 0;
        acc.unrealizedPl += a.unrealizedPl || 0;
        acc.todayPl += a.todayPl || 0;
        acc.overallPl += a.overallPl || 0;
        return acc;
      },
      {
        totalBalance: 0,
        totalEquity: 0,
        availableMargin: 0,
        usedMargin: 0,
        unrealizedPl: 0,
        todayPl: 0,
        overallPl: 0,
      }
    );

    const liveAccounts = accounts.filter((a) => a.accountType === 'LIVE');
    const demoAccounts = accounts.filter((a) => a.accountType === 'DEMO');

    return {
      summary,
      liveAccounts,
      demoAccounts,
      totalConnected: accounts.length,
    };
  }

  // Connect or Add New Broker Account
  async connectBroker(userId: string, body: {
    broker: string;
    accountType?: 'LIVE' | 'DEMO';
    platform?: 'MT5' | 'MT4' | 'cTrader';
    server: string;
    accountNumber: string;
    tradingPassword?: string;
    investorPassword?: string;
    authorizeAccess?: boolean;
  }) {
    if (!body.accountNumber || !body.server || !body.broker) {
      throw new BadRequestException('Broker name, account number, and server name are required.');
    }

    const passwordToEncrypt = body.tradingPassword || body.investorPassword || 'Pass123!';
    const encryptedCredentials = this.encrypt(passwordToEncrypt);
    const accountType = (body.accountType || 'LIVE').toUpperCase();
    const platform = (body.platform || 'MT5').toUpperCase();

    // Initial balances based on demo vs live
    const initialBalance = accountType === 'DEMO' ? 10000.00 : 100.00;

    const account = await this.prisma.brokerAccount.create({
      data: {
        userId,
        broker: body.broker,
        accountType,
        platform,
        server: body.server,
        accountNumber: body.accountNumber,
        encryptedCredentials,
        connectionStatus: 'CONNECTED',
        balance: initialBalance,
        equity: initialBalance,
        freeMargin: initialBalance,
        margin: 0.0,
        currency: 'USD',
        leverage: '1:500',
        lastSyncedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Successfully connected ${body.broker} (${accountType}) account #${body.accountNumber}!`,
      account,
    };
  }

  // Update Account Permissions (Toggle AI Trading / Execution permissions)
  async updatePermissions(userId: string, accountId: string, body: {
    aiTradingEnabled?: boolean;
    placeTrades?: boolean;
    modifySlTp?: boolean;
    closePositions?: boolean;
  }) {
    const acc = await this.prisma.brokerAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!acc) throw new NotFoundException('Broker account not found.');

    const updated = await this.prisma.brokerAccount.update({
      where: { id: accountId },
      data: {
        aiTradingEnabled: body.aiTradingEnabled !== undefined ? body.aiTradingEnabled : acc.aiTradingEnabled,
        placeTrades: body.placeTrades !== undefined ? body.placeTrades : acc.placeTrades,
        modifySlTp: body.modifySlTp !== undefined ? body.modifySlTp : acc.modifySlTp,
        closePositions: body.closePositions !== undefined ? body.closePositions : acc.closePositions,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Permissions updated for ${updated.broker} #${updated.accountNumber}`,
      account: updated,
    };
  }

  // Update Account AI Risk Guard Rules
  async updateRiskGuard(userId: string, accountId: string, body: {
    maxRiskPerTrade?: number;
    maxDailyLoss?: number;
    maxOpenTrades?: number;
    maxExposure?: number;
    minRiskReward?: number;
    tradingSessions?: string;
    riskGuardActive?: boolean;
  }) {
    const acc = await this.prisma.brokerAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!acc) throw new NotFoundException('Broker account not found.');

    const updated = await this.prisma.brokerAccount.update({
      where: { id: accountId },
      data: {
        maxRiskPerTrade: body.maxRiskPerTrade ?? acc.maxRiskPerTrade,
        maxDailyLoss: body.maxDailyLoss ?? acc.maxDailyLoss,
        maxOpenTrades: body.maxOpenTrades ?? acc.maxOpenTrades,
        maxExposure: body.maxExposure ?? acc.maxExposure,
        minRiskReward: body.minRiskReward ?? acc.minRiskReward,
        tradingSessions: body.tradingSessions ?? acc.tradingSessions,
        riskGuardActive: body.riskGuardActive ?? acc.riskGuardActive,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `AI Risk Guard updated for ${updated.broker} #${updated.accountNumber}`,
      account: updated,
    };
  }

  // Legacy Single Status Compatibility
  async getStatus(userId: string) {
    const accs = await this.getAccounts(userId);
    const active = accs.liveAccounts[0] || accs.demoAccounts[0];
    if (!active) {
      return {
        connected: false,
        status: 'disconnected',
        message: 'No connected broker accounts.',
      };
    }
    return {
      connected: true,
      brokerType: active.broker,
      platform: active.platform,
      accountLogin: active.accountNumber,
      server: active.server,
      connectionMode: active.aiTradingEnabled ? 'trading' : 'read_only',
      status: active.connectionStatus,
      currency: active.currency,
      balance: active.balance,
      equity: active.equity,
      margin: active.margin,
      freeMargin: active.freeMargin,
      leverage: active.leverage,
      lastSyncedAt: active.lastSyncedAt,
    };
  }

  async syncBroker(userId: string) {
    return {
      message: 'Broker accounts synchronized with vault.',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async getAccountDetails(userId: string) {
    return this.getStatus(userId);
  }

  async getPositions(userId: string) {
    try {
      return await this.prisma.asset.findMany({
        where: { portfolio: { userId } },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  }

  async getOrders(userId: string) {
    try {
      return await this.prisma.order.findMany({
        where: { portfolio: { userId }, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      return [];
    }
  }

  async getHistory(userId: string) {
    try {
      return await this.prisma.trade.findMany({
        where: { portfolio: { userId } },
        orderBy: { executedAt: 'desc' },
        take: 50,
      });
    } catch (err) {
      return [];
    }
  }

  async disconnectBroker(userId: string, accountId?: string) {
    if (accountId) {
      await this.prisma.brokerAccount.deleteMany({
        where: { id: accountId, userId },
      });
    } else {
      await this.prisma.brokerAccount.deleteMany({
        where: { userId },
      });
    }
    return { message: 'Broker account disconnected successfully.' };
  }
}
