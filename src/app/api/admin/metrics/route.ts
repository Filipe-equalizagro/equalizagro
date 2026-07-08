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
      if (await bcrypt.compare(token, row.token_hash)) return true;
    }
  } catch { /* ignorar */ }
  return false;
}

function dateRange(year: string, month: string): { from: string; to: string } | null {
  if (!year) return null;
  const y = parseInt(year);
  if (month) {
    const m = parseInt(month);
    return {
      from: new Date(y, m - 1, 1).toISOString(),
      to:   new Date(y, m,     1).toISOString(),
    };
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

    // Cláusulas de data — aplicadas sobre m.created_at (data real da mensagem)
    const msgDateFrom = range ? `AND m.created_at >= '${range.from}'` : '';
    const msgDateTo   = range ? `AND m.created_at  < '${range.to}'`   : '';
    const msgDate     = `${msgDateFrom} ${msgDateTo}`;

    const cuDateFrom  = range ? `AND cu.created_at >= '${range.from}'` : '';
    const cuDateTo    = range ? `AND cu.created_at  < '${range.to}'`   : '';
    const cuDate      = `${cuDateFrom} ${cuDateTo}`;

    // ── Consultor.IA — query direta em messages (sem join de conversations) ──
    // Cada linha com role='user' = uma pergunta enviada ao n8n + resposta recebida.
    let chatTotals = { total_interacoes: 0, total_conversas: 0, usuarios_ativos: 0 };
    let chatPerUser: any[] = [];

    try {
      const r1 = await query(`
        SELECT
          COUNT(*) FILTER (WHERE m.role = 'user')       AS total_interacoes,
          COUNT(DISTINCT m.conversation_id)              AS total_conversas,
          COUNT(DISTINCT m.user_id)                      AS usuarios_ativos
        FROM equalizagro.messages m
        WHERE 1=1 ${msgDate}
      `, []);
      if (r1.rows[0]) {
        chatTotals = {
          total_interacoes: Number(r1.rows[0].total_interacoes || 0),
          total_conversas:  Number(r1.rows[0].total_conversas  || 0),
          usuarios_ativos:  Number(r1.rows[0].usuarios_ativos  || 0),
        };
      }

      // Por usuário: conta mensagens enviadas (role='user') → cada uma = 1 interação com n8n
      const r2 = await query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(m.id) FILTER (WHERE m.role = 'user')        AS interacoes,
          COUNT(DISTINCT m.conversation_id)                  AS conversas,
          MAX(m.created_at)                                  AS last_active
        FROM equalizagro.users u
        JOIN equalizagro.messages m ON m.user_id = u.id
        WHERE u.deleted_at IS NULL ${msgDate}
        GROUP BY u.id, u.full_name, u.email
        HAVING COUNT(m.id) FILTER (WHERE m.role = 'user') > 0
        ORDER BY interacoes DESC
        LIMIT 50
      `, []);
      chatPerUser = r2.rows;

      console.log('[metrics] consultor totais:', chatTotals, 'perUser:', chatPerUser.length);
    } catch (e) {
      console.error('[metrics] consultor error:', e);
    }

    // ── calculator_usage ─────────────────────────────────────────
    let calcByTab: any[]  = [];
    let calcByUser: any[] = [];

    try {
      const r3 = await query(`
        SELECT tab_id, tab_label, COUNT(*) AS total
        FROM equalizagro.calculator_usage cu
        WHERE 1=1 ${cuDate}
        GROUP BY tab_id, tab_label
        ORDER BY total DESC
      `, []);
      calcByTab = r3.rows;

      const r4 = await query(`
        SELECT
          u.full_name,
          u.email,
          COUNT(cu.id)        AS total_uses,
          MAX(cu.created_at)  AS last_use
        FROM equalizagro.calculator_usage cu
        JOIN equalizagro.users u ON u.id = cu.user_id
        WHERE 1=1 ${cuDate}
        GROUP BY u.id, u.full_name, u.email
        ORDER BY total_uses DESC
        LIMIT 50
      `, []);
      calcByUser = r4.rows;
    } catch (e) {
      console.error('[metrics] calculator error:', e);
    }

    return NextResponse.json({
      success: true,
      period: { year: year || null, month: month || null },
      consultor: {
        totals:  chatTotals,
        perUser: chatPerUser,
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
