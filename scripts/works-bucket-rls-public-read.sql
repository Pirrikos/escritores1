-- ====================================
-- POLÍTICAS RLS PARA BUCKET WORKS
-- Configuración: Lectura pública, eliminación solo del propietario
-- ====================================

-- PASO 1: Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "works_upload_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "works_select_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "works_update_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "works_delete_policy_2024" ON storage.objects;
DROP POLICY IF EXISTS "works_public_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "works_owner_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "works_owner_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "works_owner_delete_policy" ON storage.objects;

-- PASO 2: Habilitar RLS en storage.objects (si no está habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- PASO 3: Crear nuevas políticas RLS

-- Política de UPLOAD - Solo propietario puede subir archivos a su carpeta
CREATE POLICY "works_owner_upload_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'works' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de SELECT - Todos los usuarios autenticados pueden leer cualquier archivo
CREATE POLICY "works_public_read_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'works');

-- Política de UPDATE - Solo propietario puede actualizar sus archivos
CREATE POLICY "works_owner_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'works' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de DELETE - Solo propietario puede eliminar sus archivos
CREATE POLICY "works_owner_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'works' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- PASO 4: Verificar que las políticas se crearon correctamente
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%works%'
ORDER BY policyname;

-- ====================================
-- RESUMEN DE LA CONFIGURACIÓN:
-- ✅ Usuarios autenticados: PUEDEN leer/descargar todos los archivos del bucket works
-- ✅ Solo propietarios: PUEDEN subir/actualizar/eliminar sus propios archivos
-- ✅ Estructura de archivos: /works/{user_id}/archivo.ext
-- ====================================