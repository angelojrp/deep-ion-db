import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.ts', 'server/src/**/*.ts', 'web/src/**/*.ts'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'out/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main/index.ts',
        'web/public/**'
      ],
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40
      }
    }
  }
})
