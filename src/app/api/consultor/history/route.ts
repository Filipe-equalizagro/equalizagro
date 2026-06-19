// app/api/consultor/history/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';

/**
 * GET - Buscar histórico de consultas do usuário
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, limit = 50, offset = 0 } = await request.json();

    if (!userId) {
      throw new ApiError(400, 'userId é obrigatório');
    }

    // Buscar histórico
    const result = await query(
      `SELECT 
        id,
        question_data,
        question_text,
        ai_response,
        credits_used,
        was_reused,
        processing_time_ms,
        created_at
       FROM equalizagro.ai_consultations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Contar total
    const countResult = await query(
      'SELECT COUNT(*) as total FROM equalizagro.ai_consultations WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].total);

    return apiResponse({
      success: true,
      history: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
