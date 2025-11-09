import { DataSource } from 'typeorm';
import { RevokedCredentialEntity, SignatureEntryEntity } from './entities';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './data/vcel.db',
  entities: [RevokedCredentialEntity, SignatureEntryEntity],
  synchronize: true, // Auto-create tables in development
  logging: process.env.NODE_ENV === 'development',
});
