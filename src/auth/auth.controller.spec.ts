// src/auth/auth.controller.spec.ts

import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

describe('AuthController', () => {
  let controller: AuthController;
  const serviceMock = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should register a user', async () => {
    const dto: RegisterDto = {
      email: 'test@gmail.com',
      username: 'testuser',
      password: 'password123',
    };
    serviceMock.register.mockResolvedValue({ id: 'user-id' });

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
    serviceMock.register.mockRejectedValue(new Error('Register failed'));

    await expect(controller.register(dto)).rejects.toThrowError(
      'Register failed',
    );
  });

  it('should login a user', async () => {
    const dto: LoginDto = { email: 'test@gmail.com', password: 'password123' };
    serviceMock.login.mockResolvedValue({ session: 'session-token' });

    const result = await controller.login(dto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session: 'session-token' });
  });

  it('should handle login error', async () => {
    const dto: LoginDto = {
      email: 'fail@example.com',
      password: 'password123',
    };
    serviceMock.login.mockRejectedValue(new Error('Login failed'));

    await expect(controller.login(dto)).rejects.toThrowError('Login failed');
  });

  it('should refresh a session token', async () => {
    const dto: RefreshTokenDto = { refreshToken: 'header.payload.signature' };
    const req = { headers: {} } as never;

    serviceMock.refresh.mockResolvedValue({ session: 'new-session' });

    const result = await controller.refresh(dto, req);

    expect(serviceMock.refresh).toHaveBeenCalledWith(
      'header.payload.signature',
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session: 'new-session' });
  });

  it('should logout idempotently', async () => {
    const dto: RefreshTokenDto = {};
    const req = { headers: {} } as never;

    serviceMock.logout.mockResolvedValue(undefined);

    const result = await controller.logout(dto, req);

    expect(serviceMock.logout).toHaveBeenCalledWith(undefined);
    expect(result).toEqual({
      success: true,
      message: 'Logout successful',
    });
  });
});
