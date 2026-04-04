// src/modules/search/controllers/search.controller.ts
//
// Stub controller for the global search endpoint.
// Full implementation is pending (Hito 1 — EPIC-P04).
//
// Feature flag enforcement: @FeatureFlag('feature.search.enabled') combined
// with FeatureFlagGuard ensures search can be toggled off without a code deploy.
// When the flag is false the guard returns 403 FEATURE_DISABLED before the
// handler is invoked.

import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../../../common/guards/feature-flag.guard';
import { FeatureFlag } from '../../../common/decorators/feature-flag.decorator';

@Controller('search')
export class SearchController {
  /**
   * GET /search
   *
   * Global search across users, posts, and groups.
   * Cursor-based pagination with rate limiting — implementation pending.
   *
   * Protected by feature flag 'feature.search.enabled'.
   */
  @Get()
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('feature.search.enabled')
  search(): { message: string } {
    // TODO: implement global search with rate limiting (EPIC-P04)
    return { message: 'Search endpoint — implementation pending.' };
  }
}
