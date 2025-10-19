import { DataSource } from 'typeorm';
import { RevokedSignatureEntity, SignatureEntryEntity } from './entities';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './data/vcel.db',
  entities: [RevokedSignatureEntity, SignatureEntryEntity],
  synchronize: true, // Auto-create tables in development
  logging: process.env.NODE_ENV === 'development',
});
