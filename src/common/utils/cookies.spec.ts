// src/common/utils/cookies.spec.ts

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  XSRF_TOKEN_COOKIE,
} from './cookies';
import type { Response } from 'express';

function buildMockRes(): Response {
  return {
    clearCookie: vi.fn(),
  } as unknown as Response;
}

describe('clearAuthCookies', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('calls clearCookie for both refresh_token and XSRF-TOKEN', () => {
    const res = buildMockRes();

    clearAuthCookies(res);

    const clearedNames = (
      res.clearCookie as ReturnType<typeof vi.fn>
    ).mock.calls.map((c: unknown[]) => c[0]);

    expect(clearedNames).toContain(REFRESH_TOKEN_COOKIE);
    expect(clearedNames).toContain(XSRF_TOKEN_COOKIE);
  });

  it('clears refresh_token as httpOnly', () => {
    const res = buildMockRes();

    clearAuthCookies(res);

    const refreshTokenCall = (
      res.clearCookie as ReturnType<typeof vi.fn>
    ).mock.calls.find((c: unknown[]) => c[0] === REFRESH_TOKEN_COOKIE);

    expect(refreshTokenCall).toBeDefined();
    const options = refreshTokenCall?.[1] as Record<string, unknown>;
    expect(options.httpOnly).toBe(true);
  });

  it('clears XSRF-TOKEN as non-httpOnly so JavaScript can read it', () => {
    const res = buildMockRes();

    clearAuthCookies(res);

    const xsrfCall = (
      res.clearCookie as ReturnType<typeof vi.fn>
    ).mock.calls.find((c: unknown[]) => c[0] === XSRF_TOKEN_COOKIE);

    expect(xsrfCall).toBeDefined();
    const options = xsrfCall?.[1] as Record<string, unknown>;
    expect(options.httpOnly).toBe(false);
  });

  it('uses restricted path for refresh cookie and root path for XSRF cookie', () => {
    const res = buildMockRes();

    clearAuthCookies(res);

    const calls = (res.clearCookie as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      Record<string, unknown>,
    ][];

    const refreshCall = calls.find(([name]) => name === REFRESH_TOKEN_COOKIE);
    const xsrfCall = calls.find(([name]) => name === XSRF_TOKEN_COOKIE);
    expect(refreshCall?.[1].path).toBe('/api/v1/auth');
    expect(xsrfCall?.[1].path).toBe('/');
  });

  it('does not set domain in development', () => {
    process.env.NODE_ENV = 'development';
    const res = buildMockRes();

    clearAuthCookies(res);

    const calls = (res.clearCookie as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      Record<string, unknown>,
    ][];

    for (const [, options] of calls) {
      expect(options.domain).toBeUndefined();
    }
  });

  it('sets domain to ".tribehub.io" in production', () => {
    process.env.NODE_ENV = 'production';
    const res = buildMockRes();

    clearAuthCookies(res);

    const calls = (res.clearCookie as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      Record<string, unknown>,
    ][];

    for (const [, options] of calls) {
      expect(options.domain).toBe('.tribehub.io');
    }
  });
});
