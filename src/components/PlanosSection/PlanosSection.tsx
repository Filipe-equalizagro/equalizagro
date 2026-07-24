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

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
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

  return (
    <div className="planos-page">
      <div className="planos-page__container">

        {/* ── Cabeçalho institucional ── */}
        <div className="planos-hero">
          <a href="/" className="planos-hero__logo">
            <img src="/images/go2apply-logo-colorido.png" alt="go2apply" />
          </a>
          <h1 className="planos-hero__title">
            Bem-vindo ao <span>go2apply</span>
          </h1>
          <p className="planos-hero__subtitle">
            A plataforma da Equalizagro que une inteligência artificial e ferramentas técnicas
            para transformar a forma como você prepara e aplica suas caldas de pulverização.
          </p>
        </div>

        {/* ── Planos ── */}
        <div className="planos-choice">
          <div className="planos-choice__header">
            <span className="planos-choice__badge">
              {paymentMethod === 'card' ? '7 dias grátis em qualquer plano' : 'Pagamento à vista via boleto'}
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
                  const isAnual = plan.name === 'Anual';
                  return (
                    <div
                      key={plan.id}
                      className={`planos-card${selectedPlan === plan.id ? ' planos-card--selected' : ''}${isAnual ? ' planos-card--highlight' : ''}`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {isAnual && <span className="planos-card__tag">Melhor custo-benefício</span>}
                      {selectedPlan === plan.id && (
                        <span className="planos-card__check"><Check size={14} /></span>
                      )}
                      <span className="planos-card__name">{plan.name}</span>
                      <div className="planos-card__price">
                        <span className="planos-card__currency">R$</span>
                        <span className="planos-card__value">{Number(plan.price).toFixed(2)}</span>
                        <span className="planos-card__period">/mês</span>
                      </div>
                      {isAnual ? (
                        <span className="planos-card__total">
                          Compromisso de 12x — R$ {(Number(plan.price) * 12).toFixed(2)} ao ano
                        </span>
                      ) : (
                        <span className="planos-card__total">Cobrado mensalmente</span>
                      )}
                      <ul className="planos-card__list">
                        <li><Check size={14} /> Consultor.IA sem limites</li>
                        <li><Check size={14} /> Todas as ferramentas de pulverização</li>
                        {paymentMethod === 'card' && (
                          <li><Check size={14} /> {plan.trial_days} dias grátis para testar</li>
                        )}
                        <li><Check size={14} /> Cancele quando quiser</li>
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
                    className={`planos-choice__payment-option${paymentMethod === 'boleto' ? ' planos-choice__payment-option--selected' : ''}`}
                    onClick={() => setPaymentMethod('boleto')}
                  >
                    Boleto
                  </button>
                </div>
                {paymentMethod === 'boleto' && (
                  <p className="planos-choice__payment-note">
                    No boleto não há período grátis — o valor do plano é cobrado na primeira fatura.
                  </p>
                )}
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
                  : paymentMethod === 'card'
                  ? 'Começar meus 7 dias grátis'
                  : 'Assinar com boleto'}
              </button>
              <p className="planos-choice__fineprint">
                {paymentMethod === 'card'
                  ? 'Pagamento processado com segurança pela Stripe. Cartão solicitado agora, cobrança só após o período grátis.'
                  : 'Pagamento processado com segurança pela Stripe. Você receberá o boleto para pagamento à vista da primeira fatura.'}
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
