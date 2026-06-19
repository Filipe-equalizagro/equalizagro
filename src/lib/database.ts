// lib/database.ts
// Biblioteca de conexão com PostgreSQL
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Singleton global — evita criar múltiplos pools no hot-reload do Next.js (dev)
// e reutiliza a mesma instância entre invocações no mesmo container serverless
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'equalizagro',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
      : undefined,
    // Serverless: pool pequeno — cada container tem o seu
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    idleTimeoutMillis:           60_000, // 1 min — mantém conexão aquecida
    connectionTimeoutMillis:     10_000, // 10 s — era 2 s, insuficiente para cold start
    keepAlive:                   true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

// Em produção cria um pool por container; em dev reutiliza para não esgotar conexões
const pool: Pool =
  process.env.NODE_ENV === 'production'
    ? createPool()
    : (globalThis.__pgPool ??= createPool());

pool.on('error', (err) => {
  console.error('[Database] Pool error:', err);
});

// Erros transitórios de rede que justificam retry
const RETRYABLE = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT',
]);

function isRetryable(err: any): boolean {
  if (RETRYABLE.has(err?.code)) return true;
  const msg: string = err?.message ?? '';
  return (
    msg.includes('Connection terminated') ||
    msg.includes('connection timeout') ||
    msg.includes('Client was closed') ||
    msg.includes('read ECONNRESET')
  );
}

/**
 * Executa uma query com retry automático em erros de conexão transitórios.
 * Tenta até 3 vezes com backoff: 0 ms → 400 ms → 800 ms.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  attempt = 1
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    console.log('[Database] Query OK', { duration: Date.now() - start, rows: result.rowCount });
    return result;
  } catch (error: any) {
    const maxAttempts = 3;
    if (attempt < maxAttempts && isRetryable(error)) {
      const delay = (attempt - 1) * 400; // 0 ms, 400 ms, 800 ms
      console.warn(`[Database] Retry ${attempt}/${maxAttempts - 1} após ${delay} ms — ${error.message}`);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      return query(text, params, attempt + 1);
    }
    console.error('[Database] Query error:', { text, error });
    throw error;
  }
}

/**
 * Obtém um cliente do pool para transações
 */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

/**
 * Executa uma transação
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica se a conexão com o banco está funcionando
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

// Tipos de dados
export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  password_hash: string;
  role: 'admin' | 'client' | 'support';
  auth_status: 'pending' | 'verified' | 'suspended' | 'inactive';
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  credits_balance: number;
  total_credits_purchased: number;
  email_verified: boolean;
  email_verification_token: string | null;
  device_fingerprint: string | null;
  last_2fa_verification: Date | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreditPlan {
  id: string;
  name: string;
  description: string | null;
  credits_amount: number;
  price: number;
  currency: string;
  is_active: boolean;
  display_order: number;
  features: any;
}

export interface CreditPurchase {
  id: string;
  user_id: string;
  plan_id: string | null;
  credits_purchased: number;
  amount_paid: number;
  currency: string;
  payment_status: string;
  payment_method: string | null;
  payment_provider: string | null;
  payment_id: string | null;
  payment_data: any;
  paid_at: Date | null;
  created_at: Date;
}

export interface AIConsultation {
  id: string;
  user_id: string;
  question_data: any;
  question_text: string | null;
  ai_response: string;
  response_metadata: any;
  credits_used: number;
  was_reused: boolean;
  processing_time_ms: number | null;
  webhook_request_id: string | null;
  n8n_execution_id: string | null;
  created_at: Date;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: string;
  credits_amount: number;
  balance_before: number;
  balance_after: number;
  purchase_id: string | null;
  consultation_id: string | null;
  description: string | null;
  metadata: any;
  created_at: Date;
}

export default pool;
