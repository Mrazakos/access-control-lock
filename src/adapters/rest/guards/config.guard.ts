import { Injectable, CanActivate, ForbiddenException } from '@nestjs/common';
import { LockConfigService } from '@core/lock-config.service';

/**
 * Guard to prevent lock re-initialization
 * Throws 403 Forbidden if lock is already configured
 */
@Injectable()
export class ConfigGuard implements CanActivate {
  constructor(private readonly lockConfigService: LockConfigService) {}

  canActivate(): boolean {
    if (this.lockConfigService.isReady()) {
      throw new ForbiddenException(
        'Lock is already configured. Call POST /api/v1/config/reset first to reconfigure.',
      );
    }
    return true;
  }
}
