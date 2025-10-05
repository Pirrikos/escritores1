export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withErrorHandling, createErrorResponse, ERROR_CODES } from '@/lib/errorHandler.js';

export const GET = withErrorHandling(async (request) => {
  try {
    const url = new URL(request.url);
    const bucket = url.searchParams.get('bucket') || 'works';
    const prefix = url.searchParams.get('prefix') || '';
    const mode = url.searchParams.get('mode') || 'objects';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (mode === 'buckets') {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      if (error) {
        return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Error listando buckets', { message: error.message });
      }
      try { console.log('[debug-list] buckets:', (buckets || []).map(b => b.name)); } catch {}
      return NextResponse.json({ success: true, buckets: buckets || [] });
    } else {
      // Listar objetos bajo el prefijo indicado
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
      try {
        console.log('[debug-list] bucket:', bucket, 'prefix:', prefix, 'count:', (data || []).length, 'names:', (data || []).map(o => o.name));
      } catch {}
      if (error) {
        return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Error listando storage', { bucket, prefix, message: error.message });
      }

      return NextResponse.json({ success: true, bucket, prefix, objects: data || [] });
    }
  } catch (e) {
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'Error inesperado en debug-list', { message: e.message });
  }
});