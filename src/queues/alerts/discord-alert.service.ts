import { Injectable, Logger } from '@nestjs/common';

export type AlertSeverity = 'critical' | 'ops';

export interface AlertPayload {
  queueName: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  footer: { text: string };
  timestamp: string;
}

interface DiscordWebhookBody {
  embeds: DiscordEmbed[];
}

const EMBED_COLOR: Record<AlertSeverity, number> = {
  critical: 0xff0000,
  ops: 0xff9900,
};

@Injectable()
export class DiscordAlertService {
  private readonly logger = new Logger(DiscordAlertService.name);

  async sendAlert(
    webhookUrl: string | undefined,
    payload: AlertPayload,
  ): Promise<void> {
    if (!webhookUrl) {
      this.logger.warn({
        event: 'discord_alert.webhook_not_configured',
        severity: payload.severity,
        queueName: payload.queueName,
      });
      return;
    }

    const body: DiscordWebhookBody = {
      embeds: [
        {
          title: `Queue Alert [${payload.severity.toUpperCase()}] — ${payload.queueName}`,
          description: `Metric **${payload.metric}** has exceeded the configured threshold.`,
          color: EMBED_COLOR[payload.severity],
          fields: [
            {
              name: 'Queue',
              value: payload.queueName,
              inline: true,
            },
            {
              name: 'Metric',
              value: payload.metric,
              inline: true,
            },
            {
              name: 'Current Value',
              value: String(payload.currentValue),
              inline: true,
            },
            {
              name: 'Threshold',
              value: String(payload.threshold),
              inline: true,
            },
          ],
          footer: {
            text: 'TribeHub Queue Monitor',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.error({
          event: 'discord_alert.send_failed',
          severity: payload.severity,
          queueName: payload.queueName,
          status: response.status,
        });
      } else {
        this.logger.log({
          event: 'discord_alert.sent',
          severity: payload.severity,
          queueName: payload.queueName,
          metric: payload.metric,
          currentValue: payload.currentValue,
          threshold: payload.threshold,
        });
      }
    } catch (err) {
      this.logger.error({
        event: 'discord_alert.send_error',
        severity: payload.severity,
        queueName: payload.queueName,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
