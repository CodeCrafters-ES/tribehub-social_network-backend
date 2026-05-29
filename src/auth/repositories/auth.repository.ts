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
  replacedByTokenId: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export class RefreshTokenRotationConflictError extends Error {
  constructor() {
    super('Refresh token rotation conflict');
  }
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

  findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const client = this.prisma as unknown as PrismaClient;
    return client.refreshToken.findUnique({
      where: { tokenHash },
    }) as Promise<RefreshTokenRecord | null>;
  }

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RefreshTokenRecord> {
    const client = this.prisma as unknown as PrismaClient;
    return client.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    }) as Promise<RefreshTokenRecord>;
  }

  async rotateRefreshToken(params: {
    currentTokenId: string;
    currentTokenHash: string;
    newTokenHash: string;
    userId: string;
    newExpiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RefreshTokenRecord> {
    const client = this.prisma as unknown as PrismaClient;

    return client.$transaction(async (tx) => {
      const newToken = (await tx.refreshToken.create({
        data: {
          userId: params.userId,
          tokenHash: params.newTokenHash,
          expiresAt: params.newExpiresAt,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      })) as RefreshTokenRecord;

      const updateResult = await tx.refreshToken.updateMany({
        where: {
          id: params.currentTokenId,
          tokenHash: params.currentTokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revocationReason: 'rotation',
          replacedByTokenId: newToken.id,
        },
      });

      if (updateResult.count !== 1) {
        throw new RefreshTokenRotationConflictError();
      }

      return newToken;
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

  async revokeAllActiveUserTokens(
    userId: string,
    reason: string,
  ): Promise<void> {
    const client = this.prisma as unknown as PrismaClient;
    await client.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }
}
