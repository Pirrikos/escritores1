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

async function setupStoragePolicies() {
  try {
    console.log('🔐 Configurando políticas de seguridad para el bucket "works"...');
    
    // Política 1: Solo usuarios autenticados pueden subir archivos
    const uploadPolicy = `
      CREATE POLICY "Authenticated users can upload files" ON storage.objects
      FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND 
        bucket_id = 'works'
      );
    `;
    
    // Política 2: Solo el propietario puede ver sus archivos
    const selectPolicy = `
      CREATE POLICY "Users can view own files" ON storage.objects
      FOR SELECT USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'works'
      );
    `;
    
    // Política 3: Solo el propietario puede actualizar sus archivos
    const updatePolicy = `
      CREATE POLICY "Users can update own files" ON storage.objects
      FOR UPDATE USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'works'
      );
    `;
    
    // Política 4: Solo el propietario puede eliminar sus archivos
    const deletePolicy = `
      CREATE POLICY "Users can delete own files" ON storage.objects
      FOR DELETE USING (
        auth.uid()::text = (storage.foldername(name))[1] AND
        bucket_id = 'works'
      );
    `;
    
    console.log('📝 Políticas de seguridad creadas:');
    console.log('✅ Upload: Solo usuarios autenticados');
    console.log('✅ View: Solo el propietario del archivo');
    console.log('✅ Update: Solo el propietario del archivo');
    console.log('✅ Delete: Solo el propietario del archivo');
    
    console.log('\n🔧 Para aplicar estas políticas, ejecuta estos comandos en tu SQL Editor de Supabase:');
    console.log('\n-- Habilitar RLS en storage.objects');
    console.log('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;');
    console.log('\n-- Políticas de seguridad');
    console.log(uploadPolicy);
    console.log(selectPolicy);
    console.log(updatePolicy);
    console.log(deletePolicy);
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

setupStoragePolicies();