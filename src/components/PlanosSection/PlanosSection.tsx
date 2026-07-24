// components/PlanosSection/PlanosSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Brain, Zap, ShieldCheck, Target, Check, Sparkles } from 'lucide-react';
import './PlanosSection.css';

interface SubscriptionPlan {
  id: string;
  name: string;
  billing_interval: 'month' | 'year';
  interval_count: number;
  price: string;
  currency: string;
  trial_days: number;
}

interface PlanosSectionProps {
  userId: string;
  onSkip?: () => void;
}

const FEATURES = [
  {
    icon: Brain,
    title: 'Consultoria Inteligente',
    description: 'IA treinada com vasto conhecimento em tecnologia de aplicação e manejo agrícola.',
  },
  {
    icon: Zap,
    title: 'Respostas Instantâneas',
    description: 'Orientações precisas em segundos sobre suas dúvidas agronômicas.',
  },
  {
    icon: ShieldCheck,
    title: 'Dados Confidenciais',
    description: 'Informações protegidas com criptografia e segurança de nível empresarial.',
  },
  {
    icon: Target,
    title: 'Recomendações Validadas',
    description: 'Baseado em pesquisa científica e experiência comprovada de especialistas.',
  },
];

export default function PlanosSection({ userId, onSkip }: PlanosSectionProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
        const anual = data.plans.find((p: SubscriptionPlan) => p.billing_interval === 'year');
        setSelectedPlan(anual?.id || data.plans[0]?.id || null);
      }
    } catch (err) {
      console.error('Erro ao buscar planos de assinatura:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    setSubscribing(true);
    setError('');
    try {
      const response = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, planId: selectedPlan }),
      });
      const data = await response.json();
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.message || 'Erro ao iniciar assinatura');
        setSubscribing(false);
      }
    } catch (err) {
      setError('Erro ao processar assinatura. Tente novamente.');
      setSubscribing(false);
    }
  };

  const monthlyEquivalent = (plan: SubscriptionPlan) =>
    plan.billing_interval === 'year' ? (Number(plan.price) / 12).toFixed(2) : null;

  return (
    <div className="planos-page">
      <div className="planos-page__container">

        {/* ── Cabeçalho institucional ── */}
        <div className="planos-hero">
          <a href="/" className="planos-hero__logo">
            <img src="/images/go2apply-logo-colorido.png" alt="go2apply" />
          </a>
          <span className="planos-hero__badge">
            <Sparkles size={14} />
            Tecnologia de Aplicação Agrícola
          </span>
          <h1 className="planos-hero__title">
            Bem-vindo ao <span>go2apply</span>
          </h1>
          <p className="planos-hero__subtitle">
            A plataforma da Equalizagro que une inteligência artificial e ferramentas técnicas
            para transformar a forma como você prepara e aplica suas caldas de pulverização.
          </p>
        </div>

        {/* ── O que você ganha ── */}
        <div className="planos-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="planos-feature">
              <div className="planos-feature__icon"><f.icon size={22} /></div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>

        {/* ── Planos ── */}
        <div className="planos-choice">
          <div className="planos-choice__header">
            <span className="planos-choice__badge">
              <Sparkles size={14} />
              7 dias grátis em qualquer plano
            </span>
            <h2>Escolha seu plano para começar</h2>
            <p>Acesso ilimitado ao Consultor.IA e a todas as ferramentas de pulverização.</p>
          </div>

          {loading ? (
            <div className="planos-choice__loading"><div className="planos-choice__spinner" /></div>
          ) : (
            <>
              <div className="planos-cards">
                {plans.map((plan) => {
                  const isYear = plan.billing_interval === 'year';
                  const monthlyEq = monthlyEquivalent(plan);
                  return (
                    <div
                      key={plan.id}
                      className={`planos-card${selectedPlan === plan.id ? ' planos-card--selected' : ''}${isYear ? ' planos-card--highlight' : ''}`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {isYear && <span className="planos-card__tag">Melhor custo-benefício</span>}
                      {selectedPlan === plan.id && (
                        <span className="planos-card__check"><Check size={14} /></span>
                      )}
                      <span className="planos-card__name">{plan.name}</span>
                      <div className="planos-card__price">
                        <span className="planos-card__currency">R$</span>
                        <span className="planos-card__value">
                          {isYear && monthlyEq ? monthlyEq : Number(plan.price).toFixed(2)}
                        </span>
                        <span className="planos-card__period">/mês</span>
                      </div>
                      {isYear ? (
                        <span className="planos-card__total">
                          R$ {Number(plan.price).toFixed(2)} cobrado uma vez por ano
                        </span>
                      ) : (
                        <span className="planos-card__total">Cobrado mensalmente</span>
                      )}
                      <ul className="planos-card__list">
                        <li><Check size={14} /> Consultor.IA sem limites</li>
                        <li><Check size={14} /> Todas as ferramentas de pulverização</li>
                        <li><Check size={14} /> {plan.trial_days} dias grátis para testar</li>
                        <li><Check size={14} /> Cancele quando quiser</li>
                      </ul>
                    </div>
                  );
                })}
              </div>

              {error && <p className="planos-choice__error">{error}</p>}

              <button
                className="planos-choice__cta"
                onClick={handleSubscribe}
                disabled={!selectedPlan || subscribing}
              >
                {subscribing ? 'Redirecionando...' : 'Começar meus 7 dias grátis'}
              </button>
              <p className="planos-choice__fineprint">
                Pagamento processado com segurança pela Stripe. Cartão solicitado agora,
                cobrança só após o período grátis.
              </p>
              {onSkip && (
                <button className="planos-choice__skip" onClick={onSkip}>
                  Decidir depois, ir para o painel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
