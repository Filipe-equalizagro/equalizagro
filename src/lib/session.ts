// lib/session.ts
// Ponto único de verificação de sessão para toda a API — antes disso existiam
// 12 cópias quase idênticas desse código espalhadas pelas rotas, cada uma
// bcrypt.compare-ando o token contra toda a tabela auth_tokens (sem índice
// possível, já que o hash tem salt aleatório). Aqui:
//  - Token novo (JWT): verificado por assinatura, sem tocar o banco; depois
//    UMA consulta indexada por id confere token_version (revogação) e
//    auth_status/deleted_at (suspensão/exclusão fazem efeito na hora).
//  - Token antigo (formato legado, emitido antes da migração): mantém o
//    fallback de bcrypt.compare contra auth_tokens, só até expirarem
//    sozinhos (7 dias da emissão) — ninguém é deslogado pela migração.
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from './database';
import { verifySessionToken, looksLikeJwt } from './jwt';
import { ensureTokenVersionColumn } from './db-init';

export interface Session {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  creditsBalance: number;
}

function extractToken(request: NextRequest, body?: any): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7).trim();
  if (body && typeof body.token === 'string' && body.token) return body.token;
  const queryToken = request.nextUrl?.searchParams.get('token');
  if (queryToken) return queryToken;
  return null;
}

async function loadActiveUser(userId: string): Promise<Session | null> {
  const result = await query(
    `SELECT id, email, full_name, COALESCE(role::text, 'client') AS role, COALESCE(credits_balance, 0) AS credits_balance
     FROM equalizagro.users
     WHERE id = $1 AND deleted_at IS NULL AND COALESCE(auth_status::text, 'pending') NOT IN ('suspended', 'inactive')`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { userId: row.id, email: row.email, fullName: row.full_name, role: row.role, creditsBalance: Number(row.credits_balance) };
}

async function verifyJwtSession(token: string): Promise<Session | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  await ensureTokenVersionColumn();
  const result = await query(
    `SELECT id, email, full_name, token_version,
            COALESCE(role::text, 'client') AS role, COALESCE(credits_balance, 0) AS credits_balance
     FROM equalizagro.users
     WHERE id = $1 AND deleted_at IS NULL AND COALESCE(auth_status::text, 'pending') NOT IN ('suspended', 'inactive')`,
    [payload.sub]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  // token_version diferente = sessão revogada (logout, ou forçada por admin)
  // mesmo que o JWT ainda não tenha expirado.
  if (Number(row.token_version) !== payload.tv) return null;

  return { userId: row.id, email: row.email, fullName: row.full_name, role: row.role, creditsBalance: Number(row.credits_balance) };
}

/**
 * Fallback para tokens emitidos ANTES da migração pro JWT — formato antigo
 * (crypto.randomBytes(32).toString('hex')), hash bcrypt guardado em
 * auth_tokens. Só existe até essas sessões expirarem sozinhas (7 dias da
 * emissão) — nenhum login novo gera mais esse formato.
 */
async function verifyLegacyToken(token: string): Promise<Session | null> {
  const result = await query(
    `SELECT at.user_id, at.token_hash
     FROM equalizagro.auth_tokens at
     WHERE at.expires_at > NOW()`,
    []
  );

  for (const row of result.rows) {
    try {
      if (await bcrypt.compare(token, row.token_hash)) {
        return loadActiveUser(row.user_id);
      }
    } catch { /* hash inválido, ignora */ }
  }
  return null;
}

/**
 * Verifica a sessão da requisição. Retorna null se não houver token, se o
 * token for inválido/expirado, ou se o usuário estiver suspenso/excluído.
 * `body` é opcional — só é usado quando a rota já leu o corpo da requisição
 * e quer permitir token via `{ token }` no JSON (compatibilidade com rotas
 * antigas que aceitavam isso; novas integrações devem usar o header).
 */
export async function getSessionFromRequest(request: NextRequest, body?: any): Promise<Session | null> {
  const token = extractToken(request, body);
  if (!token) return null;

  if (looksLikeJwt(token)) return verifyJwtSession(token);
  return verifyLegacyToken(token);
}

/**
 * Mesma verificação de sessão, mas exige role 'admin'. Usado pelas rotas
 * /api/admin/* — antes cada uma tinha sua própria cópia dessa checagem.
 */
export async function requireAdminSession(request: NextRequest, body?: any): Promise<Session | null> {
  const session = await getSessionFromRequest(request, body);
  if (!session || session.role !== 'admin') return null;
  return session;
}
