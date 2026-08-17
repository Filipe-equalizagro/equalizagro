// lib/kow/access.ts
// Autenticação e limite de taxa do Consultor Kow — tudo same-origin agora,
// então reaproveita a sessão normal do site (Bearer token + checkAccess()),
// sem token cruzado entre domínios.
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/subscriptions';
import { getSessionFromRequest, type Session } from '@/lib/session';

/* Cache em memória do resultado token -> sessão. Com JWT a verificação em si
   já é rápida (assinatura, sem bcrypt), mas ainda faz uma consulta indexada
   ao banco pra checar token_version/suspensão — e o autocompletar do Kow
   dispara uma chamada a cada tecla digitada. Cachear evita repetir essa
   consulta dezenas de vezes por segundo. O token em si já é o segredo da
   sessão, então cacheá-lo em memória do servidor por alguns minutos não abre
   brecha nenhuma. */
const TOKEN_CACHE_TTL_MS = 5 * 60_000;
const sessionCache = new Map<string, { session: Session | null; expiresAt: number }>();

async function getCachedSession(request: NextRequest): Promise<Session | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const cached = sessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.session;

  const session = await getSessionFromRequest(request);
  sessionCache.set(token, { session, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  if (sessionCache.size > 2000) sessionCache.clear();
  return session;
}

/**
 * Confere sessão + acesso pago. Devolve o userId em caso de sucesso, ou uma
 * NextResponse de erro pronta pra devolver (401/402) — falha fechada.
 */
export async function exigirAcesso(request: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await getCachedSession(request);
  if (!session) {
    return { error: NextResponse.json({ erro: 'Sessão expirada. Faça login novamente.' }, { status: 401 }) };
  }
  const userId = session.userId;
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
