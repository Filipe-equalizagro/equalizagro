import { query } from './database';
import { EXEMPT_EMAILS } from './billing-exempt';

/**
 * Garante que as tabelas de conversas e mensagens existam no banco.
 * Usa CREATE TABLE IF NOT EXISTS — seguro para rodar em toda invocação.
 */
export async function ensureCalculatorUsageTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS equalizagro.calculator_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      tab_id TEXT NOT NULL,
      tab_label TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, []);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_calculator_usage_user_id
    ON equalizagro.calculator_usage(user_id)
  `, []);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_calculator_usage_tab_id
    ON equalizagro.calculator_usage(tab_id)
  `, []);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_calculator_usage_created_at
    ON equalizagro.calculator_usage(created_at)
  `, []);
}

/**
 * Histórico de cálculos da calculadora de pulverização — atrelado ao login,
 * persistido no servidor para sincronizar entre dispositivos.
 * `entry` guarda o objeto completo do cálculo (tab, resumo, campos) em JSONB.
 */
export async function ensureCalculatorHistoryTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS equalizagro.calculator_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      client_id BIGINT,
      entry JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, []);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_calculator_history_user_id
    ON equalizagro.calculator_history(user_id)
  `, []);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_calculator_history_created_at
    ON equalizagro.calculator_history(created_at)
  `, []);
}

/**
 * Planos de assinatura recorrente (mensal/anual) e as assinaturas ativas
 * dos usuários, sincronizadas via webhook da Stripe. Enquanto uma assinatura
 * estiver ativa/em trial, o usuário tem acesso ilimitado (não gasta créditos).
 */
export async function ensureSubscriptionTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS equalizagro.subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      billing_interval TEXT NOT NULL,
      interval_count INTEGER NOT NULL DEFAULT 1,
      price NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      trial_days INTEGER NOT NULL DEFAULT 7,
      is_active BOOLEAN DEFAULT true,
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, []);

  await query(`
    CREATE TABLE IF NOT EXISTS equalizagro.user_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      plan_id UUID REFERENCES equalizagro.subscription_plans(id),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'incomplete',
      trial_end TIMESTAMP WITH TIME ZONE,
      current_period_end TIMESTAMP WITH TIME ZONE,
      cancel_at_period_end BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, []);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
    ON equalizagro.user_subscriptions(user_id)
  `, []);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub
    ON equalizagro.user_subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL
  `, []);

  // Semeadura idempotente dos planos atuais — não duplica se já existirem.
  const existing = await query(`SELECT name FROM equalizagro.subscription_plans`, []);
  const existingNames = new Set(existing.rows.map((r: any) => r.name));

  if (!existingNames.has('Mensal')) {
    await query(
      `INSERT INTO equalizagro.subscription_plans
         (name, billing_interval, interval_count, price, currency, trial_days, display_order)
       VALUES ('Mensal', 'month', 1, 222.00, 'BRL', 7, 1)`,
      []
    );
  }
  if (!existingNames.has('Anual')) {
    // "Anual" = compromisso de 12 meses cobrado mensalmente (12x), não mais
    // uma cobrança única anual — por isso billing_interval = 'month'.
    await query(
      `INSERT INTO equalizagro.subscription_plans
         (name, billing_interval, interval_count, price, currency, trial_days, display_order)
       VALUES ('Anual', 'month', 1, 157.00, 'BRL', 7, 2)`,
      []
    );
  }

  // Mantém os preços/condições vigentes sincronizados mesmo em planos já
  // existentes — os valores acima são a fonte da verdade atual dos planos.
  await query(
    `UPDATE equalizagro.subscription_plans
     SET billing_interval = 'month', interval_count = 1, price = 222.00
     WHERE name = 'Mensal' AND (billing_interval <> 'month' OR price <> 222.00)`,
    []
  );
  await query(
    `UPDATE equalizagro.subscription_plans
     SET billing_interval = 'month', interval_count = 1, price = 157.00
     WHERE name = 'Anual' AND (billing_interval <> 'month' OR price <> 157.00)`,
    []
  );
}

/**
 * Coluna que marca usuários da equipe/admin (e suporte externo) isentos de
 * cobrança — acesso ilimitado ao Consultor.IA independente de assinatura.
 * Reconciliada a cada chamada contra a lista mantida em billing-exempt.ts,
 * então basta editar o array lá para adicionar/remover alguém.
 */
export async function ensureBillingExemptColumn(): Promise<void> {
  await query(`ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS billing_exempt BOOLEAN NOT NULL DEFAULT false`, []);

  const emails = EXEMPT_EMAILS.map(e => e.toLowerCase());
  await query(
    `UPDATE equalizagro.users SET billing_exempt = true, updated_at = NOW()
     WHERE LOWER(email) = ANY($1::text[]) AND billing_exempt = false`,
    [emails]
  );
  await query(
    `UPDATE equalizagro.users SET billing_exempt = false, updated_at = NOW()
     WHERE NOT (LOWER(email) = ANY($1::text[])) AND billing_exempt = true`,
    [emails]
  );
}

