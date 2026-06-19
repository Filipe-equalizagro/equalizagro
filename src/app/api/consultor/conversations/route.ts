// app/api/consultor/conversations/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * GET - Buscar todas as conversas do usuário
 * Query params: userId, includeArchived (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    console.log('[Conversations GET] Buscando conversas para userId:', userId, 'includeArchived:', includeArchived);

    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    // Buscar conversas do usuário
    const conversationsResult = await query(
      `SELECT 
        c.id,
        c.title,
        c.gptmaker_context_id,
        c.message_count,
        c.last_message_at,
        c.is_archived,
        c.created_at,
        c.updated_at,
        (
          SELECT content 
          FROM equalizagro.messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_preview
       FROM equalizagro.conversations c
       WHERE c.user_id = $1 
         AND c.is_deleted = false
         ${!includeArchived ? 'AND c.is_archived = false' : ''}
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT 100`,
      [userId]
    );

    console.log('[Conversations GET] Encontradas:', conversationsResult.rows.length, 'conversas');

    return apiResponse({
      success: true,
      conversations: conversationsResult.rows.map(conv => ({
        id: conv.id,
        title: conv.title || 'Conversa sem título',
        gptmakerContextId: conv.gptmaker_context_id,
        messageCount: conv.message_count || 0,
        lastMessageAt: conv.last_message_at,
        lastMessagePreview: conv.last_message_preview?.substring(0, 100),
        isArchived: conv.is_archived || false,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      })),
    });
  } catch (error) {
    console.error('[Conversations GET] Erro:', error);
    return apiError(error);
  }
}

/**
 * POST - Criar nova conversa ou atualizar existente
 * Body: { userId, title, gptmakerContextId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, gptmakerContextId, conversationId } = body;

    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    let result;

    if (conversationId) {
      // Atualizar conversa existente
      result = await query(
        `UPDATE equalizagro.conversations 
         SET 
           title = COALESCE($2, title),
           gptmaker_context_id = COALESCE($3, gptmaker_context_id),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $4
         RETURNING id, title, gptmaker_context_id, created_at`,
        [conversationId, title, gptmakerContextId, userId]
      );

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Conversa não encontrada');
      }
    } else {
      // Criar nova conversa
      result = await query(
        `INSERT INTO equalizagro.conversations (
           user_id, 
           title, 
           gptmaker_context_id, 
           message_count,
           is_archived,
           is_deleted,
           created_at, 
           updated_at
         ) VALUES ($1, $2, $3, 0, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, title, gptmaker_context_id, created_at`,
        [userId, title || 'Nova Conversa', gptmakerContextId]
      );
    }

    const conversation = result.rows[0];

    return apiResponse({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        gptmakerContextId: conversation.gptmaker_context_id,
        createdAt: conversation.created_at,
      },
    });
  } catch (error) {
    console.error('[Conversations POST] Erro:', error);
    return apiError(error);
  }
}

/**
 * PUT - Atualizar conversa (arquivar, renomear, etc)
 * Body: { conversationId, userId, title?, isArchived? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, userId, title, isArchived } = body;

    if (!conversationId || !userId) {
      throw new ApiError(400, 'conversationId e userId são obrigatórios');
    }

    const updates: string[] = [];
    const values: any[] = [conversationId, userId];
    let paramIndex = 3;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }

    if (isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex}`);
      values.push(isArchived);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'Nenhum campo para atualizar');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await query(
      `UPDATE equalizagro.conversations 
       SET ${updates.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, is_archived`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Conversa não encontrada');
    }

    return apiResponse({
      success: true,
      conversation: result.rows[0],
    });
  } catch (error) {
    console.error('[Conversations PUT] Erro:', error);
    return apiError(error);
  }
}

/**
 * DELETE - Deletar conversa (soft delete)
 * Query params: conversationId, userId
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');

    if (!conversationId || !userId) {
      throw new ApiError(400, 'conversationId e userId são obrigatórios');
    }

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(conversationId) || !uuidRe.test(userId)) {
      throw new ApiError(400, 'IDs devem ser UUIDs válidos');
    }

    const result = await query(
      `UPDATE equalizagro.conversations 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [conversationId, userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Conversa não encontrada');
    }

    return apiResponse({
      success: true,
      message: 'Conversa deletada com sucesso',
    });
  } catch (error) {
    console.error('[Conversations DELETE] Erro:', error);
    return apiError(error);
  }
}
