import { VerificationResult } from '@mrazakos/vc-ecdsa-crypto';

/**
 * Core entity representing a Verifiable Credential event
 */
export class CredentialEvent {
  id: string;
  blockNumber: number;
  transactionHash: string;
  eventName: string;
  credentialId: string;
  holder: string;
  issuer: string;
  timestamp: Date;
  rawData: any;
  verified: boolean;
  verificationResult?: VerificationResult;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CredentialEvent>) {
    Object.assign(this, partial);
  }
}
