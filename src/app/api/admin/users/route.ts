import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ensureUserRoleEnumValues, ensureCpfColumn } from '@/lib/db-init';
import { validateCPF } from '@/lib/validators';
import { requireAdminSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

function forbidden() {
  return NextResponse.json({ success: false, message: 'Acesso restrito a administradores' }, { status: 403 });
}
function serverError(msg: string, err?: unknown) {
  console.error('[AdminAPI]', msg, err);
  return NextResponse.json({ success: false, message: msg }, { status: 500 });
}
function badRequest(msg: string) {
  return NextResponse.json({ success: false, message: msg }, { status: 400 });
}

// Valores válidos conforme o schema do banco
const VALID_ROLES   = ['admin', 'client', 'team', 'partner'];
const VALID_STATUS  = ['pending', 'verified', 'suspended', 'inactive'];

// ── GET — lista todos os usuários ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession(request))) return forbidden();

  try {
    await ensureCpfColumn();
    const result = await query(
      `SELECT
         id,
         full_name,
         email,
         phone,
         cpf,
         COALESCE(role::text, 'client')       AS role,
         COALESCE(auth_status::text, 'pending') AS auth_status,
         COALESCE(email_verified, false)       AS email_verified,
         COALESCE(credits_balance, 0)          AS credits_balance,
         created_at,
         last_login,
         company_name
       FROM equalizagro.users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`,
      []
    );

    return NextResponse.json({ success: true, users: result.rows });
  } catch (err) {
    return serverError('Erro ao buscar usuários no banco de dados', err);
  }
}

// ── POST — cria usuário já ativado (admin bypass verificação de email) ─────────
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession(request))) return forbidden();

  let body: any;
  try { body = await request.json(); }
  catch { return badRequest('Body inválido'); }

  const { name, email, phone, cpf, password, role = 'client', company_name } = body;

  if (!name || !email || !phone || !cpf || !password) {
    return badRequest('Nome, email, telefone, CPF e senha são obrigatórios');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('Email inválido');
  const cpfDigits = String(cpf).replace(/\D/g, '');
  if (!validateCPF(cpfDigits)) return badRequest('CPF inválido');
  if (password.length < 6) return badRequest('Senha deve ter no mínimo 6 caracteres');
  if (!VALID_ROLES.includes(role)) return badRequest('Role inválido');
  await ensureUserRoleEnumValues();
  await ensureCpfColumn();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    // Verifica se existe registro ativo com esse email
    const active = await query(
      'SELECT id FROM equalizagro.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email]
    );
    if (active.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'Email já cadastrado' }, { status: 409 });
    }

    // Mesmo CPF não pode estar associado a outra conta ativa
    const activeCpf = await query(
      'SELECT id FROM equalizagro.users WHERE cpf = $1 AND deleted_at IS NULL',
      [cpfDigits]
    );
    if (activeCpf.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'CPF já associado a outra conta' }, { status: 409 });
    }

    // Verifica se existe registro soft-deleted com esse email → restaura em vez de inserir
    const deleted = await query(
      'SELECT id FROM equalizagro.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NOT NULL',
      [email]
    );

    if (deleted.rows.length > 0) {
      const result = await query(
        `UPDATE equalizagro.users
         SET full_name=$1, phone=$2, password_hash=$3, email_verified=true,
             auth_status='verified', role=$4, company_name=$5, cpf=$6,
             deleted_at=NULL, updated_at=NOW()
         WHERE id=$7
         RETURNING id, full_name, email, role::text AS role, auth_status::text AS auth_status, created_at`,
        [name, phone, passwordHash, role, company_name || null, cpfDigits, deleted.rows[0].id]
      );
      return NextResponse.json({ success: true, user: result.rows[0] }, { status: 201 });
    }

    // Nenhum registro existente → INSERT normal
    const result = await query(
      `INSERT INTO equalizagro.users
         (email, phone, full_name, password_hash, email_verified, auth_status, role, company_name, cpf)
       VALUES ($1, $2, $3, $4, true, 'verified', $5, $6, $7)
       RETURNING id, full_name, email, role::text AS role, auth_status::text AS auth_status, created_at`,
      [email.toLowerCase(), phone, name, passwordHash, role, company_name || null, cpfDigits]
    );

    return NextResponse.json({ success: true, user: result.rows[0] }, { status: 201 });
  } catch (err) {
    return serverError('Erro ao criar usuário no banco de dados', err);
  }
}

// ── DELETE — soft delete (preenche deleted_at) ────────────────────────────────
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminSession(request))) return forbidden();

  let body: any;
  try { body = await request.json(); }
  catch { return badRequest('Body inválido'); }

  const { userId } = body;
  if (!userId) return badRequest('userId obrigatório');

  try {
    const res = await query(
      `UPDATE equalizagro.users
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [userId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('Erro ao remover usuário', err);
  }
}

// ── PATCH — atualiza role ou auth_status ──────────────────────────────────────
export async function PATCH(request: NextRequest) {
  if (!(await requireAdminSession(request))) return forbidden();

  let body: any;
  try { body = await request.json(); }
  catch { return badRequest('Body inválido'); }

  const { userId, auth_status, role } = body;
  if (!userId) return badRequest('userId obrigatório');

  const updates: string[] = [];
  const params: any[]     = [];
  let   idx               = 1;

  if (auth_status !== undefined) {
    if (!VALID_STATUS.includes(auth_status)) return badRequest(`auth_status inválido. Valores: ${VALID_STATUS.join(', ')}`);
    updates.push(`auth_status = $${idx++}`);
    params.push(auth_status);
  }
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) return badRequest(`role inválido. Valores: ${VALID_ROLES.join(', ')}`);
    // Garante que o enum do banco aceite 'team'/'partner' antes de gravar —
    // ver comentário em ensureUserRoleEnumValues (db-init.ts).
    await ensureUserRoleEnumValues();
    updates.push(`role = $${idx++}`);
    params.push(role);
  }
  if (!updates.length) return badRequest('Nenhum campo para atualizar');

  params.push(userId);
  try {
    const res = await query(
      `UPDATE equalizagro.users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING id, role::text AS role, auth_status::text AS auth_status`,
      params
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: res.rows[0] });
  } catch (err) {
    return serverError('Erro ao atualizar usuário', err);
  }
}
