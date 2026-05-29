import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

function buildContext(input: {
  header?: string;
  cookie?: string;
}): ExecutionContext {
  const req = {
    headers: input.header ? { 'x-csrf-token': input.header } : {},
    cookies: input.cookie ? { 'XSRF-TOKEN': input.cookie } : {},
  };

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('allows request when header and cookie match', () => {
    const ctx = buildContext({ header: 'abc', cookie: 'abc' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects request when header is missing', () => {
    const ctx = buildContext({ cookie: 'abc' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects request when cookie is missing', () => {
    const ctx = buildContext({ header: 'abc' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects request when header and cookie differ', () => {
    const ctx = buildContext({ header: 'abc', cookie: 'xyz' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
