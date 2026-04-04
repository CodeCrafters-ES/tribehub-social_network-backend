// src/observability/http-metrics.interceptor.ts
//
// Global NestJS interceptor that instruments every HTTP request with:
//   - http_requests_total counter   (method, normalised route, status_code)
//   - http_request_duration_seconds histogram (method, normalised route)
//
// The route is normalised via MetricsService.normaliseRoute() to prevent UUID
// and numeric ID path segments from creating high-cardinality label values.
//
// The interceptor skips requests that have no HTTP context (e.g. WebSocket or
// RPC) so it is safe to register globally.

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics/metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const method = req.method;
    const startTime = process.hrtime.bigint();

    // Prefer the matched route pattern (e.g. /users/:id) when available so
    // that dynamic segments are already normalised by Express/NestJS routing.
    // Fall back to 'unknown' when the matched route is unavailable to avoid
    // high-cardinality label values from raw req.path (e.g. UUIDs in URLs
    // that have not yet been matched by a route handler).
    // The cast is needed because Express types `route` as `any`.
    const routeRecord = req.route as { path?: string } | undefined;
    const rawRoute: string = routeRecord?.path ?? 'unknown';
    const route = this.metricsService.normaliseRoute(rawRoute);

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = String(res.statusCode);
          const durationSeconds = this.elapsedSeconds(startTime);

          this.metricsService.httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });

          this.metricsService.httpRequestDurationSeconds.observe(
            { method, route },
            durationSeconds,
          );
        },
        error: (err: unknown) => {
          const statusCode = String(
            err instanceof Object && 'status' in err
              ? (err as { status: number }).status
              : 500,
          );
          const durationSeconds = this.elapsedSeconds(startTime);

          this.metricsService.httpRequestsTotal.inc({
            method,
            route,
            status_code: statusCode,
          });

          this.metricsService.httpRequestDurationSeconds.observe(
            { method, route },
            durationSeconds,
          );
        },
      }),
    );
  }

  private elapsedSeconds(startNs: bigint): number {
    const elapsedNs = process.hrtime.bigint() - startNs;
    return Number(elapsedNs) / 1e9;
  }
}
