// Simple script to add is_independent column to chapters table
const { createClient } = require('@supabase/supabase-js');

async function addColumn() {
  // You need to set these environment variables or replace with actual values
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.log('Or run this SQL directly in your Supabase dashboard:');
    console.log('ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false;');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Try to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false;'
    });

    if (error) {
      console.error('Error:', error);
      console.log('\nTry running this SQL directly in your Supabase dashboard:');
      console.log('ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false;');
    } else {
      console.log('Column added successfully!');
    }
  } catch (err) {
    console.error('Error:', err);
    console.log('\nTry running this SQL directly in your Supabase dashboard:');
    console.log('ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false;');
  }
}

addColumn();