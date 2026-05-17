// src/modules/profile/profile.module.ts

import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileRepository } from './repositories/profile.repository';
import { ObservabilityModule } from '../../observability/observability.module';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../users/users.module';

/**
 * Profile module for user profile management.
 * Provides endpoints for getting and updating user profile (onboarding).
 */
@Module({
  imports: [ObservabilityModule, AuthModule, UsersModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileRepository],
  exports: [ProfileService, ProfileRepository],
})
export class ProfileModule {}
