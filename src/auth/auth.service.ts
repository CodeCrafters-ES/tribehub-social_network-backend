// src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { getSupabaseClient } from '../config/supabase.config';
import { UsersRepository } from '../modules/users/repositories/users.repository';
import {
  AuthRepository,
  type RefreshTokenRecord,
} from './repositories/auth.repository';
import { SecurityMonitorService } from '../observability/alerts/security-monitor.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly securityMonitor: SecurityMonitorService,
  ) {}

  async register(data: RegisterDto) {
    const { email, password, username } = data;

    // Check for duplicate email
    const existingByEmail = await this.usersRepository.findByEmail(email);
    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    // Check for duplicate username
    const existingByUsername =
      await this.usersRepository.findByUsername(username);
    if (existingByUsername) {
      throw new ConflictException('Username already in use');
    }

    // Register in Supabase Auth
    const supabase = getSupabaseClient();
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });
    if (error) {
      throw new Error(error.message);
    }

    const supabaseUserId = signUpData.user?.id;

    // Hash password with Argon2
    const passwordHash = await argon2.hash(password);

    // Persist user in local database
    try {
      const user = await this.usersRepository.create({
        email,
        username,
        passwordHash,
        supabaseId: supabaseUserId,
      });

      // Return only public fields — never include passwordHash
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      };
    } catch (err: unknown) {
      // Map Prisma unique constraint violation to ConflictException
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email or username already in use');
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async login(data: LoginDto) {
    const supabase = getSupabaseClient();
    const { email, password } = data;
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      this.securityMonitor.recordFailedLogin();
      throw new Error(error.message);
    }
    return signInData;
  }

  /**
   * Revokes the refresh token identified by the raw token value read from the
   * httpOnly cookie. The method is idempotent: if no token is present, or the
   * token is already revoked / expired, it returns without error.
   *
   * DB errors are absorbed and logged — logout is best-effort so that cookies
   * are always cleared by the controller regardless of DB availability.
   *
   * @param rawToken - Raw refresh token value from the cookie (may be undefined).
   */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      this.logger.log({ event: 'auth.logout.no_token' });
      return;
    }

    // Hash the raw token before querying; we never store raw tokens.
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    try {
      const token: RefreshTokenRecord | null =
        await this.authRepository.findActiveRefreshToken(tokenHash);

      if (!token) {
        // Cookie present but token not found or already revoked — different
        // observability case from "no cookie at all".
        this.logger.log({ event: 'auth.logout.token_not_active' });
        return;
      }

      await this.authRepository.revokeRefreshToken(tokenHash, 'logout');

      const { userId } = token;
      this.logger.log({ event: 'auth.logout.success', userId });
    } catch (err: unknown) {
      // DB errors must not prevent cookie cleanup — log and absorb.
      this.logger.error({
        event: 'auth.logout.db_error',
        message: err instanceof Error ? err.message : 'Unknown DB error',
      });
    }
  }
}
