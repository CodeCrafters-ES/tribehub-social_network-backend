// src/auth/guards/supabase-auth.guard.ts

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verify, type JwtPayload, type GetPublicKeyOrSecret } from 'jsonwebtoken';
import JwksClient from 'jwks-rsa';
import { SecurityMonitorService } from '../../observability/alerts/security-monitor.service';

const SUPABASE_URL = process.env.SUPABASE_URL;

const jwksClient = SUPABASE_URL
  ? JwksClient({
      jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000,
    })
  : null;

type AuthenticatedRequest = Request & {
  supabaseUser: JwtPayload;
  supabaseToken: string;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly securityMonitor: SecurityMonitorService) {}

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

    if (!jwksClient) {
      throw new UnauthorizedException('SUPABASE_URL not configured');
    }

    const getKey: GetPublicKeyOrSecret = (header, callback) => {
      if (!header.kid) {
        callback(new Error('No kid in token header'));
        return;
      }
      jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err || !key) {
          callback(err ?? new Error('Signing key not found'));
          return;
        }
        callback(null, key.getPublicKey());
      });
    };

    try {
      const decoded = await new Promise<JwtPayload>((resolve, reject) => {
        verify(token, getKey, (err, payload) => {
          if (err) reject(err);
          else resolve(payload as JwtPayload);
        });
      });

      request.supabaseUser = decoded;
      request.supabaseToken = token;
      return true;
    } catch (err) {
      this.securityMonitor.recordInvalidToken();
      const name = err instanceof Error ? err.name : '';
      if (name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      } else if (name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active');
      } else if (name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Malformed token or invalid signature');
      } else {
        throw new UnauthorizedException('JWT authentication error');
      }
    }
  }
}
