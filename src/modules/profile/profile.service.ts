// src/modules/profile/profile.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProfileRepository } from './repositories/profile.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Service for profile business logic.
 * Handles get/update operations with logging.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly profileRepository: ProfileRepository) {}

  /**
   * Get profile by userId.
   * Throws NotFoundException if profile doesn't exist.
   */
  async getProfile(userId: string) {
    const profile = await this.profileRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    this.logger.log({
      message: 'profile.get_me',
      userId,
    });

    return profile;
  }

  /**
   * Update profile with the provided data.
   * Creates profile if it doesn't exist (onboarding flow).
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Check if profile exists
    const existing = await this.profileRepository.findByUserId(userId);

    if (!existing) {
      // Create initial profile (onboarding) - displayName is required
      if (!dto.displayName) {
        throw new NotFoundException(
          'Profile not found. displayName is required for onboarding.',
        );
      }
      const profile = await this.profileRepository.upsert(userId, {
        displayName: dto.displayName,
        bio: dto.bio ?? null,
        avatarUrl: dto.avatarUrl ?? null,
      });

      this.logger.log({
        message: 'profile.created',
        userId,
      });

      return profile;
    }

    // Update existing profile (partial update)
    const updateData: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }
    if (dto.bio !== undefined) {
      updateData.bio = dto.bio ?? null;
    }
    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl ?? null;
    }

    const profile = await this.profileRepository.update(userId, updateData);

    this.logger.log({
      message: 'profile.updated',
      userId,
    });

    return profile;
  }
}
