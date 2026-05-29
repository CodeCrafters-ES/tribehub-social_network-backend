// src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

import { RegisterRequestDto } from './dto/register.request.dto';
import { LoginDto } from './dto/login.dto';
import {
  getSupabaseClient,
  getSupabaseAdminClient,
} from '../config/supabase.config';
import { UsersRepository } from '../modules/users/repositories/users.repository';
import {
  AuthRepository,
  RefreshTokenRotationConflictError,
  type RefreshTokenRecord,
} from './repositories/auth.repository';
import { SecurityMonitorService } from '../observability/alerts/security-monitor.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs =
    Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? '7') * 24 * 60 * 60 * 1000;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly securityMonitor: SecurityMonitorService,
  ) {}

  async register(data: RegisterRequestDto) {
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
      // The Supabase user was already created above. Roll it back so we do not
      // leave an orphaned Supabase user with no local DB counterpart.
      if (supabaseUserId) {
        try {
          const supabaseAdmin = getSupabaseAdminClient();
          const { error: deleteError } =
            await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
          if (deleteError) {
            this.logger.warn({
              event: 'auth.register.supabase_rollback_failed',
              supabaseUserId,
              reason: deleteError.message,
            });
          }
        } catch (rollbackErr: unknown) {
          this.logger.warn({
            event: 'auth.register.supabase_rollback_error',
            supabaseUserId,
            reason:
              rollbackErr instanceof Error
                ? rollbackErr.message
                : 'Unknown error',
          });
        }
      }

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

  async login(
    data: LoginDto,
    metadata?: { ipAddress?: string; userAgent?: string },
  ) {
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

    const refreshToken = signInData.session?.refresh_token;
    const supabaseUserId = signInData.user?.id;
    if (refreshToken && supabaseUserId) {
      const user = await this.usersRepository.findBySupabaseId(supabaseUserId);
      if (user) {
        await this.authRepository.createRefreshToken({
          userId: user.id,
          tokenHash: this.hashToken(refreshToken),
          expiresAt: new Date(Date.now() + this.refreshTtlMs),
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        });
      }
    }

    return {
      session: signInData.session,
      user: signInData.user,
      csrfToken: this.generateCsrfToken(),
    };
  }

  async refreshSession(params: {
    rawRefreshToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    refreshExpiresAt: Date;
    csrfToken: string;
  }> {
    const tokenHash = this.hashToken(params.rawRefreshToken);
    const existingToken =
      await this.authRepository.findRefreshTokenByHash(tokenHash);

    if (!existingToken) {
      this.securityMonitor.recordInvalidToken();
      throw new UnauthorizedException('Unauthorized');
    }

    if (
      existingToken.revokedAt ||
      existingToken.expiresAt.getTime() <= Date.now()
    ) {
      await this.authRepository.revokeAllActiveUserTokens(
        existingToken.userId,
        'reuse_detected',
      );
      this.securityMonitor.recordInvalidToken();
      throw new UnauthorizedException('Unauthorized');
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: params.rawRefreshToken,
    });

    if (error || !data.session?.access_token || !data.session.refresh_token) {
      this.securityMonitor.recordInvalidToken();
      throw new UnauthorizedException('Unauthorized');
    }

    const nextRefreshToken = data.session.refresh_token;
    const nextRefreshHash = this.hashToken(nextRefreshToken);
    const nextExpiry = new Date(Date.now() + this.refreshTtlMs);

    try {
      await this.authRepository.rotateRefreshToken({
        currentTokenId: existingToken.id,
        currentTokenHash: tokenHash,
        newTokenHash: nextRefreshHash,
        userId: existingToken.userId,
        newExpiresAt: nextExpiry,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (error) {
      if (error instanceof RefreshTokenRotationConflictError) {
        this.securityMonitor.recordInvalidToken();
        throw new UnauthorizedException('Unauthorized');
      }
      throw error;
    }

    return {
      accessToken: data.session.access_token,
      expiresIn: data.session.expires_in,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextExpiry,
      csrfToken: this.generateCsrfToken(),
    };
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
    const tokenHash = this.hashToken(rawToken);

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

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
