import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DiscordAlertService, AlertPayload } from './discord-alert.service';

describe('DiscordAlertService', () => {
  let service: DiscordAlertService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DiscordAlertService],
    }).compile();

    service = module.get<DiscordAlertService>(DiscordAlertService);
  });

  const basePayload: AlertPayload = {
    queueName: 'jobs',
    metric: 'failed_jobs',
    currentValue: 25,
    threshold: 20,
    severity: 'critical',
  };

  describe('sendAlert', () => {
    it('sends a POST request with a red embed for critical severity', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.sendAlert(
        'https://discord.com/api/webhooks/test',
        basePayload,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://discord.com/api/webhooks/test');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string) as {
        embeds: { color: number; fields: { name: string; value: string }[] }[];
      };
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].color).toBe(0xff0000);

      const fieldNames = body.embeds[0].fields.map((f) => f.name);
      expect(fieldNames).toContain('Queue');
      expect(fieldNames).toContain('Metric');
      expect(fieldNames).toContain('Current Value');
      expect(fieldNames).toContain('Threshold');
    });

    it('sends a POST request with an orange embed for ops severity', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const payload: AlertPayload = {
        ...basePayload,
        severity: 'ops',
        metric: 'waiting_jobs',
      };

      await service.sendAlert('https://discord.com/api/webhooks/test', payload);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as {
        embeds: { color: number }[];
      };
      expect(body.embeds[0].color).toBe(0xff9900);
    });

    it('does not throw and logs a warning when webhookUrl is undefined', async () => {
      const loggerSpy = vi
        .spyOn(
          (service as unknown as { logger: { warn: ReturnType<typeof vi.fn> } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await expect(
        service.sendAlert(undefined, basePayload),
      ).resolves.toBeUndefined();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throw and logs a warning when webhookUrl is an empty string', async () => {
      const loggerSpy = vi
        .spyOn(
          (service as unknown as { logger: { warn: ReturnType<typeof vi.fn> } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await expect(service.sendAlert('', basePayload)).resolves.toBeUndefined();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it('does not throw when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network failure'));

      await expect(
        service.sendAlert('https://discord.com/api/webhooks/test', basePayload),
      ).resolves.toBeUndefined();
    });

    it('does not throw when Discord responds with a non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

      await expect(
        service.sendAlert('https://discord.com/api/webhooks/test', basePayload),
      ).resolves.toBeUndefined();
    });
  });
});
