#!/usr/bin/env node

/**
 * Script para agregar las columnas faltantes a la tabla works
 * Este script agrega: file_size, file_type, file_url
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Función simple para leer variables de entorno
function loadEnvVars() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: No se encontró el archivo .env.local');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return envVars;
}

const envVars = loadEnvVars();

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addMissingColumns() {
  console.log('🔧 Agregando columnas faltantes a la tabla works...\n');

  const columnsToAdd = [
    {
      name: 'file_size',
      type: 'bigint',
      comment: 'Size of the uploaded work file in bytes'
    },
    {
      name: 'file_type', 
      type: 'text',
      comment: 'MIME type of the uploaded work file (e.g., application/pdf, application/epub+zip)'
    },
    {
      name: 'file_url',
      type: 'text', 
      comment: 'URL or path to the uploaded work file in storage'
    }
  ];

  try {
    for (let i = 0; i < columnsToAdd.length; i++) {
      const column = columnsToAdd[i];
      console.log(`${i + 1}️⃣ Agregando columna ${column.name}...`);
      
      const sql = `
        ALTER TABLE public.works 
        ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};
        
        COMMENT ON COLUMN public.works.${column.name} IS '${column.comment}';
      `;

      const { error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        console.log(`❌ Error agregando columna ${column.name}:`, error.message);
        console.log('   Esto puede indicar que la columna ya existe o que se necesitan permisos especiales');
      } else {
        console.log(`✅ Columna ${column.name} procesada exitosamente`);
      }
    }

    // Verificar que podemos acceder a la tabla works con las nuevas columnas
    console.log('\n🔍 Verificando acceso a la tabla works con las nuevas columnas...');
    const { data: worksData, error: worksError } = await supabase
      .from('works')
      .select('id, title, file_size, file_type, file_url')
      .limit(1);

    if (worksError) {
      console.log('❌ Error accediendo a la tabla works:', worksError.message);
    } else {
      console.log('✅ Acceso a la tabla works exitoso');
      if (worksData && worksData.length > 0) {
        console.log('   Ejemplo de registro:', worksData[0]);
      } else {
        console.log('   La tabla está vacía');
      }
    }

    console.log('\n🎉 ¡Proceso completado! Las columnas deberían estar disponibles.');
    console.log('\n📝 Para aplicar los cambios definitivamente, ejecuta en Supabase Dashboard:');
    console.log(`
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS file_type text,
ADD COLUMN IF NOT EXISTS file_url text;

COMMENT ON COLUMN public.works.file_size IS 'Size of the uploaded work file in bytes';
COMMENT ON COLUMN public.works.file_type IS 'MIME type of the uploaded work file';
COMMENT ON COLUMN public.works.file_url IS 'URL or path to the uploaded work file in storage';
    `);

  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

// Ejecutar el script
addMissingColumns();