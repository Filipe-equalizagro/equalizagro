// app/api/consultor/chat/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';

const GPTMAKER_API_URL = 'https://api.gptmaker.ai/v2/agent';
const GPTMAKER_AGENT_ID = process.env.GPTMAKER_AGENT_ID || '';
const GPTMAKER_API_TOKEN = process.env.GPTMAKER_API_TOKEN || '';

/**
 * POST - Enviar mensagem para o ConsultorIA via GPTMaker
 * 
 * Recebe: { message, contextId, userName }
 * Retorna: { success, response, contextId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contextId, userName } = body;

    if (!message || !message.trim()) {
      throw new ApiError(400, 'A mensagem é obrigatória');
    }

    if (!GPTMAKER_AGENT_ID || !GPTMAKER_API_TOKEN) {
      console.error('[GPTMaker] Variáveis de ambiente GPTMAKER_AGENT_ID ou GPTMAKER_API_TOKEN não configuradas');
      throw new ApiError(500, 'Serviço de IA não configurado. Contate o administrador.');
    }

    // Gerar contextId se não fornecido (nova conversa)
    const conversationContextId = contextId || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[GPTMaker] Enviando mensagem - Context: ${conversationContextId}, User: ${userName || 'Anônimo'}`);

    // Chamar API GPTMaker v2
    const gptmakerUrl = `${GPTMAKER_API_URL}/${GPTMAKER_AGENT_ID}/conversation`;

    const gptmakerResponse = await fetch(gptmakerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GPTMAKER_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contextId: conversationContextId,
        prompt: message,
        chatName: userName || 'Usuário Equalizagro',
      }),
      signal: AbortSignal.timeout(120000), // Timeout de 120 segundos
    });

    if (!gptmakerResponse.ok) {
      const errorText = await gptmakerResponse.text().catch(() => 'Sem detalhes');
      console.error(`[GPTMaker] Erro na API: ${gptmakerResponse.status} - ${errorText}`);
      throw new ApiError(502, `Erro na comunicação com a IA (status ${gptmakerResponse.status})`);
    }

    const gptmakerData = await gptmakerResponse.json();

    console.log(`[GPTMaker] Resposta recebida - Context: ${conversationContextId}`);

    // Extrair resposta do GPTMaker
    // A API v2 retorna a resposta no campo "response" ou "message"
    const aiResponse = gptmakerData.response 
      || gptmakerData.message 
      || gptmakerData.answer 
      || gptmakerData.text
      || gptmakerData.data?.response
      || gptmakerData.data?.message
      || 'Resposta não disponível no momento.';

    return apiResponse({
      success: true,
      response: aiResponse,
      contextId: conversationContextId,
      metadata: {
        timestamp: new Date().toISOString(),
        model: 'gptmaker-v2',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiError(error);
    }

    // Tratar erro de timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error('[GPTMaker] Timeout na chamada à API');
      return apiError(new ApiError(504, 'A IA demorou muito para responder. Tente novamente.'));
    }

    // Tratar erro de rede
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[GPTMaker] Erro de rede:', error);
      return apiError(new ApiError(503, 'Não foi possível conectar ao serviço de IA. Tente novamente.'));
    }

    console.error('[GPTMaker] Erro inesperado:', error);
    return apiError(error);
  }
}
