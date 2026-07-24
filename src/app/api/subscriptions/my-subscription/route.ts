// app/api/subscriptions/my-subscription/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureSubscriptionTables, ensureBillingExemptColumn } from '@/lib/db-init';
import { checkAccess } from '@/lib/subscriptions';

/**
 * GET - Status da assinatura atual do usuário (se houver)
 * Query params: userId
 */
export async function GET(request: NextRequest) {
  try {
    await ensureSubscriptionTables();
    await ensureBillingExemptColumn();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    const access = await checkAccess(userId);

    const result = await query(
      `SELECT us.status, us.trial_end, us.current_period_end, us.cancel_at_period_end,
              sp.name AS plan_name, sp.price, sp.currency, sp.billing_interval
       FROM equalizagro.user_subscriptions us
       JOIN equalizagro.subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1
         AND us.status IN ('trialing', 'active', 'past_due')
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return apiResponse({ success: true, subscription: null, hasAccess: access.allowed });
    }

    const row = result.rows[0];
    return apiResponse({
      success: true,
      subscription: {
        status: row.status,
        planName: row.plan_name,
        price: row.price,
        currency: row.currency,
        billingInterval: row.billing_interval,
        trialEnd: row.trial_end,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      },
      hasAccess: access.allowed,
    });
  } catch (error) {
    return apiError(error);
  }
}
