// src/auth/guards/supabase-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

type AuthenticatedRequest = Request & {
  supabaseUser: jwt.JwtPayload;
  supabaseToken: string;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    if (!SUPABASE_JWT_SECRET) {
      throw new UnauthorizedException('JWT secret not configured');
    }

    // Validate Supabase JWT
    try {
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as jwt.JwtPayload;
      request.supabaseUser = decoded;
      request.supabaseToken = token;
      return true;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      } else if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Malformed token or invalid signature');
      } else if (err instanceof jwt.NotBeforeError) {
        throw new UnauthorizedException('Token not active');
      } else {
        throw new UnauthorizedException('JWT authentication error');
      }
    }
  }
}
