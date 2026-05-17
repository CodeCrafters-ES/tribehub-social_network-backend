// src/modules/profile/repositories/profile.repository.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProfileRepository } from './profile.repository';

const mockPrismaProfile = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
};

const mockPrismaService = {
  profile: mockPrismaProfile,
};

describe('ProfileRepository', () => {
  let repository: ProfileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProfileRepository(mockPrismaService as never);
  });

  describe('findByUserId', () => {
    it('calls prisma.profile.findUnique with the userId', async () => {
      mockPrismaProfile.findUnique.mockResolvedValue(null);

      await repository.findByUserId('user-123');

      expect(mockPrismaProfile.findUnique).toHaveBeenCalledOnce();
      expect(mockPrismaProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123', deletedAt: null },
      });
    });

    it('returns the profile when found', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'Alex',
        bio: null,
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaProfile.findUnique.mockResolvedValue(profile);

      const result = await repository.findByUserId('user-123');

      expect(result).toEqual(profile);
    });

    it('returns null when profile is not found', async () => {
      mockPrismaProfile.findUnique.mockResolvedValue(null);

      const result = await repository.findByUserId('user-missing');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('calls prisma.profile.upsert with create data when profile does not exist', async () => {
      const input = {
        displayName: 'Alex García',
        bio: 'Hello!',
        avatarUrl: null,
      };
      const expectedProfile = {
        id: 'profile-1',
        userId: 'user-123',
        ...input,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaProfile.upsert.mockResolvedValue(expectedProfile);

      const result = await repository.upsert('user-123', input);

      expect(mockPrismaProfile.upsert).toHaveBeenCalledOnce();
      expect(mockPrismaProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', ...input },
        update: input,
      });
      expect(result).toEqual(expectedProfile);
    });

    it('calls prisma.profile.upsert with update data when profile exists', async () => {
      const input = {
        displayName: 'Updated Name',
        bio: 'New bio',
      };
      mockPrismaProfile.upsert.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-123',
        ...input,
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.upsert('user-123', input);

      expect(mockPrismaProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        create: { userId: 'user-123', ...input },
        update: input,
      });
    });
  });

  describe('update', () => {
    it('calls prisma.profile.update with partial data', async () => {
      const input = { displayName: 'New Name' };
      const expectedProfile = {
        id: 'profile-1',
        userId: 'user-123',
        displayName: 'New Name',
        bio: null,
        avatarUrl: null,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaProfile.update.mockResolvedValue(expectedProfile);

      const result = await repository.update('user-123', input);

      expect(mockPrismaProfile.update).toHaveBeenCalledOnce();
      expect(mockPrismaProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: input,
      });
      expect(result).toEqual(expectedProfile);
    });
  });
});
