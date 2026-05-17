// src/modules/users/users.service.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UsersService } from './users.service';

const mockUsersRepository = {
  findBySupabaseId: vi.fn(),
  create: vi.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockUsersRepository as never);
  });

  describe('ensureUserExists', () => {
    it('returns the existing user id when user already exists', async () => {
      const existingUser = { id: 'internal-uuid-1', supabaseId: 'supa-abc123' };
      mockUsersRepository.findBySupabaseId.mockResolvedValue(existingUser);

      const result = await service.ensureUserExists(
        'supa-abc123',
        'alex@example.com',
      );

      expect(mockUsersRepository.findBySupabaseId).toHaveBeenCalledOnce();
      expect(mockUsersRepository.findBySupabaseId).toHaveBeenCalledWith(
        'supa-abc123',
      );
      expect(mockUsersRepository.create).not.toHaveBeenCalled();
      expect(result).toBe('internal-uuid-1');
    });

    it('creates a new user and returns its id when user does not exist', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(null);
      const createdUser = { id: 'internal-uuid-2', supabaseId: 'supa-newuser' };
      mockUsersRepository.create.mockResolvedValue(createdUser);

      const result = await service.ensureUserExists(
        'supa-newuser',
        'newuser@example.com',
      );

      expect(mockUsersRepository.findBySupabaseId).toHaveBeenCalledOnce();
      expect(mockUsersRepository.create).toHaveBeenCalledOnce();
      expect(mockUsersRepository.create).toHaveBeenCalledWith({
        supabaseId: 'supa-newuser',
        email: 'newuser@example.com',
        username: 'newuser_supa-new',
        passwordHash: null,
      });
      expect(result).toBe('internal-uuid-2');
    });

    it('derives username from email local part and first 8 chars of supabaseId', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue({ id: 'uuid-3' });

      await service.ensureUserExists(
        'abcdefgh-1234-5678',
        'john.doe@tribehub.app',
      );

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'john.doe_abcdefgh',
        }),
      );
    });

    it('sets passwordHash to null for Supabase-auth users', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(null);
      mockUsersRepository.create.mockResolvedValue({ id: 'uuid-4' });

      await service.ensureUserExists('supa-xyz', 'user@example.com');

      expect(mockUsersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: null }),
      );
    });
  });
});
