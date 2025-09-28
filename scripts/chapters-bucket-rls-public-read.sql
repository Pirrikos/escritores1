-- ====================================
-- POLÍTICAS RLS PARA BUCKET CHAPTERS
-- Ejecutar desde el SQL Editor del Dashboard de Supabase
-- Configuración: Lectura pública, eliminación solo del propietario
-- ====================================

-- PASO 1: Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "chapters_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_owner_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_owner_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_owner_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "chapters_upload_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "chapters_select_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "chapters_update_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "chapters_delete_policy_2024" ON storage.objects;

-- PASO 2: Crear nuevas políticas RLS para chapters

-- Política de UPLOAD - Solo propietario puede subir archivos a su carpeta
CREATE POLICY "chapters_owner_upload_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de SELECT - Todos los usuarios autenticados pueden leer cualquier archivo
CREATE POLICY "chapters_public_read_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chapters');

-- Política de UPDATE - Solo propietario puede actualizar sus archivos
CREATE POLICY "chapters_owner_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de DELETE - Solo propietario puede eliminar sus archivos
CREATE POLICY "chapters_owner_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- PASO 3: Verificar que las políticas se crearon correctamente
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%chapters%'
ORDER BY policyname;

-- ====================================
-- INSTRUCCIONES DE USO:
-- 1. Ve al Dashboard de Supabase
-- 2. Navega a SQL Editor
-- 3. Copia y pega este código completo
-- 4. Ejecuta el script
-- 5. Verifica que aparezcan 4 políticas para 'chapters'
-- ====================================

-- RESUMEN DE LA CONFIGURACIÓN:
-- ✅ Usuarios autenticados: PUEDEN leer/descargar todos los archivos del bucket chapters
-- ✅ Solo propietarios: PUEDEN subir/actualizar/eliminar sus propios archivos
-- ✅ Estructura de archivos: /chapters/{user_id}/archivo.ext