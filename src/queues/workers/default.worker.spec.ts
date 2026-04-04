// src/queues/workers/default.worker.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;

vi.mock('bullmq', () => ({
  Worker: vi
    .fn()
    .mockImplementation(
      (_name: string, processor: (job: unknown) => Promise<void>) => {
        capturedProcessor = processor;
        return {
          on: mockWorkerOn,
          close: mockWorkerClose,
        };
      },
    ),
}));

vi.mock('../redis.connection', () => ({
  getRedisConnection: vi
    .fn()
    .mockReturnValue({ host: 'localhost', port: 6379 }),
}));

import { DefaultWorker } from './default.worker';
import { QUEUE_NAMES, JOB_TYPES } from '../queues.constants';

function buildWorker(): DefaultWorker {
  const worker = new DefaultWorker();
  worker.onModuleInit();
  return worker;
}

function makeJob(name: string, data: Record<string, unknown>) {
  return {
    id: 'job-id-1',
    name,
    data,
    opts: { attempts: 3 },
    attemptsMade: 0,
    processedOn: Date.now() - 50,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedProcessor = null;
});

describe('DefaultWorker.onModuleInit', () => {
  it('starts the worker with the default queue name', async () => {
    const { Worker } = await import('bullmq');
    buildWorker();
    expect(Worker).toHaveBeenCalledWith(
      QUEUE_NAMES.DEFAULT,
      expect.any(Function),
      expect.objectContaining({ concurrency: 5 }),
    );
  });

  it('registers completed, failed, stalled, and error listeners', () => {
    buildWorker();
    const eventNames = mockWorkerOn.mock.calls.map((call) => call[0] as string);
    expect(eventNames).toContain('completed');
    expect(eventNames).toContain('failed');
    expect(eventNames).toContain('stalled');
    expect(eventNames).toContain('error');
  });
});

describe('DefaultWorker.onModuleDestroy', () => {
  it('closes the worker', async () => {
    const worker = buildWorker();
    await worker.onModuleDestroy();
    expect(mockWorkerClose).toHaveBeenCalledOnce();
  });

  it('does not throw if called before onModuleInit', async () => {
    const worker = new DefaultWorker();
    await expect(worker.onModuleDestroy()).resolves.not.toThrow();
  });
});

describe('DefaultWorker — job processing', () => {
  it('processes email.sendWelcome without throwing', async () => {
    buildWorker();
    const job = makeJob(JOB_TYPES.EMAIL_SEND_WELCOME, {
      userId: 'user-1',
      requestId: 'req-abc',
    });
    await expect(capturedProcessor!(job)).resolves.not.toThrow();
  });

  it('processes media.processImage without throwing', async () => {
    buildWorker();
    const job = makeJob(JOB_TYPES.MEDIA_PROCESS_IMAGE, {
      assetId: 'asset-1',
      userId: 'user-2',
      requestId: 'req-xyz',
    });
    await expect(capturedProcessor!(job)).resolves.not.toThrow();
  });

  it('handles unknown job type without throwing', async () => {
    buildWorker();
    const job = makeJob('unknown.job', { requestId: 'req-999' });
    await expect(capturedProcessor!(job)).resolves.not.toThrow();
  });
});
