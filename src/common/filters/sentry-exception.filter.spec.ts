import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SentryExceptionFilter } from './sentry-exception.filter';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: unknown) => void) => {
    cb({ setContext: vi.fn() });
  }),
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';

function buildHost(requestId?: string) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status };
  const request = { requestId: requestId ?? 'test-request-id' };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    json,
    status,
    response,
  };
}

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;

  beforeEach(() => {
    filter = new SentryExceptionFilter();
    vi.clearAllMocks();
  });

  it('does NOT report a 4xx HttpException to Sentry', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT report a 400 HttpException to Sentry', () => {
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports a 500 HttpException to Sentry', () => {
    const exception = new HttpException(
      'Internal error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it('reports a 503 HttpException to Sentry', () => {
    const exception = new HttpException(
      'Service unavailable',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it('reports a non-HTTP exception to Sentry', () => {
    const exception = new Error('Unexpected failure');
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(Sentry.captureException).toHaveBeenCalledWith(exception);
  });

  it('includes requestId as context when reporting to Sentry', () => {
    const requestId = 'abc-123-xyz';
    const exception = new Error('Crash');
    const host = buildHost(requestId);

    filter.catch(exception, host as any);

    expect(Sentry.withScope).toHaveBeenCalled();
    const scopeCb = (Sentry.withScope as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as (scope: { setContext: ReturnType<typeof vi.fn> }) => void;
    const mockScope = { setContext: vi.fn() };
    scopeCb(mockScope);
    expect(mockScope.setContext).toHaveBeenCalledWith('request', { requestId });
  });

  it('responds with the HttpException status and body for 4xx errors', () => {
    const exception = new HttpException(
      { statusCode: 422, message: 'Unprocessable' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(host.response.status).toHaveBeenCalledWith(422);
    expect(host.json).toHaveBeenCalledWith({
      statusCode: 422,
      message: 'Unprocessable',
    });
  });

  it('responds with 500 for non-HTTP exceptions', () => {
    const exception = new TypeError('Boom');
    const host = buildHost();

    filter.catch(exception, host as any);

    expect(host.response.status).toHaveBeenCalledWith(500);
    expect(host.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
