// src/app/api/consultor/user-plan/route.ts
import { query } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { checkAccess } from '@/lib/subscriptions';
import { getSessionFromRequest } from '@/lib/session';

/**
 * GET - Buscar dados do plano e créditos do usuário autenticado
 * Usa o token para identificar o usuário; aceita userId via query param só
 * como fallback quando não há sessão válida (compat com chamadas antigas).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    let userId = session?.userId ?? null;

    if (!userId) {
      const { searchParams } = new URL(request.url);
      userId = searchParams.get('userId');
    }

    if (!userId) {
      return NextResponse.json({ error: 'Token inválido ou ausente' }, { status: 401 });
    }

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
 * POST - Buscar dados do plano e créditos do usuário autenticado.
 * Exige sessão válida — usa sempre o userId da sessão, nunca o do corpo da
 * requisição (antes aceitava qualquer userId no body sem autenticar nada).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Token inválido ou ausente' }, { status: 401 });
    }

    return fetchUserPlanData(session.userId);
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

  // Isento (equipe/admin) ou assinante ativo (trial ou pagante) tem acesso ilimitado
  const access = await checkAccess(userId);
  const unlimited = access.unlimited;

  return NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      fullName: user.full_name,
      email: user.email,
      planName: unlimited ? 'Assinatura go2apply' : planData.planName,
      creditsAvailable: user.credits_balance || 0,
      creditsUsed: creditsUsed,
      monthlyLimit: planData.monthlyLimit,
      renewalDate: renewalDate.toISOString(),
      joinDate: user.created_at,
      unlimited,
    },
  });
}
