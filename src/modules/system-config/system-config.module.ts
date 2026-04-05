// src/modules/system-config/system-config.module.ts
//
// SystemConfigModule provides the feature-flag loader to the rest of the app.
//
// Why exports SystemConfigService:
//   Any module that needs to read a feature flag imports SystemConfigModule and
//   injects SystemConfigService. This is the single entry point for flag access.
//
// Why PrismaModule is NOT imported here:
//   PrismaModule is marked @Global() so PrismaService is available everywhere
//   without an explicit import.

import { Module } from '@nestjs/common';
import { SystemConfigRepository } from './repositories/system-config.repository';
import { SystemConfigService } from './services/system-config.service';

@Module({
  providers: [SystemConfigRepository, SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
