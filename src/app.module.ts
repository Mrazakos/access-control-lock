import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@infra/config';
import { DatabaseModule } from '@infra/database';
import { MessagingModule } from '@infra/messaging';
import { RestModule } from '@adapters/rest';
import { NfcModule } from '@adapters/nfc';
import { CoreModule } from '@core/core.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule,

    // Core services (global)
    CoreModule,

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
})
export class AppModule {}
