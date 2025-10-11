import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Limit test discovery to our unit test folders
    include: [
      'src/lib/__tests__/**/*.ts',
      'src/lib/__tests__/**/*.tsx',
      'src/app/api/**/__tests__/**/*.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});