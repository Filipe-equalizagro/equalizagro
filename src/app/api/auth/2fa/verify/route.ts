// app/api/auth/2fa/verify/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError, getClientIp, getUserAgent } from '@/lib/api-utils';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';

export async function POST(request: NextRequest) {
  try {
    const { twoFactorId, code, deviceFingerprint } = await request.json();

    if (!twoFactorId || !code) {
      throw new ApiError(400, 'ID de 2FA e código são obrigatórios');
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new ApiError(400, 'Código 2FA deve ter 6 dígitos');
    }

    const ip = getClientIp(request);
    const userAgent = getUserAgent(request);

    // Buscar sessão 2FA
    let sessionResult;
    try {
      sessionResult = await query(
        `SELECT tfs.*, u.id as user_id, u.email, u.full_name, u.credits_balance,
                u.two_factor_enabled, u.two_factor_secret
         FROM equalizagro.two_factor_sessions tfs
         JOIN equalizagro.users u ON u.id = tfs.user_id
         WHERE tfs.id = $1 AND tfs.verified_at IS NULL`,
        [twoFactorId]
      );
    } catch (err) {
      console.error('[2FA] Erro ao buscar sessão 2FA:', err);
      throw new ApiError(500, 'Erro ao buscar sessão 2FA');
    }

    if (sessionResult.rows.length === 0) {
      throw new ApiError(404, 'Sessão 2FA não encontrada ou já verificada');
    }

    const session = sessionResult.rows[0];

    // Verificar se sessão expirou
    if (new Date(session.expires_at) < new Date()) {
      throw new ApiError(400, 'Código 2FA expirado. Solicite um novo.');
    }

    // Verificar número de tentativas
    if (session.code_attempts >= session.max_attempts) {
      throw new ApiError(429, 'Número máximo de tentativas excedido. Solicite um novo código.');
    }

    // Verificar código
    let codeMatch = false;
    const isTotp = Boolean(session.two_factor_enabled && session.two_factor_secret);

    if (isTotp) {
      try {
        codeMatch = speakeasy.totp.verify({
          secret: session.two_factor_secret,
          encoding: 'base32',
          token: code,
          window: 1,
        });
      } catch (err) {
        console.error('[2FA] Erro ao validar TOTP:', err);
        throw new ApiError(500, 'Erro ao validar código 2FA');
      }
    } else {
      codeMatch = await bcrypt.compare(code, session.code_hash);
    }

    // Atualizar tentativas
    try {
      await query(
        'UPDATE equalizagro.two_factor_sessions SET code_attempts = code_attempts + 1 WHERE id = $1',
        [twoFactorId]
      );
    } catch (err) {
      console.error('[2FA] Erro ao atualizar tentativas:', err);
    }

    if (!codeMatch) {
      // Registrar falha
      try {
        await query(
          `INSERT INTO equalizagro_audit.security_logs (
            event_type, user_id, ip_address, user_agent, status
          ) VALUES ('failed_2fa', $1, $2, $3, 'failed')`,
          [session.user_id, ip, userAgent]
        );
      } catch (err) {
        console.error('[2FA] Erro ao registrar falha:', err);
      }

      throw new ApiError(401, 'Código 2FA inválido');
    }

    // Marcar sessão como verificada
    try {
      await query(
        'UPDATE equalizagro.two_factor_sessions SET verified_at = NOW() WHERE id = $1',
        [twoFactorId]
      );
    } catch (err) {
      console.error('[2FA] Erro ao marcar sessão como verificada:', err);
      throw new ApiError(500, 'Erro ao processar verificação 2FA');
    }

    // Atualizar última verificação 2FA e device fingerprint
    try {
      await query(
        `UPDATE equalizagro.users 
         SET 
           last_2fa_verification = NOW(),
           device_fingerprint = $1
         WHERE id = $2`,
        [deviceFingerprint || 'unknown', session.user_id]
      );
    } catch (err) {
      console.error('[2FA] Erro ao atualizar device fingerprint:', err);
    }

    // Registrar login bem-sucedido
    try {
      await query(
        'SELECT equalizagro.log_user_login($1, $2, $3)',
        [session.user_id, ip, userAgent]
      );
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('[2FA] Função log_user_login não encontrada:', error.message);
    }

    // Registrar sucesso no audit
    try {
      await query(
        `INSERT INTO equalizagro_audit.security_logs (
          event_type, user_id, ip_address, user_agent, status
        ) VALUES ('user_2fa_verified', $1, $2, $3, 'success')`,
        [session.user_id, ip, userAgent]
      );
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('[2FA] Erro ao registrar no audit:', error.message);
    }

    // Gerar token de sessão
    let sessionToken;
    let tokenHash;
    try {
      sessionToken = crypto.randomBytes(32).toString('hex');
      tokenHash = await bcrypt.hash(sessionToken, 10);
    } catch (err) {
      console.error('[2FA] Erro ao gerar token:', err);
      throw new ApiError(500, 'Erro ao gerar token de sessão');
    }

    try {
      await query(
        `INSERT INTO equalizagro.auth_tokens (
          user_id,
          token_hash,
          ip_address,
          user_agent,
          expires_at
        ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
        [session.user_id, tokenHash, ip, userAgent]
      );
    } catch (err) {
      console.error('[2FA] Erro ao salvar token de sessão:', err);
      throw new ApiError(500, 'Erro ao criar sessão');
    }

    console.log(`[2FA] Verificação bem-sucedida: ${session.email}`);

    return apiResponse({
      success: true,
      message: 'Autenticação bem-sucedida',
      token: sessionToken,
      user: {
        id: session.user_id,
        email: session.email,
        name: session.full_name,
        credits: session.credits_balance,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
