// src/modules/profile/profile.service.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

const mockProfileRepository = {
  findByUserId: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
};

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfileService(mockProfileRepository as never);
  });

  describe('getProfile', () => {
    it('returns profile when found', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Alex',
        bio: 'Hello!',
        avatarUrl: 'https://example.com/avatar.png',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProfileRepository.findByUserId.mockResolvedValue(profile);

      const result = await service.getProfile('user-123');

      expect(result).toEqual(profile);
      expect(mockProfileRepository.findByUserId).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('throws NotFoundException when profile not found', async () => {
      mockProfileRepository.findByUserId.mockResolvedValue(null);

      await expect(service.getProfile('user-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('creates profile when it does not exist', async () => {
      const dto = {
        displayName: 'Alex García',
        bio: 'Hello!',
        avatarUrl: 'https://example.com/avatar.png',
      };
      const createdProfile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Alex García',
        bio: 'Hello!',
        avatarUrl: 'https://example.com/avatar.png',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProfileRepository.findByUserId.mockResolvedValue(null);
      mockProfileRepository.upsert.mockResolvedValue(createdProfile);

      const result = await service.updateProfile('user-123', dto);

      expect(result).toEqual(createdProfile);
      expect(mockProfileRepository.upsert).toHaveBeenCalledWith('user-123', {
        displayName: 'Alex García',
        bio: 'Hello!',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('updates existing profile with partial data', async () => {
      const dto = {
        displayName: 'New Name',
      };
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Old Name',
        bio: 'Old bio',
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedProfile = {
        ...existingProfile,
        displayName: 'New Name',
      };
      mockProfileRepository.findByUserId.mockResolvedValue(existingProfile);
      mockProfileRepository.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile('user-123', dto);

      expect(result).toEqual(updatedProfile);
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-123', {
        displayName: 'New Name',
      });
    });

    it('only updates displayName when bio is omitted', async () => {
      const dto = {
        displayName: 'Alex',
      };
      const existingProfile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Old Name',
        bio: 'Old bio',
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProfileRepository.findByUserId.mockResolvedValue(existingProfile);
      mockProfileRepository.update.mockResolvedValue({
        ...existingProfile,
        displayName: 'Alex',
      });

      await service.updateProfile('user-123', dto);

      // Only displayName is updated - bio is not included when omitted
      expect(mockProfileRepository.update).toHaveBeenCalledWith('user-123', {
        displayName: 'Alex',
      });
    });
  });
});
