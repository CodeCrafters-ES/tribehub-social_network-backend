// src/common/guards/user-throttler.guard.ts

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

/**
 * Rate-limit tracker keyed by the authenticated user instead of only the IP.
 *
 * The default ThrottlerGuard buckets by IP, which an attacker can evade by
 * rotating IPs. For authenticated endpoints (account deletion) we bucket by the
 * verified Supabase user id (`sub`), so the limit follows the identity and
 * cannot be bypassed by changing IP. Together with the global IP-based
 * ThrottlerGuard this enforces "per user AND per IP" limiting — neither
 * dimension can be evaded by rotating the other.
 *
 * It MUST run AFTER SupabaseAuthGuard so `req.supabaseUser` is populated:
 *   @UseGuards(SupabaseAuthGuard, UserThrottlerGuard)
 *
 * Unauthenticated requests fall back to per-IP tracking.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as AuthenticatedRequest;
    const userId = request.supabaseUser?.sub;
    const ip = (req.ip as string) ?? 'unknown';
    return Promise.resolve(userId ? `user:${userId}` : `ip:${ip}`);
  }
}
