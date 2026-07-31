import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('rules')
  async getUserRules(@Request() req: any) {
    return this.automationService.getUserRules(req.user.userId || req.user.id);
  }

  @Post('rules')
  async createRule(@Request() req: any, @Body() body: any) {
    return this.automationService.createRule(req.user.userId || req.user.id, body);
  }

  @Patch('rules/:id')
  async updateRule(@Request() req: any, @Param('id') ruleId: string, @Body() body: any) {
    return this.automationService.updateRule(req.user.userId || req.user.id, ruleId, body);
  }

  @Patch('rules/:id/toggle')
  async toggleRule(@Request() req: any, @Param('id') ruleId: string) {
    return this.automationService.toggleRule(req.user.userId || req.user.id, ruleId);
  }

  @Delete('rules/:id')
  async deleteRule(@Request() req: any, @Param('id') ruleId: string) {
    return this.automationService.deleteRule(req.user.userId || req.user.id, ruleId);
  }

  @Get('backtest')
  async getBacktestResults(@Query('strategy') strategyName: string) {
    return this.automationService.getBacktestResults(strategyName || '');
  }
}
