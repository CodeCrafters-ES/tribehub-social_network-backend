import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Registry } from 'prom-client';

const mockRedisPing = vi.fn();
const mockRedisDisconnect = vi.fn();
const mockRedisOn = vi.fn();
const mockRedisConnect = vi.fn().mockResolvedValue(undefined);

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: mockRedisConnect,
    ping: mockRedisPing,
    disconnect: mockRedisDisconnect,
    on: mockRedisOn,
  })),
}));

import { AppMonitorService } from './app-monitor.service';
import { MetricsService } from '../metrics/metrics.service';
import { DiscordAlertService } from '../../queues/alerts/discord-alert.service';

function buildMetricsJson(opts: {
  total5xx?: number;
  total2xx?: number;
  buckets?: { le: number; count: number }[];
  histCount?: number;
}) {
  const requestValues: {
    labels: Record<string, string>;
    value: number;
    metricName?: string;
  }[] = [];

  if (opts.total2xx !== undefined) {
    requestValues.push({
      labels: { method: 'GET', route: '/api/v1/health', status_code: '200' },
      value: opts.total2xx,
    });
  }

  if (opts.total5xx !== undefined) {
    requestValues.push({
      labels: {
        method: 'POST',
        route: '/api/v1/auth/login',
        status_code: '500',
      },
      value: opts.total5xx,
    });
  }

  const durationValues: {
    labels: Record<string, string>;
    value: number;
    metricName?: string;
  }[] = [];

  if (opts.buckets) {
    for (const b of opts.buckets) {
      durationValues.push({
        labels: { method: 'GET', route: '/api/v1/health', le: String(b.le) },
        value: b.count,
        metricName: 'http_request_duration_seconds_bucket',
      });
    }
  }

  if (opts.histCount !== undefined) {
    durationValues.push({
      labels: { method: 'GET', route: '/api/v1/health' },
      value: opts.histCount,
      metricName: 'http_request_duration_seconds_count',
    });
  }

  return [
    { name: 'http_requests_total', values: requestValues },
    { name: 'http_request_duration_seconds', values: durationValues },
  ];
}

