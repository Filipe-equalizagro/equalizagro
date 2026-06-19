// app/api/payments/webhook/route.ts
// Webhook para receber notificações de pagamento aprovado
import { NextRequest } from 'next/server';
import { apiResponse, apiError, ApiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * POST - Webhook de pagamento (chamado pelo gateway quando pagamento é aprovado)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Validar assinatura do webhook (segurança)
    const data = await request.json();

    const { purchaseId, status, paymentId, paymentData } = data;

    if (!purchaseId || !status) {
      throw new ApiError(400, 'purchaseId e status são obrigatórios');
    }

    console.log(`[PaymentWebhook] Recebido: ${purchaseId} - Status: ${status}`);

    // Buscar compra
    const purchaseResult = await query(
      `SELECT cp.*, u.email 
       FROM equalizagro.credit_purchases cp
       JOIN equalizagro.users u ON u.id = cp.user_id
       WHERE cp.id = $1`,
      [purchaseId]
    );

    if (purchaseResult.rows.length === 0) {
      throw new ApiError(404, 'Compra não encontrada');
    }

    const purchase = purchaseResult.rows[0];

    // Se já foi processado, ignorar
    if (purchase.payment_status === 'approved') {
      console.log(`[PaymentWebhook] Compra já processada: ${purchaseId}`);
      return apiResponse({ success: true, message: 'Já processado' });
    }

    if (status === 'approved') {
      // Atualizar status da compra
      await query(
        `UPDATE equalizagro.credit_purchases
         SET 
           payment_status = 'approved',
           paid_at = NOW(),
           payment_id = $1,
           payment_data = $2
         WHERE id = $3`,
        [paymentId, JSON.stringify(paymentData), purchaseId]
      );

      // Adicionar créditos ao usuário usando a função SQL
      await query(
        'SELECT equalizagro.add_credits($1, $2, $3)',
        [purchase.user_id, purchase.credits_purchased, purchaseId]
      );

      console.log(`[PaymentWebhook] Créditos adicionados: ${purchase.credits_purchased} para ${purchase.email}`);

      // TODO: Enviar email de confirmação
      // await sendPaymentConfirmationEmail(purchase.email, purchase.credits_purchased);

      return apiResponse({
        success: true,
        message: 'Pagamento processado e créditos adicionados',
      });
    } else if (status === 'failed' || status === 'cancelled') {
      await query(
        `UPDATE equalizagro.credit_purchases
         SET payment_status = $1, payment_data = $2
         WHERE id = $3`,
        [status, JSON.stringify(paymentData), purchaseId]
      );

      return apiResponse({
        success: true,
        message: 'Status atualizado',
      });
    }

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Rota mock para simular pagamento aprovado (apenas em desenvolvimento)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get('purchaseId');

    if (!purchaseId) {
      throw new ApiError(400, 'purchaseId é obrigatório');
    }

    // Simular webhook de pagamento aprovado
    const mockWebhookData = {
      purchaseId,
      status: 'approved',
      paymentId: 'MOCK_' + Date.now(),
      paymentData: {
        method: 'pix',
        amount: 0,
        timestamp: new Date().toISOString(),
      },
    };

    // Chamar próprio webhook
    await POST(
      new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify(mockWebhookData),
      })
    );

    return apiResponse({
      success: true,
      message: 'Pagamento mock processado com sucesso!',
      redirectTo: '/ConsultorIA',
    });
  } catch (error) {
    return apiError(error);
  }
}
