import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import ensureAdmin (now supports dependency injection)
let ensureAdmin: any;

// Helper to create a mock Supabase client with chainable query methods
function makeClient(options: {
  user?: any;
  authError?: any;
  profileRole?: string | null;
}) {
  const { user, authError, profileRole } = options;
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: profileRole ? { role: profileRole } : null }),
        }),
      }),
    }),
  } as any;
}

// Minimal request mock with headers.get
function makeRequest(cookie: string = ''): any {
  return { headers: { get: (k: string) => (k.toLowerCase() === 'cookie' ? cookie : '') } } as any;
}

// No module mocks needed; we inject dependencies directly into ensureAdmin

describe('ensureAdmin', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    ensureAdmin = (await import('../adminAuth.server.js')).ensureAdmin;
  });

  it('returns ok=true when anon query confirms admin role', async () => {
    const user = { id: 'u1', email: 'admin@test.local' };
    const routeClient = makeClient({ user, profileRole: 'admin' });
    const res = await ensureAdmin(makeRequest(), {
      createServerSupabaseClient: async () => routeClient,
      getSupabaseServiceClient: () => null,
    });
    expect(res.ok).toBe(true);
    expect(res.user?.id).toBe('u1');
    expect(res.profile?.role).toBe('admin');
  });

  it('falls back to service role when RLS blocks anon query', async () => {
    const user = { id: 'u2', email: 'admin@test.local' };
    const routeClient = makeClient({ user, profileRole: null });
    const serviceClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
          }),
        }),
      }),
    } as any;

    const res = await ensureAdmin(makeRequest(), {
      createServerSupabaseClient: async () => routeClient,
      getSupabaseServiceClient: () => serviceClient,
    });
    expect(res.ok).toBe(true);
    expect(res.profile?.role).toBe('admin');
  });

  it('returns unauthorized when no user session', async () => {
    const routeClient = makeClient({ user: null, authError: new Error('no session'), profileRole: null });
    const res = await ensureAdmin(makeRequest(), {
      createServerSupabaseClient: async () => routeClient,
      getSupabaseServiceClient: () => null,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED');
    expect(res.status).toBe(401);
  });

  it('returns forbidden when user is not admin after fallback', async () => {
    const user = { id: 'u3', email: 'user@test.local' };
    const routeClient = makeClient({ user, profileRole: 'user' });
    const serviceClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'user' } }),
          }),
        }),
      }),
    } as any;

    const res = await ensureAdmin(makeRequest(), {
      createServerSupabaseClient: async () => routeClient,
      getSupabaseServiceClient: () => serviceClient,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('FORBIDDEN');
    expect(res.status).toBe(403);
  });
});