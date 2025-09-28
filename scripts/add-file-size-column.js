#!/usr/bin/env node

/**
 * Script para agregar la columna file_size a la tabla works
 * Este script se ejecuta directamente contra la base de datos de producción
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

async function addFileSizeColumn() {
  console.log('🔧 Agregando columna file_size a la tabla works...\n');

  try {
    // Intentar agregar la columna directamente usando SQL
    console.log('1️⃣ Agregando columna file_size usando SQL...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.works 
        ADD COLUMN IF NOT EXISTS file_size bigint;
        
        COMMENT ON COLUMN public.works.file_size IS 'Size of the uploaded work file in bytes';
      `
    });

    if (alterError) {
      console.log('❌ Error agregando columna:', alterError.message);
      
      // Si falla con exec_sql, intentar con una consulta directa
      console.log('\n🔄 Intentando método alternativo...');
      const { error: directError } = await supabase
        .from('works')
        .select('id')
        .limit(1);
        
      if (directError) {
        console.log('❌ Error accediendo a la tabla works:', directError.message);
        return;
      }
      
      console.log('✅ La tabla works es accesible, pero no se pudo agregar la columna');
      console.log('   Esto puede indicar que la columna ya existe o que se necesitan permisos especiales');
      return;
    }

    console.log('✅ Comando SQL ejecutado exitosamente');

    // Verificar que podemos acceder a la tabla works
    console.log('\n2️⃣ Verificando acceso a la tabla works...');
    const { data: worksData, error: worksError } = await supabase
      .from('works')
      .select('id, title, file_size')
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

    console.log('\n🎉 ¡Proceso completado! La columna file_size debería estar disponible.');

  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
}

// Ejecutar el script
addFileSizeColumn();