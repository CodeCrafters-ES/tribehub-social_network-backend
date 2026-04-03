// src/queues/redis.connection.spec.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRedisConnection } from './redis.connection';

describe('getRedisConnection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns localhost:6379 when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    const conn = getRedisConnection();
    expect(conn.host).toBe('localhost');
    expect(conn.port).toBe(6379);
  });

  it('parses host and port from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    const conn = getRedisConnection();
    expect(conn.host).toBe('my-redis-host');
    expect(conn.port).toBe(6380);
  });

  it('includes password when present in REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://:secret@my-redis-host:6379';
    const conn = getRedisConnection();
    expect(conn.password).toBe('secret');
  });

  it('does not include password when absent from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6379';
    const conn = getRedisConnection();
    expect(conn.password).toBeUndefined();
  });

  it('adds tls option when REDIS_TLS=true', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    process.env.REDIS_TLS = 'true';
    const conn = getRedisConnection();
    expect(conn.tls).toBeDefined();
    delete process.env.REDIS_TLS;
  });

  it('does not add tls option when REDIS_TLS is not set', () => {
    process.env.REDIS_URL = 'redis://my-redis-host:6380';
    delete process.env.REDIS_TLS;
    const conn = getRedisConnection();
    expect(conn.tls).toBeUndefined();
  });

  it('sets maxRetriesPerRequest to null', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const conn = getRedisConnection();
    expect(conn.maxRetriesPerRequest).toBeNull();
  });
});
