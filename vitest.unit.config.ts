import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      // Prisma Client uses package.json subpath exports (#main-entry-point) which
      // are not supported by Vitest's module resolver. We redirect the import to a
      // manual mock that exposes the same surface used in unit tests.
      '@prisma/client': path.resolve(__dirname, 'src/__mocks__/@prisma/client.ts'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
