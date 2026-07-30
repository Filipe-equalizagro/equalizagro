// app/api/payments/webhook/route.ts
// Webhook da Stripe — chamado automaticamente quando um pagamento ou uma
// assinatura muda de estado (criada, renovada, cancelada, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { apiResponse, apiError, ApiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

/**
 * Sincroniza o estado de uma assinatura Stripe na tabela user_subscriptions.
 * Tenta casar pelo stripe_subscription_id primeiro (já vinculada); se ainda
 * não houver vínculo (evento chegou antes do checkout.session.completed),
 * casa pelo metadata (userId + planId) da própria assinatura.
 */
async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  // Nas versões recentes da API, current_period_end não fica mais no nível
  // da assinatura — está em cada item (subscription.items.data[N]).
  const periodEndRaw = subscription.items?.data?.[0]?.current_period_end;
  const currentPeriodEnd = periodEndRaw ? new Date(periodEndRaw * 1000) : null;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const byId = await query(
    `UPDATE equalizagro.user_subscriptions
     SET status = $1, trial_end = $2, current_period_end = $3,
         cancel_at_period_end = $4, stripe_customer_id = $5, updated_at = NOW()
     WHERE stripe_subscription_id = $6
     RETURNING id`,
    [subscription.status, trialEnd, currentPeriodEnd, subscription.cancel_at_period_end, customerId, subscription.id]
  );
  if (byId.rows.length > 0) return;

  const userId = subscription.metadata?.userId;
  const planId = subscription.metadata?.planId;
  if (!userId || !planId) {
    console.warn('[StripeWebhook] Assinatura sem metadata para vincular:', subscription.id);
    return;
  }

  // IMPORTANTE: casa com UMA linha só (a "incomplete" mais recente), nunca
  // "WHERE user_id = ... AND plan_id = ... AND stripe_subscription_id IS NULL"
  // sem mais nada — como o cliente pode ter várias tentativas antigas
  // (incomplete/canceled) acumuladas pra esse mesmo plano, uma UPDATE sem
  // essa restrição tentava gravar o MESMO stripe_subscription_id em todas de
  // uma vez, e a segunda gravação sempre batia no índice único de
  // stripe_subscription_id — derrubando o webhook inteiro com erro 500 e
  // travando o cliente sem acesso, mesmo com o pagamento/trial aprovado.
  const byMetadata = await query(
    `UPDATE equalizagro.user_subscriptions
     SET stripe_subscription_id = $1, stripe_customer_id = $2, status = $3,
         trial_end = $4, current_period_end = $5, cancel_at_period_end = $6, updated_at = NOW()
     WHERE id = (
       SELECT id FROM equalizagro.user_subscriptions
       WHERE user_id = $7 AND plan_id = $8 AND stripe_subscription_id IS NULL AND status = 'incomplete'
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING id`,
    [subscription.id, customerId, subscription.status, trialEnd, currentPeriodEnd, subscription.cancel_at_period_end, userId, planId]
  );
  if (byMetadata.rows.length > 0) return;

  // Nenhuma linha pendente encontrada — cria o registro agora (caso raro de
  // evento fora de ordem ou assinatura criada fora do fluxo normal).
  // ON CONFLICT cobre a corrida real entre checkout.session.completed e
  // customer.subscription.created chegando quase juntos: se outro evento
  // concorrente já vinculou esse stripe_subscription_id entre nossa checagem
  // e este INSERT, apenas atualizamos a linha em vez de falhar com erro de
  // chave duplicada.
  await query(
    `INSERT INTO equalizagro.user_subscriptions
       (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, trial_end, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL
     DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       status = EXCLUDED.status,
       trial_end = EXCLUDED.trial_end,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [userId, planId, subscription.id, customerId, subscription.status, trialEnd, currentPeriodEnd, subscription.cancel_at_period_end]
  );
}

/**
 * POST - Webhook da Stripe (checkout.session.completed etc.)
 * A validação de assinatura exige o corpo BRUTO da requisição — por isso
 * usamos request.text() em vez de request.json() aqui.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('[StripeWebhook] Assinatura ou STRIPE_WEBHOOK_SECRET ausente');
    return NextResponse.json({ success: false, message: 'Configuração de webhook ausente' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[StripeWebhook] Assinatura inválida:', (err as Error).message);
    return NextResponse.json({ success: false, message: 'Assinatura inválida' }, { status: 400 });
  }

  try {
    // ── Assinaturas recorrentes (Mensal/Anual) ──────────────────────
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      return apiResponse({ success: true, message: 'Assinatura sincronizada' });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await query(
        `UPDATE equalizagro.user_subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );
      return apiResponse({ success: true, message: 'Assinatura cancelada' });
    }

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as {
        mode?: string;
        metadata?: Record<string, string>;
        payment_intent?: string;
        subscription?: string;
        customer?: string;
        id: string;
      };

      // Checkout de assinatura — o vínculo real (status/trial/período) é
      // sincronizado pelos eventos customer.subscription.*; aqui só
      // garantimos que o subscription_id/customer_id fiquem gravados cedo.
      if (session.mode === 'subscription') {
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        if (userId && planId && session.subscription) {
          // Mesma correção da nota acima em syncSubscriptionFromStripe: só UMA
          // linha (a "incomplete" mais recente), nunca todas as tentativas
          // antigas do mesmo user_id+plan_id de uma vez.
          await query(
            `UPDATE equalizagro.user_subscriptions
             SET stripe_subscription_id = $1, stripe_customer_id = $2, updated_at = NOW()
             WHERE id = (
               SELECT id FROM equalizagro.user_subscriptions
               WHERE user_id = $3 AND plan_id = $4 AND stripe_subscription_id IS NULL AND status = 'incomplete'
               ORDER BY created_at DESC
               LIMIT 1
             )`,
            [session.subscription, session.customer || null, userId, planId]
          );
        }
        return apiResponse({ success: true, message: 'Checkout de assinatura vinculado' });
      }

      // Boleto Anual — pagamento único pelo ano inteiro. IMPORTANTE: boleto
      // não é instantâneo (o cliente pode levar dias para pagar no banco),
      // então só liberamos acesso em 'async_payment_succeeded' — nunca em
      // 'checkout.session.completed' sozinho, que só significa que o boleto
      // foi EMITIDO, ainda não que foi pago.
      if (session.metadata?.kind === 'annual_boleto') {
        if (event.type !== 'checkout.session.async_payment_succeeded') {
          return apiResponse({ success: true, message: 'Boleto anual emitido — aguardando pagamento' });
        }

        const userId = session.metadata.userId;
        const planId = session.metadata.planId;
        if (!userId || !planId) {
          console.error('[StripeWebhook] annual_boleto sem metadata:', session.id);
          return apiResponse({ success: true, message: 'Sem metadata — ignorado' });
        }

        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 365);

        const updated = await query(
          `UPDATE equalizagro.user_subscriptions
           SET status = 'active', current_period_end = $1, stripe_customer_id = $2, updated_at = NOW()
           WHERE user_id = $3 AND plan_id = $4 AND status = 'incomplete' AND stripe_subscription_id IS NULL
           RETURNING id`,
          [periodEnd, session.customer || null, userId, planId]
        );

        if (updated.rows.length === 0) {
          console.log('[StripeWebhook] annual_boleto — nenhuma linha "incomplete" pendente (reenvio do evento ou já processado):', session.id);
        } else {
          console.log(`[StripeWebhook] Boleto anual pago — acesso liberado por 1 ano: userId=${userId}`);
        }

        return apiResponse({ success: true, message: 'Boleto anual pago — acesso liberado' });
      }

      const purchaseId = session.metadata?.purchaseId;

      if (!purchaseId) {
        console.error('[StripeWebhook] Sessão sem purchaseId no metadata:', session.id);
        return apiResponse({ success: true, message: 'Sem purchaseId — ignorado' });
      }

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

      // Idempotência — evita creditar duas vezes se a Stripe reenviar o evento
      if (purchase.payment_status === 'approved') {
        console.log(`[StripeWebhook] Compra já processada: ${purchaseId}`);
        return apiResponse({ success: true, message: 'Já processado' });
      }

      await query(
        `UPDATE equalizagro.credit_purchases
         SET payment_status = 'approved',
             paid_at = NOW(),
             payment_id = $1,
             payment_data = $2
         WHERE id = $3`,
        [session.payment_intent || session.id, JSON.stringify(session), purchaseId]
      );

      await query('SELECT equalizagro.add_credits($1, $2, $3)', [
        purchase.user_id,
        purchase.credits_purchased,
        purchaseId,
      ]);

      console.log(`[StripeWebhook] Créditos adicionados: ${purchase.credits_purchased} para ${purchase.email}`);

      return apiResponse({ success: true, message: 'Pagamento processado e créditos adicionados' });
    }

    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as { metadata?: Record<string, string> };
      const purchaseId = session.metadata?.purchaseId;
      if (purchaseId) {
        await query(
          `UPDATE equalizagro.credit_purchases SET payment_status = 'failed' WHERE id = $1 AND payment_status = 'pending'`,
          [purchaseId]
        );
      }

      // Checkout expirou ou o pagamento falhou sem nunca vincular uma
      // assinatura de verdade (stripe_subscription_id continua nulo) — vale
      // tanto pro boleto anual (pagamento único) quanto pra qualquer
      // assinatura recorrente abandonada. Sem isso, a linha "incomplete"
      // fica travada pra sempre e a pessoa nunca mais consegue tentar
      // assinar de novo (o check de "assinatura em andamento" bloqueia
      // qualquer novo checkout enquanto o status ficar "incomplete").
      const { userId, planId } = session.metadata || {};
      if (userId && planId) {
        await query(
          `UPDATE equalizagro.user_subscriptions SET status = 'canceled', updated_at = NOW()
           WHERE user_id = $1 AND plan_id = $2 AND status = 'incomplete' AND stripe_subscription_id IS NULL`,
          [userId, planId]
        );
      }

      return apiResponse({ success: true, message: 'Status atualizado' });
    }

    // Outros tipos de evento não são tratados, mas retornam 200 para a Stripe não re-tentar
    return apiResponse({ success: true, message: `Evento ${event.type} ignorado` });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET - Endpoint de simulação de pagamento (SOMENTE fora de produção).
 * Nunca deve existir em produção: permitiria a qualquer pessoa se
 * autocreditar chamando esta URL com um purchaseId válido.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, message: 'Não disponível' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get('purchaseId');

    if (!purchaseId) {
      throw new ApiError(400, 'purchaseId é obrigatório');
    }

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

    if (purchase.payment_status !== 'approved') {
      await query(
        `UPDATE equalizagro.credit_purchases
         SET payment_status = 'approved', paid_at = NOW(), payment_id = $1, payment_data = $2
         WHERE id = $3`,
        ['MOCK_' + Date.now(), JSON.stringify({ mock: true }), purchaseId]
      );
      await query('SELECT equalizagro.add_credits($1, $2, $3)', [
        purchase.user_id,
        purchase.credits_purchased,
        purchaseId,
      ]);
    }

    return apiResponse({
      success: true,
      message: 'Pagamento mock processado com sucesso! (apenas dev)',
      redirectTo: '/ConsultorIA',
    });
  } catch (error) {
    return apiError(error);
  }
}
