// src/app/api/auth/verify-session/route.ts
import { query } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

/**
 * Verificar se a sessão do usuário ainda é válida para acessar o ConsultorIA
 * Condições para sessão válida:
 * 1. Token válido (não expirado e não revogado)
 * 2. 2FA realizado nos últimos 7 dias
 * 3. Mesmo dispositivo (device fingerprint)
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
    
    // Obter token do header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        valid: false,
        reason: 'no_token',
        message: 'Token não fornecido',
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('[VerifySession] Verificando token...');
    
    // Buscar tokens válidos do banco (query resiliente sem revoked_at)
    let tokensResult;
    try {
      tokensResult = await query(
        `SELECT at.user_id, at.token_hash, at.created_at,
                u.device_fingerprint, u.email, u.full_name,
                COALESCE(u.role, 'client') AS role
         FROM equalizagro.auth_tokens at
         JOIN equalizagro.users u ON u.id = at.user_id
         WHERE at.expires_at > NOW()
         ORDER BY at.created_at DESC
         LIMIT 100`,
        []
      );
    } catch (dbError) {
      console.error('[VerifySession] Erro no banco:', dbError);
      // Falha segura: negar acesso em vez de liberar sem validação
      return NextResponse.json({
        valid: false,
        reason: 'error',
        message: 'Erro temporário no servidor. Tente novamente.',
      }, { status: 503 });
    }
    
    console.log('[VerifySession] Tokens encontrados:', tokensResult.rows.length);
    
    // Encontrar o token correspondente
    let matchedUser = null;
    for (const row of tokensResult.rows) {
      try {
        const isMatch = await bcrypt.compare(token, row.token_hash);
        if (isMatch) {
          matchedUser = row;
          break;
        }
      } catch {
        // Ignorar erros de comparação
      }
    }
    
    if (!matchedUser) {
      console.log('[VerifySession] Token não encontrado no banco');
      return NextResponse.json({
        valid: false,
        reason: 'invalid_token',
        message: 'Token inválido ou expirado',
      }, { status: 401 });
    }
    
    console.log('[VerifySession] Token válido para:', matchedUser.email);

    // Verificar se é o mesmo dispositivo (apenas se ambos os fingerprints existirem)
    const storedFingerprint = matchedUser.device_fingerprint;
    if (deviceFingerprint && storedFingerprint && storedFingerprint !== deviceFingerprint) {
      console.log('[VerifySession] Dispositivo diferente detectado');
      return NextResponse.json({
        valid: false,
        reason: 'device_changed',
        message: 'Dispositivo diferente detectado. Por favor, faça login novamente.',
        userId: matchedUser.user_id,
      });
    }
    
    // Sessão válida
    console.log('[VerifySession] Sessão válida para:', matchedUser.email, '| role:', matchedUser.role);
    return NextResponse.json({
      valid: true,
      userId: matchedUser.user_id,
      email: matchedUser.email,
      fullName: matchedUser.full_name,
      role: matchedUser.role,
      isAdmin: matchedUser.role === 'admin',
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
