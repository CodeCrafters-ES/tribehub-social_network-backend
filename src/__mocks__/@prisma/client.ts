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
  $connect = () => Promise.resolve();
  $disconnect = () => Promise.resolve();
};
