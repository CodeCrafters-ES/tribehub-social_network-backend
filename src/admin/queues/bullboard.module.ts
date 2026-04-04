// src/admin/queues/bullboard.module.ts
//
// Wires BullBoard into the NestJS application.
//
// Responsibilities:
//   1. Creates a BullMQAdapter for the default queue.
//   2. Builds the BullBoard ExpressAdapter and registers it as a provider
//      so that main.ts can retrieve it and mount the router at /admin/queues.
//   3. Closes the internally-created Queue on module destroy so that the
//      underlying IORedis connection is released (prevents memory/fd leak).
//
// Security:
//   The actual HTTP protection is enforced in main.ts via JwtAdminGuard
//   applied as Express middleware before the BullBoard router.
//
// Access:
//   Inject BULLBOARD_ADAPTER token to retrieve the configured ExpressAdapter.

import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queues.constants';
import { getRedisConnection } from '../../queues/redis.connection';

export const BULLBOARD_ADAPTER = Symbol('BULLBOARD_ADAPTER');

// Separate injectable that owns the Queue lifetime so that onModuleDestroy
// can close it. The useFactory pattern alone cannot implement lifecycle hooks.

@Injectable()
class BullboardQueueHolder implements OnModuleDestroy {
  readonly queue: Queue;

  constructor() {
    this.queue = new Queue(QUEUE_NAMES.DEFAULT, {
      connection: getRedisConnection(),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

@Module({
  providers: [
    BullboardQueueHolder,
    {
      provide: BULLBOARD_ADAPTER,
      useFactory: (holder: BullboardQueueHolder): ExpressAdapter => {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');

        createBullBoard({
          queues: [new BullMQAdapter(holder.queue)],
          serverAdapter,
        });

        return serverAdapter;
      },
      inject: [BullboardQueueHolder],
    },
  ],
  exports: [BULLBOARD_ADAPTER],
})
export class BullboardModule {}
