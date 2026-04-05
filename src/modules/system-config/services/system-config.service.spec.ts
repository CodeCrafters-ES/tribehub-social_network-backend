// src/modules/system-config/services/system-config.service.spec.ts

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock ioredis before importing the service under test so that no real
// Redis connection is attempted during unit tests.
//
// vi.hoisted() runs BEFORE the vi.mock() factory is hoisted, which lets us
// declare the shared mock instance in a way that is accessible both inside
// the factory and in the test body.
// ---------------------------------------------------------------------------

const { mockRedisInstance } = vi.hoisted(() => {
  const mockRedisInstance = {
    on: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
    quit: vi.fn().mockResolvedValue('OK'),
    removeAllListeners: vi.fn(),
  };
  return { mockRedisInstance };
});

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedisInstance),
}));

import { SystemConfigService } from './system-config.service';

const getMockRedis = (): any => mockRedisInstance;

// ---------------------------------------------------------------------------
// Repository mock
// ---------------------------------------------------------------------------
const mockRepository = {
  findByKey: vi.fn(),
  findAll: vi.fn(),
};

function buildService(): SystemConfigService {
  return new SystemConfigService(mockRepository as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: REDIS_URL set so Redis path is exercised.
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.SYSTEM_CONFIG_CACHE_TTL_SECONDS = '60';
});

afterEach(() => {
  // Ensure the service lifecycle is torn down cleanly.
  delete process.env.REDIS_URL;
});

// ---------------------------------------------------------------------------
// get() — cache miss → DB hit
// ---------------------------------------------------------------------------
describe('SystemConfigService.get', () => {
  it('returns value from DB on cache miss and populates caches', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-1',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.get('feature.feed.enabled', false);

    expect(result).toBe(true);
    expect(mockRepository.findByKey).toHaveBeenCalledWith(
      'feature.feed.enabled',
    );
    // Redis set should have been called to populate level-2 cache.
    expect(getMockRedis().set).toHaveBeenCalledOnce();

    await service.onModuleDestroy();
  });

  it('returns defaultValue when key does not exist in DB', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue(null);

    const result = await service.get('feature.nonexistent.flag', 'default_val');

    expect(result).toBe('default_val');
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    await service.onModuleDestroy();
  });

  it('returns defaultValue (and does NOT throw) when DB throws', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockRejectedValue(new Error('DB connection lost'));

    const result = await service.get('feature.feed.enabled', false);

    expect(result).toBe(false);

    await service.onModuleDestroy();
  });

  it('returns value from in-memory cache on second call (DB called once)', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-2',
      key: 'feature.posts.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // First call — populates in-memory cache.
    await service.get('feature.posts.enabled', false);
    // Second call — should hit in-memory and NOT call DB again.
    const result = await service.get('feature.posts.enabled', false);

    expect(result).toBe(true);
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    await service.onModuleDestroy();
  });

  it('returns value from Redis cache when in-memory is cold', async () => {
    const service = buildService();
    service.onModuleInit();

    // Redis returns a serialized value.
    getMockRedis().get.mockResolvedValue(JSON.stringify(42));

    const result = await service.get<number>('config.search.rateLimit', 10);

    expect(result).toBe(42);
    // DB should NOT have been called because Redis hit.
    expect(mockRepository.findByKey).not.toHaveBeenCalled();

    await service.onModuleDestroy();
  });

  it('falls back to DB when Redis.get throws', async () => {
    const service = buildService();
    service.onModuleInit();

    getMockRedis().get.mockRejectedValue(new Error('Redis unavailable'));
    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-3',
      key: 'feature.comments.enabled',
      value: false,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.get('feature.comments.enabled', true);

    expect(result).toBe(false);
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    await service.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// isEnabled()
// ---------------------------------------------------------------------------
describe('SystemConfigService.isEnabled', () => {
  it('returns true when DB value is boolean true', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-4',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(await service.isEnabled('feature.feed.enabled')).toBe(true);

    await service.onModuleDestroy();
  });

  it('returns false by default when key is absent', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue(null);

    expect(await service.isEnabled('feature.unknown.flag')).toBe(false);

    await service.onModuleDestroy();
  });

  it('accepts string "true" as truthy', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-5',
      key: 'feature.search.enabled',
      value: 'true',
      valueType: 'string',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(await service.isEnabled('feature.search.enabled')).toBe(true);

    await service.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// invalidate()
// ---------------------------------------------------------------------------
describe('SystemConfigService.invalidate', () => {
  it('forces a DB call on next get() after invalidating a single key', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-6',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Warm the in-memory cache.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    // Invalidate the key.
    await service.invalidate('feature.feed.enabled');
    expect(getMockRedis().del).toHaveBeenCalledOnce();

    // Next get() must hit DB again.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });

  it('clears all keys from in-memory cache on invalidate()', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-7',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Warm the in-memory cache.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    // Invalidate all keys.
    await service.invalidate();

    // Next get() must hit DB again.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// TTL expiry
// ---------------------------------------------------------------------------
describe('SystemConfigService TTL expiry', () => {
  it('re-fetches from DB after the in-memory TTL has elapsed', async () => {
    // Set a very short TTL (1 ms).
    process.env.SYSTEM_CONFIG_CACHE_TTL_SECONDS = '0'; // triggers the default floor to 60… test differently

    // Override by accessing internal state via a tiny wrapper.
    const service = buildService();
    // Patch cacheTtlMs to 1 ms so we can expire it in the test.

    (service as any).cacheTtlMs = 1;
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-8',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // First call — populates cache.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledOnce();

    // Wait for TTL to expire (2 ms should be enough for 1 ms TTL).
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Second call — cache expired, must hit DB again.
    await service.get('feature.feed.enabled', false);
    expect(mockRepository.findByKey).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });
});

// ---------------------------------------------------------------------------
// No Redis (REDIS_URL not set)
// ---------------------------------------------------------------------------
describe('SystemConfigService without Redis', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it('still returns DB values when Redis is unavailable', async () => {
    const service = buildService();
    service.onModuleInit();

    mockRepository.findByKey.mockResolvedValue({
      id: 'uuid-9',
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.get('feature.feed.enabled', false);
    expect(result).toBe(true);
    // Redis.set must NOT have been called (no Redis client).
    expect(getMockRedis().set).not.toHaveBeenCalled();

    await service.onModuleDestroy();
  });
});
