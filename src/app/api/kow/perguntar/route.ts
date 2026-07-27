// app/api/kow/perguntar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/database';
import { ensureBillingExemptColumn } from '@/lib/db-init';
import { checkAccess } from '@/lib/subscriptions';
import { semRecomendacao } from '@/lib/kow-data';

const KOW_N8N_WEBHOOK = 'https://equalizagro.app.n8n.cloud/webhook/consultor-kow';
const KOW_ATON_KEY = process.env.KOW_ATON_KEY;

let tablesReady = false;

async function getUserIdFromToken(token: string): Promise<string | null> {
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
 * POST - Proxy do Consultor Kow pro webhook n8n (o n8n é a fonte de toda
 * a lógica: base de produtos, faixas de Kow e a IA — o front só exibe o
 * que vier). Mesmo gate de acesso do Consultor.IA: só isento ou assinatura
 * ativa/trial passam; sem nenhum dos dois, 402.
 * Body: { pergunta, sessionId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pergunta = String(body?.pergunta || '').trim().slice(0, 500);
    const sessionId = String(body?.sessionId || '').trim();
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!pergunta) {
      return NextResponse.json({ success: false, message: 'Pergunta vazia.' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ success: false, message: 'sessionId é obrigatório.' }, { status: 400 });
    }
    if (!authToken) {
      return NextResponse.json({ success: false, message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    if (!tablesReady) { await ensureBillingExemptColumn(); tablesReady = true; }
    const userId = await getUserIdFromToken(authToken);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const access = await checkAccess(userId);
    if (!access.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Assine um plano para continuar usando o Consultor Kow.',
        requiresSubscription: true,
      }, { status: 402 });
    }

    if (!KOW_ATON_KEY) {
      return NextResponse.json({ success: false, message: 'Servidor sem token do webhook configurado.' }, { status: 500 });
    }

    const r = await fetch(KOW_N8N_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aton-Key': KOW_ATON_KEY,
      },
      body: JSON.stringify({ pergunta, sessionId }),
      signal: AbortSignal.timeout(30000),
    });

    if (!r.ok) {
      console.error('[KowChat] Falha no webhook n8n:', r.status);
      return NextResponse.json({ success: false, message: 'Falha ao consultar o Consultor Kow.' }, { status: 502 });
    }

    const data = await r.json();
    const resposta = semRecomendacao(String(data?.resposta || 'Não consegui gerar uma resposta. Reformule a pergunta.'));

    return NextResponse.json({
      success: true,
      resposta,
      tipo: data?.tipo ?? null,
      opcoes: Array.isArray(data?.opcoes) ? data.opcoes : [],
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ success: false, message: 'O Consultor Kow demorou muito para responder. Tente novamente.' }, { status: 504 });
    }
    console.error('[KowChat] Erro:', err);
    return NextResponse.json({ success: false, message: 'Erro interno.' }, { status: 500 });
  }
}
