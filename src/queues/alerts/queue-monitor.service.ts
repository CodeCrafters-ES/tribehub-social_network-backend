import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues.constants';
import { getRedisConnection } from '../redis.connection';
import { DiscordAlertService } from './discord-alert.service';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_WAITING_THRESHOLD = 50;
const DEFAULT_FAILED_THRESHOLD = 20;

@Injectable()
export class QueueMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMonitorService.name);
  private readonly queue: Queue;
  private readonly intervalMs: number;
  private readonly waitingThreshold: number;
  private readonly failedThreshold: number;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly discordAlertService: DiscordAlertService) {
    this.queue = new Queue(QUEUE_NAMES.DEFAULT, {
      connection: getRedisConnection(),
    });

    this.intervalMs =
      parseInt(process.env.QUEUE_MONITOR_INTERVAL_MS ?? '', 10) ||
      DEFAULT_INTERVAL_MS;

    this.waitingThreshold =
      parseInt(process.env.QUEUE_ALERT_WAITING_THRESHOLD ?? '', 10) ||
      DEFAULT_WAITING_THRESHOLD;

    this.failedThreshold =
      parseInt(process.env.QUEUE_ALERT_FAILED_THRESHOLD ?? '', 10) ||
      DEFAULT_FAILED_THRESHOLD;
  }

  onModuleInit(): void {
    this.scheduleCheck();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    await this.queue.close();
  }

  private scheduleCheck(): void {
    this.timeoutHandle = setTimeout(() => {
      void this.runCheck().then(() => {
        this.scheduleCheck();
      });
    }, this.intervalMs);
  }

  async runCheck(): Promise<void> {
    const [waitingCount, failedCount] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getFailedCount(),
    ]);

    this.logger.log({
      event: 'queue_monitor.check',
      queueName: QUEUE_NAMES.DEFAULT,
      waitingCount,
      failedCount,
      waitingThreshold: this.waitingThreshold,
      failedThreshold: this.failedThreshold,
    });

    if (failedCount > this.failedThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_CRITICAL,
        {
          queueName: QUEUE_NAMES.DEFAULT,
          metric: 'failed_jobs',
          currentValue: failedCount,
          threshold: this.failedThreshold,
          severity: 'critical',
        },
      );
    }

    if (waitingCount > this.waitingThreshold) {
      await this.discordAlertService.sendAlert(
        process.env.DISCORD_WEBHOOK_OPS,
        {
          queueName: QUEUE_NAMES.DEFAULT,
          metric: 'waiting_jobs',
          currentValue: waitingCount,
          threshold: this.waitingThreshold,
          severity: 'ops',
        },
      );
    }
  }
}
