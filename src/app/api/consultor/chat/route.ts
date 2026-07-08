import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureConversationTables } from '@/lib/db-init';

const N8N_WEBHOOK = 'https://equalizagro.app.n8n.cloud/webhook/consultor-caldas';

// Guard por instância serverless — evita rodar ALTER TABLE em toda invocação
let tablesReady = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function upsertConversation(userId: string, conversationId: string | null, firstMessage?: string): Promise<string> {
  // Só usa conversationId se for UUID válido
  if (conversationId && UUID_RE.test(conversationId)) {
    const check = await query(
      `SELECT id FROM equalizagro.conversations WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
      [conversationId, userId]
    );
    if (check.rows.length > 0) return conversationId;
  }
  // Gerar título a partir da primeira mensagem do usuário
  const title = firstMessage
    ? firstMessage.substring(0, 60) + (firstMessage.length > 60 ? '…' : '')
    : 'Nova Conversa';
  const result = await query(
    `INSERT INTO equalizagro.conversations
       (user_id, title, message_count, is_archived, is_deleted, created_at, updated_at)
     VALUES ($1, $2, 0, false, false, NOW(), NOW())
     RETURNING id`,
    [userId, title]
  );
  return result.rows[0].id;
}

async function saveMessages(userId: string, convId: string, userMsg: string, aiMsg: string): Promise<void> {
  await query(
    `INSERT INTO equalizagro.messages
       (conversation_id, user_id, role, content, created_at, updated_at)
     VALUES
       ($1, $2, 'user',      $3, NOW(), NOW()),
       ($1, $2, 'assistant', $4, NOW(), NOW())`,
    [convId, userId, userMsg, aiMsg]
  );
  await query(
    `UPDATE equalizagro.conversations
     SET message_count = message_count + 2,
         last_message_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [convId]
  );
  // Decrementar 1 crédito por troca de mensagem (user + assistant = 1 uso)
  await query(
    `UPDATE equalizagro.users
     SET credits_balance = GREATEST(credits_balance - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contextId, conversationId, token } = body;

    if (!message?.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem obrigatória' }, { status: 400 });
    }

    const sessionId = contextId || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // ── Chamar n8n ──────────────────────────────────────────────────
    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatInput: message, sessionId }),
      signal: AbortSignal.timeout(120000),
    });

    if (!n8nRes.ok) {
      console.error('[Chat] n8n erro:', n8nRes.status);
      return NextResponse.json({ success: false, message: 'Erro ao contatar o assistente.' }, { status: 502 });
    }

    const data = await n8nRes.json();
    const responseText = data.output || data.response || 'Sem resposta do assistente.';

    // ── Sempre salvar no banco (o route é a fonte da verdade) ──────────
    // O componente NÃO salva mais — apenas exibe. Isso garante que toda
    // interação com o n8n seja registrada independente do estado do frontend.
    let savedConversationId: string | null = null;
    const authToken = token || request.headers.get('authorization')?.replace('Bearer ', '');

    if (authToken) {
      try {
        if (!tablesReady) { await ensureConversationTables(); tablesReady = true; }
        const userId = await getUserIdFromToken(authToken);
        if (userId) {
          // upsertConversation: se conversationId for UUID válido do usuário, usa ele;
          // caso contrário cria nova conversa com o título da primeira mensagem.
          const convId = await upsertConversation(userId, conversationId, message);
          await saveMessages(userId, convId, message, responseText);
          savedConversationId = convId;
          console.log('[Chat] Salvo — userId:', userId, 'convId:', convId);
        } else {
          console.warn('[Chat] Token inválido ou expirado — mensagem não salva');
        }
      } catch (e) {
        console.error('[Chat] Erro ao salvar no banco:', e);
      }
    }

    return NextResponse.json({
      success: true,
      response: responseText,
      contextId: sessionId,
      // Sempre retorna o ID real para o frontend sincronizar seu estado local
      ...(savedConversationId ? { savedConversationId } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json({ success: false, message: 'A IA demorou muito para responder. Tente novamente.' }, { status: 504 });
    }
    console.error('[Chat] Erro:', err);
    return NextResponse.json({ success: false, message: 'Erro interno.' }, { status: 500 });
  }
}
