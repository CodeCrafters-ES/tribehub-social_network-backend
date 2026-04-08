// src/queues/redis.connection.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RedisOptions } from 'bullmq';

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation((opts: unknown) => opts);
  return { default: MockRedis };
});

import { default as MockRedis } from 'ioredis';
import { getRedisConnection, buildRedisClient } from './redis.connection';

describe('getRedisConnection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    expect(() => getRedisConnection()).toThrow(
      'REDIS_URL environment variable is not set',
    );
  });

  it('parses host and port from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.host).toBe('my-redis-host');
    expect(conn.port).toBe(6380);
  });

  it('includes password when present in REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://:secret@my-redis-host:6379';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.password).toBe('secret');
  });

  it('does not include password when absent from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6379';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.password).toBeUndefined();
  });

  it('adds tls option when REDIS_TLS=true', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    process.env.REDIS_TLS = 'true';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.tls).toBeDefined();
    delete process.env.REDIS_TLS;
  });

  it('adds tls option when the URL scheme is rediss://', () => {
    process.env.REDIS_URL = 'rediss://my-redis-host:6380';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.tls).toBeDefined();
  });

  it('does not add tls option when REDIS_TLS is not set', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    delete process.env.REDIS_TLS;
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.tls).toBeUndefined();
  });

  it('sets maxRetriesPerRequest to null', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const conn = getRedisConnection() as RedisOptions;
    expect(conn.maxRetriesPerRequest).toBeNull();
  });
});

describe('buildRedisClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    expect(() => buildRedisClient()).toThrow(
      'REDIS_URL environment variable is not set',
    );
  });

  it('passes maxRetriesPerRequest: null to the IORedis constructor', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    buildRedisClient();
    const opts = (MockRedis as ReturnType<typeof vi.fn>).mock.calls.at(
      -1,
    )?.[0] as Record<string, unknown>;
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('passes enableReadyCheck: false to the IORedis constructor', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    buildRedisClient();
    const opts = (MockRedis as ReturnType<typeof vi.fn>).mock.calls.at(
      -1,
    )?.[0] as Record<string, unknown>;
    expect(opts.enableReadyCheck).toBe(false);
  });

  it('does not pass retryStrategy to the IORedis constructor', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    buildRedisClient();
    const opts = (MockRedis as ReturnType<typeof vi.fn>).mock.calls.at(
      -1,
    )?.[0] as Record<string, unknown>;
    expect(opts.retryStrategy).toBeUndefined();
  });
});
