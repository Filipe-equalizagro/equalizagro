// app/api/payments/plans/route.ts
import { NextRequest } from 'next/server';
import { apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * GET - Buscar todos os planos disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT 
        id,
        name,
        description,
        credits_amount,
        price,
        currency,
        display_order
       FROM equalizagro.credit_plans
       WHERE is_active = true
       ORDER BY display_order ASC`
    );

    return apiResponse({
      success: true,
      plans: result.rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
