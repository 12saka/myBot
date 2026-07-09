import { Module, Controller, Get, Post, Patch, Param, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsEnum, IsOptional } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

enum OrderDirection {
  BUY = 'BUY',
  SELL = 'SELL'
}

enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT'
}

class CreateOrderDto {
  @IsString()
  symbol!: string;

  @IsEnum(OrderDirection)
  direction!: OrderDirection;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  stopLoss?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  takeProfit?: number;
}

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user portfolios' })
  async getPortfolio(@Req() req: Request) {
    const userPayload = req.user as any;
    let portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
      include: { assets: true },
    });

    // Create a default portfolio if they don't have one
    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: {
          userId: userPayload.userId,
          name: 'Primary Portfolio',
        },
        include: { assets: true },
      });
    }

    return portfolio;
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all asset positions' })
  async getPositions(@Req() req: Request) {
    const userPayload = req.user as any;
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
    });

    if (!portfolio) {
      return [];
    }

    return this.prisma.asset.findMany({
      where: { portfolioId: portfolio.id },
    });
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get current user order history' })
  async getOrders(@Req() req: Request) {
    const userPayload = req.user as any;
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
    });

    if (!portfolio) {
      return [];
    }

    return this.prisma.order.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        trades: {
          take: 1,
          orderBy: { executedAt: 'desc' },
        },
      },
    });
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get historical performance records' })
  async getPerformance(@Req() req: Request) {
    const userPayload = req.user as any;
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
    });

    if (!portfolio) {
      return [];
    }

    return this.prisma.performance.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { timestamp: 'desc' },
    });
  }

  @Get('risk')
  @ApiOperation({ summary: 'Get portfolio risk stats' })
  async getRiskMetrics(@Req() req: Request) {
    const userPayload = req.user as any;
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
    });

    if (!portfolio) {
      return { diversificationScore: 100.0, riskScore: 0.0, sharpeRatio: 0.0, maxDrawdown: 0.0 };
    }

    return {
      diversificationScore: portfolio.diversificationScore,
      riskScore: portfolio.riskScore,
      sharpeRatio: portfolio.sharpeRatio,
      maxDrawdown: portfolio.maxDrawdown,
    };
  }

  @Post('order')
  @ApiOperation({ summary: 'Submit a new trading order with risk validation checks' })
  async placeOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const userPayload = req.user as any;
    let symbol = dto.symbol.toUpperCase().trim();
    if (['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD'].includes(symbol)) {
      symbol = symbol.split('/')[0];
    }

    // 1. Fetch User details, Wallet, and Risk Profiles
    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.userId },
      include: {
        wallet: true,
        riskProfile: { include: { dailyLossRules: true } },
      },
    });

    if (!user || !user.wallet) {
      throw new BadRequestException('User wallet configuration is missing.');
    }

    // 2. Perform Risk Validation Check (Daily Drawdown rule)
    if (user.riskProfile && user.riskProfile.dailyLossRules.length > 0) {
      const activeRules = user.riskProfile.dailyLossRules.filter(r => r.isTriggered);
      if (activeRules.length > 0) {
        throw new BadRequestException('Order rejected: Daily loss limit rule has been triggered for this account.');
      }
    }

    // 3. Fetch default Portfolio
    let portfolio = await this.prisma.portfolio.findFirst({
      where: { userId: userPayload.userId },
    });

    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: { userId: userPayload.userId, name: 'Primary Portfolio' },
      });
    }

    // 4. Fetch/Estimate execution price (mocked using MarketData)
    const market = await this.prisma.marketData.findUnique({ where: { symbol } });
    const executionPrice = market
      ? dto.direction === 'BUY' ? market.askPrice : market.bidPrice
      : dto.price || (dto.direction === 'BUY' ? 100.0 : 95.0);

    const totalCost = dto.quantity * executionPrice;

    // 5. Check leverage and wallet balance (for BUY orders)
    if (dto.direction === 'BUY' && user.wallet.balance < totalCost) {
      throw new BadRequestException(`Insufficient wallet balance. Cost: ${totalCost} USD, Balance: ${user.wallet.balance} USD.`);
    }

    // 6. Execute Order & Update assets in a single Transaction
    return this.prisma.$transaction(async (tx) => {
      // Create Pending Order
      const order = await tx.order.create({
        data: {
          portfolioId: portfolio.id,
          symbol,
          direction: dto.direction,
          type: dto.type,
          quantity: dto.quantity,
          price: executionPrice,
          status: 'FILLED', // Auto-fill in dev
        },
      });

      // Create execution Trade record
      await tx.trade.create({
        data: {
          portfolioId: portfolio.id,
          orderId: order.id,
          symbol,
          direction: dto.direction,
          quantity: dto.quantity,
          executionPrice,
          commission: totalCost * 0.001, // 0.1% fee
        },
      });

      // Update wallet balance
      const balanceChange = dto.direction === 'BUY' ? -totalCost : totalCost;
      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: {
          balance: { increment: balanceChange },
        },
      });

      // Update asset holdings in portfolio
      const asset = await tx.asset.findFirst({
        where: { portfolioId: portfolio.id, symbol },
      });

      if (dto.direction === 'BUY') {
        if (asset) {
          const newQty = asset.quantity + dto.quantity;
          const newAvg = ((asset.quantity * asset.averagePrice) + totalCost) / newQty;
          await tx.asset.update({
            where: { id: asset.id },
            data: { quantity: newQty, averagePrice: newAvg, currentPrice: executionPrice },
          });
        } else {
          await tx.asset.create({
            data: {
              portfolioId: portfolio.id,
              symbol,
              quantity: dto.quantity,
              averagePrice: executionPrice,
              currentPrice: executionPrice,
            },
          });
        }
      } else {
        // SELL
        if (!asset || asset.quantity < dto.quantity) {
          throw new BadRequestException(`Insufficient asset quantity. Trying to sell ${dto.quantity} ${symbol}, but holding only ${asset ? asset.quantity : 0}.`);
        }

        const newQty = asset.quantity - dto.quantity;
        if (newQty === 0) {
          await tx.asset.delete({ where: { id: asset.id } });
        } else {
          await tx.asset.update({
            where: { id: asset.id },
            data: { quantity: newQty },
          });
        }
      }

      return {
        message: 'Order filled successfully.',
        orderId: order.id,
        direction: dto.direction,
        symbol,
        executionPrice,
        totalCost,
      };
    });
  }

  @Patch('order/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending order owned by the current user' })
  async cancelOrder(@Req() req: Request, @Param('id') id: string) {
    const userPayload = req.user as any;
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        portfolio: {
          userId: userPayload.userId,
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found.');
    }
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Only pending orders can be cancelled. Current status: ${order.status}.`);
    }

    const cancelled = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return {
      message: 'Order cancelled successfully.',
      order: cancelled,
    };
  }
}

@Module({ controllers: [PortfolioController] })
export class PortfolioModule {}
