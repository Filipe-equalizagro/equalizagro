import { query } from './database';

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
