// src/common/decorators/feature-flag.decorator.ts
//
// Sets metadata on a route handler (or controller) indicating which feature
// flag key must be enabled for the route to be accessible.
//
// Usage:
//   @UseGuards(FeatureFlagGuard)
//   @FeatureFlag('feature.feed.enabled')
//   @Get()
//   getFeed() { ... }
//
// The guard reads this metadata and calls SystemConfigService.isEnabled(key).
// If the flag is false the guard throws a 403 ForbiddenException.
// If no @FeatureFlag decorator is present the guard is a no-op.

import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'featureFlagKey';

/**
 * Marks a route handler or controller with the feature flag key that must
 * evaluate to `true` for the request to proceed.
 *
 * @param flagKey - Config key (e.g. 'feature.feed.enabled')
 */
export const FeatureFlag = (flagKey: string) =>
  SetMetadata(FEATURE_FLAG_KEY, flagKey);
