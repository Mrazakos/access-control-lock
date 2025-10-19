import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ethers } from 'ethers';
import { AccessControl, AccessControl__factory } from '../typechain-types';

/**
 * Events emitted by the blockchain listener
 */
export const BLOCKCHAIN_EVENTS = {
  SIGNATURE_REVOKED: 'signature.revoked',
  BATCH_SYNC_COMPLETE: 'batch.sync.complete',
  LOCK_INFO_LOADED: 'lock.info.loaded',
  NEW_BLOCK: 'blockchain.newBlock',
  ERROR: 'blockchain.error',
} as const;

/**
 * Network configuration
 */
interface NetworkConfig {
  name: string;
  rpcUrl: string;
  contractAddress: string;
  startBlock: number;
}

/**
 * Lock information from blockchain
 */
export interface LockInfo {
  lockId: string;
  owner: string;
  publicKey: string;
  revokedCount: number;
  exists: boolean;
}

/**
 * Revocation event data
 */
export interface RevocationEventData {
  signatureHash: string;
  revokedBy: string;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: Date;
  source: 'real-time' | 'batch';
}

/**
 * Hybrid sync statistics
 */
export interface HybridSyncStats {
  realTimeUpdates: number;
  batchUpdates: number;
  lastBatchSync: string | null;
  lastRealTimeUpdate: string | null;
  lastSyncedBlock: number;
  currentBlock: number;
  blocksBehind: number;
  pendingUpdates: number;
  totalRevocations: number;
}

/**
 * Single-Lock Blockchain Listener Service
 * Monitors one specific lock configured via LOCK_ID environment variable
 * Implements real-time event listening + periodic batch sync (every 15 minutes)
 * Fetches lock's public key on startup for signature verification
 */
