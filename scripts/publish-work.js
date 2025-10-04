const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function publishWork() {
  try {
    console.log('🔍 Buscando obras en estado draft...');
    
    // Obtener obras en draft
    const { data: draftWorks, error: fetchError } = await supabase
      .from('works')
      .select('*')
      .eq('status', 'draft');
    
    if (fetchError) {
      console.error('❌ Error al obtener obras:', fetchError);
      return;
    }
    
    if (!draftWorks || draftWorks.length === 0) {
      console.log('ℹ️ No hay obras en estado draft');
      return;
    }
    
    console.log(`📚 Encontradas ${draftWorks.length} obra(s) en draft:`);
    draftWorks.forEach((work, index) => {
      console.log(`  ${index + 1}. "${work.title}" (ID: ${work.id})`);
    });
    
    // Publicar todas las obras en draft
    const { data: updatedWorks, error: updateError } = await supabase
      .from('works')
      .update({ status: 'published' })
      .eq('status', 'draft')
      .select();
    
    if (updateError) {
      console.error('❌ Error al publicar obras:', updateError);
      return;
    }
    
    console.log('✅ Obras publicadas exitosamente:');
    updatedWorks.forEach((work, index) => {
      console.log(`  ${index + 1}. "${work.title}" - Ahora está PUBLICADA`);
    });
    
    // Verificar el resultado
    console.log('\n🔍 Verificando estado final...');
    const { data: publishedWorks, error: verifyError } = await supabase
      .from('works')
      .select('*')
      .eq('status', 'published');
    
    if (verifyError) {
      console.error('❌ Error al verificar:', verifyError);
      return;
    }
    
    console.log(`📚 Total de obras publicadas: ${publishedWorks.length}`);
    publishedWorks.forEach((work, index) => {
      console.log(`  ${index + 1}. "${work.title}" (${work.status})`);
    });
    
    console.log('\n🎉 ¡Proceso completado! Ahora tus obras deberían aparecer en la biblioteca y el home.');
    
  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

publishWork();