import { Injectable, Logger } from '@nestjs/common';
import {
  VCRevoke,
  VCVerifier,
  VerifiableCredential,
  VerificationResult,
} from '@mrazakos/vc-ecdsa-crypto';
import { RevokedCredentialRepository } from '@infra/database';

/**
 * Core service for verifying Verifiable Credentials using ECDSA
 * Framework-agnostic business logic
 */
@Injectable()
export class CredentialVerifierService {
  private readonly logger = new Logger(CredentialVerifierService.name);
  private readonly vcVerifier: VCVerifier;
  private readonly vcRevoke: VCRevoke;

  constructor(private readonly revokedCredentialRepository: RevokedCredentialRepository) {
    this.vcVerifier = new VCVerifier();
    this.vcRevoke = new VCRevoke();

    this.logger.log('Credential Verifier initialized with ECDSA crypto support');
  }
  /**
   * Verify a Verifiable Credential with embedded signature
   * @param credential The VC to verify (SigningResult format with lockId, userDataHash, etc.)
   * @param publicKey The public key to verify against
   * @param isRevoked Whether the signature has been revoked
   * @returns VerificationResult with detailed checks
   */
  async verifyCredential(
    credential: VerifiableCredential,
    publicKey: string,
  ): Promise<VerificationResult> {
    const verifiedAt = new Date();
    let result: VerificationResult;

    this.logger.log('Starting credential verification process');
    this.logger.log(`🔑 Public Key Used:   ${publicKey.substring(0, 30)}...`);
    const proof = Array.isArray(credential.proof) ? credential.proof[0] : credential.proof;
    this.logger.log(`📝 Proof Value:       ${(proof as any)?.proofValue?.substring(0, 30)}...`);
    this.logger.log(`🆔 Verification Method: ${(proof as any)?.verificationMethod}`);

    try {
      if (await this.isRevoked(credential)) {
        result = {
          verified: false,
          error: 'Signature has been revoked',
        };

        return result;
      }

      this.logger.log(`🔐 Calling vcVerifier.verifyOffChainCredential()...`);
      result = await this.vcVerifier.verifyOffChainCredential(credential, publicKey, {
        checkExpiration: true,
        currentTime: verifiedAt,
      });

      this.logger.log(`Credential verified at ${verifiedAt.toISOString()}`);
      this.logger.log(`Verification result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Credential verification error: ${error.message}`, error.stack);
      result = {
        verified: false,
        error: `Signature verification error: ${error.message}`,
      };
    }
  }

  async isRevoked(credential: VerifiableCredential): Promise<boolean> {
    const vcHash = this.vcRevoke.getCredentialHash(credential);
    this.logger.log(`🔍 VC Hash:           ${vcHash}`);

    const isRevoked = await this.revokedCredentialRepository.isVcHashRevoked(vcHash);
    this.logger.log(`🚫 Is Revoked:        ${isRevoked ? '❌ YES' : '✅ NO'}`);

    return isRevoked;
  }
}
