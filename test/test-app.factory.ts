/**
 * test/test-app.factory.ts
 *
 * Shared helper that wraps NestJS Test.createTestingModule with the overrides
 * required to prevent real Redis/BullMQ connections during integration tests.
 *
 * WHY THIS IS NEEDED
 * ------------------
 * QueueService instantiates a BullMQ Queue (and therefore an ioredis client)
 * directly in its constructor via buildRedisClient(). DefaultWorker does the
 * same in onModuleInit(). When NestJS bootstraps AppModule in a test
 * environment that has no Redis, ioredis immediately tries to open a TCP
 * connection to localhost:6379, fails with ECONNREFUSED, and emits an
 * unhandled rejection — even though the actual test assertions pass.
 *
 * APPROACH
 * --------
 * We stub QueueService, DefaultWorker, and QueueMonitorService with no-op
 * values. BullboardModule imports QueuesModule and injects QueueService to
 * build its ExpressAdapter, so we also stub the BULLBOARD_ADAPTER token to
 * avoid that dependency chain reaching real ioredis.
 *
 * Callers can chain additional .overrideProvider() calls on the returned
 * TestingModuleBuilder before calling .compile().
 */

// Environment stubs (REDIS_URL, SUPABASE_*) are guaranteed to be present by
// the time this module is loaded because vitest.integration.config.ts lists
// test/setup-integration.ts in setupFiles, which runs before any test file.

import { vi } from 'vitest';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { QueueService } from './../src/queues/queue.service';
import { DefaultWorker } from './../src/queues/workers/default.worker';
import { QueueMonitorService } from './../src/queues/alerts/queue-monitor.service';
import { BULLBOARD_ADAPTER } from './../src/admin/queues/bullboard.module';

/**
 * Returns a pre-configured TestingModuleBuilder with AppModule loaded and
 * all Redis-backed providers replaced by no-op stubs.
 *
 * Usage:
 *   const builder = createTestAppBuilder();
 *   // optionally chain more overrides, e.g.:
 *   //   .overrideProvider(MyService).useValue(mockMyService)
 *   const moduleRef = await builder.compile();
 */
export function createTestAppBuilder(): TestingModuleBuilder {
  // Minimal stub that satisfies the QueueService interface used by
  // QueueMonitorService and BullboardModule (getWaitingCount / getFailedCount /
  // queue property) without opening any TCP connection.
  const queueServiceStub = {
    queue: {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      removeAllListeners: vi.fn(),
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getFailedCount: vi.fn().mockResolvedValue(0),
      add: vi.fn().mockResolvedValue({ id: 'stub-job-id' }),
    },
    enqueueSendWelcomeEmail: vi.fn().mockResolvedValue('stub-job-id'),
    enqueueProcessImage: vi.fn().mockResolvedValue('stub-job-id'),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getFailedCount: vi.fn().mockResolvedValue(0),
    onModuleDestroy: vi.fn().mockResolvedValue(undefined),
    onApplicationShutdown: vi.fn().mockResolvedValue(undefined),
  };

  // Minimal stub for DefaultWorker — no BullMQ Worker is created.
  const defaultWorkerStub = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn().mockResolvedValue(undefined),
    onApplicationShutdown: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  // Minimal stub for QueueMonitorService — no timers, no Redis calls.
  const queueMonitorStub = {
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    runCheck: vi.fn().mockResolvedValue(undefined),
  };

  // Stub Express adapter returned by BullboardModule so that its useFactory
  // never reaches QueueService (and therefore never touches ioredis).
  const bullboardAdapterStub = {
    getRouter: vi
      .fn()
      .mockReturnValue((_req: unknown, _res: unknown, next: () => void) =>
        next(),
      ),
  };

  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(QueueService)
    .useValue(queueServiceStub)
    .overrideProvider(DefaultWorker)
    .useValue(defaultWorkerStub)
    .overrideProvider(QueueMonitorService)
    .useValue(queueMonitorStub)
    .overrideProvider(BULLBOARD_ADAPTER)
    .useValue(bullboardAdapterStub);
}
