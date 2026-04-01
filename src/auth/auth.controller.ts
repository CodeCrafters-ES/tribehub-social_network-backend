// src/auth/auth.controller.ts

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register.request.dto';
import { LoginDto } from './dto/login.dto';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '../common/utils/cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException({
        code: 'REGISTER_ERROR',
        message,
      });
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      const result = await this.authService.login(dto);
      return {
        success: true,
        data: result,
        message: 'Login successful',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException({
        code: 'LOGIN_ERROR',
        message,
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