/**
 * `role` é um ENUM nativo do Postgres (`equalizagro.user_role`), criado
 * originalmente só com 'admin' | 'client' | 'support'. Ao adicionar as
 * categorias 'team' e 'partner' no código, o enum no banco não acompanhou
 * sozinho — gravar esses valores falha com "invalid input value for enum"
 * até que o tipo seja alterado. `ADD VALUE IF NOT EXISTS` é idempotente e
 * seguro de rodar em toda invocação, como as demais funções deste arquivo.
 */
export async function ensureUserRoleEnumValues(): Promise<void> {
  await safeDDL(`ALTER TYPE equalizagro.user_role ADD VALUE IF NOT EXISTS 'team'`);
  await safeDDL(`ALTER TYPE equalizagro.user_role ADD VALUE IF NOT EXISTS 'partner'`);
}

/**
 * Guarda quando e qual versão dos Termos de Uso / Política de Privacidade
 * o usuário aceitou no cadastro — serve de prova do consentimento (a própria
 * cláusula 1.4 dos Termos exige que o aceite seja registrado no cadastro).
 */
export async function ensureTermsAcceptanceColumns(): Promise<void> {
  await query(`ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE`, []);
  await query(`ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS terms_version TEXT`, []);
}

/**
 * CPF (só dígitos) — usado para impedir que a mesma pessoa crie várias contas
 * com emails diferentes só para ganhar vários trials grátis. O índice único é
 * parcial (ignora NULL e contas soft-deleted) para não travar cadastros
 * antigos sem CPF nem impedir reaproveitar o CPF de uma conta já excluída.
 */
/**
 * Contador de revogação de sessão — incrementado no logout (ou quando um
 * admin precisar forçar o usuário a logar de novo). O JWT carrega o valor
 * de token_version no momento em que foi emitido (claim `tv`); a cada
 * requisição comparamos com o valor atual no banco — se não bater, a sessão
 * foi revogada mesmo que o JWT ainda não tenha expirado. Substitui o antigo
 * DELETE FROM auth_tokens (que nunca existiu de fato — logout era só local).
 */
export async function ensureTokenVersionColumn(): Promise<void> {
  await query(`ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`, []);
}

export async function ensureCpfColumn(): Promise<void> {
  await query(`ALTER TABLE equalizagro.users ADD COLUMN IF NOT EXISTS cpf TEXT`, []);
  await safeDDL(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_active
    ON equalizagro.users(cpf)
    WHERE cpf IS NOT NULL AND deleted_at IS NULL
  `);
}

// Executa um statement DDL isoladamente — um erro não aborta os demais.
// Isso é crucial: se um único ALTER/CREATE falhar, o resto do schema ainda
// é garantido, evitando que TODA operação de conversa falhe em cascata.
async function safeDDL(sql: string): Promise<void> {
  try {
    await query(sql, []);
  } catch (e) {
    console.error('[db-init] DDL falhou (ignorado):', (e as Error).message, '\nSQL:', sql.trim().slice(0, 80));
  }
}

export async function ensureConversationTables(): Promise<void> {
  // 1) Garante o schema equalizagro
  await safeDDL(`CREATE SCHEMA IF NOT EXISTS equalizagro`);

  // 2) Cria as tabelas se não existirem
  await safeDDL(`
    CREATE TABLE IF NOT EXISTS equalizagro.conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT NOT NULL DEFAULT 'Nova Conversa',
      message_count INTEGER DEFAULT 0,
      last_message_at TIMESTAMP WITH TIME ZONE,
      is_archived BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await safeDDL(`
    CREATE TABLE IF NOT EXISTS equalizagro.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL,
      user_id UUID NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_used INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // 3) AUTO-CURA de schemas antigos: adiciona colunas que possam faltar em
  //    tabelas criadas por versões anteriores (CREATE IF NOT EXISTS não altera
  //    tabelas já existentes). Se qualquer coluna faltar, INSERT/UPDATE falha
  //    silenciosamente e o histórico nunca é salvo — esta é a correção central.
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Nova Conversa'`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
  await safeDDL(`ALTER TABLE equalizagro.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);

  await safeDDL(`ALTER TABLE equalizagro.messages ADD COLUMN IF NOT EXISTS user_id UUID`);
  await safeDDL(`ALTER TABLE equalizagro.messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER`);
  await safeDDL(`ALTER TABLE equalizagro.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
  await safeDDL(`ALTER TABLE equalizagro.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);

  // 4) Índices
  await safeDDL(`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON equalizagro.conversations(user_id)`);
  await safeDDL(`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON equalizagro.messages(conversation_id)`);
  await safeDDL(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON equalizagro.messages(user_id)`);
}
