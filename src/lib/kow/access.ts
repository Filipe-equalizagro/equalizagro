// lib/kow/access.ts
// Autenticação e limite de taxa do Consultor Kow — tudo same-origin agora,
// então reaproveita a sessão normal do site (Bearer token + checkAccess()),
// sem token cruzado entre domínios.
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/database';
import { checkAccess } from '@/lib/subscriptions';

export async function getUserIdFromToken(token: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT at.user_id, at.token_hash
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW() AND u.deleted_at IS NULL`,
      []
    );
    for (const row of result.rows) {
      if (await bcrypt.compare(token, row.token_hash)) return row.user_id;
    }
  } catch { /* ignorar */ }
  return null;
}

/**
 * Confere sessão + acesso pago. Devolve o userId em caso de sucesso, ou uma
 * NextResponse de erro pronta pra devolver (401/402) — falha fechada.
 */
export async function exigirAcesso(request: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!authToken) {
    return { error: NextResponse.json({ erro: 'Sessão expirada. Faça login novamente.' }, { status: 401 }) };
  }
  const userId = await getUserIdFromToken(authToken);
  if (!userId) {
    return { error: NextResponse.json({ erro: 'Sessão expirada. Faça login novamente.' }, { status: 401 }) };
  }
  const access = await checkAccess(userId);
  if (!access.allowed) {
    return { error: NextResponse.json({ erro: 'Assine um plano para continuar usando o Consultor Kow.', requiresSubscription: true }, { status: 402 }) };
  }
  return { userId };
}

/* Limitador de taxa em memória, por usuário — 40 consultas por minuto.
   Numa função serverless o estado não é compartilhado entre instâncias, então
   isto barra o abuso ingênuo, não um ataque distribuído (mesma ressalva do
   pacote original). */
const JANELA_MS = 60_000;
const LIMITE_POR_JANELA = 40;
const acessos = new Map<string, { inicio: number; n: number }>();

export function limiteExcedido(userId: string): boolean {
  const chave = `u:${userId}`;
  const agora = Date.now();
  const reg = acessos.get(chave);
  if (!reg || agora - reg.inicio > JANELA_MS) {
    acessos.set(chave, { inicio: agora, n: 1 });
    if (acessos.size > 5000) acessos.clear();
    return false;
  }
  reg.n += 1;
  return reg.n > LIMITE_POR_JANELA;
}

/** Auditoria: quem consultou o quê — vai pros logs da Vercel (Observability). */
export function auditar(userId: string, dados: Record<string, unknown>): void {
  console.log(JSON.stringify({ evt: 'consulta', usuario: userId, ...dados, em: new Date().toISOString() }));
}
