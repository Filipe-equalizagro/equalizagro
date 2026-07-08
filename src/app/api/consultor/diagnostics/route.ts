import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureConversationTables } from '@/lib/db-init';

/**
 * Diagnóstico de persistência do histórico do ConsultorIA.
 * Uso: GET /api/consultor/diagnostics?token=SEU_TOKEN
 *  (pegue o token no navegador: localStorage.getItem('authToken'))
 *
 * Retorna, em ordem, cada etapa da persistência com sucesso/erro, para
 * identificar EXATAMENTE onde o salvamento do histórico está falhando.
 */
export async function GET(request: NextRequest) {
  const steps: any[] = [];
  const record = (name: string, ok: boolean, detail?: any) =>
    steps.push({ step: name, ok, detail });

  const url = new URL(request.url);
  const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = url.searchParams.get('token') || headerToken || '';

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Forneça ?token=SEU_TOKEN', steps });
  }

  // 1) Resolver userId a partir do token
  let userId: string | null = null;
  try {
    const r = await query(
      `SELECT at.user_id, at.token_hash, u.email
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW() AND u.deleted_at IS NULL`,
      []
    );
    for (const row of r.rows) {
      if (await bcrypt.compare(token, row.token_hash)) { userId = row.user_id; break; }
    }
    record('resolver_userId', Boolean(userId), userId ? { userId } : 'token não corresponde a nenhuma sessão válida');
  } catch (e) {
    record('resolver_userId', false, (e as Error).message);
  }

  if (!userId) {
    return NextResponse.json({ ok: false, userId: null, steps });
  }

  // 2) Garantir/curar tabelas
  try {
    await ensureConversationTables();
    record('ensureConversationTables', true);
  } catch (e) {
    record('ensureConversationTables', false, (e as Error).message);
  }

  // 3) Listar colunas reais das tabelas (revela schema divergente)
  try {
    const cols = await query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'equalizagro'
         AND table_name IN ('conversations', 'messages')
       ORDER BY table_name, ordinal_position`,
      []
    );
    const byTable: Record<string, string[]> = {};
    for (const c of cols.rows) {
      (byTable[c.table_name] ||= []).push(`${c.column_name}:${c.data_type}`);
    }
    record('schema_colunas', true, byTable);
  } catch (e) {
    record('schema_colunas', false, (e as Error).message);
  }

  // 4) Contagem atual do usuário
  try {
    const conv = await query(`SELECT COUNT(*) n FROM equalizagro.conversations WHERE user_id = $1 AND is_deleted = false`, [userId]);
    const msg = await query(`SELECT COUNT(*) n FROM equalizagro.messages WHERE user_id = $1`, [userId]);
    record('contagem_atual', true, {
      conversas: Number(conv.rows[0].n),
      mensagens: Number(msg.rows[0].n),
    });
  } catch (e) {
    record('contagem_atual', false, (e as Error).message);
  }

  // 5) Round-trip real: INSERT conversa + mensagens → SELECT de volta → apagar
  let testConvId: string | null = null;
  try {
    const ins = await query(
      `INSERT INTO equalizagro.conversations
         (user_id, title, message_count, is_archived, is_deleted, created_at, updated_at)
       VALUES ($1, $2, 0, false, false, NOW(), NOW())
       RETURNING id`,
      [userId, '[DIAGNÓSTICO] pode apagar']
    );
    testConvId = ins.rows[0].id;
    record('teste_insert_conversa', true, { testConvId });
  } catch (e) {
    record('teste_insert_conversa', false, (e as Error).message);
  }

  if (testConvId) {
    try {
      await query(
        `INSERT INTO equalizagro.messages
           (conversation_id, user_id, role, content, created_at, updated_at)
         VALUES ($1, $2, 'user', 'ping diagnóstico', NOW(), NOW()),
                ($1, $2, 'assistant', 'pong diagnóstico', NOW(), NOW())`,
        [testConvId, userId]
      );
      record('teste_insert_mensagens', true);
    } catch (e) {
      record('teste_insert_mensagens', false, (e as Error).message);
    }

    try {
      const back = await query(
        `SELECT COUNT(*) n FROM equalizagro.messages WHERE conversation_id = $1`,
        [testConvId]
      );
      record('teste_select_de_volta', true, { mensagens_lidas: Number(back.rows[0].n) });
    } catch (e) {
      record('teste_select_de_volta', false, (e as Error).message);
    }

    // Limpeza: apagar a conversa de teste (hard delete)
    try {
      await query(`DELETE FROM equalizagro.messages WHERE conversation_id = $1`, [testConvId]);
      await query(`DELETE FROM equalizagro.conversations WHERE id = $1`, [testConvId]);
      record('teste_limpeza', true);
    } catch (e) {
      record('teste_limpeza', false, (e as Error).message);
    }
  }

  const allOk = steps.every(s => s.ok);
  return NextResponse.json({ ok: allOk, userId, steps });
}
