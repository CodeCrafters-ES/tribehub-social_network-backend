// src/queues/queue.service.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';

const {
  mockQueueAdd,
  mockQueueClose,
  mockQueueOn,
  mockQueueCtor,
  mockQueueRemoveAllListeners,
} = vi.hoisted(() => {
  const mockQueueAdd = vi.fn();
  const mockQueueClose = vi.fn().mockResolvedValue(undefined);
  const mockQueueOn = vi.fn();
  const mockQueueRemoveAllListeners = vi.fn();
  const mockQueueCtor = vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    on: mockQueueOn,
    removeAllListeners: mockQueueRemoveAllListeners,
  }));
  return {
    mockQueueAdd,
    mockQueueClose,
    mockQueueOn,
    mockQueueCtor,
    mockQueueRemoveAllListeners,
  };
});

vi.mock('bullmq', () => ({
  Queue: mockQueueCtor,
}));

vi.mock('./redis.connection', () => ({
  buildRedisClient: vi
    .fn()
    .mockReturnValue({ host: 'localhost', port: 6379 }),
}));

import { QueueService } from './queue.service';
import { QUEUE_NAMES, JOB_TYPES } from './queues.constants';

function buildService(): QueueService {
  return new QueueService();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueueAdd.mockResolvedValue({ id: 'test-job-id' });
  mockQueueCtor.mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
    on: mockQueueOn,
    removeAllListeners: mockQueueRemoveAllListeners,
  }));
});

describe('QueueService.enqueueSendWelcomeEmail', () => {
  it('enqueues a job with the correct type and payload', async () => {
    const service = buildService();
    const payload = { userId: 'user-uuid-1', requestId: 'req-123' };

    const jobId = await service.enqueueSendWelcomeEmail(payload);

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      JOB_TYPES.EMAIL_SEND_WELCOME,
      payload,
    );
    expect(jobId).toBe('test-job-id');
  });

  it('enqueues a job without requestId', async () => {
    const service = buildService();
    const payload = { userId: 'user-uuid-2' };

    await service.enqueueSendWelcomeEmail(payload);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      JOB_TYPES.EMAIL_SEND_WELCOME,
      payload,
    );
  });

  it('returns empty string when job.id is undefined', async () => {
    mockQueueAdd.mockResolvedValue({ id: undefined });
    const service = buildService();

    const jobId = await service.enqueueSendWelcomeEmail({ userId: 'u1' });

    expect(jobId).toBe('');
  });
});

describe('QueueService.enqueueProcessImage', () => {
  it('enqueues a job with the correct type and payload', async () => {
    const service = buildService();
    const payload = {
      assetId: 'asset-uuid',
      userId: 'user-uuid',
      requestId: 'req-456',
    };

    const jobId = await service.enqueueProcessImage(payload);

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      JOB_TYPES.MEDIA_PROCESS_IMAGE,
      payload,
    );
    expect(jobId).toBe('test-job-id');
  });
});

describe('QueueService.onModuleDestroy', () => {
  it('closes the queue on destroy', async () => {
    const service = buildService();
    await service.onModuleDestroy();
    expect(mockQueueClose).toHaveBeenCalledOnce();
  });
});

describe('QueueService — queue setup', () => {
  it('creates the queue with the default queue name and correct options', () => {
    buildService();
    expect(mockQueueCtor).toHaveBeenCalledWith(
      QUEUE_NAMES.DEFAULT,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          removeOnFail: { count: 500 },
        }),
      }),
    );
  });
});
