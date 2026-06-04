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
import { LoginResponseDto } from './dto/login.response.dto';
import {
  clearAuthCookies,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  XSRF_TOKEN_COOKIE,
  buildAccessTokenCookieOptions,
  buildRefreshTokenCookieOptions,
  buildCsrfCookieOptions,
} from '../common/utils/cookies';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { LoginThrottlerGuard } from '../common/guards/login-throttler.guard';
import { SkipThrottle } from '@nestjs/throttler';

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
  @HttpCode(HttpStatus.OK)
  // Brute-force protection: 5 attempts / 5 min, bucketed by IP and by IP+email.
  // @SkipThrottle() disables the global IP-based ThrottlerGuard for this route
  // so LoginThrottlerGuard governs it alone — otherwise the global guard would
  // run first and return the default 429 body instead of the API contract one.
  @UseGuards(LoginThrottlerGuard)
  @SkipThrottle()
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful — tokens set as httpOnly cookies',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or malformed fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid credentials',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests — login rate limit exceeded',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
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
      throw new UnauthorizedException('Invalid authentication response');
    }

    const { refreshExpiresAt } = result;
    // Supabase access tokens expire in `expires_in` seconds (default 3600).
    // Fall back to 3600 s if the field is absent.
    const accessTokenTtlMs =
      ((result.session as { expires_in?: number } | null)?.expires_in ?? 3600) *
      1000;
    const accessTokenExpiresAt = new Date(Date.now() + accessTokenTtlMs);
    const { csrfToken } = result;

    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      buildAccessTokenCookieOptions(accessTokenExpiresAt),
    );
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

    const user = result.localUser;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({
    summary: 'Rotate refresh token and obtain a new access token',
  })
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
