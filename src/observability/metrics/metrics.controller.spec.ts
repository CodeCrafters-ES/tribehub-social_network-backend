// src/observability/metrics/metrics.controller.spec.ts
//
// Unit tests for MetricsController.
//
// The controller:
//   1. Returns 200 with Prometheus text when the secret path segment matches
//      the METRICS_PATH_SECRET env var.
//   2. Returns 404 when the secret does not match.

import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Request, Response } from 'express';

const FAKE_METRICS_OUTPUT =
  '# HELP http_requests_total Total number of HTTP requests\nhttp_requests_total 0\n';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockServiceShape {
  getMetrics: Mock;
  contentType: Mock;
  normaliseRoute: Mock;
}

function buildMockService(): MockServiceShape & MetricsService {
  return {
    getMetrics: vi.fn().mockResolvedValue(FAKE_METRICS_OUTPUT),
    contentType: vi
      .fn()
      .mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
    normaliseRoute: vi.fn((r: string) => r),
  } as unknown as MockServiceShape & MetricsService;
}

interface MockResponse {
  _status: number;
  _body: string;
  _headers: Record<string, string>;
  _ended: boolean;
}

function buildMockRes(): Response & MockResponse {
  const mock: MockResponse = {
    _status: 0,
    _body: '',
    _headers: {},
    _ended: false,
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
    send(body: string) {
      mock._body = body;
      return res;
    },
    end() {
      mock._ended = true;
      return res;
    },
  }) as unknown as Response & MockResponse;

  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MetricsController', () => {
  const originalSecret = process.env.METRICS_PATH_SECRET;

  beforeEach(() => {
    process.env.METRICS_PATH_SECRET = 'mysecret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.METRICS_PATH_SECRET;
    } else {
      process.env.METRICS_PATH_SECRET = originalSecret;
    }
  });

  describe('GET _internal/:secret-metrics — valid secret', () => {
    it('responds 200 with Prometheus format body', async () => {
      const mockService = buildMockService();
      const controller = new MetricsController(mockService);

      const req = { params: { secret: 'mysecret' } } as unknown as Request;
      const res = buildMockRes();

      await controller.getMetrics(req, res);

      expect(res._status).toBe(200);
      expect(res._body).toBe(FAKE_METRICS_OUTPUT);
    });

    it('sets Content-Type to text/plain; version=0.0.4', async () => {
      const mockService = buildMockService();
      const controller = new MetricsController(mockService);

      const req = { params: { secret: 'mysecret' } } as unknown as Request;
      const res = buildMockRes();

      await controller.getMetrics(req, res);

      expect(res._headers['Content-Type']).toContain('text/plain');
      expect(res._headers['Content-Type']).toContain('version=0.0.4');
    });

    it('calls metricsService.getMetrics()', async () => {
      const mockService = buildMockService();
      const controller = new MetricsController(mockService);

      const req = { params: { secret: 'mysecret' } } as unknown as Request;
      const res = buildMockRes();

      await controller.getMetrics(req, res);

      expect(mockService.getMetrics).toHaveBeenCalledOnce();
    });
  });

  describe('GET _internal/:secret-metrics — invalid or missing secret', () => {
    it('responds 404 when the secret does not match', async () => {
      const mockService = buildMockService();
      const controller = new MetricsController(mockService);

      const req = {
        params: { secret: 'wrong-secret' },
      } as unknown as Request;
      const res = buildMockRes();

      await controller.getMetrics(req, res);

      expect(res._ended).toBe(true);
      expect(mockService.getMetrics).not.toHaveBeenCalled();
    });

    it('responds 404 when METRICS_PATH_SECRET env var is not set', async () => {
      delete process.env.METRICS_PATH_SECRET;

      const mockService = buildMockService();
      const controller = new MetricsController(mockService);

      const req = {
        params: { secret: 'anything' },
      } as unknown as Request;
      const res = buildMockRes();

      await controller.getMetrics(req, res);

      expect(res._ended).toBe(true);
      expect(mockService.getMetrics).not.toHaveBeenCalled();
    });
  });
});
