import { Module, Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

class DepositDto { @IsNumber() @IsPositive() amount!: number; }
class WithdrawDto { @IsNumber() @IsPositive() amount!: number; }

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  @Get()
  getBalance() {
    return { message: 'Wallet balance — authenticated user data from DB' };
  }

  @Post('deposit')
  deposit(@Body() dto: DepositDto) {
    return { message: `Deposit ${dto.amount} USD initiated`, status: 'PENDING' };
  }

  @Post('withdraw')
  withdraw(@Body() dto: WithdrawDto) {
    return { message: `Withdrawal ${dto.amount} USD initiated`, status: 'PENDING' };
  }
}

@Module({ controllers: [WalletController] })
export class WalletModule {}
