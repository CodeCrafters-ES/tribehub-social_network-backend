// src/common/utils/cookies.ts
//
// Centralised helpers for reading and clearing auth cookies.
// All cookies that carry auth state share the same Domain and Path so that
// clearing them from the server is predictable regardless of the exact path
// from which the request was issued.

import type { Response } from 'express';

/** Name of the httpOnly refresh-token cookie. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Name of the CSRF protection cookie. */
export const XSRF_TOKEN_COOKIE = 'XSRF-TOKEN';

/** Shared cookie path. */
const COOKIE_PATH = '/';

/**
 * Clears both the `refresh_token` and `XSRF-TOKEN` cookies from the response.
 *
 * The options passed to `res.clearCookie()` MUST match the options used when
 * the cookies were set; otherwise the browser will not honour the deletion.
 *
 * NODE_ENV is evaluated at call time so that the correct domain and secure
 * flag are applied regardless of when the module was first loaded.
 */
export function clearAuthCookies(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cookieDomain = isProduction ? '.tribehub.io' : undefined;

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'strict',
    domain: cookieDomain,
    path: COOKIE_PATH,
  });

  res.clearCookie(XSRF_TOKEN_COOKIE, {
    httpOnly: false, // XSRF-TOKEN must be readable by JavaScript
    secure: !isDevelopment,
    sameSite: 'strict',
    domain: cookieDomain,
    path: COOKIE_PATH,
  });
}
