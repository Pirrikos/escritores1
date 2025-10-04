import { defineConfig } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local for Playwright workers
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: [['list'], ['html']],
  globalSetup: './tests/e2e/global.setup.ts',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: './tests/e2e/.storage/admin.json',
  },
  // Run tests in parallel by default
  fullyParallel: true,
});