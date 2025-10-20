import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { RevokedSignatureRepository } from '@infra/database';
import { VerifiableCredential } from '@core/entities';
import { ethers } from 'ethers';

/**
 * REST API controller for credential verification
 */
@Controller('verify')
export class VerifyController {
  private readonly logger = new Logger(VerifyController.name);

  constructor(
    private readonly verifierService: CredentialVerifierService,
    private readonly blockchainListener: BlockchainListenerService,
    private readonly revokedSignatureRepository: RevokedSignatureRepository,
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
  async verifyCredential(@Body() credential: VerifiableCredential) {
    try {
      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔐 CREDENTIAL VERIFICATION REQUEST`);
      this.logger.log(`${'='.repeat(80)}`);
      this.logger.log(`📋 Credential ID:     ${credential.id || 'N/A'}`);
      this.logger.log(`🔑 Signature:         ${credential.signature?.substring(0, 20)}...`);
      this.logger.log(`🏢 Lock ID:           ${credential.lockId}`);
      this.logger.log(`🏷️  Lock Nickname:     ${credential.lockNickname || 'N/A'}`);

      // Get the lock's public key from blockchain
      const publicKey = this.blockchainListener.getPublicKey();
      if (!publicKey) {
        this.logger.error('❌ Lock public key not loaded!');
        return {
          verified: false,
          error: 'Lock public key not loaded. Service may be initializing.',
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.log(`🔑 Lock Public Key:   ${publicKey.substring(0, 20)}...`);

      // Extract signature from proof
      const signature = credential.signature;
      if (!signature) {
        this.logger.error('❌ No signature found in credential!');
        return {
          verified: false,
          error: 'No signature found in credential proof',
          timestamp: new Date().toISOString(),
        };
      }

      // Check revocation status
      const signatureHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
      this.logger.log(`🔍 Signature Hash:    ${signatureHash}`);

      const isRevoked = await this.revokedSignatureRepository.isSignatureHashRevoked(signatureHash);

      // Get total revocations in DB for context
      const totalRevoked = await this.revokedSignatureRepository.countAll();

      this.logger.log(`📊 Total revocations: ${totalRevoked}`);
      this.logger.log(`🚫 Is Revoked:        ${isRevoked ? '❌ YES - DENIED!' : '✅ NO - OK'}`);

      // Verify the credential
      this.logger.log(`\n🔐 Running ECDSA verification...`);
      const result = await this.verifierService.verifyCredential(credential, publicKey, isRevoked);

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(
        `${result.verified ? '✅ VERIFICATION SUCCESS!' : '❌ VERIFICATION FAILED!'}`,
      );
      this.logger.log(`${'='.repeat(80)}`);
      result.results.forEach((check, i) => {
        const emoji = check.status === 'success' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
        this.logger.log(`${i + 1}. ${emoji} ${check.check}: ${check.message}`);
      });
      this.logger.log(`${'='.repeat(80)}\n`);

      return {
        verified: result.verified,
        credentialId: credential.id,
        lockId: this.blockchainListener.getLockInfo()?.lockId,
        isRevoked,
        checks: result.results,
        verifiedAt: result.verifiedAt,
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
