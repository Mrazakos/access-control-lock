import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LockConfigRepository } from '@infra/database';
import { BlockchainListenerService } from './blockchain-listener.service';

/**
 * Service to manage lock configuration (Lock ID and Public Key)
 * Loads configuration from database on startup if available
 */
@Injectable()
export class LockConfigService implements OnModuleInit {
  private readonly logger = new Logger(LockConfigService.name);

  private lockId: number | null = null;
  private publicKey: string | null = null;
  private isConfigured: boolean = false;

  constructor(
    private readonly lockConfigRepository: LockConfigRepository,
    private readonly blockChainListener: BlockchainListenerService,
  ) {}

  /**
   * Load configuration from database on module initialization
   */
  async onModuleInit() {
    try {
      const config = await this.lockConfigRepository.findConfig();
      if (config) {
        this.lockId = config.lockId;
        this.publicKey = config.publicKey;
        this.isConfigured = true;
        this.logger.log(`✅ Lock configuration loaded from database`);
        this.logger.log(`   Lock ID: ${this.lockId}`);
        this.logger.log(`   Public Key: ${this.publicKey.substring(0, 20)}...`);
        this.blockChainListener.initialize(this.lockId);
      } else {
        this.logger.warn(`⚠️  No lock configuration found. Please call POST /api/v1/config/init`);
      }
    } catch (error) {
      this.logger.error(`Failed to load lock configuration: ${error.message}`, error.stack);
    }
  }

  /**
   * Configure the lock with ID and public key
   * Persists to database
   */
  async configure(lockId: number, publicKey: string): Promise<void> {
    if (this.isConfigured) {
      throw new Error('Lock is already configured. Call reset() first to reconfigure.');
    }

    // Validate inputs
    if (!lockId || lockId < 0) {
      throw new Error('Invalid lockId: must be a positive number');
    }

    if (!publicKey || !publicKey.startsWith('0x')) {
      throw new Error('Invalid publicKey: must start with 0x');
    }

    // Save to database
    await this.lockConfigRepository.saveConfig(lockId, publicKey);

    // Update in-memory state
    this.lockId = lockId;
    this.publicKey = publicKey;
    this.isConfigured = true;

    this.logger.log(`✅ Lock configured: ID=${lockId}, PubKey=${publicKey.substring(0, 20)}...`);
  }

  /**
   * Get the configured lock ID
   * @throws Error if not configured
   */
  getLockId(): number {
    if (!this.isConfigured || this.lockId === null) {
      throw new Error('Lock not configured. Please call POST /api/v1/config/init first.');
    }
    return this.lockId;
  }

  /**
   * Get the configured public key
   * @throws Error if not configured
   */
  getPublicKey(): string {
    if (!this.isConfigured || this.publicKey === null) {
      throw new Error('Lock not configured. Please call POST /api/v1/config/init first.');
    }
    return this.publicKey;
  }

  /**
   * Check if lock is configured
   */
  isReady(): boolean {
    return this.isConfigured && this.lockId !== null && this.publicKey !== null;
  }

  /**
   * Reset lock configuration
   * Removes from database and clears in-memory state
   */
  async reset(): Promise<void> {
    await this.lockConfigRepository.deleteConfig();

    this.lockId = null;
    this.publicKey = null;
    this.isConfigured = false;

    this.logger.log('🔄 Lock configuration reset');
  }

  /**
   * Get configuration details (for status endpoint)
   */
  getConfigDetails() {
    if (!this.isReady()) {
      return {
        configured: false,
        lockId: null,
        publicKey: null,
      };
    }

    return {
      configured: true,
      lockId: this.lockId,
      publicKey: this.publicKey ? `${this.publicKey.substring(0, 10)}...` : null,
    };
  }
}
