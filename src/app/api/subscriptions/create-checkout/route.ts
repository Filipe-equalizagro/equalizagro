// app/api/subscriptions/create-checkout/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureSubscriptionTables } from '@/lib/db-init';
import { getStripe } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.equalizagro.com';

/**
 * POST - Criar uma sessão de Checkout para assinatura recorrente (com trial)
 * Body: { userId, planId }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSubscriptionTables();

    const { userId, planId } = await request.json();

    if (!userId || !planId) {
      throw new ApiError(400, 'userId e planId são obrigatórios');
    }

    const planResult = await query(
      `SELECT * FROM equalizagro.subscription_plans WHERE id = $1 AND is_active = true`,
      [planId]
    );
    if (planResult.rows.length === 0) {
      throw new ApiError(404, 'Plano de assinatura não encontrado');
    }
    const plan = planResult.rows[0];

    const userResult = await query(`SELECT id, email FROM equalizagro.users WHERE id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'Usuário não encontrado');
    }
    const user = userResult.rows[0];

    // Impede assinatura duplicada — se já houver uma ativa/trial/pendente, não cria outra
    const activeCheck = await query(
      `SELECT id FROM equalizagro.user_subscriptions
       WHERE user_id = $1 AND status IN ('trialing', 'active', 'past_due', 'incomplete')`,
      [userId]
    );
    if (activeCheck.rows.length > 0) {
      throw new ApiError(409, 'Usuário já possui uma assinatura em andamento');
    }

    const unitAmount = Math.round(Number(plan.price) * 100);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      // Exige coletar o cartão mesmo o valor devido hoje sendo R$0 (período de trial)
      payment_method_collection: 'always',
      line_items: [
        {
          price_data: {
            currency: (plan.currency || 'BRL').toLowerCase(),
            product_data: {
              name: `Assinatura ${plan.name} — go2apply`,
            },
            recurring: {
              interval: plan.billing_interval as 'month' | 'year',
              interval_count: plan.interval_count,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: plan.trial_days,
        metadata: { userId, planId },
      },
      metadata: { userId, planId },
      success_url: `${APP_URL}/go2apply?subscription=success`,
      cancel_url: `${APP_URL}/go2apply?subscription=cancelled`,
    });

    // Registra a assinatura como "incomplete" — o webhook promove para trialing/active
    await query(
      `INSERT INTO equalizagro.user_subscriptions (user_id, plan_id, status)
       VALUES ($1, $2, 'incomplete')`,
      [userId, planId]
    );

    console.log(`[Subscriptions] Checkout criado: ${session.id} para ${user.email} (plano ${plan.name})`);

    return apiResponse({
      success: true,
      checkoutUrl: session.url,
      plan: { name: plan.name, price: plan.price, currency: plan.currency, trialDays: plan.trial_days },
    });
  } catch (error) {
    return apiError(error);
  }
}
