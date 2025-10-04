const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Función para leer variables de entorno desde .env.local
function loadEnvVars() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envVars = {};
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
  } catch (error) {
    console.error('Error reading .env.local:', error.message);
  }
  
  return envVars;
}

async function addSlugColumn() {
  try {
    // Cargar variables de entorno
    const envVars = loadEnvVars();
    
    const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    }
    
    // Inicializar cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('Adding slug column to works table...');
    
    // Intentar agregar la columna slug
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.works ADD COLUMN IF NOT EXISTS slug text;'
    });
    
    if (addColumnError) {
      console.log('Note: Could not add slug column via RPC (permission limitation)');
      console.log('Error:', addColumnError.message);
    } else {
      console.log('✓ slug column added successfully');
    }
    
    // Intentar agregar comentario
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: "COMMENT ON COLUMN public.works.slug IS 'URL-friendly identifier generated from the work title';"
    });
    
    if (commentError) {
      console.log('Note: Could not add column comment via RPC');
    } else {
      console.log('✓ Column comment added successfully');
    }
    
    // Intentar crear índice
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works(slug);'
    });
    
    if (indexError) {
      console.log('Note: Could not create index via RPC');
    } else {
      console.log('✓ Index created successfully');
    }
    
    // Intentar agregar restricción única
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_works_slug' 
        AND table_name = 'works' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.works ADD CONSTRAINT unique_works_slug UNIQUE (slug);
    END IF;
END $$;`
    });
    
    if (constraintError) {
      console.log('Note: Could not add unique constraint via RPC');
    } else {
      console.log('✓ Unique constraint added successfully');
    }
    
    // Verificar acceso a la tabla works
    const { error } = await supabase
      .from('works')
      .select('id, title, slug')
      .limit(1);
    
    if (error) {
      console.log('❌ Error accessing works table:', error.message);
      if (error.message.includes("slug")) {
        console.log('\n🔧 Manual SQL to run in Supabase Dashboard:');
        console.log('ALTER TABLE public.works ADD COLUMN IF NOT EXISTS slug text;');
        console.log("COMMENT ON COLUMN public.works.slug IS 'URL-friendly identifier generated from the work title';");
        console.log('CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works(slug);');
        console.log(`DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_works_slug' 
        AND table_name = 'works' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.works ADD CONSTRAINT unique_works_slug UNIQUE (slug);
    END IF;
END $$;`);
      }
    } else {
      console.log('✓ Successfully verified access to works table with slug column');
      console.log('Column addition completed successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n🔧 Manual SQL to run in Supabase Dashboard:');
    console.log('ALTER TABLE public.works ADD COLUMN IF NOT EXISTS slug text;');
    console.log("COMMENT ON COLUMN public.works.slug IS 'URL-friendly identifier generated from the work title';");
    console.log('CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works(slug);');
    console.log(`DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_works_slug' 
        AND table_name = 'works' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.works ADD CONSTRAINT unique_works_slug UNIQUE (slug);
    END IF;
END $$;`);
  }
}

addSlugColumn();