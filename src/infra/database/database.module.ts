import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RevokedCredentialEntity,
  SignatureEntryEntity,
  SyncStateEntity,
  LockConfigEntity,
} from './entities';
import { RevokedCredentialRepository } from './revoked-credential.repository';
import { SignatureEntryRepository } from './signature-entry.repository';
import { SyncStateRepository } from './sync-state.repository';
import { LockConfigRepository } from './lock-config.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/vcel.db',
      entities: [RevokedCredentialEntity, SignatureEntryEntity, SyncStateEntity, LockConfigEntity],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([
      RevokedCredentialEntity,
      SignatureEntryEntity,
      SyncStateEntity,
      LockConfigEntity,
    ]),
  ],
  providers: [
    RevokedCredentialRepository,
    SignatureEntryRepository,
    SyncStateRepository,
    LockConfigRepository,
  ],
  exports: [
    RevokedCredentialRepository,
    SignatureEntryRepository,
    SyncStateRepository,
    LockConfigRepository,
  ],
})
export class DatabaseModule {}
