// src/observability/metrics/metrics-auth.middleware.spec.ts

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetricsAuthMiddleware } from './metrics-auth.middleware';
import { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockResponse {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
}

function buildMocks(): {
  req: Request;
  res: Response & MockResponse;
  next: ReturnType<typeof vi.fn>;
} {
  const req = {
    headers: {} as Record<string, string>,
  } as unknown as Request;

  const mock: MockResponse = {
    _status: 0,
    _body: undefined,
    _headers: {},
  };

  const res = Object.assign(mock, {
    status(code: number) {
      mock._status = code;
      return res;
    },
    setHeader(name: string, value: string) {
      mock._headers[name] = value;
      return res;
    },
    json(body: unknown) {
      mock._body = body;
      return res;
    },
  }) as unknown as Response & MockResponse;

  const next = vi.fn();

  return { req, res, next };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MetricsAuthMiddleware', () => {
  const originalUser = process.env.METRICS_USER;
  const originalPass = process.env.METRICS_PASS;

  beforeEach(() => {
    process.env.METRICS_USER = 'scraper';
    process.env.METRICS_PASS = 's3cr3t';
  });

  afterEach(() => {
    if (originalUser === undefined) {
      delete process.env.METRICS_USER;
    } else {
      process.env.METRICS_USER = originalUser;
    }
    if (originalPass === undefined) {
      delete process.env.METRICS_PASS;
    } else {
      process.env.METRICS_PASS = originalPass;
    }
  });

  it('calls next() when credentials are valid', () => {
    const { req, res, next } = buildMocks();
    const credentials = Buffer.from('scraper:s3cr3t').toString('base64');
    (req as unknown as { headers: Record<string, string> }).headers[
      'authorization'
    ] = `Basic ${credentials}`;

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('responds 401 with WWW-Authenticate header when no Authorization header is present', () => {
    const { req, res, next } = buildMocks();

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(401);
    expect(res._headers['WWW-Authenticate']).toBe('Basic realm="Metrics"');
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when credentials are wrong', () => {
    const { req, res, next } = buildMocks();
    const wrong = Buffer.from('scraper:wrongpass').toString('base64');
    (req as unknown as { headers: Record<string, string> }).headers[
      'authorization'
    ] = `Basic ${wrong}`;

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when Authorization header is not Basic scheme', () => {
    const { req, res, next } = buildMocks();
    (req as unknown as { headers: Record<string, string> }).headers[
      'authorization'
    ] = 'Bearer some-token';

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 503 when METRICS_USER env var is not set', () => {
    delete process.env.METRICS_USER;
    const { req, res, next } = buildMocks();

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 503 when METRICS_PASS env var is not set', () => {
    delete process.env.METRICS_PASS;
    const { req, res, next } = buildMocks();

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when Authorization header value has no colon separator', () => {
    const { req, res, next } = buildMocks();
    const malformed = Buffer.from('nocolon').toString('base64');
    (req as unknown as { headers: Record<string, string> }).headers[
      'authorization'
    ] = `Basic ${malformed}`;

    const middleware = new MetricsAuthMiddleware();
    middleware.use(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
