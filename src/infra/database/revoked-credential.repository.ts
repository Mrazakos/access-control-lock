import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevokedCredentialEntity } from './entities';

/**
 * Repository for revoked credentials
 */
@Injectable()
export class RevokedCredentialRepository {
  private readonly logger = new Logger(RevokedCredentialRepository.name);

  constructor(
    @InjectRepository(RevokedCredentialEntity)
    private readonly repository: Repository<RevokedCredentialEntity>,
  ) {}

  /**
   * Save a revoked credential
   */
  async save(revocation: Partial<RevokedCredentialEntity>): Promise<RevokedCredentialEntity> {
    try {
      return await this.repository.save(revocation);
    } catch (error) {
      this.logger.error(`Failed to save revoked credential: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if a VC hash is revoked
   */
  async isVcHashRevoked(vcHash: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { vcHash },
    });
    return count > 0;
  }

  /**
   * Get all revoked credentials
   */
  async getAllRevocations(): Promise<RevokedCredentialEntity[]> {
    return this.repository.find({
      order: { revokedAt: 'DESC' },
    });
  }

  /**
   * Get revoked credential by ID
   */
  async findById(id: string): Promise<RevokedCredentialEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Count all revoked credentials
   */
  async countAll(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Get recently revoked credentials
   */
  async getRecentRevocations(limit = 100): Promise<RevokedCredentialEntity[]> {
    return this.repository.find({
      take: limit,
      order: { revokedAt: 'DESC' },
    });
  }

  /**
   * Batch save revoked credentials
   */
  async batchSave(revocations: Partial<RevokedCredentialEntity>[]): Promise<void> {
    try {
      await this.repository.save(revocations);
      this.logger.log(`Batch saved ${revocations.length} revoked credentials`);
    } catch (error) {
      this.logger.error(`Failed to batch save revoked credentials: ${error.message}`, error.stack);
      throw error;
    }
  }
}
