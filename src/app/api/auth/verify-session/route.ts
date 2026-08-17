// src/app/api/auth/verify-session/route.ts
import { query } from '@/lib/database';
import { getSessionFromRequest } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Verificar se a sessão do usuário ainda é válida para acessar o ConsultorIA
 * Condições para sessão válida:
 * 1. Token válido (assinatura OK, não expirado, não revogado — ver lib/session.ts)
 * 2. Mesmo dispositivo (device fingerprint), quando ambos os lados o enviam
 */
export async function POST(request: NextRequest) {
  try {
    let deviceFingerprint = '';
    try {
      const body = await request.json();
      deviceFingerprint = body.deviceFingerprint || '';
    } catch {
      // Body vazio ou inválido, continuar sem fingerprint
    }

    const session = await getSessionFromRequest(request);
    if (!session) {
      const authHeader = request.headers.get('authorization');
      return NextResponse.json({
        valid: false,
        reason: authHeader?.startsWith('Bearer ') ? 'invalid_token' : 'no_token',
        message: authHeader?.startsWith('Bearer ') ? 'Token inválido ou expirado' : 'Token não fornecido',
      }, { status: 401 });
    }

    // Verificar se é o mesmo dispositivo (apenas se ambos os fingerprints existirem)
    if (deviceFingerprint) {
      const fpResult = await query(
        `SELECT device_fingerprint FROM equalizagro.users WHERE id = $1`,
        [session.userId]
      );
      const storedFingerprint = fpResult.rows[0]?.device_fingerprint;
      if (storedFingerprint && storedFingerprint !== deviceFingerprint) {
        console.log('[VerifySession] Dispositivo diferente detectado');
        return NextResponse.json({
          valid: false,
          reason: 'device_changed',
          message: 'Dispositivo diferente detectado. Por favor, faça login novamente.',
          userId: session.userId,
        });
      }
    }

    return NextResponse.json({
      valid: true,
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      isAdmin: session.role === 'admin',
    });

  } catch (error) {
    console.error('[VerifySession] Erro geral:', error);
    // Falha segura: negar acesso em vez de liberar sem validação
    return NextResponse.json({
      valid: false,
      reason: 'error',
      message: 'Erro inesperado ao verificar sessão. Faça login novamente.',
    }, { status: 500 });
  }
}
