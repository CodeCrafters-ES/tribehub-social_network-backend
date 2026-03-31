// src/auth/repositories/auth.repository.ts
//
// Repository for refresh-token persistence.
// This is the only place in the auth module that calls PrismaService for
// refresh-token data. No other module may access the refresh_tokens table.

import { Injectable } from '@nestjs/common';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Marks a refresh token as revoked by setting `revokedAt` to the current
   * timestamp and recording the reason.
   */
  async revokeRefreshToken(
    tokenHash: string,
    reason: string = 'logout',
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.prisma.refreshToken.updateMany({
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
