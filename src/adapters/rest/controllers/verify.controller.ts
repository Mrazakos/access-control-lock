import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { LockConfigService } from '@core/lock-config.service';

import { VerifiableCredential } from '@mrazakos/vc-ecdsa-crypto';
import { RevokedCredentialRepository } from '@infra/database';
import { RequireAccessLevel } from '../decorators/require-access-level.decorator';
/**
 * REST API controller for credential verification
 */
@Controller('verify')
export class VerifyController {
  private readonly logger = new Logger(VerifyController.name);

  constructor(
    private readonly verifierService: CredentialVerifierService,
    private readonly lockConfigService: LockConfigService,
    private readonly revokedCredentialRepository: RevokedCredentialRepository,
  ) {}

  /**
   * Verify a verifiable credential
   * POST /api/v1/verify
   *
   * Request body: VerifiableCredential (JSON)
   * {
   *   "@context": [...],
   *   "id": "...",
   *   "type": [...],
   *   "issuer": "...",
   *   "credentialSubject": {...},
   *   "proof": {
   *     "type": "EcdsaSecp256k1Signature2019",
   *     "proofValue": "0x...",
   *     ...
   *   }
   * }
   */
  @Post()
  @RequireAccessLevel('standard')
  async verifyCredential(@Body() credential: VerifiableCredential) {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔐 CREDENTIAL VERIFICATION REQUEST`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📋 Credential ID:     ${credential.id || 'N/A'}`);
      this.logger.log(`🏢 Lock ID:           ${credential.lockId}`);
      this.logger.log(`🏷️  Lock Nickname:     ${credential.lockNickname || 'N/A'}`);

      // Get the lock's public key from configuration
      const publicKey = this.lockConfigService.getPublicKey();

      const result = await this.verifierService.verifyCredential(credential, publicKey);

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(
        `${result.verified ? '✅ VERIFICATION SUCCESS!' : '❌ VERIFICATION FAILED!'}`,
      );
      this.logger.log(`${'='.repeat(80)}`);
      if (result.error) {
        this.logger.log(`❌ Error: ${result.error}`);
      }
      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        verified: result.verified,
        error: result.error,
        credentialId: credential.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Verification failed: ${error.message}`, error.stack);
      return {
        verified: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
