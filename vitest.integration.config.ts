import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // Runs before any test file is loaded so that process.env stubs are in
    // place before NestJS modules evaluate process.env at import time.
    setupFiles: ['test/setup-integration.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
