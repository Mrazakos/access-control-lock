import { Module } from '@nestjs/common';
import { VerifyController } from './controllers/verify.controller';
import { HealthController } from './controllers/health.controller';
import { ConfigController } from './controllers/config.controller';
import { ConfigGuard } from './guards/config.guard';
import { VcAuthGuard } from './guards/vc-auth.guard';
import { DatabaseModule } from '@infra/database';

@Module({
  imports: [DatabaseModule],
  controllers: [VerifyController, HealthController, ConfigController],
  providers: [ConfigGuard, VcAuthGuard],
})
export class RestModule {}
