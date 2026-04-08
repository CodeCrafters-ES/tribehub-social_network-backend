// src/observability/metrics/metrics.service.ts
//
// Initialises the prom-client registry with:
//   - Default Node.js metrics (event loop lag, GC, memory, file descriptors…)
//   - An HTTP request counter labelled by method, normalised route and status
//   - An HTTP request duration histogram labelled by method and normalised route
//
// The service is a singleton (module-scoped). It is consumed by:
//   - MetricsController  → serialises the registry to Prometheus text format
//   - HttpMetricsInterceptor → increments counters/histograms per request

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  readonly registry: Registry;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    const environment = process.env.NODE_ENV ?? 'development';

    // Default Node.js process metrics (CPU, memory, GC, etc.)
    // Note: prom-client v15 removed `collectInterval` from
    // DefaultMetricsCollectorConfiguration. The collection interval is now
    // controlled internally by the library and cannot be overridden here.
    collectDefaultMetrics({
      register: this.registry,
      labels: { environment },
    });

    // --- HTTP request counter ---
    // Labels: method, route (normalised), status_code
    // High cardinality is avoided by normalising route params to their
    // placeholder form (e.g. /users/:id instead of /users/abc-123).
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // --- HTTP request duration histogram ---
    // Labels: method, route (normalised)
    // Buckets chosen to cover typical web latency ranges in seconds.
    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {}

  onModuleDestroy(): void {
    this.registry.clear();
  }

  // Routes that this application exposes. Any normalised route that does not
  // start with one of these prefixes is collapsed to 'other' so that bots,
  // scanners and unknown paths never create new time-series in the registry.
  private static readonly KNOWN_ROUTE_PREFIXES = [
    '/api/v1/auth',
    '/api/v1/health',
    '/api/v1/feed',
    '/api/v1/search',
    '/api/v1/_internal',
    '/api/v1/',
    '/admin/queues',
  ];

  /**
   * Normalise an Express/NestJS route string to eliminate dynamic segments
   * so that UUIDs and other IDs never become label values (high cardinality).
   * Routes not matching a known prefix are collapsed to 'other'.
   *
   * Examples:
   *   /api/v1/users/abc-123-def          →  /api/v1/users/:id
   *   /api/v1/posts/42/comments          →  /api/v1/posts/:id/comments
   *   /wp-admin/setup.php                →  other
   *   /.env                              →  other
   *   undefined / unmatched (undefined)  →  other
   */
  normaliseRoute(rawRoute: string): string {
    if (!rawRoute || rawRoute === 'unknown') {
      return 'other';
    }

    const normalised = rawRoute
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id',
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');

    const isKnown = MetricsService.KNOWN_ROUTE_PREFIXES.some((prefix) =>
      normalised.startsWith(prefix),
    );

    return isKnown ? normalised : 'other';
  }

  /** Serialise the registry to Prometheus text exposition format. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type expected by Prometheus scrapers. */
  contentType(): string {
    return this.registry.contentType;
  }
}
