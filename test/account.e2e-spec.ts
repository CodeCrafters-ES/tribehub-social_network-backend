import { vi } from 'vitest';
import { TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
} from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './../src/common/types/authenticated-request.type';
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

/**
 * Crea el módulo de pruebas base con los stubs necesarios.
 * El ThrottlerModule se sobreescribe con límites bajos (limit: 3, ttl: 60000)
 * para que el test de rate limiting sea determinista e independiente de los
 * límites de producción configurados en AppModule.
 *
 * Nota: se usa limit: 3 (no 5) para que el test sea rápido y no dependa del
 * decorador @Throttle del controlador — el test envía 3 peticiones y espera
 * que la 4ª sea rechazada por el límite del módulo de test.
 */
async function buildTestModule(mockAccountService: {
  createDeleteRequest: ReturnType<typeof vi.fn>;
  confirmDeleteRequest: ReturnType<typeof vi.fn>;
}): Promise<TestingModule> {
  return createTestAppBuilder()
    .overrideModule(ThrottlerModule)
    .useModule(ThrottlerModule.forRoot([{ ttl: 60000, limit: 3 }]))
    .overrideGuard(SupabaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
        req.supabaseUser = { sub: MOCK_USER_ID };
        return true;
      },
    })
    .overrideProvider(AccountService)
    .useValue(mockAccountService)
    .overrideProvider(PrismaService)
    .useValue({
      $transaction: vi.fn((cb: (tx: typeof mockAccountService) => unknown) =>
        cb(mockAccountService),
      ),
    })
    .compile();
}

describe('Account Deletion (e2e)', () => {
  let app: INestApplication<App>;
  let mockAccountService: {
    createDeleteRequest: ReturnType<typeof vi.fn>;
    confirmDeleteRequest: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockAccountService = {
      createDeleteRequest: vi.fn(),
      confirmDeleteRequest: vi.fn(),
    };

    const moduleFixture = await buildTestModule(mockAccountService);

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

    // El ThrottlerModule de test tiene limit: 3, por lo que la 4ª petición
    // debe devolver 429 de forma determinista, sin depender de los límites
    // de producción ni del estado de otras suites.
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).post('/api/v1/account/delete/request');
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/account/delete/request')
      .expect(429);

    expect(response.body).toBeDefined();
  });
});
