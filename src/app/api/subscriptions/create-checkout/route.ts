// app/api/subscriptions/create-checkout/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureSubscriptionTables } from '@/lib/db-init';
import { getStripe } from '@/lib/stripe';
import { getBoletoPrice } from '@/lib/boleto-pricing';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.equalizagro.com';

// Cupom de lançamento — 30% off por 12 meses, só para o plano Anual pago por
// assinatura recorrente (cartão). Não se aplica ao boleto anual — este é um
// pagamento único e o cupom usa duração "repeating" (por ciclo de fatura),
// incompatível com um checkout de modo "payment".
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
 * POST - Criar uma sessão de Checkout
 * Body: { userId, planId, promoCode?, paymentMethod?: 'card' | 'boleto' }
 *
 * Cartão: sempre assinatura recorrente na Stripe, com trial (dias grátis) —
 * disponível para Mensal e Anual.
 * Boleto: disponível SOMENTE para o Anual, como PAGAMENTO ÚNICO pelo valor
 * cheio de 12 meses de acesso (não 12x de R$157 — é o boleto do ano
 * inteiro). Sem trial (a Stripe não gera boleto de R$0) e sem Mensal (não
 * há recorrência automática confiável via boleto).
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

    if (isBoleto && plan.name !== 'Anual') {
      throw new ApiError(400, 'Boleto disponível apenas para o plano Anual');
    }

    const userResult = await query(`SELECT id, email FROM equalizagro.users WHERE id = $1`, [userId]);
    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'Usuário não encontrado');
    }
    const user = userResult.rows[0];

    // Impede assinatura duplicada — se já houver uma ativa/trial/pendente, não cria outra.
    // "incomplete" só bloqueia se for recente (checkout ainda pode ser concluído);
    // depois de 24h (mesmo prazo que a Stripe usa para expirar a sessão), uma
    // linha "incomplete" travada é tratada como abandonada — sem isso, uma
    // pessoa que fechasse o checkout sem pagar ficaria bloqueada para sempre
    // caso o webhook de expiração falhasse ou se atrasasse.
    const activeCheck = await query(
      `SELECT id FROM equalizagro.user_subscriptions
       WHERE user_id = $1
         AND (
           status IN ('trialing', 'active', 'past_due')
           OR (status = 'incomplete' AND created_at > NOW() - INTERVAL '24 hours')
         )`,
      [userId]
    );
    if (activeCheck.rows.length > 0) {
      throw new ApiError(409, 'Usuário já possui uma assinatura em andamento');
    }

    // Anual pago via boleto é um caso especial: pagamento único, sem trial,
    // sem cupom (ver comentário no topo do arquivo).
    const isAnnualBoletoOneTime = isBoleto && plan.name === 'Anual';

    // Cupom de lançamento — só válido para o plano Anual recorrente (cartão)
    let promotionCodeId: string | null = null;
    const trimmedPromo = typeof promoCode === 'string' ? promoCode.trim().toUpperCase() : '';
    if (trimmedPromo) {
      if (trimmedPromo !== LAUNCH_PROMO_CODE || plan.name !== LAUNCH_PROMO_ELIGIBLE_PLAN || isAnnualBoletoOneTime) {
        throw new ApiError(400, 'Código promocional inválido para este plano/forma de pagamento');
      }
      promotionCodeId = await getOrCreateLaunchPromotionCodeId();
    }

    const stripe = getStripe();
    const currency = (plan.currency || 'BRL').toLowerCase();

    let checkoutUrl: string | null;
    let trialDaysApplied = 0;

    if (isAnnualBoletoOneTime) {
      // ── Boleto Anual: pagamento único pelo valor cheio de 12 meses ──────
      const boletoPrice = getBoletoPrice(plan.name);
      if (boletoPrice === undefined) {
        throw new ApiError(400, 'Boleto não disponível para este plano');
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['boleto'],
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Assinatura Anual — go2apply (boleto, 12 meses de acesso)`,
              },
              unit_amount: Math.round(boletoPrice * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { userId, planId, kind: 'annual_boleto' },
        success_url: `${APP_URL}/go2apply?subscription=success`,
        cancel_url: `${APP_URL}/go2apply?subscription=cancelled`,
      });
      checkoutUrl = session.url;
    } else {
      // ── Assinatura recorrente via cartão (Mensal ou Anual) — boleto nunca
      // chega aqui, pois é sempre pagamento único e só existe para o Anual.
      const unitAmount = Math.round(Number(plan.price) * 100);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        ...(promotionCodeId ? { discounts: [{ promotion_code: promotionCodeId }] } : {}),
        customer_email: user.email,
        // Exige coletar o cartão mesmo o valor devido hoje sendo R$0 (trial)
        payment_method_collection: 'always',
        line_items: [
          {
            price_data: {
              currency,
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
      checkoutUrl = session.url;
      trialDaysApplied = plan.trial_days;
    }

    // Registra a assinatura como "incomplete" — o webhook promove para trialing/active
    // (ou, no boleto anual, direto para "active" com current_period_end de 1 ano,
    // só quando o boleto for de fato pago — ver payments/webhook/route.ts)
    await query(
      `INSERT INTO equalizagro.user_subscriptions (user_id, plan_id, status)
       VALUES ($1, $2, 'incomplete')`,
      [userId, planId]
    );

    console.log(`[Subscriptions] Checkout criado para ${user.email} (plano ${plan.name}, método ${paymentMethod || 'card'})`);

    return apiResponse({
      success: true,
      checkoutUrl,
      plan: { name: plan.name, price: plan.price, currency: plan.currency, trialDays: trialDaysApplied },
    });
  } catch (error) {
    return apiError(error);
  }
}
