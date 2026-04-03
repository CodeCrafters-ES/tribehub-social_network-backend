// src/queues/queue.service.ts
//
// Producer — enqueues jobs onto the default queue.
//
// Default job options applied to every job:
//   - attempts: 3
//   - backoff: exponential (base 1000 ms)
//   - removeOnComplete: keep last 100 for debugging
//   - removeOnFail: false — failed jobs remain visible in BullBoard for inspection

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
  private readonly queue: Queue;

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
        removeOnFail: false,
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
