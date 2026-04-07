// src/observability/http-metrics.interceptor.spec.ts

import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockMetricsService {
  httpRequestsTotal: { inc: Mock };
  httpRequestDurationSeconds: { observe: Mock };
  normaliseRoute: Mock;
}

function buildMockMetricsService(): MockMetricsService & MetricsService {
  return {
    httpRequestsTotal: { inc: vi.fn() },
    httpRequestDurationSeconds: { observe: vi.fn() },
    normaliseRoute: vi.fn((r: string) => r),
  } as unknown as MockMetricsService & MetricsService;
}

function buildMockHttpContext(overrides: {
  method?: string;
  path?: string;
  routePath?: string | null;
  statusCode?: number;
}): ExecutionContext {
  const req = {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/api/v1/health',
    route:
      overrides.routePath != null ? { path: overrides.routePath } : undefined,
  };

  const res = {
    statusCode: overrides.statusCode ?? 200,
  };

  return {
    getType: vi.fn().mockReturnValue('http'),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(req),
      getResponse: vi.fn().mockReturnValue(res),
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HttpMetricsInterceptor', () => {
  let mockService: MockMetricsService & MetricsService;
  let interceptor: HttpMetricsInterceptor;

  beforeEach(() => {
    mockService = buildMockMetricsService();
    interceptor = new HttpMetricsInterceptor(mockService);
  });

  it('increments http_requests_total on successful request', async () => {
    const context = buildMockHttpContext({
      method: 'GET',
      path: '/api/v1/health',
      routePath: '/api/v1/health',
      statusCode: 200,
    });

    const next: CallHandler = { handle: () => of({ status: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/health',
      status_code: '200',
    });
  });

  it('records duration observation on successful request', async () => {
    const context = buildMockHttpContext({
      method: 'POST',
      path: '/api/v1/auth/login',
      routePath: '/api/v1/auth/login',
      statusCode: 200,
    });

    const next: CallHandler = { handle: () => of(null) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        complete: () => resolve(),
      });
    });

    expect(mockService.httpRequestDurationSeconds.observe).toHaveBeenCalledWith(
      { method: 'POST', route: '/api/v1/auth/login' },
      expect.any(Number),
    );
  });

  it('increments counter with error status_code on failed request', async () => {
    const context = buildMockHttpContext({
      method: 'GET',
      path: '/api/v1/users',
      routePath: '/api/v1/users',
    });

    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    const next: CallHandler = { handle: () => throwError(() => error) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        error: () => resolve(),
      });
    });

    expect(mockService.httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/users',
      status_code: '401',
    });
  });

  it('uses 500 as default status_code for errors without a status property', async () => {
    const context = buildMockHttpContext({ method: 'GET', path: '/api/v1/x' });
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, next)
        .subscribe({ error: () => resolve() });
    });

    expect(mockService.httpRequestsTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '500' }),
    );
  });

  it('prefers route pattern over raw path to reduce cardinality', async () => {
    const context = buildMockHttpContext({
      method: 'GET',
      path: '/api/v1/users/550e8400-e29b-41d4-a716-446655440000',
      routePath: '/api/v1/users/:id',
      statusCode: 200,
    });

    const next: CallHandler = { handle: () => of(null) };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, next)
        .subscribe({ complete: () => resolve() });
    });

    // normaliseRoute is called with the matched route pattern, not the raw URL
    expect(mockService.normaliseRoute).toHaveBeenCalledWith(
      '/api/v1/users/:id',
    );
  });

  it('passes raw req.path to normaliseRoute when no route is matched', async () => {
    const context = buildMockHttpContext({
      method: 'GET',
      path: '/wp-admin/setup.php',
      // routePath intentionally omitted — simulates unmatched request (404/bot)
    });

    const next: CallHandler = { handle: () => of(null) };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, next)
        .subscribe({ complete: () => resolve() });
    });

    expect(mockService.normaliseRoute).toHaveBeenCalledWith(
      '/wp-admin/setup.php',
    );
  });

  it('collapses unknown route to other via normaliseRoute', async () => {
    // normaliseRoute returns 'other' for unknown prefixes; verify the label used
    mockService.normaliseRoute.mockReturnValue('other');

    const context = buildMockHttpContext({
      method: 'GET',
      path: '/.env',
    });

    const next: CallHandler = { handle: () => of(null) };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, next)
        .subscribe({ complete: () => resolve() });
    });

    expect(mockService.httpRequestsTotal.inc).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'other' }),
    );
  });

  it('passes through without instrumenting non-HTTP contexts (e.g. RPC)', async () => {
    const context = {
      getType: vi.fn().mockReturnValue('rpc'),
    } as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of('rpc-response') };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, next)
        .subscribe({ complete: () => resolve() });
    });

    expect(mockService.httpRequestsTotal.inc).not.toHaveBeenCalled();
    expect(
      mockService.httpRequestDurationSeconds.observe,
    ).not.toHaveBeenCalled();
  });
});
