import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';

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

/**
 * GET /api/admin/user-usage?userId=xxx
 * Retorna dados de uso detalhados de um usuário específico (apenas admins)
 */
export async function GET(request: NextRequest) {
  if (!(await verifyAdminToken(request))) {
    return NextResponse.json({ success: false, message: 'Acesso restrito' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, message: 'userId obrigatório' }, { status: 400 });
  }

  try {
    // Dados do usuário
    const userResult = await query(
      `SELECT id, full_name, email, credits_balance, created_at, last_login
       FROM equalizagro.users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Totais de conversas e mensagens
    const chatResult = await query(
      `SELECT
         COUNT(DISTINCT c.id)                              AS total_conversas,
         COUNT(m.id) FILTER (WHERE m.role = 'user')        AS total_mensagens,
         MAX(c.last_message_at)                            AS last_active
       FROM equalizagro.conversations c
       LEFT JOIN equalizagro.messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1 AND (c.is_deleted IS NOT TRUE)`,
      [userId]
    );

    const chat = chatResult.rows[0] || {};

    // Últimas 5 conversas
    const recentResult = await query(
      `SELECT id, title, message_count, last_message_at, created_at
       FROM equalizagro.conversations
       WHERE user_id = $1 AND (is_deleted IS NOT TRUE)
       ORDER BY COALESCE(last_message_at, created_at) DESC
       LIMIT 5`,
      [userId]
    );

    // Uso da calculadora
    let calcTotal = 0;
    let calcLastUse: string | null = null;
    let calcByTool: any[] = [];
    try {
      const calcResult = await query(
        `SELECT COUNT(*) AS total, MAX(created_at) AS last_use
         FROM equalizagro.calculator_usage
         WHERE user_id = $1`,
        [userId]
      );
      calcTotal = Number(calcResult.rows[0]?.total || 0);
      calcLastUse = calcResult.rows[0]?.last_use || null;

      const calcByToolResult = await query(
        `SELECT tab_label, COUNT(*) AS total
         FROM equalizagro.calculator_usage
         WHERE user_id = $1
         GROUP BY tab_label
         ORDER BY total DESC`,
        [userId]
      );
      calcByTool = calcByToolResult.rows;
    } catch { /* tabela pode não existir */ }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        creditsBalance: user.credits_balance,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
      chat: {
        totalConversas: Number(chat.total_conversas || 0),
        totalMensagens: Number(chat.total_mensagens || 0),
        lastActive: chat.last_active || null,
        recentConversations: recentResult.rows.map(r => ({
          id: r.id,
          title: r.title,
          messageCount: r.message_count,
          lastMessageAt: r.last_message_at,
          createdAt: r.created_at,
        })),
      },
      calculator: {
        totalUses: calcTotal,
        lastUse: calcLastUse,
        byTool: calcByTool,
      },
    });
  } catch (err) {
    console.error('[admin/user-usage]', err);
    return NextResponse.json({ success: false, message: 'Erro interno' }, { status: 500 });
  }
}
