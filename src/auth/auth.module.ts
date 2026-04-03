// src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { UsersModule } from '../modules/users/users.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [UsersModule, ObservabilityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
