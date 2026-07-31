import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Get()
  async getAllStrategies() {
    return this.strategiesService.getAllStrategies();
  }

  @Get(':id')
  async getStrategyById(@Param('id') id: string) {
    return this.strategiesService.getStrategyById(id);
  }

  @Post()
  async createStrategy(@Body() body: any) {
    return this.strategiesService.createStrategy(body);
  }

  @Patch(':id')
  async updateStrategy(@Param('id') id: string, @Body() body: any) {
    return this.strategiesService.updateStrategy(id, body);
  }

  @Delete(':id')
  async deleteStrategy(@Param('id') id: string) {
    return this.strategiesService.deleteStrategy(id);
  }
}
