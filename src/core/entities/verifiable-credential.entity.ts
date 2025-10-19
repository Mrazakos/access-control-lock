import { SigningResult } from '@mrazakos/vc-ecdsa-crypto';

/**
 * Core entity representing a Verifiable Credential
 * Extends SigningResult from the crypto package
 */
export interface VerifiableCredential extends SigningResult {
  signedMessageHash: string; // hash of the message containing userDataHash + expiration date
  lockId: number;
  lockNickname: string;
  signature: string;
  userDataHash: string; // hash of the user metadata for privacy protection
  expirationDate?: string; // ISO string format
  issuanceDate?: string; // ISO string format
  id?: string; // Unique identifier for the credential
}
