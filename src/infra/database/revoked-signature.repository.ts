import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevokedSignatureEntity } from './entities';

/**
 * Repository for revoked signatures
 */
@Injectable()
export class RevokedSignatureRepository {
  private readonly logger = new Logger(RevokedSignatureRepository.name);

  constructor(
    @InjectRepository(RevokedSignatureEntity)
    private readonly repository: Repository<RevokedSignatureEntity>,
  ) {}

  /**
   * Save a revoked signature
   */
  async save(revocation: Partial<RevokedSignatureEntity>): Promise<RevokedSignatureEntity> {
    try {
      return await this.repository.save(revocation);
    } catch (error) {
      this.logger.error(`Failed to save revoked signature: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if a signature hash is revoked
   */
  async isSignatureHashRevoked(signatureHash: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { signatureHash },
    });
    return count > 0;
  }

  /**
   * Get all revoked signatures
   */
  async getAllRevocations(): Promise<RevokedSignatureEntity[]> {
    return this.repository.find({
      order: { revokedAt: 'DESC' },
    });
  }

  /**
   * Get revoked signature by ID
   */
  async findById(id: string): Promise<RevokedSignatureEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Count all revoked signatures
   */
  async countAll(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Get recently revoked signatures
   */
  async getRecentRevocations(limit = 100): Promise<RevokedSignatureEntity[]> {
    return this.repository.find({
      take: limit,
      order: { revokedAt: 'DESC' },
    });
  }

  /**
   * Batch save revoked signatures
   */
  async batchSave(revocations: Partial<RevokedSignatureEntity>[]): Promise<void> {
    try {
      await this.repository.save(revocations);
      this.logger.log(`Batch saved ${revocations.length} revoked signatures`);
    } catch (error) {
      this.logger.error(`Failed to batch save revocations: ${error.message}`, error.stack);
      throw error;
    }
  }
}
