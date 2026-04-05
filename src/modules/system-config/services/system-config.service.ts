// src/modules/system-config/services/system-config.service.ts
//
// Feature-flag loader with 2-level cache (in-memory + Redis).
//
// Cache strategy
// ==============
//   Level 1 — in-memory Map<string, CacheEntry>
//     Fast (~0 ms), scoped to the current process. Populated on first access
//     per key. Entries expire after CACHE_TTL_MS milliseconds.
//
//   Level 2 — Redis (optional)
//     Shared across all instances (horizontal scale). Used when Redis is
//     available (REDIS_URL env var set). On miss, falls back to DB.
//
// Read path:
//   in-memory hit?  → return value
//   Redis hit?      → populate in-memory → return value
//   DB hit?         → populate Redis + in-memory → return value
//   DB miss?        → return provided default (non-critical flags)
//
// Key naming convention:
//   feature.<domain>.<flag>   e.g. feature.feed.enabled
//   config.<domain>.<param>   e.g. config.search.rateLimit
//
// TTL:
//   Controlled by env var SYSTEM_CONFIG_CACHE_TTL_SECONDS (default 60 s).

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { SystemConfigRepository } from '../repositories/system-config.repository';

interface CacheEntry {
  value: unknown;
  expiresAt: number; // epoch ms
}

// Prefix used for all keys stored in Redis to avoid collisions.
const REDIS_KEY_PREFIX = 'system_config:';

@Injectable()
export class SystemConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemConfigService.name);

  /** In-process TTL cache. Keyed by config key (not the Redis-prefixed form). */
  private readonly memoryCache = new Map<string, CacheEntry>();

  /** Redis client. Null when REDIS_URL is not set or connection fails. */
  private redisClient: Redis | null = null;

  /** TTL in milliseconds derived from SYSTEM_CONFIG_CACHE_TTL_SECONDS. */
  private readonly cacheTtlMs: number;

  constructor(private readonly repository: SystemConfigRepository) {
    const ttlSeconds = parseInt(
      process.env.SYSTEM_CONFIG_CACHE_TTL_SECONDS ?? '60',
      10,
    );
    this.cacheTtlMs =
      (isNaN(ttlSeconds) || ttlSeconds <= 0 ? 60 : ttlSeconds) * 1000;
  }

  onModuleInit(): void {
    this.initRedis();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      this.redisClient.removeAllListeners();
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the raw JSON value for a key, or `defaultValue` when the key is
   * not present in DB (or DB is unavailable for non-critical flags).
   *
   * @example
   *   const raw = await service.get('feature.feed.enabled', false);
   */
  async get<T = unknown>(key: string, defaultValue: T): Promise<T> {
    // Level 1: in-memory cache
    const memHit = this.getFromMemory(key);
    if (memHit !== undefined) {
      return memHit as T;
    }

    // Level 2: Redis
    const redisHit = await this.getFromRedis(key);
    if (redisHit !== undefined) {
      this.setInMemory(key, redisHit);
      return redisHit as T;
    }

    // Level 3: DB
    try {
      const record = await this.repository.findByKey(key);
      if (record === null) {
        return defaultValue;
      }
      await this.setInRedis(key, record.value);
      this.setInMemory(key, record.value);
      return record.value as T;
    } catch (err: unknown) {
      this.logger.warn({
        event: 'system_config.db_error',
        key,
        message: err instanceof Error ? err.message : 'Unknown DB error',
      });
      // Non-critical: return provided default so the app keeps running.
      return defaultValue;
    }
  }

  /**
   * Convenience method that resolves boolean feature flags.
   *
   * Follows the convention: value stored as JSON boolean.
   * When the key is absent, `defaultValue` is returned (default: false).
   *
   * @example
   *   const enabled = await service.isEnabled('feature.feed.enabled');
   */
  async isEnabled(key: string, defaultValue = false): Promise<boolean> {
    const value = await this.get<unknown>(key, defaultValue);
    if (typeof value === 'boolean') return value;
    // Accept "true"/"false" strings stored by mistake
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  }

  /**
   * Invalidates the cache for a single key (or all keys when called without
   * an argument). Call this after updating a flag in the DB to force a refresh
   * on the next read.
   *
   * @param key - Config key to invalidate. Omit to clear the entire cache.
   */
  async invalidate(key?: string): Promise<void> {
    if (key) {
      this.memoryCache.delete(key);
      await this.deleteFromRedis(key);
      this.logger.log({ event: 'system_config.cache_invalidated', key });
    } else {
      this.memoryCache.clear();
      await this.clearRedisNamespace();
      this.logger.log({ event: 'system_config.cache_cleared' });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers — in-memory
  // ---------------------------------------------------------------------------

  private getFromMemory(key: string): unknown {
    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setInMemory(key: string, value: unknown): void {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers — Redis
  // ---------------------------------------------------------------------------

  private initRedis(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL is not set — SystemConfigService will use in-memory cache only',
      );
      return;
    }

    try {
      this.redisClient = new Redis(redisUrl, {
        // Do not retry forever — if Redis is down, fall through to DB.
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) =>
          times > 5 ? null : Math.min(times * 500, 5000),
      });

      this.redisClient.on('error', (err: Error) => {
        this.logger.warn({
          event: 'system_config.redis_error',
          message: err.message,
        });
      });

      // Connect lazily; errors are swallowed by the event listener above.
      void this.redisClient.connect().catch(() => {
        // Connection failure is non-fatal; subsequent calls will skip Redis.
      });
    } catch (err: unknown) {
      this.logger.warn({
        event: 'system_config.redis_init_failed',
        message: err instanceof Error ? err.message : String(err),
      });
      this.redisClient = null;
    }
  }

  private async getFromRedis(key: string): Promise<unknown> {
    if (!this.redisClient) return undefined;
    try {
      const raw = await this.redisClient.get(REDIS_KEY_PREFIX + key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  private async setInRedis(key: string, value: unknown): Promise<void> {
    if (!this.redisClient) return;
    try {
      const ttlSeconds = Math.ceil(this.cacheTtlMs / 1000);
      await this.redisClient.set(
        REDIS_KEY_PREFIX + key,
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch {
      // Non-fatal — in-memory cache still serves the value.
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    if (!this.redisClient) return;
    try {
      await this.redisClient.del(REDIS_KEY_PREFIX + key);
    } catch {
      // Non-fatal.
    }
  }

  private async clearRedisNamespace(): Promise<void> {
    if (!this.redisClient) return;
    try {
      // SCAN is preferred over KEYS in production to avoid blocking Redis.
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor,
          'MATCH',
          REDIS_KEY_PREFIX + '*',
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // Non-fatal.
    }
  }
}
