import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureConversationTables, ensureBillingExemptColumn } from '@/lib/db-init';
import { checkAccess } from '@/lib/subscriptions';

// Configurável via env — permite apontar para o webhook de DEV (com leitura
// de foto) sem mexer em código. Enquanto o backend de produção não tiver essa
// leitura, CONSULTOR_WEBHOOK_URL deve ficar apontando pro endpoint "-dev" (ver
// spec_frontend_envio_de_imagem.md, seção 12 — a virada é decisão do backend).
const N8N_WEBHOOK = process.env.CONSULTOR_WEBHOOK_URL || 'https://equalizagro.app.n8n.cloud/webhook/consultor-caldas';

// Formatos e limites aceitos pelo backend de leitura de foto — validar aqui
// evita gastar uma chamada ao n8n com algo que ele já ia rejeitar.
const ACCEPTED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGES = 3;
const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024; // ~7,5 MB, com margem

interface ImagemInput {
  data: string;
  mime: string;
}

function validarImagens(imagens: unknown): { ok: true; value: ImagemInput[] } | { ok: false; message: string } {
  if (!Array.isArray(imagens)) return { ok: false, message: 'Campo "imagens" inválido.' };
  if (imagens.length > MAX_IMAGES) return { ok: false, message: `Envie no máximo ${MAX_IMAGES} fotos por mensagem.` };
  for (const img of imagens) {
    if (!img || typeof img.data !== 'string' || typeof img.mime !== 'string') {
      return { ok: false, message: 'Foto inválida.' };
    }
    if (!ACCEPTED_IMAGE_MIMES.has(img.mime)) {
      return { ok: false, message: 'Formato de imagem não aceito. Envie JPEG, PNG ou WebP.' };
    }
    if (img.data.length > MAX_IMAGE_BASE64_LENGTH) {
      return { ok: false, message: 'Foto muito grande. Tente novamente com uma foto menor.' };
    }
  }
  return { ok: true, value: imagens as ImagemInput[] };
}

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
  // Título derivado da primeira mensagem do usuário
  const title = firstMessage
    ? firstMessage.substring(0, 60) + (firstMessage.length > 60 ? '…' : '')
    : 'Nova Conversa';

  // Só usa conversationId se for UUID válido do próprio usuário
  if (conversationId && UUID_RE.test(conversationId)) {
    const check = await query(
      `SELECT id, title, message_count FROM equalizagro.conversations WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
      [conversationId, userId]
    );
    if (check.rows.length > 0) {
      // Se a conversa ainda está com o título padrão, atualizar com a 1ª mensagem
      // (garante que o título correto apareça em outros dispositivos)
      const row = check.rows[0];
      if (firstMessage && (row.title === 'Nova Conversa' || Number(row.message_count) === 0)) {
        await query(
          `UPDATE equalizagro.conversations SET title = $1, updated_at = NOW() WHERE id = $2`,
          [title, conversationId]
        );
      }
      return conversationId;
    }
  }
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contextId, conversationId, token, imagens } = body;

    // Mensagem só é obrigatória quando não há foto — envio de foto é um
    // fluxo separado, sem legenda (ver spec_frontend_envio_de_imagem.md,
    // seção 9: o backend usa a foto e ignora o texto se os dois vierem
    // juntos, então a interface nunca deve combinar os dois).
    const temImagens = Array.isArray(imagens) && imagens.length > 0;
    if (!temImagens && !message?.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem obrigatória' }, { status: 400 });
    }

    let imagensValidadas: ImagemInput[] | undefined;
    if (temImagens) {
      const validacao = validarImagens(imagens);
      if (!validacao.ok) {
        return NextResponse.json({ success: false, message: validacao.message }, { status: 400 });
      }
      imagensValidadas = validacao.value;
    }

    const sessionId = contextId || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // ── Gate de acesso ──────────────────────────────────────────────
    // Só existem duas portas: isento (equipe/admin) ou assinatura ativa/
    // trial (mensal ou anual). Sem nenhuma das duas, bloqueia antes de
    // gastar com o n8n.
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '') || token;
    if (!authToken) {
      return NextResponse.json({ success: false, message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    if (!tablesReady) { await ensureConversationTables(); await ensureBillingExemptColumn(); tablesReady = true; }
    const userId = await getUserIdFromToken(authToken);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const access = await checkAccess(userId);
    if (!access.allowed) {
      return NextResponse.json({
        success: false,
        message: 'Assine um plano para continuar usando a Formação de Caldas.',
        requiresSubscription: true,
      }, { status: 402 });
    }

    // ── Chamar n8n ──────────────────────────────────────────────────
    // X-Aton-Key: token secreto de servidor para o n8n autenticar a origem
    // da chamada. Só é enviado se ATON_KEY estiver configurada (var de
    // ambiente no servidor — nunca chega ao navegador do cliente).
    const n8nHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.ATON_KEY) {
      n8nHeaders['X-Aton-Key'] = process.env.ATON_KEY;
    }
    // Log apenas se o header foi incluído (nunca loga o valor do token)
    console.log('[Chat] X-Aton-Key enviado:', Boolean(process.env.ATON_KEY));

    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: n8nHeaders,
      body: JSON.stringify({
        chatInput: message || '',
        sessionId,
        ...(imagensValidadas ? { imagens: imagensValidadas } : {}),
      }),
      // Leitura de foto demora mais (8–25s) que uma resposta de texto — 120s
      // já cobre isso com margem, sem precisar de um timeout separado.
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
    // Não guardamos a foto em si (só o n8n precisa dela) — só um texto
    // indicativo, pra o histórico/exportação não ficar com uma linha vazia.
    const messageParaSalvar = temImagens ? '📷 Foto enviada' : message;

    let savedConversationId: string | null = null;
    try {
      // upsertConversation: se conversationId for UUID válido do usuário, usa ele;
      // caso contrário cria nova conversa com o título da primeira mensagem.
      const convId = await upsertConversation(userId, conversationId, messageParaSalvar);
      await saveMessages(userId, convId, messageParaSalvar, responseText);
      savedConversationId = convId;
      console.log('[Chat] Salvo — userId:', userId, 'convId:', convId);
    } catch (e) {
      console.error('[Chat] Erro ao salvar no banco:', e);
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
