const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyWorksRLSPolicies() {
  console.log('🔧 APLICANDO POLÍTICAS RLS PARA BUCKET WORKS');
  console.log('📋 Configuración: Lectura pública, eliminación solo del propietario');
  console.log('====================================\n');

  try {
    // Primero, eliminar políticas existentes si las hay
    console.log('🗑️ Eliminando políticas existentes...');
    
    const dropPolicies = [
      `DROP POLICY IF EXISTS "works_upload_policy_2024" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_select_policy_2024" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_update_policy_2024" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_delete_policy_2024" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_public_read_policy" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_owner_upload_policy" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_owner_update_policy" ON storage.objects;`,
      `DROP POLICY IF EXISTS "works_owner_delete_policy" ON storage.objects;`
    ];

    for (const policy of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error && !error.message.includes('does not exist')) {
        console.log(`⚠️ Error eliminando política: ${error.message}`);
      }
    }

    // Habilitar RLS en storage.objects
    console.log('🔒 Habilitando RLS en storage.objects...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;'
    });
    
    if (rlsError && !rlsError.message.includes('already enabled')) {
      console.log(`⚠️ Error habilitando RLS: ${rlsError.message}`);
    }

    // Crear nuevas políticas
    console.log('📝 Creando nuevas políticas RLS...\n');

    const policies = [
      {
        name: 'Política de UPLOAD - Solo propietario puede subir a su carpeta',
        sql: `
          CREATE POLICY "works_owner_upload_policy"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'works' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );`
      },
      {
        name: 'Política de SELECT - Todos los usuarios autenticados pueden leer',
        sql: `
          CREATE POLICY "works_public_read_policy"
          ON storage.objects FOR SELECT
          TO authenticated
          USING (bucket_id = 'works');`
      },
      {
        name: 'Política de UPDATE - Solo propietario puede actualizar sus archivos',
        sql: `
          CREATE POLICY "works_owner_update_policy"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'works' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );`
      },
      {
        name: 'Política de DELETE - Solo propietario puede eliminar sus archivos',
        sql: `
          CREATE POLICY "works_owner_delete_policy"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'works' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );`
      }
    ];

    for (const policy of policies) {
      console.log(`✅ ${policy.name}`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      
      if (error) {
        console.log(`❌ Error: ${error.message}\n`);
      } else {
        console.log(`✅ Creada exitosamente\n`);
      }
    }

    // Verificar políticas creadas
    console.log('🔍 Verificando políticas creadas...');
    const { data: policies_check, error: checkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT policyname, cmd, roles
        FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname LIKE '%works%'
        ORDER BY policyname;
      `
    });

    if (checkError) {
      console.log(`❌ Error verificando políticas: ${checkError.message}`);
    } else if (policies_check && policies_check.length > 0) {
      console.log('\n📊 POLÍTICAS ACTIVAS:');
      policies_check.forEach(policy => {
        console.log(`- ${policy.policyname}`);
      });
    }

    console.log('\n🎉 CONFIGURACIÓN COMPLETADA');
    console.log('====================================');
    console.log('✅ Usuarios autenticados: PUEDEN leer/descargar todos los archivos');
    console.log('✅ Solo propietarios: PUEDEN subir/actualizar/eliminar sus archivos');
    console.log('✅ Estructura: /works/{user_id}/archivo.ext');

  } catch (error) {
    console.error('❌ Error aplicando políticas RLS:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  applyWorksRLSPolicies()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { applyWorksRLSPolicies };