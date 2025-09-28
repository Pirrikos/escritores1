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

async function addUserIdColumn() {
  console.log('🔧 Agregando columna user_id a la tabla chapters...\n');

  try {
    // Paso 1: Agregar la columna user_id (nullable inicialmente)
    console.log('1️⃣ Agregando columna user_id...');
    const { data: addColumn, error: addError } = await supabase
      .from('chapters')
      .select('id')
      .limit(1);

    if (addError) {
      console.log('❌ Error verificando tabla:', addError.message);
      return;
    }

    console.log('✅ Tabla chapters existe');

    // Generar SQL para agregar la columna
    console.log('\n📝 Ejecuta estos comandos SQL en tu Supabase Dashboard → SQL Editor:\n');

    console.log('-- 1. Agregar columna user_id (nullable inicialmente)');
    console.log('ALTER TABLE chapters ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;\n');

    console.log('-- 2. Migrar datos existentes de author_id a user_id');
    console.log('UPDATE chapters SET user_id = author_id WHERE user_id IS NULL;\n');

    console.log('-- 3. Hacer la columna user_id NOT NULL');
    console.log('ALTER TABLE chapters ALTER COLUMN user_id SET NOT NULL;\n');

    console.log('-- 4. Agregar índice para performance');
    console.log('CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);\n');

    console.log('-- 5. Eliminar políticas RLS existentes que usan author_id');
    console.log('DROP POLICY IF EXISTS "Users can read published chapters and own chapters" ON chapters;');
    console.log('DROP POLICY IF EXISTS "Users can insert own chapters" ON chapters;');
    console.log('DROP POLICY IF EXISTS "Users can update own chapters" ON chapters;');
    console.log('DROP POLICY IF EXISTS "Users can delete own chapters" ON chapters;\n');

    console.log('-- 6. Crear nuevas políticas RLS usando user_id');
    console.log('CREATE POLICY "Users can read published chapters and own chapters" ON chapters');
    console.log('  FOR SELECT USING (status = \'published\' OR user_id = auth.uid());\n');

    console.log('CREATE POLICY "Authenticated users can insert chapters" ON chapters');
    console.log('  FOR INSERT WITH CHECK (auth.role() = \'authenticated\');\n');

    console.log('CREATE POLICY "Users can update own chapters" ON chapters');
    console.log('  FOR UPDATE USING (user_id = auth.uid());\n');

    console.log('CREATE POLICY "Users can delete own chapters" ON chapters');
    console.log('  FOR DELETE USING (user_id = auth.uid());\n');

    console.log('-- 7. Verificar que las políticas se aplicaron correctamente');
    console.log('SELECT * FROM pg_policies WHERE tablename = \'chapters\';\n');

    console.log('✅ Comandos SQL generados correctamente');
    console.log('💡 Ejecuta estos comandos en orden en tu Supabase Dashboard');
    console.log('🔄 Después de ejecutarlos, la subida de capítulos funcionará correctamente');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addUserIdColumn();