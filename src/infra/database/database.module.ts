import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevokedSignatureEntity, SignatureEntryEntity, SyncStateEntity } from './entities';
import { RevokedSignatureRepository } from './revoked-signature.repository';
import { SignatureEntryRepository } from './signature-entry.repository';
import { SyncStateRepository } from './sync-state.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/vcel.db',
      entities: [RevokedSignatureEntity, SignatureEntryEntity, SyncStateEntity],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([RevokedSignatureEntity, SignatureEntryEntity, SyncStateEntity]),
  ],
  providers: [RevokedSignatureRepository, SignatureEntryRepository, SyncStateRepository],
  exports: [RevokedSignatureRepository, SignatureEntryRepository, SyncStateRepository],
})
export class DatabaseModule {}
