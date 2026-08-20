import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log(`DATABASE_URL: ${process.env.DATABASE_URL}`);
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log','debug'] });

  // Security
  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, process.env.FRONTEND_URL || 'http://localhost:3000');
      }
    },
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Expose root health check endpoint for Render cloud health probes (returns HTTP 200 OK)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(['/', '/health', '/api/v2/health'], (req: any, res: any) => {
    res.status(200).json({ status: 'ok', service: 'api-gateway', timestamp: new Date() });
  });

  // API prefix
  app.setGlobalPrefix('api/v2');

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('TradeMind AI API')
    .setDescription('Enterprise AI Trading Platform — REST API v2')
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(PORT, '0.0.0.0');
  logger.log(`🚀 API Gateway running on http://0.0.0.0:${PORT}/api/v2`);
  logger.log(`📚 Swagger docs: http://0.0.0.0:${PORT}/api/docs`);
}

bootstrap();
