import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { sendPasswordResetEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ success: false, message: 'Email obrigatório' }, { status: 400 });

    // Busca usuário ativo
    const result = await query(
      `SELECT id, full_name, email FROM equalizagro.users
       WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL AND auth_status = 'verified'`,
      [email]
    );

    // Resposta genérica para não revelar se o email existe
    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, message: 'Se o email existir, você receberá as instruções.' });
    }

    const user = result.rows[0];

    // Gera token raw e armazena hash na tabela two_factor_sessions (expires em 1h)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const session = await query(
      `INSERT INTO equalizagro.two_factor_sessions (user_id, code_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')
       RETURNING id`,
      [user.id, tokenHash]
    );

    const sessionId = session.rows[0].id;
    await sendPasswordResetEmail(user.email, user.full_name, rawToken, sessionId);

    return NextResponse.json({ success: true, message: 'Se o email existir, você receberá as instruções.' });
  } catch (err) {
    console.error('[ForgotPassword]', err);
    return NextResponse.json({ success: false, message: 'Erro ao processar solicitação.' }, { status: 500 });
  }
}
