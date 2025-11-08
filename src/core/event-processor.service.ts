import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BLOCKCHAIN_EVENTS, RevocationEventData } from '@core/blockchain-listener.service';
import {
  RevokedCredentialRepository,
  SignatureEntryRepository,
  SyncStateRepository,
} from '@infra/database';
import { ethers } from 'ethers';

/**
 * Service to process blockchain events and update the database
 * Only handles signature revocations (no lock storage)
 */
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly revokedCredentialRepository: RevokedCredentialRepository,
    private readonly signatureEntryRepository: SignatureEntryRepository,
    private readonly syncStateRepository: SyncStateRepository,
  ) {}

  /**
   * Handle CredentialRevoked event (both real-time and batch)
   * For single-lock monitoring - no lockId needed in database
   */
  @OnEvent(BLOCKCHAIN_EVENTS.CREDENTIAL_REVOKED)
  async handleCredentialRevoked(data: RevocationEventData) {
    try {
      const { vcHash, blockNumber, timestamp, source, revokedBy, transactionHash } = data;

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔔 REVOCATION EVENT RECEIVED [${source.toUpperCase()}]`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📋 VC Hash:           ${vcHash}`);
      this.logger.log(`👤 Revoked By:        ${revokedBy}`);
      this.logger.log(`🧱 Block Number:      ${blockNumber}`);
      this.logger.log(`🔗 Transaction Hash:  ${transactionHash}`);
      this.logger.log(`⏰ Timestamp:         ${timestamp.toISOString()}`);
      this.logger.log(`${'='.repeat(80)}\n`);

      // Check if already cached to avoid duplicates
      const exists = await this.revokedCredentialRepository.isVcHashRevoked(vcHash);

      if (exists) {
        this.logger.warn(
          `⚠️  Credential ${vcHash.substring(0, 10)}... ALREADY IN DATABASE (skipping duplicate)`,
        );
        return;
      }

      // Save revocation to database (no lockId - single lock instance)
      let savedSuccessfully = false;
      try {
        await this.revokedCredentialRepository.save({
          id: vcHash, // Use hash as primary key since we only monitor one lock
          vcHash,
          blockNumber,
          revokedAt: timestamp,
        });
        savedSuccessfully = true;
      } catch (saveError) {
        // Handle unique constraint violations gracefully (race condition between check and insert)
        if (saveError.message && saveError.message.includes('UNIQUE constraint failed')) {
          this.logger.warn(
            `⚠️  Credential ${vcHash.substring(0, 10)}... ALREADY EXISTS (race condition detected, skipping)`,
          );
          // Don't log success or query database - just return early
          return;
        }
        // Re-throw other errors
        throw saveError;
      }

      // Only log if we actually saved successfully
      if (savedSuccessfully) {
        // Get current database stats
        const totalRevoked = await this.revokedCredentialRepository.countAll();

        this.logger.log(`✅ SAVED TO DATABASE!`);
        this.logger.log(`📊 Total revocations in DB: ${totalRevoked}`);
        this.logger.log(`🔹 Source: ${source}\n`);

        // Log all revoked credentials currently in database
        this.logger.log(`\n${'─'.repeat(80)}`);
        this.logger.log(`📋 ALL REVOKED CREDENTIALS IN DATABASE:`);
        this.logger.log(`${'─'.repeat(80)}`);

        const allRevoked = await this.revokedCredentialRepository.getAllRevocations();

        if (allRevoked.length === 0) {
          this.logger.log(`   (No revoked credentials in database)`);
        } else {
          allRevoked.forEach((revoked, index) => {
            this.logger.log(`   ${index + 1}. Hash: ${revoked.vcHash}`);
            this.logger.log(`      Block: ${revoked.blockNumber}`);
            this.logger.log(`      Revoked At: ${revoked.revokedAt.toISOString()}`);
            this.logger.log(`      Created At: ${revoked.createdAt.toISOString()}`);
            this.logger.log(``);
          });
        }

        this.logger.log(`${'─'.repeat(80)}\n`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to process CredentialRevoked event: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle batch sync complete event
   */
  @OnEvent(BLOCKCHAIN_EVENTS.BATCH_SYNC_COMPLETE)
  async handleBatchSyncComplete(data: any) {
    try {
      const { totalEvents, fromBlock, toBlock, newRevocations, network, contractAddress, lockId } =
        data;

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`📊 BATCH SYNC COMPLETE`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📦 Blocks scanned:     ${fromBlock} → ${toBlock}`);
      this.logger.log(`🔍 Events found:       ${totalEvents}`);
      this.logger.log(`✨ New revocations:    ${newRevocations || totalEvents}`);

      // Get current database stats
      const totalRevoked = await this.revokedCredentialRepository.countAll();
      const totalEntries = await this.signatureEntryRepository.countAll();

      // Persist the toBlock as lastSyncedBlock (batch sync already updated it in blockchain listener)
      // This is a backup/confirmation that the state is persisted
      if (network && contractAddress && lockId) {
        try {
          await this.syncStateRepository.updateLastSyncedBlock(
            network,
            contractAddress,
            lockId,
            toBlock,
          );
          this.logger.debug(`📌 Confirmed lastSyncedBlock at ${toBlock} (batch sync complete)`);
        } catch (syncErr) {
          this.logger.warn(
            `Failed to update lastSyncedBlock in batch complete: ${syncErr.message}`,
          );
        }
      }

      this.logger.log(
        `📊 Total in DB:        ${totalRevoked} revocations, ${totalEntries} entries`,
      );
      this.logger.log(`${'='.repeat(80)}\n`);
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
      const isRevoked = await this.revokedCredentialRepository.isVcHashRevoked(signatureHash);

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
      const revokedCount = await this.revokedCredentialRepository.countAll();
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
