// app/api/payments/create-purchase/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * POST - Criar uma compra de créditos (inicia o processo de pagamento)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, planId } = await request.json();

    if (!userId || !planId) {
      throw new ApiError(400, 'userId e planId são obrigatórios');
    }

    // Buscar informações do plano
    const planResult = await query(
      'SELECT * FROM equalizagro.credit_plans WHERE id = $1 AND is_active = true',
      [planId]
    );

    if (planResult.rows.length === 0) {
      throw new ApiError(404, 'Plano não encontrado');
    }

    const plan = planResult.rows[0];

    // Verificar se usuário existe
    const userResult = await query(
      'SELECT id, email FROM equalizagro.users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    const user = userResult.rows[0];

    // Criar registro de compra
    const purchaseResult = await query(
      `INSERT INTO equalizagro.credit_purchases (
        user_id,
        plan_id,
        credits_purchased,
        amount_paid,
        currency,
        payment_status,
        payment_provider
      ) VALUES ($1, $2, $3, $4, $5, 'pending', 'mercadopago')
      RETURNING id`,
      [userId, planId, plan.credits_amount, plan.price, plan.currency]
    );

    const purchaseId = purchaseResult.rows[0].id;

    // TODO: Integrar com Mercado Pago, Stripe ou outro gateway
    // const paymentLink = await createMercadoPagoPayment({...});

    console.log(`[CreatePurchase] Compra criada: ${purchaseId} para usuário ${user.email}`);

    return apiResponse({
      success: true,
      message: 'Compra iniciada com sucesso',
      purchaseId: purchaseId,
      plan: {
        name: plan.name,
        credits: plan.credits_amount,
        price: plan.price,
        currency: plan.currency,
      },
      // paymentLink: paymentLink, // URL para redirecionar o usuário
      // Em desenvolvimento, retornar link mock
      paymentLink: `/payment/mock?purchaseId=${purchaseId}`,
    });
  } catch (error) {
    return apiError(error);
  }
}
