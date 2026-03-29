import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { extractRefreshToken } from './refresh-token-extractor';

function buildRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('extractRefreshToken', () => {
  it('prefers body refresh token when present', () => {
    const req = buildRequest({
      'x-refresh-token': 'header-token',
      authorization: 'Bearer bearer-token',
      cookie: 'refreshToken=cookie-token',
    });

    const result = extractRefreshToken(req, 'body-token');
    expect(result).toBe('body-token');
  });

  it('extracts token from x-refresh-token header', () => {
    const req = buildRequest({ 'x-refresh-token': 'header-token' });
    const result = extractRefreshToken(req);
    expect(result).toBe('header-token');
  });

  it('extracts token from bearer authorization header', () => {
    const req = buildRequest({ authorization: 'Bearer bearer-token' });
    const result = extractRefreshToken(req);
    expect(result).toBe('bearer-token');
  });

  it('extracts token from cookie header', () => {
    const req = buildRequest({ cookie: 'foo=bar; refreshToken=cookie-token' });
    const result = extractRefreshToken(req);
    expect(result).toBe('cookie-token');
  });
});
