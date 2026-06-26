import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { ensureCalculatorUsageTable } from '@/lib/db-init';

const TAB_LABELS: Record<string, string> = {
  iso:      'Bicos ISO',
  sistema:  'Sistema',
  aerea:    'Aérea',
  conversao:'Conversões',
  fluxo:    'Fluxômetro',
  desgaste: 'Desgaste',
  espectro: 'Espectro',
  deltat:   'Delta T',
};

async function getUserId(token: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT at.user_id, at.token_hash
       FROM equalizagro.auth_tokens at
       JOIN equalizagro.users u ON u.id = at.user_id
       WHERE at.expires_at > NOW()
         AND u.deleted_at IS NULL`,
      []
    );
    for (const row of result.rows) {
      const match = await bcrypt.compare(token, row.token_hash);
      if (match) return row.user_id;
    }
  } catch { /* ignorar */ }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabId, token } = body;

    if (!tabId || !token) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const userId = await getUserId(token);
    if (!userId) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    await ensureCalculatorUsageTable();

    await query(
      `INSERT INTO equalizagro.calculator_usage (user_id, tab_id, tab_label)
       VALUES ($1, $2, $3)`,
      [userId, tabId, TAB_LABELS[tabId] || tabId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[track-usage]', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
