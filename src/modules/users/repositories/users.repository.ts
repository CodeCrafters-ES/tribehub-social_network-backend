// src/modules/users/repositories/users.repository.ts

import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string | null;
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

  async findBySupabaseId(supabaseId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        supabaseId,
        deletedAt: null,
      },
    });
  }

  /**
   * Soft-deletes a user: stamps `deletedAt` and flips `status` to DELETED so
   * status-based queries (e.g. login) also exclude the account. Accepts an
   * optional transaction client so it can take part in a larger atomic
   * operation (e.g. the account-deletion confirmation transaction).
   */
  async softDelete(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        // Prisma 7 does not export enums as runtime values at the package root
        // (only as types); the runtime value lives under `$Enums`.
        status: $Enums.UserStatus.DELETED,
      },
    });
  }
}
