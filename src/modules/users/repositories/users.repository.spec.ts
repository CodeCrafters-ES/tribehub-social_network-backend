// src/modules/users/repositories/users.repository.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UsersRepository } from './users.repository';

const mockPrismaUser = {
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};

const mockPrismaService = {
  user: mockPrismaUser,
};

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UsersRepository(mockPrismaService as never);
  });

  describe('create', () => {
    it('calls prisma.user.create with the provided data', async () => {
      const input = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: '$argon2id$hashed',
        supabaseId: 'supabase-uuid-123',
      };

      const expectedUser = {
        id: 'uuid-1',
        ...input,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaUser.create.mockResolvedValue(expectedUser);

      const result = await repository.create(input);

      expect(mockPrismaUser.create).toHaveBeenCalledOnce();
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          username: input.username,
          passwordHash: input.passwordHash,
          supabaseId: input.supabaseId,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('uses null for supabaseId when not provided', async () => {
      const input = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: '$argon2id$hashed',
      };

      mockPrismaUser.create.mockResolvedValue({
        id: 'uuid-2',
        ...input,
        supabaseId: null,
      });

      await repository.create(input);

      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          username: input.username,
          passwordHash: input.passwordHash,
          supabaseId: null,
        },
      });
    });
  });

  describe('findByEmail', () => {
    it('calls prisma.user.findFirst filtering by email and deletedAt: null', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      await repository.findByEmail('test@example.com');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledOnce();
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
        },
      });
    });

    it('returns the user when found', async () => {
      const user = { id: 'uuid-1', email: 'test@example.com', deletedAt: null };
      mockPrismaUser.findFirst.mockResolvedValue(user);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(user);
    });

    it('returns null when user is not found', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('calls prisma.user.findFirst filtering by username and deletedAt: null', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      await repository.findByUsername('testuser');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledOnce();
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          username: 'testuser',
          deletedAt: null,
        },
      });
    });

    it('returns the user when found', async () => {
      const user = { id: 'uuid-1', username: 'testuser', deletedAt: null };
      mockPrismaUser.findFirst.mockResolvedValue(user);

      const result = await repository.findByUsername('testuser');

      expect(result).toEqual(user);
    });

    it('returns null when user is not found', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByUsername('missing');

      expect(result).toBeNull();
    });
  });

  describe('findBySupabaseId', () => {
    it('calls prisma.user.findFirst filtering by supabaseId and deletedAt: null', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      await repository.findBySupabaseId('supabase-uuid-123');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledOnce();
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          supabaseId: 'supabase-uuid-123',
          deletedAt: null,
        },
      });
    });

    it('returns the user when found', async () => {
      const user = {
        id: 'uuid-1',
        supabaseId: 'supabase-uuid-123',
        deletedAt: null,
      };
      mockPrismaUser.findFirst.mockResolvedValue(user);

      const result = await repository.findBySupabaseId('supabase-uuid-123');

      expect(result).toEqual(user);
    });

    it('returns null when user is not found', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findBySupabaseId('unknown-supabase-id');

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('stamps deletedAt and flips status to DELETED', async () => {
      mockPrismaUser.update.mockResolvedValue({ id: 'uuid-1' });

      await repository.softDelete('uuid-1');

      expect(mockPrismaUser.update).toHaveBeenCalledOnce();
      const arg = mockPrismaUser.update.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string; deletedAt: Date };
      };
      expect(arg.where).toEqual({ id: 'uuid-1' });
      expect(arg.data.status).toBe('DELETED');
      expect(arg.data.deletedAt).toBeInstanceOf(Date);
    });

    it('uses the provided transaction client when given', async () => {
      const txUpdate = vi.fn().mockResolvedValue({ id: 'uuid-2' });
      const tx = { user: { update: txUpdate } };

      await repository.softDelete('uuid-2', tx as never);

      expect(txUpdate).toHaveBeenCalledOnce();
      expect(mockPrismaUser.update).not.toHaveBeenCalled();
    });
  });
});
