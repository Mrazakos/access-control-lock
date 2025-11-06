import { Controller, Post, Get, Body, Logger, UseGuards } from '@nestjs/common';
import { LockConfigService } from '@core/lock-config.service';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { RequireAccessLevel } from '../decorators/require-access-level.decorator';
import { ConfigGuard } from '../guards/config.guard';

/**
 * Controller for lock configuration management
 */
@Controller('config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(
    private readonly lockConfigService: LockConfigService,
    private readonly blockchainListener: BlockchainListenerService,
  ) {}

  /**
   * Initialize lock configuration
   * POST /api/v1/config/init
   * Body: { lockId: number, publicKey: string }
   * Protected by AccessGuard - can only be called once until reset
   */
  @Post('init')
  @UseGuards(ConfigGuard)
  @RequireAccessLevel('admin')
  // TODO: Consider adding VcAuthGuard here for extra security
  async initializeLock(@Body() body: { lockId: number; publicKey: string }) {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔧 LOCK INITIALIZATION REQUEST`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`🔢 Lock ID:     ${body.lockId}`);
      this.logger.log(`🔑 Public Key:  ${body.publicKey?.substring(0, 20)}...`);

      // Configure the lock service
      await this.lockConfigService.configure(body.lockId, body.publicKey);

      // Initialize blockchain listener with new lockId
      await this.blockchainListener.initialize(body.lockId);

      this.logger.log(`✅ Lock initialized successfully!`);
      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        message: 'Lock initialized successfully',
        lockId: body.lockId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Initialization failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current lock configuration status
   * GET /api/v1/config/status
   */
  @Get('status')
  getStatus() {
    const config = this.lockConfigService.getConfigDetails();
    return {
      ...config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset lock configuration
   * POST /api/v1/config/reset
   * Allows reconfiguration after calling this endpoint
   * Requires admin-level Verifiable Credential for authorization
   *
   * Request body should contain a VerifiableCredential with:
   * - credentialSubject.accessLevel: "admin"
   *   OR
   * - credentialSubject.permissions: ["reset"]
   */
  @Post('reset')
  // @UseGuards(VcAuthGuard)
  @RequireAccessLevel('admin')
  async resetConfig() {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔄 LOCK CONFIGURATION RESET REQUEST`);
      this.logger.log(`${'='.repeat(80)}`);

      await this.lockConfigService.reset();

      // Stop blockchain listener
      this.blockchainListener.stop();

      this.logger.log(`✅ Lock configuration reset successfully!`);
      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        success: true,
        message: 'Lock configuration reset. You can now call /init again.',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Reset failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
