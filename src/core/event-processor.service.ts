import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BLOCKCHAIN_EVENTS, RevocationEventData } from '@core/blockchain-listener.service';
import { RevokedSignatureRepository, SignatureEntryRepository } from '@infra/database';
import { ethers } from 'ethers';

/**
 * Service to process blockchain events and update the database
 * Only handles signature revocations (no lock storage)
 */
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly revokedSignatureRepository: RevokedSignatureRepository,
    private readonly signatureEntryRepository: SignatureEntryRepository,
  ) {}

  /**
   * Handle SignatureRevoked event (both real-time and batch)
   * For single-lock monitoring - no lockId needed in database
   */
  @OnEvent(BLOCKCHAIN_EVENTS.SIGNATURE_REVOKED)
  async handleSignatureRevoked(data: RevocationEventData) {
    try {
      const { signatureHash, blockNumber, timestamp, source } = data;

      // Check if already cached to avoid duplicates
      const exists = await this.revokedSignatureRepository.isSignatureHashRevoked(signatureHash);

      if (exists) {
        this.logger.debug(
          `Signature ${signatureHash.substring(0, 10)}... already cached (source: ${source})`,
        );
        return;
      }

      // Save revocation to database (no lockId - single lock instance)
      await this.revokedSignatureRepository.save({
        id: signatureHash, // Use hash as primary key since we only monitor one lock
        signatureHash,
        blockNumber,
        revokedAt: timestamp,
      });

      this.logger.log(
        `✅ Signature revoked [${source}]: Hash: ${signatureHash.substring(0, 10)}...`,
      );
    } catch (error) {
      this.logger.error(`Failed to process SignatureRevoked event: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle batch sync complete event
   */
  @OnEvent(BLOCKCHAIN_EVENTS.BATCH_SYNC_COMPLETE)
  async handleBatchSyncComplete(data: any) {
    try {
      const { totalEvents, fromBlock, toBlock } = data;
      this.logger.log(
        `📊 Batch sync complete: ${totalEvents} events processed (blocks ${fromBlock}-${toBlock})`,
      );
    } catch (error) {
      this.logger.error(`Failed to process BatchSyncComplete event: ${error.message}`, error.stack);
    }
  }

  /**
   * Log a signature entry (when signature is used for verification)
   * This creates an audit trail of signature usage
   */
  async logSignatureEntry(signature: string, publicKey?: string): Promise<void> {
    try {
      // Check if signature is revoked
      const signatureHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
      const isRevoked = await this.revokedSignatureRepository.isSignatureHashRevoked(signatureHash);

      // Create signature entry with audit trail
      await this.signatureEntryRepository.save({
        id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        signatureHash,
        publicKey: publicKey || 'N/A',
        timestamp: new Date(),
      });

      this.logger.log(`✓ Signature entry logged: Revoked: ${isRevoked ? 'YES' : 'NO'}`);
    } catch (error) {
      this.logger.error(`Failed to log signature entry: ${error.message}`, error.stack);
    }
  }

  /**
   * Get revocation statistics
   */
  async getRevocationStats() {
    try {
      const revokedCount = await this.revokedSignatureRepository.countAll();
      const entriesCount = await this.signatureEntryRepository.countAll();

      return {
        totalRevocations: revokedCount,
        totalEntries: entriesCount,
      };
    } catch (error) {
      this.logger.error(`Failed to get revocation stats: ${error.message}`, error.stack);
      return null;
    }
  }
}
