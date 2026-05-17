// src/modules/profile/profile.controller.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProfileController } from './profile.controller';

const mockProfileService = {
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
};

describe('ProfileController', () => {
  let controller: ProfileController;
  const mockRequest = {
    userId: 'user-123',
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ProfileController(mockProfileService as never);
  });

  describe('getProfile', () => {
    it('returns the user profile', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Alex',
        bio: 'Hello!',
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProfileService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(profile);
      expect(mockProfileService.getProfile).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the profile', async () => {
      const dto = {
        displayName: 'Alex García',
        bio: 'Updated bio',
      };
      const profile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Alex García',
        bio: 'Updated bio',
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProfileService.updateProfile.mockResolvedValue(profile);

      const result = await controller.updateProfile(mockRequest, dto);

      expect(result).toEqual(profile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
        'user-123',
        dto,
      );
    });
  });
});
