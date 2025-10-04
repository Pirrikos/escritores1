/**
 * Verifica autenticación y rol admin desde una petición Next.js (Route Handler)
 * @param {Request} request - Objeto Request de Next.js con cabeceras/cookies
 * @returns {Promise<{ok: boolean, user?: any, profile?: any, code?: string, status?: number, error?: Error}>}
 */
export async function ensureAdmin(request, deps = {}) {
  try {
    const createServerSupabaseClient = deps.createServerSupabaseClient 
      ? deps.createServerSupabaseClient 
      : (await import('./supabaseServer')).createServerSupabaseClient;
    const getSupabaseServiceClient = deps.getSupabaseServiceClient 
      ? deps.getSupabaseServiceClient 
      : (await import('./supabaseServer')).getSupabaseServiceClient;
    const supabase = await createServerSupabaseClient();

    // Obtener usuario
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Fallback: intentar extraer JWT desde cookie si falta sesión
    if ((!user || authError) && request?.headers?.get('cookie')) {
      try {
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)(sb-access-token|sb:token)=([^;]+)/i);
        const jwt = tokenMatch?.[2];
        if (jwt) {
          const result = await supabase.auth.getUser(jwt);
          user = result.data?.user || user;
          authError = result.error || undefined;
        }
      } catch {}
    }

    if (authError || !user) {
      return { ok: false, code: 'UNAUTHORIZED', status: 401, error: authError || new Error('No autenticado') };
    }

    // Verificar rol
    let { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Fallback con service role si RLS bloquea
    if ((!profile || profile.role !== 'admin') && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const serviceClient = getSupabaseServiceClient();
        if (serviceClient) {
          const { data: srvProfile } = await serviceClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (srvProfile) {
            profile = srvProfile;
          }
        }
      } catch {}
    }

    if (!profile || profile.role !== 'admin') {
      return { ok: false, code: 'FORBIDDEN', status: 403, user, profile };
    }

    return { ok: true, user, profile };
  } catch (e) {
    // Nunca propagar excepciones: tratar como no autenticado
    return { ok: false, code: 'UNAUTHORIZED', status: 401, error: e instanceof Error ? e : new Error('No autenticado') };
  }
}