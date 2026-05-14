// src/modules/interests/services/interests.service.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InterestsService } from './interests.service';

const mockInterestsRepository = {
  findAllValidated: vi.fn(),
  findManyByIds: vi.fn(),
  getUserInterests: vi.fn(),
  setUserInterests: vi.fn(),
};

const mockUsersRepository = {
  findBySupabaseId: vi.fn(),
};

const validatedInterest = {
  id: 'uuid-1',
  name: 'Technology',
  slug: 'technology',
  category: 'Tech',
  status: 'VALIDATED',
};

const activeUser = {
  id: 'user-uuid',
  supabaseId: 'supabase-uuid',
  email: 'test@example.com',
  username: 'testuser',
};

describe('InterestsService', () => {
  let service: InterestsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InterestsService(
      mockInterestsRepository as never,
      mockUsersRepository as never,
    );
  });

  describe('listInterests', () => {
    it('returns items mapped from repository including slug', async () => {
      mockInterestsRepository.findAllValidated.mockResolvedValue([
        validatedInterest,
      ]);

      const result = await service.listInterests();

      expect(mockInterestsRepository.findAllValidated).toHaveBeenCalledWith(
        undefined,
      );
      expect(result).toEqual({
        items: [
          {
            id: 'uuid-1',
            name: 'Technology',
            slug: 'technology',
            category: 'Tech',
            status: 'VALIDATED',
          },
        ],
      });
    });

    it('passes category filter to repository', async () => {
      mockInterestsRepository.findAllValidated.mockResolvedValue([]);

      await service.listInterests('Tech');

      expect(mockInterestsRepository.findAllValidated).toHaveBeenCalledWith(
        'Tech',
      );
    });

    it('returns empty items array when no interests exist', async () => {
      mockInterestsRepository.findAllValidated.mockResolvedValue([]);

      const result = await service.listInterests();

      expect(result).toEqual({ items: [] });
    });
  });

  describe('getUserInterests', () => {
    it('throws UnauthorizedException when user is not found', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(null);

      await expect(
        service.getUserInterests('unknown-supabase-id'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns user interests when user exists', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.getUserInterests.mockResolvedValue([
        validatedInterest,
      ]);

      const result = await service.getUserInterests('supabase-uuid');

      expect(mockInterestsRepository.getUserInterests).toHaveBeenCalledWith(
        'user-uuid',
      );
      expect(result).toEqual({ items: [validatedInterest] });
    });
  });

  describe('setUserInterests', () => {
    it('throws UnauthorizedException when user is not found', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(null);

      await expect(
        service.setUserInterests('unknown', { interestIds: ['uuid-1'] }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when an interest id does not exist', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.findManyByIds.mockResolvedValue([]);

      await expect(
        service.setUserInterests('supabase-uuid', {
          interestIds: ['uuid-missing'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when an interest is not VALIDATED', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.findManyByIds.mockResolvedValue([
        { ...validatedInterest, status: 'PENDING' },
      ]);

      await expect(
        service.setUserInterests('supabase-uuid', { interestIds: ['uuid-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deduplicates interest ids before processing', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.findManyByIds.mockResolvedValue([
        validatedInterest,
      ]);
      mockInterestsRepository.setUserInterests.mockResolvedValue(undefined);
      mockInterestsRepository.getUserInterests.mockResolvedValue([
        validatedInterest,
      ]);

      await service.setUserInterests('supabase-uuid', {
        interestIds: ['uuid-1', 'uuid-1'],
      });

      expect(mockInterestsRepository.findManyByIds).toHaveBeenCalledWith([
        'uuid-1',
      ]);
    });

    it('replaces user interests and returns updated list', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.findManyByIds.mockResolvedValue([
        validatedInterest,
      ]);
      mockInterestsRepository.setUserInterests.mockResolvedValue(undefined);
      mockInterestsRepository.getUserInterests.mockResolvedValue([
        validatedInterest,
      ]);

      const result = await service.setUserInterests('supabase-uuid', {
        interestIds: ['uuid-1'],
      });

      expect(mockInterestsRepository.setUserInterests).toHaveBeenCalledWith(
        'user-uuid',
        ['uuid-1'],
      );
      expect(result).toEqual({ items: [validatedInterest] });
    });

    it('allows empty interestIds to reset all interests', async () => {
      mockUsersRepository.findBySupabaseId.mockResolvedValue(activeUser);
      mockInterestsRepository.setUserInterests.mockResolvedValue(undefined);
      mockInterestsRepository.getUserInterests.mockResolvedValue([]);

      const result = await service.setUserInterests('supabase-uuid', {
        interestIds: [],
      });

      expect(mockInterestsRepository.findManyByIds).not.toHaveBeenCalled();
      expect(mockInterestsRepository.setUserInterests).toHaveBeenCalledWith(
        'user-uuid',
        [],
      );
      expect(result).toEqual({ items: [] });
    });
  });
});
