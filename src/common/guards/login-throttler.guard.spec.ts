// src/common/guards/login-throttler.guard.spec.ts
//
// Unit tests for LoginThrottlerGuard.
//
// Strategy:
//   - Construct the guard with mocked ThrottlerModuleOptions, storage,
//     Reflector and SecurityMonitorService (no real Redis).
//   - Exercise the protected getTracker / throwThrottlingException directly via
//     a typed cast, building minimal request / ExecutionContext stubs.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { LoginThrottlerGuard } from './login-throttler.guard';

type GuardInternals = {
  getTracker(req: Record<string, unknown>): Promise<string>;
  throwThrottlingException(context: ExecutionContext): Promise<void>;
};

function buildGuard(): {
  guard: LoginThrottlerGuard;
  recordFailedLogin: ReturnType<typeof vi.fn>;
} {
  const recordFailedLogin = vi.fn();
  const securityMonitor = { recordFailedLogin };
  const guard = new LoginThrottlerGuard(
    [{ ttl: 60000, limit: 20 }] as never, // options
    { increment: vi.fn() } as never, // storage
    { getAllAndOverride: vi.fn() } as never, // reflector
    securityMonitor as never,
  );
  return { guard, recordFailedLogin };
}

function httpContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('LoginThrottlerGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTracker', () => {
    it('keys by IP + normalised email when an email is present', async () => {
      const { guard } = buildGuard();
      const tracker = await (guard as unknown as GuardInternals).getTracker({
        ip: '203.0.113.7',
        body: { email: '  User@Example.COM ' },
      });
      expect(tracker).toBe('login:ip:203.0.113.7:email:user@example.com');
    });

    it('falls back to IP only when no email is provided', async () => {
      const { guard } = buildGuard();
      const tracker = await (guard as unknown as GuardInternals).getTracker({
        ip: '203.0.113.7',
        body: {},
      });
      expect(tracker).toBe('login:ip:203.0.113.7');
    });

    it('falls back to IP only when email is not a string', async () => {
      const { guard } = buildGuard();
      const tracker = await (guard as unknown as GuardInternals).getTracker({
        ip: '203.0.113.7',
        body: { email: 12345 },
      });
      expect(tracker).toBe('login:ip:203.0.113.7');
    });

    it('uses "unknown" when the IP is missing', async () => {
      const { guard } = buildGuard();
      const tracker = await (guard as unknown as GuardInternals).getTracker({
        body: { email: 'a@b.com' },
      });
      expect(tracker).toBe('login:ip:unknown:email:a@b.com');
    });
  });

  describe('throwThrottlingException', () => {
    it('records the failed login and throws a 429 with the contract body', async () => {
      const { guard, recordFailedLogin } = buildGuard();
      const context = httpContext({
        ip: '203.0.113.7',
        method: 'POST',
        originalUrl: '/api/v1/auth/login',
      });

      let thrown: unknown;
      try {
        await (guard as unknown as GuardInternals).throwThrottlingException(
          context,
        );
      } catch (err) {
        thrown = err;
      }

      expect(recordFailedLogin).toHaveBeenCalledTimes(1);
      expect(thrown).toBeInstanceOf(HttpException);
      const exception = thrown as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toEqual({
        message: 'Too many requests',
        error: 'Too Many Requests',
      });
    });
  });
});
