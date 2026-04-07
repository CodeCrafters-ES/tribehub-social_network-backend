import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import v8 from 'v8';
import Redis from 'ioredis';
import { MetricsService } from '../metrics/metrics.service';
import { DiscordAlertService } from '../../queues/alerts/discord-alert.service';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_5XX_RATE_THRESHOLD = 0.05;
const DEFAULT_LATENCY_P95_MS = 800;
const DEFAULT_MEMORY_THRESHOLD = 0.9;
const DEFAULT_REDIS_LATENCY_MS = 50;

interface MetricJson {
  name: string;
  values: MetricValue[];
}

interface MetricValue {
  labels: Record<string, string>;
  value: number;
  metricName?: string;
}

@Injectable()
export class AppMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppMonitorService.name);
  private readonly intervalMs: number;
  private readonly rate5xxThreshold: number;
  private readonly latencyP95Ms: number;
  private readonly memoryThreshold: number;
  private readonly redisLatencyMs: number;
  private readonly redisClient: Redis | null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly discordAlertService: DiscordAlertService,
  ) {
    this.intervalMs =
      parseInt(process.env.APP_MONITOR_INTERVAL_MS ?? '', 10) ||
      DEFAULT_INTERVAL_MS;

    this.rate5xxThreshold =
      parseFloat(process.env.APP_ALERT_5XX_RATE_THRESHOLD ?? '') ||
      DEFAULT_5XX_RATE_THRESHOLD;

    this.latencyP95Ms =
      parseInt(process.env.APP_ALERT_LATENCY_P95_MS ?? '', 10) ||
      DEFAULT_LATENCY_P95_MS;

    this.memoryThreshold =
      parseFloat(process.env.APP_ALERT_MEMORY_THRESHOLD ?? '') ||
      DEFAULT_MEMORY_THRESHOLD;

    this.redisLatencyMs =
      parseInt(process.env.APP_ALERT_REDIS_LATENCY_MS ?? '', 10) ||
      DEFAULT_REDIS_LATENCY_MS;

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        retryStrategy: (times) =>
          times > 5 ? null : Math.min(times * 500, 5000),
      });

      // Log Redis errors so reconnect storms are visible in structured logs
      // instead of being silently swallowed and accumulating retry timers.
      this.redisClient.on('error', (err: Error) => {
        this.logger.warn({
          event: 'app_monitor.redis_error',
          message: err.message,
        });
      });
    } else {
      this.redisClient = null;
      this.logger.warn(
        'REDIS_URL is not set — AppMonitorService will skip Redis latency checks',
      );
    }
  }

  onModuleInit(): void {
    if (this.redisClient) {
      // Explicitly establish the connection so it is ready before the first
      // health check fires. lazyConnect: true defers the TCP handshake but
      // does not prevent IORedis from allocating internal buffers — calling
      // connect() here makes the lifecycle explicit and avoids an implicit
      // reconnect on the first ping() call inside checkRedisLatency().
      void this.redisClient.connect().catch(() => {
        // Non-fatal: if Redis is unavailable the health check will log a warn
        // and skip the latency alert rather than crashing.
      });
    }
    this.scheduleCheck();
  }

  onModuleDestroy(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.redisClient) {
      this.redisClient.removeAllListeners();
      this.redisClient.disconnect();
    }
  }

  private scheduleCheck(): void {
    this.timeoutHandle = setTimeout(() => {
      void this.runCheck().then(() => {
        this.scheduleCheck();
      });
    }, this.intervalMs);
  }

  async runCheck(): Promise<void> {
    await Promise.all([
      this.check5xxRate(),
      this.checkLatencyP95(),
      this.checkMemory(),
      this.checkRedisLatency(),
    ]);
  }

  private async check5xxRate(): Promise<void> {
    const metricsJson =
      (await this.metricsService.registry.getMetricsAsJSON()) as MetricJson[];

    const requestsMetric = metricsJson.find(
      (m) => m.name === 'http_requests_total',
    );

    if (!requestsMetric || requestsMetric.values.length === 0) {
      return;
    }

    let total = 0;
    let errors5xx = 0;

    for (const v of requestsMetric.values) {
      const code = parseInt(v.labels['status_code'] ?? '0', 10);
      total += v.value;
      if (code >= 500) {
        errors5xx += v.value;
      }
    }

    if (total === 0) {
      return;
    }

    const rate = errors5xx / total;

    this.logger.log({
      event: 'app_monitor.5xx_rate',
      rate,
      errors5xx,
      total,
      threshold: this.rate5xxThreshold,
    });

    if (rate > this.rate5xxThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_CRITICAL,
        {
          queueName: 'app',
          metric: '5xx_rate',
          currentValue: Math.round(rate * 10000) / 10000,
          threshold: this.rate5xxThreshold,
          severity: 'critical',
        },
      );
    }
  }

  private async checkLatencyP95(): Promise<void> {
    const metricsJson =
      (await this.metricsService.registry.getMetricsAsJSON()) as MetricJson[];

    const durationMetric = metricsJson.find(
      (m) => m.name === 'http_request_duration_seconds',
    );

    if (!durationMetric || durationMetric.values.length === 0) {
      return;
    }

    const p95Ms = this.computeP95Ms(durationMetric.values);

    if (p95Ms === null) {
      return;
    }

    this.logger.log({
      event: 'app_monitor.latency_p95',
      p95Ms,
      threshold: this.latencyP95Ms,
    });

    if (p95Ms > this.latencyP95Ms) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_OPS,
        {
          queueName: 'app',
          metric: 'latency_p95_ms',
          currentValue: p95Ms,
          threshold: this.latencyP95Ms,
          severity: 'ops',
        },
      );
    }
  }

  private computeP95Ms(values: MetricValue[]): number | null {
    const buckets: { le: number; count: number }[] = [];
    let totalCount = 0;

    for (const v of values) {
      const metricName = v.metricName ?? '';
      if (metricName.endsWith('_bucket')) {
        const le = parseFloat(v.labels['le'] ?? 'Infinity');
        if (!isNaN(le) && isFinite(le)) {
          buckets.push({ le, count: v.value });
        }
      } else if (metricName.endsWith('_count')) {
        totalCount = v.value;
      }
    }

    if (totalCount === 0 || buckets.length === 0) {
      return null;
    }

    buckets.sort((a, b) => a.le - b.le);

    const target = totalCount * 0.95;

    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].count >= target) {
        return buckets[i].le * 1000;
      }
    }

    return buckets[buckets.length - 1].le * 1000;
  }

  private async checkMemory(): Promise<void> {
    const { heapUsed } = process.memoryUsage();
    const { heap_size_limit: heapSizeLimit } = v8.getHeapStatistics();
    const ratio = heapUsed / heapSizeLimit;

    this.logger.log({
      event: 'app_monitor.memory',
      heapUsed,
      heapSizeLimit,
      ratio,
      threshold: this.memoryThreshold,
    });

    if (ratio > this.memoryThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_CRITICAL,
        {
          queueName: 'app',
          metric: 'memory_heap_ratio',
          currentValue: Math.round(ratio * 10000) / 10000,
          threshold: this.memoryThreshold,
          severity: 'critical',
        },
      );
    }
  }

  private async checkRedisLatency(): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    let latencyMs: number;

    try {
      const start = Date.now();
      await this.redisClient.ping();
      latencyMs = Date.now() - start;
    } catch (err) {
      this.logger.warn({
        event: 'app_monitor.redis_ping_failed',
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    this.logger.log({
      event: 'app_monitor.redis_latency',
      latencyMs,
      threshold: this.redisLatencyMs,
    });

    if (latencyMs > this.redisLatencyMs) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_OPS,
        {
          queueName: 'app',
          metric: 'redis_latency_ms',
          currentValue: latencyMs,
          threshold: this.redisLatencyMs,
          severity: 'ops',
        },
      );
    }
  }
}
