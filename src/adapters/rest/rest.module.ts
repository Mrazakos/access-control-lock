import { Module } from '@nestjs/common';
import { VerifyController } from './controllers/verify.controller';
import { HealthController } from './controllers/health.controller';
import { DatabaseModule } from '@infra/database';

@Module({
  imports: [DatabaseModule],
  controllers: [VerifyController, HealthController],
})
export class RestModule {}
