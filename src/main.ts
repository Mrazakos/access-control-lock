import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigModule } from '@infra/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    // Validate configuration
    const config = ConfigModule.validate();
    logger.log(`Starting VCEL in ${config.MODE} mode...`);

    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Enable validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Enable CORS for API mode
    if (config.MODE === 'API' || config.MODE === 'IOT') {
      app.enableCors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      });
    }

    // Set global prefix for API routes
    if (config.MODE === 'API' || config.MODE === 'IOT') {
      app.setGlobalPrefix('api/v1');
    }

    // Start HTTP server for API and IoT modes
    if (config.MODE === 'API' || config.MODE === 'IOT') {
      await app.listen(config.PORT, '0.0.0.0');
      logger.log(`🚀 Server running on http://localhost:${config.PORT}/api/v1`);
      logger.log(`📊 Health check: http://localhost:${config.PORT}/api/v1/health`);
      logger.log(`🔑 Lock configuration: http://192.168.0.17:${config.PORT}/api/v1/config`);
    } else {
      // For NFC mode, just init the app without HTTP server
      await app.init();
      logger.log(`📡 NFC mode initialized`);
    }

    // Log startup info
    logger.log(`Mode: ${config.MODE}`);
    logger.log(`Database: ${config.DATABASE_PATH}`);
    if (config.ETHEREUM_RPC_URL) {
      logger.log(`Ethereum RPC: ${config.ETHEREUM_RPC_URL}`);
    }

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
