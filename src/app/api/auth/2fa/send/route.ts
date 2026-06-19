// app/api/auth/2fa/send/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { twoFactorId } = await request.json();

    if (!twoFactorId) {
      throw new ApiError(400, 'ID de 2FA é obrigatório');
    }

    // Buscar sessão 2FA
    let sessionResult;
    try {
      sessionResult = await query(
        `SELECT id, expires_at
         FROM equalizagro.two_factor_sessions
         WHERE id = $1 AND verified_at IS NULL`,
        [twoFactorId]
      );
    } catch (err) {
      console.error('[2FA] Erro ao buscar sessão:', err);
      throw new ApiError(500, 'Erro ao buscar sessão 2FA');
    }

    if (sessionResult.rows.length === 0) {
      throw new ApiError(404, 'Sessão 2FA não encontrada ou já verificada');
    }

    const session = sessionResult.rows[0];

    if (new Date(session.expires_at) < new Date()) {
      throw new ApiError(400, 'Sessão 2FA expirada. Solicite um novo login.');
    }

    // Gerar novo código e atualizar hash
    const code = Math.random().toString().slice(2, 8);
    const codeHash = await bcrypt.hash(code, 10);

    try {
      await query(
        `UPDATE equalizagro.two_factor_sessions
         SET code_hash = $1, code_attempts = 0, expires_at = NOW() + INTERVAL '5 minutes'
         WHERE id = $2`,
        [codeHash, twoFactorId]
      );
    } catch (err) {
      console.error('[2FA] Erro ao atualizar sessão 2FA:', err);
      throw new ApiError(500, 'Erro ao gerar novo código 2FA');
    }

    console.log(`[2FA] Código gerado para ${twoFactorId}: ${code}`);
    console.log('[2FA] TODO: Enviar via Email/SMS');

    return apiResponse({
      success: true,
      message: 'Código 2FA enviado com sucesso',
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
}
