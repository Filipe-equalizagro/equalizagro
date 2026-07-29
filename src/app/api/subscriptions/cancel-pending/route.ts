// app/api/subscriptions/cancel-pending/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * POST - Chamado pelo front assim que o usuário volta do Checkout da Stripe
 * pelo cancel_url (cancelou o pagamento ou apertou "voltar"). A Stripe NÃO
 * dispara nenhum webhook nesse momento — checkout.session.expired só chega
 * depois de ~24h de sessão abandonada. Sem essa limpeza imediata, a linha
 * "incomplete" criada ao gerar o checkout ficava bloqueando qualquer nova
 * tentativa de assinatura por até 24h (ver checagem de duplicidade em
 * create-checkout/route.ts).
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    await query(
      `UPDATE equalizagro.user_subscriptions
       SET status = 'canceled', updated_at = NOW()
       WHERE user_id = $1 AND status = 'incomplete' AND stripe_subscription_id IS NULL`,
      [userId]
    );

    return apiResponse({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
