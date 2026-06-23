import { query } from './database';

/**
 * Garante que as tabelas de conversas e mensagens existam no banco.
 * Usa CREATE TABLE IF NOT EXISTS — seguro para rodar em toda invocação.
 */
export async function ensureConversationTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS equalizagro.conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT NOT NULL DEFAULT 'Nova Conversa',
      gptmaker_context_id TEXT,
      message_count INTEGER DEFAULT 0,
      last_message_at TIMESTAMP WITH TIME ZONE,
      is_archived BOOLEAN DEFAULT false,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `, []);

  await query(`
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
  `, []);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id
    ON equalizagro.conversations(user_id)
  `, []);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON equalizagro.messages(conversation_id)
  `, []);
}
