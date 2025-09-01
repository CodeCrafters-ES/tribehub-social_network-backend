// src/auth/auth.controller.spec.ts

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
            register: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should register a user', async () => {
    const dto: RegisterDto = { email: 'test@gmail.com', username: 'testuser', password: 'password123' };
    (service.register as jest.Mock).mockResolvedValue({ id: 'user-id' });

    const result = await controller.register(dto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'user-id' });
  });

  it('should handle register error', async () => {
    const dto: RegisterDto = { email: 'fail@example.com', username: 'failuser', password: 'password123' };
    (service.register as jest.Mock).mockRejectedValue(new Error('Register failed'));

    const result = await controller.register(dto);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('REGISTER_ERROR');
  });

  it('should login a user', async () => {
    const dto: LoginDto = { email: 'test@gmail.com', password: 'password123' };
    (service.login as jest.Mock).mockResolvedValue({ session: 'session-token' });

    const result = await controller.login(dto);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ session: 'session-token' });
  });

  it('should handle login error', async () => {
    const dto: LoginDto = { email: 'fail@example.com', password: 'password123' };
    (service.login as jest.Mock).mockRejectedValue(new Error('Login failed'));

    const result = await controller.login(dto);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('LOGIN_ERROR');
  });
});
