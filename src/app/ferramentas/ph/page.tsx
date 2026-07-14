'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Droplets } from 'lucide-react';
import { verifySession } from '@/lib/auth';
import './ph.css';

export default function CalculoPhPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const result = await verifySession();
      if (!result.valid) {
        window.location.href = '/';
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    checkSession();
  }, []);

  if (isLoading) {
    return (
      <div className="ph-loading">
        <div className="ph-loading__spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="ph-page">
      <header className="ph-page__header">
        <Link href="/dashboard" className="ph-page__back">
          <ArrowLeft size={20} />
          <span>Voltar ao painel</span>
        </Link>
      </header>

      <section className="ph-page__content">
        <div className="ph-page__icon">
          <Droplets size={64} />
        </div>
        <h1 className="ph-page__title">Cálculo de pH</h1>
        <p className="ph-page__desc">
          Calcule e ajuste o pH da calda de pulverização para máxima eficiência na aplicação de defensivos.
        </p>
      </section>
    </main>
  );
}
