// app/api/auth/verify-email/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError } from '@/lib/api-utils';
import { query } from '@/lib/database';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      throw new ApiError(400, 'Token de verificação é obrigatório');
    }

    // Buscar verificação de email
    let verificationResult;
    try {
      verificationResult = await query(
        `SELECT ev.*, u.id as user_id, u.email, u.full_name
         FROM equalizagro.email_verifications ev
         JOIN equalizagro.users u ON u.id = ev.user_id
         WHERE ev.token = $1 AND ev.is_verified = false`,
        [token]
      );
    } catch (err) {
      console.error('[VerifyEmail] Erro ao buscar verificação:', err);
      throw new ApiError(500, 'Erro ao buscar verificação de email');
    }

    if (verificationResult.rows.length === 0) {
      throw new ApiError(404, 'Token de verificação inválido ou já utilizado');
    }

    const verification = verificationResult.rows[0];

    // Verificar se token expirou
    if (new Date(verification.expires_at) < new Date()) {
      throw new ApiError(400, 'Token de verificação expirado. Solicite um novo.');
    }

    // Verificar número de tentativas
    if (verification.attempts >= verification.max_attempts) {
      throw new ApiError(429, 'Número máximo de tentativas excedido. Solicite um novo token.');
    }

    // Atualizar tentativas
    try {
      await query(
        'UPDATE equalizagro.email_verifications SET attempts = attempts + 1 WHERE id = $1',
        [verification.id]
      );
    } catch (err) {
      console.error('[VerifyEmail] Erro ao atualizar tentativas:', err);
    }

    // Marcar email como verificado
    try {
      await query(
        `UPDATE equalizagro.email_verifications 
         SET is_verified = true, verified_at = NOW() 
         WHERE id = $1`,
        [verification.id]
      );
    } catch (err) {
      console.error('[VerifyEmail] Erro ao marcar email como verificado:', err);
      throw new ApiError(500, 'Erro ao verificar email');
    }

    // Atualizar status do usuário
    try {
      await query(
        `UPDATE equalizagro.users 
         SET email_verified = true, auth_status = 'verified' 
         WHERE id = $1`,
        [verification.user_id]
      );
    } catch (err) {
      console.error('[VerifyEmail] Erro ao atualizar usuário:', err);
      throw new ApiError(500, 'Erro ao atualizar perfil do usuário');
    }

    // Gerar secret para Google Authenticator (2FA)
    let secret;
    try {
      secret = speakeasy.generateSecret({
        name: `EqualizAgro (${verification.email})`,
        issuer: 'EqualizAgro',
        length: 32,
      });
    } catch (err) {
      console.error('[VerifyEmail] Erro ao gerar secret 2FA:', err);
      throw new ApiError(500, 'Erro ao configurar autenticação de 2 fatores');
    }

    // Salvar secret no banco
    try {
      await query(
        `UPDATE equalizagro.users 
         SET two_factor_secret = $1, two_factor_enabled = true 
         WHERE id = $2`,
        [secret.base32, verification.user_id]
      );
    } catch (err) {
      console.error('[VerifyEmail] Erro ao salvar secret 2FA:', err);
      throw new ApiError(500, 'Erro ao salvar configuração de 2FA');
    }

    // Gerar QR Code
    let qrCodeUrl;
    try {
      qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
    } catch (err) {
      console.error('[VerifyEmail] Erro ao gerar QR Code:', err);
      throw new ApiError(500, 'Erro ao gerar QR Code');
    }

    console.log(`[VerifyEmail] Email verificado: ${verification.email}`);
    console.log(`[VerifyEmail] 2FA Secret: ${secret.base32}`);

    return apiResponse({
      success: true,
      message: 'Email verificado com sucesso!',
      userId: verification.user_id,
      twoFactorSetup: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntry: secret.base32,
      },
      nextStep: 'payment', // Redirecionar para página de pagamento
    });
  } catch (error) {
    return apiError(error);
  }
}
