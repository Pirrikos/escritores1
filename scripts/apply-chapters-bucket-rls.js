console.log(`
🔐 APLICANDO POLÍTICAS RLS AL BUCKET CHAPTERS
============================================

Ejecuta estos comandos SQL en el SQL Editor de Supabase:

-- PASO 1: Verificar que el bucket chapters existe
SELECT name, id, public FROM storage.buckets WHERE name = 'chapters';

-- PASO 2: Verificar políticas existentes en storage.objects para chapters
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%chapters%'
ORDER BY policyname;

-- PASO 3: Habilitar RLS en storage.objects (si no está habilitado)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- PASO 4: Crear políticas RLS para el bucket chapters

-- Política de UPLOAD (INSERT) - Solo usuarios autenticados pueden subir archivos a su carpeta
CREATE POLICY "chapters_upload_policy_2024" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de SELECT (READ) - Los usuarios solo pueden ver sus propios archivos
CREATE POLICY "chapters_select_policy_2024" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de UPDATE - Los usuarios solo pueden actualizar sus propios archivos
CREATE POLICY "chapters_update_policy_2024" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política de DELETE - Los usuarios solo pueden eliminar sus propios archivos
CREATE POLICY "chapters_delete_policy_2024" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'chapters' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- PASO 5: Verificar que las políticas se crearon correctamente
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%chapters%'
ORDER BY policyname;

============================================

EXPLICACIÓN DE LAS POLÍTICAS:
✅ UPLOAD: Solo usuarios autenticados pueden subir archivos a chapters/{user_id}/
✅ SELECT: Los usuarios solo pueden ver archivos en chapters/{user_id}/
✅ UPDATE: Los usuarios solo pueden actualizar archivos en chapters/{user_id}/
✅ DELETE: Los usuarios solo pueden eliminar archivos en chapters/{user_id}/

ESTRUCTURA DE ARCHIVOS ESPERADA:
- chapters/{user_id}/archivo.docx
- chapters/{user_id}/portada.jpg

NOTAS IMPORTANTES:
• El bucket 'chapters' debe ser PRIVADO (public = false)
• Los archivos se organizan por carpetas de usuario UUID
• Solo el propietario puede acceder a sus archivos
• Las políticas usan (storage.foldername(name))[1] para obtener el primer nivel de carpeta

`);

console.log('✅ Comandos SQL para aplicar RLS al bucket chapters generados.');
console.log('📋 Ejecuta estos comandos paso a paso en el SQL Editor de Supabase.');
console.log('🔍 Después de ejecutar, verifica que las 4 políticas se hayan creado correctamente.');