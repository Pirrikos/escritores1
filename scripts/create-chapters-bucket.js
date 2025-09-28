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

async function createChaptersBucket() {
  try {
    console.log('🔍 Verificando si el bucket "chapters" existe...');
    
    // Verificar buckets existentes
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error al listar buckets:', listError.message);
      return;
    }
    
    const chaptersBucket = buckets.find(b => b.name === 'chapters');
    
    if (chaptersBucket) {
      console.log('✅ El bucket "chapters" ya existe');
      return;
    }
    
    console.log('📦 Creando bucket "chapters"...');
    
    // Crear el bucket
    const { data, error } = await supabase.storage.createBucket('chapters', {
      public: false,
      allowedMimeTypes: [
        'application/pdf',
        'application/epub+zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
      ],
      fileSizeLimit: 52428800 // 50MB
    });
    
    if (error) {
      console.error('❌ Error al crear bucket "chapters":', error.message);
      return;
    }
    
    console.log('✅ Bucket "chapters" creado exitosamente');
    
    // Verificar que se creó correctamente
    const { data: updatedBuckets } = await supabase.storage.listBuckets();
    const newChaptersBucket = updatedBuckets.find(b => b.name === 'chapters');
    
    if (newChaptersBucket) {
      console.log('🎉 Confirmado: Bucket "chapters" está disponible');
      console.log(`   - Público: ${newChaptersBucket.public}`);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

createChaptersBucket();