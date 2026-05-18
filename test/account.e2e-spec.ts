import { vi } from 'vitest';
import { TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { PrismaService } from './../src/prisma/prisma.service';
import { AccountService } from './../src/modules/account/account.service';
import { SupabaseAuthGuard } from './../src/auth/guards/supabase-auth.guard';
import { createTestAppBuilder } from './test-app.factory';

// Environment stubs (REDIS_URL, SUPABASE_*) are set by test/setup-integration.ts
// which vitest.integration.config.ts lists in setupFiles. No env setup needed here.

const MOCK_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MOCK_DELETE_REQUEST_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

function applyGlobalSetup(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
}

describe('Account Deletion (e2e)', () => {
  let app: INestApplication<App>;
  let mockAccountService: any;

  beforeEach(async () => {
    mockAccountService = {
      createDeleteRequest: vi.fn(),
      confirmDeleteRequest: vi.fn(),
    };

    const moduleFixture: TestingModule = await createTestAppBuilder()
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.supabaseUser = { sub: MOCK_USER_ID };
          return true;
        },
      })
      .overrideProvider(AccountService)
      .useValue(mockAccountService)
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: vi.fn((cb) => cb(mockAccountService)),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalSetup(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('POST /api/v1/account/delete/request', () => {
    it('should return 200 and a request ID', async () => {
      mockAccountService.createDeleteRequest.mockResolvedValue({
        deleteRequestId: MOCK_DELETE_REQUEST_ID,
        expiresIn: 900,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/account/delete/request')
        .expect(200);

      expect(response.body).toMatchObject({
        deleteRequestId: MOCK_DELETE_REQUEST_ID,
      });
      expect(mockAccountService.createDeleteRequest).toHaveBeenCalledWith(
        MOCK_USER_ID,
      );
    });
  });

  describe('POST /api/v1/account/delete/confirm', () => {
    it('should return 200 when credentials are valid', async () => {
      mockAccountService.confirmDeleteRequest.mockResolvedValue({ ok: true });

      const payload = {
        deleteRequestId: MOCK_DELETE_REQUEST_ID,
        password: 'SecurePassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/account/delete/confirm')
        .send(payload)
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      expect(mockAccountService.confirmDeleteRequest).toHaveBeenCalled();
    });
  });

  it('should trigger rate limiting after exceeding the limit', async () => {
    mockAccountService.createDeleteRequest.mockResolvedValue({ ok: true });

    // Realizamos las 5 peticiones permitidas
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/api/v1/account/delete/request');
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/account/delete/request')
      .expect(429);

    expect(response.body).toBeDefined();
  });
});
