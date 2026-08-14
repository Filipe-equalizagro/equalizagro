// app/api/kow/sugestoes/route.ts
// Sugestões do autocompletar do Consultor Kow — devolve SÓ nomes, no máximo
// 8, a partir de 1 caractere (era 2 — a UX pedia a sugestão já na 1ª letra).
// Sem Kow, sem tendência, sem pH: digitar uma letra não vaza dado nenhum de
// produto, só o nome; o limitador de taxa e a auditoria seguem cobrindo
// enumeração ("a", "b", "c"...).
import { NextRequest, NextResponse } from 'next/server';
import { PRODUTOS, normalizar } from '@/lib/kow/catalog';
import { exigirAcesso, limiteExcedido, auditar } from '@/lib/kow/access';

const MAX_SUGESTOES = 8;

export async function GET(request: NextRequest) {
  const acesso = await exigirAcesso(request);
  if ('error' in acesso) return acesso.error;
  const { userId } = acesso;

  if (limiteExcedido(userId)) {
    return NextResponse.json({ erro: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = normalizar(searchParams.get('q')).slice(0, 60);
  if (q.length < 1) return NextResponse.json({ nomes: [] });

  const nomes = PRODUTOS
    .filter((p) => normalizar(p.produto).includes(q))
    .slice(0, MAX_SUGESTOES)
    .map((p) => p.produto);

  auditar(userId, { rota: 'sugestoes', q, n: nomes.length });
  return NextResponse.json({ nomes });
}
