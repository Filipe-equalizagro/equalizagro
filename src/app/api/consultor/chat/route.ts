import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK = 'https://equalizagro.app.n8n.cloud/webhook/consultor-caldas';

export async function POST(request: NextRequest) {
  try {
    const { message, contextId } = await request.json();

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem obrigatória' }, { status: 400 });
    }

    const sessionId = contextId || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatInput: message, sessionId }),
      signal: AbortSignal.timeout(120000),
    });

    if (!n8nRes.ok) {
      console.error('[Chat] n8n respondeu com erro:', n8nRes.status);
      return NextResponse.json({ success: false, message: 'Erro ao contatar o assistente.' }, { status: 502 });
    }

    const data = await n8nRes.json();
    const responseText = data.output || data.response || 'Sem resposta do assistente.';

    return NextResponse.json({ success: true, response: responseText, contextId: sessionId });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ success: false, message: 'A IA demorou muito para responder. Tente novamente.' }, { status: 504 });
    }
    console.error('[Chat] Erro:', err);
    return NextResponse.json({ success: false, message: 'Erro interno.' }, { status: 500 });
  }
}
