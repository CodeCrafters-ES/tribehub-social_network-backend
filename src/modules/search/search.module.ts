// src/modules/search/search.module.ts
//
// SearchModule — stub for Hito 1 (EPIC-P04).
//
// SystemConfigModule is imported so that FeatureFlagGuard can inject
// SystemConfigService when protecting search endpoints.

import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../system-config/system-config.module';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [SystemConfigModule],
  controllers: [SearchController],
})
export class SearchModule {}
