// src/modules/feed/controllers/feed.controller.ts
//
// Stub controller for the general feed endpoint.
// Full implementation is pending (Hito 1 — EPIC-P04).
//
// Feature flag enforcement: @FeatureFlag('feature.feed.enabled') combined with
// FeatureFlagGuard ensures the feed can be toggled off without a code deploy.
// When the flag is false the guard returns 403 FEATURE_DISABLED before the
// handler is invoked.

import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../../../common/guards/feature-flag.guard';
import { FeatureFlag } from '../../../common/decorators/feature-flag.decorator';

@Controller('feed')
export class FeedController {
  /**
   * GET /feed
   *
   * Returns a paginated general feed for the authenticated user.
   * Cursor-based pagination — implementation pending.
   *
   * Protected by feature flag 'feature.feed.enabled'.
   */
  @Get()
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('feature.feed.enabled')
  getFeed(): { message: string } {
    // TODO: implement cursor-paginated feed (EPIC-P04)
    return { message: 'Feed endpoint — implementation pending.' };
  }
}
