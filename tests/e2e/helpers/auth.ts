import { createClient } from '@supabase/supabase-js';
import type { Cookie } from '@playwright/test';

export async function getAdminCookies(): Promise<Cookie[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const email = process.env.TEST_ADMIN_EMAIL as string;
  const password = process.env.TEST_ADMIN_PASSWORD as string;

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
    return null;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return null;
  }

  const { access_token, refresh_token } = data.session;

  const base = process.env.BASE_URL || 'http://localhost:3000';
  let hostname = 'localhost';
  let secure = false;
  try {
    const parsed = new URL(base);
    hostname = parsed.hostname; // evita incluir puerto
    secure = parsed.protocol === 'https:';
  } catch {
    // fallback
    hostname = base.replace(/^https?:\/\//, '').split(':')[0];
    secure = base.startsWith('https://');
  }

  const cookies: Cookie[] = [
    // Cookies para compatibilidad con distintas versiones de helpers
    {
      name: 'sb:token',
      value: access_token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
    },
    {
      name: 'sb:refresh-token',
      value: refresh_token || '',
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
    },
    {
      name: 'sb-access-token',
      value: access_token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
    },
    {
      name: 'sb-refresh-token',
      value: refresh_token || '',
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
    },
  ];

  return cookies;
}