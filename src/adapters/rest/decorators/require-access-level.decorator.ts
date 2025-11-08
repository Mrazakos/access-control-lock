import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required access level for an endpoint
 * Used with VcAuthGuard to enforce credential-based authorization
 *
 * @example
 * @RequireAccessLevel('admin')
 * @Post('reset')
 * async resetConfig() { ... }
 */
export const RequireAccessLevel = (level: string) => SetMetadata('accessLevel', level);
