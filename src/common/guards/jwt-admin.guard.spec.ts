// src/common/guards/jwt-admin.guard.spec.ts
//
// Unit tests for JwtAdminGuard.
//
// Strategy:
//   - Mock `jsonwebtoken` verify so no real JWT signing is needed.
//   - Build minimal ExecutionContext stubs.
//   - Cover: missing header, expired token, malformed token, valid non-admin,
//     valid admin, missing JWT secret.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAdminGuard, type SupabaseJwtPayload } from './jwt-admin.guard';

// ---------------------------------------------------------------------------
// Mock jsonwebtoken
// ---------------------------------------------------------------------------

vi.mock('jsonwebtoken', () => ({
  verify: vi.fn(),
}));

import * as jwt from 'jsonwebtoken';

// jwt.verify has multiple overloads; cast to a simple vi.Mock for type-safe
// spy access in tests without triggering no-unsafe-* on overloaded signatures.
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- jwt module is fully mocked; .verify type is unresolvable at lint time
const jwtVerifyMock = jwt.verify as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(
  headers: Record<string, string> = {},
  extras: Record<string, unknown> = {},
) {
  const request = {
    headers,
    url: '/admin/queues',
    requestId: 'req-test',
    ...extras,
  };
  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(request),
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as Parameters<JwtAdminGuard['canActivate']>[0];
}

function buildGuard(): JwtAdminGuard {
  return new JwtAdminGuard();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JwtAdminGuard', () => {
  const originalEnv = process.env.SUPABASE_JWT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.SUPABASE_JWT_SECRET = originalEnv;
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const guard = buildGuard();
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header does not start with Bearer', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Basic dXNlcjpwYXNz' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when JWT verify throws TokenExpiredError', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer expired.token' });

    const error = new Error('jwt expired');
    error.name = 'TokenExpiredError';
    jwtVerifyMock.mockImplementation(() => {
      throw error;
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when JWT verify throws JsonWebTokenError', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer bad.token' });

    const error = new Error('invalid signature');
    error.name = 'JsonWebTokenError';
    jwtVerifyMock.mockImplementation(() => {
      throw error;
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when JWT verify throws NotBeforeError', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer future.token' });

    const error = new Error('jwt not active');
    error.name = 'NotBeforeError';
    jwtVerifyMock.mockImplementation(() => {
      throw error;
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when token is valid but role is not admin', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer valid.user.token' });

    jwtVerifyMock.mockReturnValue({
      sub: 'user-123',
      app_metadata: { role: 'user' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when token is valid but app_metadata is absent', () => {
    const guard = buildGuard();
    const context = buildContext({
      authorization: 'Bearer valid.nometadata.token',
    });

    jwtVerifyMock.mockReturnValue({
      sub: 'user-456',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('returns true and attaches supabaseUser when role is admin', () => {
    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer valid.admin.token' });

    const decoded = {
      sub: 'admin-789',
      app_metadata: { role: 'admin' },
    };
    jwtVerifyMock.mockReturnValue(decoded);

    const result = guard.canActivate(context);

    expect(result).toBe(true);

    const request = context
      .switchToHttp()
      .getRequest<{ supabaseUser: SupabaseJwtPayload }>();
    expect(request.supabaseUser).toEqual(decoded);
  });

  it('throws UnauthorizedException when SUPABASE_JWT_SECRET is not set', () => {
    delete process.env.SUPABASE_JWT_SECRET;

    const guard = buildGuard();
    const context = buildContext({ authorization: 'Bearer some.token' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
