// src/common/guards/feature-flag.guard.ts
//
// Guard that enforces feature flags declared via the @FeatureFlag() decorator.
//
// Behaviour:
//   - No @FeatureFlag decorator on the handler → guard is a no-op (pass through).
//   - Flag is true (or missing from DB — defaults to true) → request proceeds.
//   - Flag is false → 403 ForbiddenException with code FEATURE_DISABLED.
//
// Registration:
//   Do NOT register this guard globally. Apply it route-by-route (or per
//   controller) alongside the @FeatureFlag() decorator:
//
//     @UseGuards(FeatureFlagGuard)
//     @FeatureFlag('feature.feed.enabled')
//     @Get()
//     getFeed() { ... }
//
// The guard depends on SystemConfigService which is provided by
// SystemConfigModule. Any module that uses this guard must import
// SystemConfigModule (or rely on it being provided via a shared CommonModule).

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { SystemConfigService } from '../../modules/system-config/services/system-config.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Read the flag key set by @FeatureFlag() on the handler.
    // Falls back to the controller-level metadata if not set on the handler.
    const flagKey = this.reflector.getAllAndOverride<string | undefined>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No decorator — guard is a no-op.
    if (!flagKey) {
      return true;
    }

    // Flags default to true (open) when absent from the DB so that new
    // endpoints work without requiring a DB entry first.
    const enabled = await this.systemConfigService.isEnabled(flagKey, true);

    if (!enabled) {
      const request = context.switchToHttp().getRequest<Request>();
      const requestId = (request as Request & { requestId?: string }).requestId;
      const route = `${request.method} ${request.url}`;

      this.logger.warn({
        event: 'feature_flag.blocked',
        flag: flagKey,
        enabled: false,
        route,
        requestId: requestId ?? 'unknown',
      });

      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'This feature is currently disabled.',
        details: { flag: flagKey },
      });
    }

    return true;
  }
}
