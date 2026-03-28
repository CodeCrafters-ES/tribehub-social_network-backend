import type { Request } from 'express';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.split('=');
    const key = rawKey?.trim();
    const value = rawValue.join('=').trim();

    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }

    return acc;
  }, {});
}

function asStringHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}

function fromAuthorizationHeader(
  value: string | undefined,
): string | undefined {
  if (!value || !value.startsWith('Bearer ')) {
    return undefined;
  }

  return value.slice('Bearer '.length).trim();
}

export function extractRefreshToken(
  request: Request,
  bodyRefreshToken?: string,
): string | undefined {
  if (bodyRefreshToken?.trim()) {
    return bodyRefreshToken.trim();
  }

  const xRefreshToken = asStringHeader(request.headers['x-refresh-token']);
  if (xRefreshToken?.trim()) {
    return xRefreshToken.trim();
  }

  const authHeader = asStringHeader(request.headers.authorization);
  const bearerToken = fromAuthorizationHeader(authHeader);
  if (bearerToken) {
    return bearerToken;
  }

  const cookies = parseCookieHeader(asStringHeader(request.headers.cookie));
  return cookies[REFRESH_TOKEN_COOKIE_NAME];
}
