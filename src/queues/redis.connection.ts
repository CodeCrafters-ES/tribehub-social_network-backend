// src/queues/redis.connection.ts
//
// Builds the shared IORedis connection options used by BullMQ.
// Reads REDIS_URL; falls back to localhost:6379 for local development.
//
// The returned object is passed directly to BullMQ Queue and Worker
// constructors as the `connection` option.

import { ConnectionOptions } from 'bullmq';

function parseRedisUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  const options: ConnectionOptions = {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (url.password) {
    options.password = url.password;
  }

  if (process.env.REDIS_TLS === 'true') {
    options.tls = {};
  }

  return options;
}

export function getRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return parseRedisUrl(redisUrl);
}
