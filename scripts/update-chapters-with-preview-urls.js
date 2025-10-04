const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateChaptersWithPreviewUrls() {
  try {
    console.log('🔍 Buscando capítulos sin cover_url...');
    
    // Obtener capítulos que no tienen cover_url (null o vacío)
    const { data: chapters, error: fetchError } = await supabase
      .from('chapters')
      .select(`
        id,
        title,
        author_id,
        cover_url,
        profiles!chapters_author_id_fkey (display_name)
      `)
      .or('cover_url.is.null,cover_url.eq.');

    if (fetchError) {
      console.error('❌ Error al obtener capítulos:', fetchError);
      return;
    }

    console.log(`📚 Encontrados ${chapters.length} capítulos sin cover_url`);

    if (chapters.length === 0) {
      console.log('✅ No hay capítulos que necesiten actualización');
      return;
    }

    // Actualizar cada capítulo con una URL preview
    for (const chapter of chapters) {
      const authorName = chapter.profiles?.display_name || 'Autor';
      const encodedTitle = encodeURIComponent(chapter.title);
      const encodedAuthor = encodeURIComponent(authorName);
      
      // Usar template-1 y paleta "marino" como valores por defecto
      const newCoverUrl = `preview:template-1:marino:${encodedTitle}:${encodedAuthor}`;
      
      console.log(`📝 Actualizando capítulo: "${chapter.title}" por ${authorName}`);
      console.log(`   Nueva cover_url: ${newCoverUrl}`);
      
      const { error: updateError } = await supabase
        .from('chapters')
        .update({ cover_url: newCoverUrl })
        .eq('id', chapter.id);

      if (updateError) {
        console.error(`❌ Error al actualizar capítulo ${chapter.id}:`, updateError);
      } else {
        console.log(`✅ Capítulo "${chapter.title}" actualizado correctamente`);
      }
    }

    console.log('🎉 Proceso completado');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

updateChaptersWithPreviewUrls();