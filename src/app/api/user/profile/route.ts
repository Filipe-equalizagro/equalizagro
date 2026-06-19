import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';

async function verifyToken(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) return null;

  try {
    const result = await query(
      `SELECT at.user_id, at.token_hash, u.email
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW() AND u.deleted_at IS NULL`,
      []
    );
    for (const row of result.rows) {
      const match = await bcrypt.compare(token, row.token_hash);
      if (match) return { userId: row.user_id, email: row.email };
    }
  } catch (err) {
    console.error('[ProfileAPI] Erro ao verificar token:', err);
  }
  return null;
}

// ── GET — retorna dados do perfil ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const session = await verifyToken(request);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, full_name, email, phone, COALESCE(role::text, 'client') AS role, created_at
       FROM equalizagro.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [session.userId]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('[ProfileAPI] Erro ao buscar perfil:', err);
    return NextResponse.json({ success: false, message: 'Erro ao buscar perfil' }, { status: 500 });
  }
}

// ── PATCH — atualiza nome e/ou email ──────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const session = await verifyToken(request);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: 'Body inválido' }, { status: 400 }); }

  const { name, email } = body;
  if (!name && !email) {
    return NextResponse.json({ success: false, message: 'Nenhum campo para atualizar' }, { status: 400 });
  }
  if (name && name.trim().length < 2) {
    return NextResponse.json({ success: false, message: 'Nome deve ter ao menos 2 caracteres' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: 'Email inválido' }, { status: 400 });
  }

  try {
    // Verifica se o novo email já está em uso por outro usuário
    if (email && email.toLowerCase() !== session.email.toLowerCase()) {
      const exists = await query(
        `SELECT id FROM equalizagro.users
         WHERE LOWER(email) = LOWER($1) AND id != $2 AND deleted_at IS NULL`,
        [email, session.userId]
      );
      if (exists.rows.length > 0) {
        return NextResponse.json({ success: false, message: 'Este email já está em uso' }, { status: 409 });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name) { updates.push(`full_name = $${idx++}`); params.push(name.trim()); }
    if (email) { updates.push(`email = $${idx++}`); params.push(email.toLowerCase()); }

    params.push(session.userId);
    const result = await query(
      `UPDATE equalizagro.users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, full_name, email, phone, COALESCE(role::text, 'client') AS role`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('[ProfileAPI] Erro ao atualizar perfil:', err);
    return NextResponse.json({ success: false, message: 'Erro ao atualizar perfil' }, { status: 500 });
  }
}
