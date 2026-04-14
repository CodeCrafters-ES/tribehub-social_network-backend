// src/modules/users/repositories/users.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { User } from '@prisma/client';

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  supabaseId?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
        supabaseId: data.supabaseId ?? null,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
  }

  /**
   * Ensures a user exists in the database, creating or updating as needed.
   * Used by SupabaseAuthGuard to sync users from Supabase Auth.
   * Returns the internal user ID.
   */
  async ensureUserExists(
    supabaseId: string,
    email: string,
  ): Promise<string | undefined> {
    const username = email.split('@')[0] || `user_${supabaseId.slice(0, 8)}`;

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
  }
}
