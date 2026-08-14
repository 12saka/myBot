import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BrokersService } from './brokers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('brokers')
@Controller('brokers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Get all connected broker accounts, summary balance, and live/demo split' })
  async getAccounts(@Request() req: any) {
    return this.brokersService.getAccounts(req.user.userId || req.user.id);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect new trading account (JustMarkets, FBS, Exness, XM, IC Markets, etc.)' })
  async connectBroker(@Request() req: any, @Body() body: any) {
    return this.brokersService.connectBroker(req.user.userId || req.user.id, body);
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update TradeMind permissions for a specific broker account' })
  async updatePermissions(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.brokersService.updatePermissions(req.user.userId || req.user.id, id, body);
  }

  @Patch(':id/risk-guard')
  @ApiOperation({ summary: 'Update AI Risk Guard rules for a specific broker account' })
  async updateRiskGuard(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.brokersService.updateRiskGuard(req.user.userId || req.user.id, id, body);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect a specific broker account by ID' })
  async deleteAccount(@Request() req: any, @Param('id') id: string) {
    return this.brokersService.disconnectBroker(req.user.userId || req.user.id, id);
  }
}
