// vitest.smoke.config.ts
//
// Vitest configuration for the staging smoke test suite.
//
// Smoke tests run against a real remote deployment (not in-process NestJS),
// so they need extended timeouts. No SWC transform is required because the
// tests only use plain fetch + Vitest assertions — no NestJS / Prisma / ESM
// shim concerns.

import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config(); // loads .env into process.env

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/smoke/staging.smoke.test.ts'],
    // 60 seconds for the whole suite — remote deploys can be slow to cold-start.
    testTimeout: 60_000,
    // Sequential execution: avoid parallel requests to a cold staging instance.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      // Point to the project root for any potential path aliases.
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Use SWC to compile TypeScript — consistent with other Vitest configs in
  // this project so path handling and decorator support behave the same way.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
