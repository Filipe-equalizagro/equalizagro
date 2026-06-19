// src/app/api/consultor/user-plan/route.ts
import { query } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

/**
 * Buscar userId do token no banco de dados (auth_tokens)
 * O token é armazenado como bcrypt hash, então precisamos comparar
 */
async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  console.log('[UserPlan] Auth header:', authHeader ? 'presente' : 'ausente');
  
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  
  try {
    // Buscar tokens válidos (não expirados) do banco
    const tokensResult = await query(
      `SELECT user_id, token_hash 
       FROM equalizagro.auth_tokens 
       WHERE expires_at > NOW() AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      []
    );
    
    console.log('[UserPlan] Tokens válidos encontrados:', tokensResult.rows.length);
    
    // Comparar o token com cada hash
    for (const row of tokensResult.rows) {
      const isMatch = await bcrypt.compare(token, row.token_hash);
      if (isMatch) {
        console.log('[UserPlan] Token válido encontrado para userId:', row.user_id);
        return row.user_id;
      }
    }
    
    console.log('[UserPlan] Nenhum token válido correspondente');
    return null;
  } catch (e) {
    console.error('[UserPlan] Erro ao verificar token no banco:', e);
    return null;
  }
}

/**
 * GET - Buscar dados do plano e créditos do usuário autenticado
 * Usa o token para identificar o usuário, ou aceita userId via query param
 */
export async function GET(request: NextRequest) {
  try {
    // Tentar buscar userId do token no banco
    let userId = await getUserIdFromToken(request);
    
    // Fallback: tentar pegar userId da query string (do localStorage)
    if (!userId) {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get('userId');
      console.log('[UserPlan] Usando userId da query:', userId);
    }
    
    if (!userId) {
      console.log('[UserPlan] Nenhum userId encontrado');
      return NextResponse.json({ error: 'Token inválido ou ausente' }, { status: 401 });
    }

    console.log('[UserPlan] Buscando dados para userId:', userId);
    return fetchUserPlanData(userId);
  } catch (error) {
    console.error('[UserPlan GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do plano' },
      { status: 500 }
    );
  }
}

/**
 * POST - Buscar dados do plano e créditos do usuário
 * Body: { userId }
 * Retorna: planName, creditsAvailable, creditsUsed, monthlyLimit, renewalDate
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
    }

    return fetchUserPlanData(userId);
  } catch (error) {
    console.error('[UserPlan POST] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar dados do plano' },
      { status: 500 }
    );
  }
}

/**
 * Helper para buscar dados do plano por userId
 */
async function fetchUserPlanData(userId: string) {
  // Buscar dados do usuário
  const userResult = await query(
    `SELECT 
      id,
      full_name,
      email,
      credits_balance,
      plan_id,
      created_at,
      updated_at
    FROM equalizagro.users 
    WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  const user = userResult.rows[0];

  // Buscar dados do plano se existir
  let planData = {
    planName: 'Gratuito',
    monthlyLimit: 50,
    renewalDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // 30 dias
  };

  if (user.plan_id) {
    const planResult = await query(
      `SELECT name, credits_amount FROM equalizagro.credit_plans WHERE id = $1`,
      [user.plan_id]
    );

    if (planResult.rows.length > 0) {
      const plan = planResult.rows[0];
      planData.planName = plan.name || 'Profissional';
      planData.monthlyLimit = plan.credits_amount || 50;
    }
  }

  // Calcular créditos usados no mês (subtração do limite)
  const creditsUsed = Math.max(0, planData.monthlyLimit - (user.credits_balance || 0));

  // Calcular data de renovação (proximo primeiro dia do mês)
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + 1);
  renewalDate.setDate(1);

  return NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      planName: planData.planName,
      creditsAvailable: user.credits_balance || 0,
      creditsUsed: creditsUsed,
      monthlyLimit: planData.monthlyLimit,
      renewalDate: renewalDate.toISOString(),
      joinDate: user.created_at,
    },
  });
}
