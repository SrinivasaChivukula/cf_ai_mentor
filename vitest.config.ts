import { defineConfig } from 'vitest/config';

import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      'cloudflare:workers': path.resolve(__dirname, 'test/mocks/cloudflare-workers.ts'),
    },
  },
});
