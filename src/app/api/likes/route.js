import { getSupabaseRouteClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

// GET /api/likes - Obtener información de likes
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');
    const userId = searchParams.get('user_id');

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'target_type y target_id son requeridos' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseRouteClient();

    // Obtener conteo de likes
    const { data: countData, error: countError } = await supabase
      .rpc('get_like_count', {
        content_type: targetType,
        content_id: targetId
      });

    if (countError) {
      console.error('Error getting like count:', countError);
      return NextResponse.json(
        { error: 'Error al obtener conteo de likes' },
        { status: 500 }
      );
    }

    let userHasLiked = false;

    // Si se proporciona userId, verificar si el usuario ha dado like
    if (userId) {
      const { data: likedData, error: likedError } = await supabase
        .rpc('user_has_liked', {
          content_type: targetType,
          content_id: targetId,
          user_uuid: userId
        });

      if (likedError) {
        console.error('Error checking user like:', likedError);
        // No retornamos error aquí, solo asumimos que no ha dado like
      } else {
        userHasLiked = likedData;
      }
    }

    return NextResponse.json({
      count: countData || 0,
      userHasLiked,
      targetType,
      targetId
    });

  } catch (error) {
    console.error('Error in GET /api/likes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/likes - Crear o eliminar like (toggle)
export async function POST(request) {
  try {
    const body = await request.json();
    const { targetType, targetId, userId } = body;

    if (!targetType || !targetId || !userId) {
      return NextResponse.json(
        { error: 'targetType, targetId y userId son requeridos' },
        { status: 400 }
      );
    }

    // Validar targetType
    if (!['post', 'chapter', 'work'].includes(targetType)) {
      return NextResponse.json(
        { error: 'targetType debe ser post, chapter o work' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseRouteClient();

    // Verificar si ya existe el like
    const { data: existingLike, error: checkError } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing like:', checkError);
      return NextResponse.json(
        { error: 'Error al verificar like existente' },
        { status: 500 }
      );
    }

    let action;
    let newCount;

    if (existingLike) {
      // El like existe, eliminarlo (unlike)
      const { error: deleteError } = await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) {
        console.error('Error deleting like:', deleteError);
        return NextResponse.json(
          { error: 'Error al eliminar like' },
          { status: 500 }
        );
      }

      action = 'unliked';
    } else {
      // El like no existe, crearlo
      const { error: insertError } = await supabase
        .from('likes')
        .insert({
          user_id: userId,
          target_type: targetType,
          target_id: targetId
        });

      if (insertError) {
        console.error('Error creating like:', insertError);
        return NextResponse.json(
          { error: 'Error al crear like' },
          { status: 500 }
        );
      }

      action = 'liked';
    }

    // Obtener el nuevo conteo
    const { data: countData, error: countError } = await supabase
      .rpc('get_like_count', {
        content_type: targetType,
        content_id: targetId
      });

    if (countError) {
      console.error('Error getting updated count:', countError);
      newCount = 0; // Fallback
    } else {
      newCount = countData || 0;
    }

    return NextResponse.json({
      success: true,
      action,
      count: newCount,
      userHasLiked: action === 'liked'
    });

  } catch (error) {
    console.error('Error in POST /api/likes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}