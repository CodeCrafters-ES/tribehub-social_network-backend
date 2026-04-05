// src/modules/feed/feed.module.ts
//
// FeedModule — stub for Hito 1 (EPIC-P04).
//
// SystemConfigModule is imported so that FeatureFlagGuard can inject
// SystemConfigService when protecting feed endpoints.

import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { FeedController } from './controllers/feed.controller';

@Module({
  imports: [SystemConfigModule],
  controllers: [FeedController],
})
export class FeedModule {}
