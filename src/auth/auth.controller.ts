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
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register.request.dto';
import { RegisterResponseDto } from './dto/register.response.dto';
import { LoginDto } from './dto/login.dto';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  XSRF_TOKEN_COOKIE,
  buildRefreshTokenCookieOptions,
  buildCsrfCookieOptions,
} from '../common/utils/cookies';
import { CsrfGuard } from './guards/csrf.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly refreshTtlMs =
    Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? '7') * 24 * 60 * 60 * 1000;

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
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.login(dto, {
        ipAddress: req.ip,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : undefined,
      });
      const refreshToken = result.session?.refresh_token;
      const accessToken = result.session?.access_token;

      if (!refreshToken || !accessToken) {
        throw new BadRequestException({
          code: 'LOGIN_ERROR',
          message: 'Invalid authentication response',
        });
      }

      const refreshExpiresAt = new Date(Date.now() + this.refreshTtlMs);
      const csrfToken = randomBytes(32).toString('base64url');

      res.cookie(
        REFRESH_TOKEN_COOKIE,
        refreshToken,
        buildRefreshTokenCookieOptions(refreshExpiresAt),
      );
      res.cookie(
        XSRF_TOKEN_COOKIE,
        csrfToken,
        buildCsrfCookieOptions(refreshExpiresAt),
      );

      return {
        success: true,
        data: {
          accessToken,
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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiResponse({
    status: 200,
    description: 'Session refreshed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      | string
      | undefined;
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.authService.refreshSession({
      rawRefreshToken,
      ipAddress: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      buildRefreshTokenCookieOptions(result.refreshExpiresAt),
    );
    res.cookie(
      XSRF_TOKEN_COOKIE,
      result.csrfToken,
      buildCsrfCookieOptions(result.refreshExpiresAt),
    );

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
      message: 'Refresh successful',
    };
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
  @UseGuards(CsrfGuard)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiHeader({ name: 'X-CSRF-Token', required: true })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(rawToken);
    clearAuthCookies(res);
  }
}
