import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureCalculatorUsageTable, ensureConversationTables } from '@/lib/db-init';

async function verifyAdminToken(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) return false;
  try {
    const result = await query(
      `SELECT at.token_hash
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW()
         AND u.role = 'admin'
         AND u.deleted_at IS NULL`,
      []
    );
    for (const row of result.rows) {
      const match = await bcrypt.compare(token, row.token_hash);
      if (match) return true;
    }
  } catch { /* ignorar */ }
  return false;
}

function buildDateFilter(col: string, year?: string, month?: string): { clause: string; params: (string | number)[] } {
  if (!year) return { clause: '', params: [] };
  if (!month) {
    return {
      clause: `AND EXTRACT(YEAR FROM ${col}) = $__YEAR__`,
      params: [parseInt(year)],
    };
  }
  return {
    clause: `AND EXTRACT(YEAR FROM ${col}) = $__YEAR__ AND EXTRACT(MONTH FROM ${col}) = $__MONTH__`,
    params: [parseInt(year), parseInt(month)],
  };
}

function injectParams(sql: string, clause: string, params: (string | number)[], startIdx: number): { sql: string; params: (string | number)[] } {
  let idx = startIdx;
  const injected = clause
    .replace('$__YEAR__',  () => `$${idx++}`)
    .replace('$__MONTH__', () => `$${idx++}`);
  return { sql: sql + ' ' + injected, params };
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) {
    return NextResponse.json({ success: false, message: 'Acesso restrito' }, { status: 403 });
  }

  try {
    await Promise.all([ensureCalculatorUsageTable(), ensureConversationTables()]);

    const { searchParams } = new URL(request.url);
    const year  = searchParams.get('year')  || '';
    const month = searchParams.get('month') || '';

    const df = buildDateFilter('created_at', year, month);

    // ── ai_consultations ─────────────────────────────────────────
    const aiTotSql = injectParams(
      `SELECT COUNT(*) AS total_consultas, COUNT(DISTINCT user_id) AS active_users, COALESCE(SUM(credits_used),0) AS credits_consumed
       FROM equalizagro.ai_consultations WHERE 1=1`,
      df.clause, df.params, 1
    );
    const aiUserSql = injectParams(
      `SELECT u.full_name, u.email, COUNT(ac.id) AS consultas, COALESCE(SUM(ac.credits_used),0) AS credits_used, MAX(ac.created_at) AS last_active
       FROM equalizagro.users u
       JOIN equalizagro.ai_consultations ac ON ac.user_id = u.id
       WHERE u.deleted_at IS NULL`,
      df.clause.replace(/created_at/g, 'ac.created_at'), df.params, 1
    );

    const [aiTotals, aiPerUser] = await Promise.all([
      query(aiTotSql.sql, df.params),
      query(aiUserSql.sql + ' GROUP BY u.id, u.full_name, u.email ORDER BY consultas DESC LIMIT 50', df.params),
    ]);

    // ── conversations / messages ──────────────────────────────────
    const chatDF = buildDateFilter('c.created_at', year, month);
    const chatTotSql = injectParams(
      `SELECT COUNT(DISTINCT c.id) AS total_conversas,
              COUNT(m.id) FILTER (WHERE m.role = 'user') AS total_mensagens,
              COUNT(DISTINCT c.user_id) AS chat_users
       FROM equalizagro.conversations c
       LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
       WHERE c.is_deleted = false`,
      chatDF.clause, chatDF.params, 1
    );
    const chatUserSql = injectParams(
      `SELECT u.full_name, u.email,
              COUNT(DISTINCT c.id) AS conversas,
              COUNT(m.id) FILTER (WHERE m.role = 'user') AS mensagens,
              MAX(c.last_message_at) AS last_active
       FROM equalizagro.users u
       JOIN equalizagro.conversations c ON c.user_id = u.id AND c.is_deleted = false
       LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
       WHERE u.deleted_at IS NULL`,
      chatDF.clause, chatDF.params, 1
    );

    const [chatTotals, chatPerUser] = await Promise.all([
      query(chatTotSql.sql, chatDF.params),
      query(chatUserSql.sql + ' GROUP BY u.id, u.full_name, u.email ORDER BY mensagens DESC LIMIT 50', chatDF.params),
    ]);

    // ── calculator_usage ─────────────────────────────────────────
    const calcTabSql = injectParams(
      `SELECT tab_id, tab_label, COUNT(*) AS total FROM equalizagro.calculator_usage WHERE 1=1`,
      df.clause, df.params, 1
    );
    const calcUserSql = injectParams(
      `SELECT u.full_name, u.email, COUNT(cu.id) AS total_uses, MAX(cu.created_at) AS last_use
       FROM equalizagro.calculator_usage cu
       JOIN equalizagro.users u ON u.id = cu.user_id
       WHERE 1=1`,
      df.clause.replace(/created_at/g, 'cu.created_at'), df.params, 1
    );

    const [calcByTab, calcByUser] = await Promise.all([
      query(calcTabSql.sql + ' GROUP BY tab_id, tab_label ORDER BY total DESC', df.params),
      query(calcUserSql.sql + ' GROUP BY u.id, u.full_name, u.email ORDER BY total_uses DESC LIMIT 50', df.params),
    ]);

    return NextResponse.json({
      success: true,
      period: { year: year || null, month: month || null },
      consultor: {
        ai:   { totals: aiTotals.rows[0],   perUser: aiPerUser.rows },
        chat: { totals: chatTotals.rows[0], perUser: chatPerUser.rows },
      },
      calculator: {
        byTab:  calcByTab.rows,
        byUser: calcByUser.rows,
      },
    });
  } catch (err) {
    console.error('[admin/metrics]', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}
