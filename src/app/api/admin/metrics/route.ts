import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureCalculatorUsageTable } from '@/lib/db-init';

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

export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) {
    return NextResponse.json({ success: false, message: 'Acesso restrito' }, { status: 403 });
  }

  try {
    await ensureCalculatorUsageTable();

    // ── Consultor.IA ──────────────────────────────────────────────

    const [consultorTotals, consultorPerUser, consultorDaily] = await Promise.all([
      query(`
        SELECT
          COUNT(DISTINCT c.id)                                          AS total_conversations,
          COUNT(m.id) FILTER (WHERE m.role = 'user')                    AS total_messages,
          COUNT(DISTINCT c.user_id)                                      AS active_users
        FROM equalizagro.conversations c
        LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
        WHERE c.is_deleted = false
      `, []),

      query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(DISTINCT c.id)                              AS conversations,
          COUNT(m.id) FILTER (WHERE m.role = 'user')        AS messages,
          MAX(c.last_message_at)                            AS last_active
        FROM equalizagro.users u
        JOIN equalizagro.conversations c ON c.user_id = u.id AND c.is_deleted = false
        LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.full_name, u.email
        ORDER BY messages DESC
        LIMIT 50
      `, []),

      query(`
        SELECT
          DATE_TRUNC('day', m.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
          COUNT(*) FILTER (WHERE m.role = 'user') AS messages
        FROM equalizagro.messages m
        WHERE m.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      `, []),
    ]);

    // ── Calculadora ───────────────────────────────────────────────

    const [calcByTab, calcByUser, calcDaily] = await Promise.all([
      query(`
        SELECT tab_id, tab_label, COUNT(*) AS total
        FROM equalizagro.calculator_usage
        GROUP BY tab_id, tab_label
        ORDER BY total DESC
      `, []),

      query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(cu.id)           AS total_uses,
          MAX(cu.created_at)     AS last_use
        FROM equalizagro.calculator_usage cu
        JOIN equalizagro.users u ON u.id = cu.user_id
        GROUP BY u.id, u.full_name, u.email
        ORDER BY total_uses DESC
        LIMIT 50
      `, []),

      query(`
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
          COUNT(*) AS uses
        FROM equalizagro.calculator_usage
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
      `, []),
    ]);

    return NextResponse.json({
      success: true,
      consultor: {
        totals:  consultorTotals.rows[0],
        perUser: consultorPerUser.rows,
        daily:   consultorDaily.rows,
      },
      calculator: {
        byTab:   calcByTab.rows,
        byUser:  calcByUser.rows,
        daily:   calcDaily.rows,
      },
    });
  } catch (err) {
    console.error('[admin/metrics]', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}