describe('AppMonitorService', () => {
  let service: AppMonitorService;
  let sendAlertMock: ReturnType<typeof vi.fn>;
  let discordAlertService: { sendAlert: ReturnType<typeof vi.fn> };
  let mockRegistry: { getMetricsAsJSON: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockRedisPing.mockReset().mockResolvedValue('PONG');
    mockRedisDisconnect.mockReset().mockReturnValue(undefined);
    mockRedisOn.mockReset().mockReturnValue(undefined);

    delete process.env.APP_ALERT_5XX_RATE_THRESHOLD;
    delete process.env.APP_ALERT_LATENCY_P95_MS;
    delete process.env.APP_ALERT_MEMORY_THRESHOLD;
    delete process.env.APP_ALERT_REDIS_LATENCY_MS;
    delete process.env.APP_MONITOR_INTERVAL_MS;
    delete process.env.DISCORD_WEBHOOK_CRITICAL;
    delete process.env.DISCORD_WEBHOOK_OPS;

    mockRegistry = { getMetricsAsJSON: vi.fn().mockResolvedValue([]) };
    sendAlertMock = vi.fn().mockResolvedValue(undefined);

    const metricsServiceMock = {
      registry: mockRegistry as unknown as Registry,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppMonitorService,
        { provide: MetricsService, useValue: metricsServiceMock },
        {
          provide: DiscordAlertService,
          useValue: { sendAlert: sendAlertMock },
        },
      ],
    }).compile();

    service = module.get<AppMonitorService>(AppMonitorService);
    discordAlertService = module.get(DiscordAlertService);
  });

  afterEach(() => {
    vi.useRealTimers();
    service.onModuleDestroy();
  });

  describe('check5xxRate', () => {
    it('sends critical alert when 5xx rate exceeds threshold', async () => {
      process.env.DISCORD_WEBHOOK_CRITICAL =
        'https://discord.com/api/webhooks/critical';

      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({ total2xx: 90, total5xx: 10 }),
      );

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/critical',
        expect.objectContaining({
          metric: '5xx_rate',
          severity: 'critical',
          threshold: 0.05,
        }),
      );
    });

    it('does not send alert when 5xx rate is below threshold', async () => {
      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({ total2xx: 98, total5xx: 1 }),
      );

      await service.runCheck();

      const alertCalls = sendAlertMock.mock.calls.filter(
        (c: unknown[]) => (c[1] as { metric: string }).metric === '5xx_rate',
      );
      expect(alertCalls).toHaveLength(0);
    });

    it('does not send alert when there are no requests', async () => {
      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({ total2xx: 0, total5xx: 0 }),
      );

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('does not send alert when metrics are empty', async () => {
      mockRegistry.getMetricsAsJSON.mockResolvedValue([]);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });
  });

  describe('checkLatencyP95', () => {
    it('sends ops alert when p95 latency exceeds threshold', async () => {
      process.env.DISCORD_WEBHOOK_OPS = 'https://discord.com/api/webhooks/ops';

      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({
          buckets: [
            { le: 0.5, count: 80 },
            { le: 1.0, count: 100 },
          ],
          histCount: 100,
        }),
      );

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/ops',
        expect.objectContaining({
          metric: 'latency_p95_ms',
          severity: 'ops',
          threshold: 800,
        }),
      );
    });

    it('does not send alert when p95 latency is below threshold', async () => {
      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({
          buckets: [
            { le: 0.1, count: 95 },
            { le: 0.5, count: 100 },
          ],
          histCount: 100,
        }),
      );

      await service.runCheck();

      const alertCalls = sendAlertMock.mock.calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'latency_p95_ms',
      );
      expect(alertCalls).toHaveLength(0);
    });

    it('does not send alert when histogram has no observations', async () => {
      mockRegistry.getMetricsAsJSON.mockResolvedValue(
        buildMetricsJson({ histCount: 0 }),
      );

      await service.runCheck();

      const alertCalls = sendAlertMock.mock.calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'latency_p95_ms',
      );
      expect(alertCalls).toHaveLength(0);
    });
  });

  describe('checkMemory', () => {
    it('sends critical alert when memory ratio exceeds threshold', async () => {
      process.env.APP_ALERT_MEMORY_THRESHOLD = '0.01';
      process.env.DISCORD_WEBHOOK_CRITICAL =
        'https://discord.com/api/webhooks/critical';

      mockRegistry.getMetricsAsJSON.mockResolvedValue([]);

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const customModule: TestingModule = await Test.createTestingModule({
        providers: [
          AppMonitorService,
          {
            provide: MetricsService,
            useValue: { registry: mockRegistry },
          },
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService =
        customModule.get<AppMonitorService>(AppMonitorService);

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/critical',
        expect.objectContaining({
          metric: 'memory_heap_ratio',
          severity: 'critical',
        }),
      );

      customService.onModuleDestroy();
      delete process.env.APP_ALERT_MEMORY_THRESHOLD;
    });
  });

  describe('checkRedisLatency', () => {
    it('sends ops alert when Redis PING takes longer than threshold', async () => {
      process.env.APP_ALERT_REDIS_LATENCY_MS = '1';
      process.env.DISCORD_WEBHOOK_OPS = 'https://discord.com/api/webhooks/ops';

      mockRedisPing.mockImplementation(
        () =>
          new Promise<string>((resolve) =>
            setTimeout(() => resolve('PONG'), 10),
          ),
      );

      mockRegistry.getMetricsAsJSON.mockResolvedValue([]);

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const customModule: TestingModule = await Test.createTestingModule({
        providers: [
          AppMonitorService,
          {
            provide: MetricsService,
            useValue: { registry: mockRegistry },
          },
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService =
        customModule.get<AppMonitorService>(AppMonitorService);

      vi.useRealTimers();
      await customService.runCheck();
      vi.useFakeTimers();

      expect(customSendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/ops',
        expect.objectContaining({
          metric: 'redis_latency_ms',
          severity: 'ops',
          threshold: 1,
        }),
      );

      customService.onModuleDestroy();
      delete process.env.APP_ALERT_REDIS_LATENCY_MS;
    });

    it('does not throw when Redis PING fails', async () => {
      mockRedisPing.mockRejectedValue(new Error('connection refused'));
      mockRegistry.getMetricsAsJSON.mockResolvedValue([]);

      await expect(service.runCheck()).resolves.toBeUndefined();
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('clears the timeout handle on destroy', () => {
      service.onModuleInit();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      service.onModuleDestroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('disconnects Redis on destroy', () => {
      service.onModuleDestroy();

      expect(mockRedisDisconnect).toHaveBeenCalled();
    });
  });
});
