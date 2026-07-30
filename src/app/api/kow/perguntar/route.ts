// app/api/kow/perguntar/route.ts
// Pergunta em texto livre pro Consultor Kow. A IA nunca recebe a base
// inteira — só os produtos que a própria pergunta cita (no máximo 3). O que
// não vai no prompt não pode ser extraído, por mais engenhosa que seja a
// pergunta. Ver src/lib/kow/catalog.ts (montarSystem/produtosRelevantes).
import { NextRequest, NextResponse } from 'next/server';
import { produtosRelevantes, montarSystem, semRecomendacao } from '@/lib/kow/catalog';
import { exigirAcesso, limiteExcedido, auditar } from '@/lib/kow/access';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KOW_MODEL || 'claude-haiku-4-5-20251001';

export async function POST(request: NextRequest) {
  const acesso = await exigirAcesso(request);
  if ('error' in acesso) return acesso.error;
  const { userId } = acesso;

  if (limiteExcedido(userId)) {
    return NextResponse.json({ erro: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const pergunta = String(body?.pergunta || '').trim().slice(0, 500);
  if (!pergunta) return NextResponse.json({ erro: 'Pergunta vazia.' }, { status: 400 });
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ erro: 'Servidor sem chave de API configurada.' }, { status: 500 });

  const relevantes = produtosRelevantes(pergunta);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: montarSystem(relevantes),
        messages: [{ role: 'user', content: pergunta }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!r.ok) {
      // O corpo do erro da Anthropic fica só no log do servidor — nunca no
      // corpo devolvido ao navegador. Ele pode ecoar de volta parte do que
      // enviamos (incluindo o prompt de sistema com a tabela de produtos),
      // e isso é visível na aba de rede do DevTools de qualquer cliente.
      const detalhe = await r.text();
      console.error('[KowPerguntar] Falha na IA:', r.status, detalhe.slice(0, 500));
      return NextResponse.json({ erro: 'Falha na IA. Tente novamente.' }, { status: 502 });
    }

    const data = await r.json();
    let texto = (data.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim();
    if (!texto) texto = 'Não consegui gerar uma resposta. Reformule a pergunta.';

    auditar(userId, { rota: 'perguntar', pergunta: pergunta.slice(0, 80), produtos: relevantes.map((p) => p.produto) });
    return NextResponse.json({ resposta: semRecomendacao(texto) });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ erro: 'A IA demorou muito para responder. Tente novamente.' }, { status: 504 });
    }
    console.error('[KowPerguntar] Erro interno:', err);
    return NextResponse.json({ erro: 'Erro interno. Tente novamente.' }, { status: 500 });
  }
}
