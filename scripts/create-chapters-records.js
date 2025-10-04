require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno de Supabase');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para generar slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Función para parsear nombre de archivo de capítulo
function parseChapterFileName(fileName) {
  // Remover extensión
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Buscar patrón "capitulo-[titulo]-chapter-[numero]"
  const chapterMatch = nameWithoutExt.match(/^capitulo-(.+?)-chapter-(\d+)/i);
  
  if (chapterMatch) {
    const title = chapterMatch[1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    const chapterNumber = parseInt(chapterMatch[2]);
    
    return {
      title,
      chapterNumber,
      fileType: fileName.split('.').pop()
    };
  }
  
  // Si no coincide con el patrón, usar el nombre completo
  const title = nameWithoutExt
    .replace(/capitulo-/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
    
  return {
    title,
    chapterNumber: 1,
    fileType: fileName.split('.').pop()
  };
}

async function createChaptersRecords() {
  try {
    console.log('📖 Creando registros para capítulos...');
    
    // Obtener el ID del autor (primer perfil disponible)
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
      console.error('❌ Error al obtener perfil de autor:', profileError?.message || 'No hay perfiles');
      return;
    }

    const authorId = profiles[0].id;
    console.log(`👤 Usando autor ID: ${authorId}`);

    // Obtener archivos del bucket chapters
    const { data: chaptersFiles, error: chaptersError } = await supabase.storage
      .from('chapters')
      .list('f844097c-52c0-42d9-8694-322f616d19f0', {
        limit: 100
      });

    if (chaptersError) {
      console.error('❌ Error al obtener archivos de capítulos:', chaptersError.message);
      return;
    }

    if (!chaptersFiles || chaptersFiles.length === 0) {
      console.log('ℹ️ No se encontraron archivos de capítulos');
      return;
    }

    console.log(`📁 Encontrados ${chaptersFiles.length} archivos de capítulos`);

    for (const file of chaptersFiles) {
      const fileInfo = parseChapterFileName(file.name);
      const fileUrl = `f844097c-52c0-42d9-8694-322f616d19f0/${file.name}`;
      
      console.log(`   Procesando: ${file.name}`);
      console.log(`   Título extraído: ${fileInfo.title}`);
      console.log(`   Número de capítulo: ${fileInfo.chapterNumber}`);

      const chapterData = {
        title: fileInfo.title,
        content: `Contenido del capítulo: ${fileInfo.title}`,
        author_id: authorId,
        chapter_number: fileInfo.chapterNumber,
        status: 'published',
        slug: generateSlug(fileInfo.title),
        file_url: fileUrl,
        file_type: fileInfo.fileType,
        file_size: file.metadata?.size || 0,
        is_independent: true,
        published_at: new Date().toISOString()
      };

      // Intentar insertar el capítulo
      const { data: insertedChapter, error: insertError } = await supabase
        .from('chapters')
        .insert(chapterData)
        .select();

      if (insertError) {
        console.error(`   ❌ Error al insertar capítulo: ${insertError.message}`);
        console.error(`   Código de error: ${insertError.code}`);
      } else {
        console.log(`   ✅ Capítulo creado: ${insertedChapter[0].id}`);
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }

  console.log('\n✅ Proceso de capítulos completado');
}

createChaptersRecords();