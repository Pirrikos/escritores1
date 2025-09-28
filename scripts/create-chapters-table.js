// Script to create chapters table directly in Supabase
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    envVars[key.trim()] = value.trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const createChaptersTableSQL = `
-- Migration: Create chapters table
-- This migration creates a dedicated chapters table to resolve the inconsistency
-- between the application code and database schema

-- Create chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_id uuid NOT NULL REFERENCES public.works(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL CHECK (length(trim(title)) > 0 AND length(title) <= 200),
    content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 100000),
    chapter_number integer NOT NULL CHECK (chapter_number > 0),
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Ensure unique chapter numbers per work
    UNIQUE(work_id, chapter_number)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chapters_work_id ON public.chapters(work_id);
CREATE INDEX IF NOT EXISTS idx_chapters_author_id ON public.chapters(author_id);
CREATE INDEX IF NOT EXISTS idx_chapters_published_at ON public.chapters(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(status);
CREATE INDEX IF NOT EXISTS idx_chapters_work_chapter ON public.chapters(work_id, chapter_number);

-- Enable RLS
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
`

const createPoliciesSQL = `
-- RLS Policies
-- Allow users to read published chapters and their own chapters
DROP POLICY IF EXISTS "Users can read published chapters and own chapters" ON public.chapters;
CREATE POLICY "Users can read published chapters and own chapters" ON public.chapters
    FOR SELECT USING (
        status = 'published' OR 
        author_id = auth.uid()
    );

-- Allow users to insert their own chapters
DROP POLICY IF EXISTS "Users can insert own chapters" ON public.chapters;
CREATE POLICY "Users can insert own chapters" ON public.chapters
    FOR INSERT WITH CHECK (author_id = auth.uid());

-- Allow users to update their own chapters
DROP POLICY IF EXISTS "Users can update own chapters" ON public.chapters;
CREATE POLICY "Users can update own chapters" ON public.chapters
    FOR UPDATE USING (author_id = auth.uid());

-- Allow users to delete their own chapters
DROP POLICY IF EXISTS "Users can delete own chapters" ON public.chapters;
CREATE POLICY "Users can delete own chapters" ON public.chapters
    FOR DELETE USING (author_id = auth.uid());
`

const createTriggersSQL = `
-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_chapters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapters_updated_at_trigger ON public.chapters;
CREATE TRIGGER update_chapters_updated_at_trigger
    BEFORE UPDATE ON public.chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_chapters_updated_at();

-- Add constraint to ensure published_at is set when status is published
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chapters_published_at_check'
    ) THEN
        ALTER TABLE public.chapters ADD CONSTRAINT chapters_published_at_check 
            CHECK (
                (status = 'published' AND published_at IS NOT NULL) OR 
                (status = 'draft')
            );
    END IF;
END $$;

-- Add validation for chapter content (similar to posts)
CREATE OR REPLACE FUNCTION validate_chapter_content()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for malicious content patterns
    IF NEW.content ~* '<script|javascript:|data:|vbscript:|onload|onerror|onclick' THEN
        RAISE EXCEPTION 'Chapter content contains potentially malicious patterns';
    END IF;
    
    -- Check for excessive HTML (basic validation)
    IF (length(NEW.content) - length(replace(NEW.content, '<', ''))) > 100 THEN
        RAISE EXCEPTION 'Chapter content contains excessive HTML markup';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_chapter_content_trigger ON public.chapters;
CREATE TRIGGER validate_chapter_content_trigger
    BEFORE INSERT OR UPDATE ON public.chapters
    FOR EACH ROW
    EXECUTE FUNCTION validate_chapter_content();
`

const createViewSQL = `
-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.chapters IS 'Stores book chapters with content, metadata, and publication status';
COMMENT ON COLUMN public.chapters.work_id IS 'Reference to the parent work/book';
COMMENT ON COLUMN public.chapters.author_id IS 'Reference to the chapter author (must match work author)';
COMMENT ON COLUMN public.chapters.title IS 'Chapter title (1-200 characters)';
COMMENT ON COLUMN public.chapters.content IS 'Chapter content (1-100,000 characters)';
COMMENT ON COLUMN public.chapters.chapter_number IS 'Sequential chapter number within the work';
COMMENT ON COLUMN public.chapters.status IS 'Publication status: draft or published';
COMMENT ON COLUMN public.chapters.published_at IS 'Timestamp when chapter was published';

-- Create a view for chapter statistics
CREATE OR REPLACE VIEW public.chapter_statistics AS
SELECT 
    author_id,
    COUNT(*) as total_chapters,
    COUNT(*) FILTER (WHERE status = 'published') as published_chapters,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_chapters,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as chapters_last_24h,
    MAX(created_at) as last_chapter_date
FROM public.chapters
GROUP BY author_id;

-- Grant select on the view
GRANT SELECT ON public.chapter_statistics TO authenticated;
`

async function createChaptersTable() {
  console.log('🚀 Creando tabla chapters en Supabase...')
  
  try {
    // Check if table already exists
    console.log('🔍 Verificando si la tabla ya existe...')
    const { data: existingTable, error: checkError } = await supabase
      .from('chapters')
      .select('count', { count: 'exact', head: true })
    
    if (!checkError) {
      console.log('✅ La tabla chapters ya existe!')
      console.log(`📊 Capítulos actuales: ${existingTable?.length || 0}`)
      return
    }

    // If table doesn't exist, we need to create it via SQL Editor
    console.log('❌ La tabla chapters no existe en Supabase')
    console.log('')
    console.log('📝 Para crear la tabla, necesitas:')
    console.log('1. Ir a tu proyecto en https://supabase.com')
    console.log('2. Abrir el SQL Editor')
    console.log('3. Ejecutar el siguiente SQL:')
    console.log('')
    console.log('-- PASO 1: Crear tabla chapters')
    console.log(createChaptersTableSQL)
    console.log('')
    console.log('-- PASO 2: Crear políticas RLS')
    console.log(createPoliciesSQL)
    console.log('')
    console.log('-- PASO 3: Crear triggers y constraints')
    console.log(createTriggersSQL)
    console.log('')
    console.log('-- PASO 4: Crear vista y permisos')
    console.log(createViewSQL)
    console.log('')
    console.log('💡 Alternativamente, puedes copiar todo el contenido de:')
    console.log('   supabase/migrations/20250127000000_create_chapters_table.sql')
    console.log('   y ejecutarlo en el SQL Editor de Supabase')
    
  } catch (error) {
    console.error('💥 Error inesperado:', error)
  }
}

// Execute the function
createChaptersTable()