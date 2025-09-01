// src/auth/guards/supabase-auth.guard.ts

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // TODO: Validate Supabase JWT (call Supabase API or decode locally)
    // For now, just check token exists
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    // Attach token to request for further use
    request.supabaseToken = token;

    return true;
  }
}
