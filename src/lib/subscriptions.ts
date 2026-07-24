import { query } from './database';

/**
 * Um usuário com assinatura ativa (ou em período de trial) tem acesso
 * ilimitado — não deve ter créditos descontados por uso.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  try {
    // current_period_end > NOW() é essencial para o Anual pago via boleto:
    // é um pagamento único (sem objeto de assinatura recorrente na Stripe),
    // então nada mais fliparia o status automaticamente ao fim do ano — sem
    // essa checagem, o acesso ficaria ilimitado para sempre após 1 pagamento.
    const result = await query(
      `SELECT 1 FROM equalizagro.user_subscriptions
       WHERE user_id = $1 AND status IN ('trialing', 'active')
       AND (current_period_end IS NULL OR current_period_end > NOW())
       LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  } catch {
    // Tabela pode não existir ainda em algum ambiente — trata como "sem assinatura"
    return false;
  }
}

export type AccessCheck = {
  allowed: boolean;
  /** true quando o acesso é ilimitado (isento ou assinante) — não descontar crédito */
  unlimited: boolean;
  /** true especificamente quando o acesso vem da isenção de cobrança (equipe/admin) */
  exempt: boolean;
};

/**
 * Gate central de acesso ao Consultor.IA: usuários isentos (equipe/admin) ou
 * com assinatura ativa/trial têm acesso ilimitado. Os demais só passam se
 * ainda tiverem créditos — sem créditos e sem assinatura, acesso é negado.
 */
export async function checkAccess(userId: string): Promise<AccessCheck> {
  const result = await query(
    `SELECT billing_exempt, credits_balance FROM equalizagro.users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { allowed: false, unlimited: false, exempt: false };

  const { billing_exempt, credits_balance } = result.rows[0];
  if (billing_exempt) return { allowed: true, unlimited: true, exempt: true };

  const subscribed = await hasActiveSubscription(userId);
  if (subscribed) return { allowed: true, unlimited: true, exempt: false };

  const hasCredits = Number(credits_balance || 0) > 0;
  return { allowed: hasCredits, unlimited: false, exempt: false };
}
