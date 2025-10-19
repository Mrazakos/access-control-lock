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

/**
 * Result of credential verification
 */
export interface VerificationResult {
  isValid: boolean;
  verified: boolean;
  results: VerificationCheck[];
  error?: string;
  verifiedAt: Date;
}

/**
 * Individual verification check
 */
export interface VerificationCheck {
  check: string;
  status: 'success' | 'failure' | 'warning';
  message?: string;
}
