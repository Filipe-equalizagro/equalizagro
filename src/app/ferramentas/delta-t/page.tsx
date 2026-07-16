'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Thermometer } from 'lucide-react';
import { verifySession } from '@/lib/auth';
import './delta-t.css';

export default function CalculoDeltaTPage() {
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
      <div className="delta-t-loading">
        <div className="delta-t-loading__spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="delta-t-page">
      <header className="delta-t-page__header">
        <Link href="/go2apply" className="delta-t-page__back">
          <ArrowLeft size={20} />
          <span>Voltar ao painel</span>
        </Link>
      </header>

      <section className="delta-t-page__content">
        <div className="delta-t-page__icon">
          <Thermometer size={64} />
        </div>
        <h1 className="delta-t-page__title">Cálculo Delta T</h1>
        <p className="delta-t-page__desc">
          Determine o intervalo de temperatura ideal (diferença entre temperatura de bulbo seco e bulbo úmido) para aplicação de defensivos agrícolas.
        </p>
      </section>
    </main>
  );
}
