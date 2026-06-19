// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiResponse, apiError, validateEmail, getClientIp, getUserAgent } from '@/lib/api-utils';
import { query } from '@/lib/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, deviceFingerprint } = await request.json();
    const ip = getClientIp(request);
    const userAgent = getUserAgent(request);

    // Validações
    if (!email || !password) {
      throw new ApiError(400, 'Email e senha são obrigatórios');
    }

    if (!validateEmail(email)) {
      throw new ApiError(400, 'Email inválido');
    }

    if (password.length < 6) {
      throw new ApiError(400, 'Senha deve ter no mínimo 6 caracteres');
    }

    // Buscar usuário no banco de dados
    let userResult;
    try {
      userResult = await query(
        `SELECT
          id,
          email,
          full_name,
          password_hash,
          credits_balance,
          email_verified,
          auth_status,
          device_fingerprint
         FROM equalizagro.users
         WHERE LOWER(email) = LOWER($1)
           AND deleted_at IS NULL`,
        [email]
      );
    } catch (dbError) {
      console.error('[Login] Erro ao buscar usuário:', dbError);
      throw new ApiError(500, 'Erro ao conectar ao banco de dados. Tente novamente.');
    }

    if (userResult.rows.length === 0) {
      throw new ApiError(401, 'Email ou senha inválidos');
    }

    const user = userResult.rows[0];

    // Verificar se conta está ativa
    if (user.auth_status === 'suspended') {
      throw new ApiError(403, 'Conta suspensa. Entre em contato com o suporte.');
    }
    if (user.auth_status === 'inactive') {
      throw new ApiError(403, 'Conta inativa. Entre em contato com o suporte.');
    }
    if (user.auth_status === 'pending') {
      throw new ApiError(403, 'Conta aguardando aprovação. Entre em contato com o suporte.');
    }

    // Verificar se conta está bloqueada
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ApiError(423, 'Conta temporariamente bloqueada. Tente novamente mais tarde.');
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Registrar tentativa falhada
      await query(
        'SELECT equalizagro.log_failed_login($1, $2, $3)',
        [email, ip, userAgent]
      );
      throw new ApiError(401, 'Email ou senha inválidos');
    }

    // Verificar se email foi verificado
    if (!user.email_verified) {
      throw new ApiError(403, 'Email não verificado. Verifique seu email antes de fazer login.');
    }

    // Registrar login bem-sucedido
    await query(
      'SELECT equalizagro.log_user_login($1, $2, $3)',
      [user.id, ip, userAgent]
    );

    // Atualizar device fingerprint
    if (deviceFingerprint) {
      await query(
        'UPDATE equalizagro.users SET device_fingerprint = $1 WHERE id = $2',
        [deviceFingerprint, user.id]
      );
    }

    // Gerar token de sessão
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(sessionToken, 10);

    await query(
      `INSERT INTO equalizagro.auth_tokens (
        user_id,
        token_hash,
        ip_address,
        user_agent,
        expires_at
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, tokenHash, ip, userAgent]
    );

    console.log(`[Login] Login bem-sucedido: ${email}`);

    return apiResponse({
      success: true,
      message: 'Login bem-sucedido!',
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        credits: user.credits_balance,
      },
      token: sessionToken,
    });
  } catch (error) {
    return apiError(error);
  }
}
