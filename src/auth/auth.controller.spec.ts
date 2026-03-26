// src/auth/auth.controller.spec.ts

import { vi } from 'vitest';
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
    (service.register as vi.Mock).mockResolvedValue({ id: 'user-id' });

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
    (service.register as vi.Mock).mockRejectedValue(
      new Error('Register failed'),
    );

    await expect(controller.register(dto)).rejects.toThrowError(
      'Register failed',
    );
  });

  it('should login a user', async () => {
    const dto: LoginDto = { email: 'test@gmail.com', password: 'password123' };
    const mockUser = { id: 'user-id', username: 'testuser', email: 'test@gmail.com' };
    (service.login as vi.Mock).mockResolvedValue({
      user: mockUser,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const mockRes = {
      cookie: vi.fn(),
    };

    const result = await controller.login(dto, mockRes as any);
    expect(result).toEqual(mockUser);
    expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'access-token', expect.any(Object));
    expect(mockRes.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-token', expect.any(Object));
  });

  it('should handle login error', async () => {
    const dto: LoginDto = {
      email: 'fail@example.com',
      password: 'password123',
    };
    (service.login as vi.Mock).mockRejectedValue(new Error('Login failed'));

    const mockRes = {
      cookie: vi.fn(),
    };

    await expect(controller.login(dto, mockRes as any)).rejects.toThrowError('Login failed');
  });
});
