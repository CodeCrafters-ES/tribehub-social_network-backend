import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

const mockGetWaitingCount = vi.fn();
const mockGetFailedCount = vi.fn();
const mockQueueClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    getWaitingCount: mockGetWaitingCount,
    getFailedCount: mockGetFailedCount,
    close: mockQueueClose,
  })),
}));

vi.mock('../redis.connection', () => ({
  getRedisConnection: vi.fn().mockReturnValue({}),
}));

import { QueueMonitorService } from './queue-monitor.service';
import { DiscordAlertService } from './discord-alert.service';

describe('QueueMonitorService', () => {
  let service: QueueMonitorService;
  let discordAlertService: { sendAlert: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();

    mockGetWaitingCount.mockReset().mockResolvedValue(0);
    mockGetFailedCount.mockReset().mockResolvedValue(0);
    mockQueueClose.mockReset().mockResolvedValue(undefined);

    delete process.env.QUEUE_ALERT_WAITING_THRESHOLD;
    delete process.env.QUEUE_ALERT_FAILED_THRESHOLD;
    delete process.env.QUEUE_MONITOR_INTERVAL_MS;
    delete process.env.DISCORD_WEBHOOK_CRITICAL;
    delete process.env.DISCORD_WEBHOOK_OPS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueMonitorService,
        {
          provide: DiscordAlertService,
          useValue: {
            sendAlert: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<QueueMonitorService>(QueueMonitorService);
    discordAlertService = module.get(DiscordAlertService);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await service.onModuleDestroy();
  });

  describe('runCheck', () => {
    it('sends critical alert when failedCount exceeds threshold', async () => {
      mockGetWaitingCount.mockResolvedValue(0);
      mockGetFailedCount.mockResolvedValue(21);
      process.env.DISCORD_WEBHOOK_CRITICAL =
        'https://discord.com/api/webhooks/critical';

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/critical',
        expect.objectContaining({
          metric: 'failed_jobs',
          currentValue: 21,
          threshold: 20,
          severity: 'critical',
        }),
      );
    });

    it('sends ops alert when waitingCount exceeds threshold', async () => {
      mockGetWaitingCount.mockResolvedValue(51);
      mockGetFailedCount.mockResolvedValue(0);
      process.env.DISCORD_WEBHOOK_OPS = 'https://discord.com/api/webhooks/ops';

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/ops',
        expect.objectContaining({
          metric: 'waiting_jobs',
          currentValue: 51,
          threshold: 50,
          severity: 'ops',
        }),
      );
    });

    it('does not send any alert when both counts are below threshold', async () => {
      mockGetWaitingCount.mockResolvedValue(10);
      mockGetFailedCount.mockResolvedValue(5);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('does not send ops alert when waitingCount equals threshold (not strictly greater)', async () => {
      mockGetWaitingCount.mockResolvedValue(50);
      mockGetFailedCount.mockResolvedValue(0);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('does not send critical alert when failedCount equals threshold (not strictly greater)', async () => {
      mockGetWaitingCount.mockResolvedValue(0);
      mockGetFailedCount.mockResolvedValue(20);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('sends both alerts when both counts exceed their thresholds', async () => {
      mockGetWaitingCount.mockResolvedValue(100);
      mockGetFailedCount.mockResolvedValue(30);
      process.env.DISCORD_WEBHOOK_CRITICAL =
        'https://discord.com/api/webhooks/critical';
      process.env.DISCORD_WEBHOOK_OPS = 'https://discord.com/api/webhooks/ops';

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledTimes(2);
    });
  });

  describe('configurable thresholds', () => {
    it('respects QUEUE_ALERT_WAITING_THRESHOLD from env', async () => {
      process.env.QUEUE_ALERT_WAITING_THRESHOLD = '10';

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          QueueMonitorService,
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService = mod.get<QueueMonitorService>(QueueMonitorService);

      mockGetWaitingCount.mockResolvedValue(11);
      mockGetFailedCount.mockResolvedValue(0);

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          metric: 'waiting_jobs',
          currentValue: 11,
          threshold: 10,
        }),
      );

      await customService.onModuleDestroy();
      delete process.env.QUEUE_ALERT_WAITING_THRESHOLD;
    });

    it('respects QUEUE_ALERT_FAILED_THRESHOLD from env', async () => {
      process.env.QUEUE_ALERT_FAILED_THRESHOLD = '5';

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          QueueMonitorService,
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService = mod.get<QueueMonitorService>(QueueMonitorService);

      mockGetWaitingCount.mockResolvedValue(0);
      mockGetFailedCount.mockResolvedValue(6);

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          metric: 'failed_jobs',
          currentValue: 6,
          threshold: 5,
        }),
      );

      await customService.onModuleDestroy();
      delete process.env.QUEUE_ALERT_FAILED_THRESHOLD;
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('cleans up the timeout handle on destroy', async () => {
      service.onModuleInit();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await service.onModuleDestroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('closes the queue on destroy', async () => {
      await service.onModuleDestroy();
      expect(mockQueueClose).toHaveBeenCalled();
    });
  });
});
