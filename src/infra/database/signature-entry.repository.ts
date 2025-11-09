import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignatureEntryEntity } from './entities';

/**
 * Repository for signature entries (tracking when signatures were used)
 */
@Injectable()
export class SignatureEntryRepository {
  private readonly logger = new Logger(SignatureEntryRepository.name);

  constructor(
    @InjectRepository(SignatureEntryEntity)
    private readonly repository: Repository<SignatureEntryEntity>,
  ) {}

  /**
   * Save a signature entry
   */
  async save(entry: Partial<SignatureEntryEntity>): Promise<SignatureEntryEntity> {
    try {
      return await this.repository.save(entry);
    } catch (error) {
      this.logger.error(`Failed to save signature entry: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find entries by signature
   */
  async findBySignatureHash(signatureHash: string): Promise<SignatureEntryEntity[]> {
    return this.repository.find({
      where: { signatureHash },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get recent entries
   */
  async getRecentEntries(limit = 100, offset = 0): Promise<SignatureEntryEntity[]> {
    return this.repository.find({
      take: limit,
      skip: offset,
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get all entries
   */
  async getAllEntries(): Promise<SignatureEntryEntity[]> {
    return this.repository.find({
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Count all entries
   */
  async countAll(): Promise<number> {
    return this.repository.count();
  }

  /**
   * Get entries within time range
   */
  async findByTimeRange(
    startDate: Date,
    endDate: Date,
    limit = 1000,
  ): Promise<SignatureEntryEntity[]> {
    return this.repository
      .createQueryBuilder('entry')
      .where('entry.timestamp >= :startDate', { startDate })
      .andWhere('entry.timestamp <= :endDate', { endDate })
      .orderBy('entry.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }
}
