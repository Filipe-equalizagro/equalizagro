// app/api/consultor/consult/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query, transaction } from '@/lib/database';
import crypto from 'crypto';

/**
 * POST - Realizar consulta ao ConsultorIA
 * Esta é a função PRINCIPAL que controla o fluxo de créditos
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { userId, questionData } = await request.json();

    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    if (!questionData) {
      throw new ApiError(400, 'questionData é obrigatório');
    }

    // PASSO 1: Verificar saldo de créditos
    const userResult = await query(
      'SELECT id, email, full_name, credits_balance FROM equalizagro.users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    const user = userResult.rows[0];

    // BLOQUEIO: Se saldo <= 0, não permitir consulta
    if (user.credits_balance <= 0) {
      console.log(`[ConsultorIA] BLOQUEADO - Saldo insuficiente: ${user.email}`);
      
      return apiResponse({
        success: false,
        error: 'insufficient_credits',
        message: 'Saldo de créditos insuficiente. Recarregue seus créditos para continuar.',
        credits: {
          balance: user.credits_balance,
          required: 1,
        },
        requiresPurchase: true,
      }, 402); // 402 Payment Required
    }

    // PASSO 2: Verificar se já existe consulta idêntica no histórico (economizar créditos)
    const existingConsultResult = await query(
      `SELECT id, ai_response, question_text, created_at
       FROM equalizagro.ai_consultations
       WHERE user_id = $1 
         AND question_data = $2
         AND created_at > NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, JSON.stringify(questionData)]
    );

    if (existingConsultResult.rows.length > 0) {
      const existingConsult = existingConsultResult.rows[0];
      console.log(`[ConsultorIA] Consulta reutilizada do histórico: ${user.email}`);

      // Marcar como reutilizada
      await query(
        'UPDATE equalizagro.ai_consultations SET was_reused = true WHERE id = $1',
        [existingConsult.id]
      );

      return apiResponse({
        success: true,
        message: 'Resposta recuperada do histórico (sem custo)',
        response: existingConsult.ai_response,
        metadata: {
          fromHistory: true,
          originalDate: existingConsult.created_at,
          creditsUsed: 0,
        },
        credits: {
          balance: user.credits_balance, // Saldo não mudou
        },
      });
    }

    // PASSO 3: CONSUMIR CRÉDITO ANTES de chamar a IA (garantir que não vai ter prejuízo)
    let consultationId: string;

    try {
      const consumeResult = await transaction(async (client) => {
        // Criar registro de consulta
        const consultResult = await client.query(
          `INSERT INTO equalizagro.ai_consultations (
            user_id,
            question_data,
            question_text,
            ai_response,
            credits_used
          ) VALUES ($1, $2, $3, $4, 1)
          RETURNING id`,
          [
            userId,
            JSON.stringify(questionData),
            JSON.stringify(questionData), // Temporário até ter a resposta
            'Processando...', // Placeholder
          ]
        );

        const newConsultationId = consultResult.rows[0].id;

        // Consumir crédito usando função SQL
        const consumeResult = await client.query(
          'SELECT equalizagro.consume_credits($1, $2, 1) as success',
          [userId, newConsultationId]
        );

        if (!consumeResult.rows[0].success) {
          throw new ApiError(402, 'Não foi possível consumir crédito');
        }

        return newConsultationId;
      });

      consultationId = consumeResult;
      console.log(`[ConsultorIA] Crédito consumido - Usuário: ${user.email}, Consulta: ${consultationId}`);
    } catch (error) {
      console.error(`[ConsultorIA] Erro ao consumir crédito:`, error);
      throw new ApiError(500, 'Erro ao processar pagamento de crédito');
    }

    // PASSO 4: Chamar o N8n/GPTMaker (webhook)
    let aiResponse: string;
    let webhookRequestId: string = crypto.randomUUID();

    try {
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'https://equalizagro.app.n8n.cloud/webhook/consultoria-agricola2605';

      console.log(`[ConsultorIA] Chamando N8n: ${n8nWebhookUrl}`);

      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`,
        },
        body: JSON.stringify({
          requestId: webhookRequestId,
          userId: userId,
          userEmail: user.email,
          questionData: questionData,
        }),
        signal: AbortSignal.timeout(60000), // Timeout de 60 segundos
      });

      if (!n8nResponse.ok) {
        throw new Error(`N8n retornou erro: ${n8nResponse.status}`);
      }

      const n8nData = await n8nResponse.json();
      aiResponse = n8nData.response || n8nData.answer || 'Resposta da IA não disponível';

      console.log(`[ConsultorIA] Resposta recebida do N8n`);
    } catch (error) {
      console.error(`[ConsultorIA] Erro ao chamar N8n:`, error);

      // Se falhar, ainda assim retornar resposta mock (mas o crédito já foi consumido)
      aiResponse = `**Análise de Compatibilidade de Calda**

Cultura: ${questionData.cultura || 'Não especificada'}
PH: ${questionData.ph || 'Não especificado'}

⚠️ **Atenção:** Sistema em modo de desenvolvimento. Resposta simulada.

Esta seria a análise completa da compatibilidade dos produtos na calda, considerando:
- Compatibilidade química entre os componentes
- Riscos de fitotoxicidade
- Ordem de mistura recomendada
- Ajustes de pH necessários

**Recomendações:**
1. Realizar teste em pequena área
2. Observar condições climáticas
3. Seguir bulas dos produtos

🔬 *Consulta gerada pelo sistema EqualizAgro*`;
    }

    // PASSO 5: Atualizar consulta com a resposta da IA
    const processingTime = Date.now() - startTime;

    await query(
      `UPDATE equalizagro.ai_consultations
       SET 
         ai_response = $1,
         processing_time_ms = $2,
         webhook_request_id = $3,
         response_metadata = $4
       WHERE id = $5`,
      [
        aiResponse,
        processingTime,
        webhookRequestId,
        JSON.stringify({ timestamp: new Date(), questionData }),
        consultationId,
      ]
    );

    // PASSO 6: Buscar novo saldo
    const newBalanceResult = await query(
      'SELECT credits_balance FROM equalizagro.users WHERE id = $1',
      [userId]
    );

    const newBalance = newBalanceResult.rows[0].credits_balance;

    console.log(`[ConsultorIA] Consulta concluída - Novo saldo: ${newBalance}`);

    return apiResponse({
      success: true,
      message: 'Consulta realizada com sucesso',
      response: aiResponse,
      metadata: {
        consultationId: consultationId,
        processingTimeMs: processingTime,
        fromHistory: false,
        creditsUsed: 1,
      },
      credits: {
        balance: newBalance,
        used: 1,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
