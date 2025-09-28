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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no encontradas');
  console.log('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupChaptersTablePolicies() {
  console.log('🔐 Configurando políticas RLS para la tabla "chapters"...');

  try {
    // Habilitar RLS en la tabla chapters
    const enableRLS = await supabase.rpc('sql', {
      query: 'ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;'
    });

    if (enableRLS.error) {
      console.log('⚠️  RLS ya está habilitado o error:', enableRLS.error.message);
    } else {
      console.log('✅ RLS habilitado en la tabla chapters');
    }

    // Política para INSERT - Solo usuarios autenticados pueden insertar capítulos
    const insertPolicy = `
      CREATE POLICY "Authenticated users can insert chapters" ON chapters
      FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
      );
    `;

    // Política para SELECT - Los usuarios pueden ver sus propios capítulos
    const selectPolicy = `
      CREATE POLICY "Users can view own chapters" ON chapters
      FOR SELECT USING (
        auth.uid() = user_id
      );
    `;

    // Política para UPDATE - Los usuarios pueden actualizar sus propios capítulos
    const updatePolicy = `
      CREATE POLICY "Users can update own chapters" ON chapters
      FOR UPDATE USING (
        auth.uid() = user_id
      );
    `;

    // Política para DELETE - Los usuarios pueden eliminar sus propios capítulos
    const deletePolicy = `
      CREATE POLICY "Users can delete own chapters" ON chapters
      FOR DELETE USING (
        auth.uid() = user_id
      );
    `;

    const policies = [
      { name: 'INSERT', query: insertPolicy },
      { name: 'SELECT', query: selectPolicy },
      { name: 'UPDATE', query: updatePolicy },
      { name: 'DELETE', query: deletePolicy }
    ];

    console.log('\n📝 Aplicando políticas de seguridad para la tabla chapters:');

    for (const policy of policies) {
      try {
        const result = await supabase.rpc('sql', { query: policy.query });
        if (result.error) {
          if (result.error.message.includes('already exists')) {
            console.log(`⚠️  Política ${policy.name} ya existe`);
          } else {
            console.error(`❌ Error aplicando política ${policy.name}:`, result.error.message);
          }
        } else {
          console.log(`✅ Política ${policy.name} aplicada correctamente`);
        }
      } catch (error) {
        console.error(`❌ Error aplicando política ${policy.name}:`, error.message);
      }
    }

    console.log('\n🎉 Configuración de políticas RLS completada para la tabla chapters');
    console.log('\n💡 Nota: Asegúrate de que la columna "user_id" existe en la tabla chapters');
    console.log('   y que se está asignando correctamente al insertar nuevos capítulos.');

  } catch (error) {
    console.error('❌ Error configurando políticas RLS:', error.message);
  }
}

// Ejecutar la configuración
setupChaptersTablePolicies();