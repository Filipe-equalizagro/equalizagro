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

/**
 * Já teve algum trial concedido antes (em qualquer plano, ativo ou não)?
 * Usado para nunca conceder um segundo período grátis pra mesma pessoa —
 * sem isso, cancelar e assinar de novo (ou simplesmente deixar o cartão
 * recusar a cobrança pós-trial) reiniciaria os 7 dias grátis indefinidamente.
 */
export async function hasEverHadTrial(userId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT 1 FROM equalizagro.user_subscriptions
       WHERE user_id = $1 AND trial_end IS NOT NULL
       LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  } catch {
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

// Categorias de "role" que têm acesso liberado automaticamente ao mudar o
// status no painel admin — Equipe, Parceiros e Administradores. 'support' é
// mantido como alias por compatibilidade com contas antigas (o painel admin
// usava esse valor antes de existir a categoria "Parceiro"). Cliente NÃO
// entra aqui de propósito — precisa de assinatura ou de billing_exempt.
const ROLES_WITH_FREE_ACCESS = new Set(['team', 'support', 'partner', 'admin']);

/**
 * Gate central de acesso ao Consultor.IA e ao Consultor Kow: existem três
 * portas de entrada — role de acesso liberado (equipe/parceiro/admin),
 * isenção manual de cobrança (billing_exempt, ver billing-exempt.ts) ou
 * assinatura ativa/trial (mensal ou anual). Não há mais crédito avulso
 * comprado como caminho de acesso.
 *
 * O acesso por role é calculado na hora (nunca gravado em billing_exempt):
 * essa coluna é reconciliada por e-mail em ensureBillingExemptColumn() a
 * cada request, então gravar a isenção nela por causa do role seria
 * desfeito automaticamente na primeira chamada seguinte. Mudar o role no
 * painel admin já basta — o acesso reflete o valor atual, sempre.
 */
export async function checkAccess(userId: string): Promise<AccessCheck> {
  const result = await query(
    `SELECT billing_exempt, role FROM equalizagro.users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { allowed: false, unlimited: false, exempt: false };

  const { billing_exempt, role } = result.rows[0];
  if (billing_exempt || ROLES_WITH_FREE_ACCESS.has(role)) {
    return { allowed: true, unlimited: true, exempt: true };
  }

  const subscribed = await hasActiveSubscription(userId);
  if (subscribed) return { allowed: true, unlimited: true, exempt: false };

  return { allowed: false, unlimited: false, exempt: false };
}
