// src/auth/repositories/auth.repository.ts
//
// Repository for refresh-token persistence.
// This is the only place in the auth module that calls PrismaService for
// refresh-token data. No other module may access the refresh_tokens table.

import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Shape of a persisted refresh token record as returned by Prisma queries. */
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  revokedAt: Date | null;
  revocationReason: string | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds an active (not revoked, not expired) refresh token by its SHA-256
   * hash. Returns null when the token does not exist, is already revoked, or
   * has expired.
   */
  findActiveRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const client = this.prisma as unknown as PrismaClient;
    return client.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }) as Promise<RefreshTokenRecord | null>;
  }

  /**
   * Marks a refresh token as revoked by setting `revokedAt` to the current
   * timestamp and recording the reason.
   */
  async revokeRefreshToken(
    tokenHash: string,
    reason: string = 'logout',
  ): Promise<void> {
    const client = this.prisma as unknown as PrismaClient;
    await client.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }
}
