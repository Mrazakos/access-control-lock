import { Global, Module } from '@nestjs/common';
import { CredentialVerifierService } from './credential-verifier.service';
import { BlockchainListenerService } from './blockchain-listener.service';
import { EventProcessorService } from './event-processor.service';
import { DatabaseModule } from '@infra/database';

/**
 * Core module containing shared services
 * @Global decorator makes these services available everywhere without explicit imports
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [CredentialVerifierService, BlockchainListenerService, EventProcessorService],
  exports: [CredentialVerifierService, BlockchainListenerService, EventProcessorService],
})
export class CoreModule {}
