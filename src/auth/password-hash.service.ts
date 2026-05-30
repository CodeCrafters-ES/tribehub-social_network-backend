// src/auth/password-hash.service.ts

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Encapsulates Argon2 password hashing/verification so callers (e.g. the
 * account re-authentication flow) don't depend on the argon2 library directly.
 *
 * Issue #92 asked for this service to live under the auth module; the auth
 * module lives at `src/auth` in this codebase, so it is placed here.
 */
@Injectable()
export class PasswordHashService {
  /**
   * Verifies a plaintext password against a stored Argon2 hash.
   * Returns false on any verification error instead of throwing, so callers
   * can treat "invalid hash" and "wrong password" uniformly.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Hashes a plaintext password using Argon2id (library defaults).
   */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }
}
