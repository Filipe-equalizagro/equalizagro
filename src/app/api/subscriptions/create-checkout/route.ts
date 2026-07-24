// app/api/subscriptions/create-checkout/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureSubscriptionTables } from '@/lib/db-init';
import { getStripe } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.equalizagro.com';

// Cupom de lançamento — 30% off por 12 meses, só para o plano Anual (12x).
// Código único e compartilhado, distribuído manualmente à lista de lançamento.
const LAUNCH_PROMO_CODE = 'GO2APPLY30OFF';
const LAUNCH_PROMO_ELIGIBLE_PLAN = 'Anual';

/**
 * Busca (ou cria, na primeira vez) o cupom + código promocional de lançamento
 * na Stripe. Idempotente — reutiliza se já existir em vez de duplicar.
 */
async function getOrCreateLaunchPromotionCodeId(): Promise<string> {
  const stripe = getStripe();

  const existing = await stripe.promotionCodes.list({ code: LAUNCH_PROMO_CODE, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const coupon = await stripe.coupons.create({
    name: 'Lançamento 30% OFF — Anual',
    percent_off: 30,
    duration: 'repeating',
    duration_in_months: 12,
  });

  const promotionCode = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: LAUNCH_PROMO_CODE,
  });

  return promotionCode.id;
}

/**
 * POST - Criar uma sessão de Checkout para assinatura recorrente
 * Body: { userId, planId, promoCode?, paymentMethod?: 'card' | 'boleto' }
 *
 * Boleto não suporta trial (a Stripe não gera boleto de R$0) — por isso só
 * o cartão tem os dias grátis; boleto cobra o valor cheio na primeira fatura.
 */
export async function POST(request: NextRequest) {
  try {
    await ensureSubscriptionTables();

    const { userId, planId, promoCode, paymentMethod } = await request.json();
    const isBoleto = paymentMethod === 'boleto';

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

    // Cupom de lançamento — só válido para o plano Anual (12x)
    let promotionCodeId: string | null = null;
    const trimmedPromo = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : '';
    if (trimmedPromo) {
      if (trimmedPromo !== LAUNCH_PROMO_CODE || plan.name !== LAUNCH_PROMO_ELIGIBLE_PLAN) {
        throw new ApiError(400, 'Código promocional inválido para este plano');
      }
      promotionCodeId = await getOrCreateLaunchPromotionCodeId();
    }

    const unitAmount = Math.round(Number(plan.price) * 100);
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: isBoleto ? ['boleto'] : ['card'],
      ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : {}),
      customer_email: user.email,
      // Cartão: exige coletar o cartão mesmo o valor devido hoje sendo R$0 (trial).
      // Boleto: não se aplica — não há trial, a 1ª fatura já é cobrada.
      ...(isBoleto ? {} : { payment_method_collection: 'always' as const }),
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
        // Boleto não suporta trial (não existe boleto de R$0) — cobra na hora
        ...(isBoleto ? {} : { trial_period_days: plan.trial_days }),
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
      plan: { name: plan.name, price: plan.price, currency: plan.currency, trialDays: isBoleto ? 0 : plan.trial_days },
    });
  } catch (error) {
    return apiError(error);
  }
}
