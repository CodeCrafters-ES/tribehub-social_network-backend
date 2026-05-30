// src/__mocks__/@prisma/client.ts
// Vitest mock for @prisma/client to avoid native module issues in unit tests.

export const PrismaClient = class {
  user = {};
  profile = {};
  post = {};
  comment = {};
  reaction = {};
  asset = {};
  interest = {};
  userInterest = {};
  refreshToken = {};
  systemConfig = {};
  deleteAccountRequest = {};
  $connect = () => Promise.resolve();
  $disconnect = () => Promise.resolve();
};

// Runtime enum values. The real Prisma 7 client can't be loaded in unit tests,
// so mirror the schema enums that application code reads at runtime. Prisma 7
// exposes enum values under `$Enums` (and also at the package root).
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;

export const $Enums = {
  UserStatus,
};

// `Prisma.TransactionClient` is a type-only symbol in the real client; the
// namespace object is exported here so value-position references don't break.
export const Prisma = {} as Record<string, unknown>;
