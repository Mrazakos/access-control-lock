import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@infra/config';
import { DatabaseModule } from '@infra/database';
import { MessagingModule } from '@infra/messaging';
import { RestModule } from '@adapters/rest';
import { NfcModule } from '@adapters/nfc';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { EventProcessorService } from '@core/event-processor.service';

@Module({
  imports: [
    // Global configuration
    ConfigModule,

    // Event emitter for internal events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // Infrastructure
    DatabaseModule,
    MessagingModule,

    // Adapters - conditionally loaded based on MODE
    ...(process.env.MODE === 'API' ? [RestModule] : []),
    ...(process.env.MODE === 'NFC' ? [NfcModule] : []),
    ...(process.env.MODE === 'IOT' ? [RestModule] : []),
  ],
  providers: [
    // Core services (always available)
    CredentialVerifierService,
    BlockchainListenerService,
    EventProcessorService,
  ],
})
export class AppModule {}
