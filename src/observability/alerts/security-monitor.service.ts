import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscordAlertService } from '../../queues/alerts/discord-alert.service';

const DEFAULT_INTERVAL_MS = 60_000;
const WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_BRUTE_FORCE_THRESHOLD = 10;
const DEFAULT_INVALID_TOKEN_THRESHOLD = 50;

@Injectable()
export class SecurityMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecurityMonitorService.name);
  private readonly intervalMs: number;
  private readonly bruteForceThreshold: number;
  private readonly invalidTokenThreshold: number;
  private readonly failedLoginTimestamps: number[] = [];
  private readonly invalidTokenTimestamps: number[] = [];
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly discordAlertService: DiscordAlertService) {
    this.intervalMs =
      parseInt(process.env.SECURITY_MONITOR_INTERVAL_MS ?? '', 10) ||
      DEFAULT_INTERVAL_MS;

    this.bruteForceThreshold =
      parseInt(process.env.SECURITY_ALERT_BRUTE_FORCE_THRESHOLD ?? '', 10) ||
      DEFAULT_BRUTE_FORCE_THRESHOLD;

    this.invalidTokenThreshold =
      parseInt(process.env.SECURITY_ALERT_INVALID_TOKEN_THRESHOLD ?? '', 10) ||
      DEFAULT_INVALID_TOKEN_THRESHOLD;
  }

  onModuleInit(): void {
    this.scheduleCheck();
  }

  onModuleDestroy(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  recordFailedLogin(): void {
    this.failedLoginTimestamps.push(Date.now());
  }

  recordInvalidToken(): void {
    this.invalidTokenTimestamps.push(Date.now());
  }

  private scheduleCheck(): void {
    this.timeoutHandle = setTimeout(() => {
      void this.runCheck().then(() => {
        this.scheduleCheck();
      });
    }, this.intervalMs);
  }

  async runCheck(): Promise<void> {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    this.pruneTimestamps(this.failedLoginTimestamps, cutoff);
    this.pruneTimestamps(this.invalidTokenTimestamps, cutoff);

    const failedLoginCount = this.failedLoginTimestamps.length;
    const invalidTokenCount = this.invalidTokenTimestamps.length;

    this.logger.log({
      event: 'security_monitor.check',
      failedLoginCount,
      invalidTokenCount,
      bruteForceThreshold: this.bruteForceThreshold,
      invalidTokenThreshold: this.invalidTokenThreshold,
    });

    if (failedLoginCount > this.bruteForceThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_SECURITY,
        {
          queueName: 'security',
          metric: 'brute_force_login',
          currentValue: failedLoginCount,
          threshold: this.bruteForceThreshold,
          severity: 'security',
        },
      );
    }

    if (invalidTokenCount > this.invalidTokenThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_SECURITY,
        {
          queueName: 'security',
          metric: 'invalid_token',
          currentValue: invalidTokenCount,
          threshold: this.invalidTokenThreshold,
          severity: 'security',
        },
      );
    }
  }

  private pruneTimestamps(list: number[], cutoff: number): void {
    let i = 0;
    while (i < list.length && list[i] < cutoff) {
      i++;
    }
    list.splice(0, i);
  }
}
