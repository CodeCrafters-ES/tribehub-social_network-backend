// src/common/guards/jwt-admin.guard.ts
//
// Guard that validates the Supabase Bearer JWT and enforces that the caller
// has the admin role.
//
// Role check: the Supabase JWT carries app_metadata.role. The guard rejects
// requests that do not present a valid token whose role equals 'admin'.
//
// Responses:
//   - Missing / malformed / expired token → 401 UnauthorizedException
//   - Valid token but role !== 'admin'    → 403 ForbiddenException

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { verify, type JwtPayload } from 'jsonwebtoken';

export interface SupabaseJwtPayload extends JwtPayload {
  sub: string;
  app_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
}

type AdminRequest = Request & {
  supabaseUser: SupabaseJwtPayload;
};

@Injectable()
export class JwtAdminGuard implements CanActivate {
  private readonly logger = new Logger(JwtAdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
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

    const jwtSecret = process.env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT secret not configured');
    }

    let decoded: SupabaseJwtPayload;

    try {
      // jsonwebtoken's verify() return type is a union that includes string,
      // but with a secret (not RequestHandler) it always returns a JwtPayload object.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- jsonwebtoken types are not fully resolvable; verify() always returns JwtPayload here
      decoded = verify(token, jwtSecret) as unknown as SupabaseJwtPayload;
    } catch (err) {
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

    const role = decoded.app_metadata?.role;

    if (role !== 'admin') {
      const requestId = (request as Request & { requestId?: string }).requestId;
      this.logger.warn({
        event: 'admin.access_denied',
        sub: decoded.sub,
        role: role ?? 'none',
        url: request.url,
        requestId: requestId ?? 'unknown',
      });
      throw new ForbiddenException('Admin role required');
    }

    request.supabaseUser = decoded;

    const requestId = (request as Request & { requestId?: string }).requestId;
    this.logger.log({
      event: 'admin.access_granted',
      sub: decoded.sub,
      url: request.url,
      requestId: requestId ?? 'unknown',
    });

    return true;
  }
}
