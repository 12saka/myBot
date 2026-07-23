import { Module, Controller, Get, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'UP',
      service: 'api-gateway',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule implements OnModuleInit {
  onModuleInit() {
    console.log('[HealthModule] Anti-Sleep Keep-Alive background worker initialized.');
  }

  // Ping health endpoint every 4 minutes (240,000 ms) to prevent cloud hosts from sleeping
  @Interval(240000)
  async keepAlivePing() {
    const port = process.env.PORT || 4000;
    const publicUrl = process.env.PUBLIC_URL || process.env.API_GATEWAY_URL || `http://localhost:${port}`;
    try {
      const response = await fetch(`${publicUrl}/health`);
      if (response.ok) {
        console.log(`[KEEP-ALIVE] Anti-sleep ping successful (${new Date().toLocaleTimeString()}). API Gateway is active.`);
      }
    } catch (err: any) {
      // Silent catch for local startup
    }
  }
}
