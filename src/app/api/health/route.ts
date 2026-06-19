// app/api/health/route.ts
import { NextRequest } from 'next/server';
import { query } from '@/lib/database';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    error?: string;
  };
  tables: {
    exists: boolean;
    missing?: string[];
  };
  functions: {
    exists: boolean;
    missing?: string[];
  };
  timestamp: string;
}

export async function GET(request: NextRequest): Promise<Response> {
  const result: HealthCheckResult = {
    status: 'healthy',
    database: { connected: false },
    tables: { exists: true },
    functions: { exists: true },
    timestamp: new Date().toISOString(),
  };

  try {
    // Test database connection
    const connTest = await query('SELECT 1');
    result.database.connected = true;
    console.log('[Health] Database connection OK');
  } catch (err) {
    result.database.connected = false;
    result.database.error = err instanceof Error ? err.message : String(err);
    result.status = 'unhealthy';
    console.error('[Health] Database connection failed:', err);
    return new Response(JSON.stringify(result), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check required tables
  const requiredTables = [
    'equalizagro.users',
    'equalizagro.email_verifications',
    'equalizagro.two_factor_sessions',
    'equalizagro.auth_tokens',
    'equalizagro.credit_plans',
    'equalizagro.credit_purchases',
    'equalizagro.ai_consultations',
    'equalizagro.credit_transactions',
  ];

  const missingTables: string[] = [];
  for (const table of requiredTables) {
    try {
      await query(`SELECT 1 FROM ${table} LIMIT 1`);
    } catch (err) {
      missingTables.push(table);
      result.status = 'degraded';
    }
  }

  if (missingTables.length > 0) {
    result.tables.exists = false;
    result.tables.missing = missingTables;
    console.warn('[Health] Missing tables:', missingTables);
  } else {
    console.log('[Health] All required tables exist');
  }

  // Check required functions
  const requiredFunctions = [
    'equalizagro.should_require_2fa',
    'equalizagro.add_credits',
    'equalizagro.consume_credits',
  ];

  const missingFunctions: string[] = [];
  for (const func of requiredFunctions) {
    try {
      // Extract schema and function name
      const [schema, name] = func.split('.');
      await query(
        `SELECT 1 FROM information_schema.routines 
         WHERE routine_schema = $1 AND routine_name = $2`,
        [schema, name]
      );
    } catch (err) {
      missingFunctions.push(func);
      result.status = 'degraded';
    }
  }

  if (missingFunctions.length > 0) {
    result.functions.exists = false;
    result.functions.missing = missingFunctions;
    console.warn('[Health] Missing functions:', missingFunctions);
  } else {
    console.log('[Health] All required functions exist');
  }

  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 207 : 503;

  return new Response(JSON.stringify(result), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}
