import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const setupFile = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url));
const sharedEntry = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [setupFile],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  },
  resolve: {
    alias: {
      '@agentspaces/shared': sharedEntry
    }
  }
});
