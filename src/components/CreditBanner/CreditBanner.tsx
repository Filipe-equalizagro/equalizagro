// components/CreditBanner/CreditBanner.tsx
'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, ShoppingCart, TrendingUp } from 'lucide-react';
import './CreditBanner.css';

interface CreditBannerProps {
  userId: string;
  onPurchaseClick: () => void;
}

export default function CreditBanner({ userId, onPurchaseClick }: CreditBannerProps) {
  const [credits, setCredits] = useState<number>(0);
  const [totalPurchased, setTotalPurchased] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredits();
  }, [userId]);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/consultor/check-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCredits(data.credits.balance);
        setTotalPurchased(data.credits.totalPurchased);
      }
    } catch (error) {
      console.error('Erro ao buscar créditos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (credits === 0) return 'critical';
    if (credits < 10) return 'warning';
    return 'healthy';
  };

  const getStatusMessage = () => {
    if (credits === 0) return 'Sem créditos';
    if (credits < 10) return 'Créditos baixos';
    return 'Créditos disponíveis';
  };

  if (loading) {
    return (
      <div className="credit-banner loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={`credit-banner ${getStatusColor()}`}>
      <div className="credit-info">
        <div className="credit-icon">
          {credits === 0 ? <AlertCircle size={24} /> : <TrendingUp size={24} />}
        </div>
        <div className="credit-details">
          <span className="credit-label">{getStatusMessage()}</span>
          <span className="credit-value">{credits} consultas</span>
        </div>
      </div>

      {credits < 20 && (
        <button className="recharge-button" onClick={onPurchaseClick}>
          <ShoppingCart size={18} />
          Recarregar Créditos
        </button>
      )}
    </div>
  );
}
