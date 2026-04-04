import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SecurityMonitorService } from './security-monitor.service';
import { DiscordAlertService } from '../../queues/alerts/discord-alert.service';

describe('SecurityMonitorService', () => {
  let service: SecurityMonitorService;
  let discordAlertService: { sendAlert: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();

    delete process.env.SECURITY_ALERT_BRUTE_FORCE_THRESHOLD;
    delete process.env.SECURITY_ALERT_INVALID_TOKEN_THRESHOLD;
    delete process.env.SECURITY_MONITOR_INTERVAL_MS;
    delete process.env.DISCORD_WEBHOOK_SECURITY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityMonitorService,
        {
          provide: DiscordAlertService,
          useValue: { sendAlert: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<SecurityMonitorService>(SecurityMonitorService);
    discordAlertService = module.get(DiscordAlertService);
  });

  afterEach(() => {
    vi.useRealTimers();
    service.onModuleDestroy();
  });

  describe('recordFailedLogin / brute force alert', () => {
    it('sends security alert when failed logins exceed threshold within window', async () => {
      process.env.DISCORD_WEBHOOK_SECURITY =
        'https://discord.com/api/webhooks/security';

      for (let i = 0; i < 11; i++) {
        service.recordFailedLogin();
      }

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/security',
        expect.objectContaining({
          metric: 'brute_force_login',
          currentValue: 11,
          threshold: 10,
          severity: 'security',
        }),
      );
    });

    it('does not send alert when failed logins equal the threshold', async () => {
      for (let i = 0; i < 10; i++) {
        service.recordFailedLogin();
      }

      await service.runCheck();

      const calls = discordAlertService.sendAlert.mock.calls;
      const bruteForce = calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'brute_force_login',
      );
      expect(bruteForce).toHaveLength(0);
    });

    it('does not send alert when there are no failed logins', async () => {
      await service.runCheck();

      expect(discordAlertService.sendAlert).not.toHaveBeenCalled();
    });
  });

  describe('recordInvalidToken / invalid token alert', () => {
    it('sends security alert when invalid tokens exceed threshold within window', async () => {
      process.env.DISCORD_WEBHOOK_SECURITY =
        'https://discord.com/api/webhooks/security';

      for (let i = 0; i < 51; i++) {
        service.recordInvalidToken();
      }

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/security',
        expect.objectContaining({
          metric: 'invalid_token',
          currentValue: 51,
          threshold: 50,
          severity: 'security',
        }),
      );
    });

    it('does not send alert when invalid tokens equal the threshold', async () => {
      for (let i = 0; i < 50; i++) {
        service.recordInvalidToken();
      }

      await service.runCheck();

      const calls = discordAlertService.sendAlert.mock.calls;
      const tokenAlerts = calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'invalid_token',
      );
      expect(tokenAlerts).toHaveLength(0);
    });
  });

  describe('sliding window cleanup', () => {
    it('does not count failed logins older than 5 minutes', async () => {
      for (let i = 0; i < 11; i++) {
        service.recordFailedLogin();
      }

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await service.runCheck();

      const calls = discordAlertService.sendAlert.mock.calls;
      const bruteForce = calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'brute_force_login',
      );
      expect(bruteForce).toHaveLength(0);
    });

    it('does not count invalid tokens older than 5 minutes', async () => {
      for (let i = 0; i < 51; i++) {
        service.recordInvalidToken();
      }

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await service.runCheck();

      const calls = discordAlertService.sendAlert.mock.calls;
      const tokenAlerts = calls.filter(
        (c: unknown[]) =>
          (c[1] as { metric: string }).metric === 'invalid_token',
      );
      expect(tokenAlerts).toHaveLength(0);
    });

    it('counts only events within the 5-minute window when mixed old and new', async () => {
      process.env.DISCORD_WEBHOOK_SECURITY =
        'https://discord.com/api/webhooks/security';

      for (let i = 0; i < 5; i++) {
        service.recordFailedLogin();
      }

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      for (let i = 0; i < 11; i++) {
        service.recordFailedLogin();
      }

      await service.runCheck();

      expect(discordAlertService.sendAlert).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/security',
        expect.objectContaining({
          metric: 'brute_force_login',
          currentValue: 11,
        }),
      );
    });

    it('prunes stale timestamps on each check', async () => {
      for (let i = 0; i < 11; i++) {
        service.recordFailedLogin();
      }

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      await service.runCheck();

      const timestamps = (
        service as unknown as { failedLoginTimestamps: number[] }
      ).failedLoginTimestamps;

      expect(timestamps).toHaveLength(0);
    });
  });

  describe('configurable thresholds', () => {
    it('respects SECURITY_ALERT_BRUTE_FORCE_THRESHOLD from env', async () => {
      process.env.SECURITY_ALERT_BRUTE_FORCE_THRESHOLD = '3';
      process.env.DISCORD_WEBHOOK_SECURITY =
        'https://discord.com/api/webhooks/security';

      const customSendAlert = vi.fn().mockResolvedValue(undefined);

      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          SecurityMonitorService,
          {
            provide: DiscordAlertService,
            useValue: { sendAlert: customSendAlert },
          },
        ],
      }).compile();

      const customService = mod.get<SecurityMonitorService>(
        SecurityMonitorService,
      );

      for (let i = 0; i < 4; i++) {
        customService.recordFailedLogin();
      }

      await customService.runCheck();

      expect(customSendAlert).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metric: 'brute_force_login',
          threshold: 3,
        }),
      );

      customService.onModuleDestroy();
      delete process.env.SECURITY_ALERT_BRUTE_FORCE_THRESHOLD;
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
  });
});
