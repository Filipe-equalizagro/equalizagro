// app/api/payments/create-purchase/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { getStripe } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.equalizagro.com';

/**
 * POST - Criar uma compra de créditos (gera uma sessão de Checkout na Stripe)
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

    // Criar registro de compra (pending) — vira "approved" só quando o webhook confirmar
    const purchaseResult = await query(
      `INSERT INTO equalizagro.credit_purchases (
        user_id,
        plan_id,
        credits_purchased,
        amount_paid,
        currency,
        payment_status,
        payment_provider
      ) VALUES ($1, $2, $3, $4, $5, 'pending', 'stripe')
      RETURNING id`,
      [userId, planId, plan.credits_amount, plan.price, plan.currency]
    );

    const purchaseId = purchaseResult.rows[0].id;

    // Valor em centavos — obrigatório para a Stripe (unit_amount é inteiro)
    const unitAmount = Math.round(Number(plan.price) * 100);

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: (plan.currency || 'BRL').toLowerCase(),
            product_data: {
              name: `Plano ${plan.name} — ${plan.credits_amount} créditos`,
              description: plan.description || undefined,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      // metadata é o que o webhook usa para saber qual compra creditar
      metadata: {
        purchaseId,
        userId,
        planId,
      },
      success_url: `${APP_URL}/go2apply?payment=success&purchaseId=${purchaseId}`,
      cancel_url: `${APP_URL}/go2apply?payment=cancelled`,
    });

    // Guarda o ID da sessão Stripe na compra, para rastreabilidade
    await query(
      `UPDATE equalizagro.credit_purchases SET payment_id = $1 WHERE id = $2`,
      [session.id, purchaseId]
    );

    console.log(`[CreatePurchase] Sessão Stripe criada: ${session.id} (compra ${purchaseId}) para ${user.email}`);

    return apiResponse({
      success: true,
      message: 'Sessão de pagamento criada com sucesso',
      purchaseId,
      plan: {
        name: plan.name,
        credits: plan.credits_amount,
        price: plan.price,
        currency: plan.currency,
      },
      paymentLink: session.url,
    });
  } catch (error) {
    return apiError(error);
  }
}
