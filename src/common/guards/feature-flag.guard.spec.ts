// src/common/guards/feature-flag.guard.spec.ts
//
// Unit tests for FeatureFlagGuard.
//
// Strategy:
//   - Mock SystemConfigService and Reflector (no real DB or Redis).
//   - Build a minimal ExecutionContext stub that mimics NestJS internals.
//   - Cover all branches: no decorator, flag=true, flag=false.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';
import { FeatureFlagGuard } from './feature-flag.guard';

// ---------------------------------------------------------------------------
// Mock factory helpers
// ---------------------------------------------------------------------------

function buildGuard(isEnabledReturnValue: boolean): {
  guard: FeatureFlagGuard;
  mockSystemConfigService: { isEnabled: ReturnType<typeof vi.fn> };
  mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
} {
  const mockSystemConfigService = {
    isEnabled: vi.fn().mockResolvedValue(isEnabledReturnValue),
  };

  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  const guard = new FeatureFlagGuard(
    mockReflector as never,
    mockSystemConfigService as never,
  );

  return { guard, mockSystemConfigService, mockReflector };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeatureFlagGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Pass-through when no @FeatureFlag decorator is set
  // -------------------------------------------------------------------------
  it('passes through when no flag key metadata is set (no decorator)', async () => {
    const { guard, mockReflector, mockSystemConfigService } = buildGuard(true);

    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    const context = {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn(),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    // SystemConfigService must NOT be called when there is no flag key
    expect(mockSystemConfigService.isEnabled).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Pass-through when flag = true
  // -------------------------------------------------------------------------
  it('passes through when the feature flag is enabled (true)', async () => {
    const { guard, mockReflector, mockSystemConfigService } = buildGuard(true);

    mockReflector.getAllAndOverride.mockReturnValue('feature.feed.enabled');

    const mockRequest = { method: 'GET', url: '/feed', requestId: 'req-abc' };
    const context = {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockSystemConfigService.isEnabled).toHaveBeenCalledWith(
      'feature.feed.enabled',
      true, // default open
    );
  });

  // -------------------------------------------------------------------------
  // 3. 403 Forbidden when flag = false
  // -------------------------------------------------------------------------
  it('throws ForbiddenException when the feature flag is disabled (false)', async () => {
    const { guard, mockReflector, mockSystemConfigService } = buildGuard(false);

    mockReflector.getAllAndOverride.mockReturnValue('feature.search.enabled');

    const mockRequest = {
      method: 'GET',
      url: '/search',
      requestId: 'req-xyz',
    };
    const context = {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );

    expect(mockSystemConfigService.isEnabled).toHaveBeenCalledWith(
      'feature.search.enabled',
      true,
    );
  });

  // -------------------------------------------------------------------------
  // 4. Error body has correct { code, message, details } shape
  // -------------------------------------------------------------------------
  it('throws ForbiddenException with the standardised FEATURE_DISABLED error body', async () => {
    const { guard, mockReflector } = buildGuard(false);

    const flagKey = 'feature.feed.enabled';
    mockReflector.getAllAndOverride.mockReturnValue(flagKey);

    const mockRequest = { method: 'GET', url: '/feed', requestId: 'req-001' };
    const context = {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    let thrownError: unknown;
    try {
      await guard.canActivate(context);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ForbiddenException);

    const exception = thrownError as ForbiddenException;
    const response = exception.getResponse() as {
      code: string;
      message: string;
      details: { flag: string };
    };

    expect(response.code).toBe('FEATURE_DISABLED');
    expect(response.message).toBe('This feature is currently disabled.');
    expect(response.details).toEqual({ flag: flagKey });
  });

  // -------------------------------------------------------------------------
  // 5. Works correctly when requestId is absent (middleware not applied)
  // -------------------------------------------------------------------------
  it('handles missing requestId gracefully when flag is disabled', async () => {
    const { guard, mockReflector } = buildGuard(false);

    mockReflector.getAllAndOverride.mockReturnValue('feature.feed.enabled');

    // No requestId property on the request object
    const mockRequest = { method: 'GET', url: '/feed' };
    const context = {
      getHandler: vi.fn().mockReturnValue({}),
      getClass: vi.fn().mockReturnValue({}),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -------------------------------------------------------------------------
  // 6. Reflector uses FEATURE_FLAG_KEY constant
  // -------------------------------------------------------------------------
  it('reads metadata using the FEATURE_FLAG_KEY constant', async () => {
    const { guard, mockReflector } = buildGuard(true);

    mockReflector.getAllAndOverride.mockReturnValue('feature.feed.enabled');

    const handlerStub = {};
    const classStub = {};
    const mockRequest = { method: 'GET', url: '/feed', requestId: 'req-000' };
    const context = {
      getHandler: vi.fn().mockReturnValue(handlerStub),
      getClass: vi.fn().mockReturnValue(classStub),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as Parameters<FeatureFlagGuard['canActivate']>[0];

    await guard.canActivate(context);

    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      FEATURE_FLAG_KEY,
      [handlerStub, classStub],
    );
  });
});
