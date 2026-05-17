// src/common/types/authenticated-request.type.ts

import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

/**
 * Extended Request type for authenticated users via Supabase JWT.
 * The SupabaseAuthGuard populates these fields after validating the token.
 */
export type AuthenticatedRequest = Request & {
  /** Decoded JWT payload from Supabase. Contains `sub` as user ID. */
  supabaseUser: JwtPayload;
  /** Raw JWT token string for downstream use (e.g., refresh). */
  supabaseToken: string;
  /** Internal user ID from public.users table (sync by guard) */
  userId?: string;
};
