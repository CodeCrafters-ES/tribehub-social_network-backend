// src/modules/profile/profile.controller.ts

import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { SupabaseAuthGuard } from '../../auth/guards/supabase-auth.guard';

/**
 * Controller for profile endpoints.
 * Protected by SupabaseAuthGuard - all routes require authentication.
 */
@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * GET /v1/profile/me
   * Get the current user's profile.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile returned',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getProfile(@Req() request: AuthenticatedRequest) {
    // Use internal user ID from the guard sync
    const userId = request.userId;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.profileService.getProfile(userId);
  }

  /**
   * PATCH /v1/profile/me
   * Update the current user's profile.
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    // Use internal user ID from the guard sync
    const userId = request.userId;
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    return this.profileService.updateProfile(userId, dto);
  }
}
