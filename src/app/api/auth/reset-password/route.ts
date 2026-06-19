import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, sessionId, password } = await request.json();

    if (!token || !sessionId || !password) {
      return NextResponse.json({ success: false, message: 'Dados incompletos.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    // Busca sessão válida (não usada, não expirada)
    const session = await query(
      `SELECT id, user_id, code_hash FROM equalizagro.two_factor_sessions
       WHERE id = $1 AND verified_at IS NULL AND expires_at > NOW()`,
      [sessionId]
    );

    if (session.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Link inválido ou expirado.' }, { status: 400 });
    }

    const row = session.rows[0];

    // Valida token
    const valid = await bcrypt.compare(token, row.code_hash);
    if (!valid) {
      return NextResponse.json({ success: false, message: 'Link inválido ou expirado.' }, { status: 400 });
    }

    // Atualiza senha e marca sessão como usada
    const newHash = await bcrypt.hash(password, 12);

    await query(
      `UPDATE equalizagro.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, row.user_id]
    );

    await query(
      `UPDATE equalizagro.two_factor_sessions SET verified_at = NOW() WHERE id = $1`,
      [sessionId]
    );

    return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('[ResetPassword]', err);
    return NextResponse.json({ success: false, message: 'Erro ao redefinir senha.' }, { status: 500 });
  }
}
