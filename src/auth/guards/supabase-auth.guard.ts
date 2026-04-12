// src/auth/guards/supabase-auth.guard.ts

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import type { JwksClient } from 'jwks-rsa';
import { SecurityMonitorService } from '../../observability/alerts/security-monitor.service';
import { PrismaService } from '../../prisma/prisma.service';

type AuthenticatedRequest = Request & {
  supabaseUser: jwt.JwtPayload;
  supabaseToken: string;
  /** Internal user ID from public.users table */
  userId?: string;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwksClient: JwksClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly securityMonitor: SecurityMonitorService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize JWKS client for ES256 tokens from Supabase
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    this.jwksClient = jwksRsa({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    // Validate Supabase ES256 JWT using JWKS
    try {
      // First, decode the token header to get the key ID (kid)
      const decodedHeader = jwt.decode(token, { complete: true });
      if (!decodedHeader || typeof decodedHeader === 'string') {
        throw new UnauthorizedException('Malformed token');
      }

      const header = decodedHeader.header as { kid?: string; alg?: string };
      if (!header.kid) {
        throw new UnauthorizedException('Token missing key ID');
      }

      // Get the signing key from JWKS
      const signingKey = await this.jwksClient.getSigningKey(header.kid);
      const publicKey = signingKey.getPublicKey();

      if (!publicKey) {
        throw new UnauthorizedException('Unable to get signing key');
      }

      // Verify the token with the public key
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['ES256'],
      }) as jwt.JwtPayload;

      // Sync Supabase user to public.users if not exists
      const internalUserId = await this.syncUserToPublicTable(payload);
      (request as AuthenticatedRequest).userId = internalUserId;

      request.supabaseUser = payload;
      request.supabaseToken = token;
      return true;
    } catch (err) {
      this.securityMonitor.recordInvalidToken();
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : '';

      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      } else if (name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active');
      } else if (name === 'JsonWebTokenError' || message.includes('invalid')) {
        throw new UnauthorizedException('Malformed token or invalid signature');
      } else if (err instanceof UnauthorizedException) {
        throw err;
      } else {
        throw new UnauthorizedException('JWT authentication error');
      }
    }
  }

  /**
   * Synchronize user from Supabase Auth to public.users table.
   * Ensures the user exists in our database before protected routes run.
   * Returns the internal user ID.
   */
  private async syncUserToPublicTable(
    payload: jwt.JwtPayload,
  ): Promise<string | undefined> {
    const supabaseId = payload.sub as string;
    const email = payload.email as string;

    if (!supabaseId || !email) {
      return undefined;
    }

    try {
      const username =
        (payload.user_metadata?.username as string) ||
        email.split('@')[0] ||
        `user_${supabaseId.slice(0, 8)}`;

      // Use Prisma's upsert directly
      const result = await this.prisma.user.upsert({
        where: { supabaseId },
        create: {
          supabaseId,
          email,
          username,
          status: 'ACTIVE',
        },
        update: {
          email,
        },
      });

      return result.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(`User sync failed for ${supabaseId}: ${errorMessage}`);
      return undefined;
    }
  }
}
