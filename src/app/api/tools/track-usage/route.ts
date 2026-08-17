import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ensureCalculatorUsageTable } from '@/lib/db-init';
import { getSessionFromRequest } from '@/lib/session';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabId } = body;

    if (!tabId) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const session = await getSessionFromRequest(request, body);
    if (!session) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const userId = session.userId;

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
