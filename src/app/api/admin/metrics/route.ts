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

function dateRange(year: string, month: string): { from: string; to: string } | null {
  if (!year) return null;
  const y = parseInt(year);
  if (month) {
    const m = parseInt(month);
    const from = new Date(y, m - 1, 1).toISOString();
    const to   = new Date(y, m,     1).toISOString();
    return { from, to };
  }
  return {
    from: new Date(y,     0, 1).toISOString(),
    to:   new Date(y + 1, 0, 1).toISOString(),
  };
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
    const range = dateRange(year, month);

    const dateClause = range
      ? `AND created_at >= '${range.from}' AND created_at < '${range.to}'`
      : '';
    const acDateClause = range
      ? `AND ac.created_at >= '${range.from}' AND ac.created_at < '${range.to}'`
      : '';
    const cDateClause = range
      ? `AND c.created_at >= '${range.from}' AND c.created_at < '${range.to}'`
      : '';

    // ── ai_consultations ─────────────────────────────────────────
    let aiTotals = { total_consultas: 0, active_users: 0, credits_consumed: 0 };
    let aiPerUser: any[] = [];

    try {
      const r1 = await query(`
        SELECT
          COUNT(*)                              AS total_consultas,
          COUNT(DISTINCT user_id)               AS active_users,
          COALESCE(SUM(credits_used), 0)        AS credits_consumed
        FROM equalizagro.ai_consultations
        WHERE 1=1 ${dateClause}
      `, []);
      if (r1.rows[0]) aiTotals = r1.rows[0];

      const r2 = await query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(ac.id)                          AS consultas,
          COALESCE(SUM(ac.credits_used), 0)     AS credits_used,
          MAX(ac.created_at)                    AS last_active
        FROM equalizagro.users u
        JOIN equalizagro.ai_consultations ac ON ac.user_id = u.id
        WHERE u.deleted_at IS NULL ${acDateClause}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY consultas DESC
        LIMIT 50
      `, []);
      aiPerUser = r2.rows;
    } catch (e) {
      console.error('[metrics] ai_consultations error:', e);
    }

    // ── conversations / messages ──────────────────────────────────
    let chatTotals = { total_conversas: 0, total_mensagens: 0, chat_users: 0 };
    let chatPerUser: any[] = [];
    let debug = { total_conversas_sem_filtro: 0, total_mensagens_sem_filtro: 0 };

    try {
      // Query de diagnóstico: total sem filtro de data
      const rd = await query(`
        SELECT
          COUNT(DISTINCT c.id)                       AS total_conversas,
          COUNT(m.id) FILTER (WHERE m.role = 'user') AS total_mensagens
        FROM equalizagro.conversations c
        LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
        WHERE (c.is_deleted IS NOT TRUE)
      `, []);
      if (rd.rows[0]) debug = { total_conversas_sem_filtro: Number(rd.rows[0].total_conversas), total_mensagens_sem_filtro: Number(rd.rows[0].total_mensagens) };
      console.log('[metrics] debug totais sem filtro:', debug);

      const r3 = await query(`
        SELECT
          COUNT(DISTINCT c.id)                                    AS total_conversas,
          COUNT(m.id) FILTER (WHERE m.role = 'user')              AS total_mensagens,
          COUNT(DISTINCT c.user_id)                               AS chat_users
        FROM equalizagro.conversations c
        LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
        WHERE (c.is_deleted IS NOT TRUE) ${cDateClause}
      `, []);
      if (r3.rows[0]) chatTotals = r3.rows[0];

      const r4 = await query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(DISTINCT c.id)                              AS conversas,
          COUNT(m.id) FILTER (WHERE m.role = 'user')        AS mensagens,
          MAX(c.last_message_at)                            AS last_active
        FROM equalizagro.users u
        JOIN equalizagro.conversations c ON c.user_id = u.id
        LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
        WHERE u.deleted_at IS NULL
          AND (c.is_deleted IS NOT TRUE) ${cDateClause}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY mensagens DESC
        LIMIT 50
      `, []);
      chatPerUser = r4.rows;
    } catch (e) {
      console.error('[metrics] conversations error:', e);
    }

    // ── calculator_usage ─────────────────────────────────────────
    let calcByTab: any[]  = [];
    let calcByUser: any[] = [];

    try {
      const r5 = await query(`
        SELECT tab_id, tab_label, COUNT(*) AS total
        FROM equalizagro.calculator_usage
        WHERE 1=1 ${dateClause}
        GROUP BY tab_id, tab_label
        ORDER BY total DESC
      `, []);
      calcByTab = r5.rows;

      const r6 = await query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(cu.id)        AS total_uses,
          MAX(cu.created_at)  AS last_use
        FROM equalizagro.calculator_usage cu
        JOIN equalizagro.users u ON u.id = cu.user_id
        WHERE 1=1 ${dateClause.replace(/created_at/g, 'cu.created_at')}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY total_uses DESC
        LIMIT 50
      `, []);
      calcByUser = r6.rows;
    } catch (e) {
      console.error('[metrics] calculator_usage error:', e);
    }

    return NextResponse.json({
      success: true,
      period: { year: year || null, month: month || null },
      debug,
      consultor: {
        ai:   { totals: aiTotals,   perUser: aiPerUser },
        chat: { totals: chatTotals, perUser: chatPerUser },
      },
      calculator: {
        byTab:  calcByTab,
        byUser: calcByUser,
      },
    });
  } catch (err) {
    console.error('[admin/metrics]', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}
