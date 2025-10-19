import { Module } from '@nestjs/common';
import { VerifyController } from './controllers/verify.controller';
import { HealthController } from './controllers/health.controller';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { EventProcessorService } from '@core/event-processor.service';
import { DatabaseModule } from '@infra/database';

@Module({
  imports: [DatabaseModule],
  controllers: [VerifyController, HealthController],
  providers: [CredentialVerifierService, BlockchainListenerService, EventProcessorService],
})
export class RestModule {}
