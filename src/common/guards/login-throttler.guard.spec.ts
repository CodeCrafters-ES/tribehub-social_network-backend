// src/common/guards/login-throttler.guard.spec.ts
//
// Unit tests for LoginThrottlerGuard.
//
// Strategy:
//   - Test the exported tracker helpers directly (pure functions).
//   - Construct the guard with mocked ThrottlerModuleOptions, storage,
//     Reflector and SecurityMonitorService to exercise throwThrottlingException
//     and the fail-open handleRequest wrapper.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerRequest } from '@nestjs/throttler';
import {
  LoginThrottlerGuard,
  loginIpTracker,
  loginIpEmailTracker,
} from './login-throttler.guard';

type GuardInternals = {
  throwThrottlingException(
    context: ExecutionContext,
    detail: { timeToBlockExpire: number },
  ): Promise<void>;
  handleRequest(requestProps: ThrottlerRequest): Promise<boolean>;
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

function httpContext(req: Record<string, unknown>): {
  context: ExecutionContext;
  header: ReturnType<typeof vi.fn>;
} {
  const header = vi.fn();
  const res = { header };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, header };
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
    it('keys by IP + a hashed email, normalising case and whitespace', () => {
      const key = loginIpEmailTracker({
        ip: '203.0.113.7',
        body: { email: '  User@Example.COM ' },
      });

      // The raw email must never appear in the key (it is hashed).
      expect(key).not.toContain('user@example.com');
      expect(key).toMatch(/^login:ip:203\.0\.113\.7:email:[0-9a-f]{16}$/);

      // Normalisation: a differently-cased/spaced email yields the same key.
      expect(
        loginIpEmailTracker({
          ip: '203.0.113.7',
          body: { email: 'user@example.com' },
        }),
      ).toBe(key);
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
    it('sets Retry-After, records the failed login and throws the contract 429', async () => {
      const { guard, recordFailedLogin } = buildGuard();
      const { context, header } = httpContext({
        ip: '203.0.113.7',
        method: 'POST',
        originalUrl: '/api/v1/auth/login',
      });

      let thrown: unknown;
      try {
        await (guard as unknown as GuardInternals).throwThrottlingException(
          context,
          { timeToBlockExpire: 42 },
        );
      } catch (err) {
        thrown = err;
      }

      expect(header).toHaveBeenCalledWith('Retry-After', '42');
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

  describe('handleRequest (fail-open)', () => {
    it('re-throws the 429 HttpException raised when the limit is exceeded', async () => {
      const { guard } = buildGuard();
      const httpError = new HttpException('Too many requests', 429);
      vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
          handleRequest: GuardInternals['handleRequest'];
        },
        'handleRequest',
      ).mockRejectedValue(httpError);

      await expect(
        (guard as unknown as GuardInternals).handleRequest(
          {} as ThrottlerRequest,
        ),
      ).rejects.toBe(httpError);
    });

    it('fails open (allows the request) when the store throws a non-HTTP error', async () => {
      const { guard } = buildGuard();
      vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
          handleRequest: GuardInternals['handleRequest'];
        },
        'handleRequest',
      ).mockRejectedValue(new Error('Redis unreachable'));

      await expect(
        (guard as unknown as GuardInternals).handleRequest(
          {} as ThrottlerRequest,
        ),
      ).resolves.toBe(true);
    });
  });
});
