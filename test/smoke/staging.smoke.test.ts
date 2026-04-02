// test/smoke/staging.smoke.test.ts
//
// Smoke test suite for the TribeHub staging environment.
//
// Purpose: detect critical failures immediately after a staging deploy before
// any manual QA or promotion to production.
//
// Runner: Vitest (see vitest.smoke.config.ts)
// HTTP client: native Node 20 fetch (no extra dependencies)
//
// Required env vars:
//   SMOKE_BASE_URL       — default: https://staging.tribehub.app
//   SMOKE_USER_EMAIL     — smoke test user email (from GitHub secrets)
//   SMOKE_USER_PASSWORD  — smoke test user password (from GitHub secrets)
//
// Run:
//   pnpm test:smoke

import { describe, it, expect, beforeAll } from 'vitest';
import { loadSmokeConfig, type SmokeConfig } from './smoke.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Thin fetch wrapper that:
 *  - enforces the per-request timeout via AbortSignal
 *  - logs the request/response line for CI readability
 *  - extracts X-Request-Id from the response for backend log correlation
 */
async function smokeRequest(
  config: SmokeConfig,
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {},
): Promise<{ status: number; body: unknown; requestId: string | null }> {
  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[smoke] ${method} ${url} — NETWORK ERROR: ${message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const requestId = response.headers.get('x-request-id');

  let body: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  const requestIdLabel = requestId ? ` [X-Request-Id: ${requestId}]` : '';
  console.log(`[smoke] ${method} ${url} → ${response.status}${requestIdLabel}`);

  return { status: response.status, body, requestId };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TribeHub Staging Smoke Tests', () => {
  let config: SmokeConfig;
  let sessionToken: string | null = null;

  // Load config once; fail the entire suite early if env vars are missing.
  beforeAll(() => {
    config = loadSmokeConfig();
    console.log(`[smoke] Target: ${config.baseUrl}`);
  });

  // ── 1. Health check ──────────────────────────────────────────────────────
  it('GET /api/v1/health → 200 with status ok', async () => {
    const { status, body, requestId } = await smokeRequest(
      config,
      'GET',
      '/api/v1/health',
    );

    if (status !== 200) {
      const requestIdLabel = requestId ? ` [X-Request-Id: ${requestId}]` : '';
      console.error(
        `[smoke] FAIL GET /api/v1/health — expected 200, got ${status}${requestIdLabel}`,
        body,
      );
    }

    expect(
      status,
      `GET /api/v1/health returned ${status} — the health endpoint is down or unreachable`,
    ).toBe(200);

    // The health endpoint must return { status: 'ok' } per the OpenAPI contract.
    expect(body).toMatchObject({ status: 'ok' });
  });

  // ── 2. Auth login ────────────────────────────────────────────────────────
  it('POST /api/v1/auth/login → 200/201 and returns a session token', async () => {
    const { status, body, requestId } = await smokeRequest(
      config,
      'POST',
      '/api/v1/auth/login',
      {
        body: {
          email: config.userEmail,
          password: config.userPassword,
        },
      },
    );

    if (status !== 200 && status !== 201) {
      const requestIdLabel = requestId ? ` [X-Request-Id: ${requestId}]` : '';
      console.error(
        `[smoke] FAIL POST /api/v1/auth/login — expected 200 or 201, got ${status}${requestIdLabel}`,
        body,
      );
    }

    expect(
      status,
      `POST /api/v1/auth/login returned ${status} — login failed; ` +
        'check SMOKE_USER_EMAIL/SMOKE_USER_PASSWORD secrets and Supabase Auth',
    ).toSatisfy((s: number) => s === 200 || s === 201);

    // The auth service returns { success: true, data: { access_token: '...' } }
    const responseBody = body as Record<string, unknown>;
    expect(responseBody).toHaveProperty('success', true);

    const data = responseBody['data'] as Record<string, unknown> | undefined;
    expect(
      data,
      'Login response must contain a "data" object with a session token',
    ).toBeDefined();

    const token =
      (data?.['access_token'] as string | undefined) ??
      ((data?.['session'] as Record<string, unknown> | undefined)?.[
        'access_token'
      ] as string | undefined);

    expect(
      token,
      'Login response must include an access_token for subsequent authenticated requests',
    ).toBeTruthy();

    // Store the token for the next test.
    sessionToken = token ?? null;
  });

  // ── 3. Authenticated read — verifies DB + auth chain end-to-end ──────────
  it('GET /api/v1/users/me → 200 with authenticated session (DB + auth chain)', async () => {
    // This test is optional/recommended: it verifies the full auth + DB
    // chain works. Skip gracefully if login failed (sessionToken is null).
    if (!sessionToken) {
      console.warn(
        '[smoke] Skipping authenticated endpoint test — no session token ' +
          'available (login test likely failed).',
      );
      return;
    }

    const { status, body, requestId } = await smokeRequest(
      config,
      'GET',
      '/api/v1/users/me',
      { token: sessionToken },
    );

    if (status !== 200) {
      const requestIdLabel = requestId ? ` [X-Request-Id: ${requestId}]` : '';
      console.error(
        `[smoke] FAIL GET /api/v1/users/me — expected 200, got ${status}${requestIdLabel}`,
        body,
      );
    }

    expect(
      status,
      `GET /api/v1/users/me returned ${status} — DB or auth middleware may be broken`,
    ).toBe(200);
  });
});
