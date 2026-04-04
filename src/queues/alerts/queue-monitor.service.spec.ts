import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

// Mock BullMQ and redis.connection are no longer needed here because
// QueueMonitorService delegates to QueueService (injected) instead of
// owning its own Queue instance.

import { QueueMonitorService } from './queue-monitor.service';
import { QueueService } from '../queue.service';
import { DiscordAlertService } from './discord-alert.service';

describe('QueueMonitorService', () => {
  let service: QueueMonitorService;
  let discordAlertService: { sendAlert: ReturnType<typeof vi.fn> };
  let queueService: {
    getWaitingCount: ReturnType<typeof vi.fn>;
    getFailedCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    delete process.env.QUEUE_ALERT_WAITING_THRESHOLD;
    delete process.env.QUEUE_ALERT_FAILED_THRESHOLD;
    delete process.env.QUEUE_MONITOR_INTERVAL_MS;
    delete process.env.DISCORD_WEBHOOK_CRITICAL;
    delete process.env.DISCORD_WEBHOOK_OPS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueMonitorService,
        {
          provide: QueueService,
          useValue: {
            getWaitingCount: vi.fn().mockResolvedValue(0),
            getFailedCount: vi.fn().mockResolvedValue(0),
          },
        },
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
    queueService = module.get(QueueService);
  });

  afterEach(() => {
    vi.useRealTimers();
    service.onModuleDestroy();
  });

  describe('runCheck', () => {
    it('sends critical alert when failedCount exceeds threshold', async () => {
      queueService.getWaitingCount.mockResolvedValue(0);
      queueService.getFailedCount.mockResolvedValue(21);
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
      queueService.getWaitingCount.mockResolvedValue(51);
      queueService.getFailedCount.mockResolvedValue(0);
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
      queueService.getWaitingCount.mockResolvedValue(10);
      queueService.getFailedCount.mockResolvedValue(5);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('does not send ops alert when waitingCount equals threshold (not strictly greater)', async () => {
      queueService.getWaitingCount.mockResolvedValue(50);
      queueService.getFailedCount.mockResolvedValue(0);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('does not send critical alert when failedCount equals threshold (not strictly greater)', async () => {
      queueService.getWaitingCount.mockResolvedValue(0);
      queueService.getFailedCount.mockResolvedValue(20);

      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });

    it('sends both alerts when both counts exceed their thresholds', async () => {
      queueService.getWaitingCount.mockResolvedValue(100);
      queueService.getFailedCount.mockResolvedValue(30);
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
            provide: QueueService,
            useValue: {
              getWaitingCount: vi.fn().mockResolvedValue(11),
              getFailedCount: vi.fn().mockResolvedValue(0),
            },
          },
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService = mod.get<QueueMonitorService>(QueueMonitorService);

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          metric: 'waiting_jobs',
          currentValue: 11,
          threshold: 10,
        }),
      );

      customService.onModuleDestroy();
      delete process.env.QUEUE_ALERT_WAITING_THRESHOLD;
    });

    it('respects QUEUE_ALERT_FAILED_THRESHOLD from env', async () => {
      process.env.QUEUE_ALERT_FAILED_THRESHOLD = '5';

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          QueueMonitorService,
          {
            provide: QueueService,
            useValue: {
              getWaitingCount: vi.fn().mockResolvedValue(0),
              getFailedCount: vi.fn().mockResolvedValue(6),
            },
          },
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService = mod.get<QueueMonitorService>(QueueMonitorService);

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          metric: 'failed_jobs',
          currentValue: 6,
          threshold: 5,
        }),
      );

      customService.onModuleDestroy();
      delete process.env.QUEUE_ALERT_FAILED_THRESHOLD;
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('cleans up the timeout handle on destroy', () => {
      service.onModuleInit();

      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      service.onModuleDestroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('does not throw when destroyed before init', () => {
      // Service was constructed but onModuleInit never called.
      // onModuleDestroy must be a no-op in that case.
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });
});
