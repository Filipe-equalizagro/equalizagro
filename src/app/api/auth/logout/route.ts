// app/api/auth/logout/route.ts
// Antes desta rota não existir, "logout" era só localStorage.removeItem no
// cliente — o token continuava válido no servidor até expirar sozinho (até
// 7 dias). Aqui a sessão é revogada de verdade:
//  - token_version é incrementado, invalidando todos os JWTs já emitidos
//    pra esse usuário (mesmo em outro dispositivo/aba).
//  - linhas antigas em auth_tokens (formato pré-migração) são apagadas.
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ensureTokenVersionColumn } from '@/lib/db-init';
import { getSessionFromRequest } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      // Sem sessão válida pra revogar — do ponto de vista do cliente, ele já
      // está deslogado, então não é um erro.
      return NextResponse.json({ success: true });
    }

    await ensureTokenVersionColumn();
    await query(
      `UPDATE equalizagro.users SET token_version = token_version + 1 WHERE id = $1`,
      [session.userId]
    );
    await query(`DELETE FROM equalizagro.auth_tokens WHERE user_id = $1`, [session.userId]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Logout] Erro:', err);
    // Falha ao revogar não deve travar o usuário na tela — o cliente limpa o
    // token local de qualquer forma.
    return NextResponse.json({ success: true });
  }
}
