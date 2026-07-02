import { Module, Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('portfolio')
export class PortfolioController {
  @Get()
  getPortfolio() { return { message: 'Portfolio data for authenticated user' }; }
  @Get('positions') 
  getPositions() { return { message: 'All open positions' }; }
  @Get('performance')
  getPerformance() { return { message: 'Historical performance data' }; }
  @Get('risk')
  getRiskMetrics() { return { message: 'Portfolio risk metrics: Sharpe, drawdown, VaR' }; }
}

@Module({ controllers: [PortfolioController] })
export class PortfolioModule {}
