import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'googleusercontent.com',
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get('u');
    if (!u) {
      return new Response('Missing u param', { status: 400 });
    }

    let remote: URL;
    try {
      remote = new URL(u);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    // Basic whitelist to prevent open proxy abuse
    const host = remote.hostname.toLowerCase();
    const allowed = ALLOWED_HOSTS.has(host) || host.endsWith('.googleusercontent.com');
    if (!allowed) {
      return new Response('Host not allowed', { status: 403 });
    }

    const res = await fetch(remote.toString(), {
      // No need for special mode; this runs server-side
      headers: {
        // Some providers require a UA
        'User-Agent': 'Mozilla/5.0 (Avatar Proxy)'
      },
    });

    if (!res.ok) {
      return new Response(`Upstream error ${res.status}`, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const cacheControl = 'public, max-age=86400'; // 1 day
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (e) {
    return new Response('Proxy error', { status: 500 });
  }
}