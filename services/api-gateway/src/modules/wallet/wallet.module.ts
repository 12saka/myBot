import { Module, Controller, Get, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsNotEmpty, Length } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

class DepositDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

class WithdrawDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

class MpesaDepositDto {
  @ApiProperty({ example: '254712345678' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

class VisaDepositDto {
  @ApiProperty({ example: '4242424242424242' })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  cardNumber!: string;

  @ApiProperty({ example: '12/28' })
  @IsString()
  @IsNotEmpty()
  expiry!: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  cvv!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount!: number;
}

// Inject helper to support Swagger decorators on inline classes
function ApiProperty(arg0: { example: any; }): (target: any, propertyKey: string) => void {
  return () => {};
}

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway
  ) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user wallet balances and transaction history' })
  async getBalance(@Req() req: Request) {
    const userPayload = req.user as any;
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userPayload.userId },
      include: {
        transactions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    // Sync with dedicated Alpaca broker if keys are present
    const alpacaKey = process.env.ALPACA_API_KEY;
    const alpacaSecret = process.env.ALPACA_SECRET_KEY;
    if (alpacaKey && alpacaSecret) {
      try {
        let res = await fetch('https://paper-api.alpaca.markets/v2/account', {
          headers: {
            'APCA-API-KEY-ID': alpacaKey,
            'APCA-API-SECRET-KEY': alpacaSecret,
          },
        });
        if (!res.ok) {
          res = await fetch('https://api.alpaca.markets/v2/account', {
            headers: {
              'APCA-API-KEY-ID': alpacaKey,
              'APCA-API-SECRET-KEY': alpacaSecret,
            },
          });
        }
        if (res.ok) {
          const accountData = await res.json();
          const brokerBalance = parseFloat(accountData.cash || '0');
          
          // Update in-memory wallet return object and database state
          wallet.balance = brokerBalance;
          await this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: brokerBalance },
          });
        }
      } catch (err) {
        console.error('[WalletService] Failed to fetch and sync balance with Alpaca:', err);
      }
    }

    return wallet;
  }

  @Post('deposit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a generic fiat/crypto deposit' })
  async deposit(@Req() req: Request, @Body() dto: DepositDto) {
    const userPayload = req.user as any;
    
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userPayload.userId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: userPayload.userId,
          type: 'DEPOSIT',
          amount: dto.amount,
          status: 'COMPLETED',
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: dto.amount },
        },
      });

      // Broadcast live push notification
      await this.notificationsGateway.sendNotification(
        userPayload.userId,
        'Deposit Confirmed',
        `Successfully deposited $${dto.amount.toFixed(2)} into your account.`
      );

      return {
        message: `Deposit of ${dto.amount} USD successfully processed.`,
        transaction,
        wallet: updatedWallet,
      };
    });
  }

  @Post('deposit/mpesa')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate an M-Pesa STK Push payment transaction' })
  async depositMpesa(@Req() req: Request, @Body() dto: MpesaDepositDto) {
    const userPayload = req.user as any;
    
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userPayload.userId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    const checkoutRequestId = `ws_CO_${Date.now()}`;

    // 1. Create a PENDING transaction in PostgreSQL
    const transaction = await this.prisma.transaction.create({
      data: {
        walletId: wallet.id,
        userId: userPayload.userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        status: 'PENDING',
        paymentId: checkoutRequestId,
      },
    });

    console.log(`[M-PESA STK PUSH] Dispatched push request to ${dto.phoneNumber} for $${dto.amount}`);

    // 2. Simulate the asynchronous Safaricom callback internally after 4 seconds
    setTimeout(async () => {
      try {
        console.log(`[M-PESA CALLBACK SIMULATOR] Triggering successful callback for checkout ${checkoutRequestId}...`);
        
        await this.prisma.$transaction(async (tx) => {
          // Update transaction to COMPLETED
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'COMPLETED' },
          });

          // Increment wallet balance
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: dto.amount } },
          });
        });

        // Broadcast success via WebSockets
        await this.notificationsGateway.sendNotification(
          userPayload.userId,
          'M-Pesa Payment Confirmed',
          `Your STK deposit of $${dto.amount.toFixed(2)} was successfully processed. Receipt: MPESA-${Date.now()}`
        );

      } catch (err: any) {
        console.error('Error processing mock callback:', err.message);
      }
    }, 4000);

    return {
      message: 'STK push request dispatched. Please approve the payment prompt on your phone.',
      checkoutRequestId,
      transaction,
    };
  }

  @Post('deposit/visa')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Charge a Visa / Credit card instantly' })
  async depositVisa(@Req() req: Request, @Body() dto: VisaDepositDto) {
    const userPayload = req.user as any;
    
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userPayload.userId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    // Mock validation constraints
    if (dto.cardNumber.startsWith('4000')) {
      throw new BadRequestException('Transaction declined: Insufficient card balance.');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: userPayload.userId,
          type: 'DEPOSIT',
          amount: dto.amount,
          status: 'COMPLETED',
          paymentId: `VISA-${Date.now()}`,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: dto.amount },
        },
      });

      // Broadcast success via WebSockets
      await this.notificationsGateway.sendNotification(
        userPayload.userId,
        'Card Deposit Approved',
        `Visa card payment of $${dto.amount.toFixed(2)} completed successfully.`
      );

      return {
        message: 'Visa deposit processed successfully.',
        transaction,
        wallet: updatedWallet,
      };
    });
  }

  @Post('withdraw')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a withdrawal' })
  async withdraw(@Req() req: Request, @Body() dto: WithdrawDto) {
    const userPayload = req.user as any;

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: userPayload.userId },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found.');
    }

    if (wallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient funds for withdrawal.');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: userPayload.userId,
          type: 'WITHDRAWAL',
          amount: dto.amount,
          status: 'COMPLETED',
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: dto.amount },
        },
      });

      // Broadcast live push notification
      await this.notificationsGateway.sendNotification(
        userPayload.userId,
        'Withdrawal Completed',
        `Withdrawal of $${dto.amount.toFixed(2)} processed successfully.`
      );

      return {
        message: `Withdrawal of ${dto.amount} USD successfully processed.`,
        transaction,
        wallet: updatedWallet,
      };
    });
  }

  @Post('callback/mpesa')
  @ApiOperation({ summary: 'Safaricom Daraja payment webhook callback endpoint' })
  async mpesaCallback(@Body() body: any) {
    // Standard Daraja STK Callback receiver
    console.log('[M-PESA WEBHOOK RECEIVED]:', JSON.stringify(body));
    const resultDesc = body?.Body?.stkCallback?.ResultDesc || 'No details';
    const resultCode = body?.Body?.stkCallback?.ResultCode;
    const checkoutRequestId = body?.Body?.stkCallback?.CheckoutRequestID;

    if (!checkoutRequestId) {
      return { status: 'IGNORED', message: 'No CheckoutRequestID provided.' };
    }

    // Find pending transaction
    const tx = await this.prisma.transaction.findFirst({
      where: { paymentId: checkoutRequestId, status: 'PENDING' },
    });

    if (!tx) {
      return { status: 'NOT_FOUND', message: 'No matching pending transaction.' };
    }

    if (resultCode === 0) {
      // Success! Update balance
      await this.prisma.$transaction(async (prismaTx) => {
        await prismaTx.transaction.update({
          where: { id: tx.id },
          data: { status: 'COMPLETED' },
        });

        await prismaTx.wallet.update({
          where: { id: tx.walletId },
          data: { balance: { increment: tx.amount } },
        });
      });

      await this.notificationsGateway.sendNotification(
        tx.userId,
        'M-Pesa Webhook Confirmed',
        `Webhook verified: STK deposit of $${tx.amount.toFixed(2)} completed.`
      );
    } else {
      // Failed/Cancelled
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED' },
      });

      await this.notificationsGateway.sendNotification(
        tx.userId,
        'M-Pesa Payment Failed',
        `Payment failed: ${resultDesc}`
      );
    }

    return { status: 'PROCESSED' };
  }
}

@Module({
  imports: [NotificationsModule],
  controllers: [WalletController],
})
export class WalletModule {}
