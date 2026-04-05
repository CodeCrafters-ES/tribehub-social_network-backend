// src/queues/queue.service.ts
//
// Producer — enqueues jobs onto the default queue.
//
// Default job options applied to every job:
//   - attempts: 3
//   - backoff: exponential (base 1000 ms)
//   - removeOnComplete: keep last 100 for debugging
//   - removeOnFail: keep last 500 for post-mortem inspection via BullBoard

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_TYPES, QUEUE_NAMES } from './queues.constants';
import { getRedisConnection } from './redis.connection';

export interface SendWelcomeEmailPayload {
  userId: string;
  requestId?: string;
}

export interface ProcessImagePayload {
  assetId: string;
  userId: string;
  requestId?: string;
}

type JobPayload = SendWelcomeEmailPayload | ProcessImagePayload;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  readonly queue: Queue;

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.DEFAULT, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { count: 100 },
        // Keep only the last 500 failed jobs for post-mortem inspection via
        // BullBoard. Without a cap, failed jobs accumulate in Redis and in
        // BullMQ's in-process state indefinitely, growing the Node.js heap.
        removeOnFail: { count: 500 },
      },
    });

    this.queue.on('error', (err: Error) => {
      this.logger.error({
        event: 'queue.error',
        queueName: QUEUE_NAMES.DEFAULT,
        message: err.message,
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.queue.removeAllListeners();
    await this.queue.close();
  }

  async enqueueSendWelcomeEmail(
    payload: SendWelcomeEmailPayload,
  ): Promise<string> {
    return this.enqueue(JOB_TYPES.EMAIL_SEND_WELCOME, payload);
  }

  async enqueueProcessImage(payload: ProcessImagePayload): Promise<string> {
    return this.enqueue(JOB_TYPES.MEDIA_PROCESS_IMAGE, payload);
  }

  /** Returns the number of jobs currently in the waiting state. */
  getWaitingCount(): Promise<number> {
    return this.queue.getWaitingCount();
  }

  /** Returns the number of jobs that have exhausted all retry attempts. */
  getFailedCount(): Promise<number> {
    return this.queue.getFailedCount();
  }

  private async enqueue(jobType: string, payload: JobPayload): Promise<string> {
    const job = await this.queue.add(jobType, payload);
    this.logger.log({
      event: 'queue.job_enqueued',
      jobId: job.id,
      queueName: QUEUE_NAMES.DEFAULT,
      jobType,
      requestId: 'requestId' in payload ? payload.requestId : undefined,
    });
    return job.id ?? '';
  }
}
