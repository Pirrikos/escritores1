import { NextResponse } from 'next/server';
import { generateSlug } from '@/lib/slugUtils';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    const usernameParam = searchParams.get('username');
    const usernameIlikeParam = searchParams.get('username_ilike');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100) : 30;

    const supabase = await createServerSupabaseClient();

    // Utilidades de normalización para coincidencias flexibles
    const collapseRepeats = (s: string) => s.replace(/([a-z0-9])\1+/g, '$1');
    const normalizeUsernameTerm = (s: string) => (s || '').toLowerCase().trim();
    const normalizeNameLike = (s: string) => (s || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Buscar por username exacto
    if (usernameParam) {
      const term = normalizeUsernameTerm(usernameParam);
      const altUnderscore = term.replace(/-/g, '_');
      const altHyphen = term.replace(/_/g, '-');

      // Try with username column (RLS-aware)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .eq('username', term)
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json({ data }, { status: 200 });
      }
      // Fallback con cliente de servicio (bypass RLS) por username exacto
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          const { data: adminExact } = await admin
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .eq('username', term)
            .limit(1);
          if (Array.isArray(adminExact) && adminExact.length > 0) {
            return NextResponse.json({ data: adminExact }, { status: 200 });
          }
        }
      } catch {}

      // Intento alternativo: mapear guiones ↔ guiones bajos
      if (altUnderscore !== term) {
        const { data: dataAltU } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, username')
          .eq('username', altUnderscore)
          .limit(1);
        if (Array.isArray(dataAltU) && dataAltU.length > 0) {
          return NextResponse.json({ data: dataAltU }, { status: 200 });
        }
        try {
          const admin = getSupabaseAdmin();
          if (admin) {
            const { data: adminAltU } = await admin
              .from('profiles')
              .select('id, display_name, avatar_url, username')
              .eq('username', altUnderscore)
              .limit(1);
            if (Array.isArray(adminAltU) && adminAltU.length > 0) {
              return NextResponse.json({ data: adminAltU }, { status: 200 });
            }
          }
        } catch {}
      }

      if (altHyphen !== term) {
        const { data: dataAltH } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, username')
          .eq('username', altHyphen)
          .limit(1);
        if (Array.isArray(dataAltH) && dataAltH.length > 0) {
          return NextResponse.json({ data: dataAltH }, { status: 200 });
        }
        try {
          const admin = getSupabaseAdmin();
          if (admin) {
            const { data: adminAltH } = await admin
              .from('profiles')
              .select('id, display_name, avatar_url, username')
              .eq('username', altHyphen)
              .limit(1);
            if (Array.isArray(adminAltH) && adminAltH.length > 0) {
              return NextResponse.json({ data: adminAltH }, { status: 200 });
            }
          }
        } catch {}
      }

      // Fallback: buscar por display_name comparando por slug (RLS-aware)
      // No usamos ilike previo para evitar falsos negativos por tildes o letras repetidas
      const { data: rows, error: err2 } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .limit(500);
      const targetSlug = term.replace(/_/g, '-');
      const targetCollapsed = collapseRepeats(targetSlug);
      let match = (rows || []).find((row: any) => {
        const s = generateSlug(row?.display_name || '');
        return s === targetSlug || collapseRepeats(s) === targetCollapsed;
      });
      // Fallback con cliente de servicio (bypass RLS) para display_name
      if (!match) {
        try {
          const admin = getSupabaseAdmin();
          if (admin) {
            const { data: adminRows } = await admin
              .from('profiles')
              .select('id, display_name, avatar_url')
              .limit(500);
            match = (adminRows || []).find((row: any) => {
              const s = generateSlug(row?.display_name || '');
              return s === targetSlug || collapseRepeats(s) === targetCollapsed;
            }) || undefined;
          }
        } catch {}
      }
      return NextResponse.json({ data: match ? [match] : [] }, { status: 200 });
    }

    // Buscar por username case-insensitive
    if (usernameIlikeParam) {
      const term = normalizeUsernameTerm(usernameIlikeParam);
      const altUnderscore = term.replace(/-/g, '_');
      const altHyphen = term.replace(/_/g, '-');

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .ilike('username', term)
        .limit(1);
      if (!error && Array.isArray(data) && data.length > 0) {
        return NextResponse.json({ data }, { status: 200 });
      }
      // Fallback con cliente de servicio (bypass RLS) por username ilike
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          const { data: adminIlike } = await admin
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .ilike('username', term)
            .limit(1);
          if (Array.isArray(adminIlike) && adminIlike.length > 0) {
            return NextResponse.json({ data: adminIlike }, { status: 200 });
          }
        }
      } catch {}

      // Intento alternativo ilike: mapear guiones ↔ guiones bajos
      const { data: altDataU } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .ilike('username', altUnderscore)
        .limit(1);
      if (Array.isArray(altDataU) && altDataU.length > 0) {
        return NextResponse.json({ data: altDataU }, { status: 200 });
      }
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          const { data: adminAltIlikeU } = await admin
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .ilike('username', altUnderscore)
            .limit(1);
          if (Array.isArray(adminAltIlikeU) && adminAltIlikeU.length > 0) {
            return NextResponse.json({ data: adminAltIlikeU }, { status: 200 });
          }
        }
      } catch {}

      const { data: altDataH } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .ilike('username', altHyphen)
        .limit(1);
      if (Array.isArray(altDataH) && altDataH.length > 0) {
        return NextResponse.json({ data: altDataH }, { status: 200 });
      }
      try {
        const admin = getSupabaseAdmin();
        if (admin) {
          const { data: adminAltIlikeH } = await admin
            .from('profiles')
            .select('id, display_name, avatar_url, username')
            .ilike('username', altHyphen)
            .limit(1);
          if (Array.isArray(adminAltIlikeH) && adminAltIlikeH.length > 0) {
            return NextResponse.json({ data: adminAltIlikeH }, { status: 200 });
          }
        }
      } catch {}

      // Fallback: usar display_name y comparar slug (sin ilike previo)
      const { data: rows } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .limit(500);
      const targetSlug = term.replace(/_/g, '-');
      const targetCollapsed = collapseRepeats(targetSlug);
      let match = (rows || []).find((row: any) => {
        const s = generateSlug(row?.display_name || '');
        return s === targetSlug || collapseRepeats(s) === targetCollapsed;
      });
      if (!match) {
        try {
          const admin = getSupabaseAdmin();
          if (admin) {
            const { data: adminRows } = await admin
              .from('profiles')
              .select('id, display_name, avatar_url')
              .limit(500);
            match = (adminRows || []).find((row: any) => {
              const s = generateSlug(row?.display_name || '');
              return s === targetSlug || collapseRepeats(s) === targetCollapsed;
            }) || undefined;
          }
        } catch {}
      }
      return NextResponse.json({ data: match ? [match] : [] }, { status: 200 });
    }

    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (ids.length === 0) {
        return NextResponse.json({ data: [] }, { status: 200 });
      }
      // Try with username column, fallback without it (RLS-aware)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, username')
        .in('id', ids)
        .order('display_name', { ascending: true });
      if (error) {
        const { data: alt, error: err2 } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids)
          .order('display_name', { ascending: true });
        if (err2) return NextResponse.json({ error: 'db_error' }, { status: 500 });
        return NextResponse.json({ data: alt || [] }, { status: 200 });
      }
      // Si la consulta RLS devuelve vacío, intentar con cliente de servicio
      if (Array.isArray(data) && data.length === 0) {
        try {
          const admin = getSupabaseAdmin();
          if (admin) {
            const { data: adminData } = await admin
              .from('profiles')
              .select('id, display_name, avatar_url, username')
              .in('id', ids)
              .order('display_name', { ascending: true });
            return NextResponse.json({ data: adminData || [] }, { status: 200 });
          }
        } catch {}
      }
      return NextResponse.json({ data: data || [] }, { status: 200 });
    }

    // General listing
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .order('display_name', { ascending: true })
      .limit(limit);
    if (error) {
      const { data: alt, error: err2 } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .order('display_name', { ascending: true })
        .limit(limit);
      if (err2) return NextResponse.json({ error: 'db_error' }, { status: 500 });
      return NextResponse.json({ data: alt || [] }, { status: 200 });
    }
    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}