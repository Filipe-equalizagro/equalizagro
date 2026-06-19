// app/api/consultor/check-credits/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * GET - Verificar saldo de créditos do usuário
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    // Buscar saldo de créditos
    const result = await query(
      `SELECT 
        id,
        full_name,
        email,
        credits_balance,
        total_credits_purchased
       FROM equalizagro.users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Usuário não encontrado');
    }

    const user = result.rows[0];

    return apiResponse({
      success: true,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
      },
      credits: {
        balance: user.credits_balance,
        totalPurchased: user.total_credits_purchased,
        canConsult: user.credits_balance > 0,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
