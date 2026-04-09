import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    process.stdout.write(`[FILTER-DEBUG] type=${typeof exception} isError=${exception instanceof Error} constructor=${(exception as any)?.constructor?.name} message=${(exception as any)?.message}\n`);

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;

    if (!isHttpException || status >= 500) {
      const requestId = request.requestId ?? 'unknown';
      Sentry.withScope((scope) => {
        scope.setContext('request', { requestId });
        Sentry.captureException(exception);
      });
      this.logger.error(`[DEBUG] type=${typeof exception} | isError=${exception instanceof Error} | constructor=${(exception as any)?.constructor?.name} | requestId=${requestId}`);
      this.logger.error(`[DEBUG] message=${(exception as any)?.message} | status=${(exception as any)?.status} | code=${(exception as any)?.code}`);
      this.logger.error(
        `Unhandled exception captured by Sentry — requestId=${requestId}`,
        exception instanceof Error ? exception.stack : String((exception as any)?.message ?? exception),
      );
    }

    if (isHttpException) {
      const responseBody = exception.getResponse();
      response.status(status).json(responseBody);
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      typeof (exception as Record<string, unknown>).statusCode === 'number'
    ) {
      const obj = exception as Record<string, unknown>;
      response.status(obj.statusCode as number).json(obj);
    } else {
      response.status(500).json({
        statusCode: 500,
        message: 'Internal server error [v2]',
      });
    }
  }
}
