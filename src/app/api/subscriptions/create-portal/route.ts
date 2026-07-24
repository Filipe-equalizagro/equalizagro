// app/api/subscriptions/create-portal/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { getStripe } from '@/lib/stripe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.equalizagro.com';

/**
 * POST - Cria uma sessão do Stripe Billing Portal, onde o usuário pode
 * ver faturas, trocar cartão e cancelar a assinatura por conta própria.
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    const result = await query(
      `SELECT stripe_customer_id FROM equalizagro.user_subscriptions
       WHERE user_id = $1 AND stripe_customer_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
      throw new ApiError(404, 'Nenhuma assinatura encontrada para este usuário');
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: result.rows[0].stripe_customer_id,
      return_url: `${APP_URL}/go2apply`,
    });

    return apiResponse({ success: true, portalUrl: session.url });
  } catch (error) {
    return apiError(error);
  }
}
