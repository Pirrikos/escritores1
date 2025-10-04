import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

export default async function globalSetup() {
  // Ensure env vars from .env.local are available for cookie generation
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  const storageDir = path.resolve(__dirname, '.storage');
  const storagePath = path.join(storageDir, 'admin.json');
  fs.mkdirSync(storageDir, { recursive: true });

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });

  try {
    // Ensure test admin user exists (using service role key if available)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const email = process.env.TEST_ADMIN_EMAIL as string;
    const password = process.env.TEST_ADMIN_PASSWORD as string;

    if (supabaseUrl && serviceKey && email && password) {
      try {
        const serviceClient = createClient(supabaseUrl, serviceKey);
        // Try to find user; if not found, create it
        const { data: listUsers } = await serviceClient.auth.admin.listUsers();
        const existingUser = listUsers?.users?.find(u => u.email === email) || null;
        if (!existingUser) {
          const { error: createErr } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { created_by: 'playwright:e2e' },
          });
          if (createErr) {
            console.warn('Global setup: could not create test user:', createErr.message);
          } else {
            console.log('Global setup: created test admin user.');
          }
        } else {
          // Force reset password to ensure sign-in succeeds
          const { error: updateErr } = await serviceClient.auth.admin.updateUserById(existingUser.id, {
            password,
            email_confirm: true,
          } as any);
          if (updateErr) {
            console.warn('Global setup: could not update test user password:', updateErr.message);
          } else {
            console.log('Global setup: ensured test admin user password is up-to-date.');
          }
        }
      } catch (e) {
        console.warn('Global setup: could not ensure test user exists:', (e as Error).message);
      }
    }

    // Intentar iniciar sesión y construir cookies directamente
    let signedInUserId: string | null = null;
    let signedInEmail: string | null = null;
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    try {
      if (supabaseUrl && anonKey && email && password) {
        const anonClient = createClient(supabaseUrl, anonKey);
        const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email, password });
        if (signInError) {
          console.warn('Global setup: signIn error:', signInError.message);
        }
        if (signInData?.session) {
          signedInUserId = signInData.user?.id ?? null;
          signedInEmail = signInData.user?.email ?? email;
          const { access_token, refresh_token } = signInData.session;
          accessToken = access_token;
          refreshToken = refresh_token ?? null;

          const base = process.env.BASE_URL || 'http://localhost:3000';
          const { hostname, protocol } = new URL(base);
          const secure = protocol === 'https:';
          const cookies = [
            { name: 'sb-access-token', value: access_token, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
            { name: 'sb-refresh-token', value: refresh_token || '', domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
            { name: 'sb:token', value: access_token, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
            { name: 'sb:refresh-token', value: refresh_token || '', domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
          ];
          await context.addCookies(cookies);
          const page = await context.newPage();
          await page.goto(base);
          await page.close();
          console.log('Global setup: admin cookies added to context via sign-in.');
        } else {
          console.warn('Global setup: no session returned from signInWithPassword.');
        }
      } else {
        console.warn('Global setup: missing env for signIn (URL/ANON/EMAIL/PASSWORD).');
      }
    } catch (e) {
      console.warn('Global setup: unexpected error during sign-in:', (e as Error).message);
    }

    // Si obtuvimos tokens, escribir directamente el storageState para asegurar cookies
    try {
      if (accessToken) {
        const base = process.env.BASE_URL || 'http://localhost:3000';
        const { hostname, protocol } = new URL(base);
        const secure = protocol === 'https:';
        const cookieObjects = [
          { name: 'sb-access-token', value: accessToken, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
          { name: 'sb-refresh-token', value: refreshToken || '', domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
          { name: 'sb:token', value: accessToken, domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
          { name: 'sb:refresh-token', value: refreshToken || '', domain: hostname, path: '/', httpOnly: true, sameSite: 'Lax' as const, secure },
        ];
        const storage = { cookies: cookieObjects, origins: [] as any[] };
        fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2));
        console.log('Global setup: storageState written directly to admin.json');
      }
    } catch (e) {
      console.warn('Global setup: failed writing storageState file:', (e as Error).message);
    }

    // Ensure the test admin user has role=admin in profiles (using service role key)

    if (supabaseUrl && anonKey && serviceKey && email && password) {
      try {
        const userId = signedInUserId;
        const effectiveEmail = signedInEmail || email;
        if (userId) {
          const serviceClient = createClient(supabaseUrl, serviceKey);
          const displayName = (effectiveEmail || '').split('@')[0] || 'Usuario';
          const { error: upsertError } = await serviceClient
            .from('profiles')
            .upsert({ id: userId, display_name: displayName, role: 'admin' }, { onConflict: 'id' });
          if (upsertError) {
            console.warn('Global setup: could not set admin role:', upsertError.message);
          } else {
            console.log('Global setup: ensured admin role in profiles for test user.');
          }
        } else {
          console.warn('Global setup: could not obtain user id for admin role setup.');
        }
      } catch (e) {
        console.warn('Global setup: error ensuring admin role:', (e as Error).message);
      }
    } else {
      console.warn('Global setup: missing env vars to ensure admin role (skipping).');
    }
    // Persist cookies from context as storage state
    await context.storageState({ path: storagePath });
    console.log(`Global setup: storage state saved to ${storagePath}`);
  } finally {
    await browser.close();
  }
}