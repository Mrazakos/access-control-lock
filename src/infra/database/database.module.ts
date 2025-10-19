import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevokedSignatureEntity, SignatureEntryEntity } from './entities';
import { RevokedSignatureRepository } from './revoked-signature.repository';
import { SignatureEntryRepository } from './signature-entry.repository';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || './data/vcel.db',
      entities: [RevokedSignatureEntity, SignatureEntryEntity],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([RevokedSignatureEntity, SignatureEntryEntity]),
  ],
  providers: [RevokedSignatureRepository, SignatureEntryRepository],
  exports: [RevokedSignatureRepository, SignatureEntryRepository],
})
export class DatabaseModule {}
