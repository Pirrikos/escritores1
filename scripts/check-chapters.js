require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChapters() {
  try {
    console.log('🔍 Consultando capítulos en la base de datos...\n');
    
    const { data: chapters, error } = await supabase
      .from('chapters')
      .select(`
        id,
        title,
        slug,
        file_url,
        cover_url,
        status,
        created_at,
        profiles!chapters_author_id_fkey (display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error consultando capítulos:', error);
      return;
    }

    console.log(`📚 Encontrados ${chapters.length} capítulos:\n`);

    chapters.forEach((chapter, index) => {
      console.log(`${index + 1}. "${chapter.title}"`);
      console.log(`   ID: ${chapter.id}`);
      console.log(`   Slug: ${chapter.slug || 'Sin slug'}`);
      console.log(`   Autor: ${chapter.profiles?.display_name || 'Sin autor'}`);
      console.log(`   Estado: ${chapter.status}`);
      console.log(`   Archivo: ${chapter.file_url || 'Sin archivo'}`);
      console.log(`   Portada: ${chapter.cover_url || 'Sin portada'}`);
      console.log(`   Creado: ${new Date(chapter.created_at).toLocaleString()}`);
      console.log('');
    });

    // Verificar si hay capítulos con el slug problemático
    const problematicChapter = chapters.find(c => 
      c.slug === 'se-ve-bien-la-portada-chapter-1' || 
      c.title.toLowerCase().includes('se ve bien la portada')
    );

    if (problematicChapter) {
      console.log('🔍 Capítulo problemático encontrado:');
      console.log(`   Título: ${problematicChapter.title}`);
      console.log(`   Slug: ${problematicChapter.slug}`);
      console.log(`   file_url: ${problematicChapter.file_url}`);
      console.log(`   cover_url: ${problematicChapter.cover_url}`);
    }

  } catch (error) {
    console.error('💥 Error inesperado:', error);
  }
}

checkChapters();