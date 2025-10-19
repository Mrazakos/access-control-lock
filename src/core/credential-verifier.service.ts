import { Injectable, Logger } from '@nestjs/common';
import { CryptoUtils } from '@mrazakos/vc-ecdsa-crypto';
import { VerifiableCredential, VerificationResult, VerificationCheck } from './entities';

/**
 * Core service for verifying Verifiable Credentials using ECDSA
 * Framework-agnostic business logic
 */
@Injectable()
export class CredentialVerifierService {
  private readonly logger = new Logger(CredentialVerifierService.name);

  constructor() {
    this.logger.log('Credential Verifier initialized with ECDSA crypto support');
  }

  /**
   * Verify a signature using ECDSA
   * @param message The message that was signed
   * @param signature The ECDSA signature
   * @param publicKey The public key to verify against
   * @param isRevoked Whether this signature has been revoked
   * @returns VerificationResult with detailed checks
   */
  async verifySignatureWithPublicKey(
    message: string,
    signature: string,
    publicKey: string,
    isRevoked = false,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    const verifiedAt = new Date();

    try {
      // 1. Check if signature is revoked
      if (isRevoked) {
        checks.push({
          check: 'revocation_status',
          status: 'failure',
          message: 'Signature has been revoked',
        });
        return this.buildFailureResult(checks, 'Signature is revoked', verifiedAt);
      }

      checks.push({
        check: 'revocation_status',
        status: 'success',
        message: 'Signature is not revoked',
      });

      // 2. Verify signature format
      const formatCheck = this.checkSignatureFormat(signature);
      checks.push(formatCheck);
      if (formatCheck.status === 'failure') {
        return this.buildFailureResult(checks, 'Invalid signature format', verifiedAt);
      }

      // 3. Verify ECDSA signature
      const isValid = CryptoUtils.verify(message, signature, publicKey);

      checks.push({
        check: 'ecdsa_verification',
        status: isValid ? 'success' : 'failure',
        message: isValid ? 'ECDSA signature verified' : 'ECDSA signature verification failed',
      });

      if (!isValid) {
        return this.buildFailureResult(checks, 'Signature verification failed', verifiedAt);
      }

      const allValid = checks.every((check) => check.status === 'success');

      return {
        isValid: allValid,
        verified: isValid,
        results: checks,
        verifiedAt,
      };
    } catch (error) {
      this.logger.error(`Verification error: ${error.message}`, error.stack);
      checks.push({
        check: 'verification_process',
        status: 'failure',
        message: error.message,
      });

      return this.buildFailureResult(checks, error.message, verifiedAt);
    }
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
    isRevoked = false,
  ): Promise<VerificationResult> {
    const checks: VerificationCheck[] = [];
    const verifiedAt = new Date();

    try {
      // 1. Check credential format
      const formatCheck = this.checkCredentialFormat(credential);
      checks.push(formatCheck);
      if (formatCheck.status === 'failure') {
        return this.buildFailureResult(checks, 'Invalid credential format', verifiedAt);
      }

      // 2. Extract signature and message hash
      const { signature, signedMessageHash } = credential;

      if (!signature) {
        checks.push({
          check: 'signature_extraction',
          status: 'failure',
          message: 'No signature found in credential',
        });
        return this.buildFailureResult(checks, 'No signature found', verifiedAt);
      }

      if (!signedMessageHash) {
        checks.push({
          check: 'message_hash_extraction',
          status: 'failure',
          message: 'No signedMessageHash found in credential',
        });
        return this.buildFailureResult(checks, 'No message hash found', verifiedAt);
      }

      // 3. Verify signature against the signedMessageHash
      const signatureResult = await this.verifySignatureWithPublicKey(
        signedMessageHash,
        signature,
        publicKey,
        isRevoked,
      );

      checks.push(...signatureResult.results);

      // 4. Check expiration
      const expirationCheck = this.checkExpiration(credential);
      checks.push(expirationCheck);

      // 5. Check lockId matches (if needed)
      const lockIdCheck = this.checkLockId(credential);
      checks.push(lockIdCheck);

      const isValid = checks.every(
        (check) => check.status === 'success' || check.status === 'warning',
      );

      return {
        isValid: isValid && signatureResult.verified,
        verified: signatureResult.verified,
        results: checks,
        verifiedAt,
      };
    } catch (error) {
      this.logger.error(`Credential verification error: ${error.message}`, error.stack);
      checks.push({
        check: 'verification_process',
        status: 'failure',
        message: error.message,
      });

      return this.buildFailureResult(checks, error.message, verifiedAt);
    }
  }

