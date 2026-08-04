// app/api/auth/register/route.ts
import { NextRequest } from 'next/server';
import { ApiError, apiResponse, apiError, validateEmail, validatePassword, getClientIp } from '@/lib/api-utils';
import { query } from '@/lib/database';
import { ensureBillingExemptColumn, ensureTermsAcceptanceColumns, ensureUserRoleEnumValues } from '@/lib/db-init';
import { sendVerificationEmail } from '@/lib/email';
import { isExemptEmail } from '@/lib/billing-exempt';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Data da versão vigente dos Termos de Uso / Política de Privacidade
// (mesma data de "Última atualização" nos dois PDFs em public/docs/).
const TERMS_VERSION = '2026-07-24';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone, cargo, regiao, interesse, comoConheceu, role, termsAccepted } = await request.json();

    // Validações
    if (!email || !password || !name || !phone) {
      throw new ApiError(400, 'Email, senha, nome e telefone são obrigatórios');
    }

    // Cadastro de cliente (não equipe) exige aceite explícito dos Termos de
    // Uso e da Política de Privacidade antes de criar a conta.
    if (role !== 'team' && termsAccepted !== true) {
      throw new ApiError(400, 'É necessário aceitar os Termos de Uso e a Política de Privacidade para se cadastrar');
    }

    if (!validateEmail(email)) {
      throw new ApiError(400, 'Email inválido');
    }

    if (!validatePassword(password)) {
      throw new ApiError(400, 'Senha deve ter: 8+ caracteres, maiúscula, minúscula, número e caractere especial');
    }

    if (name.length < 3) {
      throw new ApiError(400, 'Nome deve ter no mínimo 3 caracteres');
    }

    if (phone.length < 10) {
      throw new ApiError(400, 'Telefone inválido');
    }

    // Verificar se já existe uma conta ATIVA com esse email
    let existingUser;
    try {
      existingUser = await query(
        'SELECT id FROM equalizagro.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
        [email]
      );
    } catch (err) {
      console.error('[Register] Erro ao verificar email:', err);
      throw new ApiError(500, 'Erro ao verificar disponibilidade do email');
    }

    if (existingUser.rows.length > 0) {
      throw new ApiError(409, 'Este email já está cadastrado');
    }

    // Verificar se existe uma conta EXCLUÍDA (soft delete) com esse email —
    // se houver, reaproveita o registro em vez de tentar inserir um novo
    // (email é único na tabela; sem isso, quem excluiu a conta nunca
    // conseguiria se cadastrar de novo com o mesmo email).
    let deletedUserId: string | null = null;
    try {
      const deletedUser = await query(
        'SELECT id FROM equalizagro.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NOT NULL',
        [email]
      );
      if (deletedUser.rows.length > 0) deletedUserId = deletedUser.rows[0].id;
    } catch (err) {
      console.error('[Register] Erro ao verificar conta excluída:', err);
      throw new ApiError(500, 'Erro ao verificar disponibilidade do email');
    }

    // Hash da senha
    let passwordHash;
    try {
      passwordHash = await bcrypt.hash(password, 12);
    } catch (err) {
      console.error('[Register] Erro ao fazer hash da senha:', err);
      throw new ApiError(500, 'Erro ao processar senha');
    }

    // Gerar token de verificação de email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Equipe/admin da lista interna tem acesso ilimitado desde o cadastro
    const billingExempt = isExemptEmail(email);
    try {
      await ensureBillingExemptColumn();
      await ensureTermsAcceptanceColumns();
    } catch (err) {
      console.error('[Register] Erro ao garantir colunas billing_exempt/terms:', err);
    }

    const termsAcceptedAt = termsAccepted === true ? new Date() : null;

    // Definir role: 'team' exige token de admin válido no header Authorization
    let userRole = 'client';
    if (role === 'team') {
      const authHeader = request.headers.get('authorization');
      const callerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!callerToken) {
        throw new ApiError(403, 'Somente administradores podem criar contas de equipe');
      }

      // Buscar apenas tokens de usuários com role = 'admin' (conjunto pequeno)
      let callerIsAdmin = false;
      try {
        const adminTokens = await query(
          `SELECT at.token_hash
           FROM equalizagro.auth_tokens at
           JOIN equalizagro.users u ON u.id = at.user_id
           WHERE at.expires_at > NOW()
             AND COALESCE(u.role, 'client') = 'admin'
           ORDER BY at.created_at DESC
           LIMIT 20`,
          []
        );
        for (const row of adminTokens.rows) {
          try {
            const isMatch = await bcrypt.compare(callerToken, row.token_hash);
            if (isMatch) { callerIsAdmin = true; break; }
          } catch { /* hash inválido, ignorar */ }
        }
      } catch (err) {
        console.error('[Register] Erro ao verificar admin:', err);
      }

      if (!callerIsAdmin) {
        throw new ApiError(403, 'Somente administradores podem criar contas de equipe');
      }
      await ensureUserRoleEnumValues();
      userRole = 'team';
    }

    // Criar usuário no banco de dados — reativa a conta excluída se existir,
    // senão insere um registro novo.
    let result;
    try {
      if (deletedUserId) {
        result = await query(
          `UPDATE equalizagro.users
           SET phone = $1,
               full_name = $2,
               password_hash = $3,
               email_verification_token = $4,
               email_verification_expires_at = NOW() + INTERVAL '24 hours',
               role = $5,
               auth_status = 'pending',
               email_verified = false,
               credits_balance = 0,
               total_credits_purchased = 0,
               billing_exempt = $6,
               terms_accepted_at = $7,
               terms_version = $8,
               deleted_at = NULL,
               updated_at = NOW()
           WHERE id = $9
           RETURNING id`,
          [phone, name, passwordHash, emailVerificationToken, userRole, billingExempt, termsAcceptedAt, termsAcceptedAt ? TERMS_VERSION : null, deletedUserId]
        );
      } else {
        result = await query(
          `INSERT INTO equalizagro.users (
            email,
            phone,
            full_name,
            password_hash,
            email_verification_token,
            email_verification_expires_at,
            role,
            auth_status,
            billing_exempt,
            terms_accepted_at,
            terms_version
          ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours', $6, 'pending', $7, $8, $9)
          RETURNING id`,
          [email.toLowerCase(), phone, name, passwordHash, emailVerificationToken, userRole, billingExempt, termsAcceptedAt, termsAcceptedAt ? TERMS_VERSION : null]
        );
      }
    } catch (err) {
      console.error('[Register] Erro ao criar usuário:', err);
      throw new ApiError(500, 'Erro ao criar usuário');
    }

    const userId = result.rows[0].id;

    // Salvar campos extras da equipe (cargo, regiao, interesse, comoConheceu) se fornecidos
    if (cargo || regiao || interesse || comoConheceu) {
      try {
        const metadata = JSON.stringify({ cargo, regiao, interesse, comoConheceu });
        await query(
          `UPDATE equalizagro.users SET metadata = $1 WHERE id = $2`,
          [metadata, userId]
        ).catch(() => {
          // Coluna metadata pode não existir ainda — registra no log sem bloquear o cadastro
          console.log(`[Register] Equipe metadata (sem coluna): cargo=${cargo}, regiao=${regiao}, interesse=${interesse}, comoConheceu=${comoConheceu}`);
        });
      } catch {
        // Não bloqueia o cadastro se falhar
      }
    }

    // Criar registro de verificação de email
    try {
      await query(
        `INSERT INTO equalizagro.email_verifications (
          user_id,
          token,
          expires_at
        ) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [userId, emailVerificationToken]
      );
    } catch (err) {
      console.error('[Register] Erro ao criar registro de verificação:', err);
      throw new ApiError(500, 'Erro ao criar verificação de email');
    }

    console.log(`[Register] Novo usuário criado: ${email} (ID: ${userId}, role: ${userRole})`);

    // Envio de email não bloqueia o cadastro — a conta já foi criada com sucesso
    // mesmo que o envio falhe (ex.: RESEND_API_KEY ausente em algum ambiente).
    try {
      await sendVerificationEmail(email, name, emailVerificationToken);
    } catch (err) {
      console.error('[Register] Erro ao enviar email de verificação:', err);
    }

    return apiResponse({
      success: true,
      message: 'Usuário registrado com sucesso! Verifique seu email para ativar sua conta.',
      userId: userId,
      requiresEmailVerification: true,
    });
  } catch (error) {
    return apiError(error);
  }
}
