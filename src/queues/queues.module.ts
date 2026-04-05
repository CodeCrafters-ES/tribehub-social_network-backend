// src/queues/queues.module.ts
//
// QueuesModule wires BullMQ for the entire application.
//
// Exports QueueService so any module that needs to enqueue jobs can import
// QueuesModule and inject QueueService without knowing about the underlying
// queue infrastructure.
//
// DiscordAlertService is provided and exported by ObservabilityModule.
// Importing ObservabilityModule here makes DiscordAlertService available to
// QueueMonitorService without registering a duplicate provider instance.

import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DefaultWorker } from './workers/default.worker';
import { QueueMonitorService } from './alerts/queue-monitor.service';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [ObservabilityModule],
  providers: [QueueService, DefaultWorker, QueueMonitorService],
  exports: [QueueService],
})
export class QueuesModule {}
