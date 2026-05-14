// src/modules/interests/controllers/user-interests.controller.ts

import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { JwtPayload } from 'jsonwebtoken';
import { SupabaseAuthGuard } from '../../../auth/guards/supabase-auth.guard';
import { InterestsService } from '../services/interests.service';
import { SetUserInterestsDto } from '../dto/set-user-interests.dto';

type AuthenticatedRequest = Request & { supabaseUser: JwtPayload };

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserInterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get('me/interests')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get interests of the authenticated user' })
  @ApiResponse({ status: 200, description: 'User interests' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyInterests(@Req() req: AuthenticatedRequest) {
    return this.interestsService.getUserInterests(
      req.supabaseUser.sub as string,
    );
  }

  @Put('me/interests')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: "Replace the authenticated user's interests" })
  @ApiResponse({ status: 200, description: 'Updated user interests' })
  @ApiResponse({
    status: 400,
    description: 'Invalid interest IDs or pending status',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  setMyInterests(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetUserInterestsDto,
  ) {
    return this.interestsService.setUserInterests(
      req.supabaseUser.sub as string,
      dto,
    );
  }
}
