// src/auth/repositories/auth.repository.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  AuthRepository,
  RefreshTokenRotationConflictError,
  type RefreshTokenRecord,
} from './auth.repository';

const mockPrismaRefreshToken = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
};

const mockPrismaService = {
  refreshToken: mockPrismaRefreshToken,
  $transaction: vi.fn((cb: (tx: typeof mockPrismaService) => unknown) =>
    cb(mockPrismaService),
  ),
};

describe('AuthRepository', () => {
  let repository: AuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AuthRepository(mockPrismaService as never);
  });

  describe('findActiveRefreshToken', () => {
    it('queries by tokenHash with revokedAt: null and expiresAt > now', async () => {
      mockPrismaRefreshToken.findFirst.mockResolvedValue(null);

      const before = new Date();
      await repository.findActiveRefreshToken('abc-hash');
      const after = new Date();

      expect(mockPrismaRefreshToken.findFirst).toHaveBeenCalledOnce();

      const callArg = mockPrismaRefreshToken.findFirst.mock.calls[0][0] as {
        where: {
          tokenHash: string;
          revokedAt: null;
          expiresAt: { gt: Date };
        };
      };

      expect(callArg.where.tokenHash).toBe('abc-hash');
      expect(callArg.where.revokedAt).toBeNull();
      expect(callArg.where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(callArg.where.expiresAt.gt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    it('returns the token record when found', async () => {
      const tokenRecord = {
        id: 'token-uuid',
        tokenHash: 'abc-hash',
        userId: 'user-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        revocationReason: null,
        replacedByTokenId: null,
        ipAddress: null,
        userAgent: null,
      };
      mockPrismaRefreshToken.findFirst.mockResolvedValue(tokenRecord);

      const result: RefreshTokenRecord | null =
        await repository.findActiveRefreshToken('abc-hash');

      expect(result).toEqual(tokenRecord);
    });

    it('returns null when no active token is found', async () => {
      mockPrismaRefreshToken.findFirst.mockResolvedValue(null);

      const result: RefreshTokenRecord | null =
        await repository.findActiveRefreshToken('missing-hash');

      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('calls updateMany with the token hash, revokedAt: null filter, and provided reason', async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      const before = new Date();
      await repository.revokeRefreshToken('abc-hash', 'logout');
      const after = new Date();

      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledOnce();

      const callArg = mockPrismaRefreshToken.updateMany.mock.calls[0][0] as {
        where: { tokenHash: string; revokedAt: null };
        data: { revokedAt: Date; revocationReason: string };
      };

      expect(callArg.where.tokenHash).toBe('abc-hash');
      expect(callArg.where.revokedAt).toBeNull();
      expect(callArg.data.revocationReason).toBe('logout');
      expect(callArg.data.revokedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(callArg.data.revokedAt.getTime()).toBeLessThanOrEqual(
        after.getTime(),
      );
    });

    it('defaults reason to "logout" when no reason is provided', async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });

      await repository.revokeRefreshToken('abc-hash');

      const callArg = mockPrismaRefreshToken.updateMany.mock.calls[0][0] as {
        data: { revocationReason: string };
      };

      expect(callArg.data.revocationReason).toBe('logout');
    });

    it('does not throw when no matching token exists (count: 0)', async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.revokeRefreshToken('nonexistent-hash'),
      ).resolves.toBeUndefined();
    });
  });

  describe('findRefreshTokenByHash', () => {
    it('queries prisma.findUnique by token hash', async () => {
      mockPrismaRefreshToken.findUnique.mockResolvedValue(null);
      await repository.findRefreshTokenByHash('hash-x');
      expect(mockPrismaRefreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hash-x' },
      });
    });
  });

  describe('createRefreshToken', () => {
    it('creates a token with hash and expiration', async () => {
      mockPrismaRefreshToken.create.mockResolvedValue({ id: 'token-1' });
      const expiresAt = new Date(Date.now() + 60_000);
      await repository.createRefreshToken({
        userId: 'user-1',
        tokenHash: 'hash-1',
        expiresAt,
      });
      expect(mockPrismaRefreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tokenHash: 'hash-1',
          expiresAt,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('throws when the old token was already revoked by a concurrent request', async () => {
      mockPrismaRefreshToken.create.mockResolvedValue({ id: 'new-token-id' });
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.rotateRefreshToken({
          currentTokenId: 'old-token-id',
          currentTokenHash: 'old-hash',
          newTokenHash: 'new-hash',
          userId: 'user-1',
          newExpiresAt: new Date(Date.now() + 60_000),
        }),
      ).rejects.toBeInstanceOf(RefreshTokenRotationConflictError);
    });
  });
});
