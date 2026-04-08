// src/queues/redis.connection.ts
//
// Builds the shared IORedis connection options used by BullMQ.
// Reads REDIS_URL (required). Throws at startup when the variable is absent
// so that a misconfigured deployment fails fast instead of silently attempting
// to connect to localhost:6379 and producing ECONNREFUSED in production.
//
// TLS is enabled when either:
//   - the URL scheme is `rediss://` (Railway / Heroku style), or
//   - the REDIS_TLS environment variable is set to "true".
//
// The returned object is passed directly to BullMQ Queue and Worker
// constructors as the `connection` option.

import Redis, { RedisOptions } from 'ioredis';

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);

  const options: RedisOptions = {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (url.password) {
    options.password = url.password;
  }

  // Enable TLS when the scheme is `rediss://` (Railway exposes Redis this way)
  // or when the explicit REDIS_TLS=true override is provided.
  if (url.protocol === 'rediss:' || process.env.REDIS_TLS === 'true') {
    options.tls = {};
  }

  return options;
}

export function getRedisConnection(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error(
      'REDIS_URL environment variable is not set. ' +
        'Configure it in Railway (or your deployment environment) before starting the app.',
    );
  }
  return parseRedisUrl(redisUrl);
}

/**
 * Builds a fresh IORedis instance configured for use with BullMQ.
 * `maxRetriesPerRequest: null` and `enableReadyCheck: false` are set by
 * parseRedisUrl() and are the correct IORedis v5 knobs for preventing
 * unbounded command-buffer growth — retryStrategy was removed in IORedis v5.
 *
 * Each Queue and Worker must receive its own instance: BullMQ v5 does not
 * duplicate a shared IORedis connection for the blocking client it needs
 * internally, so sharing a single instance between Queue and Worker would
 * cause command-interleaving issues.
 */
export function buildRedisClient(): Redis {
  const options = getRedisConnection();
  return new Redis({
    ...options,
    retryStrategy: (times: number) =>
      times > 5 ? null : Math.min(times * 500, 5000),
  });
}
