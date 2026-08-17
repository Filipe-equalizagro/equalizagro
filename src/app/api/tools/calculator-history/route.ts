import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ensureCalculatorHistoryTable } from '@/lib/db-init';
import { getSessionFromRequest } from '@/lib/session';

const MAX_HISTORY = 60;

/**
 * GET - Histórico de cálculos do usuário (mais recentes primeiro)
 * Auth: header Bearer, ou ?token=
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ success: false, entries: [] }, { status: 401 });
    const userId = session.userId;

    await ensureCalculatorHistoryTable();

    const result = await query(
      `SELECT entry
       FROM equalizagro.calculator_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT ${MAX_HISTORY}`,
      [userId]
    );

    const entries = result.rows.map(r => r.entry);
    return NextResponse.json({ success: true, entries });
  } catch (err) {
    console.error('[calculator-history GET]', err);
    return NextResponse.json({ success: false, entries: [] }, { status: 500 });
  }
}

/**
 * POST - Salvar um cálculo no histórico
 * Body: { token?, entry: { id, type, tabId, tabLabel, summary, data, time } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = body.entry;

    if (!entry || typeof entry !== 'object') {
      return NextResponse.json({ success: false, message: 'entry obrigatório' }, { status: 400 });
    }

    const session = await getSessionFromRequest(request, body);
    if (!session) return NextResponse.json({ success: false }, { status: 401 });
    const userId = session.userId;

    await ensureCalculatorHistoryTable();

    const clientId = Number.isFinite(Number(entry.id)) ? Number(entry.id) : null;

    await query(
      `INSERT INTO equalizagro.calculator_history (user_id, client_id, entry)
       VALUES ($1, $2, $3)`,
      [userId, clientId, JSON.stringify(entry)]
    );

    // Podar: manter apenas os MAX_HISTORY mais recentes do usuário
    await query(
      `DELETE FROM equalizagro.calculator_history
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM equalizagro.calculator_history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT ${MAX_HISTORY}
         )`,
      [userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[calculator-history POST]', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

/**
 * DELETE - Apagar todo o histórico do usuário
 * Auth: header Bearer, ou ?token=
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ success: false }, { status: 401 });
    const userId = session.userId;

    await ensureCalculatorHistoryTable();

    await query(
      `DELETE FROM equalizagro.calculator_history WHERE user_id = $1`,
      [userId]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[calculator-history DELETE]', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
