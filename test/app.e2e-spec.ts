import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

// Set required env vars before any module is imported/initialized.
// getRedisConnection() throws at module load time when REDIS_URL is absent.
// Pointing to localhost is sufficient for the module to boot; a live Redis
// connection is not required for the health/root endpoint test.
// SupabaseAuthGuard throws at guard instantiation when SUPABASE_URL is absent.
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    // Gracefully close the app, ignoring errors from already-closed Redis connections.
    // This prevents "Connection is closed" errors during teardown from failing tests.
    try {
      await app.close();
    } catch {
      // App already closed or connection errors - safe to ignore
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
