'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Brain } from 'lucide-react';
import Link from 'next/link';
import IASection from '@/components/IASection/IASection';
import Contact from '@/components/Contact/Contact';
import Footer from '@/components/Footer/Footer';
import { verifySession } from '@/lib/auth';
import './ia-page.css';

export default function IAPage() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const result = await verifySession();
          if (result.valid) {
            window.location.href = '/dashboard';
            return;
          }
        }
      } catch {
        // sessão inválida — exibe a página normalmente
      }
      setChecking(false);
    };
    check();
  }, []);

  if (checking) {
    return (
      <div className="ia-page__checking">
        <div className="ia-page__checking-spinner" />
      </div>
    );
  }

  return (
    <main className="ia-page">
      <header className="ia-page__header">
        <div className="ia-page__header-container">
          <Link href="/" className="ia-page__logo-link">
            <img 
              src="/images/EQUALIZAGRO ok.png" 
              alt="Equalizagro Logo" 
              className="ia-page__logo" 
            />
          </Link>

          <div className="ia-page__header-center">
            <Brain size={16} />
            <span>Plataforma go2apply</span>
          </div>

          <Link href="/" className="ia-page__back-button">
            <ArrowLeft size={18} />
            <span>Voltar ao Site</span>
          </Link>
        </div>
      </header>

      <div className="ia-page__content">
        <IASection />
        <Contact />
      </div>

      <Footer />
    </main>
  );
}
