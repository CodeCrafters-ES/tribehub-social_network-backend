import { vi } from 'vitest';
import { TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { PrismaService } from './../src/prisma/prisma.service';
import { AuthService } from './../src/auth/auth.service';
import { createTestAppBuilder } from './test-app.factory';

interface ValidationErrorBody {
  errors: Array<{ field: string; errors: string[] }>;
}

// Environment stubs (REDIS_URL, SUPABASE_*) are set by test/setup-integration.ts
// which vitest.integration.config.ts lists in setupFiles. No env setup needed here.

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const VALID_PAYLOAD = {
  email: 'alice@example.com',
  username: 'alice',
  password: 'Secure@123',
};

const REGISTERED_USER = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: VALID_PAYLOAD.email,
  username: VALID_PAYLOAD.username,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// Helpers — replicate the bootstrap() setup from main.ts
// ---------------------------------------------------------------------------

function applyGlobalSetup(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = errors.map((error) => {
          const constraintsMap: Record<string, string> = (error.constraints ??
            {}) as Record<string, string>;
          const constraints: string[] = Object.values(constraintsMap);
          return {
            field: error.property,
            errors: constraints,
          };
        });
        return new BadRequestException({
          message: 'Errores de validación',
          errors: messages,
        });
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let mockRegister: ReturnType<typeof vi.fn>;
  let mockRefreshSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRegister = vi.fn();
    mockRefreshSession = vi.fn();

    const moduleFixture: TestingModule = await createTestAppBuilder()
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
      })
      .overrideProvider(AuthService)
      .useValue({
        register: mockRegister,
        login: vi.fn(),
        logout: vi.fn(),
        refreshSession: mockRefreshSession,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    applyGlobalSetup(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Happy path — 201 Created
  // -------------------------------------------------------------------------

  it('returns 201 and the created user data on a valid registration', async () => {
    mockRegister.mockResolvedValue(REGISTERED_USER);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_PAYLOAD)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      message: 'User registered successfully',
      data: {
        id: REGISTERED_USER.id,
        email: REGISTERED_USER.email,
        username: REGISTERED_USER.username,
      },
    });

    // passwordHash must never appear in the response
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('password');

    expect(mockRegister).toHaveBeenCalledOnce();
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        email: VALID_PAYLOAD.email,
        username: VALID_PAYLOAD.username,
        password: VALID_PAYLOAD.password,
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 409 Conflict — duplicate email
  // -------------------------------------------------------------------------

  it('returns 409 when the email is already in use', async () => {
    mockRegister.mockRejectedValue(
      new ConflictException('Email already in use'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_PAYLOAD)
      .expect(409);

    expect(response.body).toMatchObject({
      message: 'Email already in use',
    });
  });

  // -------------------------------------------------------------------------
  // 409 Conflict — duplicate username
  // -------------------------------------------------------------------------

  it('returns 409 when the username is already in use', async () => {
    mockRegister.mockRejectedValue(
      new ConflictException('Username already in use'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_PAYLOAD)
      .expect(409);

    expect(response.body).toMatchObject({
      message: 'Username already in use',
    });
  });

  // -------------------------------------------------------------------------
  // 400 Bad Request — missing required fields
  // -------------------------------------------------------------------------

  it('returns 400 when all required fields are missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({})
      .expect(400);

    // ValidationPipe exceptionFactory wraps errors under the `errors` array
    const body = response.body as ValidationErrorBody;
    expect(response.body).toHaveProperty('errors');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);

    // Service must NOT have been called when validation fails
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 400 when email is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...VALID_PAYLOAD, email: 'not-an-email' })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
    const emailErrors = (response.body as ValidationErrorBody).errors.find(
      (e) => e.field === 'email',
    );
    expect(emailErrors).toBeDefined();

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 400 when password does not meet strength requirements', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...VALID_PAYLOAD, password: 'weak' })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
    const passwordErrors = (response.body as ValidationErrorBody).errors.find(
      (e) => e.field === 'password',
    );
    expect(passwordErrors).toBeDefined();

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('returns 400 when username contains spaces', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...VALID_PAYLOAD, username: 'user name' })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
    const usernameErrors = (response.body as ValidationErrorBody).errors.find(
      (e) => e.field === 'username',
    );
    expect(usernameErrors).toBeDefined();

    expect(mockRegister).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 400 Bad Request — non-whitelisted extra fields
  // -------------------------------------------------------------------------

  it('returns 400 when extra unknown fields are sent (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...VALID_PAYLOAD, role: 'admin' })
      .expect(400);

    // Service must NOT have been called when validation fails
    expect(mockRegister).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Service-level error wrapping — unexpected errors become 400
  // -------------------------------------------------------------------------

  it('returns 400 with REGISTER_ERROR code when AuthService throws an unexpected error', async () => {
    mockRegister.mockRejectedValue(new Error('Supabase is down'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_PAYLOAD)
      .expect(400);

    // The body should contain the code property
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'REGISTER_ERROR',
      message: 'Supabase is down',
    });
  });

  // -------------------------------------------------------------------------
  // InternalServerError from service propagates as-is (HttpException passthrough)
  // -------------------------------------------------------------------------

  it('propagates 500 InternalServerErrorException from AuthService unchanged', async () => {
    mockRegister.mockRejectedValue(
      new InternalServerErrorException('Failed to create user'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(VALID_PAYLOAD)
      .expect(500);

    expect(response.body).toMatchObject({
      message: 'Failed to create user',
    });
  });

  it('returns 403 on /auth/refresh when CSRF header is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refresh_token=token-a', 'XSRF-TOKEN=csrf-a'])
      .expect(403);
  });

  it('returns 200 on /auth/refresh with valid csrf + cookies', async () => {
    mockRefreshSession.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      refreshExpiresAt: new Date(Date.now() + 60_000),
      csrfToken: 'new-csrf-token',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-CSRF-Token', 'csrf-a')
      .set('Cookie', ['refresh_token=token-a', 'XSRF-TOKEN=csrf-a'])
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { accessToken: 'new-access-token' },
    });
  });
});
