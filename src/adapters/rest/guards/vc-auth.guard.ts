import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CredentialVerifierService } from '@core/credential-verifier.service';
import { LockConfigService } from '@core/lock-config.service';
import { VerifiableCredential } from '@mrazakos/vc-ecdsa-crypto';

/**
 * Guard that authorizes requests based on Verifiable Credentials
 * Checks if the provided VC has the required access level
 */
@Injectable()
export class VcAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifierService: CredentialVerifierService,
    private readonly lockConfigService: LockConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required access level from decorator metadata
    const requiredAccessLevel = this.reflector.get<string>('accessLevel', context.getHandler());

    if (!requiredAccessLevel) {
      // No access level required, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const credential: VerifiableCredential = request.body;

    if (!credential) {
      throw new UnauthorizedException('No credential provided in request body');
    }

    try {
      // Get public key from config
      const publicKey = this.lockConfigService.getPublicKey();

      // Verify the credential
      const verificationResult = await this.verifierService.verifyCredential(credential, publicKey);

      if (!verificationResult.verified) {
        throw new UnauthorizedException(
          `Credential verification failed: ${verificationResult.error}`,
        );
      }

      // Check if credential has required access level
      const credentialSubject = credential.credentialSubject as any;
      const accessLevel = credentialSubject?.accessLevel;
      const permissions = credentialSubject?.permissions || [];

      // Check access level
      if (accessLevel !== requiredAccessLevel && !permissions.includes(requiredAccessLevel)) {
        throw new UnauthorizedException(
          `Insufficient permissions. Required: ${requiredAccessLevel}, Found: ${accessLevel}`,
        );
      }

      // Attach credential info to request for use in controller
      request.user = {
        credentialId: credential.id,
        accessLevel,
        permissions,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(`Authorization failed: ${error.message}`);
    }
  }
}
