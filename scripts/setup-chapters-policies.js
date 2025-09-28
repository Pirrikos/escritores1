const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno manualmente
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

async function setupChaptersPolicies() {
  try {
    console.log('🔐 Configurando políticas de seguridad para el bucket "chapters"...');
    
    // Política 1: Solo usuarios autenticados pueden subir archivos de capítulos
    const uploadPolicy = `
      CREATE POLICY "Authenticated users can upload chapter files" ON storage.objects
      FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        bucket_id = 'chapters'
      );
    `;
    
    // Política 2: Solo el propietario puede ver sus archivos de capítulos
    const selectPolicy = `
      CREATE POLICY "Users can view own chapter files" ON storage.objects
      FOR SELECT USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'chapters'
      );
    `;
    
    // Política 3: Solo el propietario puede actualizar sus archivos de capítulos
    const updatePolicy = `
      CREATE POLICY "Users can update own chapter files" ON storage.objects
      FOR UPDATE USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'chapters'
      );
    `;
    
    // Política 4: Solo el propietario puede eliminar sus archivos de capítulos
    const deletePolicy = `
      CREATE POLICY "Users can delete own chapter files" ON storage.objects
      FOR DELETE USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'chapters'
      );
    `;
    
    console.log('📝 Políticas de seguridad para capítulos creadas:');
    console.log('✅ Upload: Solo usuarios autenticados pueden subir capítulos');
    console.log('✅ View: Solo el propietario del capítulo');
    console.log('✅ Update: Solo el propietario del capítulo');
    console.log('✅ Delete: Solo el propietario del capítulo');
    
    console.log('\n🔧 Para aplicar estas políticas, ejecuta estos comandos en tu SQL Editor de Supabase:');
    console.log('\n-- Asegurar que RLS esté habilitado en storage.objects');
    console.log('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;');
    console.log('\n-- Políticas de seguridad para capítulos');
    console.log(uploadPolicy);
    console.log(selectPolicy);
    console.log(updatePolicy);
    console.log(deletePolicy);
    
    console.log('\n💡 Nota: Estas políticas asumen que los archivos se organizan en carpetas por usuario ID.');
    console.log('   Ejemplo de estructura: chapters/files/{user_id}/archivo.pdf');
    console.log('                         chapters/covers/{user_id}/portada.jpg');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

setupChaptersPolicies();