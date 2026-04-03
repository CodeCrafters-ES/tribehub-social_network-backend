// src/queues/queues.module.ts
//
// QueuesModule wires BullMQ for the entire application.
//
// Exports QueueService so any module that needs to enqueue jobs can import
// QueuesModule and inject QueueService without knowing about the underlying
// queue infrastructure.

import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DefaultWorker } from './workers/default.worker';

@Module({
  providers: [QueueService, DefaultWorker],
  exports: [QueueService],
})
export class QueuesModule {}
