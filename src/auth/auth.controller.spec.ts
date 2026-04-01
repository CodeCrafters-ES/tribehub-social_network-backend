// src/auth/auth.controller.spec.ts

import { vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should register a user', async () => {
    const dto: RegisterDto = {
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
    const dto: RegisterDto = {
      email: 'fail@example.com',
      username: 'failuser',
      password: 'password123',
    };
    (service.register as Mock).mockRejectedValue(new Error('Register failed'));

    await expect(controller.register(dto)).rejects.toThrowError(
      'Register failed',
    );
  });

  it('should login a user', async () => {
    const dto: LoginDto = { email: 'test@gmail.com', password: 'password123' };
    (service.login as Mock).mockResolvedValue({ session: 'session-token' });

    const result = await controller.login(dto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session: 'session-token' });
  });

  it('should handle login error', async () => {
    const dto: LoginDto = {
      email: 'fail@example.com',
      password: 'password123',
    };
    (service.login as Mock).mockRejectedValue(new Error('Login failed'));

    await expect(controller.login(dto)).rejects.toThrowError('Login failed');
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

      // clearCookie must be called at least once for refresh_token and XSRF-TOKEN
      expect(
        (res.clearCookie as Mock).mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
      const clearedNames = (res.clearCookie as Mock).mock.calls.map(
        (c: unknown[]) => c[0],
      );
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
