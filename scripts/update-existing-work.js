const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateExistingWork() {
  console.log('🔄 Actualizando obra existente con el nombre de autor correcto...\n');
  
  // Obtener la obra con preview URL
  const { data: work, error: workError } = await supabase
    .from('works')
    .select(`
      id, 
      title, 
      cover_url, 
      author_id, 
      profiles!works_author_id_fkey(display_name)
    `)
    .like('cover_url', 'preview:%')
    .single();
    
  if (workError) {
    console.log('❌ Error obteniendo obra:', workError.message);
    return;
  }
  
  console.log('📚 Obra encontrada:', work.title);
  console.log('👤 Autor:', work.profiles?.display_name);
  console.log('🔗 URL actual:', work.cover_url);
  
  // Extraer partes de la URL actual
  const parts = work.cover_url.split(':');
  const templateId = parts[1];
  const paletteId = parts[2];
  const encodedTitle = parts[3];
  
  // Crear nueva URL con el nombre correcto del autor
  const authorName = work.profiles?.display_name || 'Autor';
  const newCoverUrl = `preview:${templateId}:${paletteId}:${encodedTitle}:${encodeURIComponent(authorName)}`;
  
  console.log('🔗 Nueva URL:', newCoverUrl);
  
  // Actualizar la obra
  const { data: updatedWork, error: updateError } = await supabase
    .from('works')
    .update({ cover_url: newCoverUrl })
    .eq('id', work.id)
    .select()
    .single();
    
  if (updateError) {
    console.log('❌ Error actualizando obra:', updateError.message);
  } else {
    console.log('✅ Obra actualizada correctamente');
    console.log('🔗 URL final:', updatedWork.cover_url);
  }
}

updateExistingWork().catch(console.error);