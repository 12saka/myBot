import { Controller, Get, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { BrokersService } from './brokers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('brokers')
@UseGuards(JwtAuthGuard)
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Post('connect')
  async connectBroker(@Request() req: any, @Body() body: any) {
    return this.brokersService.connectBroker(req.user.userId || req.user.id, body);
  }

  @Get('status')
  async getStatus(@Request() req: any) {
    return this.brokersService.getStatus(req.user.userId || req.user.id);
  }

  @Post('sync')
  async syncBroker(@Request() req: any) {
    return this.brokersService.syncBroker(req.user.userId || req.user.id);
  }

  @Get('account')
  async getAccountDetails(@Request() req: any) {
    return this.brokersService.getAccountDetails(req.user.userId || req.user.id);
  }

  @Get('positions')
  async getPositions(@Request() req: any) {
    return this.brokersService.getPositions(req.user.userId || req.user.id);
  }

  @Get('orders')
  async getOrders(@Request() req: any) {
    return this.brokersService.getOrders(req.user.userId || req.user.id);
  }

  @Get('history')
  async getHistory(@Request() req: any) {
    return this.brokersService.getHistory(req.user.userId || req.user.id);
  }

  @Delete('disconnect')
  async disconnectBroker(@Request() req: any) {
    return this.brokersService.disconnectBroker(req.user.userId || req.user.id);
  }
}
