// app/api/consultor/conversations/sync/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

const GPTMAKER_API_URL = 'https://api.gptmaker.ai/v2/chat';
const GPTMAKER_API_TOKEN = process.env.GPTMAKER_API_TOKEN || '';

interface GPTMakerMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  timestamp?: string;
}

/**
 * POST - Sincronizar mensagens do GPTMaker para o banco de dados
 * Usa a API: GET https://api.gptmaker.ai/v2/chat/{chatId}/messages
 * 
 * Body: { conversationId, userId, gptmakerContextId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, userId, gptmakerContextId } = body;

    if (!gptmakerContextId) {
      throw new ApiError(400, 'gptmakerContextId é obrigatório para sincronização');
    }

    if (!GPTMAKER_API_TOKEN) {
      console.error('[GPTMaker Sync] Token não configurado');
      throw new ApiError(500, 'Serviço de sincronização não configurado');
    }

    console.log(`[GPTMaker Sync] Iniciando sincronização - Context: ${gptmakerContextId}`);

    // Buscar mensagens do GPTMaker
    const gptmakerResponse = await fetch(`${GPTMAKER_API_URL}/${gptmakerContextId}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GPTMAKER_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!gptmakerResponse.ok) {
      const errorText = await gptmakerResponse.text().catch(() => 'Sem detalhes');
      console.error(`[GPTMaker Sync] Erro na API: ${gptmakerResponse.status} - ${errorText}`);
      
      // Se for 404, a conversa pode não existir no GPTMaker
      if (gptmakerResponse.status === 404) {
        return apiResponse({
          success: true,
          messages: [],
          synced: 0,
          note: 'Nenhuma mensagem encontrada no serviço de IA',
        });
      }
      
      throw new ApiError(502, `Erro ao buscar histórico da IA (status ${gptmakerResponse.status})`);
    }

    const gptmakerData = await gptmakerResponse.json();
    
    // Extrair mensagens da resposta do GPTMaker
    // A estrutura pode variar, então tentamos várias possibilidades
    let gptMessages: GPTMakerMessage[] = [];
    
    if (Array.isArray(gptmakerData)) {
      gptMessages = gptmakerData;
    } else if (gptmakerData.messages && Array.isArray(gptmakerData.messages)) {
      gptMessages = gptmakerData.messages;
    } else if (gptmakerData.data && Array.isArray(gptmakerData.data)) {
      gptMessages = gptmakerData.data;
    } else if (gptmakerData.data?.messages && Array.isArray(gptmakerData.data.messages)) {
      gptMessages = gptmakerData.data.messages;
    }

    console.log(`[GPTMaker Sync] Mensagens encontradas: ${gptMessages.length}`);

    // Se temos conversationId e userId, salvar no banco de dados
    if (conversationId && userId) {
      // Verificar se a conversa existe
      const convCheck = await query(
        `SELECT id FROM equalizagro.conversations WHERE id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      if (convCheck.rows.length === 0) {
        throw new ApiError(404, 'Conversa não encontrada');
      }

      // Buscar mensagens já existentes para evitar duplicatas
      const existingMessages = await query(
        `SELECT content, role FROM equalizagro.messages WHERE conversation_id = $1`,
        [conversationId]
      );

      const existingSet = new Set(
        existingMessages.rows.map(m => `${m.role}:${m.content.substring(0, 100)}`)
      );

      // Inserir novas mensagens
      let insertedCount = 0;
      for (const msg of gptMessages) {
        const msgKey = `${msg.role}:${msg.content.substring(0, 100)}`;
        
        if (!existingSet.has(msgKey)) {
          await query(
            `INSERT INTO equalizagro.messages (
               conversation_id, user_id, role, content, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [
              conversationId,
              userId,
              msg.role,
              msg.content,
              msg.createdAt || msg.timestamp || new Date().toISOString(),
            ]
          );
          insertedCount++;
        }
      }

      // Atualizar contador da conversa
      if (insertedCount > 0) {
        await query(
          `UPDATE equalizagro.conversations 
           SET message_count = message_count + $2, 
               last_message_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [conversationId, insertedCount]
        );

        // Log de sincronização
        await query(
          `INSERT INTO equalizagro.gptmaker_sync_log (
             conversation_id, gptmaker_context_id, messages_synced, sync_status
           ) VALUES ($1, $2, $3, 'success')`,
          [conversationId, gptmakerContextId, insertedCount]
        ).catch(err => console.error('[GPTMaker Sync] Erro ao registrar log:', err));
      }

      console.log(`[GPTMaker Sync] Mensagens inseridas: ${insertedCount}`);
    }

    return apiResponse({
      success: true,
      messages: gptMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt || msg.timestamp,
      })),
      synced: gptMessages.length,
    });
  } catch (error) {
    console.error('[GPTMaker Sync] Erro:', error);
    
    // Log de erro
    if (request.body) {
      try {
        const body = await request.clone().json();
        if (body.conversationId) {
          await query(
            `INSERT INTO equalizagro.gptmaker_sync_log (
               conversation_id, gptmaker_context_id, sync_status, error_message
             ) VALUES ($1, $2, 'error', $3)`,
            [body.conversationId, body.gptmakerContextId, String(error)]
          ).catch(() => {});
        }
      } catch {}
    }
    
    return apiError(error);
  }
}
