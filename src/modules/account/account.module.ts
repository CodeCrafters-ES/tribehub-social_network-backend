import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountRepository } from './repositories/account.repository';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ObservabilityModule } from '../../observability/observability.module';

// PrismaService comes from the global PrismaModule — not declared here.
// AuthModule provides SupabaseAuthGuard + PasswordHashService.
// UsersModule provides UsersRepository (used by AccountRepository.softDelete).
// ObservabilityModule provides SecurityMonitorService, a dependency of
// SupabaseAuthGuard, which is instantiated in this module's context via
// @UseGuards(SupabaseAuthGuard) on AccountController.
@Module({
  imports: [AuthModule, UsersModule, ObservabilityModule],
  controllers: [AccountController],
  providers: [AccountService, AccountRepository],
})
export class AccountModule {}
