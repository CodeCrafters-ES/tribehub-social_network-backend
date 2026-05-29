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

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;

    if (!isHttpException || status >= 500) {
      const requestId = request.requestId ?? 'unknown';
      Sentry.withScope((scope) => {
        scope.setContext('request', { requestId });
        Sentry.captureException(exception);
      });
      const exceptionMessage =
        exception instanceof Error
          ? exception.stack
          : String(
              typeof exception === 'object' &&
                exception !== null &&
                'message' in exception
                ? (exception as Record<string, unknown>).message
                : exception,
            );
      this.logger.error(
        `Unhandled exception captured by Sentry — requestId=${requestId}`,
        exceptionMessage,
      );
    }

    if (isHttpException) {
      const responseBody = exception.getResponse();
      // Normalize response to always include statusCode
      const body =
        typeof responseBody === 'object' && responseBody !== null
          ? { statusCode: status, ...responseBody }
          : { statusCode: status, message: responseBody };
      response.status(status).json(body);
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
        message: 'Internal server error',
      });
    }
  }
}
