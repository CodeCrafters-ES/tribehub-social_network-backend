// src/admin/queues/bullboard.module.ts
//
// Wires BullBoard into the NestJS application.
//
// Responsibilities:
//   1. Creates a BullMQAdapter for the default queue.
//   2. Builds the BullBoard ExpressAdapter and registers it as a provider
//      so that main.ts can retrieve it and mount the router at /admin/queues.
//
// Security:
//   The actual HTTP protection is enforced in main.ts via JwtAdminGuard
//   applied as Express middleware before the BullBoard router.
//
// Access:
//   Inject BULLBOARD_ADAPTER token to retrieve the configured ExpressAdapter.

import { Module } from '@nestjs/common';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queues.constants';
import { getRedisConnection } from '../../queues/redis.connection';

export const BULLBOARD_ADAPTER = Symbol('BULLBOARD_ADAPTER');

@Module({
  providers: [
    {
      provide: BULLBOARD_ADAPTER,
      useFactory: (): ExpressAdapter => {
        const queue = new Queue(QUEUE_NAMES.DEFAULT, {
          connection: getRedisConnection(),
        });

        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');

        createBullBoard({
          queues: [new BullMQAdapter(queue)],
          serverAdapter,
        });

        return serverAdapter;
      },
    },
  ],
  exports: [BULLBOARD_ADAPTER],
})
export class BullboardModule {}
