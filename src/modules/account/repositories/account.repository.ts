// src/modules/account/repositories/account.repository.ts

import { ConflictException, Injectable } from '@nestjs/common';
import type { DeleteAccountRequest, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersRepository } from '../../users/repositories/users.repository';

export type DeleteRequestWithUser = DeleteAccountRequest & {
  user: User | null;
};

/**
 * Data-access layer for the account-deletion challenge. All Prisma access for
 * the `delete_account_requests` table lives here; mutations to the `users`
 * table are delegated to UsersRepository to respect module boundaries.
 */
@Injectable()
export class AccountRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Creates a new delete-account request, invalidating any prior active
   * requests for the same user in the same transaction (single active nonce).
   */
  async createRequest(
    userId: string,
    expiresAt: Date,
  ): Promise<DeleteAccountRequest> {
    return this.prisma.$transaction(async (tx) => {
      await tx.deleteAccountRequest.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return tx.deleteAccountRequest.create({
        data: { userId, expiresAt },
      });
    });
  }

  async findById(id: string): Promise<DeleteRequestWithUser | null> {
    return this.prisma.deleteAccountRequest.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  /**
   * Atomically consumes the request (only if it is still active),
   * revokes all active refresh tokens for the user, and soft-deletes the user.
   *
   * The `updateMany ... where usedAt: null` guard makes the consume step
   * idempotent and safe against concurrent double-submits (TOCTOU): if another
   * request already consumed it, count === 0 and we abort.
   *
   * Refresh token revocation is performed inside the same transaction to ensure
   * that sessions are invalidated atomically with the account deletion — no
   * window exists where the account is deleted but tokens remain valid.
   */
  async consumeRequestAndSoftDeleteUser(
    requestId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.deleteAccountRequest.updateMany({
        where: { id: requestId, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (consumed.count === 0) {
        throw new ConflictException(
          'This request has already been processed or invalidated',
        );
      }

      // Revoke all active refresh tokens for the user so that any in-flight
      // sessions are invalidated immediately upon account deletion.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'account_deleted' },
      });

      await this.usersRepository.softDelete(userId, tx);
    });
  }
}
