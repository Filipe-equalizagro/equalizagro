// components/SubscriptionModal/SubscriptionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import './SubscriptionModal.css';

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
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'boleto'>('card');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPromoCode('');
      setPaymentMethod('card');
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
      }
    } catch (err) {
      setError('Erro ao processar assinatura. Tente novamente.');
    } finally {
      setSubscribing(false);
    }
  };

  if (!isOpen) return null;

  const selectedPlanData = plans.find(p => p.id === selectedPlan) || null;
  const isAnualSelected = selectedPlanData?.name === 'Anual';

  return (
    <div className="sub-modal-overlay" onClick={onClose}>
      <div className="sub-modal" onClick={e => e.stopPropagation()}>
        <button className="sub-modal__close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>

        <div className="sub-modal__badge">
          <span>{paymentMethod === 'card' ? '7 dias grátis em qualquer plano' : 'Pagamento à vista via boleto'}</span>
        </div>

        <h2 className="sub-modal__title">Assine e tenha acesso ilimitado</h2>
        <p className="sub-modal__subtitle">
          Consultor.IA, Pulverização e Consultor Kow, sem limites.
        </p>

        {loading ? (
          <div className="sub-modal__loading"><div className="sub-modal__spinner" /></div>
        ) : (
          <>
            <div className={`sub-plans${paymentMethod === 'boleto' ? ' sub-plans--single' : ''}`}>
              {plans
                .filter(plan => paymentMethod !== 'boleto' || plan.name === 'Anual')
                .map(plan => {
                const isAnual = plan.name === 'Anual';
                const isBoletoOneTime = paymentMethod === 'boleto' && plan.boleto_is_one_time;
                const displayPrice = paymentMethod === 'boleto' ? plan.boleto_price ?? Number(plan.price) : Number(plan.price);
                return (
                  <div
                    key={plan.id}
                    className={`sub-plan${selectedPlan === plan.id ? ' sub-plan--selected' : ''}${isAnual ? ' sub-plan--highlight' : ''}`}
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      // Boleto só existe para o Anual — volta pro cartão ao escolher Mensal
                      if (!isAnual) setPaymentMethod('card');
                    }}
                  >
                    {isAnual && <span className="sub-plan__tag">Melhor custo-benefício</span>}
                    {selectedPlan === plan.id && (
                      <span className="sub-plan__check"><Check size={14} /></span>
                    )}
                    <span className="sub-plan__name">{plan.name}</span>
                    <div className="sub-plan__price">
                      <span className="sub-plan__currency">R$</span>
                      <span className="sub-plan__value">{displayPrice.toFixed(2)}</span>
                      {!isBoletoOneTime && <span className="sub-plan__period">/mês</span>}
                    </div>
                    {isBoletoOneTime ? (
                      <span className="sub-plan__total">Pagamento único — 12 meses de acesso</span>
                    ) : isAnual ? (
                      <span className="sub-plan__total">
                        Compromisso de 12x — R$ {(displayPrice * 12).toFixed(2)} ao ano
                      </span>
                    ) : (
                      <span className="sub-plan__total">Cobrado mensalmente</span>
                    )}
                    <span className="sub-plan__trial">
                      {paymentMethod === 'card'
                        ? isAnual
                          ? `${plan.trial_days} dias grátis, renovação automática após 12 meses`
                          : `${plan.trial_days} dias grátis, cancele quando quiser`
                        : isAnual
                        ? 'Renovação automática após 12 meses'
                        : 'Cancele quando quiser'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="sub-modal__payment-method">
              <label>Forma de pagamento</label>
              <div className="sub-modal__payment-options">
                <button
                  type="button"
                  className={`sub-modal__payment-option${paymentMethod === 'card' ? ' sub-modal__payment-option--selected' : ''}`}
                  onClick={() => setPaymentMethod('card')}
                >
                  Cartão de crédito
                </button>
                <button
                  type="button"
                  disabled={!isAnualSelected}
                  title={!isAnualSelected ? 'Boleto disponível apenas no plano Anual' : undefined}
                  className={`sub-modal__payment-option${paymentMethod === 'boleto' ? ' sub-modal__payment-option--selected' : ''}${!isAnualSelected ? ' sub-modal__payment-option--disabled' : ''}`}
                  onClick={() => { if (isAnualSelected) setPaymentMethod('boleto'); }}
                >
                  Boleto
                </button>
              </div>
              {!isAnualSelected ? (
                <p className="sub-modal__payment-note">
                  Boleto disponível apenas no plano Anual (pagamento único). O Mensal é cobrado somente no cartão de crédito.
                </p>
              ) : paymentMethod === 'boleto' ? (
                <p className="sub-modal__payment-note">
                  No boleto não há período grátis — o valor cobre os 12 meses de acesso, cobrado à vista.
                </p>
              ) : null}
            </div>

            {isAnualSelected && paymentMethod === 'card' && (
              <div className="sub-modal__promo">
                <label htmlFor="sub-promo-code">Código promocional (opcional)</label>
                <input
                  id="sub-promo-code"
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Digite seu código"
                />
              </div>
            )}

            {error && <p className="sub-modal__error">{error}</p>}

            <button
              className="sub-modal__cta"
              onClick={handleSubscribe}
              disabled={!selectedPlan || subscribing}
            >
              {subscribing
                ? 'Redirecionando...'
                : paymentMethod === 'card'
                ? 'Começar meus 7 dias grátis'
                : 'Gerar boleto anual'}
            </button>
            <p className="sub-modal__fineprint">
              {paymentMethod === 'card'
                ? isAnualSelected
                  ? 'Cartão solicitado agora, cobrança só após o período grátis. Compromisso de 12 meses, renovação automática.'
                  : 'Cartão solicitado agora, cobrança só após o período grátis. Cancele quando quiser.'
                : 'O boleto cobre os 12 meses de acesso — pagamento único, sem recorrência mensal.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
