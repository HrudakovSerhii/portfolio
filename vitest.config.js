import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test/**'
    ]
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
});