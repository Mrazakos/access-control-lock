import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LockConfigEntity } from './entities/lock-config.entity';

/**
 * Repository for lock configuration
 * Manages singleton lock config (always id=1)
 */
@Injectable()
export class LockConfigRepository {
  private readonly logger = new Logger(LockConfigRepository.name);
  private readonly SINGLETON_ID = 1;

  constructor(
    @InjectRepository(LockConfigEntity)
    private readonly repository: Repository<LockConfigEntity>,
  ) {}

  /**
   * Find the current lock configuration
   * @returns LockConfigEntity or null if not configured
   */
  async findConfig(): Promise<LockConfigEntity | null> {
    return this.repository.findOne({ where: { id: this.SINGLETON_ID } });
  }

  /**
   * Save/update lock configuration
   * @param lockId The lock ID to configure
   * @param publicKey The lock's public key
   */
  async saveConfig(lockId: number, publicKey: string): Promise<LockConfigEntity> {
    const config = this.repository.create({
      id: this.SINGLETON_ID,
      lockId,
      publicKey,
    });

    await this.repository.save(config);
    this.logger.log(`💾 Lock config saved: Lock ID=${lockId}`);
    return config;
  }

  /**
   * Delete the lock configuration (reset)
   */
  async deleteConfig(): Promise<void> {
    await this.repository.delete({ id: this.SINGLETON_ID });
    this.logger.log(`🗑️  Lock config deleted`);
  }

  /**
   * Check if lock is configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.findConfig();
    return config !== null;
  }
}
