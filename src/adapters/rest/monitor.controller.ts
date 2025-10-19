import { Controller, Get, Post, Param } from '@nestjs/common';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { EventProcessorService } from '@core/event-processor.service';
import { RevokedSignatureRepository } from '@infra/database';

/**
 * Controller for monitoring and statistics endpoints
 */
@Controller('api/v1/monitor')
export class MonitorController {
  constructor(
    private readonly blockchainListener: BlockchainListenerService,
    private readonly eventProcessor: EventProcessorService,
    private readonly revokedSignatureRepository: RevokedSignatureRepository,
  ) {}

  /**
   * Health check endpoint - verify hybrid sync status
   * GET /api/v1/monitor/health
   */
  @Get('health')
  async healthCheck() {
    const health = await this.blockchainListener.healthCheck();
    const stats = this.blockchainListener.getStats();

    return {
      ...health,
      stats: {
        realTimeUpdates: stats.realTimeUpdates,
        batchUpdates: stats.batchUpdates,
        totalRevocations: stats.totalRevocations,
        lastBatchSync: stats.lastBatchSync,
        lastRealTimeUpdate: stats.lastRealTimeUpdate,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get comprehensive statistics
   * GET /api/v1/monitor/stats
   */
  @Get('stats')
  async getStats() {
    const syncStats = this.blockchainListener.getStats();
    const listenerStatus = this.blockchainListener.getStatus();

    return {
      hybrid_sync: {
        real_time_updates: syncStats.realTimeUpdates,
        batch_updates: syncStats.batchUpdates,
        total_revocations: syncStats.totalRevocations,
        last_batch_sync: syncStats.lastBatchSync,
        last_real_time_update: syncStats.lastRealTimeUpdate,
        pending_updates: syncStats.pendingUpdates,
      },
      blockchain: {
        current_block: syncStats.currentBlock,
        last_synced_block: syncStats.lastSyncedBlock,
        blocks_behind: syncStats.blocksBehind,
        is_listening: listenerStatus.isListening,
        batch_sync_active: listenerStatus.batchSyncActive,
        network: listenerStatus.network,
        contract_address: listenerStatus.contractAddress,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Force a manual batch sync
   * POST /api/v1/monitor/force-sync
   */
  @Post('force-sync')
  async forceSync() {
    try {
      await this.blockchainListener.forceFullSync();
      return {
        success: true,
        message: 'Force full sync initiated',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if a specific signature is revoked
   * GET /api/v1/monitor/signature/:signatureHash/revoked
   */
  @Get('signature/:signatureHash/revoked')
  async checkRevocationStatus(@Param('signatureHash') signatureHash: string) {
    const isRevoked = await this.revokedSignatureRepository.isSignatureHashRevoked(signatureHash);

    return {
      signatureHash,
      isRevoked,
      timestamp: new Date().toISOString(),
    };
  }
}
