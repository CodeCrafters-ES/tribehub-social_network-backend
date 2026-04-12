// src/modules/profile/repositories/profile.repository.ts

import { Injectable } from '@nestjs/common';
import type { PrismaClient, Profile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Repository for Profile data access.
 * Follows the same pattern as AuthRepository and UsersRepository.
 */
@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find profile by userId.
   * Returns null if profile doesn't exist.
   */
  async findByUserId(userId: string): Promise<Profile | null> {
    const client = this.prisma as unknown as PrismaClient;
    return client.profile.findUnique({
      where: { userId },
    });
  }

  /**
   * Create or update a profile (upsert pattern).
   * Used for initial profile creation during onboarding.
   */
  async upsert(
    userId: string,
    data: {
      displayName: string;
      bio?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<Profile> {
    const client = this.prisma as unknown as PrismaClient;
    return client.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  /**
   * Update existing profile fields.
   * Only updates provided fields (partial update).
   */
  async update(
    userId: string,
    data: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      isPublic?: boolean;
    },
  ): Promise<Profile> {
    const client = this.prisma as unknown as PrismaClient;
    return client.profile.update({
      where: { userId },
      data,
    });
  }
}
