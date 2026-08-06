// app/api/subscriptions/plans/route.ts
import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureSubscriptionTables } from '@/lib/db-init';
import { getBoletoPrice } from '@/lib/boleto-pricing';
import { hasEverHadTrial } from '@/lib/subscriptions';

/**
 * GET - Buscar planos de assinatura disponíveis (Mensal, Anual)
 * Query params: userId? — se informado, também devolve se essa pessoa já
 * teve um trial antes (pra tela de planos não prometer "grátis" de novo).
 */
export async function GET(request: NextRequest) {
  try {
    await ensureSubscriptionTables();

    const result = await query(
      `SELECT id, name, billing_interval, interval_count, price, currency, trial_days, display_order
       FROM equalizagro.subscription_plans
       WHERE is_active = true
       ORDER BY display_order ASC`,
      []
    );

    const userId = new URL(request.url).searchParams.get('userId');
    const hadTrialBefore = userId ? await hasEverHadTrial(userId) : false;

    return apiResponse({
      success: true,
      hadTrialBefore,
      plans: result.rows.map((plan: any) => ({
        ...plan,
        boleto_price: getBoletoPrice(plan.name) ?? null,
        // Anual no boleto é pagamento único do ano inteiro, não recorrência mensal
        boleto_is_one_time: plan.name === 'Anual',
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
