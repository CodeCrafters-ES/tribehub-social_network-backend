// src/queues/queues.constants.ts
//
// Central registry of queue names and job type strings.
// Import from here instead of using raw string literals to avoid typos.

export const QUEUE_NAMES = {
  DEFAULT: 'jobs',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_TYPES = {
  EMAIL_SEND_WELCOME: 'email.sendWelcome',
  MEDIA_PROCESS_IMAGE: 'media.processImage',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
