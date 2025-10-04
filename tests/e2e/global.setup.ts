import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { getAdminCookies } from './helpers/auth';

export default async function globalSetup(config: FullConfig) {
  // Ensure env vars from .env.local are available for cookie generation
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  const storageDir = path.resolve(__dirname, '.storage');
  const storagePath = path.join(storageDir, 'admin.json');
  fs.mkdirSync(storageDir, { recursive: true });

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });

  try {
    const cookies = await getAdminCookies();
    if (cookies && cookies.length > 0) {
      await context.addCookies(cookies);
      console.log('Global setup: admin cookies added to context.');
    } else {
      console.warn('Global setup: admin cookies missing; proceeding with empty storage state.');
    }
    await context.storageState({ path: storagePath });
    console.log(`Global setup: storage state saved to ${storagePath}`);
  } finally {
    await browser.close();
  }
}