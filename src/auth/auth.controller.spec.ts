// src/auth/auth.controller.spec.ts

import { vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BadRequestException } from '@nestjs/common';
import { RegisterRequestDto } from './dto/register.request.dto';
import { LoginDto } from './dto/login.dto';
import { LoginThrottlerGuard } from '../common/guards/login-throttler.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: vi.fn(),
            login: vi.fn(),
            logout: vi.fn(),
            refreshSession: vi.fn(),
          },
        },
      ],
    })
      // The login route binds LoginThrottlerGuard via @UseGuards; override it
      // so the test module doesn't need the real ThrottlerModule wiring/Redis.
      .overrideGuard(LoginThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should register a user', async () => {
    const dto: RegisterRequestDto = {
      email: 'test@gmail.com',
      username: 'testuser',
      password: 'password123',
    };
    (service.register as Mock).mockResolvedValue({ id: 'user-id' });

    const result = await controller.register(dto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'user-id' });
  });

  it('should handle register error', async () => {
    const dto: RegisterRequestDto = {
      email: 'fail@example.com',
      username: 'failuser',
      password: 'password123',
    };
    (service.register as Mock).mockRejectedValue(new Error('Register failed'));

    await expect(controller.register(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should login a user and set three cookies (access_token, refresh_token, XSRF-TOKEN)', async () => {
    const dto: LoginDto = { email: 'test@gmail.com', password: 'password123' };
    (service.login as Mock).mockResolvedValue({
      session: {
        access_token: 'access-jwt',
        refresh_token: 'refresh-jwt',
        expires_in: 3600,
      },
      localUser: {
        id: 'user-id',
        username: 'testuser',
        email: 'test@gmail.com',
      },
      csrfToken: 'csrf-token-abc',
      refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const req = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'vitest' },
    } as unknown as import('express').Request;
    const res = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as import('express').Response;

    const result = await controller.login(dto, req, res);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 'user-id',
      username: 'testuser',
      email: 'test@gmail.com',
    });
    // Three cookies: access_token, refresh_token, XSRF-TOKEN
    expect((res.cookie as Mock).mock.calls.length).toBe(3);
    const cookieNames = (res.cookie as Mock).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(cookieNames).toContain('access_token');
    expect(cookieNames).toContain('refresh_token');
    expect(cookieNames).toContain('XSRF-TOKEN');
  });

  it('should handle login error', async () => {
    const dto: LoginDto = {
      email: 'fail@example.com',
      password: 'password123',
    };
    (service.login as Mock).mockRejectedValue(new Error('Login failed'));

    await expect(
      controller.login(
        { ...dto },
        { headers: {}, ip: '127.0.0.1' } as never,
        {} as never,
      ),
    ).rejects.toThrowError('Login failed');
  });

  describe('refresh', () => {
    it('rotates cookie and returns new access token', async () => {
      (service.refreshSession as Mock).mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        refreshExpiresAt: new Date(Date.now() + 1000),
        csrfToken: 'new-csrf',
      });

      const req = {
        cookies: { refresh_token: 'old-refresh' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest' },
      } as unknown as import('express').Request;
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as import('express').Response;

      const result = await controller.refresh(req, res);

      expect(result).toMatchObject({
        success: true,
        data: { accessToken: 'new-access' },
      });
      expect((res.cookie as Mock).mock.calls.length).toBe(2);
    });

    it('throws UnauthorizedException (401) when refresh_token cookie is absent', async () => {
      const req = {
        cookies: {},
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest' },
      } as unknown as import('express').Request;
      const res = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      } as unknown as import('express').Response;

      await expect(controller.refresh(req, res)).rejects.toThrow(
        'Unauthorized',
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.refreshSession).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    function buildMockReq(cookieValue?: string) {
      return {
        cookies:
          cookieValue !== undefined ? { refresh_token: cookieValue } : {},
      } as unknown as import('express').Request;
    }

    function buildMockRes() {
      return {
        clearCookie: vi.fn(),
      } as unknown as import('express').Response;
    }

    it('calls service.logout with the refresh_token cookie value', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const logoutMock = service.logout as Mock;
      logoutMock.mockResolvedValue(undefined);
      const req = buildMockReq('my-refresh-token');
      const res = buildMockRes();

      await controller.logout(req, res);

      expect(logoutMock).toHaveBeenCalledOnce();
      expect(logoutMock).toHaveBeenCalledWith('my-refresh-token');
    });

    it('calls service.logout with undefined when no cookie is present', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const logoutMock = service.logout as Mock;
      logoutMock.mockResolvedValue(undefined);
      const req = buildMockReq();
      const res = buildMockRes();

      await controller.logout(req, res);

      expect(logoutMock).toHaveBeenCalledOnce();
      expect(logoutMock).toHaveBeenCalledWith(undefined);
    });

    it('clears auth cookies regardless of service outcome', async () => {
      (service.logout as Mock).mockResolvedValue(undefined);
      const req = buildMockReq('my-refresh-token');
      const res = buildMockRes();

      await controller.logout(req, res);

      // clearCookie must be called for access_token, refresh_token, and XSRF-TOKEN
      expect(
        (res.clearCookie as Mock).mock.calls.length,
      ).toBeGreaterThanOrEqual(3);
      const clearedNames = (res.clearCookie as Mock).mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(clearedNames).toContain('access_token');
      expect(clearedNames).toContain('refresh_token');
      expect(clearedNames).toContain('XSRF-TOKEN');
    });

    it('returns undefined (204 No Content body is empty)', async () => {
      (service.logout as Mock).mockResolvedValue(undefined);
      const req = buildMockReq('any-token');
      const res = buildMockRes();

      const result = await controller.logout(req, res);

      expect(result).toBeUndefined();
    });
  });
});
