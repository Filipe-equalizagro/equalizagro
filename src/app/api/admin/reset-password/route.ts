import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { requireAdminSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function PATCH(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
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
