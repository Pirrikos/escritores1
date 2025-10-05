# RLS para el bucket `works` (Supabase Storage)

Este documento define las políticas de Row Level Security (RLS) para el bucket privado `works`, permitiendo que usuarios autenticados gestionen únicamente sus propios archivos. El patrón de rutas requerido es que el primer directorio del `name` del objeto sea el `auth.uid()` del usuario.

## Principios
- Bucket `works` es privado.
- Todas las operaciones (INSERT, SELECT, UPDATE, DELETE) se restringen por:
  - `bucket_id = 'works'`.
  - Primer folder del `name` del objeto coincide con `auth.uid()`.
- Los paths deben tener la forma: ``<user_id>/<slug-o-nombre>/archivo.pdf``.

## Políticas SQL
Las políticas se agregan vía migración en `supabase/migrations/20250203000030_works_bucket_rls_policies.sql`.

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "works_upload_policy_2025" ON storage.objects;
DROP POLICY IF EXISTS "works_select_policy_2025" ON storage.objects;
DROP POLICY IF EXISTS "works_update_policy_2025" ON storage.objects;
DROP POLICY IF EXISTS "works_delete_policy_2025" ON storage.objects;

CREATE POLICY "works_upload_policy_2025"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'works' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "works_select_policy_2025"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'works' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "works_update_policy_2025"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'works' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "works_delete_policy_2025"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'works' AND (storage.foldername(name))[1] = auth.uid()::text
);
```

## Aplicación
- Opción A (CLI): si usas Supabase CLI, aplica la migración normalmente.
- Opción B (Studio): copia el contenido del archivo SQL en el editor de SQL de Supabase y ejecútalo.

## Verificación
1. Subida desde frontend (`src/app/upload/works/page.jsx`):
   - Usa `supabase.storage.from('works').upload(workPath, file, ...)`.
   - Asegúrate de que `workPath` empiece por tu `session.user.id`.
2. Endpoint de depuración: `GET /api/storage/debug-list?bucket=works&prefix=<tu_user_id>` debería listar los objetos nuevos.
3. Generación de signed URL (`/api/storage/signed-url`): al existir el archivo, debería generar URL sin 404.

## Troubleshooting
- 403 al subir: revisa que el primer folder del `name` sea tu `user_id`.
- 404 al leer: confirma que el objeto existe en `works` con el prefijo correcto.
- Bucket vacío: verifica que `mode=buckets` en `/api/storage/debug-list` incluya `works`.