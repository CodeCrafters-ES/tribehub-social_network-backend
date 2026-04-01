// src/observability/metrics/metrics.service.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  describe('getMetrics()', () => {
    it('returns a non-empty string in Prometheus text format', async () => {
      const output = await service.getMetrics();

      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('output contains the default process_cpu_seconds_total metric', async () => {
      const output = await service.getMetrics();

      // prom-client collectDefaultMetrics always emits at least one process_* metric
      expect(output).toMatch(/process_/);
    });

    it('output contains http_requests_total metric definition', async () => {
      const output = await service.getMetrics();

      expect(output).toContain('http_requests_total');
    });

    it('output contains http_request_duration_seconds metric definition', async () => {
      const output = await service.getMetrics();

      expect(output).toContain('http_request_duration_seconds');
    });
  });

  describe('contentType()', () => {
    it('returns the Prometheus text content type string', () => {
      const ct = service.contentType();

      // prom-client sets this to "text/plain; version=0.0.4; charset=utf-8"
      expect(ct).toContain('text/plain');
      expect(ct).toContain('version=0.0.4');
    });
  });

  describe('normaliseRoute()', () => {
    it('replaces a UUID segment with :id', () => {
      const raw = '/api/v1/users/550e8400-e29b-41d4-a716-446655440000';
      expect(service.normaliseRoute(raw)).toBe('/api/v1/users/:id');
    });

    it('replaces a numeric segment with :id', () => {
      const raw = '/api/v1/posts/42/comments';
      expect(service.normaliseRoute(raw)).toBe('/api/v1/posts/:id/comments');
    });

    it('leaves routes without dynamic segments unchanged', () => {
      const raw = '/api/v1/auth/login';
      expect(service.normaliseRoute(raw)).toBe('/api/v1/auth/login');
    });

    it('replaces multiple UUID segments in a single route', () => {
      const raw =
        '/api/v1/groups/550e8400-e29b-41d4-a716-446655440000/members/661f9511-f3ac-52e5-b827-557766551111';
      expect(service.normaliseRoute(raw)).toBe(
        '/api/v1/groups/:id/members/:id',
      );
    });

    it('handles a route that is just /', () => {
      expect(service.normaliseRoute('/')).toBe('/');
    });
  });

  describe('httpRequestsTotal counter', () => {
    it('increments and reflects in the metrics output', async () => {
      service.httpRequestsTotal.inc({
        method: 'GET',
        route: '/api/v1/health',
        status_code: '200',
      });

      const output = await service.getMetrics();
      expect(output).toContain('http_requests_total');
      expect(output).toContain('method="GET"');
      expect(output).toContain('route="/api/v1/health"');
      expect(output).toContain('status_code="200"');
    });
  });

  describe('httpRequestDurationSeconds histogram', () => {
    it('records an observation and reflects in the metrics output', async () => {
      service.httpRequestDurationSeconds.observe(
        { method: 'POST', route: '/api/v1/auth/login' },
        0.042,
      );

      const output = await service.getMetrics();
      expect(output).toContain('http_request_duration_seconds_bucket');
      expect(output).toContain('method="POST"');
    });
  });
});
