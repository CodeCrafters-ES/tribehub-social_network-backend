// src/auth/auth.controller.ts

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
  HttpException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register.request.dto';
import { RegisterResponseDto } from './dto/register.response.dto';
import { LoginDto } from './dto/login.dto';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '../common/utils/cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or malformed fields',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict — email or username already in use',
  })
  @Post('register')
  async register(@Body() dto: RegisterRequestDto) {
    try {
      const result = await this.authService.register(dto);
      return {
        success: true,
        data: result,
        message: 'User registered successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException({
        message,
        code: 'REGISTER_ERROR',
      });
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      const result = await this.authService.login(dto);
      return {
        success: true,
        data: {
          accessToken: result.session?.access_token ?? null,
          refreshToken: result.session?.refresh_token ?? null,
          user: result.user ?? null,
        },
        message: 'Login successful',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException({
        message,
        code: 'LOGIN_ERROR',
      });
    }
  }

  /**
   * POST /auth/logout
   *
   * Revokes the current session's refresh token and clears auth cookies.
   * Does NOT require an access token — logout is best-effort using the
   * httpOnly `refresh_token` cookie only.
   *
   * Returns 204 No Content in all success cases (idempotent).
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(rawToken);
    clearAuthCookies(res);
  }
}
