// src/common/middleware/request-id.middleware.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  RequestIdMiddleware,
  REQUEST_ID_HEADER,
} from './request-id.middleware';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockRequest(xRequestIdValue?: string): Request {
  const headers: Record<string, string> = {};
  if (xRequestIdValue !== undefined) {
    headers[REQUEST_ID_HEADER] = xRequestIdValue;
  }
  return { headers } as unknown as Request;
}

function buildMockResponse(): {
  res: Response;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
      return res as unknown as Response;
    }),
  } as unknown as Response;
  return { res, headers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('generates a requestId when X-Request-Id is not present in the request', () => {
    const req = buildMockRequest();
    const { res } = buildMockResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses the requestId when the client sends X-Request-Id', () => {
    const clientRequestId = 'client-provided-request-id-abc123';
    const req = buildMockRequest(clientRequestId);
    const { res } = buildMockResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBe(clientRequestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets X-Request-Id on the response', () => {
    const req = buildMockRequest();
    const { res, headers } = buildMockResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(headers[REQUEST_ID_HEADER]).toBeDefined();
    expect(headers[REQUEST_ID_HEADER]).toBe(req.requestId);
  });

  it('echoes back the client X-Request-Id in the response header', () => {
    const clientRequestId = 'echo-this-id-xyz';
    const req = buildMockRequest(clientRequestId);
    const { res, headers } = buildMockResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(headers[REQUEST_ID_HEADER]).toBe(clientRequestId);
  });
});
