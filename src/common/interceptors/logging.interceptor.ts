// src/common/interceptors/logging.interceptor.ts
//
// HTTP logging interceptor. For every request it logs:
//   - HTTP method
//   - URL path
//   - HTTP status code
//   - Duration in milliseconds
//   - requestId (set upstream by RequestIdMiddleware)
//
// Usage: register globally in main.ts via app.useGlobalInterceptors() or
// provide it at the module level with APP_INTERCEPTOR.

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    const { method, url } = req;
    const requestId = req.requestId ?? 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = res.statusCode;
          const duration = Date.now() - startTime;
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms requestId=${requestId}`,
          );
        },
        error: (err: unknown) => {
          const statusCode =
            err instanceof Object && 'status' in err
              ? (err as { status: number }).status
              : 500;
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${statusCode} ${duration}ms requestId=${requestId}`,
          );
        },
      }),
    );
  }
}