@Injectable()
export class BlockchainListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainListenerService.name);
  private provider: ethers.providers.JsonRpcProvider;
  private contract: AccessControl;
  private networkConfig: NetworkConfig;

  // Lock-specific data
  private lockId: string;
  private lockInfo: LockInfo | null = null;

  // Hybrid sync state
  private isListening = false;
  private batchSyncInterval: NodeJS.Timeout | null = null;
  private lastSyncedBlock: number = 0;
  private currentBlock: number = 0;
  private pendingUpdates: Set<string> = new Set(); // Track real-time updates to avoid duplicates

  // Statistics
  private stats = {
    realTimeUpdates: 0,
    batchUpdates: 0,
    lastBatchSync: null as string | null,
    lastRealTimeUpdate: null as string | null,
    totalRevocations: 0,
  };

  constructor(private eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    if (process.env.MODE === 'API' || process.env.MODE === 'IOT' || process.env.MODE === 'NFC') {
      await this.initialize();
      await this.startHybridSync();
    }
  }

  async onModuleDestroy() {
    await this.stopHybridSync();
  }

  /**
   * Get network configuration based on NETWORK environment variable
   */
  private getNetworkConfig(): NetworkConfig {
    const network = process.env.NETWORK || 'sepolia';

    if (network === 'mainnet') {
      return {
        name: 'mainnet',
        rpcUrl: process.env.MAINNET_RPC_URL || '',
        contractAddress: process.env.MAINNET_CONTRACT_ADDRESS || '',
        startBlock: parseInt(process.env.MAINNET_START_BLOCK || '0', 10),
      };
    } else {
      // Default to Sepolia testnet
      return {
        name: 'sepolia',
        rpcUrl: process.env.SEPOLIA_RPC_URL || '',
        contractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS || '',
        startBlock: parseInt(process.env.SEPOLIA_START_BLOCK || '0', 10),
      };
    }
  }

  /**
   * Initialize blockchain connection and fetch lock information
   */
  private async initialize() {
    try {
      // Get lock ID from environment
      this.lockId = process.env.LOCK_ID;
      if (!this.lockId) {
        throw new Error('LOCK_ID environment variable is required');
      }

      this.networkConfig = this.getNetworkConfig();

      if (!this.networkConfig.rpcUrl || !this.networkConfig.contractAddress) {
        throw new Error(`${this.networkConfig.name} RPC URL or Contract Address not configured`);
      }

      // Initialize provider
      this.provider = new ethers.providers.JsonRpcProvider(this.networkConfig.rpcUrl);

      // Test connection
      const network = await this.provider.getNetwork();
      this.logger.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);

      // Initialize contract with TypeChain factory
      this.contract = AccessControl__factory.connect(
        this.networkConfig.contractAddress,
        this.provider,
      );

      // Get current block
      this.currentBlock = await this.provider.getBlockNumber();
      this.lastSyncedBlock = this.networkConfig.startBlock;

      // Fetch lock information from blockchain
      await this.fetchLockInfo();

      this.logger.log(`🔒 Monitoring Lock ID: ${this.lockId}`);
      this.logger.log(`📍 Current block: ${this.currentBlock}`);
      this.logger.log(`📍 Starting from block: ${this.lastSyncedBlock}`);
      this.logger.log(`🌐 Using ${this.networkConfig.name} network`);

      this.logger.log('✅ Blockchain listener initialized');
    } catch (error) {
      this.logger.error(
        `❌ Failed to initialize blockchain listener: ${error.message}`,
        error.stack,
      );
      this.eventEmitter.emit(BLOCKCHAIN_EVENTS.ERROR, error);
      throw error;
    }
  }

  /**
   * Fetch lock information from the blockchain
   */
  private async fetchLockInfo(): Promise<void> {
    try {
      this.logger.log(`Fetching lock info for Lock ID: ${this.lockId}...`);

      const info = await this.contract.getLockInfo(this.lockId);

      this.lockInfo = {
        lockId: this.lockId,
        owner: info.owner,
        publicKey: info.publicKey,
        revokedCount: info.revokedCount.toNumber(),
        exists: info.exists,
      };

      if (!this.lockInfo.exists) {
        throw new Error(`Lock ID ${this.lockId} does not exist on the blockchain`);
      }

      this.logger.log(`✅ Lock info loaded:`);
      this.logger.log(`   Owner: ${this.lockInfo.owner}`);
      this.logger.log(`   Public Key: ${this.lockInfo.publicKey.substring(0, 20)}...`);
      this.logger.log(`   Revoked Count: ${this.lockInfo.revokedCount}`);

      // Emit event so other services can access the public key
      this.eventEmitter.emit(BLOCKCHAIN_EVENTS.LOCK_INFO_LOADED, this.lockInfo);
    } catch (error) {
      this.logger.error(`Failed to fetch lock info: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get the lock's public key (for signature verification)
   */
  getPublicKey(): string | null {
    return this.lockInfo?.publicKey || null;
  }

  /**
   * Get complete lock information
   */
  getLockInfo(): LockInfo | null {
    return this.lockInfo;
  }

  /**
   * Start the hybrid sync system (batch + real-time)
   */
  async startHybridSync() {
    if (this.isListening) {
      this.logger.warn('Hybrid sync already running');
      return;
    }

    if (!this.contract) {
      this.logger.error('Contract not initialized. Cannot start hybrid sync.');
      return;
    }

    if (!this.lockInfo) {
      this.logger.error('Lock info not loaded. Cannot start hybrid sync.');
      return;
    }

    try {
      this.logger.log(
        `🚀 Starting hybrid sync for Lock ${this.lockId} (batch every 15 minutes + real-time events)`,
      );

      // Initial batch sync to catch up
      await this.performBatchSync();

      // Start real-time event listening
      this.startRealtimeListening();

      // Start periodic batch sync (every 15 minutes)
      const batchIntervalMinutes = parseInt(process.env.BATCH_SYNC_INTERVAL_MINUTES || '15', 10);
      this.batchSyncInterval = setInterval(
        async () => {
          await this.performBatchSync();
        },
        batchIntervalMinutes * 60 * 1000,
      );

      // Listen to new blocks
      this.provider.on('block', async (blockNumber) => {
        this.currentBlock = blockNumber;
        this.eventEmitter.emit(BLOCKCHAIN_EVENTS.NEW_BLOCK, { blockNumber });
        this.logger.debug(`New block: ${blockNumber}`);
      });

      this.isListening = true;
      this.logger.log('✅ Hybrid sync system started successfully');
    } catch (error) {
      this.logger.error(`Failed to start hybrid sync: ${error.message}`, error.stack);
      this.eventEmitter.emit(BLOCKCHAIN_EVENTS.ERROR, error);
    }
  }

  /**
   * Start real-time event listening (filtered to this lock only)
   */
  private startRealtimeListening() {
    this.logger.log(`Starting real-time event listening for Lock ${this.lockId}...`);

    // Create filter for this lock's SignatureRevoked events
    const filter = this.contract.filters.SignatureRevoked(this.lockId, null, null);

    // Listen to SignatureRevoked events (only for this lock)
    this.contract.on(filter, async (lockId, signatureHash, owner, event) => {
      try {
        this.logger.log(`🔴 Real-time event: Signature revoked for Lock ${this.lockId}`);

        const eventKey = signatureHash; // Since we only monitor one lock, hash is unique

        // Check if already processed
        if (this.pendingUpdates.has(eventKey)) {
          this.logger.debug(`Skipping duplicate real-time event: ${eventKey.substring(0, 10)}...`);
          return;
        }

        const revocationData: RevocationEventData = {
          signatureHash,
          revokedBy: owner,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.logIndex,
          timestamp: new Date(),
          source: 'real-time',
        };

        // Track this update to avoid duplicates during batch sync
        this.pendingUpdates.add(eventKey);

        // Update statistics
        this.stats.realTimeUpdates++;
        this.stats.totalRevocations++;
        this.stats.lastRealTimeUpdate = new Date().toISOString();

        // Update local lock info revoked count
        if (this.lockInfo) {
          this.lockInfo.revokedCount++;
        }

        // Emit event for processing
        this.eventEmitter.emit(BLOCKCHAIN_EVENTS.SIGNATURE_REVOKED, revocationData);

        this.logger.log(`✅ Real-time revocation processed: ${signatureHash.substring(0, 10)}...`);
      } catch (error) {
        this.logger.error(
          `Error handling real-time SignatureRevoked event: ${error.message}`,
          error.stack,
        );
        this.eventEmitter.emit(BLOCKCHAIN_EVENTS.ERROR, error);
      }
    });

    this.logger.log('Real-time event listening started');
  }

  /**
   * Stop real-time event listening
   */
  private stopRealtimeListening() {
    if (this.contract) {
      this.contract.removeAllListeners('SignatureRevoked');
      this.logger.log('Stopped real-time event listening');
    }
  }

  /**
   * Perform batch sync (every 15 minutes) - only for this lock
   */
  async performBatchSync() {
    this.logger.log(`🔄 Starting scheduled batch sync for Lock ${this.lockId}...`);

    try {
      const currentBlock = await this.provider.getBlockNumber();
      let fromBlock = this.lastSyncedBlock + 1;
      const batchSize = parseInt(process.env.BATCH_SYNC_SIZE || '1000', 10);
      let totalEvents = 0;

      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

        this.logger.log(`Batch syncing blocks ${fromBlock} to ${toBlock}`);

        // Query only events for this specific lock
        const filter = this.contract.filters.SignatureRevoked(this.lockId, null, null);
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

        for (const event of events) {
          const signatureHash = event.args.signatureHash;
          const eventKey = signatureHash;

          // Skip if we already processed this via real-time events
          if (this.pendingUpdates.has(eventKey)) {
            this.logger.debug(`Skipping duplicate batch event: ${eventKey.substring(0, 10)}...`);
            continue;
          }

          const revocationData: RevocationEventData = {
            signatureHash,
            revokedBy: event.args.owner,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex,
            timestamp: new Date(),
            source: 'batch',
          };

          // Emit event for processing
          this.eventEmitter.emit(BLOCKCHAIN_EVENTS.SIGNATURE_REVOKED, revocationData);

          totalEvents++;
        }

        fromBlock = toBlock + 1;
      }

      this.lastSyncedBlock = currentBlock;
      this.stats.batchUpdates += totalEvents;
      this.stats.totalRevocations += totalEvents;
      this.stats.lastBatchSync = new Date().toISOString();

      // Update local lock info
      if (this.lockInfo && totalEvents > 0) {
        this.lockInfo.revokedCount += totalEvents;
      }

      // Clear pending updates after successful batch sync
      this.pendingUpdates.clear();

      this.logger.log(
        `✅ Batch sync complete: ${totalEvents} new revocations, synced to block ${currentBlock}`,
      );

      // Emit batch sync complete event
      this.eventEmitter.emit(BLOCKCHAIN_EVENTS.BATCH_SYNC_COMPLETE, {
        totalEvents,
        fromBlock: this.lastSyncedBlock - (currentBlock - this.lastSyncedBlock),
        toBlock: currentBlock,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Batch sync failed: ${error.message}`, error.stack);
      this.eventEmitter.emit(BLOCKCHAIN_EVENTS.ERROR, error);
    }
  }

  /**
   * Stop the hybrid sync system
   */
  async stopHybridSync() {
    this.logger.log('🛑 Stopping hybrid sync system...');

    this.stopRealtimeListening();

    if (this.batchSyncInterval) {
      clearInterval(this.batchSyncInterval);
      this.batchSyncInterval = null;
    }

    if (this.provider) {
      await this.provider.removeAllListeners();
    }

    this.isListening = false;
    this.logger.log('✅ Hybrid sync system stopped');
  }

  /**
   * Manual force sync (useful for testing or recovery)
   */
  async forceFullSync() {
    this.logger.log('🔄 Force full sync requested...');

    // Stop current operations
    this.stopRealtimeListening();

    // Reset sync position
    this.lastSyncedBlock = this.networkConfig.startBlock;
    this.pendingUpdates.clear();

    // Refetch lock info to get updated revoked count
    await this.fetchLockInfo();

    // Perform full sync
    await this.performBatchSync();

    // Restart event listening
    this.startRealtimeListening();

    this.logger.log('✅ Force full sync complete');
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): HybridSyncStats {
    return {
      realTimeUpdates: this.stats.realTimeUpdates,
      batchUpdates: this.stats.batchUpdates,
      lastBatchSync: this.stats.lastBatchSync,
      lastRealTimeUpdate: this.stats.lastRealTimeUpdate,
      lastSyncedBlock: this.lastSyncedBlock,
      currentBlock: this.currentBlock,
      blocksBehind: Math.max(0, this.currentBlock - this.lastSyncedBlock),
      pendingUpdates: this.pendingUpdates.size,
      totalRevocations: this.stats.totalRevocations,
    };
  }

  /**
   * Health check - verify cache consistency
   */
  async healthCheck() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const blocksBehind = currentBlock - this.lastSyncedBlock;

      return {
        healthy: blocksBehind < 100, // Consider healthy if less than 100 blocks behind
        lockId: this.lockId,
        lockOwner: this.lockInfo?.owner || 'unknown',
        publicKey: this.lockInfo?.publicKey || 'unknown',
        currentBlock,
        lastSyncedBlock: this.lastSyncedBlock,
        blocksBehind,
        isListening: this.isListening,
        batchSyncActive: !!this.batchSyncInterval,
        network: this.networkConfig.name,
        contractAddress: this.networkConfig.contractAddress,
        revokedCount: this.lockInfo?.revokedCount || 0,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lockId: this.lockId,
        isListening: this.isListening,
        batchSyncActive: !!this.batchSyncInterval,
      };
    }
  }

  /**
   * Check if a signature is revoked on-chain (direct contract call)
   */
  async isSignatureRevokedOnChain(signature: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error('Contract not initialized');
    }

    try {
      return await this.contract.isSignatureRevoked(this.lockId, signature);
    } catch (error) {
      this.logger.error(
        `Error checking signature revocation on-chain: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get listener status
   */
  getStatus() {
    return {
      lockId: this.lockId,
      lockOwner: this.lockInfo?.owner || 'unknown',
      publicKey: this.lockInfo?.publicKey
        ? `${this.lockInfo.publicKey.substring(0, 20)}...`
        : 'unknown',
      revokedCount: this.lockInfo?.revokedCount || 0,
      isListening: this.isListening,
      currentBlock: this.currentBlock,
      lastSyncedBlock: this.lastSyncedBlock,
      blocksBehind: Math.max(0, this.currentBlock - this.lastSyncedBlock),
      network: this.networkConfig?.name || 'not configured',
      contractAddress: this.networkConfig?.contractAddress || 'not configured',
      connected: this.provider ? 'connected' : 'disconnected',
      batchSyncActive: !!this.batchSyncInterval,
      pendingUpdates: this.pendingUpdates.size,
    };
  }
}
