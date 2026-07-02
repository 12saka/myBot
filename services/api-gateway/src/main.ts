import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['error','warn','log','debug'] });

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

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

  const PORT = process.env.PORT ?? 4000;
  await app.listen(PORT);
  logger.log(`🚀 API Gateway running on http://localhost:${PORT}/api/v2`);
  logger.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
}

bootstrap();
