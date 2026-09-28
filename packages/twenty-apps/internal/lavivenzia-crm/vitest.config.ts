import path from 'node:path';
import { defineConfig } from 'vitest/config';

// `src/...` absolute-style imports are the house convention in twenty-apps.
// Mapped here directly rather than through vite-tsconfig-paths so the suite
// runs with only the monorepo root's node_modules present.
export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: { src: path.resolve(__dirname, './src') },
        },
        test: {
          name: 'unit',
          // `.tsx` too: the kit primitives are asserted by rendering them, so
          // their accessibility contract cannot be lost in a restyle.
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: { src: path.resolve(__dirname, './src') },
        },
        test: {
          name: 'integration',
          include: ['src/**/*.integration-test.ts'],
          environment: 'node',
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
