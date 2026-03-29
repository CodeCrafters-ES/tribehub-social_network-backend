import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('Missing required environment variable: REDIS_URL');
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async setWithTtl(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }

    await this.connectIfNeeded();
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    await this.connectIfNeeded();
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
