// components/PurchaseModal/PurchaseModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Check, CreditCard } from 'lucide-react';
import './PurchaseModal.css';

interface Plan {
  id: string;
  name: string;
  description: string;
  credits_amount: number;
  price: number;
  currency: string;
  features: any;
}

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPurchaseComplete: () => void;
}

export default function PurchaseModal({ isOpen, onClose, userId, onPurchaseComplete }: PurchaseModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/payments/plans');
      const data = await response.json();
      
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setPurchasing(true);

    try {
      const response = await fetch('/api/payments/create-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          planId: selectedPlan,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirecionar para página de pagamento
        if (data.paymentLink) {
          window.location.href = data.paymentLink;
        }
      } else {
        alert('Erro ao criar compra: ' + data.message);
      }
    } catch (error) {
      console.error('Erro ao criar compra:', error);
      alert('Erro ao processar compra');
    } finally {
      setPurchasing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <h2 className="modal-title">Recarregar Créditos</h2>
        <p className="modal-subtitle">Escolha o plano ideal para suas necessidades</p>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <>
            <div className="plans-grid">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {selectedPlan === plan.id && (
                    <div className="plan-check">
                      <Check size={20} />
                    </div>
                  )}

                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-credits">
                    <span className="credits-amount">{plan.credits_amount}</span>
                    <span className="credits-label">consultas</span>
                  </div>
                  <div className="plan-price">
                    <span className="price-currency">R$</span>
                    <span className="price-value">{plan.price.toFixed(2)}</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                  
                  {plan.features && (
                    <ul className="plan-features">
                      {Object.entries(plan.features).map(([key, value]) => (
                        <li key={key}>
                          <Check size={16} />
                          <span>{String(value)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <button
              className="purchase-button"
              onClick={handlePurchase}
              disabled={!selectedPlan || purchasing}
            >
              <CreditCard size={20} />
              {purchasing ? 'Processando...' : 'Continuar para Pagamento'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
