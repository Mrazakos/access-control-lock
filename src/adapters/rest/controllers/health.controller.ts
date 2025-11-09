import { Controller, Get } from '@nestjs/common';
import { BlockchainListenerService } from '@core/blockchain-listener.service';

/**
 * Health check controller
 */
@Controller('health')
export class HealthController {
  constructor(private readonly blockchainListener: BlockchainListenerService) {}

  /**
   * Health check endpoint
   * GET /api/v1/health
   *
   * Returns:
   * - status: overall health status
   * - lockId: configured lock ID
   * - lockInfo: lock details from blockchain
   * - blockchain: sync status
   * - mode: service mode (API/NFC/IOT)
   */
  @Get()
  async check() {
    try {
      const syncStats = this.blockchainListener.getStats();
      const listenerStatus = this.blockchainListener.getStatus();

      const isHealthy = listenerStatus.isListening && syncStats.blocksBehind < 100;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        mode: process.env.MODE || 'API',

        blockchain: {
          network: listenerStatus.network,
          currentBlock: syncStats.currentBlock,
          lastSyncedBlock: syncStats.lastSyncedBlock,
          blocksBehind: syncStats.blocksBehind,
          isListening: listenerStatus.isListening,
          batchSyncActive: listenerStatus.batchSyncActive,
        },
        sync: {
          realTimeUpdates: syncStats.realTimeUpdates,
          batchUpdates: syncStats.batchUpdates,
          totalRevocations: syncStats.totalRevocations,
          lastBatchSync: syncStats.lastBatchSync,
          lastRealTimeUpdate: syncStats.lastRealTimeUpdate,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        mode: process.env.MODE || 'API',
      };
    }
  }
}