  /**
   * Check signature format
   */
  private checkSignatureFormat(signature: string): VerificationCheck {
    try {
      if (!signature || signature.trim().length === 0) {
        return {
          check: 'signature_format',
          status: 'failure',
          message: 'Empty signature',
        };
      }

      // Check if it looks like a valid hex signature or other format
      // Adjust based on your signature format requirements
      if (signature.startsWith('0x') && signature.length < 132) {
        return {
          check: 'signature_format',
          status: 'warning',
          message: 'Signature may be too short',
        };
      }

      return {
        check: 'signature_format',
        status: 'success',
        message: 'Valid signature format',
      };
    } catch (error) {
      return {
        check: 'signature_format',
        status: 'failure',
        message: error.message,
      };
    }
  }

  /**
   * Check credential format
   */
  private checkCredentialFormat(credential: VerifiableCredential): VerificationCheck {
    try {
      // Check required fields for SigningResult-based VC
      if (!credential.signedMessageHash) {
        return {
          check: 'format',
          status: 'failure',
          message: 'Missing required field: signedMessageHash',
        };
      }

      if (!credential.signature) {
        return {
          check: 'format',
          status: 'failure',
          message: 'Missing required field: signature',
        };
      }

      if (!credential.userDataHash) {
        return {
          check: 'format',
          status: 'failure',
          message: 'Missing required field: userDataHash',
        };
      }

      if (credential.lockId === undefined || credential.lockId === null) {
        return {
          check: 'format',
          status: 'failure',
          message: 'Missing required field: lockId',
        };
      }

      if (!credential.lockNickname) {
        return {
          check: 'format',
          status: 'warning',
          message: 'Missing lockNickname field',
        };
      }

      return {
        check: 'format',
        status: 'success',
        message: 'Valid credential format',
      };
    } catch (error) {
      return {
        check: 'format',
        status: 'failure',
        message: error.message,
      };
    }
  }

  /**
   * Check if lockId is present and valid
   */
  private checkLockId(credential: VerifiableCredential): VerificationCheck {
    try {
      if (credential.lockId === undefined || credential.lockId === null) {
        return {
          check: 'lock_id',
          status: 'failure',
          message: 'No lockId specified',
        };
      }

      if (typeof credential.lockId !== 'number' || credential.lockId < 0) {
        return {
          check: 'lock_id',
          status: 'failure',
          message: 'Invalid lockId format',
        };
      }

      return {
        check: 'lock_id',
        status: 'success',
        message: `Lock ID: ${credential.lockId} (${credential.lockNickname || 'unnamed'})`,
      };
    } catch (error) {
      return {
        check: 'lock_id',
        status: 'warning',
        message: 'Could not verify lockId',
      };
    }
  }

  /**
   * Check if credential is expired
   */
  private checkExpiration(credential: VerifiableCredential): VerificationCheck {
    try {
      const expirationDate = credential.expirationDate;

      if (!expirationDate) {
        return {
          check: 'expiration',
          status: 'warning',
          message: 'No expiration date set',
        };
      }

      const expDate = new Date(expirationDate);
      const now = new Date();

      if (expDate < now) {
        return {
          check: 'expiration',
          status: 'failure',
          message: `Credential expired on ${expDate.toISOString()}`,
        };
      }

      return {
        check: 'expiration',
        status: 'success',
        message: `Valid until ${expDate.toISOString()}`,
      };
    } catch (error) {
      return {
        check: 'expiration',
        status: 'warning',
        message: 'Could not verify expiration',
      };
    }
  }

  /**
   * Build a failure result
   */
  private buildFailureResult(
    checks: VerificationCheck[],
    error: string,
    verifiedAt: Date,
  ): VerificationResult {
    return {
      isValid: false,
      verified: false,
      results: checks,
      error,
      verifiedAt,
    };
  }
}
