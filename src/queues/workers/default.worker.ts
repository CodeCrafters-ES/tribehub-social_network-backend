// src/queues/workers/default.worker.ts
//
// Worker that processes jobs from the default queue.
//
// Configuration:
//   - concurrency: 5 (process up to 5 jobs simultaneously)
//   - DLQ strategy: Option A — failed jobs remain in the "failed" set after
//     exhausting retries, visible for inspection in BullBoard.
//
// Lifecycle listeners are registered for completed, failed, and stalled jobs
// so that every state transition is observable in structured logs.

import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { JOB_TYPES, QUEUE_NAMES } from '../queues.constants';
import { buildRedisClient } from '../redis.connection';
import type {
  SendWelcomeEmailPayload,
  ProcessImagePayload,
} from '../queue.service';

const WORKER_CONCURRENCY = 5;

@Injectable()
export class DefaultWorker
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(DefaultWorker.name);
  private worker: Worker | null = null;

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.DEFAULT,
      (job: Job) => this.process(job),
      {
        connection: buildRedisClient(),
        concurrency: WORKER_CONCURRENCY,
      },
    );

    this.worker.on('completed', (job: Job) => {
      this.logger.log({
        event: 'worker.job_completed',
        jobId: job.id,
        queueName: QUEUE_NAMES.DEFAULT,
        jobType: job.name,
        durationMs: job.processedOn ? Date.now() - job.processedOn : undefined,
        requestId: this.extractRequestId(job),
      });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.logger.error({
        event: 'worker.job_failed',
        jobId: job?.id,
        queueName: QUEUE_NAMES.DEFAULT,
        jobType: job?.name,
        attemptsMade: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts,
        error: err.message,
        requestId: job ? this.extractRequestId(job) : undefined,
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      this.logger.warn({
        event: 'worker.job_stalled',
        jobId,
        queueName: QUEUE_NAMES.DEFAULT,
      });
    });

    this.worker.on('error', (err: Error) => {
      this.logger.error({
        event: 'worker.error',
        queueName: QUEUE_NAMES.DEFAULT,
        message: err.message,
      });
    });

    this.logger.log({
      event: 'worker.started',
      queueName: QUEUE_NAMES.DEFAULT,
      concurrency: WORKER_CONCURRENCY,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  /**
   * Called when the application is shutting down. This runs BEFORE
   * Redis connections are closed, ensuring the worker closes gracefully
   * without triggering "Connection is closed" errors.
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log({
      event: 'worker.shutdown',
      queueName: QUEUE_NAMES.DEFAULT,
    });
    await this.close();
  }

  /** Closes the worker gracefully. Use this in tests to prevent teardown errors. */
  async close(): Promise<void> {
    if (this.worker) {
      this.worker.removeAllListeners();
      await this.worker.close();
      this.worker = null;
    }
  }

  private async process(job: Job): Promise<void> {
    const startMs = Date.now();

    this.logger.log({
      event: 'worker.job_started',
      jobId: job.id,
      queueName: QUEUE_NAMES.DEFAULT,
      jobType: job.name,
      requestId: this.extractRequestId(job),
    });

    switch (job.name) {
      case JOB_TYPES.EMAIL_SEND_WELCOME:
        await this.handleSendWelcomeEmail(job as Job<SendWelcomeEmailPayload>);
        break;
      case JOB_TYPES.MEDIA_PROCESS_IMAGE:
        await this.handleProcessImage(job as Job<ProcessImagePayload>);
        break;
      default:
        this.logger.warn({
          event: 'worker.unknown_job_type',
          jobId: job.id,
          jobType: job.name,
        });
    }

    this.logger.log({
      event: 'worker.job_processed',
      jobId: job.id,
      queueName: QUEUE_NAMES.DEFAULT,
      jobType: job.name,
      durationMs: Date.now() - startMs,
      requestId: this.extractRequestId(job),
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async handleSendWelcomeEmail(
    job: Job<SendWelcomeEmailPayload>,
  ): Promise<void> {
    const { userId, requestId } = job.data;
    this.logger.log({
      event: 'worker.email_send_welcome',
      userId,
      requestId,
    });
    // Placeholder: real email dispatch will be wired here.
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async handleProcessImage(
    job: Job<ProcessImagePayload>,
  ): Promise<void> {
    const { assetId, userId, requestId } = job.data;
    this.logger.log({
      event: 'worker.media_process_image',
      assetId,
      userId,
      requestId,
    });
    // Placeholder: real image processing will be wired here.
  }

  private extractRequestId(job: Job): string | undefined {
    const data = job.data as { requestId?: string };
    return data?.requestId;
  }
}
