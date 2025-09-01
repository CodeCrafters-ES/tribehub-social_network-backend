// src/auth/guards/supabase-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    // Validate Supabase JWT
    try {
      if (!SUPABASE_JWT_SECRET) {
        throw new UnauthorizedException('JWT secret not configured');
      }
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
      request.supabaseUser = decoded;
      request.supabaseToken = token;
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

    return true;
  }
}
