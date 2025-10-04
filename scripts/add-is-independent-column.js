const { createClient } = require('@supabase/supabase-js');

// Usar las variables de entorno directamente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addIsIndependentColumn() {
  try {
    console.log('Checking if is_independent column exists...');
    
    // Check if column exists
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'chapters' 
          AND column_name = 'is_independent'
        `
      });

    if (checkError) {
      console.error('Error checking column:', checkError);
      
      // Try alternative method using direct SQL
      console.log('Trying to add column directly...');
      
      const { error } = await supabase
        .rpc('exec_sql', {
          sql: `
            DO $$ 
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'chapters' 
                AND column_name = 'is_independent'
              ) THEN
                ALTER TABLE public.chapters ADD COLUMN is_independent boolean DEFAULT false;
                RAISE NOTICE 'Column is_independent added successfully';
              ELSE
                RAISE NOTICE 'Column is_independent already exists';
              END IF;
            END $$;
          `
        });

      if (error) {
        console.error('Error adding column:', error);
        return;
      }
      
      console.log('Column operation completed');
      return;
    }

    if (columns && columns.length > 0) {
      console.log('Column is_independent already exists');
      return;
    }

    console.log('Adding is_independent column...');
    
    const { error } = await supabase
      .rpc('exec_sql', {
        sql: 'ALTER TABLE public.chapters ADD COLUMN is_independent boolean DEFAULT false;'
      });

    if (error) {
      console.error('Error adding column:', error);
      return;
    }

    console.log('Column is_independent added successfully');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addIsIndependentColumn();