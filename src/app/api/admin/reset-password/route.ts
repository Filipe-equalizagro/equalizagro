import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';

async function verifyAdminToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) return false;

  try {
    const result = await query(
      `SELECT at.token_hash
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW()
         AND u.role = 'admin'
         AND u.deleted_at IS NULL`,
      []
    );
    for (const row of result.rows) {
      const match = await bcrypt.compare(token, row.token_hash);
      if (match) return true;
    }
  } catch (err) {
    console.error('[AdminResetPassword] Erro ao verificar token:', err);
  }
  return false;
}

export async function PATCH(request: NextRequest) {
  if (!(await verifyAdminToken(request))) {
    return NextResponse.json({ success: false, message: 'Acesso restrito a administradores' }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: 'Body inválido' }, { status: 400 }); }

  const { userId, password } = body;
  if (!userId) return NextResponse.json({ success: false, message: 'userId obrigatório' }, { status: 400 });
  if (!password || password.length < 6) {
    return NextResponse.json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `UPDATE equalizagro.users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [passwordHash, userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[AdminResetPassword] Erro:', err);
    return NextResponse.json({ success: false, message: 'Erro ao alterar senha' }, { status: 500 });
  }
}
