// app/api/auth/verification-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

/**
 * GET - Verifica se o email já foi confirmado (usado para polling na tela
 * de "Verifique seu email" — permite detectar que a pessoa confirmou pelo
 * link em outra aba/dispositivo, sem precisar recarregar manualmente).
 * Query params: email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    if (!email) {
      return NextResponse.json({ success: false, message: 'email é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT email_verified FROM equalizagro.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, verified: false });
    }

    return NextResponse.json({ success: true, verified: result.rows[0].email_verified === true });
  } catch (error) {
    console.error('[VerificationStatus]', error);
    return NextResponse.json({ success: false, verified: false }, { status: 500 });
  }
}
