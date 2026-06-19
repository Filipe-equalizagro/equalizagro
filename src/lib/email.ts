import { Resend } from 'resend';

export async function sendPasswordResetEmail(to: string, name: string, token: string, sessionId: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM = process.env.EMAIL_FROM || 'go2apply <noreply@go2apply.com.br>';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://go2apply.com.br';
  const resetUrl = `${APP_URL}/recuperar-senha?token=${token}&sid=${sessionId}`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Recuperação de senha — go2apply',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#f4f9f5;border-radius:12px;">
        <img src="${APP_URL}/images/EQUALIZAGRO%20ok.png" alt="Equalizagro" style="height:40px;margin-bottom:1.5rem;" />
        <h2 style="color:#1a5f3a;margin:0 0 0.75rem;">Recuperação de senha</h2>
        <p style="color:#374151;">Olá, <strong>${name}</strong>.</p>
        <p style="color:#374151;">Recebemos uma solicitação para redefinir a senha da sua conta go2apply. Clique no botão abaixo para criar uma nova senha:</p>
        <a href="${resetUrl}" style="display:inline-block;margin:1.5rem 0;padding:0.8rem 2rem;background:#1a5f3a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
          Redefinir senha
        </a>
        <p style="color:#6b7280;font-size:0.85rem;">Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />
        <p style="color:#9ca3af;font-size:0.78rem;">© Equalizagro 2026 · go2apply</p>
      </div>
    `,
  });
}
