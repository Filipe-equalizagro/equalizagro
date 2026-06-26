// app/api/consultor/conversations/messages/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureConversationTables } from '@/lib/db-init';

/**
 * GET - Buscar mensagens de uma conversa
 * Query params: conversationId, userId, limit?, offset?
 */
export async function GET(request: NextRequest) {
  try {
    await ensureConversationTables();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('[Messages GET] Buscando mensagens:', { conversationId, userId, limit, offset });

    if (!conversationId || !userId) {
      throw new ApiError(400, 'conversationId e userId são obrigatórios');
    }

    // Verificar se a conversa pertence ao usuário
    const conversationCheck = await query(
      `SELECT id, title
       FROM equalizagro.conversations
       WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
      [conversationId, userId]
    );

    if (conversationCheck.rows.length === 0) {
      console.log('[Messages GET] Conversa não encontrada para:', { conversationId, userId });
      throw new ApiError(404, 'Conversa não encontrada');
    }

    // Buscar mensagens
    const messagesResult = await query(
      `SELECT 
         id,
         role,
         content,
         tokens_used,
         created_at
       FROM equalizagro.messages 
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    console.log('[Messages GET] Mensagens encontradas:', messagesResult.rows.length);

    // Contar total de mensagens
    const countResult = await query(
      'SELECT COUNT(*) as total FROM equalizagro.messages WHERE conversation_id = $1',
      [conversationId]
    );

    const total = parseInt(countResult.rows[0].total);
    const conversation = conversationCheck.rows[0];

    return apiResponse({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
      messages: messagesResult.rows.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokensUsed: msg.tokens_used,
        timestamp: msg.created_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[Messages GET] Erro:', error);
    return apiError(error);
  }
}

/**
 * POST - Salvar mensagem(ns) em uma conversa
 * Body: { conversationId, userId, messages: [{ role, content }] }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureConversationTables();
    const body = await request.json();
    const { conversationId, userId, messages } = body;

    if (!conversationId || !userId) {
      throw new ApiError(400, 'conversationId e userId são obrigatórios');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ApiError(400, 'messages é obrigatório e deve ser um array');
    }

    // Verificar se a conversa pertence ao usuário
    const conversationCheck = await query(
      `SELECT id FROM equalizagro.conversations 
       WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
      [conversationId, userId]
    );

    if (conversationCheck.rows.length === 0) {
      throw new ApiError(404, 'Conversa não encontrada');
    }

    // Inserir mensagens
    const insertedMessages = [];
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        continue;
      }

      const result = await query(
        `INSERT INTO equalizagro.messages (
           conversation_id,
           user_id,
           role,
           content,
           tokens_used,
           created_at,
           updated_at
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, role, content, created_at`,
        [conversationId, userId, msg.role, msg.content, msg.tokensUsed || null]
      );

      insertedMessages.push(result.rows[0]);
    }

    // Atualizar a conversa
    const updateFields = ['message_count = message_count + $2', 'last_message_at = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [conversationId, insertedMessages.length];

    // Atualizar título se for a primeira mensagem do usuário
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const currentConversation = await query(
        `SELECT title, message_count FROM equalizagro.conversations WHERE id = $1`,
        [conversationId]
      );
      
      if (currentConversation.rows[0]?.title === 'Nova Conversa' || currentConversation.rows[0]?.message_count <= 1) {
        updateFields.push('title = $' + (updateValues.length + 1));
        // Gerar título a partir da primeira mensagem (primeiras 50 chars)
        updateValues.push(firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''));
      }
    }

    await query(
      `UPDATE equalizagro.conversations 
       SET ${updateFields.join(', ')}
       WHERE id = $1`,
      updateValues
    );

    return apiResponse({
      success: true,
      savedMessages: insertedMessages.length,
      messages: insertedMessages,
    });
  } catch (error) {
    console.error('[Messages POST] Erro:', error);
    return apiError(error);
  }
}
