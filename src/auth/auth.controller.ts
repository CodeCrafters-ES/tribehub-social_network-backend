// src/auth/auth.controller.ts

import {
  Body,
  Controller,
  Post,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { extractRefreshToken } from './utils/refresh-token-extractor';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
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

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const refreshToken = extractRefreshToken(req, dto.refreshToken);
    const result = await this.authService.refresh(refreshToken);

    return {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const refreshToken = extractRefreshToken(req, dto.refreshToken);
    await this.authService.logout(refreshToken);

    return {
      success: true,
      message: 'Logout successful',
    };
  }
}
