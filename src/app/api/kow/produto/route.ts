// app/api/kow/produto/route.ts
// Consulta de UM produto — nome exato, ou uma frase que o contenha (prefere o
// nome mais específico/longo). A base inteira nunca é devolvida por aqui.
import { NextRequest, NextResponse } from 'next/server';
import { PRODUTOS, normalizar } from '@/lib/kow/catalog';
import { exigirAcesso, limiteExcedido, auditar } from '@/lib/kow/access';

export async function POST(request: NextRequest) {
  const acesso = await exigirAcesso(request);
  if ('error' in acesso) return acesso.error;
  const { userId } = acesso;

  if (limiteExcedido(userId)) {
    return NextResponse.json({ erro: 'Muitas consultas. Aguarde um instante.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const texto = normalizar(body?.texto).slice(0, 200);
  if (!texto) return NextResponse.json({ erro: 'Informe o produto.' }, { status: 400 });

  let achado = PRODUTOS.find((p) => normalizar(p.produto) === texto);
  if (!achado) {
    const candidatos = PRODUTOS
      .filter((p) => texto.includes(normalizar(p.produto)))
      .sort((a, b) => b.produto.length - a.produto.length);
    achado = candidatos[0];
  }

  auditar(userId, { rota: 'produto', consulta: texto.slice(0, 60), achou: achado ? achado.produto : null });
  return NextResponse.json({ produto: achado || null });
}
