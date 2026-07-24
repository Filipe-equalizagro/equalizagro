// components/SubscriptionModal/SubscriptionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import './SubscriptionModal.css';

interface SubscriptionPlan {
  id: string;
  name: string;
  billing_interval: 'month' | 'year';
  interval_count: number;
  price: string;
  currency: string;
  trial_days: number;
}

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function SubscriptionModal({ isOpen, onClose, userId }: SubscriptionModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subscriptions/plans');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
        // Pré-seleciona o Anual (melhor custo-benefício) se existir
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
      }
    } catch (err) {
      setError('Erro ao processar assinatura. Tente novamente.');
    } finally {
      setSubscribing(false);
    }
  };

  if (!isOpen) return null;

  // Preço mensal equivalente, para o plano anual (ex.: 1920/12 = 160/mês)
  const monthlyEquivalent = (plan: SubscriptionPlan) =>
    plan.billing_interval === 'year' ? (Number(plan.price) / 12).toFixed(2) : null;

  return (
    <div className="sub-modal-overlay" onClick={onClose}>
      <div className="sub-modal" onClick={e => e.stopPropagation()}>
        <button className="sub-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>

        <div className="sub-modal__badge">
          <Sparkles size={14} />
          <span>7 dias grátis em qualquer plano</span>
        </div>

        <h2 className="sub-modal__title">Assine e tenha acesso ilimitado</h2>
        <p className="sub-modal__subtitle">
          Consultor.IA e todas as ferramentas de pulverização, sem gastar créditos.
        </p>

        {loading ? (
          <div className="sub-modal__loading"><div className="sub-modal__spinner" /></div>
        ) : (
          <>
            <div className="sub-plans">
              {plans.map(plan => {
                const isYear = plan.billing_interval === 'year';
                const monthlyEq = monthlyEquivalent(plan);
                return (
                  <div
                    key={plan.id}
                    className={`sub-plan${selectedPlan === plan.id ? ' sub-plan--selected' : ''}${isYear ? ' sub-plan--highlight' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {isYear && <span className="sub-plan__tag">Melhor custo-benefício</span>}
                    {selectedPlan === plan.id && (
                      <span className="sub-plan__check"><Check size={14} /></span>
                    )}
                    <span className="sub-plan__name">{plan.name}</span>
                    <div className="sub-plan__price">
                      <span className="sub-plan__currency">R$</span>
                      <span className="sub-plan__value">
                        {isYear && monthlyEq ? monthlyEq : Number(plan.price).toFixed(2)}
                      </span>
                      <span className="sub-plan__period">/mês</span>
                    </div>
                    {isYear ? (
                      <span className="sub-plan__total">
                        R$ {Number(plan.price).toFixed(2)} cobrado uma vez por ano
                      </span>
                    ) : (
                      <span className="sub-plan__total">Cobrado mensalmente</span>
                    )}
                    <span className="sub-plan__trial">{plan.trial_days} dias grátis, cancele quando quiser</span>
                  </div>
                );
              })}
            </div>

            {error && <p className="sub-modal__error">{error}</p>}

            <button
              className="sub-modal__cta"
              onClick={handleSubscribe}
              disabled={!selectedPlan || subscribing}
            >
              {subscribing ? 'Redirecionando...' : 'Começar meus 7 dias grátis'}
            </button>
            <p className="sub-modal__fineprint">
              Cartão solicitado agora, cobrança só após o período grátis. Cancele quando quiser.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
