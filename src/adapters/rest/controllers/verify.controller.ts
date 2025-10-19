import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { BlockchainListenerService } from '@core/blockchain-listener.service';
import { RevokedSignatureRepository } from '@infra/database';
import { VerifiableCredential } from '@core/entities';
import { ethers } from 'ethers';

/**
 * REST API controller for credential verification
 */
@Controller('api/v1/verify')
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
      this.logger.log(`Verifying credential: ${credential.id}`);

      // Get the lock's public key from blockchain
      const publicKey = this.blockchainListener.getPublicKey();
      if (!publicKey) {
        return {
          verified: false,
          error: 'Lock public key not loaded. Service may be initializing.',
          timestamp: new Date().toISOString(),
        };
      }

      // Extract signature from proof
      const signature = credential.signature;
      if (!signature) {
        return {
          verified: false,
          error: 'No signature found in credential proof',
          timestamp: new Date().toISOString(),
        };
      }

      const signatureHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature));
      const isRevoked = await this.revokedSignatureRepository.isSignatureHashRevoked(signatureHash);

      // Verify the credential
      const result = await this.verifierService.verifyCredential(credential, publicKey, isRevoked);

      this.logger.log(
        `Verification result for ${credential.id}: ${result.verified ? 'SUCCESS' : 'FAILED'}`,
      );

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
      this.logger.error(`Verification failed: ${error.message}`, error.stack);
      return {
        verified: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
