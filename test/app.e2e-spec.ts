import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { QueueService } from './../src/queues/queue.service';
import { DefaultWorker } from './../src/queues/workers/default.worker';
import { QueueMonitorService } from './../src/queues/alerts/queue-monitor.service';

// Keep Redis disabled in e2e. Queue providers are mocked below, and optional
// Redis-backed services should fall back without opening sockets.
delete process.env.REDIS_URL;

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
      })
      .overrideProvider(QueueService)
      .useValue({
        queue: {
          name: 'jobs',
          metaValues: { version: 'bullmq:5.0.0' },
        },
        enqueueSendWelcomeEmail: vi.fn(),
        enqueueProcessImage: vi.fn(),
        getWaitingCount: vi.fn().mockResolvedValue(0),
        getFailedCount: vi.fn().mockResolvedValue(0),
        onModuleDestroy: vi.fn(),
      })
      .overrideProvider(DefaultWorker)
      .useValue({
        onModuleInit: vi.fn(),
        onModuleDestroy: vi.fn(),
      })
      .overrideProvider(QueueMonitorService)
      .useValue({
        onModuleInit: vi.fn(),
        onModuleDestroy: vi.fn(),
        runCheck: vi.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
