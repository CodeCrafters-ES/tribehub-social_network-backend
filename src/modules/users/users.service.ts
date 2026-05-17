// src/modules/users/users.service.ts

import { Injectable } from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Finds an existing user by Supabase ID or creates one on first login.
   * Called by SupabaseAuthGuard to sync Supabase Auth users into public.users.
   * Returns the internal user ID.
   */
  async ensureUserExists(
    supabaseId: string,
    email: string,
  ): Promise<string | undefined> {
    const existing = await this.usersRepository.findBySupabaseId(supabaseId);
    if (existing) return existing.id;

    const username = `${email.split('@')[0] ?? 'user'}_${supabaseId.slice(0, 8)}`;
    const created = await this.usersRepository.create({
      supabaseId,
      email,
      username,
      passwordHash: null,
    });
    return created.id;
  }
}
