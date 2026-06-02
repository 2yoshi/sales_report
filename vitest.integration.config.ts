import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/api/**/*.test.ts', 'tests/auth/**/*.test.ts', 'tests/security/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@db:5432/sales_report_test',
      JWT_SECRET: 'test-jwt-secret',
      NODE_ENV: 'test',
    },
    // Run all integration tests sequentially in a single process
    // to avoid Prisma connection pool exhaustion and DB race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
