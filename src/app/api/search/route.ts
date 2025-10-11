import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rateLimiter.js';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { handleValidationError, handleDatabaseError, ERROR_CODES, createErrorResponse } from '@/lib/errorHandler.js';
import { validateUserInput } from '@/lib/databaseValidation.js';

type WorkRow = { id: string; title: string; cover_url?: string | null; profiles?: { display_name: string | null } | null };
type ChapterRow = { id: string; title: string; slug: string; work_id: string | null; profiles?: { display_name: string | null } | null };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRateLimit('SEARCH')(async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);

    // Parámetros y validación
    const rawQ = searchParams.get('q') || '';
    const rawType = (searchParams.get('type') || 'all').toLowerCase();
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validar `type`
    const allowedTypes = new Set(['all', 'works', 'chapters', 'serialized']);
    if (!allowedTypes.has(rawType)) {
      return handleValidationError({
        field: 'type',
        type: 'INVALID_FORMAT',
        message: 'Tipo de búsqueda inválido',
        details: { allowed: Array.from(allowedTypes), provided: rawType }
      }, { endpoint: '/api/search' });
    }
    const type = rawType as 'all' | 'works' | 'chapters' | 'serialized';

    // Validar `q`
    // Tipar explícitamente el resultado de validación para TypeScript
    type InputValidationResult = {
      isValid: boolean;
      errors: Array<{ type: string; message: string }>;
      sanitized: string;
    };
    const qValidation = validateUserInput(rawQ, { required: false, minLength: 0, maxLength: 100, allowHtml: false }) as InputValidationResult;
    if (!qValidation.isValid) {
      return handleValidationError(
        qValidation.errors.map((e: { type: string; message: string }) => ({ field: 'q', ...e })),
        { endpoint: '/api/search' }
      );
    }
    const q = qValidation.sanitized;
    const like = q ? `%${q}%` : '%';

    // Validar `limit` y `offset`
    const defaultLimits = { works: 25, chapters: 50, serialized: 25 };
    let limit = defaultLimits[type === 'all' ? 'works' : type];
    if (limitParam !== null && limitParam !== undefined) {
      const parsed = Number(limitParam);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return handleValidationError({
          field: 'limit',
          type: 'INVALID_FORMAT',
          message: 'El parámetro limit debe ser un entero entre 1 y 100'
        }, { endpoint: '/api/search' });
      }
      limit = parsed;
    }

    let offset = 0;
    if (offsetParam !== null && offsetParam !== undefined) {
      const parsed = Number(offsetParam);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000) {
        return handleValidationError({
          field: 'offset',
          type: 'INVALID_FORMAT',
          message: 'El parámetro offset debe ser un entero entre 0 y 10000'
        }, { endpoint: '/api/search' });
      }
      offset = parsed;
    }

    const supabase = await createServerSupabaseClient();

    const result: { works?: WorkRow[]; chapters?: ChapterRow[]; serializedWorks?: WorkRow[] } = {};
    const counts: { works?: number; chapters?: number; serializedWorks?: number } = {};

    // Buscar obras
    if (type === 'all' || type === 'works') {
      const { data, error, count } = await supabase
        .from('works')
        .select('id, title, cover_url, profiles:works_author_id_fkey(display_name)', { count: 'exact' })
        .eq('status', 'published')
        .ilike('title', like)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        return handleDatabaseError(error, 'select', { table: 'works', endpoint: '/api/search', params: { q, type, limit, offset } });
      }
      result.works = (data as unknown as WorkRow[]) || [];
      counts.works = typeof count === 'number' ? count : (data?.length ?? 0);
    }

    // Buscar capítulos
    if (type === 'all' || type === 'chapters') {
      const { data, error, count } = await supabase
        .from('chapters')
        .select('id, title, slug, work_id, profiles:chapters_author_id_fkey(display_name)', { count: 'exact' })
        .eq('status', 'published')
        .ilike('title', like)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        return handleDatabaseError(error, 'select', { table: 'chapters', endpoint: '/api/search', params: { q, type, limit, offset } });
      }
      result.chapters = (data as unknown as ChapterRow[]) || [];
      counts.chapters = typeof count === 'number' ? count : (data?.length ?? 0);
    }

    // Buscar obras serializadas (obras con capítulos no independientes)
    if (type === 'all' || type === 'serialized') {
      const { data: chRows, error: chError } = await supabase
        .from('chapters')
        .select('work_id')
        .eq('is_independent', false)
        .not('work_id', 'is', null)
        .limit(1000);
      if (chError) {
        return handleDatabaseError(chError, 'select', { table: 'chapters', endpoint: '/api/search', params: { q, type, limit, offset } });
      }
      const ids = Array.from(new Set(((chRows as Array<{ work_id: string | null }> | null) || []).map((c) => c.work_id))).filter(Boolean) as string[];
      if (ids.length) {
        const { data, error, count } = await supabase
          .from('works')
          .select('id, title, cover_url, profiles:works_author_id_fkey(display_name)', { count: 'exact' })
          .eq('status', 'published')
          .in('id', ids)
          .ilike('title', like)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) {
          return handleDatabaseError(error, 'select', { table: 'works', endpoint: '/api/search', params: { q, type, limit, offset } });
        }
        result.serializedWorks = (data as unknown as WorkRow[]) || [];
        counts.serializedWorks = typeof count === 'number' ? count : (data?.length ?? 0);
      } else {
        result.serializedWorks = [];
        counts.serializedWorks = 0;
      }
    }

    return NextResponse.json({ success: true, q, type, limit, offset, data: result, counts }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error interno del servidor',
      process.env.NODE_ENV === 'development' ? { originalError: msg } : undefined
    );
  }
});