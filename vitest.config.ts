import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
      '**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/tests/**', // Exclude Python test directory
      '**/coverage/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'tests/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/vitest.setup.ts'
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})