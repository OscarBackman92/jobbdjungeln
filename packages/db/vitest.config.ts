import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // PGlite spins up a real Postgres per suite; give it room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
