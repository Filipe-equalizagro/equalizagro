// components/PlanosSection/PlanosSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Brain, Zap, ShieldCheck, Target, Check } from 'lucide-react';
import './PlanosSection.css';

interface SubscriptionPlan {
  id: string;
  name: string;
  billing_interval: 'month' | 'year';
  interval_count: number;
  price: string;
  currency: string;
  trial_days: number;
  boleto_price: number | null;
  boleto_is_one_time: boolean;
}

interface PlanosSectionProps {
  userId: string;
  onSkip?: () => void;
}

export default function PlanosSection({ userId, onSkip }: PlanosSectionProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'boleto'>('card');
  const [hadTrialBefore, setHadTrialBefore] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`/api/subscriptions/plans?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
        setHadTrialBefore(!!data.hadTrialBefore);
        // Pré-seleciona o Anual (melhor custo-benefício) se existir
        const anual = data.plans.find((p: SubscriptionPlan) => p.name === 'Anual');
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
        body: JSON.stringify({ userId, planId: selectedPlan, promoCode: promoCode.trim() || undefined, paymentMethod }),
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

  const selectedPlanData = plans.find(p => p.id === selectedPlan) || null;
  const isAnualSelected = selectedPlanData?.name === 'Anual';
  const mensalPlan = plans.find(p => p.name === 'Mensal');
  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="planos-page">
      <div className="planos-page__container">

        {/* ── Cabeçalho institucional ── */}
        <div className="planos-hero">
          <a href="/" className="planos-hero__logo">
            <img src="/images/go2apply-logo-colorido.png" alt="go2apply" />
          </a>
          <h1 className="planos-hero__title">Bem-vindo!</h1>
          <p className="planos-hero__subtitle">
            Mais de 10 anos de pesquisa disponíveis em tempo integral para otimizar seu trabalho e ajudar a converter pulverizações em aplicações!
          </p>
          <ul className="planos-hero__features">
            <li><Check size={14} /> Formação de caldas, com ordem e metodologia</li>
            <li><Check size={14} /> Alertas de incompatibilidade</li>
            <li><Check size={14} /> Kow, sugestão de adjuvantes e pH de calda para mais de 400 ingredientes ativos</li>
            <li><Check size={14} /> Dimensionamento de espectro de gotas e condições ambientais</li>
            <li><Check size={14} /> Determinação de Delta T</li>
            <li><Check size={14} /> Cálculos avançados de pressão e vazão</li>
            <li><Check size={14} /> Calibração de fluxômetro</li>
            <li><Check size={14} /> Calibração de aeronaves em solo</li>
            <li><Check size={14} /> Avaliações de uniformidade e desgaste</li>
            <li><Check size={14} /> Geração de relatórios em todas as ferramentas</li>
            <li><Check size={14} /> Comunidade exclusiva para suporte técnico via Telegram</li>
          </ul>
        </div>

        {/* ── Planos ── */}
        <div className="planos-choice">
          <div className="planos-choice__header">
            <span className="planos-choice__badge">
              {paymentMethod === 'boleto'
                ? 'Pagamento à vista via boleto'
                : hadTrialBefore
                ? 'Assinatura com cobrança imediata'
                : '7 dias grátis em qualquer plano'}
            </span>
            <h2>Escolha seu plano para começar:</h2>
            <p>Acesso ilimitado a todas as ferramentas!</p>
          </div>

          {loading ? (
            <div className="planos-choice__loading"><div className="planos-choice__spinner" /></div>
          ) : (
            <>
              <div className="planos-cards">
                {plans.map((plan) => {
                  const isAnual = plan.name === 'Anual';
                  const isBoletoOneTime = paymentMethod === 'boleto' && plan.boleto_is_one_time;
                  const displayPrice = paymentMethod === 'boleto' ? plan.boleto_price ?? Number(plan.price) : Number(plan.price);
                  const isDisabled = paymentMethod === 'boleto' && !isAnual;
                  return (
                    <div
                      key={plan.id}
                      className={`planos-card${selectedPlan === plan.id ? ' planos-card--selected' : ''}${isAnual ? ' planos-card--highlight' : ''}${isDisabled ? ' planos-card--disabled' : ''}`}
                      title={isDisabled ? 'Boleto disponível apenas no plano Anual' : undefined}
                      onClick={() => {
                        if (isDisabled) return;
                        setSelectedPlan(plan.id);
                        if (!isAnual) setPaymentMethod('card');
                      }}
                    >
                      {isAnual && <span className="planos-card__tag">Melhor custo-benefício</span>}
                      {selectedPlan === plan.id && (
                        <span className="planos-card__check"><Check size={14} /></span>
                      )}
                      <span className="planos-card__name">{plan.name}</span>
                      <div className="planos-card__price">
                        <span className="planos-card__currency">R$</span>
                        <span className="planos-card__value">{formatBRL(displayPrice)}</span>
                        {!isBoletoOneTime && <span className="planos-card__period">/mês</span>}
                      </div>
                      {isBoletoOneTime ? (
                        <span className="planos-card__total">Pagamento único — 12 meses de acesso</span>
                      ) : isAnual ? (
                        <>
                          <span className="planos-card__total">Renovação anual</span>
                          <span className="planos-card__total">R$ {formatBRL(displayPrice * 12)}/ano em 12x</span>
                          {mensalPlan && (
                            <span className="planos-card__savings">
                              Economize R$ {formatBRL((Number(mensalPlan.price) - displayPrice) * 12)}!
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="planos-card__total">Renovação mensal</span>
                      )}
                      <ul className="planos-card__list">
                        <li><Check size={14} /> Sem limites de uso</li>
                        {paymentMethod === 'card' && !hadTrialBefore && (
                          <li><Check size={14} /> {plan.trial_days} dias grátis para testar</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="planos-choice__payment-method">
                <label>Forma de pagamento</label>
                <div className="planos-choice__payment-options">
                  <button
                    type="button"
                    className={`planos-choice__payment-option${paymentMethod === 'card' ? ' planos-choice__payment-option--selected' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    Cartão de crédito
                  </button>
                  <button
                    type="button"
                    disabled={!isAnualSelected}
                    title={!isAnualSelected ? 'Boleto disponível apenas no plano Anual' : undefined}
                    className={`planos-choice__payment-option${paymentMethod === 'boleto' ? ' planos-choice__payment-option--selected' : ''}${!isAnualSelected ? ' planos-choice__payment-option--disabled' : ''}`}
                    onClick={() => { if (isAnualSelected) setPaymentMethod('boleto'); }}
                  >
                    Boleto
                  </button>
                </div>
                {!isAnualSelected ? (
                  <p className="planos-choice__payment-note">
                    Boleto disponível apenas no plano Anual (pagamento único). O Mensal é cobrado somente no cartão de crédito.
                  </p>
                ) : paymentMethod === 'boleto' ? (
                  <p className="planos-choice__payment-note">
                    No boleto não há período grátis — o valor cobre os 12 meses de acesso, cobrado à vista.
                  </p>
                ) : null}
              </div>

              {isAnualSelected && (
                <div className="planos-choice__promo">
                  <label htmlFor="promo-code">Código promocional (opcional)</label>
                  <input
                    id="promo-code"
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Digite seu código"
                  />
                </div>
              )}

              {error && <p className="planos-choice__error">{error}</p>}

              <button
                className="planos-choice__cta"
                onClick={handleSubscribe}
                disabled={!selectedPlan || subscribing}
              >
                {subscribing
                  ? 'Redirecionando...'
                  : paymentMethod === 'boleto'
                  ? 'Gerar boleto anual'
                  : hadTrialBefore
                  ? 'Assinar agora'
                  : 'Começar meus 7 dias grátis'}
              </button>
              <p className="planos-choice__fineprint">
                {paymentMethod === 'boleto'
                  ? 'Pagamento processado com segurança pela Stripe. O boleto cobre os 12 meses de acesso — pagamento único, sem recorrência mensal.'
                  : hadTrialBefore
                  ? 'Pagamento processado com segurança pela Stripe. Como você já usou o período grátis antes, esta assinatura já começa cobrando.'
                  : 'Pagamento processado com segurança pela Stripe. Cartão solicitado agora, cobrança só após o período grátis.'}
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
