// src/common/guards/login-throttler.guard.spec.ts
//
// Unit tests for LoginThrottlerGuard.
//
// Strategy:
//   - Test the exported tracker helpers directly (pure functions).
//   - Construct the guard with mocked ThrottlerModuleOptions, storage,
//     Reflector and SecurityMonitorService to exercise throwThrottlingException.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  LoginThrottlerGuard,
  loginIpTracker,
  loginIpEmailTracker,
} from './login-throttler.guard';

type GuardInternals = {
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

  describe('loginIpTracker', () => {
    it('keys by IP only', () => {
      expect(loginIpTracker({ ip: '203.0.113.7' })).toBe(
        'login:ip:203.0.113.7',
      );
    });

    it('uses "unknown" when the IP is missing', () => {
      expect(loginIpTracker({})).toBe('login:ip:unknown');
    });
  });

  describe('loginIpEmailTracker', () => {
    it('keys by IP + normalised email when an email is present', () => {
      expect(
        loginIpEmailTracker({
          ip: '203.0.113.7',
          body: { email: '  User@Example.COM ' },
        }),
      ).toBe('login:ip:203.0.113.7:email:user@example.com');
    });

    it('falls back to IP only when no email is provided', () => {
      expect(loginIpEmailTracker({ ip: '203.0.113.7', body: {} })).toBe(
        'login:ip:203.0.113.7',
      );
    });

    it('falls back to IP only when email is not a string', () => {
      expect(
        loginIpEmailTracker({ ip: '203.0.113.7', body: { email: 12345 } }),
      ).toBe('login:ip:203.0.113.7');
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
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests',
        error: 'Too Many Requests',
      });
    });
  });
});
